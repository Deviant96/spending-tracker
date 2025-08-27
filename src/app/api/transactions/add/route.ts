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
      installmentTotal,
      installmentCurrent,
      isSubscription,
      subscriptionInterval,
    } = body;

    await db.query(
      `INSERT INTO transactions 
        (id, date, amount, category_id, method_id, notes, installment_total, installment_current, is_subscription, subscription_interval)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        date,
        amount,
        categoryId,
        methodId,
        notes || null,
        installmentTotal || null,
        installmentCurrent || null,
        isSubscription ? 1 : 0,
        subscriptionInterval || null,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to add transaction" }, { status: 500 });
  }
}
