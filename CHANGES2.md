All six improvements are implemented. Summary:

1. Schema column mismatch (plan_id vs id)
All installment and report routes now use getInstallmentPlanIdColumn() from the shared lib instead of hardcoded p.id. Updated routes:

installments/route.ts, installments/[planId]/route.ts, installments/[planId]/pay/route.ts
reports/route.ts, reports/grouped/route.ts
transactions/route.ts, transactions/[id]/route.ts
2. Shared helper extraction
New shared modules:

src/lib/db-schema.ts — enum parsing, financing/schedule status resolution, date normalization, getInstallmentPlanIdColumn
src/lib/installments.ts — generateInstallmentScheduleValues, insertInstallmentSchedule
Duplicated logic removed from 6+ API route files.

3. Recharts lazy-load
Dashboard uses dynamic(() => import("@/components/AnalyticsCharts"), { ssr: false }) with a skeleton loader.

4–5. User & error feedback
useTransactions now returns ActionResult ({ success: true } or { success: false, error: string }) for add/update/delete
New FeedbackBanner component
TransactionList shows success banners and inline errors in edit/delete dialogs; dialogs stay open on failure
Add page shows server error messages via FeedbackBanner
6. Consistent Tailwind styling
Dashboard, add page, and InsightsBox now match the transactions page layout (zinc palette, rounded cards, backdrop blur, badge headers).

Verification: npm run lint passes with 0 errors.

Note: npm run build failed because vitest isn't installed in node_modules (likely after the hard reset). Run npm install locally, then npm run build and npm run test to verify fully.