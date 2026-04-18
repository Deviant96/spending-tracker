import { NextResponse } from "next/server";
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

export async function GET() {
  try {
    const planIdColumn = await getInstallmentPlanIdColumn();
    const [rows] = await db.query(
      `SELECT 
        t.id, t.date, t.amount, t.notes, 
        t.category_id, t.method_id,
        t.is_subscription, t.subscription_interval, 
        t.financing_status,
        t.created_at, t.updated_at,
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
      ORDER BY t.created_at DESC`
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}
