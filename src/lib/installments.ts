export type InstallmentScheduleRow = (string | number)[];

export type GenerateScheduleParams = {
  planId: number;
  months: number;
  principal: number;
  interestTotal: number;
  feesTotal: number;
  startDate: string;
  dueMonthIsDateLike: boolean;
  pendingScheduleStatus: string | null;
};

export function generateInstallmentScheduleValues({
  planId,
  months,
  principal,
  interestTotal,
  feesTotal,
  startDate,
  dueMonthIsDateLike,
  pendingScheduleStatus,
}: GenerateScheduleParams): InstallmentScheduleRow[] {
  const monthlyPrincipal = Math.floor(principal / months);
  const monthlyInterest = Math.floor(interestTotal / months);
  const monthlyFee = Math.floor(feesTotal / months);

  const scheduleValues: InstallmentScheduleRow[] = [];
  const currentDate = new Date(`${startDate}T00:00:00`);
  currentDate.setDate(1);

  for (let i = 0; i < months; i++) {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const dueMonth = dueMonthIsDateLike ? `${year}-${month}-01` : `${year}-${month}`;

    const isLast = i === months - 1;
    const principalAmount = isLast ? principal - monthlyPrincipal * (months - 1) : monthlyPrincipal;
    const interestAmount = isLast ? interestTotal - monthlyInterest * (months - 1) : monthlyInterest;
    const feeAmount = isLast ? feesTotal - monthlyFee * (months - 1) : monthlyFee;

    if (pendingScheduleStatus) {
      scheduleValues.push([planId, dueMonth, principalAmount, interestAmount, feeAmount, pendingScheduleStatus]);
    } else {
      scheduleValues.push([planId, dueMonth, principalAmount, interestAmount, feeAmount]);
    }

    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return scheduleValues;
}

export async function insertInstallmentSchedule(
  connection: { query: (sql: string, values?: unknown) => Promise<unknown> },
  scheduleValues: InstallmentScheduleRow[],
  pendingScheduleStatus: string | null
): Promise<void> {
  if (scheduleValues.length === 0) return;

  if (pendingScheduleStatus) {
    await connection.query(
      `INSERT INTO installment_schedule
       (plan_id, due_month, amount_principal, amount_interest, amount_fee, status)
       VALUES ?`,
      [scheduleValues]
    );
    return;
  }

  await connection.query(
    `INSERT INTO installment_schedule
     (plan_id, due_month, amount_principal, amount_interest, amount_fee)
     VALUES ?`,
    [scheduleValues]
  );
}
