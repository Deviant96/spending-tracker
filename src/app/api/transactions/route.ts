import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await db.query(
      "SELECT t.id, t.date, t.amount, t.notes, t.installment_total, t.installment_current, t.is_subscription, t.subscription_interval, t.created_at, t.updated_at,\
        c.name AS category,\
        m.name AS method\
      FROM transactions t\
      LEFT JOIN categories c ON t.category_id = c.id\
      LEFT JOIN payment_methods m ON t.method_id = m.id\
      ORDER BY created_at DESC"
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}
