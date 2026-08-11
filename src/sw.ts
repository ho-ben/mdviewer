/// <reference lib="webworker" />

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

precacheAndRoute((self as ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ revision: string | null; url: string }>;
}).__WB_MANIFEST);
cleanupOutdatedCaches();

const navigationHandler = createHandlerBoundToURL("index.html");
registerRoute(new NavigationRoute(navigationHandler, { denylist: [/share-target$/] }));

async function handleShare(request: Request): Promise<Response> {
  const data = await request.formData();
  const sharedFile = data.get("textFile") ?? data.get("markdown");
  const title = String(data.get("title") ?? "").trim();
  const text = String(data.get("text") ?? "").trim();
  const url = String(data.get("url") ?? "").trim();

  let source = [title && `# ${title}`, text, url].filter(Boolean).join("\n\n");
  let name = title ? `${title.replace(/[^\p{L}\p{N} _.-]/gu, "").slice(0, 80) || "Shared"}.md` : "Shared.md";

  if (sharedFile instanceof File && sharedFile.size) {
    if (sharedFile.size > 20 * 1024 * 1024) {
      return Response.redirect(new URL("?share-error=size", self.registration.scope), 303);
    }
    source = await sharedFile.text();
    name = sharedFile.name || name;
  }

  const cache = await caches.open("mdviewer-shared-content");
  const storageUrl = new URL("__shared-markdown", self.registration.scope).href;
  await cache.put(storageUrl, new Response(source, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-File-Name": encodeURIComponent(name)
    }
  }));

  return Response.redirect(new URL("?shared=1", self.registration.scope), 303);
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname.endsWith("/share-target")) {
    event.respondWith(handleShare(event.request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
