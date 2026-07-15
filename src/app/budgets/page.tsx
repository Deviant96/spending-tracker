"use client";

import { useEffect, useState } from "react";
import { formatToRupiah } from "@/utils/currency";
import type { BudgetProjectionResult } from "@/lib/calc/budget";
import type { Category } from "@/types";
import FeedbackBanner from "@/components/FeedbackBanner";

export default function BudgetsPage() {
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [projection, setProjection] = useState<BudgetProjectionResult | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [b, c] = await Promise.all([
        fetch(`/api/calc/budgets?month=${month}`).then((r) => r.json()),
        fetch("/api/categories").then((r) => r.json()),
      ]);
      if (b.success) setProjection(b.data.projection);
      else setMessage({ type: "error", text: b.error || "Failed to load budgets" });
      if (c?.success && Array.isArray(c.data)) setCategories(c.data);
      else if (Array.isArray(c)) setCategories(c);
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Failed to load",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const saveBudget = async () => {
    setMessage(null);
    const res = await fetch("/api/calc/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: Number(categoryId),
        amount: Number(amount),
        month,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage({ type: "error", text: json.error || "Save failed" });
      return;
    }
    setMessage({ type: "success", text: "Budget saved." });
    setAmount("");
    await load();
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-50 px-4 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <section className="rounded-3xl border border-zinc-200/80 bg-white/80 p-6 shadow-[0_28px_90px_-45px_rgba(0,0,0,0.45)] sm:p-8">
          <p className="mb-2 inline-flex items-center rounded-full border border-emerald-300/60 bg-emerald-100/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
            Budget vs actual
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Budgets</h1>
              <p className="mt-2 text-sm text-zinc-500">
                Set monthly category targets and track projected month-end spend.
              </p>
            </div>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </section>

        {message && (
          <FeedbackBanner
            type={message.type}
            message={message.text}
            onDismiss={() => setMessage(null)}
          />
        )}

        <section className="rounded-2xl border border-zinc-200/80 bg-white/85 p-6 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.45)]">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">
            Set / update budget
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={saveBudget}
              disabled={!categoryId || !amount}
              className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </section>

        {loading && <div className="h-32 animate-pulse rounded-2xl bg-zinc-200/70" />}

        {projection && !loading && (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <Card label="Budget" value={formatToRupiah(projection.totals.budget)} />
              <Card label="Spent" value={formatToRupiah(projection.totals.spent)} />
              <Card label="Remaining" value={formatToRupiah(projection.totals.remaining)} />
              <Card label="Projected EOM" value={formatToRupiah(projection.totals.projectedMonthEnd)} />
            </div>

            <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/85 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.45)]">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/80 text-left text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Budget</th>
                    <th className="px-4 py-3">Spent</th>
                    <th className="px-4 py-3">Used</th>
                    <th className="px-4 py-3">Projected</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {projection.rows.map((r) => (
                    <tr key={r.categoryId} className="border-b border-zinc-100">
                      <td className="px-4 py-3 font-medium">{r.categoryName}</td>
                      <td className="px-4 py-3">{formatToRupiah(r.budget)}</td>
                      <td className="px-4 py-3">{formatToRupiah(r.spent)}</td>
                      <td className="px-4 py-3">{r.percentUsed}%</td>
                      <td className="px-4 py-3">{formatToRupiah(r.projectedMonthEnd)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            r.status === "over"
                              ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                              : r.status === "near"
                                ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!projection.rows.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                        No budgets or spending for this month yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/85 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
