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
            installmentMonths,
            interestTotal,
            isSubscription,
            subscriptionInterval,
        } = body;

        // category and method from form are the IDs (as strings)
        const categoryId = category ? parseInt(category) : null;
        const methodId = method || null;

        await db.query(
            `UPDATE transactions SET
                date = ?,
                amount = ?,
                category_id = ?,
                method_id = ?,
                notes = ?,
                is_subscription = ?,
                subscription_interval = ?
            WHERE id = ?`,
            [
                date,
                amount,
                categoryId,
                methodId,
                notes || null,
                isSubscription ? 1 : 0,
                subscriptionInterval || null,
                id,
            ]
        );

        // Note: Updating installment plans for existing transactions is complex.
        // For now, we don't support changing installment details on existing transactions.
        // If needed, we would need to:
        // 1. Delete existing plan and schedule
        // 2. Recreate them
        // This is left as future work to avoid breaking existing data.

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Failed to edit transaction" }, { status: 500 });
    }
}
