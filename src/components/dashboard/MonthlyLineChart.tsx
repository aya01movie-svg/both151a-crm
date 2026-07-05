"use client";

import {
  ComposedChart,
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

const DATA_KEY_LABELS: Record<string, string> = {
  thisYearAmount: "今年売上",
  lastYearAmount: "昨年売上",
  thisYearPeople: "来店人数",
};

export function MonthlyLineChart({ data }: { data: MonthlyGraphData[] }) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart data={data} margin={{ top: 8, right: 44, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="month"
            tickFormatter={(v: unknown) => `${v}月`}
            tick={{ fontSize: 11, fill: "#6b7280" }}
          />
          {/* 左Y軸: 売上（円） */}
          <YAxis
            yAxisId="amount"
            orientation="left"
            tickFormatter={formatYen}
            tick={{ fontSize: 10, fill: "#6b7280" }}
            width={50}
          />
          {/* 右Y軸: 来店人数（人） */}
          <YAxis
            yAxisId="people"
            orientation="right"
            tickFormatter={(v: unknown) => `${v}人`}
            tick={{ fontSize: 10, fill: "#16a34a" }}
            width={40}
          />
          <Tooltip
            formatter={(value: unknown, dataKey: unknown) => {
              const key = String(dataKey);
              const num = Number(value);
              if (key === "thisYearPeople") {
                return [`${num}人`, DATA_KEY_LABELS[key] ?? key];
              }
              return [`¥${num.toLocaleString("ja-JP")}`, DATA_KEY_LABELS[key] ?? key];
            }}
            labelFormatter={(v: unknown) => `${v}月`}
          />
          <Legend
            formatter={(value: string) => DATA_KEY_LABELS[value] ?? value}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            yAxisId="amount"
            type="monotone"
            dataKey="thisYearAmount"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="amount"
            type="monotone"
            dataKey="lastYearAmount"
            stroke="#dc2626"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            strokeDasharray="4 2"
          />
          <Line
            yAxisId="people"
            type="monotone"
            dataKey="thisYearPeople"
            stroke="#16a34a"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
