import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Unified ledger endpoint.
//
// `mode=purchase` (accrual): returns original purchases from `transactions`.
// `mode=payment`  (cashflow): returns actual month payments:
//   - normal transactions excluding financed/converted purchases
//   - PLUS installment_schedule rows (principal+interest+fee)
//
// This keeps UI tables intact while switching the underlying cashflow math.

type Mode = "purchase" | "payment";

function parseMode(value: string | null): Mode {
  return value === "purchase" ? "purchase" : "payment";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const mode = parseMode(searchParams.get("mode"));
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const category = searchParams.get("category"); // category name
    const method = searchParams.get("method"); // method name

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

    const financedPredicate = `EXISTS (
      SELECT 1
      FROM installment_plans ip
      WHERE ip.transaction_id = t.id
        AND ip.status IN ('active', 'completed')
    )`;

    // Purchases
    const txQuery = `
      SELECT
        t.id AS id,
        t.date AS date,
        t.amount AS amount,
        t.notes AS notes,
        t.is_subscription AS is_subscription,
        t.subscription_interval AS subscription_interval,
        t.installment_total AS installment_total,
        t.installment_current AS installment_current,
        c.name AS category,
        m.name AS method,
        'transaction' AS source
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN payment_methods m ON t.method_id = m.id
      WHERE ${txWhere.join(" AND ")}
      ${mode === "payment" ? `AND NOT (${financedPredicate})` : ""}
    `;

    if (mode === "purchase") {
      const [rows] = await db.query(`${txQuery} ORDER BY date DESC`, txParams);
      return NextResponse.json({ success: true, data: rows });
    }

    // Installment payments
    const schedWhere: string[] = [
      "1=1",
      "s.status IN ('due','paid')",
      "ip.status IN ('active','completed')",
    ];
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

    // `id` is made unique and string-like for the UI table.
    const schedQuery = `
      SELECT
        CONCAT('sched_', s.schedule_id) AS id,
        s.due_month AS date,
        (s.amount_principal + s.amount_interest + s.amount_fee) AS amount,
        CONCAT('Installment payment (plan ', s.plan_id, ')') AS notes,
        t.is_subscription AS is_subscription,
        t.subscription_interval AS subscription_interval,
        NULL AS installment_total,
        NULL AS installment_current,
        c.name AS category,
        m.name AS method,
        'installment_schedule' AS source
      FROM installment_schedule s
      INNER JOIN installment_plans ip ON s.plan_id = ip.plan_id
      INNER JOIN transactions t ON ip.transaction_id = t.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN payment_methods m ON t.method_id = m.id
      WHERE ${schedWhere.join(" AND ")}
    `;

    const union = `
      (${txQuery})
      UNION ALL
      (${schedQuery})
      ORDER BY date DESC
    `;

    const [rows] = await db.query(union, [...txParams, ...schedParams]);
    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, error: "Failed to fetch ledger" }, { status: 500 });
  }
}
