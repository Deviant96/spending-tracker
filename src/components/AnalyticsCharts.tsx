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

export default function AnalyticsCharts() {
  const [mode, setMode] = useState<"accrual" | "cashflow">("cashflow");
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        // Fetch Monthly Data
        const resMonthly = await fetch(`/api/reports?period=monthly&mode=${mode}`);
        const dataMonthly = await resMonthly.json();
        if (dataMonthly.success && Array.isArray(dataMonthly.data)) {
          setMonthlyData(
            dataMonthly.data.map((d: any) => ({
              month: d.period,
              spending: Number(d.total_expense) || 0,
            }))
          );
        }

        // Fetch Category Data
        const resCategory = await fetch(`/api/reports/grouped?groupBy=category&mode=${mode}`);
        const dataCategory = await resCategory.json();
        if (Array.isArray(dataCategory)) {
          setCategoryData(
            dataCategory.map((d: any) => ({
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
          <Select value={mode} onValueChange={(v: any) => setMode(v)}>
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
          {/* Monthly Spending */}
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

          {/* Category Breakdown */}
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
