// app/api/reports/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "monthly"; // monthly | yearly
    const mode = searchParams.get("mode") || "accrual"; // accrual | cashflow
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

    let sql = "";
    const params: any[] = [];

    if (mode === "cashflow" && period === "monthly") {
      // CASHFLOW VIEW: Exclude converted transactions, include installment schedule payments
      // This represents actual monthly cash outflows
      
      const txWhere = ["t.financing_status != 'converted'"]; // Exclude converted transactions
      const schWhere = ["s.status IN ('pending', 'paid')"]; // Include pending and paid installments
      const txParams: any[] = [];
      const schParams: any[] = [];

      if (start && end) {
        txWhere.push("t.date BETWEEN ? AND ?");
        txParams.push(start, end);
        
        schWhere.push("s.due_month BETWEEN DATE_FORMAT(?, '%Y-%m') AND DATE_FORMAT(?, '%Y-%m')");
        schParams.push(start, end);
      }

      if (category) {
        txWhere.push("t.category_id = ?");
        txParams.push(category);
        // For installment schedule, join back to transaction to filter by category
        schWhere.push("t.category_id = ?");
        schParams.push(category);
      }

      if (method) {
        txWhere.push("t.method_id = ?");
        txParams.push(method);
        // For installment schedule, join back to transaction to filter by method
        schWhere.push("t.method_id = ?");
        schParams.push(method);
      }

      sql = `
        SELECT period, SUM(total_expense) as total_expense, SUM(transaction_count) as transaction_count 
        FROM (
          -- Part 1: Non-converted transactions (one_time and subscription)
          SELECT 
            DATE_FORMAT(t.date, '%Y-%m') as period, 
            SUM(t.amount) as total_expense,
            COUNT(*) as transaction_count
          FROM transactions t
          WHERE ${txWhere.join(" AND ")}
          GROUP BY period

          UNION ALL

          -- Part 2: Installment schedule payments (monthly obligations)
          SELECT 
            s.due_month as period,
            SUM(s.amount_principal + s.amount_interest + IFNULL(s.amount_fee, 0)) as total_expense,
            COUNT(*) as transaction_count
          FROM installment_schedule s
          INNER JOIN installment_plans p ON s.plan_id = p.id
          INNER JOIN transactions t ON p.transaction_id = t.id
          WHERE ${schWhere.join(" AND ")}
          GROUP BY period
        ) as combined
        GROUP BY period
        ORDER BY period ASC
      `;
      
      params.push(...txParams, ...schParams);

    } else {
      // ACCRUAL VIEW: Show all transactions at purchase date (original logic)
      // This represents when purchases were made, regardless of payment method
      sql = `
        SELECT 
          ${selectPart},
          SUM(amount) AS total_expense,
          COUNT(*) AS transaction_count
        FROM transactions t
        WHERE 1=1
      `;

      if (start && end) {
        sql += " AND t.date BETWEEN ? AND ?";
        params.push(start, end);
      }

      if (category) {
        sql += " AND t.category_id = ?";
        params.push(category);
      }

      if (method) {
        sql += " AND t.method_id = ?";
        params.push(method);
      }

      sql += ` GROUP BY ${groupPart} ORDER BY ${groupPart} ASC`;
    }

    const [rows] = await db.query(sql, params);

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 });
  }
}
