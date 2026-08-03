import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi, API_BASE } from "../lib/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Activity, Users, BookOpen, Code, AlertTriangle, Download } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface AnalyticsData {
  registrations: { date: string; count: number }[];
  progress_stats: { date: string; enrolled: number; completed: number }[];
  quiz_stats: { is_correct: boolean; count: number }[];
  challenge_stats: { status: string; count: number }[];
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

export default function AnalyticsDashboardPage() {
  const { theme } = useTheme();
  const { data, isLoading, isError } = useQuery<AnalyticsData>({
    queryKey: ["moderator_analytics"],
    queryFn: () => fetchApi("/dashboard/analytics/"),
  });

  const handleExportCSV = (dataset = "all", days = 30) => {
    const url = `${API_BASE}/dashboard/analytics/export/?dataset=${dataset}&days=${days}`;
    window.open(url, "_blank");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-xl font-bold animate-pulse flex items-center gap-2">
          <Activity className="animate-spin" /> Loading Analytics Data...
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-red-500">
        <AlertTriangle size={48} className="mb-4" />
        <h2 className="text-2xl font-black">Error loading analytics</h2>
        <p className="font-bold">
          Please check your permissions or try again later.
        </p>
      </div>
    );
  }

  // Format quiz data for Pie Chart
  const quizData = data.quiz_stats.map((item) => ({
    name: item.is_correct ? "Correct" : "Incorrect",
    value: item.count,
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-primary text-white p-3 rounded-xl border-4 border-black">
            <Activity size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight">
              Platform Analytics
            </h1>
            <p className="text-muted font-bold">
              Real-time insights for moderators (Last 30 Days)
            </p>
          </div>
        </div>

        {/* Global Export All CSV Action */}
        <button
          type="button"
          onClick={() => handleExportCSV("all", 30)}
          aria-label="Export all analytics metrics to CSV"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white font-extrabold rounded-xl border-2 border-black shadow-[3px_3px_0_0_#000] hover:-translate-y-0.5 active:translate-y-0 transition-all dark:border-white dark:shadow-[3px_3px_0_0_#fff]"
        >
          <Download size={18} />
          <span>Export All CSV</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Registration Trends Widget */}
        <div className="bg-white p-6 rounded-2xl border-4 border-black shadow-card dark:bg-[#151411] dark:border-[#2e2924] dark:shadow-none">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black flex items-center gap-2">
              <Users className="text-accent" /> New Registrations
            </h2>
            <button
              type="button"
              onClick={() => handleExportCSV("registrations", 30)}
              aria-label="Export Registrations to CSV"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase rounded-lg border-2 border-black bg-gray-100 hover:bg-gray-200 dark:bg-black dark:text-white dark:border-white shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff] transition-all"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.registrations}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={theme === "dark" ? "#2e2924" : "#e0e0e0"}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border:
                      theme === "dark"
                        ? "2px solid #2e2924"
                        : "2px solid black",
                    fontWeight: "bold",
                    backgroundColor: theme === "dark" ? "#1f1c18" : "#fff",
                    color: theme === "dark" ? "#f0ebe2" : "#000",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#4f46e5"
                  fillOpacity={1}
                  fill="url(#colorUsers)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Course Progress Widget */}
        <div className="bg-white p-6 rounded-2xl border-4 border-black shadow-card dark:bg-[#151411] dark:border-[#2e2924] dark:shadow-none">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black flex items-center gap-2">
              <BookOpen className="text-primary" /> Course Engagement
            </h2>
            <button
              type="button"
              onClick={() => handleExportCSV("progress_stats", 30)}
              aria-label="Export Course Engagement to CSV"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase rounded-lg border-2 border-black bg-gray-100 hover:bg-gray-200 dark:bg-black dark:text-white dark:border-white shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff] transition-all"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.progress_stats}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e0e0e0"
                />
                <XAxis
                  dataKey="date"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border:
                      theme === "dark"
                        ? "2px solid #2e2924"
                        : "2px solid black",
                    fontWeight: "bold",
                    backgroundColor: theme === "dark" ? "#1f1c18" : "#fff",
                    color: theme === "dark" ? "#f0ebe2" : "#000",
                  }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontWeight: "bold" }}
                />
                <Bar
                  dataKey="enrolled"
                  name="Enrolled"
                  fill="#FFBB28"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="completed"
                  name="Completed"
                  fill="#00C49F"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quiz Performance Widget */}
        <div className="bg-white p-6 rounded-2xl border-4 border-black shadow-card dark:bg-[#151411] dark:border-[#2e2924] dark:shadow-none">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black flex items-center gap-2">
              <Code className="text-purple-500" /> Quiz Accuracy
            </h2>
            <button
              type="button"
              onClick={() => handleExportCSV("quiz_stats", 30)}
              aria-label="Export Quiz Accuracy to CSV"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase rounded-lg border-2 border-black bg-gray-100 hover:bg-gray-200 dark:bg-black dark:text-white dark:border-white shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff] transition-all"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
          <div className="h-80 w-full flex items-center justify-center">
            {quizData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={quizData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }: any) =>
                      `${name} ${((percent || 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {quizData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                        stroke={theme === "dark" ? "#1f1c18" : "black"}
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border:
                        theme === "dark"
                          ? "2px solid #2e2924"
                          : "2px solid black",
                      fontWeight: "bold",
                      backgroundColor: theme === "dark" ? "#1f1c18" : "#fff",
                      color: theme === "dark" ? "#f0ebe2" : "#000",
                    }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontWeight: "bold" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-bold text-muted">No quiz data available.</p>
            )}
          </div>
        </div>

        {/* Coding Challenges Widget */}
        <div className="bg-white p-6 rounded-2xl border-4 border-black shadow-card dark:bg-[#151411] dark:border-[#2e2924] dark:shadow-none">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black flex items-center gap-2">
              <Code className="text-pink-500" /> Challenge Submissions Status
            </h2>
            <button
              type="button"
              onClick={() => handleExportCSV("challenge_stats", 30)}
              aria-label="Export Challenge Submissions to CSV"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase rounded-lg border-2 border-black bg-gray-100 hover:bg-gray-200 dark:bg-black dark:text-white dark:border-white shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff] transition-all"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
          <div className="h-80 w-full flex items-center justify-center">
            {data.challenge_stats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.challenge_stats}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    dataKey="count"
                    nameKey="status"
                    label={({ status, percent }: any) =>
                      `${status} ${((percent || 0) * 100).toFixed(0)}%`
                    }
                  >
                    {data.challenge_stats.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[(index + 2) % COLORS.length]}
                        stroke={theme === "dark" ? "#1f1c18" : "black"}
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border:
                        theme === "dark"
                          ? "2px solid #2e2924"
                          : "2px solid black",
                      fontWeight: "bold",
                      backgroundColor: theme === "dark" ? "#1f1c18" : "#fff",
                      color: theme === "dark" ? "#f0ebe2" : "#000",
                    }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{
                      fontWeight: "bold",
                      textTransform: "capitalize",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-bold text-muted">
                No challenge data available.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
