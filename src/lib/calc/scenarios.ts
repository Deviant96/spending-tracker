import { calculateInstallment } from "./installment";

export type PayoffEarlyScenario = {
  type: "payoff_early";
  remainingPrincipal: number;
  remainingInterest: number;
  remainingFees: number;
  remainingMonths: number;
  payoffNowCost: number;
  stayCourseCost: number;
  savings: number;
};

export type RefinanceScenario = {
  type: "refinance";
  fromMonths: number;
  toMonths: number;
  principal: number;
  interestTotal: number;
  feesTotal: number;
  before: ReturnType<typeof calculateInstallment>;
  after: ReturnType<typeof calculateInstallment>;
  monthlyDelta: number;
  totalCostDelta: number;
};

export type CutCategoryScenario = {
  type: "cut_category";
  category: string;
  currentMonthly: number;
  cutPercent: number;
  monthlySavings: number;
  yearlySavings: number;
};

export function scenarioPayoffEarly(input: {
  remainingPrincipal: number;
  remainingInterest: number;
  remainingFees: number;
  remainingMonths: number;
}): PayoffEarlyScenario {
  const stayCourseCost =
    input.remainingPrincipal + input.remainingInterest + input.remainingFees;
  const payoffNowCost = input.remainingPrincipal; // assume interest/fees waived on early payoff
  return {
    type: "payoff_early",
    ...input,
    payoffNowCost,
    stayCourseCost,
    savings: Math.max(0, stayCourseCost - payoffNowCost),
  };
}

export function scenarioRefinance(input: {
  principal: number;
  fromMonths: number;
  toMonths: number;
  interestTotal: number;
  feesTotal?: number;
  /** Scale interest roughly with duration when refinancing shorter/longer */
  scaleInterest?: boolean;
}): RefinanceScenario {
  const fees = input.feesTotal ?? 0;
  let interestAfter = input.interestTotal;
  if (input.scaleInterest && input.fromMonths > 0) {
    interestAfter = Math.round((input.interestTotal * input.toMonths) / input.fromMonths);
  }

  const before = calculateInstallment({
    principal: input.principal,
    months: input.fromMonths,
    interestTotal: input.interestTotal,
    feesTotal: fees,
  });
  const after = calculateInstallment({
    principal: input.principal,
    months: input.toMonths,
    interestTotal: interestAfter,
    feesTotal: fees,
  });

  return {
    type: "refinance",
    fromMonths: input.fromMonths,
    toMonths: input.toMonths,
    principal: input.principal,
    interestTotal: interestAfter,
    feesTotal: fees,
    before,
    after,
    monthlyDelta: after.monthlyPaymentAverage - before.monthlyPaymentAverage,
    totalCostDelta: after.totalCost - before.totalCost,
  };
}

export function scenarioCutCategory(input: {
  category: string;
  currentMonthly: number;
  cutPercent: number;
}): CutCategoryScenario {
  const pct = Math.min(100, Math.max(0, input.cutPercent));
  const monthlySavings = Math.round(input.currentMonthly * (pct / 100));
  return {
    type: "cut_category",
    category: input.category,
    currentMonthly: input.currentMonthly,
    cutPercent: pct,
    monthlySavings,
    yearlySavings: monthlySavings * 12,
  };
}
