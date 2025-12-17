// app/api/installments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/installments
 * Fetch all installment plans with their schedules
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const transactionId = searchParams.get("transactionId");
    const status = searchParams.get("status");

    let query = `
      SELECT 
        p.plan_id,
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
        c.name as category,
        m.name as method,
        COUNT(s.schedule_id) as total_installments,
        SUM(CASE WHEN s.status = 'paid' THEN 1 ELSE 0 END) as paid_installments
      FROM installment_plans p
      INNER JOIN transactions t ON p.transaction_id = t.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN payment_methods m ON t.method_id = m.id
      LEFT JOIN installment_schedule s ON p.plan_id = s.plan_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (transactionId) {
      query += " AND p.transaction_id = ?";
      params.push(transactionId);
    }

    if (status) {
      query += " AND p.status = ?";
      params.push(status);
    }

    query += " GROUP BY p.plan_id ORDER BY p.created_at DESC";

    const [rows] = await db.query(query, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch installment plans" }, { status: 500 });
  }
}

/**
 * POST /api/installments
 * Convert an existing transaction to an installment plan
 * Body: { transactionId, months, interestTotal, feesTotal }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transactionId, months, interestTotal = 0, feesTotal = 0 } = body;

    if (!transactionId || !months || months < 2) {
      return NextResponse.json(
        { error: "Invalid parameters. Months must be >= 2" },
        { status: 400 }
      );
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Check if transaction exists and is not already converted
      const [txRows] = await connection.query(
        "SELECT id, amount, date, financing_status FROM transactions WHERE id = ?",
        [transactionId]
      );
      
      // @ts-ignore
      if (!txRows || txRows.length === 0) {
        throw new Error("Transaction not found");
      }

      // @ts-ignore
      const transaction = txRows[0];
      if (transaction.financing_status === 'converted') {
        throw new Error("Transaction already converted to installment");
      }

      const principal = transaction.amount;
      const startMonth = transaction.date.substring(0, 7); // YYYY-MM

      // Calculate monthly amounts
      const monthlyPrincipal = Math.floor(principal / months);
      const monthlyInterest = Math.floor(interestTotal / months);
      const monthlyFee = Math.floor(feesTotal / months);

      // Create installment plan
      const [planResult] = await connection.query(
        `INSERT INTO installment_plans 
        (transaction_id, principal, months, interest_total, fees_total, start_month, status) 
        VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [transactionId, principal, months, interestTotal, feesTotal, startMonth]
      );
      
      // @ts-ignore
      const planId = planResult.insertId;

      // Generate installment schedule
      const scheduleValues = [];
      let currentDate = new Date(transaction.date);
      currentDate.setDate(1); // Set to 1st of month

      for (let i = 0; i < months; i++) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, "0");
        const dueMonth = `${year}-${month}`;

        // Handle remainder in last installment
        const isLast = i === months - 1;
        const pAmount = isLast ? principal - monthlyPrincipal * (months - 1) : monthlyPrincipal;
        const iAmount = isLast ? interestTotal - monthlyInterest * (months - 1) : monthlyInterest;
        const fAmount = isLast ? feesTotal - monthlyFee * (months - 1) : monthlyFee;

        scheduleValues.push([planId, dueMonth, pAmount, iAmount, fAmount, "pending"]);
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      await connection.query(
        `INSERT INTO installment_schedule 
        (plan_id, due_month, amount_principal, amount_interest, amount_fee, status) 
        VALUES ?`,
        [scheduleValues]
      );

      // Update transaction financing_status to 'converted'
      await connection.query(
        "UPDATE transactions SET financing_status = 'converted' WHERE id = ?",
        [transactionId]
      );

      await connection.commit();
      return NextResponse.json({ 
        success: true, 
        planId,
        message: "Transaction successfully converted to installment plan" 
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
      { error: err.message || "Failed to create installment plan" },
      { status: 500 }
    );
  }
}
