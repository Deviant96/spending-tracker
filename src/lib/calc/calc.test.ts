import { describe, expect, it } from "vitest";
import { calculateInstallment, approximateApr } from "@/lib/calc/installment";
import { buildCashflowCalendar, expandSubscriptions } from "@/lib/calc/cashflow";
import { reconcileAccrualCashflow } from "@/lib/calc/reconcile";
import { projectBudgetVsActual } from "@/lib/calc/budget";
import { buildSubscriptionRunway } from "@/lib/calc/subscription";
import { scenarioCutCategory, scenarioPayoffEarly, scenarioRefinance } from "@/lib/calc/scenarios";
import { detectAnomalies } from "@/lib/calc/anomalies";
import { classifyTransactionNote } from "@/lib/calc/classify";
import { parseSpendQuestion, buildDeterministicInsights } from "@/lib/ai/insights";

describe("installment calculator", () => {
  it("distributes remainder on last month and computes TCO", () => {
    const result = calculateInstallment({
      principal: 1000,
      months: 3,
      interestTotal: 50,
      feesTotal: 100,
      startDate: "2026-04-19",
    });
    expect(result.totalCost).toBe(1150);
    expect(result.schedule).toHaveLength(3);
    expect(result.schedule.map((s) => s.fee)).toEqual([33, 33, 34]);
    expect(result.schedule.map((s) => s.principal).reduce((a, b) => a + b, 0)).toBe(1000);
    expect(result.payoffMonth).toBe("2026-06");
  });

  it("returns 0 APR when no financing cost", () => {
    expect(approximateApr(1000, 4, 250)).toBe(0);
  });
});

describe("cashflow calendar", () => {
  it("marks peak and expands subscriptions", () => {
    const subs = expandSubscriptions(
      [{ id: "1", amount: 100, date: "2026-01-05", notes: "Netflix", interval: "monthly" }],
      3,
      "2026-01"
    );
    const calendar = buildCashflowCalendar(
      [
        ...subs,
        {
          id: "i1",
          kind: "installment",
          label: "Phone",
          amount: 500,
          dueMonth: "2026-02",
        },
      ],
      { horizonMonths: 3, startMonth: "2026-01" }
    );
    expect(calendar.months).toHaveLength(3);
    expect(calendar.peakMonth).toBe("2026-02");
    expect(calendar.peakAmount).toBe(600);
  });
});

describe("reconcile", () => {
  it("summarizes positive deferred gap", () => {
    const result = reconcileAccrualCashflow([
      { period: "2026-01", accrual: 1000, cashflow: 400 },
      { period: "2026-02", accrual: 200, cashflow: 400 },
    ]);
    expect(result.totals.gap).toBe(400);
    expect(result.summary).toContain("purchased more");
  });
});

describe("budget projection", () => {
  it("flags over budget", () => {
    const result = projectBudgetVsActual(
      "2026-07",
      [{ categoryId: 1, categoryName: "Food", amount: 1000, month: "2026-07" }],
      [{ categoryId: 1, categoryName: "Food", spent: 1200 }],
      {},
      new Date("2026-07-15")
    );
    expect(result.rows[0].status).toBe("over");
    expect(result.rows[0].percentUsed).toBe(120);
  });
});

describe("subscription runway", () => {
  it("annualizes weekly and monthly", () => {
    const runway = buildSubscriptionRunway(
      [
        { id: "a", amount: 100, date: "2026-01-01", interval: "monthly", notes: "A" },
        { id: "b", amount: 50, date: "2026-01-01", interval: "weekly", notes: "B" },
      ],
      new Date("2026-07-01")
    );
    expect(runway.count).toBe(2);
    expect(runway.items.find((i) => i.id === "a")?.yearlyCost).toBe(1200);
  });
});

describe("scenarios", () => {
  it("computes refinance and cut savings", () => {
    const refi = scenarioRefinance({
      principal: 12000,
      fromMonths: 12,
      toMonths: 6,
      interestTotal: 600,
      scaleInterest: true,
    });
    expect(refi.after.months).toBe(6);
    expect(refi.before.months).toBe(12);

    const cut = scenarioCutCategory({ category: "Food", currentMonthly: 2000, cutPercent: 20 });
    expect(cut.monthlySavings).toBe(400);
    expect(cut.yearlySavings).toBe(4800);

    const early = scenarioPayoffEarly({
      remainingPrincipal: 5000,
      remainingInterest: 200,
      remainingFees: 50,
      remainingMonths: 5,
    });
    expect(early.savings).toBe(250);
  });
});

describe("anomalies + classify", () => {
  it("detects spikes and classifies notes", () => {
    const anomalies = detectAnomalies([
      { id: "1", date: "2026-07-01", amount: 100, category: "Food" },
      { id: "2", date: "2026-07-02", amount: 110, category: "Food" },
      { id: "3", date: "2026-07-03", amount: 90, category: "Food" },
      { id: "4", date: "2026-07-04", amount: 95, category: "Food" },
      { id: "5", date: "2026-07-05", amount: 105, category: "Food" },
      { id: "6", date: "2026-07-06", amount: 100, category: "Food" },
      { id: "7", date: "2026-07-07", amount: 50000, category: "Electronics", notes: "Laptop" },
    ]);
    expect(anomalies.some((a) => a.type === "spike")).toBe(true);

    const classified = classifyTransactionNote({
      notes: "Netflix langganan bulanan",
      amount: 50000,
      existingCategories: [{ id: 9, name: "Entertainment" }],
    });
    expect(classified.isLikelySubscription).toBe(true);
    expect(classified.category?.categoryName).toBe("Entertainment");
  });
});

describe("AI intent parsing", () => {
  it("parses spend and subscription questions", () => {
    expect(parseSpendQuestion("How much did I spend this month in cashflow mode?").type).toBe(
      "spend_period"
    );
    expect(parseSpendQuestion("Show my subscriptions").type).toBe("subscriptions");
    const insights = buildDeterministicInsights({
      monthLabel: "2026-07",
      spentThisMonth: 1000,
      spentLastMonth: 800,
      topCategory: { name: "Food", amount: 400 },
    });
    expect(insights[0]).toContain("2026-07");
  });
});
