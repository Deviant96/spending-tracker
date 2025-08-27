// app/api/reports/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "monthly"; // monthly | yearly
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

    // Base query
    let sql = `
      SELECT 
        ${selectPart},
        SUM(amount) AS total_expense,
        COUNT(*) AS transaction_count
      FROM transactions
      WHERE 1=1
    `;

    const params: any[] = [];

    if (start && end) {
      sql += " AND date BETWEEN ? AND ?";
      params.push(start, end);
    }

    if (category) {
      sql += " AND category = ?";
      params.push(category);
    }

    if (method) {
      sql += " AND method = ?";
      params.push(method);
    }

    sql += ` GROUP BY ${groupPart} ORDER BY ${groupPart} ASC`;

    const [rows] = await db.query(sql, params);

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 });
  }
}
