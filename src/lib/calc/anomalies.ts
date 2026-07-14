export type SpendingPoint = {
  id: string;
  date: string;
  amount: number;
  category?: string | null;
  notes?: string | null;
};

export type Anomaly = {
  id: string;
  type: "spike" | "duplicate" | "category_drift" | "missed_installment";
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
  relatedIds: string[];
  amount?: number;
};

function mean(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function detectAnomalies(
  transactions: SpendingPoint[],
  options?: {
    spikeZScore?: number;
    spikeMultiplier?: number;
    duplicateWindowDays?: number;
    categoryDriftRatio?: number;
  }
): Anomaly[] {
  const spikeZ = options?.spikeZScore ?? 3;
  const spikeMultiplier = options?.spikeMultiplier ?? 5;
  const dupDays = options?.duplicateWindowDays ?? 3;
  const driftRatio = options?.categoryDriftRatio ?? 1.8;
  const anomalies: Anomaly[] = [];

  const amounts = transactions.map((t) => t.amount).sort((a, b) => a - b);
  const median = amounts.length
    ? amounts.length % 2 === 0
      ? (amounts[amounts.length / 2 - 1] + amounts[amounts.length / 2]) / 2
      : amounts[Math.floor(amounts.length / 2)]
    : 0;
  const absDevs = amounts.map((a) => Math.abs(a - median)).sort((a, b) => a - b);
  const mad = absDevs.length
    ? absDevs.length % 2 === 0
      ? (absDevs[absDevs.length / 2 - 1] + absDevs[absDevs.length / 2]) / 2
      : absDevs[Math.floor(absDevs.length / 2)]
    : 0;
  const robustScale = mad > 0 ? mad * 1.4826 : mean(amounts.filter((a) => a <= median * 2 || median === 0)) || 1;

  for (const t of transactions) {
    const modifiedZ = mad > 0 ? (0.6745 * (t.amount - median)) / mad : (t.amount - median) / robustScale;
    const vsMedian = median > 0 && t.amount >= median * spikeMultiplier;
    if ((modifiedZ >= spikeZ || vsMedian) && t.amount > median) {
      anomalies.push({
        id: `spike-${t.id}`,
        type: "spike",
        severity: t.amount >= median * 10 ? "high" : "medium",
        title: "Unusual spending spike",
        detail: `${t.notes || t.category || "A transaction"} of ${t.amount} is significantly above your typical ~${Math.round(median)}.`,
        relatedIds: [t.id],
        amount: t.amount,
      });
    }
  }

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      const dayDiff =
        Math.abs(new Date(a.date).getTime() - new Date(b.date).getTime()) /
        (1000 * 60 * 60 * 24);
      if (dayDiff > dupDays) break;
      if (a.amount === b.amount && (a.category || "") === (b.category || "")) {
        anomalies.push({
          id: `dup-${a.id}-${b.id}`,
          type: "duplicate",
          severity: "medium",
          title: "Possible duplicate",
          detail: `Two similar ${a.amount} transactions within ${Math.ceil(dayDiff)} day(s) in ${a.category || "the same category"}.`,
          relatedIds: [a.id, b.id],
          amount: a.amount,
        });
      }
    }
  }

  // Category drift: last 30d vs previous 30d
  const now = Date.now();
  const day = 86400000;
  const recent = transactions.filter((t) => now - new Date(t.date).getTime() <= 30 * day);
  const prior = transactions.filter((t) => {
    const age = now - new Date(t.date).getTime();
    return age > 30 * day && age <= 60 * day;
  });

  const sumByCat = (list: SpendingPoint[]) => {
    const map = new Map<string, number>();
    for (const t of list) {
      const c = t.category || "Unknown";
      map.set(c, (map.get(c) || 0) + t.amount);
    }
    return map;
  };
  const recentMap = sumByCat(recent);
  const priorMap = sumByCat(prior);
  for (const [cat, recentSum] of recentMap) {
    const priorSum = priorMap.get(cat) || 0;
    if (priorSum > 0 && recentSum >= priorSum * driftRatio) {
      anomalies.push({
        id: `drift-${cat}`,
        type: "category_drift",
        severity: recentSum >= priorSum * 3 ? "high" : "medium",
        title: `Category drift: ${cat}`,
        detail: `${cat} spending rose from ${Math.round(priorSum)} (prior 30d) to ${Math.round(recentSum)} (last 30d).`,
        relatedIds: recent.filter((t) => (t.category || "Unknown") === cat).map((t) => t.id),
        amount: recentSum,
      });
    }
  }

  return anomalies;
}

export function detectMissedInstallments(
  schedules: Array<{
    scheduleId: number;
    planId: number;
    dueMonth: string;
    amount: number;
    status?: string | null;
    paidAt?: string | null;
    label?: string;
  }>,
  today: Date = new Date()
): Anomaly[] {
  const currentYm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const anomalies: Anomaly[] = [];

  for (const s of schedules) {
    const due = s.dueMonth.slice(0, 7);
    const unpaid = !s.paidAt && (s.status || "pending") !== "paid";
    if (unpaid && due < currentYm) {
      anomalies.push({
        id: `missed-${s.scheduleId}`,
        type: "missed_installment",
        severity: "high",
        title: "Missed installment payment",
        detail: `${s.label || `Plan #${s.planId}`} due ${due} looks unpaid (${s.amount}).`,
        relatedIds: [String(s.scheduleId)],
        amount: s.amount,
      });
    }
  }

  return anomalies;
}
