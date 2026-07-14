"use client";

import { useEffect, useState } from "react";
import { formatToRupiah } from "@/utils/currency";
import type { SubscriptionRunwayResult } from "@/lib/calc/subscription";

export default function SubscriptionsPage() {
  const [data, setData] = useState<SubscriptionRunwayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/calc/subscriptions")
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error || "Failed");
        setData(json.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-50 px-4 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <section className="rounded-3xl border border-zinc-200/80 bg-white/80 p-6 shadow-[0_28px_90px_-45px_rgba(0,0,0,0.45)] sm:p-8">
          <p className="mb-2 inline-flex items-center rounded-full border border-sky-300/60 bg-sky-100/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-800">
            Subscription runway
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Subscriptions</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Monthly/yearly cost, next renewals, and cancel-to-save impact.
          </p>
        </section>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card label="Active" value={String(data.count)} />
              <Card label="Monthly burn" value={formatToRupiah(data.monthlyTotal)} />
              <Card label="Yearly cost" value={formatToRupiah(data.yearlyTotal)} />
            </div>

            <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/85 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.45)]">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/80 text-left text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Interval</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Monthly eq.</th>
                    <th className="px-4 py-3">Yearly</th>
                    <th className="px-4 py-3">Next renewal</th>
                    <th className="px-4 py-3">Cancel saves</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id} className="border-b border-zinc-100">
                      <td className="px-4 py-3">
                        <p className="font-medium">{item.label}</p>
                        {item.category && (
                          <p className="text-xs text-zinc-400">{item.category}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize">{item.interval}</td>
                      <td className="px-4 py-3">{formatToRupiah(item.amount)}</td>
                      <td className="px-4 py-3">{formatToRupiah(item.monthlyEquivalent)}</td>
                      <td className="px-4 py-3">{formatToRupiah(item.yearlyCost)}</td>
                      <td className="px-4 py-3">{item.nextRenewal}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-700">
                        {formatToRupiah(item.cancelSavesPerYear)}/yr
                      </td>
                    </tr>
                  ))}
                  {!data.items.length && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                        No subscription transactions found.
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
