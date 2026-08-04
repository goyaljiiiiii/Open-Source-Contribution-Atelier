import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommunityPostComposer } from "../components/community/CommunityFeed";

describe("CommunityPostComposer Image Upload and Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/test-preview");
    URL.revokeObjectURL = vi.fn();
  });

  it("renders composer with file input label and validates image file type/size", () => {
    render(<CommunityPostComposer />);

    const attachBtn = screen.getByText(/attach image/i);
    expect(attachBtn).toBeInTheDocument();

    const fileInput = screen.getByLabelText(/attach image/i) as HTMLInputElement;

    // 1. Invalid file type
    const textFile = new File(["dummy text"], "notes.txt", { type: "text/plain" });
    fireEvent.change(fileInput, { target: { files: [textFile] } });
    expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();

    // 2. Valid image file
    const validImage = new File(["dummy image"], "screenshot.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [validImage] } });
    expect(screen.getByAltText("Upload preview")).toBeInTheDocument();
    expect(screen.getByText(/screenshot\.png/i)).toBeInTheDocument();

    // 3. Remove image preview
    const removeBtn = screen.getByRole("button", { name: /remove image/i });
    fireEvent.click(removeBtn);
    expect(screen.queryByAltText("Upload preview")).not.toBeInTheDocument();
  });
});
