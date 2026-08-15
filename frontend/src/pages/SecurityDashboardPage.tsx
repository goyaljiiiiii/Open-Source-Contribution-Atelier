import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "../lib/api";
import { Shield, AlertTriangle, CheckCircle, Package } from "lucide-react";

export function SecurityDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["vulnerabilitySummary"],
    queryFn: async () =>
      fetchApi("/security/summary/", { suppressErrorToast: true }),
  });

  if (isLoading) {
    return (
      <div
        className="flex h-64 items-center justify-center"
        aria-busy="true"
        role="status"
      >
        <span className="text-xl font-bold dark:text-white">
          Loading Security Dashboard...
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="pt-24 max-w-7xl mx-auto px-4">
        <div className="p-8 text-center bg-red-100 rounded-2xl border-4 border-black font-bold">
          Failed to load Security Dashboard data.
        </div>
      </div>
    );
  }

  const { metrics, dependencies } = data;
  const depStats = dependencies || {
    total_vulnerable: 0,
    avg_decay_rate: 0,
    avg_security_score: 100,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pt-24 pb-12 space-y-10">
      <section className="rounded-[2rem] border-4 border-black bg-indigo-600 p-8 sm:p-10 shadow-card relative overflow-hidden dark:border-[#2e2924] dark:shadow-none">
        <div className="relative z-10 text-white">
          <span className="font-black text-sm bg-white text-black px-4 py-2 rounded-full border-2 border-black rotate-[-2deg] inline-block shadow-card-sm mb-4">
            SECURITY & DEPENDENCIES 🔒
          </span>
          <h1 className="text-4xl sm:text-5xl font-black drop-shadow-[3px_3px_0_#000] mb-4">
            Dependency Aging & Security Decay
          </h1>
          <p className="text-lg font-bold bg-white/10 p-4 rounded-lg border-4 border-white shadow-card-sm inline-block max-w-lg leading-relaxed backdrop-blur-sm">
            Monitor software rot, track dependency aging, and review
            automatically generated Pull Requests for updates.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="rounded-[2rem] border-4 border-black bg-white p-6 shadow-card flex flex-col justify-between dark:bg-[#1f1c18]">
          <div className="flex items-center gap-3">
            <Shield className="w-10 h-10 text-green-500" />
            <div>
              <h3 className="text-xs uppercase tracking-widest text-gray-500">
                Global Score
              </h3>
              <p className="text-4xl font-black text-black dark:text-white">
                {depStats.avg_security_score.toFixed(0)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border-4 border-black bg-white p-6 shadow-card flex flex-col justify-between dark:bg-[#1f1c18]">
          <div className="flex items-center gap-3">
            <Package className="w-10 h-10 text-orange-500" />
            <div>
              <h3 className="text-xs uppercase tracking-widest text-gray-500">
                Vulnerable Packages
              </h3>
              <p className="text-4xl font-black text-black dark:text-white">
                {depStats.total_vulnerable}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border-4 border-black bg-white p-6 shadow-card flex flex-col justify-between dark:bg-[#1f1c18]">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-10 h-10 text-red-500" />
            <div>
              <h3 className="text-xs uppercase tracking-widest text-gray-500">
                Critical CVEs
              </h3>
              <p className="text-4xl font-black text-black dark:text-white">
                {metrics?.critical || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border-4 border-black bg-white p-6 shadow-card flex flex-col justify-between dark:bg-[#1f1c18]">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-10 h-10 text-blue-500" />
            <div>
              <h3 className="text-xs uppercase tracking-widest text-gray-500">
                Active Auto-PRs
              </h3>
              <p className="text-4xl font-black text-black dark:text-white">
                {metrics?.active_autofix_prs || 0}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border-4 border-black bg-white p-6 shadow-card dark:bg-[#1f1c18] dark:border-[#2e2924]">
        <h2 className="text-2xl font-black mb-6 text-black dark:text-white">
          Dependency Decay Rate
        </h2>
        <div className="h-24 w-full flex items-center">
          <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden border-2 border-black flex">
            <div
              className="bg-green-500 h-full flex items-center justify-center text-xs font-bold text-black"
              style={{
                width: `${Math.max(0, 100 - depStats.avg_decay_rate * 100)}%`,
              }}
            >
              Fresh
            </div>
            <div
              className="bg-red-500 h-full flex items-center justify-center text-xs font-bold text-white"
              style={{
                width: `${Math.min(100, depStats.avg_decay_rate * 100)}%`,
              }}
            >
              Decaying
            </div>
          </div>
        </div>
        <p className="text-sm font-bold text-gray-500 text-center mt-2">
          Average Decay Rate: {(depStats.avg_decay_rate * 100).toFixed(1)}%
        </p>
      </section>
    </div>
  );
}
