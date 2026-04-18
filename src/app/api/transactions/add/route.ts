import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";

function normalizeDateForSql(value: unknown): string | null {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type CanonicalFinancingStatus = "one_time" | "converted" | "subscription";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      date,
      amount,
      categoryId,
      methodId,
      notes,
      isInstallment,
      installmentMonths,
      interestTotal,
      isSubscription,
      subscriptionInterval,
    } = body;

    const normalizedDate = normalizeDateForSql(date);
    if (!normalizedDate) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      const transactionId = randomUUID();

      // Determine financing status
      const willCreateInstallment = isInstallment && installmentMonths > 1;
      const desiredStatus: CanonicalFinancingStatus = isSubscription ? 'subscription' : 
                             willCreateInstallment ? 'converted' : 'one_time';
      const dbFinancingStatus = await resolveFinancingStatusForDb(connection, desiredStatus);

      // Insert Base Transaction
      if (dbFinancingStatus) {
        await connection.query(
          `INSERT INTO transactions 
          (id, date, amount, category_id, method_id, notes, is_subscription, subscription_interval, financing_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            transactionId,
            normalizedDate,
            amount,
            categoryId,
            methodId,
            notes || null,
            isSubscription ? 1 : 0,
            subscriptionInterval || null,
            dbFinancingStatus,
          ]
        );
      } else {
        await connection.query(
          `INSERT INTO transactions 
          (id, date, amount, category_id, method_id, notes, is_subscription, subscription_interval)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            transactionId,
            normalizedDate,
            amount,
            categoryId,
            methodId,
            notes || null,
            isSubscription ? 1 : 0,
            subscriptionInterval || null,
          ]
        );
      }

      // Handle Installment Logic
      if (isInstallment && installmentMonths > 1) {
        const months = Number(installmentMonths);
        const interest = Number(interestTotal) || 0;
        const monthlyPrincipal = Math.floor(amount / months);
        const monthlyInterest = Math.floor(interest / months);

        // Create Plan
        const [planResult] = await connection.query(
          `INSERT INTO installment_plans (transaction_id, principal, months, interest_total, start_month) VALUES (?, ?, ?, ?, ?)`,
          [transactionId, amount, months, interest, normalizedDate.substring(0, 7)]
        );
        // @ts-ignore
        const planId = planResult.insertId;

        // Generate Schedule
        const scheduleValues = [];
        let currentDate = new Date(`${normalizedDate}T00:00:00`);
        // Set to 1st of month to avoid edge cases like Jan 31 -> Feb 28/29
        currentDate.setDate(1);

        for (let i = 0; i < months; i++) {
          const year = currentDate.getFullYear();
          const month = String(currentDate.getMonth() + 1).padStart(2, "0");
          const dueMonth = `${year}-${month}`;

          // Handle remainder logic for last month
          const isLast = i === months - 1;
          const pAmount = isLast
            ? amount - monthlyPrincipal * (months - 1)
            : monthlyPrincipal;
          const iAmount = isLast
            ? interest - monthlyInterest * (months - 1)
            : monthlyInterest;

          scheduleValues.push([
            planId,
            dueMonth,
            pAmount,
            iAmount,
            "pending",
          ]);

          // Increment month
          currentDate.setMonth(currentDate.getMonth() + 1);
        }

        await connection.query(
          `INSERT INTO installment_schedule (plan_id, due_month, amount_principal, amount_interest, status) VALUES ?`,
          [scheduleValues]
        );
      }

      await connection.commit();
      return NextResponse.json({ success: true });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to add transaction" },
      { status: 500 }
    );
  }
}
