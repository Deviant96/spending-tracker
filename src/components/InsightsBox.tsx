"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function InsightsBox() {
  const [insights, setInsights] = useState<string[]>([]);
  const [source, setSource] = useState<string>("deterministic");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/ai/insights");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed");
        if (!cancelled) {
          setInsights(json.data?.insights || []);
          setSource(json.data?.source || "deterministic");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Unable to load insights");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="rounded-2xl border border-zinc-200/80 bg-white/85 p-6 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.45)]">
        <div className="h-5 w-32 animate-pulse rounded bg-zinc-200" />
        <div className="mt-4 h-16 animate-pulse rounded-xl bg-zinc-100" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-300 bg-white/75 p-8 text-center">
        <h2 className="text-lg font-semibold text-zinc-700">Insights</h2>
        <p className="mt-2 text-sm text-zinc-500">{error}</p>
      </section>
    );
  }

  if (!insights.length) {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-300 bg-white/75 p-8 text-center shadow-[0_20px_70px_-40px_rgba(0,0,0,0.4)]">
        <h2 className="text-lg font-semibold text-zinc-700">Insights</h2>
        <p className="mt-2 text-sm text-zinc-500">Add transactions to see spending insights here.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white/85 p-6 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.45)] sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Insights</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            {source}
          </span>
          <Link href="/insights" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            View all →
          </Link>
        </div>
      </div>
      <ul className="mt-4 space-y-3">
        {insights.slice(0, 4).map((tip, i) => (
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
