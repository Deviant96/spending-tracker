import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { asRows } from "@/lib/mysql-types";
import { getInstallmentPlanIdColumn } from "@/lib/db-schema";
import { detectAnomalies, detectMissedInstallments } from "@/lib/calc/anomalies";

export async function GET() {
  try {
    const since = new Date();
    since.setMonth(since.getMonth() - 3);
    const sinceStr = since.toISOString().slice(0, 10);

    const [txRowsRaw] = await db.query(
      `SELECT t.id, t.date, t.amount, t.notes, c.name AS category
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.date >= ?
       ORDER BY t.date DESC`,
      [sinceStr]
    );

    const transactions = asRows(txRowsRaw).map((r) => ({
      id: String(r.id),
      date: String(r.date).slice(0, 10),
      amount: Number(r.amount) || 0,
      category: r.category ? String(r.category) : null,
      notes: r.notes ? String(r.notes) : null,
    }));

    const planIdColumn = await getInstallmentPlanIdColumn(db);
    const [schRowsRaw] = await db.query(
      `SELECT s.schedule_id, s.plan_id, LEFT(CAST(s.due_month AS CHAR), 7) AS due_month,
              (s.amount_principal + s.amount_interest + IFNULL(s.amount_fee, 0)) AS amount,
              s.status, s.paid_at, t.notes
       FROM installment_schedule s
       INNER JOIN installment_plans p ON s.plan_id = p.${planIdColumn}
       INNER JOIN transactions t ON p.transaction_id = t.id
       WHERE p.status = 'active'`
    );

    const schedules = asRows(schRowsRaw).map((r) => ({
      scheduleId: Number(r.schedule_id),
      planId: Number(r.plan_id),
      dueMonth: String(r.due_month),
      amount: Number(r.amount) || 0,
      status: r.status ? String(r.status) : null,
      paidAt: r.paid_at ? String(r.paid_at) : null,
      label: r.notes ? String(r.notes) : undefined,
    }));

    const anomalies = [
      ...detectAnomalies(transactions),
      ...detectMissedInstallments(schedules),
    ];

    return NextResponse.json({ success: true, data: anomalies });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to detect anomalies" }, { status: 500 });
  }
}
