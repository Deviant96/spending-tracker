import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { asResultHeader } from "@/lib/mysql-types";
import {
  normalizeDateForSql,
  resolveFinancingStatusForDb,
  resolveInstallmentScheduleStatusForDb,
  resolveInstallmentStartMonthForDb,
  isInstallmentDueMonthDateLike,
  type CanonicalFinancingStatus,
} from "@/lib/db-schema";
import { generateInstallmentScheduleValues, insertInstallmentSchedule } from "@/lib/installments";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      date,
      amount,
      categoryId,
      methodId,
      notes,
      isInstallment,
      installmentMonths,
      interestTotal,
      feesTotal,
      isSubscription,
      subscriptionInterval,
    } = body;

    const normalizedDate = normalizeDateForSql(date);
    if (!normalizedDate) {
      return NextResponse.json({ error: "Date is required and must be a valid date" }, { status: 400 });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 1) {
      return NextResponse.json({ error: "Amount is required and must be greater than 0" }, { status: 400 });
    }

    const normalizedCategoryId =
      categoryId === "" || categoryId == null || Number.isNaN(Number(categoryId))
        ? null
        : Number(categoryId);
    const normalizedMethodId =
      methodId === "" || methodId == null ? null : methodId;

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      const transactionId = randomUUID();

      const willCreateInstallment = isInstallment && installmentMonths > 1;
      const desiredStatus: CanonicalFinancingStatus = isSubscription
        ? "subscription"
        : willCreateInstallment
          ? "converted"
          : "one_time";
      const dbFinancingStatus = await resolveFinancingStatusForDb(connection, desiredStatus);

      if (dbFinancingStatus) {
        await connection.query(
          `INSERT INTO transactions 
          (id, date, amount, category_id, method_id, notes, is_subscription, subscription_interval, financing_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            transactionId,
            normalizedDate,
            parsedAmount,
            normalizedCategoryId,
            normalizedMethodId,
            notes || null,
            isSubscription ? 1 : 0,
            subscriptionInterval || null,
            dbFinancingStatus,
          ]
        );
      } else {
        await connection.query(
          `INSERT INTO transactions 
          (id, date, amount, category_id, method_id, notes, is_subscription, subscription_interval)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            transactionId,
            normalizedDate,
            parsedAmount,
            normalizedCategoryId,
            normalizedMethodId,
            notes || null,
            isSubscription ? 1 : 0,
            subscriptionInterval || null,
          ]
        );
      }

      if (isInstallment && installmentMonths > 1) {
        const months = Number(installmentMonths);
        const interest = Number(interestTotal) || 0;
        const fees = Number(feesTotal) || 0;
        const startMonth = await resolveInstallmentStartMonthForDb(connection, normalizedDate);
        const dueMonthIsDateLike = await isInstallmentDueMonthDateLike(connection);
        const pendingScheduleStatus = await resolveInstallmentScheduleStatusForDb(connection, "pending");

        const [planResult] = await connection.query(
          `INSERT INTO installment_plans (transaction_id, principal, months, interest_total, fees_total, start_month) VALUES (?, ?, ?, ?, ?, ?)`,
          [transactionId, parsedAmount, months, interest, fees, startMonth]
        );
        const planId = asResultHeader(planResult).insertId;

        const scheduleValues = generateInstallmentScheduleValues({
          planId,
          months,
          principal: parsedAmount,
          interestTotal: interest,
          feesTotal: fees,
          startDate: normalizedDate,
          dueMonthIsDateLike,
          pendingScheduleStatus,
        });

        await insertInstallmentSchedule(connection, scheduleValues, pendingScheduleStatus);
      }

      await connection.commit();
      return NextResponse.json({ success: true });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to add transaction" },
      { status: 500 }
    );
  }
}
