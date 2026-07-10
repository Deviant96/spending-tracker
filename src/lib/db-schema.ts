import type { Pool, PoolConnection } from "mysql2/promise";

type QueryExecutor = Pick<Pool, "query"> | Pick<PoolConnection, "query">;

export type CanonicalFinancingStatus = "one_time" | "converted" | "subscription";
export type CanonicalScheduleStatus = "pending" | "paid" | "overdue";
export type InstallmentPlanIdColumn = "plan_id" | "id";

export function parseEnumValues(columnType: string): string[] {
  const match = columnType.match(/^enum\((.*)\)$/i);
  if (!match) return [];

  return match[1]
    .split(",")
    .map((raw) => raw.trim().replace(/^'/, "").replace(/'$/, ""));
}

export function mapToSupportedStatus(
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

export function mapScheduleStatusToSupportedValue(
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

export async function getInstallmentPlanIdColumn(
  executor: QueryExecutor
): Promise<InstallmentPlanIdColumn> {
  const [planIdRows] = await executor.query("SHOW COLUMNS FROM installment_plans LIKE 'plan_id'");
  if (Array.isArray(planIdRows) && planIdRows.length > 0) {
    return "plan_id";
  }

  const [idRows] = await executor.query("SHOW COLUMNS FROM installment_plans LIKE 'id'");
  if (Array.isArray(idRows) && idRows.length > 0) {
    return "id";
  }

  throw new Error("installment_plans has no supported id column (expected plan_id or id)");
}

export async function resolveFinancingStatusForDb(
  executor: QueryExecutor,
  desiredStatus: CanonicalFinancingStatus
): Promise<string | null> {
  const [rows] = await executor.query("SHOW COLUMNS FROM transactions LIKE 'financing_status'");
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

export async function resolveInstallmentStartMonthForDb(
  executor: QueryExecutor,
  normalizedDate: string
): Promise<string> {
  const [rows] = await executor.query("SHOW COLUMNS FROM installment_plans LIKE 'start_month'");
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

export async function isInstallmentDueMonthDateLike(executor: QueryExecutor): Promise<boolean> {
  const [rows] = await executor.query("SHOW COLUMNS FROM installment_schedule LIKE 'due_month'");
  const column = Array.isArray(rows) && rows.length > 0 ? (rows[0] as { Type?: string }) : null;
  return Boolean(column?.Type && /^(date|datetime|timestamp)/i.test(column.Type));
}

export async function resolveInstallmentScheduleStatusForDb(
  executor: QueryExecutor,
  desiredStatus: CanonicalScheduleStatus
): Promise<string | null> {
  const [rows] = await executor.query("SHOW COLUMNS FROM installment_schedule LIKE 'status'");
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

export function normalizeDateForSql(value: unknown): string | null {
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
