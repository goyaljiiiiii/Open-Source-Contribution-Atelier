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
import { API_BASE, fetchApi } from "../../lib/api";
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

      const data = await fetchApi(`/admin/audit/?${params.toString()}`);
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
    fetchLogs();
  }, [fetchLogs]);

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

    const exportUrl = `${API_BASE}/admin/audit/?${params.toString()}`;
    
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

  const activeFilterCount =
    (searchQuery ? 1 : 0) +
    (actionFilter ? 1 : 0) +
    (modelTypeFilter ? 1 : 0) +
    (actorFilter ? 1 : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0);

  const createdCount = logs.filter((l) => l.action === "created").length;
  const updatedCount = logs.filter((l) => l.action === "updated").length;
  const deletedCount = logs.filter((l) => l.action === "deleted").length;

  return (
    <div className="w-full min-h-screen bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 p-4 md:p-8 flex flex-col gap-6">
      {/* Top Playful Inspector Banner */}
      <div className="p-4 md:p-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-2xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-2xl">
            🕵️‍♂️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white border border-white/30">
                Rank: Level 42 Domain Detective 🛡️
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-1">
              Audit Event Inspector & Chronicles
            </h1>
            <p className="text-xs md:text-sm text-blue-100 font-medium">
              Playful live ledger of domain writes, snapshot history, state diff investigations, and system events.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl text-xs font-bold text-white transition-all backdrop-blur-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Trail
          </button>

          <button
            onClick={() => handleExport("csv")}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export CSV
          </button>

          <button
            onClick={() => handleExport("json")}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl text-xs font-bold transition-all shadow-md"
          >
            <FileCode className="w-4 h-4" /> Export JSON
          </button>
        </div>
      </div>

      {/* Playful Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <div className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">
              Total Logged Events
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">
              {totalCount} 📜
            </div>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-lg">
            🔍
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <div className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">
              Records Created
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {createdCount} 🐣
            </div>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl font-bold text-lg">
            🎨
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <div className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">
              Records Updated
            </div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
              {updatedCount} 🔧
            </div>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-lg">
            ⚡
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <div className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">
              Records Deleted
            </div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {deletedCount} 💥
            </div>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl font-bold text-lg">
            💣
          </div>
        </div>
      </div>

      {/* Filter Toolbar Container */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-2xl flex flex-col gap-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <Filter className="w-4 h-4 text-blue-500" /> Filters & Search
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-[10px] font-extrabold">
                {activeFilterCount} Active
              </span>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
            </button>
          )}
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Free Text Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search resource, ID, actor, correlation..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
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
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
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
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
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
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Start Date */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl px-2">
            <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full bg-transparent py-2 text-xs font-medium text-gray-900 dark:text-white focus:outline-none"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-800">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-500" />
                Audit Event Record Details
              </h2>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
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
