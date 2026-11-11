import { describe, expect, it } from "vitest";
import { renderMarkdown, renderPlainText } from "../src/markdown";
import { parseSharedFormData } from "../src/share";
import { parseNativeDocumentReferences } from "../src/native";
import { isCloseTabShortcut, removeWelcomeDemoDocuments, replaceDocumentByName } from "../src/documents";
import { createStartupGate } from "../src/startup";

describe("Markdown rendering", () => {
  it("renders GFM tables and task lists", () => {
    const html = renderMarkdown("| A | B |\n|---|---|\n| 1 | 2 |\n\n- [x] done");
    expect(html).toContain("<table>");
    expect(html).toContain('type="checkbox"');
  });

  it("keeps strikethrough scoped inside task-list labels", () => {
    const html = renderMarkdown("- [x] CommonMark, autolinks, and ~~strikethrough~~");
    expect(html).toContain("<s>strikethrough</s></label>");
    expect(html).not.toContain("~~strikethrough~~");
  });

  it("renders dollar and LaTeX bracket math delimiters", () => {
    const html = renderMarkdown("$$x^2$$\n\n\\[y^2\\]\n\nInline \\(z\\).");
    expect(html.match(/class="katex/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("sanitizes executable HTML while retaining safe formatting", () => {
    const html = renderMarkdown('<script>alert(1)</script><strong style="color:red">safe</strong><img src="x" onerror="alert(2)"><a href="javascript:alert(3)">bad link</a>');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("style=");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("<strong>safe</strong>");
  });

  it("keeps KaTeX layout styles and accessible MathML", () => {
    const html = renderMarkdown("$$\\frac{1}{2}$$");
    expect(html).toContain("style=");
    expect(html).toContain("<math");
  });

  it("recognizes Mermaid fences without executing HTML", () => {
    const html = renderMarkdown("```mermaid\nflowchart LR\nA-->B\n```");
    expect(html).toContain('class="mermaid"');
    expect(html).toContain("A--&gt;B");
  });

  it("adds an accessible clipboard button to fenced code blocks", () => {
    const html = renderMarkdown("```js\nconst answer = 42;\n```");
    expect(html).toContain('class="copy-code-button"');
    expect(html).toContain('aria-label="Copy code to clipboard"');
    expect(html).toContain("answer =");
  });

  it("renders logs and text literally instead of treating them as Markdown", () => {
    const html = renderPlainText("# not a heading\n<script>alert(1)</script>");
    expect(html).toContain("# not a heading");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<h1>");
    expect(html).not.toContain("<script>");
  });
});

describe("Cold-start document delivery", () => {
  it("holds file-open work until session restoration is finished", async () => {
    const gate = createStartupGate();
    const events: string[] = [];
    const opening = (async () => {
      await gate.wait();
      events.push("file opened");
    })();

    await Promise.resolve();
    expect(events).toEqual([]);
    events.push("session restored");
    gate.open();
    await opening;
    expect(events).toEqual(["session restored", "file opened"]);
  });
});

describe("Android share parsing", () => {
  it("reads a file from the current manifest field", async () => {
    const data = new FormData();
    data.set("textFile", new File(["# Shared"], "notes.md", { type: "text/markdown" }));
    await expect(parseSharedFormData(data)).resolves.toEqual({ name: "notes.md", source: "# Shared" });
  });

  it("finds file-like attachments even when Android uses another field name", async () => {
    const data = new FormData();
    data.set("attachment", new File(["log line"], "report.log", { type: "text/plain" }));
    await expect(parseSharedFormData(data)).resolves.toEqual({ name: "report.log", source: "log line" });
  });

  it("rejects shares without a file or text instead of opening a blank tab", async () => {
    await expect(parseSharedFormData(new FormData())).rejects.toThrow("missing");
  });
});

describe("Native Android document references", () => {
  it("accepts safe native document metadata", () => {
    expect(parseNativeDocumentReferences([
      { id: "123e4567-e89b-12d3-a456-426614174000", name: "notes.md" }
    ])).toEqual([{ id: "123e4567-e89b-12d3-a456-426614174000", name: "notes.md" }]);
  });

  it("rejects malformed native document metadata", () => {
    expect(parseNativeDocumentReferences([
      { id: "../../secret", name: "notes.md" },
      { id: "123e4567-e89b-12d3-a456-426614174000", name: "" }
    ])).toEqual([]);
  });
});

describe("Reopening documents", () => {
  it("replaces the newest matching tab and removes stale duplicates", () => {
    const documents = [
      { id: "document-1", name: "notes.md", source: "older", kind: "Android Markdown", scrollY: 320 },
      { id: "document-2", name: "other.md", source: "other", kind: "Android Markdown", scrollY: 10 },
      { id: "document-3", name: "notes.md", source: "old", kind: "Android Markdown", scrollY: 180 }
    ];

    const replaced = replaceDocumentByName(documents, "notes.md", "new", "Android Markdown");

    expect(replaced?.id).toBe("document-3");
    expect(replaced?.source).toBe("new");
    expect(replaced?.scrollY).toBe(0);
    expect(documents.map((document) => document.id)).toEqual(["document-2", "document-3"]);
  });

  it("does not replace a differently named file", () => {
    const documents = [
      { id: "document-1", name: "notes.md", source: "old", kind: "Android Markdown", scrollY: 0 }
    ];

    expect(replaceDocumentByName(documents, "notes-2.md", "new", "Android Markdown")).toBeUndefined();
    expect(documents[0].source).toBe("old");
  });
});

describe("Welcome document", () => {
  it("removes the demo without disturbing real open documents", () => {
    const documents = [
      { id: "document-1", name: "Welcome.md", kind: "Demo document" },
      { id: "document-2", name: "notes.txt", kind: "Local text file" }
    ];

    expect(removeWelcomeDemoDocuments(documents)).toBe(true);
    expect(documents).toEqual([
      { id: "document-2", name: "notes.txt", kind: "Local text file" }
    ]);
  });

  it("leaves a real file named Welcome.md open", () => {
    const documents = [
      { id: "document-1", name: "Welcome.md", kind: "Local Markdown" }
    ];

    expect(removeWelcomeDemoDocuments(documents)).toBe(false);
    expect(documents).toHaveLength(1);
  });
});

describe("Tab keyboard shortcuts", () => {
  it("uses Alt/Option plus the physical W key to close a tab", () => {
    expect(isCloseTabShortcut({ altKey: true, code: "KeyW", ctrlKey: false, metaKey: false, repeat: false })).toBe(true);
  });

  it("does not intercept browser, command-key, or repeated variants", () => {
    expect(isCloseTabShortcut({ altKey: false, code: "KeyW", ctrlKey: false, metaKey: true, repeat: false })).toBe(false);
    expect(isCloseTabShortcut({ altKey: true, code: "KeyW", ctrlKey: true, metaKey: false, repeat: false })).toBe(false);
    expect(isCloseTabShortcut({ altKey: true, code: "KeyQ", ctrlKey: false, metaKey: false, repeat: false })).toBe(false);
    expect(isCloseTabShortcut({ altKey: true, code: "KeyW", ctrlKey: false, metaKey: false, repeat: true })).toBe(false);
  });
});
