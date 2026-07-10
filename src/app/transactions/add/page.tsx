"use client";

import { useRouter } from "next/navigation";
import TransactionForm from "@/components/TransactionForm";
import { useTransactions } from "@/hooks/useTransactions";
import { Transaction } from "@/types";
import { useState } from "react";

export default function AddTransactionPage() {
  const router = useRouter();
  const { addTransaction } = useTransactions();
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (t: Transaction) => {
    setError(null);
    const success = await addTransaction(t);
    if (success) {
      router.push("/transactions");
    } else {
      setError("Failed to save transaction. Please try again.");
    }
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Add Transaction</h1>
      {error && (
        <p style={{ color: "red", marginBottom: "1rem" }} role="alert">
          {error}
        </p>
      )}
      <TransactionForm onSubmit={handleAdd} />
    </main>
  );
}
