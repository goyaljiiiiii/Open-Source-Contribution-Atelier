import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { CodeBlock } from "../components/docs/CodeBlock";

describe("CodeBlock Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders language badge and code content", () => {
    const sampleCode = "const hello = 'world';";
    render(
      <CodeBlock code={sampleCode} language="typescript" filename="example.ts" />
    );

    expect(screen.getByText("example.ts")).toBeInTheDocument();
    expect(screen.getByText("TS")).toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("renders line numbers when showLineNumbers is true", () => {
    const multilineCode = "line1\nline2\nline3";
    render(<CodeBlock code={multilineCode} showLineNumbers={true} />);

    expect(screen.getAllByText("1")[0]).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("handles copy button click and displays Copied! feedback", async () => {
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(<CodeBlock code="echo 'test'" language="bash" />);

    const copyBtn = screen.getAllByRole("button", { name: "Copy to Clipboard" })[0];
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("echo 'test'");
    expect(screen.getByText("Copied!")).toBeInTheDocument();
  });
});
