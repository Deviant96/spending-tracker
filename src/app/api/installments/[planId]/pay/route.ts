// app/api/installments/[planId]/pay/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

    if (!scheduleIds && !dueMonth) {
      return NextResponse.json(
        { error: "Either scheduleIds or dueMonth must be provided" },
        { status: 400 }
      );
    }

    let query = "UPDATE installment_schedule SET status = 'paid', paid_at = NOW() WHERE plan_id = ?";
    const queryParams: any[] = [planId];

    if (scheduleIds && Array.isArray(scheduleIds)) {
      query += " AND schedule_id IN (?)";
      queryParams.push(scheduleIds);
    } else if (dueMonth) {
      query += " AND due_month = ?";
      queryParams.push(dueMonth);
    }

    const [result] = await db.query(query, queryParams);

    // @ts-ignore
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "No installments found to update" }, { status: 404 });
    }

    // Check if all installments are paid, update plan status to completed
    const [schedules] = await db.query(
      "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid FROM installment_schedule WHERE plan_id = ?",
      [planId]
    );

    // @ts-ignore
    const { total, paid } = schedules[0];
    if (total === paid) {
      await db.query("UPDATE installment_plans SET status = 'completed' WHERE plan_id = ?", [planId]);
    }

    return NextResponse.json({
      success: true,
      message: "Installment(s) marked as paid",
      // @ts-ignore
      affectedRows: result.affectedRows,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to mark installment as paid" }, { status: 500 });
  }
}
