import { describe, expect, it } from "vitest";
import {
  parseMarkdownToHtml,
  safeUrl,
  splitTableRow,
} from "../workers/markdownParserCore";

describe("markdownParserCore", () => {
  it("renders headings, bold, inline code and links", async () => {
    const html = await parseMarkdownToHtml(
      "# Title\n\nSome **bold** text, `inline code`, and a [link](https://example.com).",
    );

    expect(html).toContain("<h1");
    expect(html).toContain("Title</h1>");
    expect(html).toContain("<strong");
    expect(html).toContain("bold</strong>");
    expect(html).toContain("<code");
    expect(html).toContain("inline code</code>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("escapes raw HTML instead of interpreting it", async () => {
    const html = await parseMarkdownToHtml(
      'Hello <script>alert(1)</script> & <img src=x onerror="alert(2)">',
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<img");
    expect(html).toContain("&amp;");
  });

  it("neutralizes unsafe link schemes", async () => {
    const html = await parseMarkdownToHtml(
      "[click](javascript:alert(1)) [ok](https://example.com)",
    );

    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="#"');
    expect(html).toContain('href="https://example.com"');

    expect(safeUrl("javascript:alert(1)")).toBe("#");
    expect(safeUrl("data:text/html,<b>x</b>")).toBe("#");
    expect(safeUrl("/relative/path")).toBe("/relative/path");
    expect(safeUrl("#anchor")).toBe("#anchor");
    expect(safeUrl("mailto:user@example.com")).toBe("mailto:user@example.com");
  });

  it("parses fenced code blocks and escapes their contents", async () => {
    const html = await parseMarkdownToHtml('```js\nconst x = "<b>&";\n```');

    expect(html).toContain('class="language-js"');
    expect(html).toContain("&lt;b&gt;&amp;");
    expect(html).not.toContain("<b>&");
  });

  it("renders GitHub-style alerts", async () => {
    const html = await parseMarkdownToHtml(
      "> [!NOTE]\n> Remember to hydrate between deploys.",
    );

    expect(html).toContain("NOTE");
    expect(html).toContain("Remember to hydrate between deploys.");
  });

  it("parses tables including escaped pipes", async () => {
    const html = await parseMarkdownToHtml(
      "| Layer | Tech |\n| --- | --- |\n| Frontend | React |",
    );

    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain("<td");
    expect(splitTableRow("| a \\| b | c |")).toEqual(["a | b", "c"]);
  });

  it("parses unordered and ordered lists", async () => {
    const html = await parseMarkdownToHtml(
      "- one\n- two\n\n1. first\n2. second",
    );

    expect(html).toContain("<ul");
    expect(html).toContain("<ol");
    expect(html).toContain("<li");
  });

  it("renders TeX math through KaTeX", async () => {
    const html = await parseMarkdownToHtml("Euler: $e^{i\\pi} + 1 = 0$");

    expect(html).toContain("katex");
  }, 30000);
});
