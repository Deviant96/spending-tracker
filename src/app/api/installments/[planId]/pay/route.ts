// app/api/installments/[planId]/pay/route.ts
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
    const paidScheduleStatus = await resolveInstallmentScheduleStatusForDb("paid");

    if (!scheduleIds && !dueMonth) {
      return NextResponse.json(
        { error: "Either scheduleIds or dueMonth must be provided" },
        { status: 400 }
      );
    }

    let query = paidScheduleStatus
      ? "UPDATE installment_schedule SET status = ?, paid_at = NOW() WHERE plan_id = ?"
      : "UPDATE installment_schedule SET paid_at = NOW() WHERE plan_id = ?";
    const queryParams: any[] = paidScheduleStatus ? [paidScheduleStatus, planId] : [planId];

    if (scheduleIds && Array.isArray(scheduleIds)) {
      query += " AND schedule_id IN (?)";
      queryParams.push(scheduleIds);
    } else if (dueMonth) {
      // Match by month token so it works for both DATE-based and YYYY-MM schemas.
      query += " AND LEFT(CAST(due_month AS CHAR), 7) = ?";
      queryParams.push(String(dueMonth).slice(0, 7));
    }

    const [result] = await db.query(query, queryParams);

    // @ts-ignore
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "No installments found to update" }, { status: 404 });
    }

    // Check if all installments are paid, update plan status to completed
    const [schedules] = await db.query(
      "SELECT COUNT(*) as total, SUM(CASE WHEN paid_at IS NOT NULL THEN 1 ELSE 0 END) as paid FROM installment_schedule WHERE plan_id = ?",
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
