package io.github.hoben.mdviewer;

import android.app.Activity;
import android.annotation.SuppressLint;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.MimeTypeMap;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final String APP_ORIGIN = "https://appassets.androidplatform.net";
    private static final String APP_URL = APP_ORIGIN + "/assets/www/index.html?native=1";
    private static final int FILE_CHOOSER_REQUEST = 40_101;
    private static final int MAX_FILE_BYTES = 20 * 1024 * 1024;
    private static final int MAX_DOCUMENTS_PER_INTENT = 100;

    private static final Set<String> TEXT_EXTENSIONS = Collections.unmodifiableSet(new LinkedHashSet<>(Arrays.asList(
            "md", "markdown", "mdown", "mkd", "txt", "text", "log", "out", "err",
            "csv", "tsv", "json", "jsonl", "ndjson", "yaml", "yml", "toml", "ini",
            "conf", "cfg", "properties", "xml", "html", "htm", "css", "scss", "sass",
            "less", "js", "mjs", "cjs", "ts", "tsx", "jsx", "py", "rb", "go", "rs",
            "java", "kt", "kts", "c", "h", "cc", "cpp", "hpp", "cs", "php", "swift",
            "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd", "sql", "tex", "r",
            "diff", "patch", "env", "gitignore", "dockerfile", "makefile"
    )));

    private static final Set<String> APPLICATION_TEXT_TYPES = Collections.unmodifiableSet(new LinkedHashSet<>(Arrays.asList(
            "application/json", "application/xml", "application/yaml", "application/x-yaml",
            "application/toml"
    )));

    private final ExecutorService fileReader = Executors.newSingleThreadExecutor();
    private final Map<String, NativeDocument> readableDocuments = new ConcurrentHashMap<>();
    private final List<NativeDocument> pendingDocuments = new ArrayList<>();

    private WebView webView;
    private boolean pageLoaded;
    private ValueCallback<Uri[]> fileChooserCallback;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .addPathHandler("/native/", this::serveNativeDocument)
                .build();

        webView = new WebView(this);
        configureWebView(assetLoader);
        setContentView(webView);
        webView.loadUrl(APP_URL);
        receiveIntent(getIntent());
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView(WebViewAssetLoader assetLoader) {
        WebSettings settings = webView.getSettings();
        // The packaged Markdown renderer requires JavaScript. Navigation is restricted to the
        // appassets origin, no JavaScript interface is exposed, and the app has no network permission.
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true);

        webView.setWebViewClient(new WebViewClient() {
            @Nullable
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (APP_ORIGIN.equals(uri.getScheme() + "://" + uri.getAuthority())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (RuntimeException ignored) {
                    Toast.makeText(MainActivity.this, "No app can open that link.", Toast.LENGTH_SHORT).show();
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (!url.startsWith(APP_ORIGIN)) return;
                pageLoaded = true;
                deliverPendingDocuments();
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (view != webView) return false;
                pageLoaded = false;
                webView.destroy();
                webView = null;
                recreate();
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams fileChooserParams
            ) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = callback;

                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                picker.setType("*/*");
                picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                picker.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                        "text/*", "application/json", "application/xml", "application/yaml",
                        "application/x-yaml", "application/toml", "application/octet-stream"
                });
                startActivityForResult(picker, FILE_CHOOSER_REQUEST);
                return true;
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        receiveIntent(intent);
    }

    private void receiveIntent(@Nullable Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!Intent.ACTION_VIEW.equals(action)
                && !Intent.ACTION_SEND.equals(action)
                && !Intent.ACTION_SEND_MULTIPLE.equals(action)) return;

        LinkedHashSet<Uri> uris = collectUris(intent);
        if (uris.isEmpty() && Intent.ACTION_SEND.equals(action)) {
            CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
            if (text != null && text.length() > 0) {
                String title = safeName(intent.getStringExtra(Intent.EXTRA_TITLE), "Shared.md");
                if (!title.contains(".")) title += ".md";
                enqueueBytes(title, text.toString().getBytes(StandardCharsets.UTF_8));
            }
            return;
        }

        int accepted = 0;
        for (Uri uri : uris) {
            if (accepted++ >= MAX_DOCUMENTS_PER_INTENT) break;
            fileReader.execute(() -> readSharedUri(uri));
        }
    }

    @NonNull
    private LinkedHashSet<Uri> collectUris(Intent intent) {
        LinkedHashSet<Uri> uris = new LinkedHashSet<>();
        if (Intent.ACTION_VIEW.equals(intent.getAction()) && intent.getData() != null) {
            uris.add(intent.getData());
        }

        ClipData clipData = intent.getClipData();
        if (clipData != null) {
            for (int index = 0; index < clipData.getItemCount(); index++) {
                Uri uri = clipData.getItemAt(index).getUri();
                if (uri != null) uris.add(uri);
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Uri single = intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
            if (single != null) uris.add(single);
            ArrayList<Uri> multiple = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri.class);
            if (multiple != null) uris.addAll(multiple);
        } else {
            addLegacyStreamExtras(intent, uris);
        }
        return uris;
    }

    @SuppressWarnings("deprecation")
    private static void addLegacyStreamExtras(Intent intent, Set<Uri> uris) {
        Object single = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (single instanceof Uri) uris.add((Uri) single);
        ArrayList<Uri> multiple = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
        if (multiple != null) uris.addAll(multiple);
    }

    private void readSharedUri(Uri uri) {
        ContentResolver resolver = getContentResolver();
        String name = displayName(resolver, uri);
        String mimeType = resolver.getType(uri);

        if (!isSupportedText(name, mimeType)) {
            showToast(getString(R.string.file_unsupported, name));
            return;
        }

        try (InputStream stream = resolver.openInputStream(uri)) {
            if (stream == null) throw new IOException("Content provider returned no stream");
            byte[] bytes = readLimited(stream);
            if (bytes.length == 0) throw new IOException("The file is empty");
            enqueueBytes(name, bytes);
        } catch (FileTooLargeException error) {
            showToast(getString(R.string.file_too_large, name));
        } catch (IOException | SecurityException error) {
            showToast(getString(R.string.file_unreadable, name));
        }
    }

    private byte[] readLimited(InputStream stream) throws IOException, FileTooLargeException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[16 * 1024];
        int total = 0;
        int count;
        while ((count = stream.read(buffer)) != -1) {
            total += count;
            if (total > MAX_FILE_BYTES) throw new FileTooLargeException();
            output.write(buffer, 0, count);
        }
        return output.toByteArray();
    }

    private void enqueueBytes(String name, byte[] bytes) {
        if (bytes.length > MAX_FILE_BYTES) {
            showToast(getString(R.string.file_too_large, name));
            return;
        }
        String id = UUID.randomUUID().toString();
        NativeDocument document = new NativeDocument(id, safeName(name, "Shared.md"), bytes);
        readableDocuments.put(id, document);
        runOnUiThread(() -> {
            pendingDocuments.add(document);
            deliverPendingDocuments();
        });
    }

    private WebResourceResponse serveNativeDocument(String path) {
        String id = path.startsWith("/") ? path.substring(1) : path;
        NativeDocument document = readableDocuments.remove(id);
        if (document == null) return response(404, "Not Found", new byte[0]);
        return response(200, "OK", document.bytes);
    }

    private static WebResourceResponse response(int status, String reason, byte[] bytes) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        headers.put("X-Content-Type-Options", "nosniff");
        return new WebResourceResponse(
                "text/plain",
                "UTF-8",
                status,
                reason,
                headers,
                new ByteArrayInputStream(bytes)
        );
    }

    private void deliverPendingDocuments() {
        if (!pageLoaded || pendingDocuments.isEmpty()) return;

        JSONArray payload = new JSONArray();
        for (NativeDocument document : pendingDocuments) {
            JSONObject item = new JSONObject();
            try {
                item.put("id", document.id);
                item.put("name", document.name);
                payload.put(item);
            } catch (JSONException impossible) {
                throw new IllegalStateException(impossible);
            }
        }
        pendingDocuments.clear();

        String encoded = Base64.encodeToString(
                payload.toString().getBytes(StandardCharsets.UTF_8),
                Base64.NO_WRAP
        );
        String script = "(() => {"
                + "const bytes=Uint8Array.from(atob('" + encoded + "'),c=>c.charCodeAt(0));"
                + "const docs=JSON.parse(new TextDecoder().decode(bytes));"
                + "let tries=0;"
                + "const deliver=()=>{"
                + "if(typeof window.mdViewerOpenNativeDocuments==='function'){"
                + "window.mdViewerOpenNativeDocuments(docs);"
                + "}else if(tries++<200){setTimeout(deliver,50);}};"
                + "deliver();"
                + "})();";
        webView.evaluateJavascript(script, null);
    }

    private String displayName(ContentResolver resolver, Uri uri) {
        String name = null;
        if (ContentResolver.SCHEME_CONTENT.equals(uri.getScheme())) {
            try (Cursor cursor = resolver.query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (column >= 0) name = cursor.getString(column);
                }
            } catch (RuntimeException ignored) {
                // Fall through to the URI and MIME-based name.
            }
        }
        if (name == null || name.trim().isEmpty()) name = uri.getLastPathSegment();
        name = safeName(name, "Shared");
        if (!name.contains(".")) {
            String extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(resolver.getType(uri));
            if (extension != null && !extension.isEmpty()) name += "." + extension;
        }
        return name;
    }

    private static String safeName(@Nullable String value, String fallback) {
        if (value == null) return fallback;
        String safe = value.replace('\n', ' ').replace('\r', ' ').replace("\u0000", "").trim();
        if (safe.isEmpty()) return fallback;
        return safe.length() > 240 ? safe.substring(0, 240) : safe;
    }

    private static boolean isSupportedText(String name, @Nullable String mimeType) {
        String lowerName = name.toLowerCase(Locale.ROOT);
        int dot = lowerName.lastIndexOf('.');
        String extension = dot >= 0 ? lowerName.substring(dot + 1) : lowerName;
        if (TEXT_EXTENSIONS.contains(extension)) return true;
        if (mimeType == null) return false;
        String normalizedType = mimeType.toLowerCase(Locale.ROOT);
        return normalizedType.startsWith("text/") || APPLICATION_TEXT_TYPES.contains(normalizedType);
    }

    private void showToast(String message) {
        runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_LONG).show());
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || fileChooserCallback == null) return;

        ValueCallback<Uri[]> callback = fileChooserCallback;
        fileChooserCallback = null;
        if (resultCode != RESULT_OK || data == null) {
            callback.onReceiveValue(null);
            return;
        }

        LinkedHashSet<Uri> uris = new LinkedHashSet<>();
        if (data.getData() != null) uris.add(data.getData());
        ClipData clipData = data.getClipData();
        if (clipData != null) {
            for (int index = 0; index < clipData.getItemCount(); index++) {
                Uri uri = clipData.getItemAt(index).getUri();
                if (uri != null) uris.add(uri);
            }
        }
        callback.onReceiveValue(uris.isEmpty() ? null : uris.toArray(new Uri[0]));
    }

    @Override
    protected void onDestroy() {
        if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
        fileChooserCallback = null;
        fileReader.shutdownNow();
        readableDocuments.clear();
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }

    private static final class NativeDocument {
        final String id;
        final String name;
        final byte[] bytes;

        NativeDocument(String id, String name, byte[] bytes) {
            this.id = id;
            this.name = name;
            this.bytes = bytes;
        }
    }

    private static final class FileTooLargeException extends Exception {
    }
}
