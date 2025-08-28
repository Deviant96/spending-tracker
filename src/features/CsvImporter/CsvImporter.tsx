"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Transaction } from "@/types";
import { CsvPreview } from "./components/CsvPreview";
import { H3 } from "@/components/typography/Headings";

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

          <CsvPreview
            preview={preview}
            handleImport={handleImport}
            loading={loading}
          />
        </>
      )}

      {imported && <p>✅ Transactions successfully imported!</p>}
    </div>
  );
}
