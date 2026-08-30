import type { JsonStats, TreeNode, JsonSearchResult } from "./types";

export function analyzeJson(value: unknown): JsonStats {
  const stats: JsonStats = {
    nodeCount: 0,
    maxDepth: 0,
    stringCount: 0,
    numberCount: 0,
    booleanCount: 0,
    nullCount: 0,
    arrayCount: 0,
    objectCount: 0,
  };

  function walk(v: unknown, depth: number): void {
    stats.nodeCount++;
    if (depth > stats.maxDepth) stats.maxDepth = depth;

    if (v === null) {
      stats.nullCount++;
    } else if (Array.isArray(v)) {
      stats.arrayCount++;
      v.forEach((item) => walk(item, depth + 1));
    } else if (typeof v === "object") {
      stats.objectCount++;
      Object.values(v as Record<string, unknown>).forEach((val) =>
        walk(val, depth + 1),
      );
    } else if (typeof v === "string") {
      stats.stringCount++;
    } else if (typeof v === "number") {
      stats.numberCount++;
    } else if (typeof v === "boolean") {
      stats.booleanCount++;
    }
  }

  walk(value, 0);
  return stats;
}

export function getValueType(value: unknown): TreeNode["type"] {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value as TreeNode["type"];
}

export function searchJson(
  value: unknown,
  query: string,
  currentPath = "$",
): JsonSearchResult[] {
  if (!query) return [];
  const q = query.toLowerCase();
  const results: JsonSearchResult[] = [];

  function walk(v: unknown, path: string): void {
    if (v === null) {
      if ("null".includes(q))
        results.push({ path, key: "null", value: null });
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${path}[${i}]`));
    } else if (typeof v === "object") {
      Object.entries(v as Record<string, unknown>).forEach(([k, val]) => {
        if (k.toLowerCase().includes(q)) {
          results.push({ path: `${path}.${k}`, key: k, value: val });
        }
        walk(val, `${path}.${k}`);
      });
    } else {
      const strVal = String(v).toLowerCase();
      if (strVal.includes(q)) {
        results.push({ path, key: path.split(".").pop() || "", value: v });
      }
    }
  }

  walk(value, currentPath);
  return results;
}

export function formatJson(value: unknown, indent: number = 2): string {
  return JSON.stringify(value, null, indent);
}

export function minifyJson(value: unknown): string {
  return JSON.stringify(value);
}

export function isValidJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

export function parseJsonSafe(text: string): {
  value: unknown | null;
  error: string | null;
} {
  try {
    return { value: JSON.parse(text), error: null };
  } catch (err) {
    return {
      value: null,
      error: err instanceof Error ? err.message : "Invalid JSON",
    };
  }
}

const SAMPLE_JSON = {
  application: "Open Source Contribution Atelier",
  version: "2.0.0",
  config: {
    features: {
      gamification: true,
      peerReview: true,
      sandbox: true,
      chat: { enabled: true, encrypted: true, protocol: "wss" },
    },
    limits: { maxLessons: 50, maxQuizAttempts: 3, xpPerLesson: 15 },
  },
  modules: [
    { id: 1, title: "Mindset & Culture", lessons: 8, difficulty: "beginner" },
    { id: 2, title: "Git Foundations", lessons: 12, difficulty: "beginner" },
    { id: 3, title: "First Contributions", lessons: 10, difficulty: "intermediate" },
  ],
  contributors: [
    { name: "Alice", role: "maintainer", commits: 342 },
    { name: "Bob", role: "contributor", commits: 87 },
  ],
  metadata: { license: "MIT", repo: "https://github.com/atelier/app", stars: null },
};

export const SAMPLE_PRESETS: { name: string; data: unknown }[] = [
  { name: "App Config", data: SAMPLE_JSON },
  { name: "Empty Object", data: {} },
  { name: "Empty Array", data: [] },
  { name: "Nested Demo", data: { a: { b: { c: { d: [1, 2, { e: "deep" }] } } } } },
  { name: "Flat Data", data: { name: "test", count: 42, active: true, tags: ["a", "b"] } },
];
