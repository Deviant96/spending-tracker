"use client";

import { useMemo } from "react";
import { calculateInstallment } from "@/lib/calc/installment";
import { formatToRupiah } from "@/utils/currency";

type Props = {
  principal: number;
  months: number;
  interestTotal?: number;
  feesTotal?: number;
  startDate?: string | null;
};

export default function InstallmentCalcPreview({
  principal,
  months,
  interestTotal = 0,
  feesTotal = 0,
  startDate,
}: Props) {
  const calc = useMemo(
    () =>
      calculateInstallment({
        principal: Number(principal) || 0,
        months: Number(months) || 0,
        interestTotal: Number(interestTotal) || 0,
        feesTotal: Number(feesTotal) || 0,
        startDate: startDate || undefined,
      }),
    [principal, months, interestTotal, feesTotal, startDate]
  );

  if (!months || months < 2 || !principal) return null;

  return (
    <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/60 p-4 text-sm text-zinc-800">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">
        Installment calculator
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex justify-between gap-2">
          <span className="text-zinc-500">Monthly (avg)</span>
          <span className="font-semibold">{formatToRupiah(calc.monthlyPaymentAverage)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-zinc-500">Total cost</span>
          <span className="font-semibold">{formatToRupiah(calc.totalCost)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-zinc-500">Financing cost</span>
          <span className="font-semibold">{formatToRupiah(calc.financingCost)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-zinc-500">Approx. APR</span>
          <span className="font-semibold">
            {calc.approximateAprPercent != null ? `${calc.approximateAprPercent}%` : "—"}
          </span>
        </div>
        <div className="flex justify-between gap-2 sm:col-span-2">
          <span className="text-zinc-500">Payoff month</span>
          <span className="font-semibold">{calc.payoffMonth || "—"}</span>
        </div>
      </div>
      {calc.financingCost > 0 && (
        <p className="mt-3 text-xs text-zinc-600">
          Paying cash now would avoid {formatToRupiah(calc.financingCost)} in interest/fees.
        </p>
      )}
    </div>
  );
}
