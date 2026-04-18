import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function normalizeDateForSql(value: unknown): string | null {
    if (!value) return null;

    const raw = String(value).trim();
    if (!raw) return null;

    // Already in MySQL DATE format
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

type CanonicalFinancingStatus = "one_time" | "converted" | "subscription";

function parseEnumValues(columnType: string): string[] {
    const match = columnType.match(/^enum\((.*)\)$/i);
    if (!match) return [];

    return match[1]
        .split(",")
        .map((raw) => raw.trim().replace(/^'/, "").replace(/'$/, ""));
}

function mapToSupportedStatus(
    desiredStatus: CanonicalFinancingStatus,
    supportedValues: string[]
): string | null {
    const byPreference: Record<CanonicalFinancingStatus, string[]> = {
        one_time: ["one_time", "single", "normal", "cash", "one-time", "once"],
        converted: ["converted", "installment", "installments", "financed", "cicilan"],
        subscription: ["subscription", "recurring", "repeat", "berlangganan"],
    };

    const normalizedMap = new Map(supportedValues.map((value) => [value.toLowerCase(), value]));
    for (const candidate of byPreference[desiredStatus]) {
        const found = normalizedMap.get(candidate.toLowerCase());
        if (found) return found;
    }

    return null;
}

async function resolveFinancingStatusForDb(desiredStatus: CanonicalFinancingStatus): Promise<string | null> {
    const [rows] = await db.query("SHOW COLUMNS FROM transactions LIKE 'financing_status'");
    const column = Array.isArray(rows) && rows.length > 0 ? (rows[0] as { Type?: string }) : null;

    if (!column?.Type) {
        return null;
    }

    const supportedValues = parseEnumValues(column.Type);
    if (supportedValues.length === 0) {
        return null;
    }

    return mapToSupportedStatus(desiredStatus, supportedValues);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            id,
            date,
            amount,
            categoryId,
            category,
            methodId,
            method,
            notes,
            isInstallment,
            installmentMonths,
            interestTotal,
            isSubscription,
            subscriptionInterval,
        } = body;

        // Support both old and new payload names
        const normalizedCategoryId = categoryId ?? category;
        const normalizedMethodId = methodId ?? method;

        const parsedCategoryId = normalizedCategoryId ? parseInt(String(normalizedCategoryId), 10) : null;
        const parsedMethodId = normalizedMethodId ? String(normalizedMethodId) : null;

        const shouldBeConverted = Boolean(isInstallment) && Number(installmentMonths || 0) > 1;
        const desiredStatus: CanonicalFinancingStatus = isSubscription
            ? "subscription"
            : shouldBeConverted
                ? "converted"
                : "one_time";
        const normalizedDate = normalizeDateForSql(date);

        if (!normalizedDate) {
            return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
        }

        const dbFinancingStatus = await resolveFinancingStatusForDb(desiredStatus);

        const updateQuery = dbFinancingStatus
            ? `UPDATE transactions SET
                date = ?,
                amount = ?,
                category_id = ?,
                method_id = ?,
                notes = ?,
                is_subscription = ?,
                subscription_interval = ?,
                financing_status = ?
            WHERE id = ?`
            : `UPDATE transactions SET
                date = ?,
                amount = ?,
                category_id = ?,
                method_id = ?,
                notes = ?,
                is_subscription = ?,
                subscription_interval = ?
            WHERE id = ?`;

        const updateParams = dbFinancingStatus
            ? [
                normalizedDate,
                amount,
                parsedCategoryId,
                parsedMethodId,
                notes || null,
                isSubscription ? 1 : 0,
                subscriptionInterval || null,
                dbFinancingStatus,
                id,
            ]
            : [
                normalizedDate,
                amount,
                parsedCategoryId,
                parsedMethodId,
                notes || null,
                isSubscription ? 1 : 0,
                subscriptionInterval || null,
                id,
            ];

        await db.query(updateQuery, updateParams);

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
