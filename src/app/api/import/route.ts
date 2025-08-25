import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { Transaction } from "@/types";

export async function POST(req: NextRequest) {
    const transactions: Transaction[] = await req.json();

  try {
    for (const r of transactions) {
      await db.query(
        `INSERT INTO transactions 
        (id, date, amount, category, method, notes, installment_total, installment_current, is_subscription, subscription_interval) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          r.date,
          Number(r.amount),
          r.category,
          r.method,
          r.notes || null,
          r.installmentTotal ? Number(r.installmentTotal) : null,
          r.installmentCurrent ? Number(r.installmentCurrent) : null,
          r.isSubscription === true ? 1 : 0,
          r.subscriptionInterval || null,
        ]
      );
    }

    return NextResponse.json({ success: true, count: transactions.length });
  } catch (error) {
    console.error("DB error:", error);
    return NextResponse.json({ success: false, error: "Failed to import CSV" }, { status: 500 });
  }
}
