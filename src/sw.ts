/// <reference lib="webworker" />

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { parseSharedFormData } from "./share";

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
  let payload;
  try {
    payload = await parseSharedFormData(await request.formData());
  } catch (error) {
    const reason = error instanceof Error ? error.message : "missing";
    return Response.redirect(new URL(`?share-error=${encodeURIComponent(reason)}`, self.registration.scope), 303);
  }

  const shareId = crypto.randomUUID();
  const cache = await caches.open("mdviewer-shared-content");
  const storageUrl = new URL(`__shared-document/${shareId}`, self.registration.scope).href;
  await cache.put(storageUrl, new Response(payload.source, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-File-Name": encodeURIComponent(payload.name)
    }
  }));

  return Response.redirect(new URL(`?shared=${encodeURIComponent(shareId)}`, self.registration.scope), 303);
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
