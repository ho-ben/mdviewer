import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/markdown";

describe("Markdown rendering", () => {
  it("renders GFM tables and task lists", () => {
    const html = renderMarkdown("| A | B |\n|---|---|\n| 1 | 2 |\n\n- [x] done");
    expect(html).toContain("<table>");
    expect(html).toContain('type="checkbox"');
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
});
