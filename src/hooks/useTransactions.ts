"use client";

import { useState, useEffect } from "react";
import { Transaction } from "@/types";
import { toCamelCase } from "@/utils/toCamelCase";

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const normalizeTransaction = (raw: unknown): Transaction => {
    const normalized = toCamelCase((raw ?? {}) as Record<string, unknown>);
    return {
      ...normalized,
      isSubscription: Boolean(normalized.isSubscription),
    } as Transaction;
  };

  const getErrorMessage = (data: unknown, fallback: string) => {
    if (typeof data === "object" && data !== null && "error" in data) {
      const message = (data as { error?: unknown }).error;
      if (typeof message === "string" && message.trim().length > 0) {
        return message;
      }
    }

    return fallback;
  };

  useEffect(() => {
    async function fetchTransactions() {
      try {
        const res = await fetch("/api/transactions");
        const isJsonResponse = res.headers.get("content-type")?.includes("application/json");
        const data = isJsonResponse ? await res.json() : { error: await res.text() };

        if (res.ok) {
          setTransactions(data.map(normalizeTransaction));
          setLoadError(null);
        } else {
          const message = getErrorMessage(data, "Unable to load transactions right now.");
          setLoadError(message);
          console.error("Failed to fetch transactions:", message);
        }
      } catch (err) {
        setLoadError("Unable to connect to the server. Please try again.");
        console.error("Error loading transactions:", err);
      } finally {
        setIsLoaded(true);
      }
    }

    fetchTransactions();
  }, []);

  const addTransaction = async (t: Transaction) => {
    try {
      const res = await fetch("/api/transactions/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTransactions((prev) => [...prev, { ...t }]);
      } else {
        console.error("Failed to add transaction:", data.error);
      }
    } catch (err) {
      console.error("Error adding transaction:", err);
    }
  };

  const updateTransaction = async (t: Transaction) => {
    try {
      const res = await fetch(`/api/transactions/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        let refreshed: Transaction | null = null;

        try {
          const detailRes = await fetch(`/api/transactions/${t.id}`);
          const detailData = await detailRes.json();
          if (detailRes.ok && detailData?.data) {
            const normalized = toCamelCase(detailData.data);
            refreshed = {
              ...normalized,
              isSubscription: Boolean(normalized.isSubscription),
            };
          }
        } catch (detailErr) {
          console.error("Failed to refresh updated transaction:", detailErr);
        }

        setTransactions((prev) =>
          prev.map((transaction) => {
            if (transaction.id !== t.id) return transaction;

            const merged = {
              ...transaction,
              ...t,
              ...(refreshed || {}),
            };

            return {
              ...merged,
              category: merged.category ?? transaction.category,
              method: merged.method ?? transaction.method,
            };
          })
        );
      } else {
        console.error("Failed to update transaction:", data.error);
      }
    } catch (err) {
      console.error("Error updating transaction:", err);
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      const res = await fetch(`/api/transactions/delete`, {
        method: "POST",
        body: JSON.stringify({
          id: id,
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTransactions((prev) => 
          prev.filter((transaction) => transaction.id !== id)
        );
        return true;
      } else {
        console.error("Failed to delete transaction:", data.error);
      }
    } catch (err) {
      console.error("Error deleting transaction:", err);
    }
  };

  const getTransaction = (id: string): Transaction | undefined => {
    return transactions.find((transaction) => transaction.id === id);
  };

  const reloadTransactions = async () => {
    setIsLoaded(false);
    setLoadError(null);
    try {
      const res = await fetch("/api/transactions");
      const isJsonResponse = res.headers.get("content-type")?.includes("application/json");
      const data = isJsonResponse ? await res.json() : { error: await res.text() };

      if (res.ok) {
        setTransactions(data.map(normalizeTransaction));
        setLoadError(null);
      } else {
        const message = getErrorMessage(data, "Unable to reload transactions right now.");
        setLoadError(message);
        console.error("Failed to reload transactions:", message);
      }
    } catch (err) {
      setLoadError("Unable to connect to the server. Please try again.");
      console.error("Error reloading transactions:", err);
    } finally {
      setIsLoaded(true);
    }
  };

  return { 
    transactions, 
    addTransaction, 
    updateTransaction, 
    deleteTransaction,
    getTransaction,
    reloadTransactions,
    isLoaded,
    loadError,
  };
}
