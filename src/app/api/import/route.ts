import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { Transaction } from "@/types";

export type ImportRowResult = {
  index: number;
  success: boolean;
  id?: string;
  error?: string;
};

export async function POST(req: NextRequest) {
  let transactions: Transaction[];

  try {
    transactions = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(transactions)) {
    return NextResponse.json({ error: "Expected an array of transactions" }, { status: 400 });
  }

  const results: ImportRowResult[] = [];

  for (let index = 0; index < transactions.length; index++) {
    const row = transactions[index];

    try {
      if (!row.date || row.amount == null || Number.isNaN(Number(row.amount))) {
        throw new Error("Invalid date or amount");
      }

      const id = randomUUID();
      const isSubscription = row.isSubscription === true;
      const financingStatus = isSubscription ? "subscription" : "one_time";

      await db.query(
        `INSERT INTO transactions 
        (id, date, amount, category_id, method_id, notes, is_subscription, subscription_interval, financing_status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          row.date,
          Number(row.amount),
          row.categoryId ?? null,
          row.methodId ?? null,
          row.notes || null,
          isSubscription ? 1 : 0,
          row.subscriptionInterval || null,
          financingStatus,
        ]
      );

      results.push({ index, success: true, id });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      results.push({ index, success: false, error: message });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  return NextResponse.json({
    success: failureCount === 0,
    successCount,
    failureCount,
    count: transactions.length,
    results,
  });
}
