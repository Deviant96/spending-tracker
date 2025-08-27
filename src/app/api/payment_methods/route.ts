import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db"; // adjust path

// GET all methods
export async function GET() {
  try {
    const [rows] = await db.query("SELECT id, name FROM payment_methods ORDER BY name ASC");
    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET methods error:", err);
    return NextResponse.json({ success: false, error: "Failed to fetch methods" }, { status: 500 });
  }
}

// POST create method
export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();

    if (!name) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }

    await db.query("INSERT INTO payment_methods (name) VALUES (?)", [name]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST method error:", err);
    return NextResponse.json({ success: false, error: "Failed to create method" }, { status: 500 });
  }
}
