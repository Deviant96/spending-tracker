import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { Transaction } from "@/types";
import mysql from "mysql2/promise";

export async function POST(req: NextRequest) {
    const transactions: Transaction[] = await req.json();

    const connection = await mysql.createConnection({
        host: "localhost",
        user: "user",
        password: "pass",
        database: "whateverdb",
    });


//   try {
//     const { records } = await req.json();

//     for (const r of records) {
//       await db.query(
//         `INSERT INTO transactions 
//         (id, date, amount, category, method, notes, installment_total, installment_current, is_subscription, subscription_interval) 
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//         [
//           randomUUID(),
//           r.date,
//           parseFloat(r.amount),
//           r.category,
//           r.method,
//           r.notes || null,
//           r.installmentTotal ? parseInt(r.installmentTotal) : null,
//           r.installmentCurrent ? parseInt(r.installmentCurrent) : null,
//           r.isSubscription === "true" ? 1 : 0,
//           r.subscriptionInterval || null,
//         ]
//       );
//     }

//     return NextResponse.json({ success: true, count: records.length });
//   } catch (error) {
//     console.error(error);
//     return NextResponse.json({ error: "Failed to import CSV" }, { status: 500 });
//   }

    try {
        const values = transactions.map((tx) => [
        tx.date,
        tx.amount,
        tx.category,
        tx.method,
        tx.notes || null,
        tx.installmentTotal || null,
        tx.installmentCurrent || null,
        tx.isSubscription ? 1 : 0,
        tx.subscriptionInterval || null,
        ]);

        await connection.query(
        `INSERT INTO transactions 
        (date, amount, category, method, notes, installmentTotal, installmentCurrent, isSubscription, subscriptionInterval) 
        VALUES ?`,
        [values]
        );

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("DB error:", err);
        return NextResponse.json({ success: false, error: "DB insert failed" }, { status: 500 });
    } finally {
        await connection.end();
    }
}
