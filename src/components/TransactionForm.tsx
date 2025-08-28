"use client";

import { useState, useEffect } from "react";
import { Category, PaymentMethod, Transaction } from "@/types";
import { formatToRupiah } from "@/utils/currency";

type Props = {
  onSubmit: (t: Transaction) => void;
  initialTransaction?: Transaction | null;
};

export default function TransactionForm({ onSubmit, initialTransaction }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [form, setForm] = useState({
    id: initialTransaction?.id ?? crypto.randomUUID(),
    date: initialTransaction?.date
      ? initialTransaction.date
      : null,
    amount: initialTransaction?.amount ?? 0,
    categoryId: initialTransaction?.categoryId ?? "",
    methodId: initialTransaction?.methodId ?? "",
    notes: initialTransaction?.notes ?? "",
    isInstallment:
      !!initialTransaction?.installmentTotal ||
      !!initialTransaction?.installmentCurrent,
    installmentTotal: initialTransaction?.installmentTotal ?? undefined,
    installmentCurrent: initialTransaction?.installmentCurrent ?? undefined,
    isSubscription: initialTransaction?.isSubscription ?? false,
    subscriptionInterval: initialTransaction?.subscriptionInterval ?? undefined,
  });

  const fetchCategories = async () => {
    const response = await fetch("/api/categories");
    const { data } = await response.json();
    setCategories(data);
  }

  const fetchPaymentMethods = async () => {
    const response = await fetch("/api/payment-methods");
    const { data } = await response.json();
    setPaymentMethods(data);
  };

  useEffect(() => {
    fetchCategories();
    fetchPaymentMethods();
    
    if (initialTransaction) {
      setForm({
        id: initialTransaction.id,
        date: initialTransaction.date,
        amount: initialTransaction.amount,
        categoryId: initialTransaction.categoryId ?? "",
        methodId: initialTransaction.methodId ?? "",
        notes: initialTransaction.notes ?? "",
        isInstallment:
          !!initialTransaction.installmentTotal ||
          !!initialTransaction.installmentCurrent,
        installmentTotal: initialTransaction.installmentTotal ?? undefined,
        installmentCurrent: initialTransaction.installmentCurrent ?? undefined,
        isSubscription: initialTransaction.isSubscription ?? false,
        subscriptionInterval: initialTransaction.subscriptionInterval ?? undefined,
      });
    }
  }, [initialTransaction]);

  const handleChange = (
    key: keyof typeof form,
    value: string | number | boolean | undefined
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const transaction: Transaction = {
      ...form,
      date: form.date || "", // Ensure date is a string
    };
    onSubmit(transaction);
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
        <input
          type="date"
          value={form.date || ""}
          onChange={(e) => handleChange("date", e.target.value)}
          required
        />
      </label>

      <label>
        Amount:
        <input
          type="number"
          value={Number(form.amount) ?? ""}
          onChange={(e) => handleChange("amount", Number(e.target.value))}
          required
        />
        <small 
          style={{ 
            display: "block", 
            marginTop: "4px", 
            color: "#888", 
            fontSize: "0.8em" 
            }}
        >
          {formatToRupiah(form.amount)}
        </small>
      </label>

      <label>
        Category:
        <select
          value={form.categoryId ?? ""}
          onChange={(e) => handleChange("categoryId", e.target.value)}
        >
          {categories.map((category: Category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Payment Method:
        <select
          value={form.methodId ?? ""}
          onChange={(e) => handleChange("methodId", e.target.value)}
        >
          {paymentMethods.map((method: PaymentMethod) => (
            <option key={method.id} value={method.id}>
              {method.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Notes:
        <input
          type="text"
          value={form.notes ?? ""}
          onChange={(e) => handleChange("notes", e.target.value)}
        />
      </label>

      <label>
        <input
          type="checkbox"
          checked={form.isInstallment ?? ""}
          onChange={(e) => handleChange("isInstallment", e.target.checked)}
        />
        Is Installment?
      </label>
      {form.isInstallment && (
        <>
          <input
            type="number"
            placeholder="Installment Current"
            value={form.installmentCurrent ?? ""}
            onChange={(e) =>
              handleChange(
                "installmentCurrent",
                e.target.value === "" ? undefined : Number(e.target.value)
              )
            }
            min={1}
          />
          <input
            type="number"
            placeholder="Installment Total"
            value={form.installmentTotal ?? ""}
            onChange={(e) =>
              handleChange(
                "installmentTotal",
                e.target.value === "" ? undefined : Number(e.target.value)
              )
            }
            min={1}
          />
        </>
      )}

      <label>
        <input
          type="checkbox"
          checked={form.isSubscription ?? ""}
          onChange={(e) => handleChange("isSubscription", e.target.checked)}
        />
        Is Subscription?
      </label>

      {form.isSubscription && (
        <select
          value={form.subscriptionInterval ?? ""}
          onChange={(e) =>
            handleChange(
              "subscriptionInterval",
              e.target.value === ""
                ? undefined
                : (e.target.value as "weekly" | "monthly" | "yearly")
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

      <button type="submit">
        {initialTransaction ? "Update" : "Save"}
      </button>
    </form>
  );
}
