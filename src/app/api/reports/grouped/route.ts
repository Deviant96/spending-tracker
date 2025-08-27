// /app/api/reports/grouped/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const groupBy = searchParams.get("groupBy") || "month"; // default: month
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const category = searchParams.get("category");
    const method = searchParams.get("method");

    let groupField = "";
    switch (groupBy) {
      case "year":
        groupField = "YEAR(date)";
        break;
      case "category":
        groupField = "category";
        break;
      case "method":
        groupField = "method";
        break;
      case "month":
      default:
        groupField = "DATE_FORMAT(date, '%Y-%m')";
    }

    let query = `
      SELECT ${groupField} as period, 
             SUM(amount) as total, 
             COUNT(*) as count
      FROM transactions
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate) {
      query += " AND date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      query += " AND date <= ?";
      params.push(endDate);
    }
    if (category) {
      query += " AND category = ?";
      params.push(category);
    }
    if (method) {
      query += " AND method = ?";
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
