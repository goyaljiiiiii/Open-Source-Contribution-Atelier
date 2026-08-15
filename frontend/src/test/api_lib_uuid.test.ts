import { describe, it, expect, afterEach } from "vitest";
import { safeGenerateUUID } from "../lib/api";

describe("safeGenerateUUID", () => {
  const originalCrypto = globalThis.crypto;

  afterEach(() => {
    Object.defineProperty(globalThis, "crypto", {
      value: originalCrypto,
      writable: true,
      configurable: true,
    });
  });

  it("should generate valid UUID string when randomUUID is available", () => {
    const uuid = safeGenerateUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("should fallback cleanly when randomUUID is undefined", () => {
    Object.defineProperty(globalThis, "crypto", {
      value: {
        getRandomValues: (arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
          return arr;
        },
      },
      writable: true,
      configurable: true,
    });

    const uuid = safeGenerateUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});
