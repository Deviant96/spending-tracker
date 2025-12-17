import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
    } = body;

    // Calculate financing_status based on subscription
    const financingStatus = isSubscription ? 'subscription' : 'one_time';

    const { id } = await params;

    await db.query(
      `UPDATE transactions 
       SET date=?, amount=?, category_id=?, method_id=?, notes=?, is_subscription=?, subscription_interval=?, financing_status=?
       WHERE id=?`,
      [
        date,
        amount,
        categoryId,
        methodId,
        notes || null,
        isSubscription ? 1 : 0,
        subscriptionInterval || null,
        financingStatus,
        id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const [rows] = await db.query(
      `SELECT 
        t.id, t.date, t.amount, t.notes,
        t.category_id, t.method_id,
        t.is_subscription, t.subscription_interval,
        t.financing_status,
        c.name AS category,
        m.name AS method,
        p.id as plan_id,
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