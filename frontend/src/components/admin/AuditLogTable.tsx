import React from "react";
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  User,
  Clock,
  Database,
  FileText,
  AlertCircle,
} from "lucide-react";
import { AuditEventData } from "./AuditEventDiff";

interface AuditLogTableProps {
  logs: AuditEventData[];
  loading: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSelectEvent: (event: AuditEventData) => void;
}

export const AuditLogTable: React.FC<AuditLogTableProps> = ({
  logs,
  loading,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSelectEvent,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="flex flex-col gap-4 w-full bg-[#121622] border border-gray-800 rounded-xl overflow-hidden shadow-lg">
      {/* Table Container */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#181c2b] text-gray-400 border-b border-gray-800 uppercase tracking-wider font-semibold text-[11px]">
              <th className="py-3 px-4 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" /> Timestamp
              </th>
              <th className="py-3 px-4">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-purple-400" /> Actor
                </div>
              </th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">
                <div className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-400" /> Model Type
                </div>
              </th>
              <th className="py-3 px-4">Object ID</th>
              <th className="py-3 px-4">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" /> Summary
                </div>
              </th>
              <th className="py-3 px-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60 text-gray-200">
            {loading ? (
              // Loading Skeleton Rows
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse bg-[#121622]">
                  <td className="py-3 px-4">
                    <div className="h-4 w-28 bg-gray-800 rounded"></div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 w-20 bg-gray-800 rounded"></div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 w-16 bg-gray-800 rounded"></div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 w-24 bg-gray-800 rounded"></div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 w-12 bg-gray-800 rounded"></div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 w-48 bg-gray-800 rounded"></div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="h-4 w-16 bg-gray-800 rounded ml-auto"></div>
                  </td>
                </tr>
              ))
            ) : logs.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={7} className="py-12 px-4 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-gray-400">
                    <AlertCircle className="w-8 h-8 text-gray-500/70" />
                    <p className="text-sm font-semibold text-gray-300">
                      No audit log records found
                    </p>
                    <p className="text-xs text-gray-500 max-w-sm">
                      Try adjusting your search criteria or clearing active filters to browse domain audit history.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((event) => (
                <tr
                  key={event.id}
                  onClick={() => onSelectEvent(event)}
                  className="hover:bg-[#191e2e] transition-colors cursor-pointer group"
                >
                  {/* Timestamp */}
                  <td className="py-3 px-4 font-mono text-gray-300 whitespace-nowrap">
                    {new Date(event.created_at).toLocaleString()}
                  </td>

                  {/* Actor */}
                  <td className="py-3 px-4 font-medium text-gray-200">
                    {event.actor_username ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-950/40 text-purple-300 border border-purple-800/40">
                        @{event.actor_username}
                      </span>
                    ) : (
                      <span className="text-gray-500 italic">System</span>
                    )}
                  </td>

                  {/* Action Badge */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`inline-block px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded tracking-wider ${
                        event.action === "created"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : event.action === "updated"
                          ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                          : event.action === "deleted"
                          ? "bg-red-500/15 text-red-400 border border-red-500/30"
                          : "bg-gray-700/30 text-gray-300 border border-gray-600/30"
                      }`}
                    >
                      {event.action}
                    </span>
                  </td>

                  {/* Model Type */}
                  <td className="py-3 px-4 font-mono text-gray-300">
                    <span className="bg-[#0c0f17] px-2 py-1 rounded border border-gray-800/80">
                      {event.resource_type}
                    </span>
                  </td>

                  {/* Object ID */}
                  <td className="py-3 px-4 font-mono text-gray-400 font-semibold">
                    #{event.resource_id}
                  </td>

                  {/* Summary */}
                  <td className="py-3 px-4 text-gray-300 max-w-xs truncate font-medium">
                    {event.summary || `${event.action} ${event.resource_type} #${event.resource_id}`}
                  </td>

                  {/* Actions Column */}
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(event);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded border border-blue-500/30 transition-all shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" /> Inspect Diff
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#161a29] border-t border-gray-800 text-xs text-gray-400">
        <div className="flex items-center gap-3">
          <span>
            Showing page <strong className="text-white">{page}</strong> of{" "}
            <strong className="text-white">{totalPages}</strong> ({totalCount} total events)
          </span>

          {/* Page size dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-[#0c0f17] border border-gray-700 text-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Prev / Next Pagination Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 bg-[#0c0f17] border border-gray-700 hover:border-gray-600 text-gray-200 rounded flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || loading}
            className="px-3 py-1.5 bg-[#0c0f17] border border-gray-700 hover:border-gray-600 text-gray-200 rounded flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
