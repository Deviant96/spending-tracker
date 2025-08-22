"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Transaction } from "@/types";

export default function CsvImporter() {
  const [preview, setPreview] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData = results.data as Transaction[];
        setPreview(parsedData);
      },
    });
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preview),
      });

      if (res.ok) {
        setImported(true);
        setPreview([]);
      } else {
        alert("Failed to import transactions.");
      }
    } catch (err) {
      console.error(err);
      alert("Error importing transactions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>Import Transactions via CSV</h3>
      <input type="file" accept=".csv" onChange={handleFileUpload} />

      {preview.length > 0 && (
        <div>
          <h4>Preview</h4>
          <table border={1} cellPadding={5}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Category</th>
                <th>Method</th>
                <th>Notes</th>
                <th>Installment</th>
                <th>Subscription</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((tx, idx) => (
                <tr key={idx}>
                  <td>{tx.date}</td>
                  <td>{tx.amount}</td>
                  <td>{tx.category}</td>
                  <td>{tx.method}</td>
                  <td>{tx.notes}</td>
                  <td>
                    {tx.installmentCurrent
                      ? `${tx.installmentCurrent} of ${tx.installmentTotal}`
                      : "-"}
                  </td>
                  <td>{tx.isSubscription ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={handleImport} disabled={loading}>
            {loading ? "Importing..." : "Confirm Import"}
          </button>
        </div>
      )}

      {imported && <p>✅ Transactions successfully imported!</p>}
    </div>
  );
}
