import { NextResponse } from "next/server";
import { buildSubscriptionRunway } from "@/lib/calc/subscription";
import { fetchActiveSubscriptions } from "@/lib/calc/data";

export async function GET() {
  try {
    const subscriptions = await fetchActiveSubscriptions();
    const runway = buildSubscriptionRunway(subscriptions);
    return NextResponse.json({ success: true, data: runway });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to build subscription runway" }, { status: 500 });
  }
}
