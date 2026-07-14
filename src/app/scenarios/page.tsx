"use client";

import { useState } from "react";
import { formatToRupiah } from "@/utils/currency";

type ScenarioResult = Record<string, unknown>;

export default function ScenariosPage() {
  const [tab, setTab] = useState<"payoff_early" | "refinance" | "cut_category">("refinance");
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // refinance
  const [principal, setPrincipal] = useState("12000000");
  const [fromMonths, setFromMonths] = useState("12");
  const [toMonths, setToMonths] = useState("6");
  const [interestTotal, setInterestTotal] = useState("600000");
  const [feesTotal, setFeesTotal] = useState("100000");

  // payoff
  const [remPrincipal, setRemPrincipal] = useState("5000000");
  const [remInterest, setRemInterest] = useState("200000");
  const [remFees, setRemFees] = useState("50000");
  const [remMonths, setRemMonths] = useState("5");

  // cut
  const [category, setCategory] = useState("Food");
  const [currentMonthly, setCurrentMonthly] = useState("2000000");
  const [cutPercent, setCutPercent] = useState("20");

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let body: Record<string, unknown> = { type: tab };
      if (tab === "refinance") {
        body = {
          type: tab,
          principal: Number(principal),
          fromMonths: Number(fromMonths),
          toMonths: Number(toMonths),
          interestTotal: Number(interestTotal),
          feesTotal: Number(feesTotal),
        };
      } else if (tab === "payoff_early") {
        body = {
          type: tab,
          remainingPrincipal: Number(remPrincipal),
          remainingInterest: Number(remInterest),
          remainingFees: Number(remFees),
          remainingMonths: Number(remMonths),
        };
      } else {
        body = {
          type: tab,
          category,
          currentMonthly: Number(currentMonthly),
          cutPercent: Number(cutPercent),
        };
      }

      const res = await fetch("/api/calc/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setResult(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-50 px-4 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <section className="rounded-3xl border border-zinc-200/80 bg-white/80 p-6 shadow-[0_28px_90px_-45px_rgba(0,0,0,0.45)] sm:p-8">
          <p className="mb-2 inline-flex items-center rounded-full border border-fuchsia-300/60 bg-fuchsia-100/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-fuchsia-800">
            What-if
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Scenarios</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Formula-based what-ifs — pay off early, refinance tenor, or cut a category.
          </p>
        </section>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["refinance", "Refinance months"],
              ["payoff_early", "Pay off early"],
              ["cut_category", "Cut category"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setResult(null);
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                tab === id
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <section className="rounded-2xl border border-zinc-200/80 bg-white/85 p-6 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.45)]">
          {tab === "refinance" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Principal" value={principal} onChange={setPrincipal} />
              <Field label="Interest total" value={interestTotal} onChange={setInterestTotal} />
              <Field label="Fees" value={feesTotal} onChange={setFeesTotal} />
              <Field label="From months" value={fromMonths} onChange={setFromMonths} />
              <Field label="To months" value={toMonths} onChange={setToMonths} />
            </div>
          )}
          {tab === "payoff_early" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Remaining principal" value={remPrincipal} onChange={setRemPrincipal} />
              <Field label="Remaining interest" value={remInterest} onChange={setRemInterest} />
              <Field label="Remaining fees" value={remFees} onChange={setRemFees} />
              <Field label="Remaining months" value={remMonths} onChange={setRemMonths} />
            </div>
          )}
          {tab === "cut_category" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-zinc-500">Category</span>
                <input
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </label>
              <Field label="Current monthly" value={currentMonthly} onChange={setCurrentMonthly} />
              <Field label="Cut %" value={cutPercent} onChange={setCutPercent} />
            </div>
          )}

          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="mt-5 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {loading ? "Calculating…" : "Run scenario"}
          </button>

          {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}

          {result && (
            <div className="mt-6 rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm">
              {tab === "refinance" && (
                <div className="space-y-2">
                  <Row
                    label="Monthly before → after"
                    value={`${formatToRupiah(Number((result.before as { monthlyPaymentAverage: number })?.monthlyPaymentAverage || 0))} → ${formatToRupiah(Number((result.after as { monthlyPaymentAverage: number })?.monthlyPaymentAverage || 0))}`}
                  />
                  <Row label="Monthly delta" value={formatToRupiah(Number(result.monthlyDelta) || 0)} />
                  <Row label="Total cost delta" value={formatToRupiah(Number(result.totalCostDelta) || 0)} />
                  <Row
                    label="APR before → after"
                    value={`${(result.before as { approximateAprPercent: number | null })?.approximateAprPercent ?? "—"}% → ${(result.after as { approximateAprPercent: number | null })?.approximateAprPercent ?? "—"}%`}
                  />
                </div>
              )}
              {tab === "payoff_early" && (
                <div className="space-y-2">
                  <Row label="Pay off now" value={formatToRupiah(Number(result.payoffNowCost) || 0)} />
                  <Row label="Stay the course" value={formatToRupiah(Number(result.stayCourseCost) || 0)} />
                  <Row label="Savings" value={formatToRupiah(Number(result.savings) || 0)} />
                </div>
              )}
              {tab === "cut_category" && (
                <div className="space-y-2">
                  <Row label="Monthly savings" value={formatToRupiah(Number(result.monthlySavings) || 0)} />
                  <Row label="Yearly savings" value={formatToRupiah(Number(result.yearlySavings) || 0)} />
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-zinc-500">{label}</span>
      <input
        type="number"
        className="w-full rounded-lg border border-zinc-200 px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-zinc-500">{label}</span>
      <span className="font-semibold text-zinc-900">{value}</span>
    </div>
  );
}
