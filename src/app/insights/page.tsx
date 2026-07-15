"use client";

import { useEffect, useState } from "react";
import { formatToRupiah } from "@/utils/currency";
import type { ReconciliationResult } from "@/lib/calc/reconcile";

export default function InsightsPage() {
  const [reconcile, setReconcile] = useState<ReconciliationResult | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [source, setSource] = useState<string>("deterministic");
  const [anomalies, setAnomalies] = useState<
    Array<{ id: string; title: string; detail: string; severity: string; type: string }>
  >([]);
  const [digest, setDigest] = useState<{
    headline: string;
    story: string[];
    actions: string[];
    periodSpend: { total: number; count: number };
    upcomingDues: Array<{ month: string; total: number }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [r, i, a, d] = await Promise.all([
          fetch("/api/calc/reconcile").then((x) => x.json()),
          fetch("/api/ai/insights").then((x) => x.json()),
          fetch("/api/calc/anomalies").then((x) => x.json()),
          fetch("/api/ai/digest?type=monthly").then((x) => x.json()),
        ]);
        if (r.success) setReconcile(r.data);
        if (i.success) {
          setInsights(i.data.insights || []);
          setSource(i.data.source);
        }
        if (a.success) setAnomalies(a.data || []);
        if (d.success) setDigest(d.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load insights");
      }
    }
    load();
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-50 px-4 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <section className="rounded-3xl border border-zinc-200/80 bg-white/80 p-6 shadow-[0_28px_90px_-45px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-8">
          <p className="mb-2 inline-flex items-center rounded-full border border-amber-300/60 bg-amber-100/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
            Insights + AI coach
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            Financial insights
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Deterministic calculations first; optional LLM polish when OPENAI_API_KEY is set.
          </p>
        </section>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-zinc-200/80 bg-white/85 p-6 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.45)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Smart insights</h2>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              {source}
            </span>
          </div>
          <ul className="space-y-3">
            {insights.map((line, idx) => (
              <li key={idx} className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-700">
                {line}
              </li>
            ))}
            {!insights.length && <p className="text-sm text-zinc-500">No insights yet — add transactions.</p>}
          </ul>
        </section>

        {digest && (
          <section className="rounded-2xl border border-zinc-200/80 bg-white/85 p-6 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.45)]">
            <h2 className="text-lg font-semibold text-zinc-900">{digest.headline}</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Period spend: {formatToRupiah(digest.periodSpend.total)} across {digest.periodSpend.count}{" "}
              transactions
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  Actions
                </h3>
                <ul className="space-y-2">
                  {digest.actions.map((a, i) => (
                    <li key={i} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  Upcoming dues
                </h3>
                <ul className="space-y-2">
                  {digest.upcomingDues.map((m) => (
                    <li key={m.month} className="flex justify-between text-sm">
                      <span>{m.month}</span>
                      <span className="font-medium">{formatToRupiah(m.total)}</span>
                    </li>
                  ))}
                  {!digest.upcomingDues.length && (
                    <li className="text-sm text-zinc-500">None in near horizon</li>
                  )}
                </ul>
              </div>
            </div>
          </section>
        )}

        {reconcile && (
          <section className="rounded-2xl border border-zinc-200/80 bg-white/85 p-6 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.45)]">
            <h2 className="text-lg font-semibold text-zinc-900">Accrual ↔ cashflow reconciliation</h2>
            <p className="mt-2 text-sm text-zinc-600">{reconcile.summary}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MiniStat label="Accrual" value={formatToRupiah(reconcile.totals.accrual)} />
              <MiniStat label="Cashflow" value={formatToRupiah(reconcile.totals.cashflow)} />
              <MiniStat label="Gap" value={formatToRupiah(reconcile.totals.gap)} />
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                    <th className="py-2 pr-4">Period</th>
                    <th className="py-2 pr-4">Accrual</th>
                    <th className="py-2 pr-4">Cashflow</th>
                    <th className="py-2">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {reconcile.periods.map((p) => (
                    <tr key={p.period} className="border-b border-zinc-100">
                      <td className="py-2 pr-4 font-medium">{p.period}</td>
                      <td className="py-2 pr-4">{formatToRupiah(p.accrual)}</td>
                      <td className="py-2 pr-4">{formatToRupiah(p.cashflow)}</td>
                      <td className={`py-2 font-medium ${p.gap > 0 ? "text-amber-700" : p.gap < 0 ? "text-emerald-700" : ""}`}>
                        {formatToRupiah(p.gap)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-zinc-200/80 bg-white/85 p-6 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.45)]">
          <h2 className="text-lg font-semibold text-zinc-900">Anomaly & habit detection</h2>
          <ul className="mt-4 space-y-3">
            {anomalies.map((a) => (
              <li
                key={a.id}
                className={`rounded-xl border px-4 py-3 text-sm ${
                  a.severity === "high"
                    ? "border-rose-200 bg-rose-50 text-rose-900"
                    : a.severity === "medium"
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-zinc-200 bg-zinc-50 text-zinc-700"
                }`}
              >
                <p className="font-semibold">
                  {a.title}{" "}
                  <span className="text-[10px] uppercase tracking-wide opacity-70">{a.type}</span>
                </p>
                <p className="mt-1 opacity-90">{a.detail}</p>
              </li>
            ))}
            {!anomalies.length && (
              <p className="text-sm text-zinc-500">No anomalies detected in the recent window.</p>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">{label}</p>
      <p className="mt-1 font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
