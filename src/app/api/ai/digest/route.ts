import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { asRows } from "@/lib/mysql-types";
import { buildDeterministicInsights, polishInsightsWithLlm, type InsightFacts } from "@/lib/ai/insights";
import { buildCalendarFromDb } from "@/lib/calc/data";
import { buildSubscriptionRunway } from "@/lib/calc/subscription";
import { detectAnomalies } from "@/lib/calc/anomalies";
import { formatToRupiah } from "@/utils/currency";

function weekKey(d = new Date()): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const periodType = (searchParams.get("type") || "monthly") as "weekly" | "monthly";
    const now = new Date();
    const periodKey =
      searchParams.get("key") ||
      (periodType === "weekly"
        ? weekKey(now)
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

    // Return cached if present
    try {
      const [cachedRaw] = await db.query(
        `SELECT content_json FROM financial_digests WHERE period_type = ? AND period_key = ? LIMIT 1`,
        [periodType, periodKey]
      );
      const cached = asRows(cachedRaw)[0];
      if (cached?.content_json) {
        const content =
          typeof cached.content_json === "string"
            ? JSON.parse(cached.content_json)
            : cached.content_json;
        return NextResponse.json({ success: true, data: content, cached: true });
      }
    } catch {
      // table may not exist yet
    }

    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}`;

    const rangeStart =
      periodType === "weekly"
        ? new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)
        : `${thisMonth}-01`;

    const [spentRowsRaw] = await db.query(
      `SELECT DATE_FORMAT(date, '%Y-%m') AS ym, SUM(amount) AS total
       FROM transactions WHERE DATE_FORMAT(date, '%Y-%m') IN (?, ?) GROUP BY ym`,
      [thisMonth, lastMonth]
    );
    const spentMap = new Map(
      asRows(spentRowsRaw).map((r) => [String(r.ym), Number(r.total) || 0])
    );

    const [periodSpendRaw] = await db.query(
      `SELECT SUM(amount) AS total, COUNT(*) AS count FROM transactions WHERE date >= ?`,
      [rangeStart]
    );
    const periodSpend = asRows(periodSpendRaw)[0];

    const { calendar, subscriptions } = await buildCalendarFromDb({ horizonMonths: 3 });
    const runway = buildSubscriptionRunway(subscriptions);

    const [txRowsRaw] = await db.query(
      `SELECT t.id, t.date, t.amount, t.notes, c.name AS category
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.date >= ?`,
      [rangeStart]
    );
    const anomalies = detectAnomalies(
      asRows(txRowsRaw).map((r) => ({
        id: String(r.id),
        date: String(r.date).slice(0, 10),
        amount: Number(r.amount) || 0,
        category: r.category ? String(r.category) : null,
        notes: r.notes ? String(r.notes) : null,
      }))
    );

    const facts: InsightFacts = {
      monthLabel: thisMonth,
      spentThisMonth: spentMap.get(thisMonth) || 0,
      spentLastMonth: spentMap.get(lastMonth) || 0,
      cashflow: calendar,
      subscriptions: runway,
      anomalies,
    };

    const deterministic = buildDeterministicInsights(facts);
    const polished = await polishInsightsWithLlm(facts, deterministic);

    const upcoming = calendar.months.filter((m) => m.total > 0).slice(0, 3);
    const actions = [
      anomalies[0] ? `Review: ${anomalies[0].title}` : "No urgent anomalies — keep logging consistently.",
      runway.topByYearly[0]
        ? `Consider canceling "${runway.topByYearly[0].label}" to save ${formatToRupiah(runway.topByYearly[0].cancelSavesPerYear)}/yr.`
        : "No heavy subscriptions flagged.",
      upcoming[0]
        ? `Prepare for ${upcoming[0].month} dues (~${formatToRupiah(upcoming[0].total)}).`
        : "Cashflow outlook looks calm.",
    ];

    const digest = {
      periodType,
      periodKey,
      generatedAt: new Date().toISOString(),
      headline: `${periodType === "weekly" ? "Weekly" : "Monthly"} digest ${periodKey}`,
      periodSpend: {
        total: Number(periodSpend?.total) || 0,
        count: Number(periodSpend?.count) || 0,
      },
      story: polished.insights,
      source: polished.source,
      upcomingDues: upcoming,
      anomalies: anomalies.slice(0, 5),
      actions,
    };

    try {
      await db.query(
        `INSERT INTO financial_digests (period_type, period_key, content_json)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE content_json = VALUES(content_json)`,
        [periodType, periodKey, JSON.stringify(digest)]
      );
    } catch {
      // optional persistence when table missing
    }

    return NextResponse.json({ success: true, data: digest, cached: false });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to build digest" }, { status: 500 });
  }
}
