import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            id,
            date,
            amount,
            category,
            method,
            notes,
            installmentTotal,
            installmentCurrent,
            isSubscription,
            subscriptionInterval,
        } = body;

        await db.query(
            `UPDATE transactions SET
                date = ?,
                amount = ?,
                category = ?,
                method = ?,
                notes = ?,
                installment_total = ?,
                installment_current = ?,
                is_subscription = ?,
                subscription_interval = ?
            WHERE id = ?`,
            [
                date,
                amount,
                category,
                method,
                notes || null,
                installmentTotal || null,
                installmentCurrent || null,
                isSubscription ? 1 : 0,
                subscriptionInterval || null,
                id,
            ]
        );

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Failed to edit transaction" }, { status: 500 });
    }
}
