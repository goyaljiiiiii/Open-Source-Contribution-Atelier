import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { fetchApi } from "../../lib/api";
import { useTheme } from "../../context/ThemeContext";
import {
  Activity,
  Users,
  BookOpen,
  TrendingUp,
  Globe,
  Clock,
} from "lucide-react";

interface UsageAnalyticsData {
  daily_active_users: { date: string; count: number }[];
  monthly_active_users: { month: string; count: number }[];
  popular_lessons: {
    lesson__slug: string;
    lesson__title: string;
    count: number;
  }[];
  lesson_completion_rates: {
    slug: string;
    title: string;
    total_attempts: number;
    completed: number;
    completion_rate: number;
  }[];
  signup_trend: { month: string; count: number }[];
  average_session_duration_minutes: number;
  geo_distribution: { timezone: string; count: number }[];
}

const COLORS = [
  "#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8",
  "#82ca9d", "#ff6b6b", "#4ecdc4", "#45b7d1", "#f39c12",
];

export default function UsageAnalyticsPage() {
  const { theme } = useTheme();
  const { data, isLoading, isError } = useQuery<UsageAnalyticsData>({
    queryKey: ["usage_analytics"],
    queryFn: () => fetchApi("/dashboard/usage-analytics/"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-xl font-bold animate-pulse flex items-center gap-2">
          <Activity className="animate-spin" /> Loading Usage Analytics...
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-red-500">
        <Activity size={48} className="mb-4" />
        <h2 className="text-2xl font-black">Error loading analytics</h2>
        <p className="font-bold">Admin access required.</p>
      </div>
    );
  }

  const chartProps = {
    contentStyle: {
      borderRadius: "8px",
      border: theme === "dark" ? "2px solid #2e2924" : "2px solid black",
      fontWeight: "bold" as const,
      backgroundColor: theme === "dark" ? "#1f1c18" : "#fff",
      color: theme === "dark" ? "#f0ebe2" : "#000",
    },
  };

  const regionData = data.geo_distribution.map((g) => ({
    name: g.timezone.split("/").pop() || g.timezone,
    value: g.count,
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <div className="bg-primary text-white p-3 rounded-xl border-4 border-black">
          <Activity size={32} />
        </div>
        <div>
          <h1 className="text-4xl font-black tracking-tight">
            Usage Analytics
          </h1>
          <p className="text-muted font-bold">
            Platform usage, user growth, and engagement metrics
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border-4 border-black shadow-card dark:bg-[#151411] dark:border-[#2e2924]">
          <div className="flex items-center gap-3">
            <Users className="text-blue-500" size={24} />
            <div>
              <p className="text-xs uppercase tracking-widest text-muted font-bold">Avg Session</p>
              <p className="text-2xl font-black">{data.average_session_duration_minutes}m</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border-4 border-black shadow-card dark:bg-[#151411] dark:border-[#2e2924]">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-green-500" size={24} />
            <div>
              <p className="text-xs uppercase tracking-widest text-muted font-bold">DAU (today)</p>
              <p className="text-2xl font-black">
                {data.daily_active_users.length > 0
                  ? data.daily_active_users[data.daily_active_users.length - 1].count
                  : 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border-4 border-black shadow-card dark:bg-[#151411] dark:border-[#2e2924]">
          <div className="flex items-center gap-3">
            <BookOpen className="text-purple-500" size={24} />
            <div>
              <p className="text-xs uppercase tracking-widest text-muted font-bold">Popular Lesson</p>
              <p className="text-2xl font-black truncate max-w-[120px]">
                {data.popular_lessons.length > 0
                  ? data.popular_lessons[0].lesson__title
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border-4 border-black shadow-card dark:bg-[#151411] dark:border-[#2e2924]">
          <div className="flex items-center gap-3">
            <Globe className="text-orange-500" size={24} />
            <div>
              <p className="text-xs uppercase tracking-widest text-muted font-bold">Regions</p>
              <p className="text-2xl font-black">{data.geo_distribution.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Daily Active Users */}
        <div className="bg-white p-6 rounded-2xl border-4 border-black shadow-card dark:bg-[#151411] dark:border-[#2e2924]">
          <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
            <Activity className="text-blue-500" /> Daily Active Users
          </h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily_active_users}>
                <defs>
                  <linearGradient id="colorDAU" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0088FE" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#0088FE" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === "dark" ? "#2e2924" : "#e0e0e0"} />
                <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip {...chartProps} />
                <Area type="monotone" dataKey="count" stroke="#0088FE" fillOpacity={1} fill="url(#colorDAU)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Active Users */}
        <div className="bg-white p-6 rounded-2xl border-4 border-black shadow-card dark:bg-[#151411] dark:border-[#2e2924]">
          <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
            <Users className="text-green-500" /> Monthly Active Users
          </h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly_active_users}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === "dark" ? "#2e2924" : "#e0e0e0"} />
                <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip {...chartProps} />
                <Bar dataKey="count" fill="#00C49F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Most Popular Lessons */}
        <div className="bg-white p-6 rounded-2xl border-4 border-black shadow-card dark:bg-[#151411] dark:border-[#2e2924]">
          <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
            <BookOpen className="text-purple-500" /> Most Popular Lessons
          </h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.popular_lessons} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme === "dark" ? "#2e2924" : "#e0e0e0"} />
                <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="lesson__title"
                  stroke="#888888"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={150}
                />
                <Tooltip {...chartProps} />
                <Bar dataKey="count" fill="#8884d8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lesson Completion Rates */}
        <div className="bg-white p-6 rounded-2xl border-4 border-black shadow-card dark:bg-[#151411] dark:border-[#2e2924]">
          <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
            <TrendingUp className="text-orange-500" /> Lesson Completion Rates
          </h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.lesson_completion_rates.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme === "dark" ? "#2e2924" : "#e0e0e0"} />
                <XAxis type="number" domain={[0, 100]} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="title"
                  stroke="#888888"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={150}
                />
                <Tooltip {...chartProps} formatter={(value: number) => `${value}%`} />
                <Bar dataKey="completion_rate" fill="#FF8042" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User Signup Trend */}
        <div className="bg-white p-6 rounded-2xl border-4 border-black shadow-card dark:bg-[#151411] dark:border-[#2e2924]">
          <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
            <TrendingUp className="text-indigo-500" /> User Signup Trend
          </h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.signup_trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === "dark" ? "#2e2924" : "#e0e0e0"} />
                <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip {...chartProps} />
                <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Geographic Distribution */}
        <div className="bg-white p-6 rounded-2xl border-4 border-black shadow-card dark:bg-[#151411] dark:border-[#2e2924]">
          <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
            <Globe className="text-teal-500" /> Geographic Distribution
          </h2>
          <div className="h-80 w-full flex items-center justify-center">
            {regionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={regionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {regionData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                        stroke={theme === "dark" ? "#1f1c18" : "black"}
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip {...chartProps} />
                  <Legend iconType="circle" wrapperStyle={{ fontWeight: "bold", fontSize: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-bold text-muted dark:text-[#c4bbae]">No geographic data available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
