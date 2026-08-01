import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MarkdownRenderer } from "../components/ui/MarkdownRenderer";

// Mock ArchitectureViewer and framer-motion to prevent node_modules imports during unit test
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock("../components/docs/ArchitectureViewer", () => ({
  ArchitectureViewer: () => <div data-testid="architecture-viewer" />,
}));


describe("MarkdownRenderer Code Block Copy Button", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders a 'Copy code' button and language badge on code blocks in lesson content", () => {
    const markdown = "```bash\necho 'hello world'\n```";

    render(
      <MarkdownRenderer
        content={markdown}
        loadGlossaryFn={async () => []}
      />
    );

    expect(screen.getByText("BASH")).toBeInTheDocument();
    expect(screen.getByText("echo 'hello world'")).toBeInTheDocument();

    const copyBtn = screen.getByRole("button", { name: /Copy code/i });
    expect(copyBtn).toBeInTheDocument();
  });

  it("copies code content when 'Copy code' button is clicked", async () => {
    const markdown = "```python\ndef greet():\n    print('Hello')\n```";

    render(
      <MarkdownRenderer
        content={markdown}
        loadGlossaryFn={async () => []}
      />
    );

    expect(screen.getByText("PYTHON")).toBeInTheDocument();
    const copyBtns = screen.getAllByRole("button", { name: /Copy code/i });
    fireEvent.click(copyBtns[0]);


    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "def greet():\n    print('Hello')"
    );
  });
});
