// /app/api/reports/grouped/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const groupBy = searchParams.get("groupBy") || "month"; // default: month
    const mode = searchParams.get("mode") || "accrual"; // accrual | cashflow
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const category = searchParams.get("category");
    const method = searchParams.get("method");

    // CASHFLOW MODE: Exclude converted transactions, include installment payments
    if (mode === "cashflow" && groupBy === "category") {
      const txParams: any[] = [];
      const schParams: any[] = [];
      
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

      let sql = `
        SELECT category_name as period, SUM(amount) as total, COUNT(*) as count 
        FROM (
          -- Part 1: Non-converted transactions
          SELECT 
            c.name as category_name,
            t.amount as amount
          FROM transactions t
          JOIN categories c ON t.category_id = c.id
          WHERE t.financing_status != 'converted'
          ${txDateFilter}
            
          UNION ALL
            
          -- Part 2: Installment schedule payments
          SELECT 
            c.name as category_name,
            (s.amount_principal + s.amount_interest + IFNULL(s.amount_fee, 0)) as amount
          FROM installment_schedule s
          JOIN installment_plans p ON s.plan_id = p.plan_id
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

    // CASHFLOW MODE: Group by method
    if (mode === "cashflow" && groupBy === "method") {
      const txParams: any[] = [];
      const schParams: any[] = [];
      
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

      let sql = `
        SELECT method_name as period, SUM(amount) as total, COUNT(*) as count 
        FROM (
          -- Part 1: Non-converted transactions
          SELECT 
            m.name as method_name,
            t.amount as amount
          FROM transactions t
          JOIN payment_methods m ON t.method_id = m.id
          WHERE t.financing_status != 'converted'
          ${txDateFilter}
            
          UNION ALL
            
          -- Part 2: Installment schedule payments
          SELECT 
            m.name as method_name,
            (s.amount_principal + s.amount_interest + IFNULL(s.amount_fee, 0)) as amount
          FROM installment_schedule s
          JOIN installment_plans p ON s.plan_id = p.plan_id
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

    // ACCRUAL MODE or other groupings: Use original logic
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
    const params: any[] = [];

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
