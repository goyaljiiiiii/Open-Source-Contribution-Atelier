import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BadgeUnlockModal from "../components/ui/BadgeUnlockModal";
import * as badgeShareCard from "../lib/badgeShareCard";

describe("BadgeUnlockModal Component", () => {
  const mockBadge = {
    id: "bug-hunter",
    name: "Bug Hunter",
    icon: "🐛",
    description: "Awarded for filing 3 verified issue reports.",
    unlockCriteria: "File 3 verified issues",
    earnedAt: "2026-08-24",
    earned: true,
  };

  it("does not render when isOpen is false", () => {
    render(
      <BadgeUnlockModal
        isOpen={false}
        onClose={() => {}}
        badge={mockBadge}
        username="rushabh"
      />,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders modal content when isOpen is true", () => {
    render(
      <BadgeUnlockModal
        isOpen={true}
        onClose={() => {}}
        badge={mockBadge}
        username="rushabh"
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Bug Hunter")).toBeInTheDocument();
    expect(
      screen.getByText("Awarded for filing 3 verified issue reports."),
    ).toBeInTheDocument();
    expect(screen.getByText("Earned by @rushabh")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Download Share Image/i }),
    ).toBeInTheDocument();
  });

  it("calls onClose when close button or backdrop is clicked", () => {
    const handleClose = vi.fn();
    render(
      <BadgeUnlockModal
        isOpen={true}
        onClose={handleClose}
        badge={mockBadge}
        username="rushabh"
      />,
    );

    const closeBtn = screen.getByRole("button", { name: /Close modal/i });
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("triggers downloadBadgeShareCardImage when Download Share Image button is clicked", () => {
    const downloadSpy = vi
      .spyOn(badgeShareCard, "downloadBadgeShareCardImage")
      .mockImplementation(() => {});

    render(
      <BadgeUnlockModal
        isOpen={true}
        onClose={() => {}}
        badge={mockBadge}
        username="rushabh"
      />,
    );

    const downloadBtn = screen.getByRole("button", {
      name: /Download Share Image/i,
    });
    fireEvent.click(downloadBtn);

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(downloadSpy).toHaveBeenCalledWith({
      badgeName: "Bug Hunter",
      badgeIcon: "🐛",
      description: "Awarded for filing 3 verified issue reports.",
      username: "rushabh",
      date: "2026-08-24",
    });

    downloadSpy.mockRestore();
  });
});
