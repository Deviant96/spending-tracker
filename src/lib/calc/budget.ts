export type BudgetTarget = {
  categoryId: number;
  categoryName: string;
  amount: number;
  month: string; // YYYY-MM
};

export type BudgetActual = {
  categoryId: number;
  categoryName: string;
  spent: number;
};

export type BudgetVsActualRow = {
  categoryId: number;
  categoryName: string;
  budget: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  projectedMonthEnd: number;
  status: "under" | "near" | "over";
};

export type BudgetProjectionResult = {
  month: string;
  dayOfMonth: number;
  daysInMonth: number;
  rows: BudgetVsActualRow[];
  totals: {
    budget: number;
    spent: number;
    remaining: number;
    projectedMonthEnd: number;
  };
};

export function projectBudgetVsActual(
  month: string,
  budgets: BudgetTarget[],
  actuals: BudgetActual[],
  knownFutureObligationsByCategory: Record<number, number> = {},
  today: Date = new Date()
): BudgetProjectionResult {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m;
  const dayOfMonth = isCurrentMonth ? Math.min(today.getDate(), daysInMonth) : daysInMonth;

  const spentMap = new Map(actuals.map((a) => [a.categoryId, a]));
  const allCategoryIds = new Set<number>([
    ...budgets.map((b) => b.categoryId),
    ...actuals.map((a) => a.categoryId),
  ]);

  const budgetById = new Map(budgets.map((b) => [b.categoryId, b]));

  const rows: BudgetVsActualRow[] = [];
  for (const categoryId of allCategoryIds) {
    const budget = budgetById.get(categoryId);
    const actual = spentMap.get(categoryId);
    const categoryName = budget?.categoryName || actual?.categoryName || `Category ${categoryId}`;
    const budgetAmount = budget?.amount ?? 0;
    const spent = actual?.spent ?? 0;
    const remaining = budgetAmount - spent;
    const percentUsed = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 1000) / 10 : spent > 0 ? 100 : 0;

    const runRate =
      dayOfMonth > 0 ? (spent / dayOfMonth) * daysInMonth : spent;
    const knownFuture = knownFutureObligationsByCategory[categoryId] ?? 0;
    const projectedMonthEnd = Math.round(Math.max(runRate, spent + knownFuture));

    let status: BudgetVsActualRow["status"] = "under";
    if (budgetAmount > 0 && percentUsed >= 100) status = "over";
    else if (budgetAmount > 0 && percentUsed >= 80) status = "near";
    else if (budgetAmount === 0 && spent > 0) status = "near";

    rows.push({
      categoryId,
      categoryName,
      budget: budgetAmount,
      spent,
      remaining,
      percentUsed,
      projectedMonthEnd,
      status,
    });
  }

  rows.sort((a, b) => b.spent - a.spent);

  return {
    month,
    dayOfMonth,
    daysInMonth,
    rows,
    totals: {
      budget: rows.reduce((s, r) => s + r.budget, 0),
      spent: rows.reduce((s, r) => s + r.spent, 0),
      remaining: rows.reduce((s, r) => s + r.remaining, 0),
      projectedMonthEnd: rows.reduce((s, r) => s + r.projectedMonthEnd, 0),
    },
  };
}
