import CsvImporter from "@/components/CsvImporter";

export default function ImportPage() {
  return (
    <main>
      <h1>Import Transactions</h1>
      <p>Upload a CSV file to add multiple transactions at once.</p>
      <p>
        Format <br />
        <em>date,amount,category,method,notes,installmentTotal,installmentNumber,subscription</em>
        </p>
      <CsvImporter />
    </main>
  );
}
