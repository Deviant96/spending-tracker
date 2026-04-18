"use client";

import Link from "next/link";
import TransactionList from "@/components/TransactionList";
import { useTransactions } from "@/hooks/useTransactions";
import { useState } from "react";
import { Filters, Transaction } from "@/types";
import TransactionFilters from "@/components/TransactionFilters";
import { useCategories } from "@/hooks/useCategories";

export default function TransactionsPage() {
  const { transactions, updateTransaction, deleteTransaction, isLoaded, loadError, reloadTransactions } = useTransactions();
  const { categories } = useCategories();

  const [filters, setFilters] = useState<Filters>({
    category: "all",
    month: "all",
    year: "all",
    search: "",
  });

  const years = Array.from(new Set(transactions.map(t => new Date(t.date).getFullYear())));

  const filtered = transactions.filter((t: Transaction) => {
    const tDate = new Date(t.date);
    const matchCategory = filters.category === "all" || t.category === filters.category;
    const matchMonth = filters.month === "all" || tDate.getMonth() + 1 === Number(filters.month);
    const matchYear = filters.year === "all" || tDate.getFullYear() === Number(filters.year);
    const matchSearch =
      filters.search === "" ||
      t.notes?.toLowerCase().includes(filters.search.toLowerCase()) ||
      (t.category && categories.find(cat => cat.name === t.category)?.name.toLowerCase().includes(filters.search.toLowerCase()));

    return matchCategory && matchMonth && matchYear && matchSearch;
  });

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Transactions</h1>

      <TransactionFilters
        filters={filters}
        setFilters={setFilters}
        categories={categories.map(c => c.name)}
        years={years}
      />

      <Link href="/transactions/add">+ Add Transaction</Link>

      {loadError && (
        <div
          role="alert"
          style={{
            marginTop: "1rem",
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            border: "1px solid #f5c2c7",
            backgroundColor: "#fff5f5",
            color: "#842029",
            borderRadius: "8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <span>
            Unable to load transactions right now. Please check your connection and try again.
          </span>
          <button
            onClick={reloadTransactions}
            style={{
              border: "1px solid #842029",
              borderRadius: "6px",
              padding: "0.35rem 0.7rem",
              background: "transparent",
              color: "#842029",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      )}

      <TransactionList 
        transactions={filtered} 
        onDelete={deleteTransaction}
        onEdit={updateTransaction}
        isLoaded={isLoaded}
        hasLoadError={Boolean(loadError)}
      />
    </main>
  );
}
