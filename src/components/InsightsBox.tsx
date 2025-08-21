"use client";

import { useTransactions } from "@/hooks/useTransactions";

export default function InsightsBox() {
  const { transactions } = useTransactions();

  if (transactions.length === 0) {
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

  // --- Example Insight 1: Total this month vs last month ---
  const now = new Date();
  const currentMonth = now.getMonth();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;

  const totals = transactions.reduce(
    (acc, t) => {
      const d = new Date(t.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === now.getFullYear()) {
        acc.current += t.amount;
      }
      if (d.getMonth() === lastMonth && d.getFullYear() === now.getFullYear()) {
        acc.previous += t.amount;
      }
      return acc;
    },
    { current: 0, previous: 0 }
  );

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

  // --- Example Insight 2: Biggest category ---
  const categoryTotals = transactions.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});
  const biggestCategory = Object.entries(categoryTotals).sort(
    (a, b) => b[1] - a[1]
  )[0];
  if (biggestCategory) {
    insights.push(`Your biggest expense category is ${biggestCategory[0]} (${biggestCategory[1].toLocaleString()}).`);
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
