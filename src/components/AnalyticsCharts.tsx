"use client";

import { useEffect, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7f50", "#a4de6c"];

type MonthlyChartPoint = { month: string; spending: number };
type CategoryChartPoint = { name: string; value: number };

export default function AnalyticsCharts() {
  const [mode, setMode] = useState<"accrual" | "cashflow">("cashflow");
  const [monthlyData, setMonthlyData] = useState<MonthlyChartPoint[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryChartPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const resMonthly = await fetch(`/api/reports?period=monthly&mode=${mode}`);
        const dataMonthly = await resMonthly.json();
        if (dataMonthly.success && Array.isArray(dataMonthly.data)) {
          setMonthlyData(
            dataMonthly.data.map((d: { period: string; total_expense: number }) => ({
              month: d.period,
              spending: Number(d.total_expense) || 0,
            }))
          );
        }

        const resCategory = await fetch(`/api/reports/grouped?groupBy=category&mode=${mode}`);
        const dataCategory = await resCategory.json();
        if (Array.isArray(dataCategory)) {
          setCategoryData(
            dataCategory.map((d: { period: string; total: number }) => ({
              name: d.period,
              value: Number(d.total),
            }))
          );
        }
      } catch (err) {
        console.error("Failed to fetch analytics", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [mode]);

  return (
    <section>
      <div className="flex justify-between items-center mb-4">
        <h2>Analytics</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">View Mode:</span>
          <Select
            value={mode}
            onValueChange={(value) => setMode(value as "accrual" | "cashflow")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cashflow">Cashflow (Payment)</SelectItem>
              <SelectItem value="accrual">Accrual (Purchase)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <p>Loading charts...</p>
      ) : monthlyData.length === 0 ? (
        <p>No data available.</p>
      ) : (
        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "300px", height: 300 }}>
            <h3>Monthly Spending</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="spending" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ flex: 1, minWidth: "300px", height: 300 }}>
            <h3>Category Breakdown</h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
                  label
                >
                  {categoryData.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.name}`}
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
