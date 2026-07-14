import { H4 } from "@/components/typography/Headings";
import { Transaction } from "@/types";
import type { RowSuggestion } from "../CsvImporter";

type Props = {
  preview: Transaction[];
  suggestions?: RowSuggestion[];
};

export function CsvPreview({ preview, suggestions = [] }: Props) {
  return (
    <div>
      <H4>Preview</H4>
      <div className="overflow-x-auto">
        <table className="min-w-full rounded-lg border border-zinc-200">
          <thead className="bg-zinc-50">
            <tr>
              <th className="border-b px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Date
              </th>
              <th className="border-b px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Amount
              </th>
              <th className="border-b px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Category
              </th>
              <th className="border-b px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Notes
              </th>
              <th className="border-b px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                AI hints
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
            {preview.map((tx, idx) => {
              const s = suggestions.find((x) => x.index === idx);
              return (
                <tr key={idx} className="hover:bg-zinc-50">
                  <td className="px-4 py-2 text-sm text-zinc-900">{tx.date}</td>
                  <td className="px-4 py-2 text-sm font-medium text-zinc-900">{tx.amount}</td>
                  <td className="px-4 py-2 text-sm text-zinc-900">
                    {tx.category || tx.categoryId || "—"}
                    {s?.category && (
                      <span className="mt-1 block text-[11px] text-zinc-400">
                        suggested {s.category.categoryName} ({Math.round(s.category.confidence * 100)}%)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm text-zinc-500">{tx.notes}</td>
                  <td className="px-4 py-2 text-xs text-zinc-600">
                    <div className="flex flex-wrap gap-1">
                      {s?.isLikelySubscription && (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700 ring-1 ring-sky-200">
                          subscription?
                        </span>
                      )}
                      {s?.isLikelyInstallment && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 ring-1 ring-amber-200">
                          installment?
                        </span>
                      )}
                      {s?.paymentMethodHint && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600 ring-1 ring-zinc-200">
                          {s.paymentMethodHint}
                        </span>
                      )}
                      {s?.flags?.map((f) => (
                        <span
                          key={f}
                          className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700 ring-1 ring-rose-200"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
