import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { asRows } from "@/lib/mysql-types";
import { buildDeterministicInsights, polishInsightsWithLlm, type InsightFacts } from "@/lib/ai/insights";
import { buildCalendarFromDb } from "@/lib/calc/data";
import { buildSubscriptionRunway } from "@/lib/calc/subscription";
import { detectAnomalies } from "@/lib/calc/anomalies";

export async function GET() {
  try {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}`;

    const [spentRowsRaw] = await db.query(
      `SELECT DATE_FORMAT(date, '%Y-%m') AS ym, SUM(amount) AS total
       FROM transactions
       WHERE DATE_FORMAT(date, '%Y-%m') IN (?, ?)
       GROUP BY ym`,
      [thisMonth, lastMonth]
    );
    const spentMap = new Map(
      asRows(spentRowsRaw).map((r) => [String(r.ym), Number(r.total) || 0])
    );

    const [topRowsRaw] = await db.query(
      `SELECT c.name AS category, SUM(t.amount) AS total
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE DATE_FORMAT(t.date, '%Y-%m') = ?
       GROUP BY c.name
       ORDER BY total DESC
       LIMIT 1`,
      [thisMonth]
    );
    const top = asRows(topRowsRaw)[0];

    const since = new Date();
    since.setMonth(since.getMonth() - 2);
    const [txRowsRaw] = await db.query(
      `SELECT t.id, t.date, t.amount, t.notes, c.name AS category
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.date >= ?`,
      [since.toISOString().slice(0, 10)]
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

    let cashflow = null;
    let subscriptions = null;
    try {
      const cal = await buildCalendarFromDb({ horizonMonths: 6 });
      cashflow = cal.calendar;
      subscriptions = buildSubscriptionRunway(cal.subscriptions);
    } catch {
      // optional — DB may lack installment tables in some envs
    }

    const facts: InsightFacts = {
      monthLabel: thisMonth,
      spentThisMonth: spentMap.get(thisMonth) || 0,
      spentLastMonth: spentMap.get(lastMonth) || 0,
      topCategory: top
        ? { name: String(top.category || "Unknown"), amount: Number(top.total) || 0 }
        : null,
      cashflow,
      subscriptions,
      anomalies,
    };

    const deterministic = buildDeterministicInsights(facts);
    const polished = await polishInsightsWithLlm(facts, deterministic);

    return NextResponse.json({
      success: true,
      data: {
        insights: polished.insights,
        source: polished.source,
        facts,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to build insights" }, { status: 500 });
  }
}
