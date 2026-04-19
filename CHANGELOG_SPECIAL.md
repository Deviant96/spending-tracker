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
