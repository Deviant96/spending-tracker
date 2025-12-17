"use client";

import { useState, useEffect } from "react";
import { Transaction } from "@/types";
import { toCamelCase } from "@/utils/toCamelCase";

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    async function fetchTransactions() {
      try {
        const res = await fetch("/api/transactions");
        const data = await res.json();
        if (res.ok) {
          setTransactions(data.map(toCamelCase));
        } else {
          console.error("Failed to fetch transactions:", data.error);
        }
      } catch (err) {
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
      const res = await fetch(`/api/transactions/${t.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        console.log("success on editing");
        
        // Refetch the updated transaction to get the full data with category/method names
        const getRes = await fetch(`/api/transactions/${t.id}`);
        const getData = await getRes.json();
        
        if (getRes.ok && getData.data) {
          const updatedTransaction = toCamelCase(getData.data);
          setTransactions((prev) =>
            prev.map((transaction) =>
              transaction.id === t.id ? updatedTransaction : transaction
            )
          );
        }
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
    try {
      const res = await fetch("/api/transactions");
      const data = await res.json();
      if (res.ok) {
        setTransactions(data);
      } else {
        console.error("Failed to reload transactions:", data.error);
      }
    } catch (err) {
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
    isLoaded 
  };
}
