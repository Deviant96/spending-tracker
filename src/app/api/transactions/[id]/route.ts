import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const {
      date,
      amount,
      category,
      method,
      notes,
      installmentTotal,
      installmentCurrent,
      isSubscription,
      subscriptionInterval,
    } = body;

    await db.query(
      `UPDATE transactions 
       SET date=?, amount=?, category=?, method=?, notes=?, installment_total=?, installment_current=?, is_subscription=?, subscription_interval=? 
       WHERE id=?`,
      [
        date,
        amount,
        category,
        method,
        notes || null,
        installmentTotal || null,
        installmentCurrent || null,
        isSubscription ? 1 : 0,
        subscriptionInterval || null,
        params.id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await db.query("DELETE FROM transactions WHERE id=?", [params.id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}


export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const [rows] = await db.query("SELECT * FROM transactions WHERE id=?", [id]);
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