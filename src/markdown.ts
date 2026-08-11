import DOMPurify from "dompurify";
import hljs from "highlight.js";
import MarkdownIt from "markdown-it";
import abbr from "markdown-it-abbr";
import anchor from "markdown-it-anchor";
import deflist from "markdown-it-deflist";
import { full as emoji } from "markdown-it-emoji";
import footnote from "markdown-it-footnote";
import ins from "markdown-it-ins";
import mark from "markdown-it-mark";
import sub from "markdown-it-sub";
import sup from "markdown-it-sup";
import taskLists from "markdown-it-task-lists";
import { katex } from "@mdit/plugin-katex";

DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
  if (data.attrName !== "style" || !(node instanceof Element)) return;
  const isKatex = node.classList.contains("katex") || Boolean(node.closest(".katex"));
  if (!isKatex) data.keepAttr = false;
});

const escapeHtml = (value: string) =>
  value.replace(/[&<>\"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  })[character] ?? character);

const parser = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(code, language) {
    if (language && hljs.getLanguage(language)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(code, { language, ignoreIllegals: true }).value}</code></pre>`;
      } catch {
        // Fall through to escaped plain text.
      }
    }

    return `<pre class="hljs"><code>${escapeHtml(code)}</code></pre>`;
  }
})
  .use(anchor, {
    slugify: (value: string) => value
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
  })
  .use(taskLists, { enabled: false, label: true, labelAfter: false })
  .use(footnote)
  .use(deflist)
  .use(abbr)
  .use(sub)
  .use(sup)
  .use(ins)
  .use(mark)
  .use(emoji)
  .use(katex, {
    delimiters: "all",
    throwOnError: false,
    strict: "warn",
    trust: false
  });

const defaultFence = parser.renderer.rules.fence?.bind(parser.renderer.rules);

parser.renderer.rules.fence = (tokens, index, options, env, self) => {
  const language = tokens[index].info.trim().split(/\s+/)[0].toLowerCase();
  if (language === "mermaid") {
    return `<div class="mermaid">${escapeHtml(tokens[index].content)}</div>`;
  }
  return defaultFence ? defaultFence(tokens, index, options, env, self) : self.renderToken(tokens, index, options);
};

const defaultLinkOpen = parser.renderer.rules.link_open
  ?? ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options));

parser.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const href = String(tokens[index].attrGet("href") ?? "");
  if (/^https?:\/\//i.test(href)) {
    tokens[index].attrSet("target", "_blank");
    tokens[index].attrSet("rel", "noopener noreferrer");
  }
  return defaultLinkOpen(tokens, index, options, env, self);
};

export function renderMarkdown(source: string): string {
  return DOMPurify.sanitize(parser.render(source), {
    USE_PROFILES: { html: true, mathMl: true, svg: true, svgFilters: true },
    ADD_ATTR: ["target", "rel", "class", "id", "aria-hidden", "role"],
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
    FORBID_ATTR: ["onerror", "onload"]
  });
}

export function renderPlainText(source: string, language = "plaintext"): string {
  let content = escapeHtml(source);
  if (language !== "plaintext" && hljs.getLanguage(language)) {
    try {
      content = hljs.highlight(source, { language, ignoreIllegals: true }).value;
    } catch {
      // Escaped plain text is the safe fallback.
    }
  }

  return `<pre class="plain-text-viewer hljs"><code>${content}</code></pre>`;
}
