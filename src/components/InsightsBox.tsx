"use client";

import { useTransactions } from "@/hooks/useTransactions";
import { formatToRupiah } from "@/utils/currency";

export default function InsightsBox() {
  const { transactions } = useTransactions();

  if (transactions.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-300 bg-white/75 p-8 text-center shadow-[0_20px_70px_-40px_rgba(0,0,0,0.4)] backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-zinc-700">Insights</h2>
        <p className="mt-2 text-sm text-zinc-500">Add transactions to see spending insights here.</p>
      </section>
    );
  }

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
  insights.push(`You spent ${formatToRupiah(totals.current)} this month.`);

  if (monthDiff) {
    insights.push(
      monthDiff.startsWith("-")
        ? `Good job! Spending is down ${Math.abs(Number(monthDiff))}% compared to last month.`
        : `Spending increased by ${monthDiff}% compared to last month.`
    );
  }

  const categoryTotals = transactions.reduce<Record<string, number>>((acc, t) => {
    const category = t.category || "Unknown";
    acc[category] = (acc[category] || 0) + t.amount;
    return acc;
  }, {});
  const biggestCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  if (biggestCategory) {
    insights.push(
      `Your biggest expense category is ${biggestCategory[0]} (${formatToRupiah(biggestCategory[1])}).`
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white/85 p-6 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Insights</h2>
      <ul className="mt-4 space-y-3">
        {insights.map((tip, i) => (
          <li
            key={i}
            className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-700"
          >
            {tip}
          </li>
        ))}
      </ul>
    </section>
  );
}
