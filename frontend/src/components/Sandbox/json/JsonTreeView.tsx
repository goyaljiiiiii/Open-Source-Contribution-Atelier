import React, { useState, useCallback, useMemo } from "react";
import { ChevronRight, Copy, Check } from "lucide-react";

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  string: { bg: "bg-green-100 dark:bg-green-950/30", text: "text-green-700 dark:text-green-400", border: "border-green-300 dark:border-green-800" },
  number: { bg: "bg-blue-100 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400", border: "border-blue-300 dark:border-blue-800" },
  boolean: { bg: "bg-amber-100 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", border: "border-amber-300 dark:border-amber-800" },
  null: { bg: "bg-gray-100 dark:bg-gray-800/30", text: "text-gray-500 dark:text-gray-400", border: "border-gray-300 dark:border-gray-700" },
  object: { bg: "bg-purple-100 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-400", border: "border-purple-300 dark:border-purple-800" },
  array: { bg: "bg-cyan-100 dark:bg-cyan-950/30", text: "text-cyan-700 dark:text-cyan-400", border: "border-cyan-300 dark:border-cyan-800" },
};

function getValueType(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function formatValue(v: unknown, type: string): string {
  if (type === "null") return "null";
  if (type === "string") return `"${v}"`;
  return String(v);
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="opacity-0 group-hover/row:opacity-100 p-0.5 rounded transition-all"
      title="Copy value"
    >
      {copied ? (
        <Check className="w-3 h-3 text-green-500" />
      ) : (
        <Copy className="w-3 h-3 text-muted" />
      )}
    </button>
  );
}

interface TreeRowProps {
  keyName: string | number;
  value: unknown;
  depth: number;
  isLast: boolean;
  searchQuery: string;
}

function TreeRow({ keyName, value, depth, isLast, searchQuery }: TreeRowProps) {
  const type = getValueType(value);
  const isContainer = type === "object" || type === "array";
  const [expanded, setExpanded] = useState(depth < 2);
  const colors = TYPE_COLORS[type];
  const indent = depth * 16;

  const childEntries = useMemo(() => {
    if (!isContainer || !expanded) return [];
    if (type === "array") {
      return (value as unknown[]).map((item, i) => ({
        key: i as string | number,
        value: item,
      }));
    }
    return Object.entries(value as Record<string, unknown>).map(([k, v]) => ({
      key: k,
      value: v,
    }));
  }, [isContainer, expanded, type, value]);

  const matchesSearch = useMemo(() => {
    if (!searchQuery) return false;
    const q = searchQuery.toLowerCase();
    const keyStr = String(keyName).toLowerCase();
    const valStr = String(value).toLowerCase();
    return keyStr.includes(q) || valStr.includes(q);
  }, [keyName, value, searchQuery]);

  const childCount = isContainer
    ? type === "array"
      ? (value as unknown[]).length
      : Object.keys(value as Record<string, unknown>).length
    : 0;

  const truncatedVal =
    !isContainer && String(value).length > 80
      ? String(value).slice(0, 80) + "…"
      : String(value);

  return (
    <>
      <div
        className={`group/row flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-primary/5 transition-colors cursor-default ${
          matchesSearch ? "bg-yellow-100 dark:bg-yellow-500/10 ring-1 ring-yellow-400/40" : ""
        }`}
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        {/* Expand toggle */}
        {isContainer ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <ChevronRight
              className={`w-3.5 h-3.5 text-muted dark:text-[#9b8f80] transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </button>
        ) : (
          <span className="w-[18px] flex-shrink-0" />
        )}

        {/* Key */}
        <span className="font-mono text-xs font-black text-text dark:text-[#f0ebe2] min-w-0">
          {typeof keyName === "number" ? (
            <span className="text-muted dark:text-[#9b8f80]">[{keyName}]</span>
          ) : (
            <span>
              <span className="text-pink-600 dark:text-pink-400">"</span>
              <span className="text-primary">{keyName}</span>
              <span className="text-pink-600 dark:text-pink-400">"</span>
            </span>
          )}
        </span>

        <span className="text-muted dark:text-[#9b8f80] text-xs">:</span>

        {/* Value or type badge */}
        {isContainer ? (
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${colors.bg} ${colors.text} ${colors.border}`}
            >
              {type}
            </span>
            <span className="text-[10px] font-mono font-bold text-muted dark:text-[#9b8f80]">
              {expanded ? "" : `${childCount} ${childCount === 1 ? "item" : "items"}`}
              {expanded && type === "object" && (
                <>{childCount === 0 ? "{}" : ""}</>
              )}
              {expanded && type === "array" && (
                <>{childCount === 0 ? "[]" : ""}</>
              )}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`font-mono text-xs font-bold truncate ${
                type === "string"
                  ? "text-green-700 dark:text-green-400"
                  : type === "number"
                    ? "text-blue-600 dark:text-blue-400"
                    : type === "boolean"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-gray-400 dark:text-gray-500"
              }`}
              title={String(value)}
            >
              {formatValue(truncatedVal, type)}
            </span>
            <CopyBtn text={formatValue(value, type)} />
          </div>
        )}
      </div>

      {/* Children */}
      {isContainer &&
        expanded &&
        childEntries.map((child, i) => (
          <TreeRow
            key={String(child.key)}
            keyName={child.key}
            value={child.value}
            depth={depth + 1}
            isLast={i === childEntries.length - 1}
            searchQuery={searchQuery}
          />
        ))}
    </>
  );
}

interface JsonTreeViewProps {
  data: unknown;
  searchQuery: string;
}

export function JsonTreeView({ data, searchQuery }: JsonTreeViewProps) {
  return (
    <div className="font-mono text-xs overflow-x-auto py-1">
      <TreeRow
        keyName="$"
        value={data}
        depth={0}
        isLast
        searchQuery={searchQuery}
      />
    </div>
  );
}
