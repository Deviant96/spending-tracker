"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type GroupedRow = {
  period: string;
  total: number;
  count: number;
};

function yyyyMm(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function InsightsBox() {
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

  if (loading) {
    return (
      <section
        style={{
          border: "1px solid #ccc",
          borderRadius: "8px",
          padding: "1rem",
          background: "#fafafa",
        }}
      >
        <h2>Insights</h2>
        <p>Loading insights…</p>
      </section>
    );
  }

  if (monthlyRows.length === 0 && categoryRows.length === 0) {
    return (
      <section
        style={{
          border: "1px solid #ccc",
          borderRadius: "8px",
          padding: "1rem",
          background: "#fafafa",
        }}
      >
        <h2>Insights</h2>
        <p>Add transactions to see insights.</p>
      </section>
    );
  }

  // --- Insight 1: Total this month vs last month ---
  // Using the grouped endpoint ensures:
  // - payment mode includes installment_schedule rows
  // - payment mode excludes converted/financed purchases from `transactions`
  const now = new Date();
  const currentKey = yyyyMm(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastKey = yyyyMm(lastMonthDate);

  const monthlyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of monthlyRows) map.set(r.period, Number(r.total) || 0);
    return map;
  }, [monthlyRows]);

  const totals = {
    current: monthlyMap.get(currentKey) ?? 0,
    previous: monthlyMap.get(lastKey) ?? 0,
  };

  const monthDiff =
    totals.previous > 0
      ? (((totals.current - totals.previous) / totals.previous) * 100).toFixed(1)
      : null;

  const insights: string[] = [];

  insights.push(`You spent ${totals.current.toLocaleString()} this month.`);

  if (monthDiff) {
    insights.push(
      monthDiff.startsWith("-")
        ? `Good job! Spending is down ${Math.abs(Number(monthDiff))}% compared to last month.`
        : `Spending increased by ${monthDiff}% compared to last month.`
    );
  }

  // --- Insight 2: Biggest category ---
  // Category analytics are still rooted in the original transaction category.
  // In payment mode, installment_schedule rows are joined back to the purchase,
  // so payments are attributed to that purchase's category (no double counting).
  const biggest = [...categoryRows]
    .map((r) => [r.period, Number(r.total) || 0] as const)
    .sort((a, b) => b[1] - a[1])[0];

  if (biggest) {
    insights.push(
      `Your biggest expense category is ${biggest[0]} (${biggest[1].toLocaleString()}).`
    );
  }

  return (
    <section
      style={{
        border: "1px solid #ccc",
        borderRadius: "8px",
        padding: "1rem",
        background: "#fafafa",
      }}
    >
      <h2>Insights</h2>
      <ul>
        {insights.map((tip, i) => (
          <li key={i} style={{ marginBottom: "0.5rem" }}>
            {tip}
          </li>
        ))}
      </ul>
    </section>
  );
}
