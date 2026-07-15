import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { asRows } from "@/lib/mysql-types";
import { answerWithOptionalLlm, parseSpendQuestion } from "@/lib/ai/insights";
import { buildCalendarFromDb, sumAccrualByMonth, sumCashflowByMonth } from "@/lib/calc/data";
import { buildSubscriptionRunway } from "@/lib/calc/subscription";
import { detectAnomalies } from "@/lib/calc/anomalies";
import { formatToRupiah } from "@/utils/currency";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const question = String(body.question || "").trim();
    if (!question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const intent = parseSpendQuestion(question);
    let grounded = "";
    let facts: Record<string, unknown> = { intent };

    if (intent.type === "spend_period") {
      const end = intent.end || new Date().toISOString().slice(0, 10);
      const start =
        intent.start ||
        (() => {
          const d = new Date();
          d.setMonth(d.getMonth() - 1);
          return d.toISOString().slice(0, 10);
        })();

      const rows =
        intent.mode === "cashflow"
          ? await sumCashflowByMonth(start, end)
          : await sumAccrualByMonth(start, end);

      let total = rows.reduce((s, r) => s + r.total, 0);

      if (intent.category) {
        const [catRowsRaw] = await db.query(
          `SELECT SUM(t.amount) AS total
           FROM transactions t
           INNER JOIN categories c ON t.category_id = c.id
           WHERE t.date BETWEEN ? AND ?
             AND LOWER(c.name) = LOWER(?)`,
          [start, end, intent.category]
        );
        total = Number(asRows(catRowsRaw)[0]?.total) || 0;
      }

      grounded = `In ${intent.mode} mode from ${start} to ${end}${
        intent.category ? ` for ${intent.category}` : ""
      }, spending totals ${formatToRupiah(total)}.`;
      facts = { ...facts, start, end, total, mode: intent.mode, rows };
    } else if (intent.type === "top_category") {
      const end = intent.end || new Date().toISOString().slice(0, 10);
      const start =
        intent.start ||
        (() => {
          const d = new Date();
          d.setMonth(d.getMonth() - 1);
          return d.toISOString().slice(0, 10);
        })();
      const [rowsRaw] = await db.query(
        `SELECT c.name AS category, SUM(t.amount) AS total
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.date BETWEEN ? AND ?
         GROUP BY c.name
         ORDER BY total DESC
         LIMIT 5`,
        [start, end]
      );
      const rows = asRows(rowsRaw);
      const top = rows[0];
      grounded = top
        ? `Top category from ${start} to ${end} is ${top.category} at ${formatToRupiah(Number(top.total) || 0)}.`
        : "No category spending found for that range.";
      facts = { ...facts, rows, start, end };
    } else if (intent.type === "subscriptions") {
      const { subscriptions } = await buildCalendarFromDb({ horizonMonths: 1 });
      const runway = buildSubscriptionRunway(subscriptions);
      grounded = `You have ${runway.count} active subscriptions totaling about ${formatToRupiah(runway.monthlyTotal)}/month (${formatToRupiah(runway.yearlyTotal)}/year).`;
      facts = { ...facts, runway };
    } else if (intent.type === "upcoming_dues") {
      const { calendar } = await buildCalendarFromDb({
        horizonMonths: intent.months || 3,
      });
      const next = calendar.months.filter((m) => m.total > 0).slice(0, 3);
      grounded = next.length
        ? `Upcoming obligations: ${next
            .map((m) => `${m.month} ${formatToRupiah(m.total)}`)
            .join("; ")}.`
        : "No upcoming obligations found in the near horizon.";
      facts = { ...facts, months: next };
    } else if (intent.type === "budget_status") {
      const month = new Date().toISOString().slice(0, 7);
      try {
        const [budgetRowsRaw] = await db.query(
          `SELECT SUM(amount) AS budget_total FROM budgets WHERE month = ?`,
          [month]
        );
        const [spentRowsRaw] = await db.query(
          `SELECT SUM(amount) AS spent FROM transactions
           WHERE DATE_FORMAT(date, '%Y-%m') = ? AND financing_status != 'converted'`,
          [month]
        );
        const budgetTotal = Number(asRows(budgetRowsRaw)[0]?.budget_total) || 0;
        const spent = Number(asRows(spentRowsRaw)[0]?.spent) || 0;
        grounded =
          budgetTotal > 0
            ? `Budgets for ${month}: spent ${formatToRupiah(spent)} of ${formatToRupiah(budgetTotal)}.`
            : `No budgets set for ${month} yet. Spent so far: ${formatToRupiah(spent)}.`;
        facts = { ...facts, month, budgetTotal, spent };
      } catch {
        grounded = "Budget data is unavailable. Run the budgets migration and set category budgets first.";
      }
    } else if (intent.type === "anomalies") {
      const since = new Date();
      since.setMonth(since.getMonth() - 3);
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
      grounded = anomalies.length
        ? `Found ${anomalies.length} anomalies. Top: ${anomalies
            .slice(0, 3)
            .map((a) => a.title)
            .join("; ")}.`
        : "No spending anomalies detected in the last 3 months.";
      facts = { ...facts, anomalies: anomalies.slice(0, 10) };
    } else {
      grounded =
        "I can answer questions about spending totals, top categories, subscriptions, upcoming dues, budgets, and anomalies. Try: \"How much did I spend this month in cashflow mode?\"";
    }

    const polished = await answerWithOptionalLlm(question, grounded, facts);

    return NextResponse.json({
      success: true,
      data: {
        question,
        intent,
        answer: polished.answer,
        groundedAnswer: grounded,
        source: polished.source,
        facts,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to answer question" }, { status: 500 });
  }
}
