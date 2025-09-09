"use client";

import Link from "next/link";
import TransactionList from "@/components/TransactionList";
import { useTransactions } from "@/hooks/useTransactions";
import { useState } from "react";
import { Filters, Transaction } from "@/types";
import TransactionFilters from "@/components/TransactionFilters";
import { useCategories } from "@/hooks/useCategories";

export default function TransactionsPage() {
  const { transactions, updateTransaction, deleteTransaction, isLoaded } = useTransactions();
  const { categories } = useCategories();

  console.log("Categhories", categories);
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
      <TransactionList 
        transactions={filtered} 
        onDelete={deleteTransaction}
        onEdit={updateTransaction}
        isLoaded={isLoaded} 
      />
    </main>
  );
}
