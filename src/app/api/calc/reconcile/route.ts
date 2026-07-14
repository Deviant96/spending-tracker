import { NextRequest, NextResponse } from "next/server";
import { reconcileAccrualCashflow } from "@/lib/calc/reconcile";
import { sumAccrualByMonth, sumCashflowByMonth } from "@/lib/calc/data";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const end = searchParams.get("end") || new Date().toISOString().slice(0, 10);
    const startDefault = new Date();
    startDefault.setMonth(startDefault.getMonth() - 5);
    startDefault.setDate(1);
    const start = searchParams.get("start") || startDefault.toISOString().slice(0, 10);

    const [accrual, cashflow] = await Promise.all([
      sumAccrualByMonth(start, end),
      sumCashflowByMonth(start, end),
    ]);

    const periods = new Set([...accrual.map((a) => a.period), ...cashflow.map((c) => c.period)]);
    const accrualMap = new Map(accrual.map((a) => [a.period, a.total]));
    const cashflowMap = new Map(cashflow.map((c) => [c.period, c.total]));

    const rows = Array.from(periods)
      .sort()
      .map((period) => ({
        period,
        accrual: accrualMap.get(period) || 0,
        cashflow: cashflowMap.get(period) || 0,
      }));

    const result = reconcileAccrualCashflow(rows);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to reconcile accrual/cashflow" }, { status: 500 });
  }
}
