import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getInstallmentPlanIdColumn } from "@/lib/db-schema";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const groupBy = searchParams.get("groupBy") || "month";
    const mode = searchParams.get("mode") || "accrual";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const category = searchParams.get("category");
    const method = searchParams.get("method");

    if (mode === "cashflow" && groupBy === "category") {
      const planIdColumn = await getInstallmentPlanIdColumn(db);
      const txParams: (string | number)[] = [];
      const schParams: (string | number)[] = [];

      let txDateFilter = "";
      let schDateFilter = "";

      if (startDate) {
        txDateFilter += " AND t.date >= ?";
        txParams.push(startDate);
        schDateFilter += " AND s.due_month >= DATE_FORMAT(?, '%Y-%m')";
        schParams.push(startDate);
      }
      if (endDate) {
        txDateFilter += " AND t.date <= ?";
        txParams.push(endDate);
        schDateFilter += " AND s.due_month <= DATE_FORMAT(?, '%Y-%m')";
        schParams.push(endDate);
      }

      const sql = `
        SELECT category_name as period, SUM(amount) as total, COUNT(*) as count 
        FROM (
          SELECT 
            c.name as category_name,
            t.amount as amount
          FROM transactions t
          JOIN categories c ON t.category_id = c.id
          WHERE t.financing_status != 'converted'
          ${txDateFilter}
            
          UNION ALL
            
          SELECT 
            c.name as category_name,
            (s.amount_principal + s.amount_interest + IFNULL(s.amount_fee, 0)) as amount
          FROM installment_schedule s
          JOIN installment_plans p ON s.plan_id = p.${planIdColumn}
          JOIN transactions t ON p.transaction_id = t.id
          JOIN categories c ON t.category_id = c.id
          WHERE s.status IN ('pending', 'paid')
          ${schDateFilter}
        ) as combined
        GROUP BY category_name
        ORDER BY total DESC
      `;

      const params = [...txParams, ...schParams];
      const [rows] = await db.query(sql, params);
      return NextResponse.json(rows);
    }

    if (mode === "cashflow" && groupBy === "method") {
      const planIdColumn = await getInstallmentPlanIdColumn(db);
      const txParams: (string | number)[] = [];
      const schParams: (string | number)[] = [];

      let txDateFilter = "";
      let schDateFilter = "";

      if (startDate) {
        txDateFilter += " AND t.date >= ?";
        txParams.push(startDate);
        schDateFilter += " AND s.due_month >= DATE_FORMAT(?, '%Y-%m')";
        schParams.push(startDate);
      }
      if (endDate) {
        txDateFilter += " AND t.date <= ?";
        txParams.push(endDate);
        schDateFilter += " AND s.due_month <= DATE_FORMAT(?, '%Y-%m')";
        schParams.push(endDate);
      }

      const sql = `
        SELECT method_name as period, SUM(amount) as total, COUNT(*) as count 
        FROM (
          SELECT 
            m.name as method_name,
            t.amount as amount
          FROM transactions t
          JOIN payment_methods m ON t.method_id = m.id
          WHERE t.financing_status != 'converted'
          ${txDateFilter}
            
          UNION ALL
            
          SELECT 
            m.name as method_name,
            (s.amount_principal + s.amount_interest + IFNULL(s.amount_fee, 0)) as amount
          FROM installment_schedule s
          JOIN installment_plans p ON s.plan_id = p.${planIdColumn}
          JOIN transactions t ON p.transaction_id = t.id
          JOIN payment_methods m ON t.method_id = m.id
          WHERE s.status IN ('pending', 'paid')
          ${schDateFilter}
        ) as combined
        GROUP BY method_name
        ORDER BY total DESC
      `;

      const params = [...txParams, ...schParams];
      const [rows] = await db.query(sql, params);
      return NextResponse.json(rows);
    }

    let groupField = "";
    switch (groupBy) {
      case "year":
        groupField = "YEAR(t.date)";
        break;
      case "category":
        groupField = "c.name";
        break;
      case "method":
        groupField = "m.name";
        break;
      case "month":
      default:
        groupField = "DATE_FORMAT(t.date, '%Y-%m')";
    }

    let query = `
      SELECT ${groupField} as period, 
             SUM(t.amount) as total, 
             COUNT(*) as count
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN payment_methods m ON t.method_id = m.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (startDate) {
      query += " AND t.date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      query += " AND t.date <= ?";
      params.push(endDate);
    }
    if (category) {
      query += " AND c.name = ?";
      params.push(category);
    }
    if (method) {
      query += " AND m.name = ?";
      params.push(method);
    }

    query += ` GROUP BY ${groupField} ORDER BY ${groupField}`;

    const [rows] = await db.query(query, params);

    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to fetch report" },
      { status: 500 }
    );
  }
}
