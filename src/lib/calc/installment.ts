export type InstallmentCalcInput = {
  principal: number;
  months: number;
  interestTotal?: number;
  feesTotal?: number;
  startDate?: string; // YYYY-MM-DD
};

export type MonthlyInstallmentBreakdown = {
  monthIndex: number;
  dueMonth: string;
  principal: number;
  interest: number;
  fee: number;
  total: number;
};

export type InstallmentCalcResult = {
  principal: number;
  months: number;
  interestTotal: number;
  feesTotal: number;
  totalCost: number;
  financingCost: number;
  monthlyPaymentAverage: number;
  approximateAprPercent: number | null;
  payoffMonth: string | null;
  schedule: MonthlyInstallmentBreakdown[];
};

function toYearMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Approximate APR from flat total interest+fees spread evenly.
 * Uses IRR-style Newton approximation on equal monthly payments.
 */
export function approximateApr(
  principal: number,
  months: number,
  monthlyPayment: number
): number | null {
  if (principal <= 0 || months < 1 || monthlyPayment <= 0) return null;
  if (monthlyPayment * months <= principal) return 0;

  let rate = 0.02; // monthly guess
  for (let i = 0; i < 40; i++) {
    let npv = -principal;
    let dNpv = 0;
    for (let t = 1; t <= months; t++) {
      const denom = Math.pow(1 + rate, t);
      npv += monthlyPayment / denom;
      dNpv -= (t * monthlyPayment) / Math.pow(1 + rate, t + 1);
    }
    if (Math.abs(dNpv) < 1e-12) break;
    const next = rate - npv / dNpv;
    if (!Number.isFinite(next) || next <= -0.99) break;
    if (Math.abs(next - rate) < 1e-8) {
      rate = next;
      break;
    }
    rate = next;
  }

  const annual = rate * 12 * 100;
  if (!Number.isFinite(annual) || annual < 0) return null;
  return Math.round(annual * 100) / 100;
}

export function calculateInstallment(input: InstallmentCalcInput): InstallmentCalcResult {
  const principal = Math.max(0, Math.floor(Number(input.principal) || 0));
  const months = Math.max(0, Math.floor(Number(input.months) || 0));
  const interestTotal = Math.max(0, Math.floor(Number(input.interestTotal) || 0));
  const feesTotal = Math.max(0, Math.floor(Number(input.feesTotal) || 0));

  if (months < 1 || principal <= 0) {
    return {
      principal,
      months,
      interestTotal,
      feesTotal,
      totalCost: principal + interestTotal + feesTotal,
      financingCost: interestTotal + feesTotal,
      monthlyPaymentAverage: 0,
      approximateAprPercent: null,
      payoffMonth: null,
      schedule: [],
    };
  }

  const monthlyPrincipal = Math.floor(principal / months);
  const monthlyInterest = Math.floor(interestTotal / months);
  const monthlyFee = Math.floor(feesTotal / months);

  const start = input.startDate
    ? new Date(`${input.startDate.slice(0, 10)}T00:00:00`)
    : new Date();
  if (Number.isNaN(start.getTime())) start.setTime(Date.now());
  start.setDate(1);

  const schedule: MonthlyInstallmentBreakdown[] = [];
  for (let i = 0; i < months; i++) {
    const due = new Date(start);
    due.setMonth(start.getMonth() + i);
    const isLast = i === months - 1;
    const p = isLast ? principal - monthlyPrincipal * (months - 1) : monthlyPrincipal;
    const interest = isLast ? interestTotal - monthlyInterest * (months - 1) : monthlyInterest;
    const fee = isLast ? feesTotal - monthlyFee * (months - 1) : monthlyFee;
    schedule.push({
      monthIndex: i + 1,
      dueMonth: toYearMonth(due),
      principal: p,
      interest,
      fee,
      total: p + interest + fee,
    });
  }

  const totalCost = principal + interestTotal + feesTotal;
  const monthlyPaymentAverage = Math.round(totalCost / months);
  const apr = approximateApr(principal, months, monthlyPaymentAverage);

  return {
    principal,
    months,
    interestTotal,
    feesTotal,
    totalCost,
    financingCost: interestTotal + feesTotal,
    monthlyPaymentAverage,
    approximateAprPercent: apr,
    payoffMonth: schedule[schedule.length - 1]?.dueMonth ?? null,
    schedule,
  };
}
