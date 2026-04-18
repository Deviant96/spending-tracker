// app/api/installments/[planId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/installments/[planId]
 * Get detailed information about a specific installment plan including all schedules
 */
export async function GET(_: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  try {
    const { planId } = await params;

    // Get plan details
    const [planRows] = await db.query(
      `SELECT 
        p.id as plan_id,
        p.transaction_id,
        p.principal,
        p.months,
        p.interest_total,
        p.fees_total,
        p.start_month,
        p.status,
        p.created_at,
        t.date as transaction_date,
        t.amount as transaction_amount,
        t.notes,
        c.name as category,
        m.name as method
      FROM installment_plans p
      INNER JOIN transactions t ON p.transaction_id = t.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN payment_methods m ON t.method_id = m.id
      WHERE p.id = ?`,
      [planId]
    );

    // @ts-ignore
    if (!planRows || planRows.length === 0) {
      return NextResponse.json({ error: "Installment plan not found" }, { status: 404 });
    }

    // Get schedule details
    const [scheduleRows] = await db.query(
      `SELECT 
        schedule_id,
        due_month,
        amount_principal,
        amount_interest,
        amount_fee,
        status,
        paid_at
      FROM installment_schedule
      WHERE plan_id = ?
      ORDER BY due_month ASC`,
      [planId]
    );

    // @ts-ignore
    const plan = planRows[0];
    return NextResponse.json({
      success: true,
      data: {
        ...plan,
        schedule: scheduleRows,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch installment plan" }, { status: 500 });
  }
}

/**
 * PUT /api/installments/[planId]
 * Update installment plan status (e.g., cancel plan)
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  try {
    const { planId } = await params;
    const body = await req.json();
    const { status } = body;

    if (!["active", "completed", "cancelled"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    await db.query("UPDATE installment_plans SET status = ? WHERE plan_id = ?", [status, planId]);

    return NextResponse.json({ success: true, message: "Installment plan updated" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update installment plan" }, { status: 500 });
  }
}

/**
 * DELETE /api/installments/[planId]
 * Delete an installment plan and revert the transaction to one_time
 */
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  try {
    const { planId } = await params;
    const connection = await db.getConnection();
    
    await connection.beginTransaction();
    try {
      // Get transaction ID before deleting
      const [planRows] = await connection.query(
        "SELECT transaction_id FROM installment_plans WHERE plan_id = ?",
        [planId]
      );

      // @ts-ignore
      if (!planRows || planRows.length === 0) {
        throw new Error("Installment plan not found");
      }

      // @ts-ignore
      const transactionId = planRows[0].transaction_id;

      // Delete schedule (cascades automatically via FK, but explicit for clarity)
      await connection.query("DELETE FROM installment_schedule WHERE plan_id = ?", [planId]);

      // Delete plan
      await connection.query("DELETE FROM installment_plans WHERE plan_id = ?", [planId]);

      // Revert transaction to one_time
      await connection.query(
        "UPDATE transactions SET financing_status = 'one_time' WHERE id = ?",
        [transactionId]
      );

      await connection.commit();
      return NextResponse.json({ 
        success: true, 
        message: "Installment plan deleted and transaction reverted" 
      });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Failed to delete installment plan" },
      { status: 500 }
    );
  }
}
