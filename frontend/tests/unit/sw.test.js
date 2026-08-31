import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SW_PATH = path.resolve(process.cwd(), "src/sw.js");

describe("Service Worker dynamic module caching", () => {
  const source = fs.readFileSync(SW_PATH, "utf8");

  it("defines the dedicated offline module cache", () => {
    expect(source).toContain('atelier-modules-v1');
  });

  it("matches Vite JavaScript assets without restricting caching to precache", () => {
    expect(source).toContain('^\\/assets\\/[^/]+\\.js$');
    expect(source).toContain('registerRoute(');
    expect(source).toContain('MODULE_CHUNK_PATTERN');
  });

  it("uses GET-only same-origin matching for module chunks", () => {
    expect(source).toContain('request.method !== "GET"');
    expect(source).toContain('url.origin !== self.location.origin');
  });

  it("stores successful module responses in Cache Storage", () => {
    expect(source).toContain('caches.open(MODULE_CACHE_NAME)');
    expect(source).toContain('cache.put(request, response.clone())');
  });

  it("serves an offline response when a chunk cannot be fetched or found", () => {
    expect(source).toContain('offlineChunkFallback(request)');
    expect(source).toContain("status: 503");
    expect(source).toContain("This learning module is not available offline yet.");
  });

  it("limits and rotates module cache entries", () => {
    expect(source).toContain("MODULE_CACHE_MAX_ENTRIES");
    expect(source).toContain("MODULE_CACHE_MAX_AGE_SECONDS");
    expect(source).toContain("obsoleteModuleCaches");
  });

  it("provides an explicit cache-clear message for recovery", () => {
    expect(source).toContain('"CLEAR_MODULE_CACHE"');
    expect(source).toContain("clearModuleCache()");
  });
});
