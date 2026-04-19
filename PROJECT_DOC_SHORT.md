# Spending Tracker - Quick Guide

## What this project is
Spending Tracker is a Next.js app to record expenses, categorize them, track payment methods, import CSV data, and analyze spending in reports.

Main capabilities:
- Add, edit, and delete transactions
- Track categories and payment methods
- Support subscription transactions
- Support installment purchases (financing)
- View reports in two modes: accrual and cashflow

## Core idea in one minute
There are two ways to read your spending:
- Accrual mode: when the purchase happened
- Cashflow mode: when money actually leaves each month

This is important for installment purchases, where purchase date and payment dates are different.

## How Is Installment works
When you check Is Installment in the form:
1. A normal transaction is still created in transactions.
2. If installmentMonths > 1, the system marks that transaction as financing_status = converted.
3. A plan is created in installment_plans.
4. Monthly payment rows are generated in installment_schedule.

Why this design exists:
- Prevent double counting in reports
- Keep purchase history and monthly payment obligations separated

### Reporting behavior
- Cashflow mode:
  - Excludes converted transactions from the transaction sum
  - Includes monthly rows from installment_schedule
- Accrual mode:
  - Includes all transactions by purchase date
  - Does not use installment schedule rows

## Typical user flows
### Add a regular transaction
- Create transaction with one_time status
- Appears in both accrual and cashflow for that date

### Add an installment purchase at creation time
- Check Is Installment and set months
- System builds plan + schedule automatically
- Cashflow shows monthly payments, not full purchase amount

### Convert existing transaction to installment
- Use POST /api/installments
- Transaction status becomes converted
- Plan + schedule are created

### Mark installment as paid
- Use installment manager page
- Marks selected schedule item as paid
- If all rows paid, plan status becomes completed

## Current known issues (important)
1. feesTotal is collected in form but not persisted in /api/transactions/add installment creation path.
2. UI allows Is Installment and Is Subscription both enabled together, which can create confusing status behavior.
3. Editing a transaction updates status fields but does not rebuild installment plan/schedule.
4. Cashflow reporting logic is monthly-focused; yearly cashflow does not aggregate schedule in the same way.

## Suggestions
- Add strict validation to prevent installment + subscription conflict.
- Persist feesTotal consistently in add transaction installment flow.
- Add explicit edit flow for installment terms (or disable editing installment fields after creation).
- Add endpoint-level validation for negative/invalid interest and fee values.
- Add integration tests for report totals to guard against regressions.

## Recommended next steps
1. Fix data consistency first:
   - Handle feesTotal in transaction add path
   - Enforce exclusive financing mode
2. Improve UX safety:
   - Disable conflicting checkboxes in form
   - Show clear warning text for report mode differences
3. Strengthen quality:
   - Add automated tests for add/convert/pay/delete installment lifecycle
   - Add report-mode snapshot tests (accrual vs cashflow)
4. Improve documentation:
   - Keep this quick guide for onboarding
   - Use detailed guide for engineering and debugging

## Quick API map
- POST /api/transactions/add
- POST /api/installments
- GET /api/installments
- GET /api/installments/{planId}
- POST /api/installments/{planId}/pay
- DELETE /api/installments/{planId}
- GET /api/reports?mode=accrual|cashflow

## Who should read what
- New team members: this file
- Engineers changing core logic: PROJECT_DOC_DETAILED.md
