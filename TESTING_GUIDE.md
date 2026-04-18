# Testing Guide for Installment Refactoring

## Pre-Deployment Testing

### 1. Database Migration Test

```bash
# 1. Create backup
mysqldump -u root -p spending_tracker > backup_$(date +%Y%m%d).sql

# 2. Run migration
mysql -u root -p spending_tracker < migrations/001_add_financing_status.sql

# 3. Verify schema
mysql -u root -p spending_tracker -e "DESCRIBE transactions;"
# Should show: financing_status ENUM('one_time','converted','subscription')

mysql -u root -p spending_tracker -e "SHOW INDEX FROM transactions WHERE Key_name = 'idx_financing_status';"
# Should show the new index

# 4. Check data integrity
mysql -u root -p spending_tracker -e "
  SELECT financing_status, COUNT(*) as count 
  FROM transactions 
  GROUP BY financing_status;
"
# Should show counts for each status

# 5. Verify installment_plans and installment_schedule tables exist
mysql -u root -p spending_tracker -e "SHOW TABLES LIKE 'installment%';"
```

### 2. API Endpoint Tests

#### Test 1: Create One-Time Transaction
```bash
curl -X POST http://localhost:3000/api/transactions/add \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-12-17",
    "amount": 500000,
    "categoryId": 1,
    "methodId": "1",
    "notes": "Test one-time purchase",
    "isInstallment": false,
    "isSubscription": false
  }'

# Expected: { "success": true }
# Verify in DB: financing_status = 'one_time'
```

#### Test 2: Create Transaction with Installment
```bash
curl -X POST http://localhost:3000/api/transactions/add \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-12-17",
    "amount": 10000000,
    "categoryId": 1,
    "methodId": "1",
    "notes": "Test installment purchase",
    "isInstallment": true,
    "installmentMonths": 12,
    "interestTotal": 1000000,
    "feesTotal": 200000,
    "isSubscription": false
  }'

# Expected: { "success": true }
# Verify in DB:
# 1. transactions: financing_status = 'converted'
# 2. installment_plans: 1 row with months=12
# 3. installment_schedule: 12 rows with due_month incremented
```

#### Test 3: Create Subscription
```bash
curl -X POST http://localhost:3000/api/transactions/add \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-12-17",
    "amount": 150000,
    "categoryId": 2,
    "methodId": "1",
    "notes": "Netflix subscription",
    "isInstallment": false,
    "isSubscription": true,
    "subscriptionInterval": "monthly"
  }'

# Expected: { "success": true }
# Verify in DB: financing_status = 'subscription'
```

#### Test 4: Convert Existing Transaction to Installment
```bash
# First, get a transaction ID from one-time transaction
TRANSACTION_ID="<uuid-from-test-1>"

curl -X POST http://localhost:3000/api/installments \
  -H "Content-Type: application/json" \
  -d "{
    \"transactionId\": \"$TRANSACTION_ID\",
    \"months\": 6,
    \"interestTotal\": 50000,
    \"feesTotal\": 10000
  }"

# Expected: { "success": true, "planId": 123, "message": "..." }
# Verify in DB:
# 1. transactions: financing_status changed to 'converted'
# 2. installment_plans: 1 new row
# 3. installment_schedule: 6 new rows
```

#### Test 5: Get Monthly Report (Cashflow Mode)
```bash
curl "http://localhost:3000/api/reports?period=monthly&mode=cashflow&start=2025-12-01&end=2025-12-31"

# Expected: { "success": true, "data": [...] }
# Verify:
# 1. Converted transactions NOT included in totals
# 2. Installment schedule payments ARE included
# 3. One-time and subscription transactions ARE included
```

#### Test 6: Get Monthly Report (Accrual Mode)
```bash
curl "http://localhost:3000/api/reports?period=monthly&mode=accrual&start=2025-12-01&end=2025-12-31"

# Expected: { "success": true, "data": [...] }
# Verify:
# 1. ALL transactions included at purchase date
# 2. Installment schedule NOT included
```

#### Test 7: Get Category Breakdown (Cashflow)
```bash
curl "http://localhost:3000/api/reports/grouped?groupBy=category&mode=cashflow"

# Expected: Array of { period: "CategoryName", total: 123, count: 5 }
# Verify:
# 1. Converted transactions NOT included
# 2. Installment schedule payments ARE included
# 3. Category comes from original transaction
```

#### Test 8: Mark Installment as Paid
```bash
PLAN_ID="<plan-id-from-test-2>"
SCHEDULE_ID="<schedule-id-from-query>"

curl -X POST "http://localhost:3000/api/installments/$PLAN_ID/pay" \
  -H "Content-Type: application/json" \
  -d "{
    \"scheduleIds\": [$SCHEDULE_ID]
  }"

# Expected: { "success": true, "affectedRows": 1 }
# Verify in DB:
# 1. installment_schedule: status = 'paid', paid_at = NOW()
# 2. If all paid, installment_plans: status = 'completed'
```

#### Test 9: Delete Installment Plan
```bash
PLAN_ID="<plan-id-from-test-4>"

curl -X DELETE "http://localhost:3000/api/installments/$PLAN_ID"

# Expected: { "success": true, "message": "..." }
# Verify in DB:
# 1. installment_plans: row deleted
# 2. installment_schedule: rows deleted (CASCADE)
# 3. transactions: financing_status reverted to 'one_time'
```

### 3. Data Integrity Tests

```sql
-- Test 1: No orphaned plans
SELECT p.plan_id, p.transaction_id 
FROM installment_plans p
LEFT JOIN transactions t ON p.transaction_id = t.id
WHERE t.id IS NULL;
-- Expected: 0 rows

-- Test 2: No orphaned schedules
SELECT s.schedule_id, s.plan_id
FROM installment_schedule s
LEFT JOIN installment_plans p ON s.plan_id = p.plan_id
WHERE p.plan_id IS NULL;
-- Expected: 0 rows

-- Test 3: All converted transactions have plans
SELECT t.id, t.financing_status
FROM transactions t
LEFT JOIN installment_plans p ON t.id = p.transaction_id
WHERE t.financing_status = 'converted' AND p.plan_id IS NULL;
-- Expected: 0 rows

-- Test 4: Schedule count matches plan months
SELECT p.plan_id, p.months, COUNT(s.schedule_id) as schedule_count
FROM installment_plans p
LEFT JOIN installment_schedule s ON p.plan_id = s.plan_id
GROUP BY p.plan_id
HAVING p.months != schedule_count;
-- Expected: 0 rows

-- Test 5: Sum of schedule amounts equals plan total
SELECT 
  p.plan_id,
  p.principal + p.interest_total + p.fees_total as plan_total,
  SUM(s.amount_principal + s.amount_interest + s.amount_fee) as schedule_total
FROM installment_plans p
INNER JOIN installment_schedule s ON p.plan_id = s.plan_id
GROUP BY p.plan_id
HAVING ABS(plan_total - schedule_total) > 100; -- Allow ±100 for rounding
-- Expected: 0 rows or very few (rounding differences only)
```

### 4. Double Counting Prevention Test

```sql
-- Create test data
INSERT INTO transactions (id, date, amount, category_id, method_id, financing_status)
VALUES ('test-uuid-1', '2025-12-01', 1000000, 1, '1', 'converted');

INSERT INTO installment_plans (transaction_id, principal, months, interest_total, start_month)
VALUES ('test-uuid-1', 1000000, 10, 100000, '2025-12');

INSERT INTO installment_schedule (plan_id, due_month, amount_principal, amount_interest, status)
SELECT 
  LAST_INSERT_ID(),
  DATE_FORMAT(DATE_ADD('2025-12-01', INTERVAL n MONTH), '%Y-%m'),
  100000,
  10000,
  'pending'
FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 
      UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) nums;

-- Test cashflow query
SELECT period, SUM(total_expense) as total
FROM (
  SELECT DATE_FORMAT(date, '%Y-%m') as period, SUM(amount) as total_expense
  FROM transactions
  WHERE financing_status != 'converted'
    AND date BETWEEN '2025-12-01' AND '2025-12-31'
  GROUP BY period
  
  UNION ALL
  
  SELECT due_month as period,
         SUM(amount_principal + amount_interest) as total_expense
  FROM installment_schedule
  WHERE due_month = '2025-12'
  GROUP BY period
) combined
GROUP BY period;

-- Expected: Only 110000 (one installment payment)
-- NOT 1000000 (original transaction) + 110000 = 1110000

-- Cleanup
DELETE FROM installment_schedule WHERE plan_id IN (
  SELECT plan_id FROM installment_plans WHERE transaction_id = 'test-uuid-1'
);
DELETE FROM installment_plans WHERE transaction_id = 'test-uuid-1';
DELETE FROM transactions WHERE id = 'test-uuid-1';
```

### 5. Frontend Tests

#### Manual UI Testing Checklist

1. **Create Transaction**
   - [ ] Create one-time transaction → Shows in list correctly
   - [ ] Create subscription → Shows recurring indicator
   - [ ] Create with installment → Shows plan details
   - [ ] Form validation works (required fields, min amounts)

2. **View Transactions**
   - [ ] Transaction list shows all types correctly
   - [ ] Converted transactions show installment badge
   - [ ] Edit transaction preserves data
   - [ ] Delete transaction works

3. **Analytics Charts**
   - [ ] Switch between Cashflow and Accrual modes
   - [ ] Monthly chart updates correctly
   - [ ] Category pie chart shows correct totals
   - [ ] Cashflow mode excludes converted, accrual includes all

4. **Installment Manager**
   - [ ] Lists all installment plans
   - [ ] Shows progress bars correctly
   - [ ] Click plan opens details modal
   - [ ] Payment schedule displays correctly
   - [ ] Mark as paid updates status
   - [ ] Delete plan reverts transaction

5. **Reports**
   - [ ] Date range filtering works
   - [ ] Category filtering works
   - [ ] Method filtering works
   - [ ] Cashflow vs Accrual totals differ correctly

### 6. Performance Tests

```bash
# Create 1000 transactions
for i in {1..1000}; do
  curl -X POST http://localhost:3000/api/transactions/add \
    -H "Content-Type: application/json" \
    -d "{
      \"date\": \"2025-12-$(printf %02d $((1 + $i % 30)))\",
      \"amount\": $((100000 + $RANDOM)),
      \"categoryId\": $((1 + $i % 5)),
      \"methodId\": \"$((1 + $i % 3))\",
      \"notes\": \"Performance test $i\",
      \"isInstallment\": false,
      \"isSubscription\": false
    }" &
done
wait

# Test query performance
time curl "http://localhost:3000/api/reports?period=monthly&mode=cashflow"
# Should complete in < 2 seconds

time curl "http://localhost:3000/api/reports/grouped?groupBy=category&mode=cashflow"
# Should complete in < 2 seconds
```

### 7. Edge Case Tests

#### Test 1: Leap Year Installment
```bash
# Create transaction on Feb 29, 2024
curl -X POST http://localhost:3000/api/transactions/add \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-02-29",
    "amount": 1200000,
    "categoryId": 1,
    "methodId": "1",
    "isInstallment": true,
    "installmentMonths": 12
  }'

# Verify: Schedule uses month start dates (2024-02, 2024-03, etc.)
# No invalid dates like 2025-02-29
```

#### Test 2: Large Number of Installments
```bash
# Create 60-month plan (5 years)
curl -X POST http://localhost:3000/api/transactions/add \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-12-17",
    "amount": 60000000,
    "categoryId": 1,
    "methodId": "1",
    "isInstallment": true,
    "installmentMonths": 60
  }'

# Verify: 60 schedule rows created correctly
# Verify: Remainder handled in last payment
```

#### Test 3: Zero Interest/Fees
```bash
curl -X POST http://localhost:3000/api/transactions/add \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-12-17",
    "amount": 1000000,
    "categoryId": 1,
    "methodId": "1",
    "isInstallment": true,
    "installmentMonths": 10,
    "interestTotal": 0,
    "feesTotal": 0
  }'

# Verify: Works correctly with zero interest/fees
```

#### Test 4: Concurrent Plan Creation
```bash
# Attempt to convert same transaction twice simultaneously
TRANSACTION_ID="<uuid>"

curl -X POST http://localhost:3000/api/installments \
  -H "Content-Type: application/json" \
  -d "{\"transactionId\": \"$TRANSACTION_ID\", \"months\": 12}" &

curl -X POST http://localhost:3000/api/installments \
  -H "Content-Type: application/json" \
  -d "{\"transactionId\": \"$TRANSACTION_ID\", \"months\": 12}" &

wait

# Expected: One succeeds, one fails with "Already converted" error
```

---

## Rollback Testing

If issues are found, test the rollback procedure:

```bash
# 1. Stop application
pm2 stop spending-tracker

# 2. Restore database backup
mysql -u root -p spending_tracker < backup_20251217.sql

# 3. Verify restoration
mysql -u root -p spending_tracker -e "DESCRIBE transactions;"
# Should NOT show financing_status column

# 4. Revert code
git revert HEAD

# 5. Restart application
pm2 start spending-tracker

# 6. Test basic functionality
curl http://localhost:3000/api/transactions
```

---

## Acceptance Criteria

### Must Pass Before Production Deployment

- [ ] All API endpoint tests pass
- [ ] No data integrity violations
- [ ] Double counting test passes
- [ ] Frontend components work correctly
- [ ] Performance tests complete in < 2 seconds
- [ ] All edge case tests pass
- [ ] Rollback procedure works
- [ ] Database backup created
- [ ] Documentation reviewed
- [ ] At least 2 team members have tested

### Known Limitations

1. **Partial Payments**: Not supported. Mark as paid only when full amount received.
2. **Installment Modification**: Cannot change terms after creation. Must delete and recreate.
3. **Currency Conversion**: Not supported. All amounts in same currency.
4. **Multiple Installments Same Transaction**: Not supported. One plan per transaction.

---

## Success Metrics

After deployment, monitor:

1. **No increase in error rates** in application logs
2. **Query performance** remains < 2 seconds for reports
3. **Data integrity checks** pass daily
4. **User feedback** is positive regarding cashflow vs accrual views
5. **Double counting issues** are resolved

---

## Troubleshooting Guide

### Issue: "Transaction not found" when converting
**Solution**: Verify transaction exists and is not already converted
```sql
SELECT id, financing_status FROM transactions WHERE id = '<uuid>';
```

### Issue: Schedule totals don't match plan total
**Solution**: Check for rounding errors
```sql
SELECT p.plan_id, 
       p.principal + p.interest_total + p.fees_total as expected,
       SUM(s.amount_principal + s.amount_interest + s.amount_fee) as actual,
       ABS((p.principal + p.interest_total + p.fees_total) - 
           SUM(s.amount_principal + s.amount_interest + s.amount_fee)) as diff
FROM installment_plans p
JOIN installment_schedule s ON p.plan_id = s.plan_id
GROUP BY p.plan_id
HAVING diff > 100;
```

### Issue: Cashflow totals still showing double counting
**Solution**: Check for missing `financing_status != 'converted'` filter
```sql
-- Find converted transactions in results
SELECT * FROM transactions 
WHERE financing_status = 'converted' 
  AND date BETWEEN '2025-12-01' AND '2025-12-31';
-- These should NOT appear in cashflow mode totals
```

---

## Contact

For testing support or questions:
- Review `INSTALLMENT_REFACTORING.md` for detailed explanations
- Check `REFACTORING_SUMMARY.md` for quick reference
- Run test suite before reporting issues
