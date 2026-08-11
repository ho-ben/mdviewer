import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark-dimmed.css";
import "./styles.css";
import { registerSW } from "virtual:pwa-register";
import { renderMarkdown } from "./markdown";
import sampleMarkdown from "./sample.md?raw";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type FileSystemFileHandleLike = { getFile: () => Promise<File> };
type LaunchParamsLike = { files?: FileSystemFileHandleLike[] };
type LaunchQueueLike = { setConsumer: (consumer: (params: LaunchParamsLike) => void) => void };

declare global {
  interface Window {
    launchQueue?: LaunchQueueLike;
  }
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root is missing");

app.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="./" aria-label="MD Viewer home">
        <span class="brand-mark">M↓</span>
        <span>MD Viewer</span>
      </a>
      <div class="toolbar" aria-label="Document actions">
        <button class="button button-primary" id="open-button" type="button">Open file</button>
        <button class="button button-quiet" id="paste-button" type="button">Paste</button>
        <button class="button button-quiet install-button" id="install-button" type="button" hidden>Install</button>
        <button class="icon-button" id="theme-button" type="button" aria-label="Switch color theme" title="Switch color theme">◐</button>
      </div>
      <input id="file-input" type="file" accept=".md,.markdown,.mdown,.mkd,.txt,text/markdown,text/plain" hidden />
    </header>

    <div class="privacy-strip">
      <span class="status-dot" aria-hidden="true"></span>
      <span>Private by default — files are rendered locally and never uploaded.</span>
    </div>

    <main class="workspace">
      <aside class="contents" aria-label="Table of contents">
        <p class="eyebrow">On this page</p>
        <nav id="toc"></nav>
        <div class="support-card">
          <p>Works offline</p>
          <span>Install once, then open or share Markdown without a connection.</span>
        </div>
      </aside>

      <section class="reader-column">
        <div class="document-bar">
          <div>
            <p class="eyebrow" id="document-kind">Demo document</p>
            <h1 id="file-name">Welcome.md</h1>
          </div>
          <div class="document-meta" id="document-meta"></div>
        </div>

        <div class="drop-zone" id="drop-zone">
          <article class="markdown-body" id="markdown-output"></article>
          <div class="drop-overlay" aria-hidden="true">
            <span>Drop Markdown to open</span>
          </div>
        </div>
      </section>
    </main>

    <div class="toast" id="toast" role="status" aria-live="polite"></div>
  </div>
`;

const output = document.querySelector<HTMLElement>("#markdown-output")!;
const toc = document.querySelector<HTMLElement>("#toc")!;
const fileName = document.querySelector<HTMLElement>("#file-name")!;
const documentKind = document.querySelector<HTMLElement>("#document-kind")!;
const documentMeta = document.querySelector<HTMLElement>("#document-meta")!;
const fileInput = document.querySelector<HTMLInputElement>("#file-input")!;
const openButton = document.querySelector<HTMLButtonElement>("#open-button")!;
const pasteButton = document.querySelector<HTMLButtonElement>("#paste-button")!;
const installButton = document.querySelector<HTMLButtonElement>("#install-button")!;
const themeButton = document.querySelector<HTMLButtonElement>("#theme-button")!;
const dropZone = document.querySelector<HTMLElement>("#drop-zone")!;
const toast = document.querySelector<HTMLElement>("#toast")!;

let installPrompt: BeforeInstallPromptEvent | null = null;
let toastTimer = 0;
let mermaidInitialized = false;

function showToast(message: string) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 3200);
}

function updateToc() {
  const headings = [...output.querySelectorAll<HTMLHeadingElement>("h1, h2, h3")];
  toc.replaceChildren();

  if (!headings.length) {
    toc.innerHTML = '<span class="toc-empty">No headings found</span>';
    return;
  }

  for (const heading of headings) {
    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.className = `toc-level-${heading.tagName.slice(1)}`;
    link.textContent = heading.textContent ?? "Untitled section";
    link.addEventListener("click", () => heading.scrollIntoView({ behavior: "smooth", block: "start" }));
    toc.append(link);
  }
}

async function render(source: string, name: string, kind = "Local document") {
  output.innerHTML = renderMarkdown(source);
  fileName.textContent = name;
  documentKind.textContent = kind;
  const wordCount = source.trim() ? source.trim().split(/\s+/).length : 0;
  documentMeta.textContent = `${wordCount.toLocaleString()} words · ${Math.max(1, Math.ceil(wordCount / 220))} min read`;
  updateToc();
  window.scrollTo({ top: 0, behavior: "smooth" });

  const diagrams = [...output.querySelectorAll<HTMLElement>(".mermaid")];
  if (diagrams.length) {
    try {
      const { default: mermaid } = await import("mermaid");
      if (!mermaidInitialized) {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "neutral",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
        });
        mermaidInitialized = true;
      }
      await mermaid.run({ nodes: diagrams, suppressErrors: true });
    } catch {
      showToast("One diagram could not be rendered; the rest of the document is ready.");
    }
  }
}

async function openFile(file: File) {
  const validExtension = /\.(md|markdown|mdown|mkd|txt)$/i.test(file.name);
  const validType = file.type === "" || file.type.startsWith("text/");
  if (!validExtension && !validType) {
    showToast("That doesn't look like a Markdown or text file.");
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showToast("Please choose a Markdown file smaller than 10 MB.");
    return;
  }

  await render(await file.text(), file.name);
  showToast(`${file.name} opened locally`);
}

async function consumeSharedContent() {
  if (!new URL(location.href).searchParams.has("shared")) return;
  const cache = await caches.open("mdviewer-shared-content");
  const storageUrl = new URL("__shared-markdown", location.href).href;
  const response = await cache.match(storageUrl);
  if (!response) return;

  const source = await response.text();
  const name = decodeURIComponent(response.headers.get("X-File-Name") || "Shared.md");
  await cache.delete(storageUrl);
  history.replaceState({}, "", location.pathname);
  await render(source, name, "Shared document");
  showToast("Shared Markdown opened locally");
}

openButton.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
  if (fileInput.files?.[0]) await openFile(fileInput.files[0]);
  fileInput.value = "";
});

pasteButton.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) throw new Error("Clipboard is empty");
    await render(text, "Pasted.md", "Clipboard document");
    showToast("Clipboard Markdown opened locally");
  } catch {
    showToast("Clipboard access was unavailable. Try opening a file instead.");
  }
});

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
}

dropZone.addEventListener("drop", async (event) => {
  const file = event.dataTransfer?.files[0];
  if (file) await openFile(file);
});

themeButton.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem("mdviewer-theme", nextTheme);
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event as BeforeInstallPromptEvent;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!installPrompt) {
    showToast("Use your browser menu and choose “Install app” or “Add to Home screen”.");
    return;
  }
  await installPrompt.prompt();
  const choice = await installPrompt.userChoice;
  if (choice.outcome === "accepted") installButton.hidden = true;
  installPrompt = null;
});

window.addEventListener("appinstalled", () => {
  installButton.hidden = true;
  showToast("MD Viewer installed — you can now share Markdown files to it.");
});

if (window.launchQueue) {
  window.launchQueue.setConsumer(async (params) => {
    const handle = params.files?.[0];
    if (handle) await openFile(await handle.getFile());
  });
}

const storedTheme = localStorage.getItem("mdviewer-theme");
if (storedTheme === "dark" || storedTheme === "light") {
  document.documentElement.dataset.theme = storedTheme;
}

registerSW({
  immediate: true,
  onOfflineReady: () => showToast("Ready to read Markdown offline"),
  onNeedRefresh() {
    showToast("An update is ready. Reopen the app to use it.");
  }
});

await render(sampleMarkdown, "Welcome.md", "Demo document");
await consumeSharedContent();
