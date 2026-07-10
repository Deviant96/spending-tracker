import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getInstallmentPlanIdColumn, resolveInstallmentScheduleStatusForDb } from "@/lib/db-schema";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "monthly";
    const mode = searchParams.get("mode") || "accrual";
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const category = searchParams.get("category");
    const method = searchParams.get("method");

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
    const params: (string | number)[] = [];

    if (mode === "cashflow" && period === "monthly") {
      const pendingScheduleStatus = (await resolveInstallmentScheduleStatusForDb(db, "pending")) || "pending";
      const paidScheduleStatus = (await resolveInstallmentScheduleStatusForDb(db, "paid")) || "paid";
      const planIdColumn = await getInstallmentPlanIdColumn(db);

      const txWhere = ["t.financing_status != 'converted'"];
      const schWhere = ["s.status IN (?, ?)"];
      const txParams: (string | number)[] = [];
      const schParams: (string | number)[] = [pendingScheduleStatus, paidScheduleStatus];

      if (start && end) {
        txWhere.push("t.date BETWEEN ? AND ?");
        txParams.push(start, end);

        schWhere.push("LEFT(CAST(s.due_month AS CHAR), 7) BETWEEN DATE_FORMAT(?, '%Y-%m') AND DATE_FORMAT(?, '%Y-%m')");
        schParams.push(start, end);
      }

      if (category) {
        txWhere.push("t.category_id = ?");
        txParams.push(category);
        schWhere.push("t.category_id = ?");
        schParams.push(category);
      }

      if (method) {
        txWhere.push("t.method_id = ?");
        txParams.push(method);
        schWhere.push("t.method_id = ?");
        schParams.push(method);
      }

      sql = `
        SELECT period, SUM(total_expense) as total_expense, SUM(transaction_count) as transaction_count 
        FROM (
          SELECT 
            DATE_FORMAT(t.date, '%Y-%m') as period, 
            SUM(t.amount) as total_expense,
            COUNT(*) as transaction_count
          FROM transactions t
          WHERE ${txWhere.join(" AND ")}
          GROUP BY period

          UNION ALL

          SELECT 
            LEFT(CAST(s.due_month AS CHAR), 7) as period,
            SUM(s.amount_principal + s.amount_interest + IFNULL(s.amount_fee, 0)) as total_expense,
            COUNT(*) as transaction_count
          FROM installment_schedule s
          INNER JOIN installment_plans p ON s.plan_id = p.${planIdColumn}
          INNER JOIN transactions t ON p.transaction_id = t.id
          WHERE ${schWhere.join(" AND ")}
          GROUP BY period
        ) as combined
        GROUP BY period
        ORDER BY period ASC
      `;

      params.push(...txParams, ...schParams);
    } else {
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
