"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7f50", "#a4de6c"];

type GroupedRow = {
  period: string;
  total: number;
  count: number;
};

function toMonthLabel(periodYYYYMM: string) {
  // period is `YYYY-MM`
  const d = new Date(`${periodYYYYMM}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return periodYYYYMM;
  return d.toLocaleString(undefined, { month: "short", year: "2-digit" });
}

export default function AnalyticsCharts() {
  const searchParams = useSearchParams();
  // Default to cashflow (payment) because it avoids installment double counting.
  const mode = searchParams.get("mode") === "purchase" ? "purchase" : "payment";

  const [monthlyRows, setMonthlyRows] = useState<GroupedRow[]>([]);
  const [categoryRows, setCategoryRows] = useState<GroupedRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);

        const [monthRes, categoryRes] = await Promise.all([
          fetch(`/api/reports/grouped?groupBy=month&mode=${mode}`),
          fetch(`/api/reports/grouped?groupBy=category&mode=${mode}`),
        ]);

        const monthData = await monthRes.json();
        const categoryData = await categoryRes.json();

        if (cancelled) return;

        setMonthlyRows(Array.isArray(monthData) ? monthData : []);
        setCategoryRows(Array.isArray(categoryData) ? categoryData : []);
      } catch (e) {
        if (!cancelled) {
          setMonthlyRows([]);
          setCategoryRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const monthlyChartData = useMemo(
    () =>
      monthlyRows.map((r) => ({
        month: toMonthLabel(r.period),
        spending: Number(r.total) || 0,
      })),
    [monthlyRows]
  );

  const categoryChartData = useMemo(
    () =>
      categoryRows.map((r) => ({
        name: r.period || "Unknown",
        value: Number(r.total) || 0,
      })),
    [categoryRows]
  );

  return (
    <section>
      <h2>Analytics</h2>
      {loading ? (
        <p>Loading analytics…</p>
      ) : monthlyChartData.length === 0 && categoryChartData.length === 0 ? (
        <p>No transactions yet. Add some to see charts!</p>
      ) : (
        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
          {/* Monthly Spending */}
          <div style={{ flex: 1, minWidth: "300px", height: 300 }}>
            <h3>Monthly Spending</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="spending" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category Breakdown */}
          <div style={{ flex: 1, minWidth: "300px", height: 300 }}>
            <h3>Category Breakdown</h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryChartData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
                  label
                >
                  {categoryChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
