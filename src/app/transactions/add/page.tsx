"use client";

import { useRouter } from "next/navigation";
import TransactionForm from "@/components/TransactionForm";
import { useTransactions } from "@/hooks/useTransactions";
import { Transaction } from "@/types";

export default function AddTransactionPage() {
  const router = useRouter();
  const { addTransaction } = useTransactions();

  const handleAdd = (t: Transaction) => {
    addTransaction(t);
    router.push("/transactions"); // Redirect after saving
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Add Transaction</h1>
      <TransactionForm onSubmit={handleAdd} />
    </main>
  );
}
