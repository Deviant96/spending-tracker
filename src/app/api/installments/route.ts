import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { asResultHeader, asRows } from "@/lib/mysql-types";
import {
  getInstallmentPlanIdColumn,
  resolveInstallmentScheduleStatusForDb,
  resolveInstallmentStartMonthForDb,
  isInstallmentDueMonthDateLike,
} from "@/lib/db-schema";
import { generateInstallmentScheduleValues, insertInstallmentSchedule } from "@/lib/installments";

/**
 * GET /api/installments
 * Fetch all installment plans with their schedules
 */
export async function GET(req: NextRequest) {
  try {
    const connection = await db.getConnection();
    const planIdColumn = await getInstallmentPlanIdColumn(connection);
    const paidScheduleStatus = (await resolveInstallmentScheduleStatusForDb(connection, "paid")) || "paid";
    connection.release();

    const { searchParams } = new URL(req.url);
    const transactionId = searchParams.get("transactionId");
    const status = searchParams.get("status");

    let query = `
      SELECT 
        p.${planIdColumn} as plan_id,
        p.transaction_id,
        p.principal,
        p.months,
        p.interest_total,
        p.fees_total,
        p.start_month,
        p.status,
        p.created_at,
        t.date as transaction_date,
        t.amount as transaction_amount,
        c.name as category,
        m.name as method,
        COUNT(s.schedule_id) as total_installments,
        SUM(CASE WHEN s.status = ? THEN 1 ELSE 0 END) as paid_installments
      FROM installment_plans p
      INNER JOIN transactions t ON p.transaction_id = t.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN payment_methods m ON t.method_id = m.id
      LEFT JOIN installment_schedule s ON p.${planIdColumn} = s.plan_id
      WHERE 1=1
    `;
    const params: (string | number)[] = [paidScheduleStatus];

    if (transactionId) {
      query += " AND p.transaction_id = ?";
      params.push(transactionId);
    }

    if (status) {
      query += " AND p.status = ?";
      params.push(status);
    }

    query += ` GROUP BY p.${planIdColumn} ORDER BY p.created_at DESC`;

    const [rows] = await db.query(query, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch installment plans" }, { status: 500 });
  }
}

/**
 * POST /api/installments
 * Convert an existing transaction to an installment plan
 * Body: { transactionId, months, interestTotal, feesTotal }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transactionId, months, interestTotal = 0, feesTotal = 0 } = body;

    if (!transactionId || !months || months < 2) {
      return NextResponse.json(
        { error: "Invalid parameters. Months must be >= 2" },
        { status: 400 }
      );
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      const [txRowsRaw] = await connection.query(
        "SELECT id, amount, date, financing_status FROM transactions WHERE id = ?",
        [transactionId]
      );

      const txRows = asRows(txRowsRaw);
      if (txRows.length === 0) {
        throw new Error("Transaction not found");
      }

      const transaction = txRows[0];
      if (transaction.financing_status === "converted") {
        throw new Error("Transaction already converted to installment");
      }

      const principal = Number(transaction.amount);
      const normalizedDate = String(transaction.date).slice(0, 10);
      const startMonth = await resolveInstallmentStartMonthForDb(connection, normalizedDate);
      const dueMonthIsDateLike = await isInstallmentDueMonthDateLike(connection);
      const pendingScheduleStatus = await resolveInstallmentScheduleStatusForDb(connection, "pending");

      const [planResult] = await connection.query(
        `INSERT INTO installment_plans 
        (transaction_id, principal, months, interest_total, fees_total, start_month, status) 
        VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [transactionId, principal, months, interestTotal, feesTotal, startMonth]
      );

      const planId = asResultHeader(planResult).insertId;

      const scheduleValues = generateInstallmentScheduleValues({
        planId,
        months,
        principal,
        interestTotal: Number(interestTotal),
        feesTotal: Number(feesTotal),
        startDate: normalizedDate,
        dueMonthIsDateLike,
        pendingScheduleStatus,
      });

      await insertInstallmentSchedule(connection, scheduleValues, pendingScheduleStatus);

      await connection.query(
        "UPDATE transactions SET financing_status = 'converted' WHERE id = ?",
        [transactionId]
      );

      await connection.commit();
      return NextResponse.json({
        success: true,
        planId,
        message: "Transaction successfully converted to installment plan",
      });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Failed to create installment plan";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
