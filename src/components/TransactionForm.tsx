"use client";

import { useState } from "react";
import { Transaction } from "@/types";

type Props = {
  onSubmit: (t: Transaction) => void;
};

export default function TransactionForm({ onSubmit }: Props) {
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState("Food");
  const [method, setMethod] = useState("Cash");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      date,
      amount,
      category,
      method,
      notes,
    };
    onSubmit(newTransaction);
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        maxWidth: "400px",
      }}
    >
      <label>
        Date:
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>

      <label>
        Amount:
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          required
        />
      </label>

      <label>
        Category:
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option>Food</option>
          <option>Transport</option>
          <option>Shopping</option>
          <option>Subscriptions</option>
          <option>Other</option>
        </select>
      </label>

      <label>
        Payment Method:
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option>Cash</option>
          <option>Card</option>
          <option>Wallet</option>
          <option>Bank Transfer</option>
        </select>
      </label>

      <label>
        Notes:
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <button type="submit">Save</button>
    </form>
  );
}
