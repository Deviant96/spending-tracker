// /app/api/reports/grouped/route.ts
//
// This endpoint powers analytics/reporting groupings.
//
// Key change:
// - Supports `mode=purchase|payment`.
//   - purchase (accrual): group original purchases from `transactions` by `transactions.date`.
//   - payment (cashflow): group actual monthly obligations:
//       - normal `transactions` EXCLUDING financed/converted purchases
//       - PLUS `installment_schedule` rows for the month
//   This prevents double counting when a purchase is converted into an installment plan.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Mode = "purchase" | "payment";
type GroupBy = "month" | "year" | "category" | "method";

function parseMode(value: string | null): Mode {
  return value === "payment" ? "payment" : "purchase";
}

function parseGroupBy(value: string | null): GroupBy {
  if (value === "year" || value === "category" || value === "method") return value;
  return "month";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const mode = parseMode(searchParams.get("mode"));
    const groupBy = parseGroupBy(searchParams.get("groupBy"));

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const category = searchParams.get("category"); // supports category name
    const method = searchParams.get("method"); // supports method name

    // Group expressions
    const txGroupExpr =
      groupBy === "year"
        ? "YEAR(t.date)"
        : groupBy === "month"
          ? "DATE_FORMAT(t.date, '%Y-%m')"
          : groupBy === "category"
            ? "c.name"
            : "m.name";

    const schedGroupExpr =
      groupBy === "year"
        ? "YEAR(s.due_month)"
        : groupBy === "month"
          ? "DATE_FORMAT(s.due_month, '%Y-%m')"
          : groupBy === "category"
            ? "c.name"
            : "m.name";

    // Shared filters
    // Note: category/method filters are by name to match current UI usage.
    const txWhere: string[] = ["1=1"];
    const txParams: any[] = [];

    if (startDate) {
      txWhere.push("t.date >= ?");
      txParams.push(startDate);
    }
    if (endDate) {
      txWhere.push("t.date <= ?");
      txParams.push(endDate);
    }
    if (category && category !== "all") {
      txWhere.push("c.name = ?");
      txParams.push(category);
    }
    if (method && method !== "all") {
      txWhere.push("m.name = ?");
      txParams.push(method);
    }

    // Exclude financed/converted purchases from cashflow.
    // We treat a purchase as financed if it has an installment plan that is active/completed.
    // This is intentionally plan-based (additive) and doesn't require adding a new column to `transactions`.
    // If you later add `transactions.financing_status`, you can tighten the predicate in migration notes.
    const excludeFinancedPredicate = `NOT EXISTS (
      SELECT 1
      FROM installment_plans ip
      WHERE ip.transaction_id = t.id
        AND ip.status IN ('active', 'completed')
    )`;

    // Base transaction query
    const txQuery = `
      SELECT ${txGroupExpr} AS period,
             SUM(t.amount) AS total,
             COUNT(*) AS count
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN payment_methods m ON t.method_id = m.id
      WHERE ${txWhere.join(" AND ")}
      ${mode === "payment" ? `AND ${excludeFinancedPredicate}` : ""}
      GROUP BY ${txGroupExpr}
    `;

    if (mode === "purchase") {
      const finalTxQuery = `${txQuery} ORDER BY period`;
      const [rows] = await db.query(finalTxQuery, txParams);
      return NextResponse.json(rows);
    }

    // Payment mode: union transactions (non-financed) + installment schedule obligations.
    // Schedule amount is principal+interest+fee.
    const schedWhere: string[] = ["1=1"];
    const schedParams: any[] = [];

    if (startDate) {
      schedWhere.push("s.due_month >= ?");
      schedParams.push(startDate);
    }
    if (endDate) {
      schedWhere.push("s.due_month <= ?");
      schedParams.push(endDate);
    }
    if (category && category !== "all") {
      schedWhere.push("c.name = ?");
      schedParams.push(category);
    }
    if (method && method !== "all") {
      schedWhere.push("m.name = ?");
      schedParams.push(method);
    }

    // Include both due and paid rows in cashflow analytics.
    // (If you want “forecast only”, filter to status='due'.)
    schedWhere.push("s.status IN ('due', 'paid')");
    schedWhere.push("ip.status IN ('active', 'completed')");

    const schedQuery = `
      SELECT ${schedGroupExpr} AS period,
             SUM(s.amount_principal + s.amount_interest + s.amount_fee) AS total,
             COUNT(*) AS count
      FROM installment_schedule s
      INNER JOIN installment_plans ip ON s.plan_id = ip.plan_id
      INNER JOIN transactions t ON ip.transaction_id = t.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN payment_methods m ON t.method_id = m.id
      WHERE ${schedWhere.join(" AND ")}
      GROUP BY ${schedGroupExpr}
    `;

    // Final aggregation to merge months/categories that appear in either side.
    const unionQuery = `
      SELECT period,
             SUM(total) AS total,
             SUM(count) AS count
      FROM (
        ${txQuery}
        UNION ALL
        ${schedQuery}
      ) x
      GROUP BY period
      ORDER BY period
    `;

    const [rows] = await db.query(unionQuery, [...txParams, ...schedParams]);
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 });
  }
}
