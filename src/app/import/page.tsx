import { H1 } from "@/components/typography/Headings";
import { Text } from "@/components/typography/Paragraph";
import CsvImporter from "@/features/CsvImporter/CsvImporter";

export default function ImportPage() {
  return (
    <main>
      <div className="mb-4">
        <H1>Import Transactions</H1>
        <Text>Upload a CSV file to add multiple transactions at once.</Text>
        <div className="mt-4">
          <Text>  
            Format <br />
            <span><em>date, amount, category, method, notes, installmentTotal, installmentNumber, subscription</em></span>
          </Text>
        </div>
      </div>
      <CsvImporter />
    </main>
  );
}
