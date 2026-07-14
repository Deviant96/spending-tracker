import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { asResultHeader, asRows } from "@/lib/mysql-types";
import { projectBudgetVsActual } from "@/lib/calc/budget";
import { buildCalendarFromDb } from "@/lib/calc/data";

function currentMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || currentMonth();

    const [budgetRowsRaw] = await db.query(
      `SELECT b.id, b.category_id, b.month, b.amount, c.name AS category_name
       FROM budgets b
       INNER JOIN categories c ON b.category_id = c.id
       WHERE b.month = ?`,
      [month]
    );

    const [actualRowsRaw] = await db.query(
      `SELECT t.category_id, c.name AS category_name, SUM(t.amount) AS spent
       FROM transactions t
       INNER JOIN categories c ON t.category_id = c.id
       WHERE DATE_FORMAT(t.date, '%Y-%m') = ?
         AND t.financing_status != 'converted'
       GROUP BY t.category_id, c.name`,
      [month]
    );

    const budgets = asRows(budgetRowsRaw).map((r) => ({
      id: Number(r.id),
      categoryId: Number(r.category_id),
      categoryName: String(r.category_name),
      amount: Number(r.amount) || 0,
      month: String(r.month),
    }));

    const actuals = asRows(actualRowsRaw).map((r) => ({
      categoryId: Number(r.category_id),
      categoryName: String(r.category_name),
      spent: Number(r.spent) || 0,
    }));

    // Known future installment obligations this month by category
    const { calendar } = await buildCalendarFromDb({ horizonMonths: 1, startMonth: month });
    const knownFuture: Record<number, number> = {};
    const catNameToId = new Map(budgets.map((b) => [b.categoryName.toLowerCase(), b.categoryId]));
    for (const a of actuals) catNameToId.set(a.categoryName.toLowerCase(), a.categoryId);

    for (const item of calendar.months[0]?.items || []) {
      if (item.kind !== "installment") continue;
      const catId = item.category ? catNameToId.get(item.category.toLowerCase()) : undefined;
      if (catId == null) continue;
      // Only count unpaid remaining beyond what's already in actuals (approx: full due)
      knownFuture[catId] = (knownFuture[catId] || 0) + item.amount;
    }

    const projection = projectBudgetVsActual(month, budgets, actuals, knownFuture);

    return NextResponse.json({
      success: true,
      data: { budgets, projection },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      {
        error:
          "Failed to fetch budgets. Run migrations/002_budgets_and_digests.sql if the budgets table is missing.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const categoryId = Number(body.categoryId);
    const amount = Math.max(0, Math.floor(Number(body.amount) || 0));
    const month = String(body.month || currentMonth()).slice(0, 7);

    if (!categoryId) {
      return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
    }

    const [result] = await db.query(
      `INSERT INTO budgets (category_id, month, amount)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
      [categoryId, month, amount]
    );

    return NextResponse.json({
      success: true,
      affectedRows: asResultHeader(result).affectedRows,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to save budget" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await db.query("DELETE FROM budgets WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete budget" }, { status: 500 });
  }
}
