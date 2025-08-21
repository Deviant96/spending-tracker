"use client";

import { Transaction } from "@/types";

type Props = {
  transactions: Transaction[];
};

export default function TransactionList({ transactions }: Props) {
  if (transactions.length === 0) {
    return <p>No transactions yet.</p>;
  }

  return (
    <table
      style={{
        borderCollapse: "collapse",
        width: "100%",
        marginTop: "1rem",
      }}
    >
      <thead>
        <tr>
          <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Date</th>
          <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Amount</th>
          <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Category</th>
          <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Method</th>
          <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Notes</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((t) => (
          <tr key={t.id}>
            <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>{t.date}</td>
            <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
              {t.amount.toLocaleString()}
            </td>
            <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>{t.category}</td>
            <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>{t.method}</td>
            <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>{t.notes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
