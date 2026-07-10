"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import TransactionForm from "@/components/TransactionForm";
import FeedbackBanner from "@/components/FeedbackBanner";
import { useTransactions } from "@/hooks/useTransactions";
import { Transaction } from "@/types";
import { useState } from "react";

export default function AddTransactionPage() {
  const router = useRouter();
  const { addTransaction } = useTransactions();
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (t: Transaction) => {
    setError(null);
    const result = await addTransaction(t);
    if (result.success) {
      router.push("/transactions");
    } else {
      setError(result.error);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-50 px-4 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <section className="mb-8 rounded-3xl border border-zinc-200/80 bg-white/80 p-6 shadow-[0_28px_90px_-45px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center rounded-full border border-amber-300/60 bg-amber-100/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                New Entry
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">Add Transaction</h1>
              <p className="mt-2 text-sm text-zinc-500 sm:text-base">
                Record a new expense, subscription, or installment purchase.
              </p>
            </div>

            <Link
              href="/transactions"
              className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              Back to list
            </Link>
          </div>
        </section>

        {error && <FeedbackBanner type="error" message={error} onDismiss={() => setError(null)} />}

        <section className="rounded-2xl border border-zinc-200/80 bg-white/85 p-6 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-8">
          <TransactionForm onSubmit={handleAdd} />
        </section>
      </div>
    </main>
  );
}
