import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  Search,
  Filter,
  RotateCcw,
  RefreshCw,
  X,
  FileSpreadsheet,
  FileCode,
  Calendar,
  Layers,
  SlidersHorizontal,
} from "lucide-react";
import { fetchApi } from "../../lib/api";
import { useAuth } from "../../features/auth/AuthContext";
import { AuditLogTable } from "../../components/admin/AuditLogTable";
import { AuditEventDiff, AuditEventData } from "../../components/admin/AuditEventDiff";
import { toast } from "react-hot-toast";

export function AuditLogViewerPage() {
  const { user, isLoading: authLoading } = useAuth();

  const [logs, setLogs] = useState<AuditEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [modelTypeFilter, setModelTypeFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modal / Detail state
  const [selectedEvent, setSelectedEvent] = useState<AuditEventData | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(pageSize));

      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (actionFilter) params.set("action", actionFilter);
      if (modelTypeFilter.trim()) params.set("model_type", modelTypeFilter.trim());
      if (actorFilter.trim()) params.set("actor", actorFilter.trim());
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);

      const data = await fetchApi(`/api/admin/audit/?${params.toString()}`);
      if (data && Array.isArray(data.results)) {
        setLogs(data.results);
        setTotalCount(data.count || data.results.length);
      } else if (Array.isArray(data)) {
        setLogs(data);
        setTotalCount(data.length);
      } else {
        setLogs([]);
        setTotalCount(0);
      }
    } catch (err: any) {
      console.error("Failed to fetch audit logs:", err);
      toast.error("Failed to load audit logs from server");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchQuery, actionFilter, modelTypeFilter, actorFilter, startDate, endDate]);

  useEffect(() => {
    if (user?.is_staff) {
      fetchLogs();
    }
  }, [user, fetchLogs]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setActionFilter("");
    setModelTypeFilter("");
    setActorFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const handleExport = (format: "csv" | "json") => {
    const params = new URLSearchParams();
    params.set("export", format);

    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (actionFilter) params.set("action", actionFilter);
    if (modelTypeFilter.trim()) params.set("model_type", modelTypeFilter.trim());
    if (actorFilter.trim()) params.set("actor", actorFilter.trim());
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);

    const exportUrl = `/api/admin/audit/?${params.toString()}`;
    
    // Trigger file download
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    fetch(exportUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error("Export failed");
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        toast.success(`Successfully exported audit logs as ${format.toUpperCase()}`);
      })
      .catch((err) => {
        console.error("Export error:", err);
        toast.error(`Failed to export audit logs as ${format.toUpperCase()}`);
      });
  };

  // Staff permission guard
  if (!authLoading && user && !user.is_staff) {
    return (
      <div className="min-h-screen bg-[#0a0c14] flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-2xl max-w-md flex flex-col items-center gap-4 text-red-200">
          <ShieldAlert className="w-12 h-12 text-red-500" />
          <h2 className="text-xl font-bold text-white">Access Denied</h2>
          <p className="text-sm text-gray-400">
            The Audit Log Viewer is restricted to authorized staff and administration personnel only.
          </p>
        </div>
      </div>
    );
  }

  const activeFilterCount =
    (searchQuery ? 1 : 0) +
    (actionFilter ? 1 : 0) +
    (modelTypeFilter ? 1 : 0) +
    (actorFilter ? 1 : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0);

  return (
    <div className="w-full min-h-screen bg-[#0a0c14] text-gray-100 p-4 md:p-8 flex flex-col gap-6">
      {/* Top Header & Export Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-400">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                Audit Log Viewer
              </h1>
              <p className="text-xs md:text-sm text-gray-400 font-medium mt-0.5">
                Searchable domain event trail, immutable record snapshots & state diff investigation
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#121622] hover:bg-[#181d2e] border border-gray-800 rounded-xl text-xs font-semibold text-gray-200 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
            Refresh
          </button>

          <button
            onClick={() => handleExport("csv")}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export CSV
          </button>

          <button
            onClick={() => handleExport("json")}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <FileCode className="w-4 h-4" /> Export JSON
          </button>
        </div>
      </div>

      {/* Filter Toolbar Container */}
      <div className="p-4 bg-[#121622] border border-gray-800 rounded-2xl flex flex-col gap-4 shadow-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
            <Filter className="w-4 h-4 text-blue-400" /> Filters & Search
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-[10px] font-extrabold">
                {activeFilterCount} Active
              </span>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
            </button>
          )}
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Free Text Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
            <input
              type="text"
              placeholder="Search resource, ID, actor, correlation..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-[#0b0e16] border border-gray-800 rounded-xl text-xs font-medium text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-[#0b0e16] border border-gray-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">All Actions</option>
              <option value="created">Created</option>
              <option value="updated">Updated</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>

          {/* Model Type Filter */}
          <div>
            <input
              type="text"
              placeholder="Model Type (e.g. lesson)"
              value={modelTypeFilter}
              onChange={(e) => {
                setModelTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-[#0b0e16] border border-gray-800 rounded-xl text-xs font-medium text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Actor Filter */}
          <div>
            <input
              type="text"
              placeholder="Actor Username / ID"
              value={actorFilter}
              onChange={(e) => {
                setActorFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-[#0b0e16] border border-gray-800 rounded-xl text-xs font-medium text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Start Date */}
          <div className="flex items-center gap-1 bg-[#0b0e16] border border-gray-800 rounded-xl px-2">
            <Calendar className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full bg-transparent py-2 text-xs font-medium text-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Audit Log Data Table */}
      <AuditLogTable
        logs={logs}
        loading={loading}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        onPageChange={(newPage) => setPage(newPage)}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
        onSelectEvent={(event) => setSelectedEvent(event)}
      />

      {/* Audit Event Detail Slide-Over Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#101420] border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 bg-[#161b2b] border-b border-gray-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-400" />
                Audit Event Record Details
              </h2>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-70px)]">
              <AuditEventDiff event={selectedEvent} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditLogViewerPage;
