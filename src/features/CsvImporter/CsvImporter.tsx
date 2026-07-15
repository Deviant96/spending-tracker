"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Transaction } from "@/types";
import { CsvPreview } from "./components/CsvPreview";
import { H3 } from "@/components/typography/Headings";
import type { ImportRowResult } from "@/app/api/import/route";

type ImportResponse = {
  success: boolean;
  successCount: number;
  failureCount: number;
  count: number;
  results: ImportRowResult[];
};

export type RowSuggestion = {
  index: number;
  category: { categoryId?: number; categoryName: string; confidence: number; reason: string } | null;
  paymentMethodHint: string | null;
  isLikelyInstallment: boolean;
  isLikelySubscription: boolean;
  flags: string[];
};

export default function CsvImporter() {
  const [preview, setPreview] = useState<Transaction[]>([]);
  const [suggestions, setSuggestions] = useState<RowSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [importResults, setImportResults] = useState<ImportResponse | null>(null);

  const classifyRows = async (rows: Transaction[]) => {
    setClassifying(true);
    try {
      const res = await fetch("/api/ai/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rows.map((r, index) => ({
            index,
            notes: r.notes,
            amount: Number(r.amount),
          })),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const classified = json.data as RowSuggestion[];
        setSuggestions(classified);

        setPreview((prev) =>
          prev.map((row, index) => {
            const s = classified.find((c) => c.index === index);
            if (!s) return row;
            return {
              ...row,
              categoryId: row.categoryId || s.category?.categoryId,
              isSubscription: row.isSubscription || s.isLikelySubscription,
              category: row.category || s.category?.categoryName,
            };
          })
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setClassifying(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportResults(null);
    setSuggestions([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData = results.data as Transaction[];
        setPreview(parsedData);
        void classifyRows(parsedData);
      },
    });
  };

  const handleImport = async () => {
    setLoading(true);
    setImportResults(null);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preview),
      });

      const data: ImportResponse = await res.json();
      setImportResults(data);

      if (data.successCount > 0) {
        setPreview((prev) =>
          prev.filter((_, index) => !data.results.find((r) => r.index === index && r.success))
        );
        setSuggestions((prev) =>
          prev.filter((s) => !data.results.find((r) => r.index === s.index && r.success))
        );
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
      <div className="mb-6">
        <H3>Import Transactions via CSV</H3>
        <p className="mt-1 text-sm text-zinc-500">
          After upload, notes are auto-classified for category, subscription, and installment hints.
        </p>
        <div className="my-4 rounded-lg bg-zinc-100 p-4">
          <label className="mb-2 block text-sm font-medium text-zinc-700">Choose CSV file</label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="block w-full cursor-pointer text-sm text-zinc-500 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700"
          />
        </div>
      </div>

      {classifying && (
        <p className="mb-3 text-sm text-zinc-500">Classifying rows from notes…</p>
      )}

      {preview.length > 0 && (
        <>
          <button
            onClick={handleImport}
            disabled={loading}
            className="mb-4 cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white transition-colors duration-200 hover:bg-zinc-700 disabled:bg-zinc-400"
          >
            {loading ? "Importing..." : "Confirm Import"}
          </button>

          <CsvPreview preview={preview} suggestions={suggestions} />
        </>
      )}

      {importResults && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <p className="font-medium">
            Import complete: {importResults.successCount} succeeded,{" "}
            {importResults.failureCount} failed (of {importResults.count})
          </p>
          {importResults.failureCount > 0 && (
            <ul className="ml-5 mt-2 list-disc text-sm text-rose-700">
              {importResults.results
                .filter((r) => !r.success)
                .map((r) => (
                  <li key={r.index}>
                    Row {r.index + 1}: {r.error}
                  </li>
                ))}
            </ul>
          )}
          {importResults.success && (
            <p className="mt-2 text-emerald-700">All rows imported successfully.</p>
          )}
        </div>
      )}
    </div>
  );
}
