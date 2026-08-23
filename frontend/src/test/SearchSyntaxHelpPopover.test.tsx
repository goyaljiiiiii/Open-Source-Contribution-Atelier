import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SearchSyntaxHelpPopover } from "../components/Search/SearchSyntaxHelpPopover";

describe("SearchSyntaxHelpPopover", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders trigger button with correct accessibility attributes", () => {
    render(<SearchSyntaxHelpPopover />);
    const trigger = screen.getByRole("button", { name: /search operator syntax help/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("opens popover on click and closes on close button", () => {
    render(<SearchSyntaxHelpPopover />);
    const trigger = screen.getByRole("button", { name: /search operator syntax help/i });

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: /search query operators guide/i })).toBeInTheDocument();
    expect(screen.getByText("tag:python")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: /close syntax guide/i });
    fireEvent.click(closeBtn);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape key press", () => {
    render(<SearchSyntaxHelpPopover />);
    const trigger = screen.getByRole("button", { name: /search operator syntax help/i });

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onApplySyntax when clicking an example button", () => {
    const handleApply = vi.fn();
    render(<SearchSyntaxHelpPopover onApplySyntax={handleApply} />);

    fireEvent.click(screen.getByRole("button", { name: /search operator syntax help/i }));
    const exampleBtn = screen.getByRole("button", { name: /try: tag:git/i });

    fireEvent.click(exampleBtn);
    expect(handleApply).toHaveBeenCalledWith("tag:git");
  });
});
