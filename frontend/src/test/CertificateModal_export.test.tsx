import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CertificateModal } from "../components/dashboard/CertificateModal";

vi.mock("html-to-image", () => ({
  toPng: vi.fn().mockResolvedValue("data:image/png;base64,dummy"),
  toSvg: vi.fn().mockResolvedValue("data:image/svg+xml;base64,dummy"),
}));

describe("CertificateModal Safari-safe image export", () => {
  it("renders certificate modal with Download PNG button", () => {
    render(
      <CertificateModal
        isOpen={true}
        onClose={vi.fn()}
        username="Nandini"
      />
    );

    const exportBtn = screen.getByText(/download png/i);
    expect(exportBtn).toBeInTheDocument();
  });
});
