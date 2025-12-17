import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { Transaction } from "@/types";

export async function POST(req: NextRequest) {
    const transactions: Transaction[] = await req.json();

  try {
    for (const r of transactions) {
      // Determine financing status
      const isSubscription = r.isSubscription === true;
      const financingStatus = isSubscription ? 'subscription' : 'one_time';
      
      await db.query(
        `INSERT INTO transactions 
        (id, date, amount, category_id, method_id, notes, is_subscription, subscription_interval, financing_status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          r.date,
          Number(r.amount),
          r.categoryId,
          r.methodId,
          r.notes || null,
          isSubscription ? 1 : 0,
          r.subscriptionInterval || null,
          financingStatus,
        ]
      );
    }

    return NextResponse.json({ success: true, count: transactions.length });
  } catch (error) {
    console.error("DB error:", error);
    return NextResponse.json({ success: false, error: "Failed to import CSV" }, { status: 500 });
  }
}
