"use client";

import { useState, useEffect } from "react";
import { Transaction } from "@/types";

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("transactions");
    console.log("Loaded transactions from localStorage:", saved);
    if (saved) {
      try {
        setTransactions(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse transactions from localStorage:", e);
        setTransactions([]);
      }
    }
  }, []);

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("transactions");
    console.log("Loaded transactions from localStorage:", saved);
    if (saved) {
      try {
        setTransactions(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse transactions from localStorage:", e);
        setTransactions([]);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      console.log("Saving transactions to localStorage:", transactions);
      localStorage.setItem("transactions", JSON.stringify(transactions));
    }
  }, [transactions, isLoaded]);

  const addTransaction = (t: Transaction) => {
    console.log("Adding transaction:", t);
    setTransactions((prev) => [...prev, t]);
  };

  return { transactions, addTransaction };
}
