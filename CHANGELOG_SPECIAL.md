# Special Changelog

Purpose:
Track implementation changes with enough context to understand what changed, why it changed, and how it was implemented.

## Required Entry Rules
Every new entry MUST include all sections below:
1. What Changed
2. Why
3. How
4. Files Touched
5. Verification

If Why or How is missing, the entry is invalid.

## Entry Template

### [YYYY-MM-DD] <short title>
What Changed:
- <bullet>

Why:
- <business or technical reason>

How:
- <implementation approach>
- <important logic decisions>

Files Touched:
- <path>

Verification:
- <tests run / checks performed>
- <result>

---

## Entries

### [2026-04-20] Remove unsafe pending fallback for schedule status
What Changed:
- Removed hardcoded `pending` fallback from schedule inserts in add, convert, and update paths.
- When status mapping is unavailable, schedule insert now omits status column and relies on DB default.
- Pay endpoint now works even without mapped paid status by always setting `paid_at` and using `paid_at` for completion checks.

Why:
- Some schemas still rejected hardcoded `pending`, causing status truncation errors during update.
- Falling back to DB defaults is safer than forcing an unknown enum label.

How:
- Added conditional insert SQL shapes: with status when mapped, without status when unmapped.
- Changed pay completion query to `paid_at IS NOT NULL`, reducing enum dependency.

Files Touched:
- src/app/api/transactions/[id]/route.ts
- src/app/api/transactions/add/route.ts
- src/app/api/installments/route.ts
- src/app/api/installments/[planId]/pay/route.ts
- CHANGELOG_SPECIAL.md

Verification:
- Checked diagnostics for edited files (no TypeScript errors).
- Executed `npm test`.
- Result: tests pass.

### [2026-04-20] Fix schedule status enum compatibility
What Changed:
- Replaced hardcoded installment schedule status writes (`pending`, `paid`) with schema-aware mappings.
- Applied dynamic status resolution in add, convert, update, pay, and reporting paths.

Why:
- Production update failed with `Data truncated for column 'status'` because DB enum values differed from hardcoded status literals.
- Status-dependent logic (pay completion and cashflow reporting) also risked incorrect behavior when enum labels differ.

How:
- Added enum introspection for `installment_schedule.status` using `SHOW COLUMNS` and canonical-to-supported mapping.
- Schedule inserts now write mapped pending status.
- Pay endpoint now writes mapped paid status and uses mapped paid status in completion checks.
- Installment listing and cashflow report now use mapped paid/pending statuses for consistent aggregation.

Files Touched:
- src/app/api/transactions/add/route.ts
- src/app/api/installments/route.ts
- src/app/api/transactions/[id]/route.ts
- src/app/api/installments/[planId]/pay/route.ts
- src/app/api/reports/route.ts
- CHANGELOG_SPECIAL.md

Verification:
- Checked diagnostics for edited files (no TypeScript errors).
- Executed `npm test`.
- Result: tests pass.

### [2026-04-20] Fix due_month format for DATE-based schemas
What Changed:
- Fixed installment schedule generation to write `due_month` in schema-compatible format.
- Applied the fix to all schedule generation paths: add transaction, convert transaction, and update transaction.
- Updated pay endpoint and cashflow report SQL to compare/group by month token consistently across schema variants.

Why:
- Production update failed with `Incorrect date value: 'YYYY-MM'` when `installment_schedule.due_month` was DATE-like.
- Existing SQL logic assumed `due_month` was always stored as `YYYY-MM` string.

How:
- Added schema checks (`SHOW COLUMNS ... due_month`) and write `YYYY-MM-01` for DATE-like columns.
- Kept legacy `YYYY-MM` writes for non-date/text schemas.
- Normalized read-side queries to month token with `LEFT(CAST(due_month AS CHAR), 7)` in pay/report paths.

Files Touched:
- src/app/api/transactions/[id]/route.ts
- src/app/api/transactions/add/route.ts
- src/app/api/installments/route.ts
- src/app/api/installments/[planId]/pay/route.ts
- src/app/api/reports/route.ts
- CHANGELOG_SPECIAL.md

Verification:
- Checked diagnostics for all edited API files (no TypeScript errors).
- Executed `npm test`.
- Result: tests pass.

### [2026-04-20] Fix start_month format for DATE-based schemas
What Changed:
- Fixed installment plan creation/update to format `start_month` based on actual DB column type.
- Applied this fix in all installment creation paths: add transaction, convert transaction, and update transaction.

Why:
- Production error occurred when updating a transaction with installment enabled because `start_month` received `YYYY-MM` while schema expected a full date.
- The same mismatch risk existed in add and convert paths.

How:
- Added schema-aware helper that reads `installment_plans.start_month` metadata via `SHOW COLUMNS`.
- For DATE-like column types (`date`, `datetime`, `timestamp`), API now writes `YYYY-MM-01`.
- For non-date/text schemas, API preserves existing `YYYY-MM` behavior.

Files Touched:
- src/app/api/transactions/[id]/route.ts
- src/app/api/transactions/add/route.ts
- src/app/api/installments/route.ts
- CHANGELOG_SPECIAL.md

Verification:
- Checked diagnostics for all edited API files (no TypeScript errors).
- Executed `npm test`.
- Result: tests pass.

### [2026-04-20] Fix edit flow for installment toggle and persistence
What Changed:
- Fixed form behavior so unchecking `Is Installment` no longer leaves `NaN` values in hidden installment numeric fields.
- Registered hidden `id` input so update submissions always include transaction id.
- Updated `PUT /api/transactions/[id]` to persist installment data when installment is enabled during edit.
- Added installment plan upsert logic in update route and schedule regeneration with fee handling.

Why:
- Edit form previously failed validation after toggling installment off because hidden numeric fields were still parsed as `NaN`.
- Edit submissions could fail with missing id because `id` was required by schema but not explicitly registered.
- Checking installment during update did not create/update `installment_plans` and `installment_schedule`, so user changes were not recorded.

How:
- Enabled `shouldUnregister` in form state, normalized number input parsing with `setValueAs`, and cleared installment fields when toggle is off.
- Added a hidden registered `id` field in `TransactionForm` to keep required id in payload.
- In update API, introduced transaction-safe flow that resolves financing status, updates transaction row, and creates/updates installment plan + rebuilds schedule when installment mode is active.
- Preserved fee distribution behavior using floor + remainder on the final month.

Files Touched:
- src/components/TransactionForm.tsx
- src/app/api/transactions/[id]/route.ts
- CHANGELOG_SPECIAL.md

Verification:
- Checked diagnostics for edited files (no TypeScript errors).
- Executed `npm test`.
- Result: tests pass and update path now persists installment data.

### [2026-04-19] Add regression API test for installment feesTotal handling
What Changed:
- Added a focused test for POST `/api/transactions/add` to verify fees are persisted and scheduled.
- Added Vitest configuration and npm test script to run route-level tests.

Why:
- The feesTotal bug was fixed in code and now needs automated coverage to prevent silent regressions.
- A small route-level test gives quick feedback when plan or schedule SQL columns drift.

How:
- Introduced Vitest with path alias support via Vite's native `resolve.tsconfigPaths`.
- Mocked `db`, `crypto.randomUUID`, and `NextResponse` to isolate route behavior.
- Asserted `fees_total` is included in plan insert and `amount_fee` is included in schedule insert.
- Asserted fee distribution uses floor+remainder behavior (`[33, 33, 34]` for total fee 100 over 3 months).

Files Touched:
- package.json
- package-lock.json
- vitest.config.ts
- src/app/api/transactions/add/route.test.ts
- CHANGELOG_SPECIAL.md

Verification:
- Executed route test with `npm test`.
- Result: test passes and confirms fee persistence/distribution behavior.

### [2026-04-19] Fix feesTotal inconsistency in add transaction installment path
What Changed:
- Added `feesTotal` handling to POST `/api/transactions/add` request parsing.
- Persisted fees in `installment_plans.fees_total` during installment plan creation.
- Included `amount_fee` in generated `installment_schedule` rows.
- Added fee remainder handling in the final month to keep exact totals.

Why:
- The add transaction path previously ignored fees, while convert-to-installment path included them.
- This caused inconsistent financial totals depending on which path created the installment.

How:
- Parsed `feesTotal` from request body and normalized it with `Number(feesTotal) || 0`.
- Calculated `monthlyFee` using floor distribution, matching existing principal/interest logic.
- Used last-installment remainder adjustment so schedule sum exactly matches total fees.
- Updated SQL insert columns for both `installment_plans` and `installment_schedule` to store fee values.

Files Touched:
- src/app/api/transactions/add/route.ts
- CHANGELOG_SPECIAL.md

Verification:
- Checked TypeScript/route diagnostics for `src/app/api/transactions/add/route.ts`.
- Result: no errors reported.
