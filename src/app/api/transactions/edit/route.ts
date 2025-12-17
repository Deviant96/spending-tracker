import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log("Edit transaction received body:", body);
        
        const {
            id,
            date,
            amount,
            categoryId,
            methodId,
            notes,
            installmentMonths,
            interestTotal,
            isSubscription,
            subscriptionInterval,
        } = body;

        // categoryId and methodId from form are already the IDs (as strings)
        const categoryIdParsed = categoryId ? parseInt(categoryId) : null;
        const methodIdParsed = methodId || null;

        console.log("Update params:", {
            id,
            date,
            amount,
            categoryIdParsed,
            methodIdParsed,
            notes,
            isSubscription,
            subscriptionInterval
        });

        const result = await db.query(
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
                categoryIdParsed,
                methodIdParsed,
                notes || null,
                isSubscription ? 1 : 0,
                subscriptionInterval || null,
                id,
            ]
        );

        console.log("Update result:", result);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Edit transaction error:", err);
        return NextResponse.json({ error: "Failed to edit transaction" }, { status: 500 });
    }
}
