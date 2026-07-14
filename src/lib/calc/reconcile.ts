export type PeriodTotals = {
  period: string;
  accrual: number;
  cashflow: number;
};

export type ReconciliationResult = {
  periods: Array<PeriodTotals & { gap: number; deferredRatio: number | null }>;
  totals: {
    accrual: number;
    cashflow: number;
    gap: number;
  };
  summary: string;
};

/**
 * Compare accrual (purchase-time) vs cashflow (payment-time) by period.
 * Positive gap = more purchased than paid (new financing / deferred obligation).
 * Negative gap = paying down past purchases.
 */
export function reconcileAccrualCashflow(periods: PeriodTotals[]): ReconciliationResult {
  const enriched = periods.map((p) => {
    const gap = p.accrual - p.cashflow;
    const deferredRatio = p.accrual > 0 ? Math.round((gap / p.accrual) * 1000) / 10 : null;
    return { ...p, gap, deferredRatio };
  });

  const accrual = enriched.reduce((s, p) => s + p.accrual, 0);
  const cashflow = enriched.reduce((s, p) => s + p.cashflow, 0);
  const gap = accrual - cashflow;

  let summary: string;
  if (Math.abs(gap) < 1) {
    summary = "Accrual and cashflow are aligned for this range — purchases and payments match.";
  } else if (gap > 0) {
    summary = `You purchased more than you paid in this range (deferred gap ${gap}). Installments or unpaid obligations are carrying balance forward.`;
  } else {
    summary = `You paid more than you purchased in this range (net drawdown ${Math.abs(gap)}). You are paying down prior financing.`;
  }

  return {
    periods: enriched,
    totals: { accrual, cashflow, gap },
    summary,
  };
}
