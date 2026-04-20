import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type CanonicalFinancingStatus = "one_time" | "converted" | "subscription";
type CanonicalScheduleStatus = "pending" | "paid" | "overdue";

function parseEnumValues(columnType: string): string[] {
  const match = columnType.match(/^enum\((.*)\)$/i);
  if (!match) return [];

  return match[1]
    .split(",")
    .map((raw) => raw.trim().replace(/^'/, "").replace(/'$/, ""));
}

function mapToSupportedStatus(
  desiredStatus: CanonicalFinancingStatus,
  supportedValues: string[]
): string | null {
  const byPreference: Record<CanonicalFinancingStatus, string[]> = {
    one_time: ["one_time", "single", "normal", "cash", "one-time", "once"],
    converted: ["converted", "installment", "installments", "financed", "cicilan"],
    subscription: ["subscription", "recurring", "repeat", "berlangganan"],
  };

  const normalizedMap = new Map(supportedValues.map((value) => [value.toLowerCase(), value]));
  for (const candidate of byPreference[desiredStatus]) {
    const found = normalizedMap.get(candidate.toLowerCase());
    if (found) return found;
  }

  return null;
}

function mapScheduleStatusToSupportedValue(
  desiredStatus: CanonicalScheduleStatus,
  supportedValues: string[]
): string | null {
  const byPreference: Record<CanonicalScheduleStatus, string[]> = {
    pending: ["pending", "unpaid", "due", "open", "waiting"],
    paid: ["paid", "settled", "done", "lunas"],
    overdue: ["overdue", "late", "past_due"],
  };

  const normalizedMap = new Map(supportedValues.map((value) => [value.toLowerCase(), value]));
  for (const candidate of byPreference[desiredStatus]) {
    const found = normalizedMap.get(candidate.toLowerCase());
    if (found) return found;
  }

  return null;
}

async function resolveFinancingStatusForDb(
  connection: Awaited<ReturnType<typeof db.getConnection>>,
  desiredStatus: CanonicalFinancingStatus
): Promise<string | null> {
  const [rows] = await connection.query("SHOW COLUMNS FROM transactions LIKE 'financing_status'");
  const column = Array.isArray(rows) && rows.length > 0 ? (rows[0] as { Type?: string }) : null;

  if (!column?.Type) {
    return null;
  }

  const supportedValues = parseEnumValues(column.Type);
  if (supportedValues.length === 0) {
    return null;
  }

  return mapToSupportedStatus(desiredStatus, supportedValues);
}

async function resolveInstallmentStartMonthForDb(
  connection: Awaited<ReturnType<typeof db.getConnection>>,
  normalizedDate: string
): Promise<string> {
  const [rows] = await connection.query("SHOW COLUMNS FROM installment_plans LIKE 'start_month'");
  const column = Array.isArray(rows) && rows.length > 0 ? (rows[0] as { Type?: string }) : null;

  const yearMonth = normalizedDate.substring(0, 7);
  if (!column?.Type) {
    return yearMonth;
  }

  if (/^(date|datetime|timestamp)/i.test(column.Type)) {
    return `${yearMonth}-01`;
  }

  return yearMonth;
}

async function isInstallmentDueMonthDateLike(
  connection: Awaited<ReturnType<typeof db.getConnection>>
): Promise<boolean> {
  const [rows] = await connection.query("SHOW COLUMNS FROM installment_schedule LIKE 'due_month'");
  const column = Array.isArray(rows) && rows.length > 0 ? (rows[0] as { Type?: string }) : null;
  return Boolean(column?.Type && /^(date|datetime|timestamp)/i.test(column.Type));
}

async function resolveInstallmentScheduleStatusForDb(
  connection: Awaited<ReturnType<typeof db.getConnection>>,
  desiredStatus: CanonicalScheduleStatus
): Promise<string | null> {
  const [rows] = await connection.query("SHOW COLUMNS FROM installment_schedule LIKE 'status'");
  const column = Array.isArray(rows) && rows.length > 0 ? (rows[0] as { Type?: string }) : null;

  if (!column?.Type) {
    return null;
  }

  const supportedValues = parseEnumValues(column.Type);
  if (supportedValues.length === 0) {
    return null;
  }

  return mapScheduleStatusToSupportedValue(desiredStatus, supportedValues);
}

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
      isInstallment,
      installmentMonths,
      interestTotal,
      feesTotal,
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

    const shouldCreateInstallment = Boolean(isInstallment) && Number(installmentMonths || 0) > 1;
    const desiredStatus: CanonicalFinancingStatus = isSubscription
      ? "subscription"
      : shouldCreateInstallment
        ? "converted"
        : "one_time";

    const connection = await db.getConnection();
    await connection.beginTransaction();

    let result;

    try {
      const dbFinancingStatus = await resolveFinancingStatusForDb(connection, desiredStatus);
      result = dbFinancingStatus
        ? await connection.query(
            `UPDATE transactions 
             SET date=?, amount=?, category_id=?, method_id=?, notes=?, is_subscription=?, subscription_interval=?, financing_status=?
             WHERE id=?`,
            [
              formattedDate,
              amount,
              categoryId,
              methodId,
              notes || null,
              isSubscription ? 1 : 0,
              subscriptionInterval || null,
              dbFinancingStatus,
              id,
            ]
          )
        : await connection.query(
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

      if (shouldCreateInstallment && formattedDate) {
        const planIdColumn = await getInstallmentPlanIdColumn();
        const months = Number(installmentMonths);
        const interest = Number(interestTotal) || 0;
        const fees = Number(feesTotal) || 0;
        const monthlyPrincipal = Math.floor(Number(amount) / months);
        const monthlyInterest = Math.floor(interest / months);
        const monthlyFee = Math.floor(fees / months);
        const startMonth = await resolveInstallmentStartMonthForDb(connection, formattedDate);
        const dueMonthIsDateLike = await isInstallmentDueMonthDateLike(connection);
        const pendingScheduleStatus = await resolveInstallmentScheduleStatusForDb(connection, "pending");

        const [existingPlanRows] = await connection.query(
          `SELECT ${planIdColumn} AS plan_id FROM installment_plans WHERE transaction_id = ? LIMIT 1`,
          [id]
        );
        const existingPlan = Array.isArray(existingPlanRows) && existingPlanRows.length > 0
          ? (existingPlanRows[0] as { plan_id: number })
          : null;

        let planId: number;
        if (existingPlan?.plan_id) {
          planId = Number(existingPlan.plan_id);
          await connection.query(
            `UPDATE installment_plans
             SET principal = ?, months = ?, interest_total = ?, fees_total = ?, start_month = ?, status = 'active'
             WHERE ${planIdColumn} = ?`,
            [amount, months, interest, fees, startMonth, planId]
          );

          await connection.query(`DELETE FROM installment_schedule WHERE plan_id = ?`, [planId]);
        } else {
          const [planResult] = await connection.query(
            `INSERT INTO installment_plans
             (transaction_id, principal, months, interest_total, fees_total, start_month, status)
             VALUES (?, ?, ?, ?, ?, ?, 'active')`,
            [id, amount, months, interest, fees, startMonth]
          );
          planId = Number((planResult as { insertId: number }).insertId);
        }

        const scheduleValues = [];
        const scheduleDate = new Date(`${formattedDate}T00:00:00`);
        scheduleDate.setDate(1);

        for (let i = 0; i < months; i++) {
          const year = scheduleDate.getFullYear();
          const month = String(scheduleDate.getMonth() + 1).padStart(2, "0");
          const dueMonth = dueMonthIsDateLike ? `${year}-${month}-01` : `${year}-${month}`;
          const isLast = i === months - 1;
          const principalAmount = isLast
            ? Number(amount) - monthlyPrincipal * (months - 1)
            : monthlyPrincipal;
          const interestAmount = isLast
            ? interest - monthlyInterest * (months - 1)
            : monthlyInterest;
          const feeAmount = isLast
            ? fees - monthlyFee * (months - 1)
            : monthlyFee;

          if (pendingScheduleStatus) {
            scheduleValues.push([planId, dueMonth, principalAmount, interestAmount, feeAmount, pendingScheduleStatus]);
          } else {
            scheduleValues.push([planId, dueMonth, principalAmount, interestAmount, feeAmount]);
          }
          scheduleDate.setMonth(scheduleDate.getMonth() + 1);
        }

        if (pendingScheduleStatus) {
          await connection.query(
            `INSERT INTO installment_schedule
             (plan_id, due_month, amount_principal, amount_interest, amount_fee, status)
             VALUES ?`,
            [scheduleValues]
          );
        } else {
          await connection.query(
            `INSERT INTO installment_schedule
             (plan_id, due_month, amount_principal, amount_interest, amount_fee)
             VALUES ?`,
            [scheduleValues]
          );
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

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