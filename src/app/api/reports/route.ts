// app/api/reports/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Mode = "purchase" | "payment";

function parseMode(value: string | null): Mode {
  return value === "payment" ? "payment" : "purchase";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "monthly"; // monthly | yearly
    const mode = parseMode(searchParams.get("mode"));
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const category = searchParams.get("category");
    const method = searchParams.get("method");

    // Determine grouping
    let selectPart = "";
    let groupPart = "";

    if (period === "monthly") {
      selectPart = "DATE_FORMAT(date, '%Y-%m') AS period";
      groupPart = "DATE_FORMAT(date, '%Y-%m')";
    } else if (period === "yearly") {
      selectPart = "YEAR(date) AS period";
      groupPart = "YEAR(date)";
    } else {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    // NOTE:
    // This endpoint is retained for backward-compatibility.
    // Prefer using `/api/reports/grouped` for new analytics (it supports category/method grouping too).

    const txWhere: string[] = ["1=1"];
    const txParams: any[] = [];

    if (start && end) {
      txWhere.push("t.date BETWEEN ? AND ?");
      txParams.push(start, end);
    }

    // Filter by category/method name (matches UI behavior)
    if (category && category !== "all") {
      txWhere.push("c.name = ?");
      txParams.push(category);
    }
    if (method && method !== "all") {
      txWhere.push("m.name = ?");
      txParams.push(method);
    }

    const excludeFinancedPredicate = `NOT EXISTS (
      SELECT 1
      FROM installment_plans ip
      WHERE ip.transaction_id = t.id
        AND ip.status IN ('active', 'completed')
    )`;

    const baseTxQuery = `
      SELECT
        ${selectPart},
        SUM(t.amount) AS total_expense,
        COUNT(*) AS transaction_count
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN payment_methods m ON t.method_id = m.id
      WHERE ${txWhere.join(" AND ")}
      ${mode === "payment" ? `AND ${excludeFinancedPredicate}` : ""}
      GROUP BY ${groupPart}
    `;

    if (mode === "purchase") {
      const [rows] = await db.query(`${baseTxQuery} ORDER BY ${groupPart} ASC`, txParams);
      return NextResponse.json({ success: true, data: rows });
    }

    // Payment mode: union with schedule obligations
    const schedWhere: string[] = ["1=1", "s.status IN ('due','paid')", "ip.status IN ('active','completed')"];
    const schedParams: any[] = [];

    if (start && end) {
      schedWhere.push("s.due_month BETWEEN ? AND ?");
      schedParams.push(start, end);
    }
    if (category && category !== "all") {
      schedWhere.push("c.name = ?");
      schedParams.push(category);
    }
    if (method && method !== "all") {
      schedWhere.push("m.name = ?");
      schedParams.push(method);
    }

    const schedSelectPart =
      period === "monthly"
        ? "DATE_FORMAT(s.due_month, '%Y-%m') AS period"
        : "YEAR(s.due_month) AS period";
    const schedGroupPart =
      period === "monthly" ? "DATE_FORMAT(s.due_month, '%Y-%m')" : "YEAR(s.due_month)";

    const schedQuery = `
      SELECT
        ${schedSelectPart},
        SUM(s.amount_principal + s.amount_interest + s.amount_fee) AS total_expense,
        COUNT(*) AS transaction_count
      FROM installment_schedule s
      INNER JOIN installment_plans ip ON s.plan_id = ip.plan_id
      INNER JOIN transactions t ON ip.transaction_id = t.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN payment_methods m ON t.method_id = m.id
      WHERE ${schedWhere.join(" AND ")}
      GROUP BY ${schedGroupPart}
    `;

    const unionQuery = `
      SELECT period,
             SUM(total_expense) AS total_expense,
             SUM(transaction_count) AS transaction_count
      FROM (
        ${baseTxQuery}
        UNION ALL
        ${schedQuery}
      ) x
      GROUP BY period
      ORDER BY period ASC
    `;

    const [rows] = await db.query(unionQuery, [...txParams, ...schedParams]);
    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 });
  }
}
