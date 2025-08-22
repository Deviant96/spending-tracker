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
  const [isInstallment, setIsInstallment] = useState<boolean>(false);
  const [installmentTotal, setInstallmentTotal] = useState<number | undefined>(undefined);
  const [installmentCurrent, setInstallmentCurrent] = useState<number | undefined>(undefined);
  const [isSubscription, setIsSubscription] = useState(false);
  const [subscriptionInterval, setSubscriptionInterval] = useState<"weekly" | "monthly" | "yearly" | undefined>(undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      date,
      amount,
      category,
      method,
      notes,
      installmentTotal,
      installmentCurrent,
      isSubscription,
      subscriptionInterval
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

      {/* 🔹 Installment Fields */}
      <label>
        <input
          type="checkbox"
          name="isInstallment"
          checked={isInstallment}
          onChange={(e) => setIsInstallment(e.target.checked)}
        />
        Is Installment?
      </label>
      {isInstallment && (
        <>
          <input
            type="number"
            name="installmentCurrent"
            placeholder="Installment Current (e.g. 2)"
            value={installmentCurrent || ""}
            onChange={(e) => setInstallmentCurrent(e.target.value === "" ? undefined : Number(e.target.value))}
            min={1}
          />
          <input
            type="number"
            name="installmentTotal"
            placeholder="Installment Total (e.g. 4)"
            value={installmentTotal || ""}
            onChange={(e) => setInstallmentTotal(e.target.value === "" ? undefined : Number(e.target.value))}
            min={1}
          />
        </>
      )}

      {/* 🔹 Subscription Fields */}
      <label>
        <input
          type="checkbox"
          name="isSubscription"
          checked={isSubscription || false}
          onChange={(e) => setIsSubscription(e.target.checked)}
        />
        Is Subscription?
      </label>

      {isSubscription && (
        <select
          name="subscriptionInterval"
          value={subscriptionInterval || ""}
          onChange={(e) =>
            setSubscriptionInterval(
              e.target.value === ""
                ? undefined
                : e.target.value as "weekly" | "monthly" | "yearly"
            )
          }
          required
        >
          <option value="">Select Interval</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      )}

      <button type="submit">Save</button>
    </form>
  );
}
