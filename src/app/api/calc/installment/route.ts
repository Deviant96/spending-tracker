import { NextRequest, NextResponse } from "next/server";
import { calculateInstallment } from "@/lib/calc/installment";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = calculateInstallment({
      principal: Number(body.principal ?? body.amount ?? 0),
      months: Number(body.months ?? body.installmentMonths ?? 0),
      interestTotal: Number(body.interestTotal ?? 0),
      feesTotal: Number(body.feesTotal ?? 0),
      startDate: body.startDate || body.date,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to calculate installment" }, { status: 500 });
  }
}
