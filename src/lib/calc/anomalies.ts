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

function stddev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  const v = nums.reduce((s, n) => s + (n - m) ** 2, 0) / nums.length;
  return Math.sqrt(v);
}

export function detectAnomalies(
  transactions: SpendingPoint[],
  options?: {
    spikeZScore?: number;
    duplicateWindowDays?: number;
    categoryDriftRatio?: number;
  }
): Anomaly[] {
  const spikeZ = options?.spikeZScore ?? 2.5;
  const dupDays = options?.duplicateWindowDays ?? 3;
  const driftRatio = options?.categoryDriftRatio ?? 1.8;
  const anomalies: Anomaly[] = [];

  const amounts = transactions.map((t) => t.amount);
  const m = mean(amounts);
  const sd = stddev(amounts);

  for (const t of transactions) {
    if (sd > 0 && (t.amount - m) / sd >= spikeZ && t.amount > m) {
      anomalies.push({
        id: `spike-${t.id}`,
        type: "spike",
        severity: t.amount > m + 3 * sd ? "high" : "medium",
        title: "Unusual spending spike",
        detail: `${t.notes || t.category || "A transaction"} of ${t.amount} is significantly above your typical ~${Math.round(m)}.`,
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
