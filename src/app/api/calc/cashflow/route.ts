import { NextRequest, NextResponse } from "next/server";
import { buildCalendarFromDb } from "@/lib/calc/data";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const horizonMonths = Number(searchParams.get("horizon") || 12);
    const startMonth = searchParams.get("start") || undefined;

    const { calendar, installments, subscriptions } = await buildCalendarFromDb({
      horizonMonths: Math.min(Math.max(horizonMonths, 1), 36),
      startMonth: startMonth || undefined,
    });

    return NextResponse.json({
      success: true,
      data: calendar,
      meta: {
        installmentCount: installments.length,
        subscriptionCount: subscriptions.length,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to build cashflow calendar" }, { status: 500 });
  }
}
