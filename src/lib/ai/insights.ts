import type { Anomaly } from "@/lib/calc/anomalies";
import type { BudgetProjectionResult } from "@/lib/calc/budget";
import type { CashflowCalendarResult } from "@/lib/calc/cashflow";
import type { ReconciliationResult } from "@/lib/calc/reconcile";
import type { SubscriptionRunwayResult } from "@/lib/calc/subscription";

export type InsightFacts = {
  monthLabel: string;
  spentThisMonth: number;
  spentLastMonth: number;
  topCategory?: { name: string; amount: number } | null;
  cashflow?: CashflowCalendarResult | null;
  reconciliation?: ReconciliationResult | null;
  budgets?: BudgetProjectionResult | null;
  subscriptions?: SubscriptionRunwayResult | null;
  anomalies?: Anomaly[];
};

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * Deterministic insights coach — always grounded on calculated facts.
 * When OPENAI_API_KEY exists, we optionally polish via LLM but still cite numbers.
 */
export function buildDeterministicInsights(facts: InsightFacts): string[] {
  const lines: string[] = [];
  const change = pctChange(facts.spentThisMonth, facts.spentLastMonth);

  lines.push(
    `You spent ${fmt(facts.spentThisMonth)} in ${facts.monthLabel}.`
  );

  if (change != null) {
    lines.push(
      change < 0
        ? `Good news: spending is down ${Math.abs(change)}% vs last month (${fmt(facts.spentLastMonth)}).`
        : `Spending increased ${change}% vs last month (${fmt(facts.spentLastMonth)}).`
    );
  }

  if (facts.topCategory) {
    lines.push(
      `Biggest category: ${facts.topCategory.name} at ${fmt(facts.topCategory.amount)}.`
    );
  }

  if (facts.cashflow?.tightMonths?.length) {
    lines.push(
      `Cashflow watch: ${facts.cashflow.tightMonths.join(", ")} look tight` +
        (facts.cashflow.peakMonth
          ? ` (peak ${facts.cashflow.peakMonth} ≈ ${fmt(facts.cashflow.peakAmount)}).`
          : ".")
    );
  }

  if (facts.reconciliation && Math.abs(facts.reconciliation.totals.gap) > 0) {
    lines.push(facts.reconciliation.summary);
  }

  if (facts.budgets) {
    const overs = facts.budgets.rows.filter((r) => r.status === "over");
    if (overs.length) {
      lines.push(
        `Budget alert: ${overs.map((o) => o.categoryName).join(", ")} already over target this month.`
      );
    } else {
      lines.push(
        `Budgets on track so far — ${fmt(facts.budgets.totals.spent)} of ${fmt(facts.budgets.totals.budget)} used; projected month-end ${fmt(facts.budgets.totals.projectedMonthEnd)}.`
      );
    }
  }

  if (facts.subscriptions && facts.subscriptions.count > 0) {
    lines.push(
      `Subscriptions: ${facts.subscriptions.count} active ≈ ${fmt(facts.subscriptions.monthlyTotal)}/mo (${fmt(facts.subscriptions.yearlyTotal)}/yr).`
    );
    const top = facts.subscriptions.topByYearly[0];
    if (top) {
      lines.push(
        `Canceling "${top.label}" would save ~${fmt(top.cancelSavesPerYear)}/year.`
      );
    }
  }

  for (const a of (facts.anomalies || []).slice(0, 3)) {
    lines.push(`${a.severity === "high" ? "⚠" : "•"} ${a.title}: ${a.detail}`);
  }

  return lines;
}

export async function polishInsightsWithLlm(
  facts: InsightFacts,
  deterministic: string[]
): Promise<{ source: "deterministic" | "llm"; insights: string[] }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { source: "deterministic", insights: deterministic };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You are a personal finance coach. Rewrite the provided numbered facts into 4-7 concise, actionable insight bullets. Do NOT invent numbers — only use figures present in the facts. Keep currency amounts as given. Return plain text bullets, one per line, no markdown headings.",
          },
          {
            role: "user",
            content: deterministic.map((l, i) => `${i + 1}. ${l}`).join("\n"),
          },
        ],
      }),
    });

    if (!res.ok) {
      return { source: "deterministic", insights: deterministic };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return { source: "deterministic", insights: deterministic };

    const insights = content
      .split("\n")
      .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
      .filter(Boolean);

    return {
      source: insights.length ? "llm" : "deterministic",
      insights: insights.length ? insights : deterministic,
    };
  } catch {
    return { source: "deterministic", insights: deterministic };
  }
}

export type AskIntent =
  | { type: "spend_period"; mode: "accrual" | "cashflow"; start?: string; end?: string; category?: string }
  | { type: "top_category"; start?: string; end?: string }
  | { type: "subscriptions" }
  | { type: "upcoming_dues"; months?: number }
  | { type: "budget_status" }
  | { type: "anomalies" }
  | { type: "unknown"; raw: string };

export function parseSpendQuestion(question: string): AskIntent {
  const q = question.toLowerCase().trim();

  if (/subscri|langganan/.test(q)) return { type: "subscriptions" };
  if (/budget/.test(q)) return { type: "budget_status" };
  if (/anomal|unusual|spike|duplicate|missed/.test(q)) return { type: "anomalies" };
  if (/upcoming|due|obligation|calendar|cashflow next/.test(q)) {
    return { type: "upcoming_dues", months: 3 };
  }
  if (/biggest|top category|most (spent|expensive)/.test(q)) {
    return { type: "top_category", ...extractRange(q) };
  }
  if (/spend|spent|how much|berapa|pengeluaran/.test(q)) {
    const mode = /cashflow|cash flow|bayar|paid/.test(q) ? "cashflow" : "accrual";
    const category = extractCategory(q);
    return { type: "spend_period", mode, category, ...extractRange(q) };
  }

  return { type: "unknown", raw: question };
}

function extractRange(q: string): { start?: string; end?: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (/this month|bulan ini/.test(q)) {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return { start: iso(start), end: iso(end) };
  }
  if (/last month|bulan lalu/.test(q)) {
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return { start: iso(start), end: iso(end) };
  }
  if (/this year|tahun ini/.test(q)) {
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }
  if (/last quarter|quarter/.test(q)) {
    const qStartMonth = Math.floor(m / 3) * 3 - 3;
    const start = new Date(y, qStartMonth, 1);
    const end = new Date(y, qStartMonth + 3, 0);
    return { start: iso(start), end: iso(end) };
  }

  return {};
}

function extractCategory(q: string): string | undefined {
  const known = ["food", "transport", "shopping", "entertainment", "utilities", "health", "housing", "education", "electronics"];
  for (const c of known) {
    if (q.includes(c)) return c.charAt(0).toUpperCase() + c.slice(1);
  }
  const onMatch = q.match(/on ([a-zA-Z]+)/);
  if (onMatch) return onMatch[1].charAt(0).toUpperCase() + onMatch[1].slice(1);
  return undefined;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmt(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

export async function answerWithOptionalLlm(
  question: string,
  groundedAnswer: string,
  facts: Record<string, unknown>
): Promise<{ answer: string; source: "deterministic" | "llm" }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { answer: groundedAnswer, source: "deterministic" };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Answer the user's finance question using ONLY the provided grounded answer and facts. Do not invent numbers. Keep it concise.",
          },
          {
            role: "user",
            content: `Question: ${question}\nGrounded answer: ${groundedAnswer}\nFacts JSON: ${JSON.stringify(facts)}`,
          },
        ],
      }),
    });
    if (!res.ok) return { answer: groundedAnswer, source: "deterministic" };
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content
      ? { answer: content, source: "llm" }
      : { answer: groundedAnswer, source: "deterministic" };
  } catch {
    return { answer: groundedAnswer, source: "deterministic" };
  }
}
