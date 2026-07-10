# **Spending Tracker — Project Analysis**

I ran **lint**, **build**, and **tests** and reviewed the main API routes, hooks, and UI. Here is a structured report.

## **Executive Summary**


| **Check**        | **Result**                             |
| ---------------- | -------------------------------------- |
| Production build | Passes                                 |
| TypeScript       | Passes                                 |
| Tests            | 1 test, passes                         |
| ESLint           | **50 issues** (40 errors, 10 warnings) |
| Security         | No auth; all APIs are open             |
| Test coverage    | Very low (~1 route tested)             |


The app builds and runs, but code quality, schema consistency, and missing validation are the main risks before production use.

---

## **Critical Issues**

### **1. Schema column mismatch:** `plan_id` **vs** `id`

The migration defines `installment_plans.plan_id` as the primary key:

001_add_financing_status.sqlLines 27-28

CREATE TABLE IF NOT EXISTS installment_plans (

  plan_id INT AUTO_INCREMENT PRIMARY KEY,

Some routes handle both columns via `getInstallmentPlanIdColumn()`, but others hardcode `p.id`:

- `src/app/api/installments/route.ts` — `p.id as plan_id`, `JOIN ... ON p.id = s.plan_id`
- `src/app/api/installments/[planId]/route.ts` — `WHERE p.id = ?`
- `src/app/api/reports/route.ts` and `grouped/route.ts` — `s.plan_id = p.id`

On a DB that only has `plan_id`, installment listing, detail, and cashflow reports can fail at runtime. **Standardize on one column name and use a shared helper everywhere.**

### **2. No authentication or authorization**

There is no middleware, session, or API protection. Anyone who can reach the app can read, create, edit, and delete financial data. For anything beyond local personal use, add auth (even basic API key or NextAuth).

### **3. Build ignores ESLint**

next.config.tsLines 4-8

eslint: {

*// Warning: This allows production builds to successfully complete even if*

*// your project has ESLint errors.*

  ignoreDuringBuilds: true,

},

Lint failures do not block deploys. With 40 ESLint errors, quality regressions can ship unnoticed.

### **4. CSV import is not transactional**

route.tsLines 9-31

try {

for (const r of transactions) {

*// ...*

await db.query`INSERT INTO transactions ...`);

}

If one row fails mid-loop, earlier rows stay committed. Wrap the loop in a DB transaction or return per-row results.

### **5. Add transaction redirects before save completes**

page.tsxLines 12-15

const handleAdd = (t: Transaction) => {

addTransaction(t);

router.push("/transactions"); *// Redirect after saving*

};

`addTransaction` is async but not awaited, so navigation can happen before the API finishes and the list may be stale.

---

## **Bugs & Logic Issues**

### **Installment + subscription can both be enabled**

The form allows both checkboxes with no mutual exclusion. Status resolution prefers subscription over installment, which can confuse users and reports.

### **Duplicate / dead API routes**


| **Route**                       | **Status**                                                  |
| ------------------------------- | ----------------------------------------------------------- |
| `PUT /api/transactions/[id]`    | Used by `useTransactions` — full installment rebuild        |
| `POST /api/transactions/edit`   | **Unused** — only updates transaction, no installment logic |
| `POST /api/transactions/delete` | Used by hook                                                |
| `DELETE /api/transactions/[id]` | Exists but unused                                           |


Remove or consolidate legacy routes to avoid drift.

### **Duplicate** `CsvImporter` **components**

- `src/components/CsvImporter.tsx` — legacy
- `src/features/CsvImporter/CsvImporter.tsx` — used by import page

Delete the unused copy.

### **Reports page: debug noise and dead state**

- `console.log(filters)` runs on **every render** (also visible during static build).
- `loading`, `setLoading`, `loadingGroupedSpending`, `loadingStatic`, and `abortControllerRef` are unused.

### **Default DB credentials in source**

db.tsLines 3-10

export const db = mysql.createPool({

host: process.env.DB_HOST || "localhost",

*// ...*

user: process.env.DB_USERNAME || "user",

password: process.env.DB_PASSWORD || "pass",

database: process.env.DB_DATABASE || "whateverdb",

Fine for local dev; risky if env vars are missing in production.

### `interestTotal` **unused in edit route**

In `src/app/api/transactions/edit/route.ts`, `interestTotal` is destructured but never used (ESLint warning). The route is dead code anyway.

---

## **Code Quality (ESLint)**

**40 errors**, mainly:

- `@typescript-eslint/no-explicit-any` — reports, charts, forms, utilities
- `@typescript-eslint/ban-ts-comment` — many `@ts-ignore` instead of `@ts-expect-error` or proper typing
- `prefer-const` — a few fixable cases

**10 warnings** — unused variables in reports, TransactionForm, TransactionList, CsvPreview, InstallmentManager.

---

## **Architecture & Maintainability**

### **Heavy duplication (~200+ lines repeated)**

These helpers are copy-pasted across 6+ files:

- `parseEnumValues`
- `mapToSupportedStatus` / `mapScheduleStatusToSupportedValue`
- `resolveFinancingStatusForDb`
- `resolveInstallmentScheduleStatusForDb`
- Installment schedule generation

**Recommendation:** Extract to `src/lib/db-schema.ts` and `src/lib/installments.ts`.

### **Runtime schema introspection on every request**

Routes call `SHOW COLUMNS FROM ...` to adapt to enum/column variants. That adds latency and complexity. After migration is stable, use fixed schema types and drop runtime introspection.

### **Validation is inconsistent**

- Client: Zod in `TransactionForm`
- Server: mostly manual checks; Zod is a dependency but barely used on APIs
- CSV import: no validation (amounts, dates, category IDs)

Add shared Zod schemas for API request bodies.

### **Test coverage is minimal**

Only `POST /api/transactions/add` (installment fee distribution) is tested. Missing coverage for:

- Installment convert / pay / delete lifecycle
- Cashflow vs accrual report totals
- CSV import
- Transaction CRUD edge cases

---

## **UX & Performance**

### **Large dashboard bundle**

Home route First Load JS is **256 kB** (Recharts). Consider lazy-loading `AnalyticsCharts` with `dynamic(..., { ssr: false })`.

### **Inconsistent styling**

- Dashboard / add transaction: inline styles
- Transactions page: Tailwind + polished UI

Align styling for a consistent experience.

### **Metadata still default**

layout.tsxLines 17-20

export const metadata: Metadata = {

title: "Create Next App",

description: "Generated by create next app",

};

### **User feedback gaps**

`addTransaction`, `updateTransaction`, and `deleteTransaction` only `console.error` on failure — no toast or inline error for users.

---

## **What's Working Well**

- Clear domain model: accrual vs cashflow, installment plans, financing status
- Parameterized SQL (no obvious SQL injection)
- Transactions use DB transactions for installment creation
- Remainder logic for last installment month (principal/interest/fees)
- `useTransactions` normalizes snake_case → camelCase
- Documentation exists (`PROJECT_DOC_*.md`, installment guides)
- Modern stack: Next.js 15, React 19, Tailwind 4, Vitest

---

## **Recommended Priority Order**

### **P0 — Fix before relying on installments/reports in production**

1. Unify `plan_id` vs `id` across all installment and report queries
2. Make CSV import transactional
3. Await `addTransaction` before redirect
4. Remove `console.log(filters)` from reports page

### **P1 — Quality & safety**

1. Extract shared DB/installment helpers; remove duplication
2. Fix all ESLint errors; turn off `ignoreDuringBuilds`
3. Add server-side Zod validation on API routes
4. Remove dead routes/components (`/api/transactions/edit`, duplicate CsvImporter)
5. Block installment + subscription together in the form

### **P2 — Production readiness**

1. Add authentication
2. Expand tests (installment lifecycle, report modes)
3. Lazy-load Recharts
4. Update metadata and README
5. Add user-visible error/success feedback

---

## **Quick Wins (low effort)**

npm run lint -- --fix   *# fixes ~4 prefer-const issues*

- Delete `src/components/CsvImporter.tsx`
- Delete or deprecate `src/app/api/transactions/edit/route.ts`
- Update `layout.tsx` metadata
- Make `handleAdd` async and `await addTransaction(t)`

---

I can start on any of these — the highest-impact fixes are **schema column consistency**, **lint cleanup**, and **shared installment utilities**. Say which area you want tackled first.