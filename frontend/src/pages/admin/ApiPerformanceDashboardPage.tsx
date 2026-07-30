import React, { useEffect, useState } from "react";
import { PerfChart } from "../../components/admin/PerfChart";
import api from "../../api";

interface HourlyTrend {
  hour: string;
  count: number;
  p50: number;
  p95: number;
  p99: number;
  avg_duration: number;
  avg_queries: number;
}

interface SlowEndpoint {
  view_name: string;
  method: string;
  avg_duration: number;
  max_duration: number;
  avg_queries: number;
  count: number;
}

interface DashboardData {
  hourly_trends: HourlyTrend[];
  top_slowest_endpoints: SlowEndpoint[];
}

export const ApiPerformanceDashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get("/admin/core/performance/");
        setData(response.data);
      } catch (err: any) {
        setError(err.message || "Failed to load performance data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="text-white p-8">Loading performance data...</div>;
  if (error) return <div className="text-red-500 p-8">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-white mb-8">API Endpoint Telemetry Dashboard</h1>
      
      <div className="mb-12">
        <PerfChart data={data.hourly_trends} />
      </div>

      <div className="bg-gray-900 rounded-lg shadow-lg border border-gray-800 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-800">
          <h3 className="text-xl font-semibold text-white">Top 20 Slowest Endpoints</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-800">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Endpoint</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Avg Latency (ms)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Max Latency (ms)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Avg DB Queries</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Sample Count</th>
              </tr>
            </thead>
            <tbody className="bg-gray-900 divide-y divide-gray-800">
              {data.top_slowest_endpoints.map((ep, i) => (
                <tr key={i} className="hover:bg-gray-800 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-400">{ep.method}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{ep.view_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-400">{Math.round(ep.avg_duration)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-400">{Math.round(ep.max_duration)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{Math.round(ep.avg_queries)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{ep.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ApiPerformanceDashboardPage;
