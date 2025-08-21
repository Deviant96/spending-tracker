"use client";

import Link from "next/link";
import TransactionList from "@/components/TransactionList";
import { useTransactions } from "@/hooks/useTransactions";

export default function TransactionsPage() {
  const { transactions } = useTransactions();

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Transactions</h1>
      <Link href="/transactions/add">+ Add Transaction</Link>
      <TransactionList transactions={transactions} />
    </main>
  );
}
