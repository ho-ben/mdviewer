import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark-dimmed.css";
import "./styles.css";
import { registerSW } from "virtual:pwa-register";
import { renderMarkdown, renderPlainText } from "./markdown";
import sampleMarkdown from "./sample.md?raw";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type FileSystemFileHandleLike = { getFile: () => Promise<File> };
type LaunchParamsLike = { files?: FileSystemFileHandleLike[] };
type LaunchQueueLike = { setConsumer: (consumer: (params: LaunchParamsLike) => void) => void };

const markdownExtensions = new Set(["md", "markdown", "mdown", "mkd"]);
const textExtensions = new Set([
  ...markdownExtensions,
  "txt", "text", "log", "out", "err", "csv", "tsv", "json", "jsonl", "ndjson",
  "yaml", "yml", "toml", "ini", "conf", "cfg", "properties", "xml", "html", "htm",
  "css", "scss", "sass", "less", "js", "mjs", "cjs", "ts", "tsx", "jsx", "py", "rb",
  "go", "rs", "java", "kt", "kts", "c", "h", "cc", "cpp", "hpp", "cs", "php", "swift",
  "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd", "sql", "tex", "r", "diff", "patch",
  "env", "gitignore", "dockerfile", "makefile"
]);

const languageByExtension: Record<string, string> = {
  json: "json", jsonl: "json", ndjson: "json", yaml: "yaml", yml: "yaml", toml: "ini",
  ini: "ini", conf: "ini", cfg: "ini", properties: "properties", xml: "xml", html: "html",
  htm: "html", css: "css", scss: "scss", less: "less", js: "javascript", mjs: "javascript",
  cjs: "javascript", ts: "typescript", tsx: "typescript", jsx: "javascript", py: "python",
  rb: "ruby", go: "go", rs: "rust", java: "java", kt: "kotlin", kts: "kotlin", c: "c",
  h: "c", cc: "cpp", cpp: "cpp", hpp: "cpp", cs: "csharp", php: "php", swift: "swift",
  sh: "bash", bash: "bash", zsh: "bash", fish: "shell", ps1: "powershell", bat: "dos",
  cmd: "dos", sql: "sql", tex: "latex", r: "r", diff: "diff", patch: "diff"
};

function fileExtension(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized === "dockerfile" || normalized === "makefile") return normalized;
  return normalized.includes(".") ? normalized.split(".").pop() ?? "" : normalized;
}

function isMarkdownName(name: string): boolean {
  return markdownExtensions.has(fileExtension(name));
}

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
        <img class="brand-icon" src="./icon-192.png" alt="" width="38" height="38" />
        <span>MD Viewer</span>
      </a>
      <div class="toolbar" aria-label="Document actions">
        <button class="button button-primary" id="open-button" type="button">Open file</button>
        <button class="button button-quiet" id="paste-button" type="button">Paste</button>
        <button class="button button-quiet install-button" id="install-button" type="button" hidden>Install</button>
        <button class="icon-button" id="theme-button" type="button" aria-label="Switch color theme" title="Switch color theme">◐</button>
      </div>
      <input id="file-input" type="file" accept=".md,.markdown,.mdown,.mkd,.txt,.text,.log,.out,.err,.csv,.tsv,.json,.jsonl,.ndjson,.yaml,.yml,.toml,.ini,.conf,.cfg,.properties,.xml,.html,.htm,.css,.scss,.less,.js,.mjs,.cjs,.ts,.tsx,.jsx,.py,.rb,.go,.rs,.java,.kt,.c,.h,.cpp,.hpp,.cs,.php,.swift,.sh,.bash,.zsh,.fish,.ps1,.bat,.cmd,.sql,.tex,.r,.diff,.patch,text/*,application/json,application/xml,application/x-yaml" hidden />
    </header>

    <div class="privacy-strip">
      <span class="status-dot" aria-hidden="true"></span>
      <span>Private by default — text files are rendered locally and never uploaded.</span>
    </div>

    <main class="workspace">
      <aside class="contents" aria-label="Table of contents">
        <p class="eyebrow">On this page</p>
        <nav id="toc"></nav>
        <div class="support-card">
          <p>Works offline</p>
          <span>Install once, then open or share Markdown, logs, and text files without a connection.</span>
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
            <span>Drop a text file to open</span>
          </div>
        </div>
      </section>
    </main>

    <div class="toast" id="toast" role="status" aria-live="polite"></div>
    <div class="scroll-rail" id="scroll-rail" role="scrollbar" aria-label="Scroll through file" aria-controls="markdown-output" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0">
      <div class="scroll-thumb" id="scroll-thumb" aria-hidden="true"><i></i><i></i><i></i></div>
    </div>
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
const topbar = document.querySelector<HTMLElement>(".topbar")!;
const scrollRail = document.querySelector<HTMLElement>("#scroll-rail")!;
const scrollThumb = document.querySelector<HTMLElement>("#scroll-thumb")!;

let installPrompt: BeforeInstallPromptEvent | null = null;
let toastTimer = 0;
let mermaidInitialized = false;
let lastScrollY = window.scrollY;
let scrollDirection = 0;
let directionStartedAt = window.scrollY;
let scrollFrame = 0;
let draggedPointer: number | null = null;
let dragOffset = 0;

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
  const markdown = isMarkdownName(name);
  output.innerHTML = markdown
    ? renderMarkdown(source)
    : renderPlainText(source, languageByExtension[fileExtension(name)] ?? "plaintext");
  output.classList.toggle("plain-document", !markdown);
  fileName.textContent = name;
  documentKind.textContent = kind;
  const wordCount = source.trim() ? source.trim().split(/\s+/).length : 0;
  const lineCount = source ? source.split(/\r?\n/).length : 0;
  documentMeta.textContent = markdown
    ? `${wordCount.toLocaleString()} words · ${Math.max(1, Math.ceil(wordCount / 220))} min read`
    : `${lineCount.toLocaleString()} lines · ${wordCount.toLocaleString()} words`;
  updateToc();
  window.scrollTo({ top: 0, behavior: "auto" });
  requestAnimationFrame(updateScrollInterface);

  const diagrams = markdown ? [...output.querySelectorAll<HTMLElement>(".mermaid")] : [];
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
      requestScrollUpdate();
    } catch {
      showToast("One diagram could not be rendered; the rest of the document is ready.");
    }
  }
}

async function openFile(file: File) {
  const extension = fileExtension(file.name);
  const validExtension = textExtensions.has(extension);
  const validType = file.type.startsWith("text/")
    || ["application/json", "application/xml", "application/x-yaml", "application/toml"].includes(file.type);
  if (!validExtension && !validType) {
    showToast("That doesn't look like a supported text file.");
    return;
  }

  if (file.size > 20 * 1024 * 1024) {
    showToast("Please choose a text file smaller than 20 MB.");
    return;
  }

  await render(await file.text(), file.name, isMarkdownName(file.name) ? "Local Markdown" : "Local text file");
  showToast(`${file.name} opened locally`);
}

function scrollMetrics() {
  const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const travel = Math.max(0, scrollRail.clientHeight - scrollThumb.offsetHeight);
  return { maximum, travel };
}

function updateScrollInterface() {
  scrollFrame = 0;
  const current = window.scrollY;
  const direction = current === lastScrollY ? scrollDirection : current > lastScrollY ? 1 : -1;

  if (direction !== scrollDirection) {
    scrollDirection = direction;
    directionStartedAt = current;
  }

  if (current < 72 || topbar.contains(document.activeElement)) {
    topbar.classList.remove("is-hidden");
  } else if (Math.abs(current - directionStartedAt) > 14) {
    topbar.classList.toggle("is-hidden", direction > 0);
  }
  lastScrollY = current;

  const { maximum, travel } = scrollMetrics();
  const progress = maximum ? Math.min(1, Math.max(0, current / maximum)) : 0;
  scrollThumb.style.top = `${progress * travel}px`;
  scrollRail.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  scrollRail.classList.toggle("is-disabled", maximum < 2);
}

function requestScrollUpdate() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollInterface);
}

function scrollFromGrabber(clientY: number, behavior: ScrollBehavior = "auto") {
  const railRect = scrollRail.getBoundingClientRect();
  const { maximum, travel } = scrollMetrics();
  const thumbTop = Math.min(travel, Math.max(0, clientY - railRect.top - dragOffset));
  window.scrollTo({ top: travel ? (thumbTop / travel) * maximum : 0, behavior });
}

scrollRail.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  draggedPointer = event.pointerId;
  const thumbRect = scrollThumb.getBoundingClientRect();
  dragOffset = scrollThumb.contains(event.target as Node)
    ? event.clientY - thumbRect.top
    : thumbRect.height / 2;
  scrollRail.setPointerCapture(event.pointerId);
  scrollRail.classList.add("is-dragging");
  scrollFromGrabber(event.clientY);
});

scrollRail.addEventListener("pointermove", (event) => {
  if (event.pointerId === draggedPointer) scrollFromGrabber(event.clientY);
});

function finishGrab(event: PointerEvent) {
  if (event.pointerId !== draggedPointer) return;
  draggedPointer = null;
  scrollRail.classList.remove("is-dragging");
  if (scrollRail.hasPointerCapture(event.pointerId)) scrollRail.releasePointerCapture(event.pointerId);
}

scrollRail.addEventListener("pointerup", finishGrab);
scrollRail.addEventListener("pointercancel", finishGrab);
scrollRail.addEventListener("keydown", (event) => {
  const { maximum } = scrollMetrics();
  const movements: Record<string, number> = {
    ArrowUp: -80,
    ArrowDown: 80,
    PageUp: -window.innerHeight * 0.8,
    PageDown: window.innerHeight * 0.8,
    Home: -maximum,
    End: maximum
  };
  if (!(event.key in movements)) return;
  event.preventDefault();
  window.scrollBy({ top: movements[event.key], behavior: "smooth" });
});

window.addEventListener("scroll", requestScrollUpdate, { passive: true });
window.addEventListener("resize", requestScrollUpdate, { passive: true });
if ("ResizeObserver" in window) new ResizeObserver(requestScrollUpdate).observe(output);

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
