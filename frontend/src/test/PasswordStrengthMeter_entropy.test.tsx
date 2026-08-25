import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PasswordStrengthMeter } from "../components/PasswordStrengthMeter";
import {
  calculatePasswordEntropy,
  checkPasswordStrength,
} from "../utils/passwordStrength";

describe("Password Strength Entropy Meter", () => {
  it("calculates entropy bits correctly based on character pool size", () => {
    expect(calculatePasswordEntropy("")).toBe(0);
    // Lowercase only (26 pool size): 8 * log2(26) = ~37 bits
    const lowerEntropy = calculatePasswordEntropy("abcdefgh");
    expect(lowerEntropy).toBeGreaterThanOrEqual(37);

    // Mixed pool (uppercase + lowercase + digits + symbols)
    const complexEntropy = calculatePasswordEntropy("P@ssw0rd123!");
    expect(complexEntropy).toBeGreaterThan(60);
  });

  it("does not render when password is empty", () => {
    const { container } = render(<PasswordStrengthMeter password="" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders entropy bits, tier label, and met criteria badges", () => {
    render(<PasswordStrengthMeter password="SuperSecret123!" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/bits entropy/i)).toBeInTheDocument();
    expect(screen.getByText("✓ 8+ chars")).toBeInTheDocument();
    expect(screen.getByText("✓ Uppercase")).toBeInTheDocument();
    expect(screen.getByText("✓ Lowercase")).toBeInTheDocument();
    expect(screen.getByText("✓ Number")).toBeInTheDocument();
    expect(screen.getByText("✓ Symbol")).toBeInTheDocument();
  });
});
