### **CSV import — per-row results**

- `/api/import` processes each row independently and returns `{ successCount, failureCount, results[] }` with per-row success/error details.
- Failed rows no longer abort the whole import; successful rows are still saved.
- `CsvImporter` shows a summary and lists failed rows; successfully imported rows are removed from the preview.

### **Add transaction — wait for save**

- `addTransaction` now returns `Promise<boolean>`.
- Add page awaits the result before redirecting; shows an error message if save fails.

### **Installment vs subscription — mutually exclusive**

- Checking one option disables and clears the other.
- Zod validation rejects both being enabled at once.

### **Dead code removed**

- Deleted `src/app/api/transactions/edit/route.ts` (unused legacy route).
- Deleted `src/app/api/transactions/delete/route.ts`; delete now uses `DELETE /api/transactions/[id]`.
- Deleted legacy `src/components/CsvImporter.tsx` (import page uses `features/CsvImporter`).

### **ESLint — all 50 issues resolved**

- Replaced `any` / `@ts-ignore` with proper types via new `src/lib/mysql-types.ts`.
- Removed unused variables and debug `console.log` calls.
- Fixed `prefer-const`, React hook deps, and typed chart/form components.

### **Other fixes**

- Extended `Transaction` type with installment form fields.
- `methodId` typed as `string | number` to match actual usage.

**Verification:** `npm run lint` (0 errors), `npm run test` (1 passed), `npm run build` (success).

  


