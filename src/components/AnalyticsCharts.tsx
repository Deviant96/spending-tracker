"use client";

import { useTransactions } from "@/hooks/useTransactions";
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

export default function AnalyticsCharts() {
  const { transactions } = useTransactions();

  // --- Monthly Spending (group by month) ---
  const monthlyData = transactions.reduce<Record<string, number>>((acc, t) => {
    const month = new Date(t.date).toLocaleString("default", { month: "short" });
    acc[month] = (acc[month] || 0) + t.amount;
    return acc;
  }, {});

  const monthlyChartData = Object.entries(monthlyData).map(([month, spending]) => ({
    month,
    spending,
  }));

  // --- Category Breakdown (group by category) ---
  const categoryData = transactions.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});

  const categoryChartData = Object.entries(categoryData).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <section>
      <h2>Analytics</h2>
      {transactions.length === 0 ? (
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
