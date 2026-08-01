import React, { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface HourlyTrend {
  hour: string;
  count: number;
  p50: number;
  p95: number;
  p99: number;
  avg_duration: number;
  avg_queries: number;
}

interface PerfChartProps {
  data: HourlyTrend[];
}

export const PerfChart: React.FC<PerfChartProps> = ({ data }) => {
  return (
    <div className="w-full h-96 bg-gray-900 rounded-lg p-4 shadow-lg border border-gray-800">
      <h3 className="text-xl font-semibold text-white mb-4">Latency Trends (ms)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis 
            dataKey="hour" 
            tickFormatter={(tick) => new Date(tick).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
            stroke="#aaa" 
          />
          <YAxis stroke="#aaa" />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151' }} 
            itemStyle={{ color: '#fff' }}
          />
          <Legend />
          <Line type="monotone" dataKey="p50" stroke="#10b981" name="P50 Latency" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="p95" stroke="#f59e0b" name="P95 Latency" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="p99" stroke="#ef4444" name="P99 Latency" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
