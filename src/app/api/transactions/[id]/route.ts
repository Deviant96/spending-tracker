import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

async function getInstallmentPlanIdColumn(): Promise<"plan_id" | "id"> {
  const [planIdRows] = await db.query("SHOW COLUMNS FROM installment_plans LIKE 'plan_id'");
  if (Array.isArray(planIdRows) && planIdRows.length > 0) {
    return "plan_id";
  }

  const [idRows] = await db.query("SHOW COLUMNS FROM installment_plans LIKE 'id'");
  if (Array.isArray(idRows) && idRows.length > 0) {
    return "id";
  }

  throw new Error("installment_plans has no supported id column (expected plan_id or id)");
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    console.log("PUT transaction received body:", body);
    
    const {
      date,
      amount,
      categoryId,
      methodId,
      notes,
      isSubscription,
      subscriptionInterval,
    } = body;

    // Format date to MySQL format (YYYY-MM-DD) without timezone conversion
    let formattedDate = null;
    if (date) {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      formattedDate = `${year}-${month}-${day}`;
    }

    const { id } = await params;
    console.log("Updating transaction with ID:", id);

    // Update transaction without modifying financing_status
    // financing_status is managed separately when creating/converting to installments
    const result = await db.query(
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

    console.log("PUT update result:", result);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT transaction error:", err);
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
    const planIdColumn = await getInstallmentPlanIdColumn();
    console.log("GET transaction with ID:", id);
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

    console.log("GET transaction found:", record);

    if (!record) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ data: record, success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch transaction" }, { status: 500 });
  }
}