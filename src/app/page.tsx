"use client";

import dynamic from "next/dynamic";
import InsightsBox from "@/components/InsightsBox";

const AnalyticsCharts = dynamic(() => import("@/components/AnalyticsCharts"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-zinc-200 bg-white/80 p-8 shadow-[0_16px_60px_-28px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div className="h-6 w-48 animate-pulse rounded bg-zinc-200" />
      <div className="mt-6 h-64 w-full animate-pulse rounded-xl bg-zinc-100" />
    </div>
  ),
});

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-50 px-4 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <section className="mb-8 rounded-3xl border border-zinc-200/80 bg-white/80 p-6 shadow-[0_28px_90px_-45px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-8">
          <p className="mb-2 inline-flex items-center rounded-full border border-amber-300/60 bg-amber-100/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
            Overview
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">Dashboard</h1>
          <p className="mt-2 text-sm text-zinc-500 sm:text-base">
            Track spending trends, insights, and category breakdowns at a glance.
          </p>
        </section>

        <InsightsBox />

        <div className="mt-8">
          <AnalyticsCharts />
        </div>
      </div>
    </main>
  );
}
