# MD Viewer

An installable, offline-first Markdown viewer built for Android and the web. Files are parsed entirely in the browser and are never uploaded.

## Features

- CommonMark and GitHub-flavored Markdown, including tables, task lists, strikethrough, autolinks, and fenced code
- KaTeX equations using `$...$`, `$$...$$`, `\\(...\\)`, and `\\[...\\]`
- Footnotes, definition lists, abbreviations, superscript, subscript, highlights, insertions, emoji shortcodes, and sanitized inline HTML
- Mermaid diagrams and syntax-highlighted code blocks
- Markdown plus logs, plain text, CSV/TSV, JSON, YAML, XML, configuration files, source code, and other common text formats
- Local file picker, drag and drop, clipboard paste, Android Web Share Target, and native Android Share/Open with support
- Multiple closable file tabs, including multi-file picker, drop, and launch support, with per-tab scroll positions
- Device-local tab restoration so Android sharing adds a tab without discarding files already open
- Direction-aware app header and an accessible full-height scroll grabber for long files
- Installable and fully usable offline after the first visit
- Responsive light/dark reading interface and print styles

## Run locally

```bash
npm install
npm run dev
```

Validate a production build with:

```bash
npm test
npm run build
```

## Android install and opening files

1. Open the GitHub Pages site in Chrome on Android.
2. Tap **Install** in the app, or use Chrome's **Install app** menu item.
3. In Files, Drive, a notes app, or another app, share a Markdown, log, or text file and choose **MD Viewer**.

The manifest also declares `.md` file associations. Direct “Open with” behavior depends on browser and Android support; sharing to the installed app is the dependable Android path. The File Handling API is also wired up for Chromium platforms that expose it.

## Native Android app

The `android/` project packages the same viewer as a private, offline Android app. It receives Android `Share`, `Share multiple`, and `Open with` intents for Markdown and common text formats. It requests no storage or network permissions: Android grants temporary read access only to files the user explicitly opens or shares.

The package ID is `io.github.hoben.mdviewer`. Treat it as permanent after the first Google Play upload.

### Prepare and build

1. Install the current stable Android Studio with Android SDK 37 and JDK 17.
2. Generate the bundled web assets:

   ```bash
   pnpm android:prepare
   ```

3. Open the `android/` directory in Android Studio and let Gradle sync.
4. Use **Build > Generate Signed App Bundle or APK > Android App Bundle**. Create and safely retain an upload key when prompted; never commit the key or `keystore.properties`.

The resulting signed `.aab` is suitable for Google Play internal testing. Add the intended Google account to the internal tester list, publish the internal release, open its opt-in URL on the Pixel, and install normally through Google Play. See [android/PLAY_STORE.md](android/PLAY_STORE.md) for the release checklist and suggested store declarations.

## Privacy and safety

Rendering happens locally. Open tab contents are stored only in private, device-local app or browser storage so tabs can survive app navigation and restarts; closing a tab removes its saved copy. The native app requests no permissions and has no network access. Raw HTML is sanitized, Mermaid runs in strict mode, and KaTeX trust is disabled. The full policy is at [ho-ben.github.io/mdviewer/privacy.html](https://ho-ben.github.io/mdviewer/privacy.html).
