# Spending Tracker - Detailed Technical Documentation

## 1. Project overview
This project is a Next.js spending tracker with MySQL persistence. It supports regular transactions, subscriptions, and installment-based financing with report views tailored for different financial questions.

Tech stack:
- Next.js app router
- TypeScript
- MySQL (via db helper in src/lib/db.ts)
- API routes in src/app/api
- Client state via hooks in src/hooks

## 2. Domain model
### 2.1 Transactions
Primary table: transactions

Key fields used by current logic:
- id (UUID)
- date
- amount
- category_id
- method_id
- notes
- is_subscription
- subscription_interval
- financing_status (one_time | converted | subscription)

Role:
- Source of purchase-time truth
- Joined by reports and installment plans

### 2.2 Installment plans
Table: installment_plans

Key fields:
- plan_id
- transaction_id
- principal
- months
- interest_total
- fees_total
- start_month
- status (active | completed | cancelled)

Role:
- Defines financing terms per converted transaction

### 2.3 Installment schedule
Table: installment_schedule

Key fields:
- schedule_id
- plan_id
- due_month (YYYY-MM)
- amount_principal
- amount_interest
- amount_fee
- status (pending | paid | overdue)
- paid_at

Role:
- Represents month-by-month obligations used by cashflow reports

## 3. App architecture and key files
UI and hooks:
- src/components/TransactionForm.tsx
- src/components/InstallmentManager.tsx
- src/hooks/useTransactions.ts

API endpoints:
- src/app/api/transactions/add/route.ts
- src/app/api/transactions/edit/route.ts
- src/app/api/transactions/route.ts
- src/app/api/installments/route.ts
- src/app/api/installments/[planId]/route.ts
- src/app/api/installments/[planId]/pay/route.ts
- src/app/api/reports/route.ts

Types:
- src/types/index.ts

## 4. Installment lifecycle (end-to-end)
This section explains exactly how Is Installment works in current code.

### 4.1 Create transaction with Is Installment from UI
Flow:
1. User checks Is Installment and enters months/interest/fees in TransactionForm.
2. Form submits through add page to useTransactions.addTransaction.
3. Hook posts full payload to POST /api/transactions/add.
4. Backend inserts base transaction.
5. If isInstallment is true and installmentMonths > 1:
   - sets desired financing status to converted (unless subscription branch selected)
   - inserts row into installment_plans
   - generates monthly rows in installment_schedule

Schedule generation behavior:
- Monthly principal and interest are floor-divided.
- Remaining value is pushed into final month to keep exact totals.
- due_month is generated from transaction date month onward.

### 4.2 Convert existing transaction to installment
Endpoint: POST /api/installments

Flow:
1. Validate transactionId and months >= 2.
2. Load base transaction and reject if already converted.
3. Insert plan with principal/months/interestTotal/feesTotal.
4. Generate schedule rows including amount_fee.
5. Update transaction financing_status to converted.
6. Commit transaction.

### 4.3 Mark installment as paid
Endpoint: POST /api/installments/{planId}/pay

Behavior:
- Accepts either scheduleIds[] or dueMonth.
- Updates matching schedule rows to status = paid and sets paid_at = NOW().
- Re-checks plan totals; when all schedule rows are paid, sets plan status = completed.

### 4.4 Delete installment plan
Endpoint: DELETE /api/installments/{planId}

Behavior:
- Deletes schedule rows
- Deletes plan row
- Reverts linked transaction financing_status to one_time

## 5. Reporting model (why installment exists)
Reports answer two different business questions.

### 5.1 Accrual mode
Question answered:
- When were purchases made?

Behavior:
- Sums transactions by date period.
- Includes all transactions regardless of converted status.
- Does not include installment_schedule.

### 5.2 Cashflow mode (monthly)
Question answered:
- How much cash do I owe/pay this month?

Behavior:
- Excludes transactions with financing_status = converted.
- Adds monthly totals from installment_schedule (principal + interest + fee).
- Combines both using UNION ALL and then groups by period.

Result:
- Prevents double counting financed purchases.
- Produces realistic monthly outflow tracking.

## 6. Financing status decision logic
Current decision path in add/edit APIs:
- If isSubscription is true => status tends to subscription.
- Else if isInstallment and months > 1 => status converted.
- Else => one_time.

Important caveat:
- In add route, installment schedule creation still runs when isInstallment is true even if isSubscription is also true. This can create mixed semantics.

## 7. Known issues and risks
### 7.1 feesTotal inconsistency
- Transaction add path does not include feesTotal in installment_plans insert or schedule generation.
- Convert path does include feesTotal.
- Risk: financial totals differ depending on creation path.

### 7.2 Conflicting financing toggles in UI
- Form allows both Is Installment and Is Subscription at once.
- Risk: ambiguous status and reporting behavior.

### 7.3 Edit path does not manage plan/schedule updates
- Edit endpoint updates financing status fields only.
- It does not create, update, or rebuild plan/schedule data.
- Risk: user expectation mismatch and stale plan data.

### 7.4 Cashflow yearly gap
- Cashflow branch is only implemented for monthly mode in report route.
- Risk: inconsistent analytics expectations for yearly cashflow requests.

### 7.5 Integrity and migration assumptions
- Some logic is defensive around enum values and schema naming differences.
- Risk: unnoticed drift if migrations diverge across environments.

## 8. Recommendations
### 8.1 Data correctness (highest priority)
1. Persist feesTotal in POST /api/transactions/add installment path.
2. Enforce exclusive financing mode:
   - Option A: subscription and installment mutually exclusive in UI.
   - Option B: explicit combined mode with documented semantics.
3. Add backend validation guards for impossible combinations and invalid numeric ranges.

### 8.2 UX and product clarity
1. Add helper copy near report mode toggle:
   - Accrual = purchase timing
   - Cashflow = payment timing
2. In transaction form, disable installment fields when subscription is checked.
3. In edit flow, show a clear message that installment terms cannot be edited (until supported).

### 8.3 API and code quality
1. Return created transaction and plan IDs from add endpoint for robust client state updates.
2. Consolidate financing status resolution utility to shared module used by add/edit routes.
3. Add stricter TypeScript types for payload contracts and response envelopes.

### 8.4 Test coverage
Add automated tests for:
1. Add transaction with installment creates plan and full schedule.
2. Convert existing transaction updates financing_status and schedule totals.
3. Cashflow report excludes converted transaction amount and includes schedule rows.
4. Pay endpoint updates plan to completed when all installments paid.
5. Delete plan reverts transaction to one_time.
6. Invalid payloads return 400 with clear messages.

## 9. Suggested implementation roadmap
Phase 1: correctness
- Fix feesTotal persistence mismatch
- Add backend validation for toggle conflicts and numeric values
- Add regression tests for report totals

Phase 2: UX and maintainability
- Form-level mutual exclusion UX
- Clear installment edit policy in UI
- Shared financing status utility extraction

Phase 3: analytics expansion
- Add yearly cashflow logic that includes schedule aggregation
- Add grouped cashflow consistency checks across endpoints

## 10. Operational checklist
Before release:
1. Run migration and verify financing_status values
2. Test add/convert/pay/delete installment lifecycle manually
3. Verify monthly cashflow totals against SQL spot checks
4. Confirm no double counting in common scenarios
5. Validate behavior with existing historical transaction data

After release:
1. Monitor API errors for installment endpoints
2. Track mismatches reported by users between reports and expected values
3. Collect edge cases for due_month and date handling

## 11. Practical SQL checks
Use these checks for quick verification.

Check status distribution:
```sql
SELECT financing_status, COUNT(*)
FROM transactions
GROUP BY financing_status;
```

Check converted transactions have plans:
```sql
SELECT COUNT(*) AS converted_without_plan
FROM transactions t
LEFT JOIN installment_plans p ON p.transaction_id = t.id
WHERE t.financing_status = 'converted'
  AND p.plan_id IS NULL;
```

Check schedule total equals principal + interest + fees:
```sql
SELECT
  p.plan_id,
  (p.principal + p.interest_total + IFNULL(p.fees_total, 0)) AS expected_total,
  SUM(s.amount_principal + s.amount_interest + IFNULL(s.amount_fee, 0)) AS scheduled_total
FROM installment_plans p
JOIN installment_schedule s ON s.plan_id = p.plan_id
GROUP BY p.plan_id
HAVING expected_total <> scheduled_total;
```

## 12. Documentation map
- For quick onboarding and PM-friendly summary: PROJECT_DOC_SHORT.md
- For implementation and debugging details: this file
- For migration/testing specifics: INSTALLMENT_README.md and TESTING_GUIDE.md
