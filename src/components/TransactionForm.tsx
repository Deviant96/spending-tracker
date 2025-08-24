"use client";

import { useState, useEffect } from "react";
import { Transaction } from "@/types";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import { formatToRupiah } from "@/utils/currency";

type Props = {
  onSubmit: (t: Transaction) => void;
  initialTransaction?: Transaction | null;
};

export default function TransactionForm({ onSubmit, initialTransaction }: Props) {
  const [form, setForm] = useState({
    id: initialTransaction?.id ?? crypto.randomUUID(),
    date: initialTransaction?.date
      ? dayjs(initialTransaction.date)
      : dayjs(),
    amount: initialTransaction?.amount ?? 0,
    category: initialTransaction?.category ?? "Food",
    method: initialTransaction?.method ?? "Cash",
    notes: initialTransaction?.notes ?? "",
    isInstallment:
      !!initialTransaction?.installmentTotal ||
      !!initialTransaction?.installmentCurrent,
    installmentTotal: initialTransaction?.installmentTotal ?? undefined,
    installmentCurrent: initialTransaction?.installmentCurrent ?? undefined,
    isSubscription: initialTransaction?.isSubscription ?? false,
    subscriptionInterval: initialTransaction?.subscriptionInterval ?? undefined,
  });

  useEffect(() => {
    if (initialTransaction) {
      setForm({
        id: initialTransaction.id,
        date: dayjs(initialTransaction.date),
        amount: initialTransaction.amount,
        category: initialTransaction.category,
        method: initialTransaction.method,
        notes: initialTransaction.notes,
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
    value: string | number | boolean | Dayjs | undefined
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const transaction: Transaction = {
      ...form,
      date: form.date ? form.date.format("YYYY-MM-DD") : "",
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
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            value={form.date ?? ""}
            onChange={(val) => handleChange("date", val || dayjs())}
            slotProps={{
              textField: { helperText: "MM/DD/YYYY" },
            }}
          />
        </LocalizationProvider>
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
          value={form.category ?? ""}
          onChange={(e) => handleChange("category", e.target.value)}
        >
          <option>Food</option>
          <option>Transport</option>
          <option>Shopping</option>
          <option>Subscriptions</option>
          <option>Other</option>
        </select>
      </label>

      <label>
        Payment Method:
        <select
          value={form.method ?? ""}
          onChange={(e) => handleChange("method", e.target.value)}
        >
          <option>Cash</option>
          <option>Card</option>
          <option>Wallet</option>
          <option>Bank Transfer</option>
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
