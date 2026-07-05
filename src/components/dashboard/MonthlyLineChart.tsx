"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { MonthlyGraphData } from "@/lib/data/dashboard";

function formatYen(n: number): string {
  if (n >= 10000) return `${Math.floor(n / 10000)}万`;
  return `¥${n.toLocaleString("ja-JP")}`;
}

export function MonthlyLineChart({ data }: { data: MonthlyGraphData[] }) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="month"
            tickFormatter={(v: unknown) => `${v}月`}
            tick={{ fontSize: 11, fill: "#6b7280" }}
          />
          <YAxis
            tickFormatter={formatYen}
            tick={{ fontSize: 10, fill: "#6b7280" }}
            width={48}
          />
          <Tooltip
            formatter={(value: unknown, name: unknown) => [
              `¥${Number(value).toLocaleString("ja-JP")}`,
              String(name),
            ]}
            labelFormatter={(v: unknown) => `${v}月`}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="thisYearAmount"
            name="今年売上"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="lastYearAmount"
            name="昨年売上"
            stroke="#dc2626"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            strokeDasharray="4 2"
          />
          <Line
            type="monotone"
            dataKey="thisYearPeople"
            name="来店人数"
            stroke="#16a34a"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            yAxisId={0}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-navy/30 text-right mt-1">
        ※来店人数は右軸なし（売上と同スケール表示）
      </p>
    </div>
  );
}
