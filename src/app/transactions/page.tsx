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
    <main className="relative min-h-screen overflow-hidden bg-zinc-50 px-4 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <section className="mb-8 rounded-3xl border border-zinc-200/80 bg-white/80 p-6 shadow-[0_28px_90px_-45px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center rounded-full border border-amber-300/60 bg-amber-100/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                Spending Overview
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">Transactions</h1>
              <p className="mt-2 text-sm text-zinc-500 sm:text-base">Review, filter, and update your spending history in one place.</p>
            </div>

            <Link
              href="/transactions/add"
              className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              + Add Transaction
            </Link>
          </div>
        </section>

        <TransactionFilters
          filters={filters}
          setFilters={setFilters}
          categories={categories.map(c => c.name)}
          years={years}
        />

        {loadError && (
          <div
            role="alert"
            className="mb-5 mt-6 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-sm font-medium">
              Unable to load transactions right now. Please check your connection and try again.
            </span>
            <button
              onClick={reloadTransactions}
              className="inline-flex items-center justify-center rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
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
      </div>
    </main>
  );
}
