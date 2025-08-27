import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db"; // adjust path to your DB util

// GET all categories
export async function GET() {
  try {
    const [rows] = await db.query("SELECT id, name FROM categories ORDER BY name ASC");
    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET categories error:", err);
    return NextResponse.json({ success: false, error: "Failed to fetch categories" }, { status: 500 });
  }
}

// POST create category
export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();

    if (!name) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }

    await db.query("INSERT INTO categories (name) VALUES (?)", [name]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST category error:", err);
    return NextResponse.json({ success: false, error: "Failed to create category" }, { status: 500 });
  }
}
