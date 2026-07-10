import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { asResultHeader, asRows } from "@/lib/mysql-types";
import {
  getInstallmentPlanIdColumn,
  resolveInstallmentScheduleStatusForDb,
} from "@/lib/db-schema";

/**
 * POST /api/installments/[planId]/pay
 * Mark a specific installment(s) as paid
 * Body: { scheduleIds: number[] } or { dueMonth: string }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  try {
    const { planId } = await params;
    const body = await req.json();
    const { scheduleIds, dueMonth } = body;
    const paidScheduleStatus = await resolveInstallmentScheduleStatusForDb(db, "paid");

    if (!scheduleIds && !dueMonth) {
      return NextResponse.json(
        { error: "Either scheduleIds or dueMonth must be provided" },
        { status: 400 }
      );
    }

    let query = paidScheduleStatus
      ? "UPDATE installment_schedule SET status = ?, paid_at = NOW() WHERE plan_id = ?"
      : "UPDATE installment_schedule SET paid_at = NOW() WHERE plan_id = ?";
    const queryParams: (string | number | number[])[] = paidScheduleStatus
      ? [paidScheduleStatus, planId]
      : [planId];

    if (scheduleIds && Array.isArray(scheduleIds)) {
      query += " AND schedule_id IN (?)";
      queryParams.push(scheduleIds);
    } else if (dueMonth) {
      query += " AND LEFT(CAST(due_month AS CHAR), 7) = ?";
      queryParams.push(String(dueMonth).slice(0, 7));
    }

    const [updateResult] = await db.query(query, queryParams);
    const result = asResultHeader(updateResult);
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "No installments found to update" }, { status: 404 });
    }

    const [schedulesRaw] = await db.query(
      "SELECT COUNT(*) as total, SUM(CASE WHEN paid_at IS NOT NULL THEN 1 ELSE 0 END) as paid FROM installment_schedule WHERE plan_id = ?",
      [planId]
    );

    const schedules = asRows(schedulesRaw);
    const { total, paid } = schedules[0] ?? {};
    if (Number(total) === Number(paid)) {
      const planIdColumn = await getInstallmentPlanIdColumn(db);
      await db.query(`UPDATE installment_plans SET status = 'completed' WHERE ${planIdColumn} = ?`, [planId]);
    }

    return NextResponse.json({
      success: true,
      message: "Installment(s) marked as paid",
      affectedRows: result.affectedRows,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to mark installment as paid" }, { status: 500 });
  }
}
