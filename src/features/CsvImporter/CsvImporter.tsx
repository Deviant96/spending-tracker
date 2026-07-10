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

export default function CsvImporter() {
  const [preview, setPreview] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [importResults, setImportResults] = useState<ImportResponse | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportResults(null);

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
        <div className="my-4 bg-gray-100 p-4 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Choose CSV file
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer cursor-pointer"
          />
        </div>
      </div>

      {preview.length > 0 && (
        <>
          <button
            onClick={handleImport}
            disabled={loading}
            className="cursor-pointer bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 mb-4"
          >
            {loading ? "Importing..." : "Confirm Import"}
          </button>

          <CsvPreview preview={preview} />
        </>
      )}

      {importResults && (
        <div className="mt-4 p-4 rounded-lg border border-gray-200 bg-gray-50">
          <p className="font-medium">
            Import complete: {importResults.successCount} succeeded,{" "}
            {importResults.failureCount} failed (of {importResults.count})
          </p>
          {importResults.failureCount > 0 && (
            <ul className="mt-2 text-sm text-red-700 list-disc ml-5">
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
            <p className="mt-2 text-green-700">All rows imported successfully.</p>
          )}
        </div>
      )}
    </div>
  );
}
