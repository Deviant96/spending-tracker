// app/api/reports/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type CanonicalScheduleStatus = "pending" | "paid" | "overdue";

function parseEnumValues(columnType: string): string[] {
  const match = columnType.match(/^enum\((.*)\)$/i);
  if (!match) return [];

  return match[1]
    .split(",")
    .map((raw) => raw.trim().replace(/^'/, "").replace(/'$/, ""));
}

function mapScheduleStatusToSupportedValue(
  desiredStatus: CanonicalScheduleStatus,
  supportedValues: string[]
): string | null {
  const byPreference: Record<CanonicalScheduleStatus, string[]> = {
    pending: ["pending", "unpaid", "due", "open", "waiting"],
    paid: ["paid", "settled", "done", "lunas"],
    overdue: ["overdue", "late", "past_due"],
  };

  const normalizedMap = new Map(supportedValues.map((value) => [value.toLowerCase(), value]));
  for (const candidate of byPreference[desiredStatus]) {
    const found = normalizedMap.get(candidate.toLowerCase());
    if (found) return found;
  }

  return null;
}

async function resolveInstallmentScheduleStatusForDb(
  desiredStatus: CanonicalScheduleStatus
): Promise<string | null> {
  const [rows] = await db.query("SHOW COLUMNS FROM installment_schedule LIKE 'status'");
  const column = Array.isArray(rows) && rows.length > 0 ? (rows[0] as { Type?: string }) : null;

  if (!column?.Type) {
    return null;
  }

  const supportedValues = parseEnumValues(column.Type);
  if (supportedValues.length === 0) {
    return null;
  }

  return mapScheduleStatusToSupportedValue(desiredStatus, supportedValues);
}

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
      const pendingScheduleStatus = (await resolveInstallmentScheduleStatusForDb("pending")) || "pending";
      const paidScheduleStatus = (await resolveInstallmentScheduleStatusForDb("paid")) || "paid";
      
      const txWhere = ["t.financing_status != 'converted'"]; // Exclude converted transactions
      const schWhere = ["s.status IN (?, ?)"]; // Include pending and paid installments
      const txParams: any[] = [];
      const schParams: any[] = [pendingScheduleStatus, paidScheduleStatus];

      if (start && end) {
        txWhere.push("t.date BETWEEN ? AND ?");
        txParams.push(start, end);
        
        schWhere.push("LEFT(CAST(s.due_month AS CHAR), 7) BETWEEN DATE_FORMAT(?, '%Y-%m') AND DATE_FORMAT(?, '%Y-%m')");
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
            LEFT(CAST(s.due_month AS CHAR), 7) as period,
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
