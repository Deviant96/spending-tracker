import { H4 } from "@/components/typography/Headings";

export function CsvPreview({ preview, handleImport, loading }: { preview: any[]; handleImport: () => void; loading: boolean }) {
  return (
    <div>
      <H4>Preview</H4>
    <div className="overflow-x-auto">
      <table className="min-w-full border border-gray-200 rounded-lg">
        <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Date</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Amount</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Category</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Method</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Notes</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Installment</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Subscription</th>
        </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
        {preview.map((tx, idx) => (
          <tr key={idx} className="hover:bg-gray-50">
            <td className="px-4 py-2 text-sm text-gray-900">{tx.date}</td>
            <td className="px-4 py-2 text-sm text-gray-900 font-medium">{tx.amount}</td>
            <td className="px-4 py-2 text-sm text-gray-900">{tx.category}</td>
            <td className="px-4 py-2 text-sm text-gray-900">{tx.method}</td>
            <td className="px-4 py-2 text-sm text-gray-500">{tx.notes}</td>
            <td className="px-4 py-2 text-sm text-gray-900">
            {tx.installmentCurrent
              ? `${tx.installmentCurrent} of ${tx.installmentTotal}`
              : "-"}
            </td>
            <td className="px-4 py-2 text-sm text-gray-900">{tx.isSubscription ? "Yes" : "No"}</td>
          </tr>
        ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}