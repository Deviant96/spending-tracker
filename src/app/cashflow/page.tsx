"use client";

import { useEffect, useState } from "react";
import { formatToRupiah } from "@/utils/currency";
import type { CashflowCalendarResult } from "@/lib/calc/cashflow";

export default function CashflowPage() {
  const [data, setData] = useState<CashflowCalendarResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [horizon, setHorizon] = useState(12);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/calc/cashflow?horizon=${horizon}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        if (!cancelled) {
          setData(json.data);
          setSelectedMonth(json.data?.peakMonth || json.data?.months?.[0]?.month || null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [horizon]);

  const selected = data?.months.find((m) => m.month === selectedMonth);

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-50 px-4 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <section className="mb-8 rounded-3xl border border-zinc-200/80 bg-white/80 p-6 shadow-[0_28px_90px_-45px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-8">
          <p className="mb-2 inline-flex items-center rounded-full border border-cyan-300/60 bg-cyan-100/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-800">
            Self-calc
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
                Cashflow calendar
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                Upcoming installment dues and subscription charges — money leaving each month.
              </p>
            </div>
            <label className="text-sm text-zinc-600">
              Horizon{" "}
              <select
                className="ml-2 rounded-lg border border-zinc-200 bg-white px-3 py-2"
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
              >
                {[6, 12, 18, 24].map((n) => (
                  <option key={n} value={n}>
                    {n} months
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {error && (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </div>
        )}

        {loading && (
          <div className="h-40 animate-pulse rounded-2xl bg-zinc-200/70" />
        )}

        {data && !loading && (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <Stat label="Horizon total" value={formatToRupiah(data.totalOverHorizon)} />
              <Stat
                label="Peak month"
                value={data.peakMonth ? `${data.peakMonth}` : "—"}
                sub={data.peakMonth ? formatToRupiah(data.peakAmount) : undefined}
              />
              <Stat
                label="Tight months"
                value={data.tightMonths.length ? data.tightMonths.join(", ") : "None"}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <section className="rounded-2xl border border-zinc-200/80 bg-white/85 p-4 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.45)]">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Monthly obligations
                </h2>
                <div className="space-y-2">
                  {data.months.map((m) => {
                    const max = Math.max(...data.months.map((x) => x.total), 1);
                    const pct = Math.round((m.total / max) * 100);
                    const tight = data.tightMonths.includes(m.month);
                    return (
                      <button
                        key={m.month}
                        type="button"
                        onClick={() => setSelectedMonth(m.month)}
                        className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                          selectedMonth === m.month
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {m.month}
                            {tight && (
                              <span className="ml-2 text-[10px] uppercase tracking-wide opacity-80">
                                tight
                              </span>
                            )}
                          </span>
                          <span>{formatToRupiah(m.total)}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
                          <div
                            className={`h-full rounded-full ${selectedMonth === m.month ? "bg-amber-300" : "bg-cyan-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-zinc-200/80 bg-white/85 p-4 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.45)]">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  {selectedMonth || "Details"}
                </h2>
                {!selected || selected.items.length === 0 ? (
                  <p className="text-sm text-zinc-500">No obligations this month.</p>
                ) : (
                  <ul className="space-y-3">
                    {selected.items.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-3 text-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-zinc-900">{item.label}</p>
                            <p className="mt-0.5 text-xs capitalize text-zinc-500">
                              {item.kind}
                              {item.category ? ` · ${item.category}` : ""}
                            </p>
                          </div>
                          <span className="font-semibold text-zinc-800">
                            {formatToRupiah(item.amount)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {selected && (
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-100 pt-4 text-xs text-zinc-600">
                    <div>
                      <p className="text-zinc-400">Installments</p>
                      <p className="font-semibold">{formatToRupiah(selected.installmentTotal)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-400">Subscriptions</p>
                      <p className="font-semibold">{formatToRupiah(selected.subscriptionTotal)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-400">Other</p>
                      <p className="font-semibold">{formatToRupiah(selected.oneTimeTotal)}</p>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/85 p-4 shadow-[0_16px_60px_-28px_rgba(0,0,0,0.35)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-zinc-900">{value}</p>
      {sub && <p className="mt-1 text-sm text-zinc-500">{sub}</p>}
    </div>
  );
}
