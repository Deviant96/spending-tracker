import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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
      isSubscription,
      subscriptionInterval,
    } = body;

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      const transactionId = randomUUID();

      // Determine financing status
      const willCreateInstallment = isInstallment && installmentMonths > 1;
      const financingStatus = isSubscription ? 'subscription' : 
                             willCreateInstallment ? 'converted' : 'one_time';

      // Insert Base Transaction
      await connection.query(
        `INSERT INTO transactions 
        (id, date, amount, category_id, method_id, notes, is_subscription, subscription_interval, financing_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionId,
          date,
          amount,
          categoryId,
          methodId,
          notes || null,
          isSubscription ? 1 : 0,
          subscriptionInterval || null,
          financingStatus,
        ]
      );

      // Handle Installment Logic
      if (isInstallment && installmentMonths > 1) {
        const months = Number(installmentMonths);
        const interest = Number(interestTotal) || 0;
        const monthlyPrincipal = Math.floor(amount / months);
        const monthlyInterest = Math.floor(interest / months);

        // Create Plan
        const [planResult] = await connection.query(
          `INSERT INTO installment_plans (transaction_id, principal, months, interest_total, start_month) VALUES (?, ?, ?, ?, ?)`,
          [transactionId, amount, months, interest, date.substring(0, 7)]
        );
        // @ts-ignore
        const planId = planResult.insertId;

        // Generate Schedule
        const scheduleValues = [];
        let currentDate = new Date(date);
        // Set to 1st of month to avoid edge cases like Jan 31 -> Feb 28/29
        currentDate.setDate(1);

        for (let i = 0; i < months; i++) {
          const year = currentDate.getFullYear();
          const month = String(currentDate.getMonth() + 1).padStart(2, "0");
          const dueMonth = `${year}-${month}`;

          // Handle remainder logic for last month
          const isLast = i === months - 1;
          const pAmount = isLast
            ? amount - monthlyPrincipal * (months - 1)
            : monthlyPrincipal;
          const iAmount = isLast
            ? interest - monthlyInterest * (months - 1)
            : monthlyInterest;

          scheduleValues.push([
            planId,
            dueMonth,
            pAmount,
            iAmount,
            "pending",
          ]);

          // Increment month
          currentDate.setMonth(currentDate.getMonth() + 1);
        }

        await connection.query(
          `INSERT INTO installment_schedule (plan_id, due_month, amount_principal, amount_interest, status) VALUES ?`,
          [scheduleValues]
        );
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
