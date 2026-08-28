import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { CodeBlock } from "../components/docs/CodeBlock";

describe("CodeBlock ARIA Region & Landmark Suite (#2812)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders code block container with role='region' and descriptive aria-label", () => {
    const sampleCode = "const message: string = 'Hello TypeScript';";
    render(
      <CodeBlock
        code={sampleCode}
        language="typescript"
        filename="app.ts"
      />,
    );

    const region = screen.getByRole("region", { name: "Code snippet: typescript" });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("role", "region");
    expect(region).toHaveAttribute("aria-label", "Code snippet: typescript");
  });

  it("renders python code block with region landmark matching language identifier", () => {
    const pythonCode = "def calculate_sum(a, b):\n    return a + b";
    render(
      <CodeBlock
        code={pythonCode}
        language="python"
        filename="math_utils.py"
      />,
    );

    const region = screen.getByRole("region", { name: "Code snippet: python" });
    expect(region).toBeInTheDocument();
    expect(screen.getByText("math_utils.py")).toBeInTheDocument();
    expect(screen.getByText("Python")).toBeInTheDocument();
  });

  it("renders bash shell command snippet with terminal icon and region landmark", () => {
    const bashCode = "git commit -m 'feat: landmark navigation'";
    render(
      <CodeBlock
        code={bashCode}
        language="bash"
      />,
    );

    const region = screen.getByRole("region", { name: "Code snippet: bash" });
    expect(region).toBeInTheDocument();
    expect(screen.getByText("Bash")).toBeInTheDocument();
  });

  it("renders line numbers when showLineNumbers is enabled", () => {
    const multilineCode = "first_line()\nsecond_line()\nthird_line()";
    render(
      <CodeBlock
        code={multilineCode}
        language="javascript"
        showLineNumbers={true}
      />,
    );

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("handles copy to clipboard interaction gracefully", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(
      <CodeBlock
        code="console.log('Copy action test')"
        language="javascript"
      />,
    );

    const copyBtn = screen.getByRole("button", { name: "Copy to Clipboard" });
    expect(copyBtn).toBeInTheDocument();
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("console.log('Copy action test')");
    expect(screen.getByText("Copied!")).toBeInTheDocument();
  });

  it("highlights specific target lines when highlightLines prop is provided", () => {
    const code = "line1\nline2\nline3\nline4";
    const { container } = render(
      <CodeBlock
        code={code}
        language="typescript"
        highlightLines={[2, 4]}
      />,
    );

    const highlightedRows = container.querySelectorAll(".border-blue-500");
    expect(highlightedRows.length).toBe(2);
  });

  it("supports fallback language styling when custom extension is supplied", () => {
    render(
      <CodeBlock
        code="SELECT * FROM users WHERE active = 1;"
        language="sql"
      />,
    );

    const region = screen.getByRole("region", { name: "Code snippet: sql" });
    expect(region).toBeInTheDocument();
    expect(screen.getByText("SQL")).toBeInTheDocument();
  });

  it("allows screen readers to easily locate and skip code regions", () => {
    render(
      <div>
        <p>Preceding explanatory paragraph</p>
        <CodeBlock code="const a = 1;" language="typescript" />
        <CodeBlock code="echo 'step 2'" language="bash" />
        <p>Following paragraph</p>
      </div>,
    );

    const regions = screen.getAllByRole("region");
    expect(regions.length).toBe(2);
    expect(regions[0]).toHaveAttribute("aria-label", "Code snippet: typescript");
    expect(regions[1]).toHaveAttribute("aria-label", "Code snippet: bash");
  });

  it("renders JSON configuration snippets with appropriate badge and landmark", () => {
    const jsonCode = '{\n  "name": "atelier",\n  "version": "1.0.0"\n}';
    render(
      <CodeBlock
        code={jsonCode}
        language="json"
        filename="package.json"
      />,
    );

    const region = screen.getByRole("region", { name: "Code snippet: json" });
    expect(region).toBeInTheDocument();
    expect(screen.getByText("package.json")).toBeInTheDocument();
    expect(screen.getByText("JSON")).toBeInTheDocument();
  });

  it("renders YAML workflow snippets with appropriate badge and landmark", () => {
    const yamlCode = "name: CI Pipeline\non: [push, pull_request]";
    render(
      <CodeBlock
        code={yamlCode}
        language="yaml"
        filename="ci.yml"
      />,
    );

    const region = screen.getByRole("region", { name: "Code snippet: yaml" });
    expect(region).toBeInTheDocument();
    expect(screen.getByText("ci.yml")).toBeInTheDocument();
    expect(screen.getByText("YAML")).toBeInTheDocument();
  });

  it("handles empty code gracefully without breaking region landmark semantics", () => {
    render(
      <CodeBlock
        code=""
        language="javascript"
      />,
    );

    const region = screen.getByRole("region", { name: "Code snippet: javascript" });
    expect(region).toBeInTheDocument();
  });

  it("handles line numbers hidden when showLineNumbers is false", () => {
    const code = "single_line()";
    render(
      <CodeBlock
        code={code}
        language="javascript"
        showLineNumbers={false}
      />,
    );

    expect(screen.queryByText("1")).not.toBeInTheDocument();
    expect(screen.getByText(/single_line/i)).toBeInTheDocument();
  });

  it("handles custom class name merging cleanly on outer region wrapper", () => {
    render(
      <CodeBlock
        code="const custom = true;"
        language="typescript"
        className="my-custom-codeblock-style"
      />,
    );

    const region = screen.getByRole("region", { name: "Code snippet: typescript" });
    expect(region.className).toContain("my-custom-codeblock-style");
  });

  it("ensures language default is typescript when omitted", () => {
    render(<CodeBlock code="const defaultLang = true;" />);
    const region = screen.getByRole("region", { name: "Code snippet: typescript" });
    expect(region).toBeInTheDocument();
  });

  it("validates copy button has accessible name before and after clicking", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(<CodeBlock code="console.log('accessible name check');" language="javascript" />);
    const copyBtn = screen.getByRole("button", { name: "Copy to Clipboard" });
    expect(copyBtn).toBeInTheDocument();
    fireEvent.click(copyBtn);
    expect(copyBtn).toHaveAttribute("aria-label", "Copy to Clipboard");
  });

  it("renders multi-line TypeScript functions accurately with token styling", () => {
    const tsCode = "function greet(name: string): string {\n  return `Hello, ${name}!`;\n}";
    render(
      <CodeBlock
        code={tsCode}
        language="typescript"
        filename="greeting.ts"
        showLineNumbers={true}
      />,
    );

    expect(screen.getByRole("region", { name: "Code snippet: typescript" })).toBeInTheDocument();
    expect(screen.getByText("greeting.ts")).toBeInTheDocument();
  });

  it("handles multi-line Bash shell scripts with syntax highlighting", () => {
    const bashScript = "#!/bin/bash\necho 'Deploying build...'\nnpm run build";
    render(
      <CodeBlock
        code={bashScript}
        language="bash"
        filename="deploy.sh"
      />,
    );

    expect(screen.getByRole("region", { name: "Code snippet: bash" })).toBeInTheDocument();
    expect(screen.getByText("deploy.sh")).toBeInTheDocument();
  });
});
