import { NextRequest, NextResponse } from "next/server";
import {
  scenarioCutCategory,
  scenarioPayoffEarly,
  scenarioRefinance,
} from "@/lib/calc/scenarios";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = body.type as string;

    if (type === "payoff_early") {
      return NextResponse.json({
        success: true,
        data: scenarioPayoffEarly({
          remainingPrincipal: Number(body.remainingPrincipal) || 0,
          remainingInterest: Number(body.remainingInterest) || 0,
          remainingFees: Number(body.remainingFees) || 0,
          remainingMonths: Number(body.remainingMonths) || 0,
        }),
      });
    }

    if (type === "refinance") {
      return NextResponse.json({
        success: true,
        data: scenarioRefinance({
          principal: Number(body.principal) || 0,
          fromMonths: Number(body.fromMonths) || 12,
          toMonths: Number(body.toMonths) || 6,
          interestTotal: Number(body.interestTotal) || 0,
          feesTotal: Number(body.feesTotal) || 0,
          scaleInterest: body.scaleInterest !== false,
        }),
      });
    }

    if (type === "cut_category") {
      return NextResponse.json({
        success: true,
        data: scenarioCutCategory({
          category: String(body.category || "Category"),
          currentMonthly: Number(body.currentMonthly) || 0,
          cutPercent: Number(body.cutPercent) || 20,
        }),
      });
    }

    return NextResponse.json({ error: "Unknown scenario type" }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to run scenario" }, { status: 500 });
  }
}
