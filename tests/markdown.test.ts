import { describe, expect, it } from "vitest";
import { renderMarkdown, renderPlainText } from "../src/markdown";
import { parseSharedFormData } from "../src/share";
import { parseNativeDocumentReferences } from "../src/native";

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

  it("renders logs and text literally instead of treating them as Markdown", () => {
    const html = renderPlainText("# not a heading\n<script>alert(1)</script>");
    expect(html).toContain("# not a heading");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<h1>");
    expect(html).not.toContain("<script>");
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
