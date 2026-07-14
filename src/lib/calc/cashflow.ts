export type CashflowObligation = {
  id: string;
  kind: "installment" | "subscription" | "one_time";
  label: string;
  category?: string | null;
  amount: number;
  dueMonth: string; // YYYY-MM
  status?: string | null;
  meta?: Record<string, unknown>;
};

export type CashflowMonthBucket = {
  month: string;
  total: number;
  installmentTotal: number;
  subscriptionTotal: number;
  oneTimeTotal: number;
  items: CashflowObligation[];
};

export type CashflowCalendarResult = {
  months: CashflowMonthBucket[];
  peakMonth: string | null;
  peakAmount: number;
  totalOverHorizon: number;
  tightMonths: string[];
};

export function buildCashflowCalendar(
  obligations: CashflowObligation[],
  options?: { horizonMonths?: number; startMonth?: string; tightThresholdRatio?: number }
): CashflowCalendarResult {
  const horizon = options?.horizonMonths ?? 12;
  const start = options?.startMonth
    ? parseYearMonth(options.startMonth)
    : (() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
      })();

  const monthKeys: string[] = [];
  for (let i = 0; i < horizon; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    monthKeys.push(toYearMonth(d));
  }

  const byMonth = new Map<string, CashflowMonthBucket>();
  for (const key of monthKeys) {
    byMonth.set(key, {
      month: key,
      total: 0,
      installmentTotal: 0,
      subscriptionTotal: 0,
      oneTimeTotal: 0,
      items: [],
    });
  }

  for (const item of obligations) {
    const bucket = byMonth.get(item.dueMonth.slice(0, 7));
    if (!bucket) continue;
    bucket.items.push(item);
    bucket.total += item.amount;
    if (item.kind === "installment") bucket.installmentTotal += item.amount;
    else if (item.kind === "subscription") bucket.subscriptionTotal += item.amount;
    else bucket.oneTimeTotal += item.amount;
  }

  const months = monthKeys.map((k) => byMonth.get(k)!);
  const totals = months.map((m) => m.total);
  const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  const threshold = avg * (options?.tightThresholdRatio ?? 1.25);

  let peakMonth: string | null = null;
  let peakAmount = 0;
  for (const m of months) {
    if (m.total > peakAmount) {
      peakAmount = m.total;
      peakMonth = m.month;
    }
  }

  return {
    months,
    peakMonth,
    peakAmount,
    totalOverHorizon: months.reduce((s, m) => s + m.total, 0),
    tightMonths: months.filter((m) => m.total >= threshold && m.total > 0).map((m) => m.month),
  };
}

export function expandSubscriptions(
  subs: Array<{
    id: string;
    amount: number;
    date: string;
    notes?: string | null;
    category?: string | null;
    interval?: "weekly" | "monthly" | "yearly" | null;
  }>,
  horizonMonths: number,
  startMonth?: string
): CashflowObligation[] {
  const start = startMonth
    ? parseYearMonth(startMonth)
    : (() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
      })();

  const result: CashflowObligation[] = [];

  for (const sub of subs) {
    const interval = sub.interval || "monthly";
    for (let i = 0; i < horizonMonths; i++) {
      const due = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const dueMonth = toYearMonth(due);

      if (interval === "yearly") {
        const origin = new Date(sub.date);
        if (due.getMonth() !== origin.getMonth()) continue;
      }
      if (interval === "weekly") {
        // Approximate weekly as ~4.33 charges/month for calendar totals
        result.push({
          id: `${sub.id}-${dueMonth}`,
          kind: "subscription",
          label: sub.notes || "Subscription",
          category: sub.category,
          amount: Math.round(sub.amount * 4.33),
          dueMonth,
          meta: { interval, sourceId: sub.id, weeklyAmount: sub.amount },
        });
        continue;
      }

      result.push({
        id: `${sub.id}-${dueMonth}`,
        kind: "subscription",
        label: sub.notes || "Subscription",
        category: sub.category,
        amount: sub.amount,
        dueMonth,
        meta: { interval, sourceId: sub.id },
      });
    }
  }

  return result;
}

function toYearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseYearMonth(ym: string): Date {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1);
}
