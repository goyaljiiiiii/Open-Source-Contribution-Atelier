import React, { useState } from "react";
import {
  FileDiff,
  Plus,
  Minus,
  RefreshCw,
  Code,
  Layers,
  Clock,
  User,
  Hash,
  Globe,
  Terminal,
} from "lucide-react";

export interface AuditEventData {
  id: number;
  actor?: number | null;
  actor_username?: string | null;
  action: "created" | "updated" | "deleted" | string;
  resource_type: string;
  resource_id: string;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  correlation_id?: string;
  ip_address?: string | null;
  user_agent?: string;
  created_at: string;
  summary?: string;
  extra?: Record<string, any>;
}

interface AuditEventDiffProps {
  event: AuditEventData;
  onClose?: () => void;
}

export const AuditEventDiff: React.FC<AuditEventDiffProps> = ({ event }) => {
  const [viewMode, setViewMode] = useState<"diff" | "side_by_side" | "raw">(
    "diff",
  );
  const [showUnchanged, setShowUnchanged] = useState(false);

  const beforeObj = event.before || {};
  const afterObj = event.after || {};

  const allKeys = Array.from(
    new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]),
  ).sort();

  const diffEntries = allKeys.map((key) => {
    const hasBefore = key in beforeObj;
    const hasAfter = key in afterObj;
    const valBefore = beforeObj[key];
    const valAfter = afterObj[key];

    let type: "added" | "deleted" | "modified" | "unchanged" = "unchanged";

    if (!hasBefore && hasAfter) {
      type = "added";
    } else if (hasBefore && !hasAfter) {
      type = "deleted";
    } else if (JSON.stringify(valBefore) !== JSON.stringify(valAfter)) {
      type = "modified";
    }

    return {
      key,
      valBefore,
      valAfter,
      type,
    };
  });

  const filteredEntries = showUnchanged
    ? diffEntries
    : diffEntries.filter((e) => e.type !== "unchanged");

  const formatValue = (val: any) => {
    if (val === undefined) return <span className="text-gray-500 italic">none</span>;
    if (val === null) return <span className="text-gray-400 italic">null</span>;
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  return (
    <div className="flex flex-col gap-5 w-full text-gray-900 dark:text-gray-100">
      {/* Header & Event Overview Metadata */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 text-xs font-bold uppercase rounded-md tracking-wider ${
              event.action === "created"
                ? "bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30"
                : event.action === "updated"
                ? "bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30"
                : "bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30"
            }`}
          >
            {event.action}
          </span>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {event.summary || `${event.resource_type} #${event.resource_id}`}
          </h3>
        </div>

        {/* View Mode Toggle Controls */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 border border-gray-200 dark:border-slate-800 rounded-lg text-xs font-medium">
          <button
            onClick={() => setViewMode("diff")}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              viewMode === "diff"
                ? "bg-blue-600 text-white font-semibold shadow"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <FileDiff className="w-3.5 h-3.5" /> Structured Diff
          </button>
          <button
            onClick={() => setViewMode("side_by_side")}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              viewMode === "side_by_side"
                ? "bg-blue-600 text-white font-semibold shadow"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Side by Side
          </button>
          <button
            onClick={() => setViewMode("raw")}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              viewMode === "raw"
                ? "bg-blue-600 text-white font-semibold shadow"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Code className="w-3.5 h-3.5" /> Raw Payload
          </button>
        </div>
      </div>

      {/* Audit Event Metadata Pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-800 rounded-lg flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-blue-500 shrink-0" />
          <div>
            <div className="text-gray-500 dark:text-gray-400 text-[10px] uppercase font-semibold">Timestamp</div>
            <div className="text-gray-800 dark:text-gray-200 font-mono">
              {new Date(event.created_at).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-800 rounded-lg flex items-center gap-2.5">
          <User className="w-4 h-4 text-purple-500 shrink-0" />
          <div>
            <div className="text-gray-500 dark:text-gray-400 text-[10px] uppercase font-semibold">Actor</div>
            <div className="text-gray-800 dark:text-gray-200 font-semibold">
              {event.actor_username || "System"}
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-800 rounded-lg flex items-center gap-2.5">
          <Hash className="w-4 h-4 text-amber-500 shrink-0" />
          <div>
            <div className="text-gray-500 dark:text-gray-400 text-[10px] uppercase font-semibold">Correlation ID</div>
            <div className="text-gray-800 dark:text-gray-200 font-mono truncate max-w-[120px]">
              {event.correlation_id || "N/A"}
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-800 rounded-lg flex items-center gap-2.5">
          <Globe className="w-4 h-4 text-emerald-500 shrink-0" />
          <div>
            <div className="text-gray-500 dark:text-gray-400 text-[10px] uppercase font-semibold">IP Address</div>
            <div className="text-gray-800 dark:text-gray-200 font-mono">
              {event.ip_address || "Internal"}
            </div>
          </div>
        </div>
      </div>

      {/* Main Diff Content Container */}
      {viewMode === "diff" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Showing {filteredEntries.length} of {diffEntries.length} field(s)
            </span>
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showUnchanged}
                onChange={(e) => setShowUnchanged(e.target.checked)}
                className="rounded border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-blue-600 focus:ring-blue-500"
              />
              Show unchanged fields
            </label>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-gray-500 dark:text-gray-400 text-sm">
              No field changes detected between before and after snapshots.
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-800 text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-4 w-12">Type</th>
                    <th className="py-2.5 px-4 w-1/4">Field / Key</th>
                    <th className="py-2.5 px-4 w-1/3">Before</th>
                    <th className="py-2.5 px-4 w-1/3">After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                  {filteredEntries.map((item) => (
                    <tr
                      key={item.key}
                      className={`transition-colors ${
                        item.type === "added"
                          ? "bg-emerald-50 dark:bg-green-950/20"
                          : item.type === "deleted"
                          ? "bg-red-50 dark:bg-red-950/20"
                          : item.type === "modified"
                          ? "bg-amber-50 dark:bg-amber-950/15"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/20"
                      }`}
                    >
                      <td className="py-2 px-4 text-center">
                        {item.type === "added" && (
                          <span className="inline-flex p-1 bg-green-500/20 text-green-600 dark:text-green-400 rounded">
                            <Plus className="w-3 h-3" />
                          </span>
                        )}
                        {item.type === "deleted" && (
                          <span className="inline-flex p-1 bg-red-500/20 text-red-600 dark:text-red-400 rounded">
                            <Minus className="w-3 h-3" />
                          </span>
                        )}
                        {item.type === "modified" && (
                          <span className="inline-flex p-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded">
                            <RefreshCw className="w-3 h-3" />
                          </span>
                        )}
                        {item.type === "unchanged" && (
                          <span className="inline-flex p-1 text-gray-400 dark:text-gray-600">=</span>
                        )}
                      </td>
                      <td className="py-2 px-4 font-semibold text-gray-800 dark:text-gray-200">
                        {item.key}
                      </td>
                      <td className="py-2 px-4 text-red-600 dark:text-red-300/80 break-all">
                        {formatValue(item.valBefore)}
                      </td>
                      <td className="py-2 px-4 text-emerald-600 dark:text-green-300/80 break-all">
                        {formatValue(item.valAfter)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Side-by-Side Raw View */}
      {viewMode === "side_by_side" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl flex flex-col gap-2">
            <h4 className="text-xs font-bold uppercase text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <Minus className="w-3.5 h-3.5" /> Before Snapshot
            </h4>
            <pre className="text-xs font-mono text-gray-800 dark:text-gray-300 bg-white dark:bg-slate-950 p-3 rounded-lg border border-gray-200 dark:border-slate-800 overflow-x-auto max-h-96">
              {event.before
                ? JSON.stringify(event.before, null, 2)
                : "// No before state (Record Created)"}
            </pre>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl flex flex-col gap-2">
            <h4 className="text-xs font-bold uppercase text-emerald-600 dark:text-green-400 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> After Snapshot
            </h4>
            <pre className="text-xs font-mono text-gray-800 dark:text-gray-300 bg-white dark:bg-slate-950 p-3 rounded-lg border border-gray-200 dark:border-slate-800 overflow-x-auto max-h-96">
              {event.after
                ? JSON.stringify(event.after, null, 2)
                : "// No after state (Record Deleted)"}
            </pre>
          </div>
        </div>
      )}

      {/* Raw Payload View */}
      {viewMode === "raw" && (
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl flex flex-col gap-2">
          <h4 className="text-xs font-bold uppercase text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5" /> Complete Audit Record Payload
          </h4>
          <pre className="text-xs font-mono text-gray-800 dark:text-gray-300 bg-white dark:bg-slate-950 p-3 rounded-lg border border-gray-200 dark:border-slate-800 overflow-x-auto max-h-96">
            {JSON.stringify(event, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
