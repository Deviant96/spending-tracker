"use client";

import { Transaction } from "@/types";
import { useState } from "react";
import TransactionForm from "./TransactionForm";
import FeedbackBanner from "./FeedbackBanner";
import { formatToRupiah } from "@/utils/currency";
import { toCamelCase } from "@/utils/toCamelCase";
import { ActionResult } from "@/hooks/useTransactions";
import { Pencil, Trash2 } from "lucide-react";

type Props = {
  transactions: Transaction[];
  onDelete: (id: string) => Promise<ActionResult>;
  onEdit: (t: Transaction) => Promise<ActionResult>;
  isLoaded: boolean;
  hasLoadError?: boolean;
};

type ActionFeedback = {
  type: "success" | "error";
  message: string;
};

export default function TransactionList({ transactions, onDelete, onEdit, isLoaded, hasLoadError = false }: Props) {
  const [dialogDeleteOpen, setDialogDeleteOpen] = useState<boolean>(false);
  const [dialogEditOpen, setDialogEditOpen] = useState<boolean>(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [isLoadingTransaction, setIsLoadingTransaction] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [singleTransaction, setSingleTransaction] = useState<Transaction | undefined>(undefined);

  const handleDialogDeleteOpen = (id: string) => {
    setTransactionToDelete(id);
    setDialogError(null);
    setDialogDeleteOpen(true);
  };

  const handleDialogDeleteClose = () => {
    setDialogDeleteOpen(false);
  }

  async function getATransaction(id: string) {
    const res = await fetch(`/api/transactions/${id}`);
    // if (!res.ok) throw new Error("Failed to fetch");
    const data = await res.json();
    if (!data?.data) return data;

    const normalized = toCamelCase(data.data);
    return {
      ...data,
      data: {
        ...normalized,
        isSubscription: Boolean(normalized.isSubscription),
      },
    };
  }

  const handleDialogEditOpen = async (id: string) => {
    setDialogEditOpen(true);
    setDialogError(null);
    setIsLoadingTransaction(true);
    try {
      const data = await getATransaction(id);
      if (data?.data) {
        setSingleTransaction(data.data);
      }
    } finally {
      setIsLoadingTransaction(false);
    }
  };

  const handleDialogEditClose = () => {
    setDialogEditOpen(false);
    setSingleTransaction(undefined);
    setIsLoadingTransaction(false);
    setDialogError(null);
  };

  const handleDelete = async () => {
    if (!transactionToDelete) return;

    setIsSaving(true);
    const result = await onDelete(transactionToDelete);
    setIsSaving(false);

    if (result.success) {
      setActionFeedback({ type: "success", message: "Transaction deleted successfully." });
      setTransactionToDelete(null);
      handleDialogDeleteClose();
      return;
    }

    setDialogError(result.error);
  };

  const handleEdit = async (t: Transaction) => {
    setIsSaving(true);
    setDialogError(null);
    const result = await onEdit(t);
    setIsSaving(false);

    if (result.success) {
      setActionFeedback({ type: "success", message: "Transaction updated successfully." });
      handleDialogEditClose();
      return;
    }

    setDialogError(result.error);
  };

  if (!isLoaded) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white/80 p-8 shadow-[0_16px_60px_-28px_rgba(0,0,0,0.35)] backdrop-blur-sm">
        <div className="h-6 w-40 animate-pulse rounded bg-zinc-200" />
        <div className="mt-4 h-10 w-full animate-pulse rounded-lg bg-zinc-100" />
        <div className="mt-3 h-10 w-full animate-pulse rounded-lg bg-zinc-100" />
        <div className="mt-3 h-10 w-full animate-pulse rounded-lg bg-zinc-100" />
      </div>
    );
  }

  if (hasLoadError && transactions.length === 0) {
    return null;
  }
  
  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/75 p-10 text-center shadow-[0_20px_70px_-40px_rgba(0,0,0,0.4)] backdrop-blur-sm">
        <p className="text-lg font-semibold text-zinc-700">No transactions yet.</p>
        <p className="mt-2 text-sm text-zinc-500">Try adding your first transaction from the button above.</p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <>
      {actionFeedback && (
        <FeedbackBanner
          type={actionFeedback.type}
          message={actionFeedback.message}
          onDismiss={() => setActionFeedback(null)}
        />
      )}

      <div className="relative mt-6 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/85 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.45)] backdrop-blur-sm">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-amber-100/50 via-transparent to-cyan-100/55" />

        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-left text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Payment Method</th>
                <th className="px-4 py-3 font-semibold">Notes</th>
                <th className="px-4 py-3 font-semibold">Installment</th>
                <th className="px-4 py-3 font-semibold">Subscription</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80">
                  <td className="px-4 py-4 text-zinc-700">{formatDate(t.date)}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      {formatToRupiah(t.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-zinc-700">{t.category}</td>
                  <td className="px-4 py-4 text-zinc-700">{t.method}</td>
                  <td className="px-4 py-4 text-zinc-600">{t.notes || "-"}</td>
                  <td className="px-4 py-4">
                    {t.planMonths && (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                        {t.planMonths} months
                      </span>
                    )}
                    {t.financingStatus === 'converted' && !t.planMonths && (
                      <span className="inline-flex items-center rounded-full bg-fuchsia-50 px-2.5 py-1 text-xs font-semibold text-fuchsia-700 ring-1 ring-fuchsia-200">
                        Converted
                      </span>
                    )}
                    {!t.planMonths && t.financingStatus !== 'converted' && (
                      <span className="text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {Boolean(t.isSubscription) ? (
                      <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                        {`Subscription${t.subscriptionInterval ? ` (${t.subscriptionInterval})` : ""}`}
                      </span>
                    ) : (
                      <span className="text-zinc-400">No</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDialogEditOpen(t.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                        aria-label="Edit transaction"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDialogDeleteOpen(t.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                        aria-label="Delete transaction"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dialogDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-zinc-900">Confirm Deletion</h2>
            <p className="mt-2 text-sm text-zinc-600">Are you sure you want to delete this transaction? This action cannot be undone.</p>
            {dialogError && (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
                {dialogError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={handleDialogDeleteClose}
                disabled={isSaving}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isSaving}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {isSaving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {dialogEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-[2px]">
          <div className="w-full max-h-[90vh] max-w-2xl overflow-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-zinc-900">Edit Transaction</h2>
              <p className="text-sm text-zinc-500">Update fields and save changes.</p>
              {dialogError && (
                <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
                  {dialogError}
                </p>
              )}
            </div>
            {isLoadingTransaction ? (
              <div className="flex flex-col gap-4">
                <div className="h-6 animate-pulse rounded bg-zinc-200"></div>
                <div className="h-10 animate-pulse rounded bg-zinc-200"></div>
                <div className="h-10 animate-pulse rounded bg-zinc-200"></div>
                <div className="h-10 animate-pulse rounded bg-zinc-200"></div>
                <div className="h-10 animate-pulse rounded bg-zinc-200"></div>
                <div className="h-10 animate-pulse rounded bg-zinc-200"></div>
              </div>
            ) : (
              <TransactionForm
                onSubmit={handleEdit}
                initialTransaction={singleTransaction}
              />
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={handleDialogEditClose} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
