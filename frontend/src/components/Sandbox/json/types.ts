export interface JsonStats {
  nodeCount: number;
  maxDepth: number;
  stringCount: number;
  numberCount: number;
  booleanCount: number;
  nullCount: number;
  arrayCount: number;
  objectCount: number;
}

export interface TreeNode {
  key: string | number;
  value: unknown;
  type: "string" | "number" | "boolean" | "null" | "object" | "array";
  depth: number;
  path: string;
  childCount?: number;
  isExpanded: boolean;
}

export type JsonViewMode = "tree" | "raw";

export interface JsonSearchResult {
  path: string;
  key: string | number;
  value: unknown;
}
