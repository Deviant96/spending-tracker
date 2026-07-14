import { db } from "@/lib/db";
import { asRows } from "@/lib/mysql-types";
import { getInstallmentPlanIdColumn } from "@/lib/db-schema";
import {
  buildCashflowCalendar,
  expandSubscriptions,
  type CashflowObligation,
} from "@/lib/calc/cashflow";

export async function fetchInstallmentObligations(
  startMonth: string,
  endMonth: string
): Promise<CashflowObligation[]> {
  const planIdColumn = await getInstallmentPlanIdColumn(db);
  const [rowsRaw] = await db.query(
    `SELECT 
      s.schedule_id,
      s.plan_id,
      LEFT(CAST(s.due_month AS CHAR), 7) AS due_month,
      (s.amount_principal + s.amount_interest + IFNULL(s.amount_fee, 0)) AS amount,
      s.status,
      s.paid_at,
      c.name AS category,
      t.notes
    FROM installment_schedule s
    INNER JOIN installment_plans p ON s.plan_id = p.${planIdColumn}
    INNER JOIN transactions t ON p.transaction_id = t.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE p.status = 'active'
      AND LEFT(CAST(s.due_month AS CHAR), 7) BETWEEN ? AND ?
      AND (s.paid_at IS NULL)
    ORDER BY s.due_month ASC`,
    [startMonth, endMonth]
  );

  return asRows(rowsRaw).map((r) => ({
    id: `inst-${r.schedule_id}`,
    kind: "installment" as const,
    label: String(r.notes || `Installment #${r.plan_id}`),
    category: r.category ? String(r.category) : null,
    amount: Number(r.amount) || 0,
    dueMonth: String(r.due_month).slice(0, 7),
    status: r.status ? String(r.status) : null,
    meta: { scheduleId: r.schedule_id, planId: r.plan_id },
  }));
}

export async function fetchActiveSubscriptions(): Promise<
  Array<{
    id: string;
    amount: number;
    date: string;
    notes: string | null;
    category: string | null;
    interval: "weekly" | "monthly" | "yearly" | null;
  }>
> {
  const [rowsRaw] = await db.query(
    `SELECT t.id, t.date, t.amount, t.notes, t.subscription_interval, c.name AS category
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE t.is_subscription = 1 OR t.financing_status = 'subscription'
     ORDER BY t.date DESC`
  );

  return asRows(rowsRaw).map((r) => ({
    id: String(r.id),
    amount: Number(r.amount) || 0,
    date: String(r.date).slice(0, 10),
    notes: r.notes ? String(r.notes) : null,
    category: r.category ? String(r.category) : null,
    interval: (r.subscription_interval as "weekly" | "monthly" | "yearly" | null) || "monthly",
  }));
}

export async function buildCalendarFromDb(options?: {
  horizonMonths?: number;
  startMonth?: string;
}) {
  const horizon = options?.horizonMonths ?? 12;
  const start =
    options?.startMonth ||
    (() => {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
    })();

  const startDate = new Date(`${start}-01T00:00:00`);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + horizon - 1, 1);
  const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}`;

  const [installments, subscriptions] = await Promise.all([
    fetchInstallmentObligations(start, endMonth),
    fetchActiveSubscriptions(),
  ]);

  const subObligations = expandSubscriptions(subscriptions, horizon, start);
  const calendar = buildCashflowCalendar([...installments, ...subObligations], {
    horizonMonths: horizon,
    startMonth: start,
  });

  return { calendar, installments, subscriptions };
}

export async function sumAccrualByMonth(start: string, end: string) {
  const [rowsRaw] = await db.query(
    `SELECT DATE_FORMAT(date, '%Y-%m') AS period, SUM(amount) AS total
     FROM transactions
     WHERE date BETWEEN ? AND ?
     GROUP BY period
     ORDER BY period`,
    [start, end]
  );
  return asRows(rowsRaw).map((r) => ({
    period: String(r.period),
    total: Number(r.total) || 0,
  }));
}

export async function sumCashflowByMonth(start: string, end: string) {
  const planIdColumn = await getInstallmentPlanIdColumn(db);
  const startMonth = start.slice(0, 7);
  const endMonth = end.slice(0, 7);

  const [rowsRaw] = await db.query(
    `SELECT period, SUM(total) AS total FROM (
       SELECT DATE_FORMAT(t.date, '%Y-%m') AS period, t.amount AS total
       FROM transactions t
       WHERE t.financing_status != 'converted'
         AND t.date BETWEEN ? AND ?
       UNION ALL
       SELECT LEFT(CAST(s.due_month AS CHAR), 7) AS period,
              (s.amount_principal + s.amount_interest + IFNULL(s.amount_fee, 0)) AS total
       FROM installment_schedule s
       INNER JOIN installment_plans p ON s.plan_id = p.${planIdColumn}
       WHERE LEFT(CAST(s.due_month AS CHAR), 7) BETWEEN ? AND ?
     ) combined
     GROUP BY period
     ORDER BY period`,
    [start, end, startMonth, endMonth]
  );

  return asRows(rowsRaw).map((r) => ({
    period: String(r.period),
    total: Number(r.total) || 0,
  }));
}
