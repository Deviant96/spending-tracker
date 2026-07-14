import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { asRows } from "@/lib/mysql-types";
import { classifyTransactionNote } from "@/lib/calc/classify";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rows: Array<{ notes?: string; amount?: number; index?: number }> = Array.isArray(body)
      ? body
      : Array.isArray(body.rows)
        ? body.rows
        : [body];

    const [catRowsRaw] = await db.query("SELECT id, name FROM categories ORDER BY name");
    const categories = asRows(catRowsRaw).map((r) => ({
      id: Number(r.id),
      name: String(r.name),
    }));

    const results = rows.map((row, index) => {
      const classification = classifyTransactionNote({
        notes: row.notes,
        amount: row.amount != null ? Number(row.amount) : undefined,
        existingCategories: categories,
      });
      return {
        index: row.index ?? index,
        ...classification,
      };
    });

    return NextResponse.json({ success: true, data: results });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to classify" }, { status: 500 });
  }
}
