import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CopyButton from "./CopyButton";

function mockExecCommand(result: boolean) {
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue(result),
  });
}

describe("CopyButton", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, "execCommand");
  });

  it("announces successful copies", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    render(<CopyButton text="git status" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(
      await screen.findByRole("button", { name: "Copied!" }),
    ).toBeInTheDocument();
    const statusElements = screen.getAllByRole("status");
    expect(statusElements[statusElements.length - 1]).toHaveTextContent("Copied!.");
  });

  it("shows accessible failure feedback", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi
          .fn()
          .mockRejectedValue(new DOMException("Denied", "NotAllowedError")),
      },
    });
    mockExecCommand(false);

    render(<CopyButton text="git status" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(
      await screen.findByRole("button", { name: "Copy failed" }),
    ).toBeInTheDocument();
    const statusElements = screen.getAllByRole("status");
    expect(statusElements[statusElements.length - 1]).toHaveTextContent(
      "Clipboard permission was denied.",
    );
  });
});
