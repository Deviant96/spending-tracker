import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: "Transaction ID is required" }, { status: 400 });
        }

        await db.query(
            `DELETE FROM transactions WHERE id = ?`,
            [id]
        );

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
    }
}
