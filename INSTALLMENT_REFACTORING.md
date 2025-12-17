# Installment Refactoring Documentation

## Overview
This document describes the refactoring of the spending tracker dashboard to support proper installment tracking and prevent double counting of expenses.

---

## Section 1: Summary of Structural Changes

### Database Schema Changes

#### New Column: `financing_status`
Added to `transactions` table to track the payment type:
- `'one_time'`: Regular one-time payment (default)
- `'converted'`: Transaction converted to installment plan
- `'subscription'`: Recurring subscription

#### New Tables (Already Existed, Now Properly Integrated)
1. **`installment_plans`** - Stores financing terms
   - `plan_id` (PK)
   - `transaction_id` (FK to transactions)
   - `principal`, `months`, `interest_total`, `fees_total`
   - `start_month`, `status`

2. **`installment_schedule`** - Monthly payment obligations
   - `schedule_id` (PK)
   - `plan_id` (FK to installment_plans)
   - `due_month`, `amount_principal`, `amount_interest`, `amount_fee`
   - `status` ('pending', 'paid', 'overdue')

#### Deprecated Fields (Kept for Backward Compatibility)
- `installment_total` - No longer used
- `installment_current` - No longer used

### API Changes

#### Modified Endpoints
- `GET /api/transactions` - Now returns `financing_status` and plan details
- `GET /api/transactions/[id]` - Returns full plan information
- `PUT /api/transactions/[id]` - Uses `categoryId`/`methodId` instead of names
- `POST /api/transactions/add` - Sets `financing_status` when creating installments

#### New Endpoints
- `GET /api/installments` - List all installment plans
- `POST /api/installments` - Convert transaction to installment
- `GET /api/installments/[planId]` - Get plan details with schedule
- `PUT /api/installments/[planId]` - Update plan status
- `DELETE /api/installments/[planId]` - Delete plan and revert transaction
- `POST /api/installments/[planId]/pay` - Mark installments as paid

### Frontend Changes
- Updated TypeScript types to match new schema
- TransactionForm now uses `categoryId`/`methodId`
- Added support for `feesTotal` in installment creation
- AnalyticsCharts properly handles both accrual and cashflow modes

---

## Section 2: Old vs New Calculation Logic

### Monthly Totals Calculation

#### OLD LOGIC (INCORRECT - Double Counting)
```sql
-- Counted all transactions including converted ones
SELECT DATE_FORMAT(date, '%Y-%m'), SUM(amount)
FROM transactions
WHERE date BETWEEN ? AND ?
GROUP BY DATE_FORMAT(date, '%Y-%m')

-- This caused double counting because:
-- 1. Original transaction (e.g., $10,000 purchase) was counted
-- 2. Installment schedule was also counted (e.g., 12 × $850)
-- Result: Same purchase counted twice!
```

#### NEW LOGIC (CORRECT - No Double Counting)

**ACCRUAL MODE** (Purchase View):
```sql
-- Shows when purchases were made (original transaction date)
SELECT DATE_FORMAT(date, '%Y-%m'), SUM(amount)
FROM transactions
WHERE date BETWEEN ? AND ?
GROUP BY DATE_FORMAT(date, '%Y-%m')

-- Use case: "When did I make purchases?"
-- All transactions counted at purchase date
```

**CASHFLOW MODE** (Payment View):
```sql
-- Shows actual monthly cash outflows
SELECT period, SUM(total_expense) as total_expense 
FROM (
  -- Part 1: Non-converted transactions (one_time + subscription)
  SELECT DATE_FORMAT(t.date, '%Y-%m') as period, 
         SUM(t.amount) as total_expense
  FROM transactions t
  WHERE t.financing_status != 'converted'  -- EXCLUDE converted
  GROUP BY period
  
  UNION ALL
  
  -- Part 2: Monthly installment payments
  SELECT s.due_month as period,
         SUM(s.amount_principal + s.amount_interest + s.amount_fee) as total_expense
  FROM installment_schedule s
  INNER JOIN installment_plans p ON s.plan_id = p.plan_id
  WHERE s.status IN ('pending', 'paid')
  GROUP BY period
) as combined
GROUP BY period

-- Use case: "How much do I need to pay this month?"
-- Converted transactions excluded, installment payments included
```

### Category Breakdown

#### OLD LOGIC
```sql
-- All transactions, no filtering
SELECT category, SUM(amount)
FROM transactions
GROUP BY category
```

#### NEW LOGIC

**CASHFLOW MODE**:
```sql
-- Category based on original purchase, amount from monthly payments
SELECT c.name as category_name, SUM(amount) as total 
FROM (
  -- Non-converted transactions
  SELECT c.name, t.amount
  FROM transactions t
  JOIN categories c ON t.category_id = c.id
  WHERE t.financing_status != 'converted'
  
  UNION ALL
  
  -- Installment payments (category from original transaction)
  SELECT c.name, (s.amount_principal + s.amount_interest + s.amount_fee)
  FROM installment_schedule s
  JOIN installment_plans p ON s.plan_id = p.plan_id
  JOIN transactions t ON p.transaction_id = t.id
  JOIN categories c ON t.category_id = c.id
) as combined
GROUP BY category_name

-- Categories reflect original purchase, amounts reflect monthly payments
```

---

## Section 3: Updated SQL Queries

### Query 1: Get All Transactions with Plan Info
```sql
SELECT 
  t.id, t.date, t.amount, t.notes, 
  t.category_id, t.method_id,
  t.is_subscription, t.subscription_interval, 
  t.financing_status,
  c.name AS category,
  m.name AS method,
  p.plan_id,
  p.months as plan_months,
  p.interest_total as plan_interest,
  p.principal as plan_principal,
  p.status as plan_status
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN payment_methods m ON t.method_id = m.id
LEFT JOIN installment_plans p ON t.id = p.transaction_id
ORDER BY t.created_at DESC
```

### Query 2: Monthly Cashflow Report
```sql
-- See Section 2 CASHFLOW MODE query above
```

### Query 3: Get Installment Plan with Schedule
```sql
SELECT 
  p.*,
  s.schedule_id,
  s.due_month,
  s.amount_principal,
  s.amount_interest,
  s.amount_fee,
  s.status as payment_status,
  s.paid_at
FROM installment_plans p
LEFT JOIN installment_schedule s ON p.plan_id = s.plan_id
WHERE p.plan_id = ?
ORDER BY s.due_month ASC
```

### Query 4: Mark Installment as Paid
```sql
UPDATE installment_schedule 
SET status = 'paid', paid_at = NOW() 
WHERE plan_id = ? AND due_month = ?
```

---

## Section 4: Backend Aggregation Logic

### Pseudocode: Create Installment Plan

```javascript
async function createInstallmentPlan(transactionId, months, interest, fees) {
  const connection = await db.getConnection();
  await connection.beginTransaction();
  
  try {
    // 1. Validate transaction exists and is not already converted
    const transaction = await getTransaction(transactionId);
    if (transaction.financing_status === 'converted') {
      throw Error('Already converted');
    }
    
    // 2. Create plan record
    const planId = await insertPlan({
      transaction_id: transactionId,
      principal: transaction.amount,
      months: months,
      interest_total: interest,
      fees_total: fees,
      start_month: transaction.date.substring(0, 7),
      status: 'active'
    });
    
    // 3. Generate monthly schedule
    const monthlyPrincipal = Math.floor(transaction.amount / months);
    const monthlyInterest = Math.floor(interest / months);
    const monthlyFee = Math.floor(fees / months);
    
    const schedules = [];
    let currentDate = new Date(transaction.date);
    currentDate.setDate(1); // Start from 1st of month
    
    for (let i = 0; i < months; i++) {
      const isLast = (i === months - 1);
      
      // Handle remainder in last payment
      const pAmount = isLast 
        ? transaction.amount - (monthlyPrincipal * (months - 1))
        : monthlyPrincipal;
      const iAmount = isLast 
        ? interest - (monthlyInterest * (months - 1))
        : monthlyInterest;
      const fAmount = isLast 
        ? fees - (monthlyFee * (months - 1))
        : monthlyFee;
      
      schedules.push({
        plan_id: planId,
        due_month: formatYYYYMM(currentDate),
        amount_principal: pAmount,
        amount_interest: iAmount,
        amount_fee: fAmount,
        status: 'pending'
      });
      
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    await insertSchedules(schedules);
    
    // 4. Mark transaction as converted
    await updateTransaction(transactionId, {
      financing_status: 'converted'
    });
    
    await connection.commit();
    return planId;
  } catch (err) {
    await connection.rollback();
    throw err;
  }
}
```

### Pseudocode: Calculate Monthly Cashflow

```javascript
async function getMonthlyReport(startMonth, endMonth, mode = 'cashflow') {
  if (mode === 'accrual') {
    // Simple: All transactions at purchase date
    return db.query(`
      SELECT DATE_FORMAT(date, '%Y-%m') as month, SUM(amount) as total
      FROM transactions
      WHERE date BETWEEN ? AND ?
      GROUP BY month
    `, [startMonth, endMonth]);
  }
  
  // Cashflow mode: Exclude converted, include schedule
  const results = await db.query(`
    SELECT period, SUM(total) as total FROM (
      -- Non-converted transactions
      SELECT DATE_FORMAT(date, '%Y-%m') as period, SUM(amount) as total
      FROM transactions
      WHERE financing_status != 'converted'
        AND date BETWEEN ? AND ?
      GROUP BY period
      
      UNION ALL
      
      -- Installment schedule
      SELECT due_month as period, 
             SUM(amount_principal + amount_interest + amount_fee) as total
      FROM installment_schedule
      WHERE due_month BETWEEN ? AND ?
      GROUP BY period
    ) combined
    GROUP BY period
    ORDER BY period
  `, [startMonth, endMonth, startMonth, endMonth]);
  
  return results;
}
```

---

## Section 5: Migration Notes and Edge Cases

### Migration Steps

1. **Backup Database**
   ```bash
   mysqldump -u user -p database > backup_before_migration.sql
   ```

2. **Run Migration**
   ```bash
   mysql -u user -p database < migrations/001_add_financing_status.sql
   ```

3. **Verify Data**
   ```sql
   -- Check all converted transactions are marked
   SELECT COUNT(*) FROM transactions t
   INNER JOIN installment_plans p ON t.id = p.transaction_id
   WHERE t.financing_status != 'converted';
   -- Should return 0
   
   -- Check subscriptions are marked
   SELECT COUNT(*) FROM transactions
   WHERE is_subscription = 1 AND financing_status != 'subscription';
   -- Should return 0
   ```

4. **Update Application**
   - Deploy new API endpoints
   - Update frontend components
   - Clear browser cache

### Edge Cases and Solutions

#### Edge Case 1: Transaction Converted Mid-Month
**Problem**: Transaction dated 2025-01-15, converted to 12-month plan. First installment due January or February?

**Solution**: Start installments from the transaction's month.
```javascript
const startMonth = transaction.date.substring(0, 7); // '2025-01'
// First payment due: 2025-01
// Last payment due: 2025-12
```

#### Edge Case 2: Partial Payment
**Problem**: User pays half of installment. How to track?

**Solution**: Don't use partial statuses. Mark as 'pending' until fully paid.
```sql
-- Only mark paid when full amount received
UPDATE installment_schedule 
SET status = 'paid', paid_at = NOW()
WHERE schedule_id = ? 
  AND actual_paid_amount >= (amount_principal + amount_interest + amount_fee)
```

#### Edge Case 3: Plan Cancellation
**Problem**: User cancels installment plan. What happens to transaction?

**Solution**: Revert to one_time, keep historical data.
```javascript
// When deleting plan
await db.query('UPDATE transactions SET financing_status = "one_time" WHERE id = ?', [txId]);
// Transaction appears in reports as one-time purchase
// Historical schedule data deleted (via CASCADE)
```

#### Edge Case 4: Interest/Fee Changes
**Problem**: Bank changes interest rate mid-plan.

**Solution**: Create new plan, mark old as cancelled.
```javascript
// Don't modify existing plan
await updatePlan(oldPlanId, { status: 'cancelled' });
await createNewPlan(transactionId, newTerms);
// Keep historical data intact
```

#### Edge Case 5: Existing Data Migration
**Problem**: Old transactions have `installment_total` but no plan.

**Solution**: Migration script creates plans retroactively.
```sql
-- Find transactions with installment fields but no plan
SELECT t.* FROM transactions t
LEFT JOIN installment_plans p ON t.id = p.transaction_id
WHERE t.installment_total IS NOT NULL
  AND p.plan_id IS NULL;

-- These need manual review or scripted conversion
-- Recommend: Leave as-is, mark as one_time, create plans going forward
```

### Backward Compatibility

#### Option A: Gradual Migration (Recommended)
- Keep `installment_total`/`installment_current` columns
- New transactions use `financing_status` only
- Old transactions continue working
- Reports handle both formats

#### Option B: Full Migration
- Convert all old installment data to new format
- Drop deprecated columns
- Requires careful testing
- Higher risk

### Rollback Procedure

If issues occur after migration:

1. **Revert Database**
   ```bash
   mysql -u user -p database < backup_before_migration.sql
   ```

2. **Revert Code**
   ```bash
   git revert <commit-hash>
   ```

3. **Clear Cache**
   ```bash
   # Clear Redis/Memcached if used
   # Clear browser local storage
   ```

### Performance Considerations

#### Query Optimization
```sql
-- Add indexes for better performance
CREATE INDEX idx_financing_status ON transactions(financing_status);
CREATE INDEX idx_due_month ON installment_schedule(due_month);
CREATE INDEX idx_plan_status ON installment_plans(status);
```

#### Caching Strategy
```javascript
// Cache monthly reports for 1 hour
const cacheKey = `report:${mode}:${startMonth}:${endMonth}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const data = await fetchReport(mode, startMonth, endMonth);
await redis.setex(cacheKey, 3600, JSON.stringify(data));
return data;
```

### Testing Checklist

- [ ] Create one-time transaction → Shows in cashflow correctly
- [ ] Create subscription → Shows in all months
- [ ] Convert transaction to installment → Original excluded, schedule included
- [ ] Mark installment as paid → Status updates correctly
- [ ] Cancel installment plan → Transaction reverts to one-time
- [ ] Accrual vs Cashflow totals → Different results expected
- [ ] Category breakdown → Categories match original purchases
- [ ] Date range filtering → Works for both transactions and schedules
- [ ] Edge case: Month with 31 days → Installment dates handled correctly
- [ ] Edge case: Leap year → February dates handled correctly

---

## FAQ

**Q: Why not just use installment_total and installment_current?**
A: Those fields don't support:
- Interest and fees tracking
- Future payment schedules
- Proper cashflow vs accrual separation
- Converted transaction exclusion

**Q: What if I want to see both views side-by-side?**
A: Use the `mode` parameter:
- `mode=accrual` → When purchases were made
- `mode=cashflow` → Actual monthly payments

**Q: Can I convert a subscription to installment?**
A: No. A transaction is either:
- one_time (can be converted)
- subscription (recurring, cannot be converted)
- converted (already in installment)

**Q: What happens to category analytics in cashflow mode?**
A: Categories come from the original transaction, amounts come from monthly payments. This shows "I spent $X/month on Electronics" even though it's actually an installment payment.

**Q: How to handle overpayment or underpayment?**
A: Current implementation assumes exact payment. For advanced scenarios, add `actual_amount_paid` column to `installment_schedule` and track variance.

---

## Summary

This refactoring:
✅ Eliminates double counting
✅ Supports proper cashflow tracking
✅ Maintains backward compatibility
✅ Provides clear accrual vs cashflow views
✅ Enables future installment features

The key insight: **Converted transactions should not appear in cashflow calculations. Only the monthly schedule payments should.**
