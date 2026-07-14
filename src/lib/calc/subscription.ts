export type SubscriptionInput = {
  id: string;
  amount: number;
  date: string;
  notes?: string | null;
  category?: string | null;
  interval?: "weekly" | "monthly" | "yearly" | null;
};

export type SubscriptionRunwayItem = {
  id: string;
  label: string;
  category: string | null;
  amount: number;
  interval: "weekly" | "monthly" | "yearly";
  monthlyEquivalent: number;
  yearlyCost: number;
  nextRenewal: string;
  cancelSavesPerYear: number;
};

export type SubscriptionRunwayResult = {
  items: SubscriptionRunwayItem[];
  monthlyTotal: number;
  yearlyTotal: number;
  count: number;
  topByYearly: SubscriptionRunwayItem[];
};

function toMonthly(amount: number, interval: "weekly" | "monthly" | "yearly"): number {
  if (interval === "weekly") return Math.round(amount * 4.33);
  if (interval === "yearly") return Math.round(amount / 12);
  return amount;
}

function nextRenewalDate(startDate: string, interval: "weekly" | "monthly" | "yearly", from = new Date()): string {
  const origin = new Date(startDate);
  if (Number.isNaN(origin.getTime())) {
    return from.toISOString().slice(0, 10);
  }

  const cursor = new Date(origin);
  if (interval === "weekly") {
    while (cursor <= from) cursor.setDate(cursor.getDate() + 7);
  } else if (interval === "yearly") {
    cursor.setFullYear(from.getFullYear());
    if (cursor <= from) cursor.setFullYear(cursor.getFullYear() + 1);
  } else {
    cursor.setFullYear(from.getFullYear());
    cursor.setMonth(from.getMonth());
    if (cursor <= from) cursor.setMonth(cursor.getMonth() + 1);
  }
  return cursor.toISOString().slice(0, 10);
}

export function buildSubscriptionRunway(
  subscriptions: SubscriptionInput[],
  today: Date = new Date()
): SubscriptionRunwayResult {
  const items: SubscriptionRunwayItem[] = subscriptions.map((s) => {
    const interval = s.interval || "monthly";
    const monthlyEquivalent = toMonthly(s.amount, interval);
    const yearlyCost = monthlyEquivalent * 12;
    return {
      id: s.id,
      label: s.notes || "Subscription",
      category: s.category ?? null,
      amount: s.amount,
      interval,
      monthlyEquivalent,
      yearlyCost,
      nextRenewal: nextRenewalDate(s.date, interval, today),
      cancelSavesPerYear: yearlyCost,
    };
  });

  items.sort((a, b) => b.yearlyCost - a.yearlyCost);

  return {
    items,
    monthlyTotal: items.reduce((s, i) => s + i.monthlyEquivalent, 0),
    yearlyTotal: items.reduce((s, i) => s + i.yearlyCost, 0),
    count: items.length,
    topByYearly: items.slice(0, 5),
  };
}
