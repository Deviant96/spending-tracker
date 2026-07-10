import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { asResultHeader } from "@/lib/mysql-types";
import {
  getInstallmentPlanIdColumn,
  normalizeDateForSql,
  resolveFinancingStatusForDb,
  resolveInstallmentScheduleStatusForDb,
  resolveInstallmentStartMonthForDb,
  isInstallmentDueMonthDateLike,
  type CanonicalFinancingStatus,
} from "@/lib/db-schema";
import { generateInstallmentScheduleValues, insertInstallmentSchedule } from "@/lib/installments";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const {
      date,
      amount,
      categoryId,
      methodId,
      notes,
      isSubscription,
      subscriptionInterval,
      isInstallment,
      installmentMonths,
      interestTotal,
      feesTotal,
    } = body;

    const formattedDate = normalizeDateForSql(date);
    const { id } = await params;

    const shouldCreateInstallment = Boolean(isInstallment) && Number(installmentMonths || 0) > 1;
    const desiredStatus: CanonicalFinancingStatus = isSubscription
      ? "subscription"
      : shouldCreateInstallment
        ? "converted"
        : "one_time";

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      const dbFinancingStatus = await resolveFinancingStatusForDb(connection, desiredStatus);
      if (dbFinancingStatus) {
        await connection.query(
          `UPDATE transactions 
           SET date=?, amount=?, category_id=?, method_id=?, notes=?, is_subscription=?, subscription_interval=?, financing_status=?
           WHERE id=?`,
          [
            formattedDate,
            amount,
            categoryId,
            methodId,
            notes || null,
            isSubscription ? 1 : 0,
            subscriptionInterval || null,
            dbFinancingStatus,
            id,
          ]
        );
      } else {
        await connection.query(
          `UPDATE transactions 
           SET date=?, amount=?, category_id=?, method_id=?, notes=?, is_subscription=?, subscription_interval=?
           WHERE id=?`,
          [
            formattedDate,
            amount,
            categoryId,
            methodId,
            notes || null,
            isSubscription ? 1 : 0,
            subscriptionInterval || null,
            id,
          ]
        );
      }

      if (shouldCreateInstallment && formattedDate) {
        const planIdColumn = await getInstallmentPlanIdColumn(connection);
        const months = Number(installmentMonths);
        const interest = Number(interestTotal) || 0;
        const fees = Number(feesTotal) || 0;
        const startMonth = await resolveInstallmentStartMonthForDb(connection, formattedDate);
        const dueMonthIsDateLike = await isInstallmentDueMonthDateLike(connection);
        const pendingScheduleStatus = await resolveInstallmentScheduleStatusForDb(connection, "pending");

        const [existingPlanRows] = await connection.query(
          `SELECT ${planIdColumn} AS plan_id FROM installment_plans WHERE transaction_id = ? LIMIT 1`,
          [id]
        );
        const existingPlan = Array.isArray(existingPlanRows) && existingPlanRows.length > 0
          ? (existingPlanRows[0] as { plan_id: number })
          : null;

        let planId: number;
        if (existingPlan?.plan_id) {
          planId = Number(existingPlan.plan_id);
          await connection.query(
            `UPDATE installment_plans
             SET principal = ?, months = ?, interest_total = ?, fees_total = ?, start_month = ?, status = 'active'
             WHERE ${planIdColumn} = ?`,
            [amount, months, interest, fees, startMonth, planId]
          );

          await connection.query(`DELETE FROM installment_schedule WHERE plan_id = ?`, [planId]);
        } else {
          const [planResult] = await connection.query(
            `INSERT INTO installment_plans
             (transaction_id, principal, months, interest_total, fees_total, start_month, status)
             VALUES (?, ?, ?, ?, ?, ?, 'active')`,
            [id, amount, months, interest, fees, startMonth]
          );
          planId = asResultHeader(planResult).insertId;
        }

        const scheduleValues = generateInstallmentScheduleValues({
          planId,
          months,
          principal: Number(amount),
          interestTotal: interest,
          feesTotal: fees,
          startDate: formattedDate,
          dueMonthIsDateLike,
          pendingScheduleStatus,
        });

        await insertInstallmentSchedule(connection, scheduleValues, pendingScheduleStatus);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT transaction error:", err);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.query("DELETE FROM transactions WHERE id=?", [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const planIdColumn = await getInstallmentPlanIdColumn(db);
    const [rows] = await db.query(
      `SELECT 
        t.id, t.date, t.amount, t.notes,
        t.category_id, t.method_id,
        t.is_subscription, t.subscription_interval,
        t.financing_status,
        c.name AS category,
        m.name AS method,
        p.${planIdColumn} AS plan_id,
        p.months as plan_months,
        p.interest_total as plan_interest,
        p.principal as plan_principal,
        p.start_month as plan_start_month,
        p.status as plan_status
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN payment_methods m ON t.method_id = m.id
      LEFT JOIN installment_plans p ON t.id = p.transaction_id
      WHERE t.id = ?`,
      [id]
    );
    const record = Array.isArray(rows) ? rows[0] : null;

    if (!record) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ data: record, success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch transaction" }, { status: 500 });
  }
}
