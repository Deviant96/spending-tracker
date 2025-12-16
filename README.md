This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Installments (New Model)

### Problem (Old Behavior)
The app historically stored installment state inside `transactions` (`installment_total`, `installment_current`). Any dashboard or report that summed `transactions.amount` could double count when a purchase was later converted into financing (cashflow shows both the original purchase and the monthly payments).

### Target Architecture
- `transactions` = the original purchase only (category/method attribution lives here)
- `installment_plans` = financing terms for a purchase
- `installment_schedule` = monthly payment obligations (principal/interest/fees)

### Key Rules
- Converted/financed purchases **must not** be counted as one-time spending in **cashflow** views.
- Monthly totals in cashflow views are computed from:
	- `transactions` that are **not** financed/converted
	- plus `installment_schedule` rows for the period
- Category analytics still come from the original transaction category. In cashflow mode, installment payments are joined back to their purchase so payments are attributed to that purchase’s category.

### Reporting Mode
Endpoints accept `mode`:
- `mode=purchase` (accrual): sums `transactions.amount` grouped by `transactions.date`
- `mode=payment` (cashflow): sums
	- `transactions.amount` excluding financed/converted purchases
	- plus `installment_schedule.amount_principal + amount_interest + amount_fee`

Where “financed/converted” is detected **additively** (no breaking schema change):
- A transaction is treated as financed if it has an `installment_plans` row with `status IN ('active','completed')`.

### New/Updated API Endpoints
- `/api/reports/grouped?groupBy=month|year|category|method&mode=purchase|payment&startDate&endDate&category&method`
	- Grouped totals and counts
- `/api/reports?period=monthly|yearly&mode=purchase|payment&start&end&category&method`
	- Backward compatible wrapper (monthly/yearly only)
- `/api/ledger?mode=purchase|payment&startDate&endDate&category&method`
	- Unified rows for tables (transactions + schedule rows in payment mode)

### Status Semantics (Assumptions)
These queries assume:
- `installment_plans.status` in `('active','completed','cancelled')`
- `installment_schedule.status` in `('due','paid','skipped','cancelled')`

If your status values differ, update the `IN (...)` predicates in:
- `src/app/api/reports/grouped/route.ts`
- `src/app/api/reports/route.ts`
- `src/app/api/ledger/route.ts`

### Edge Cases
- Partial schedules: cashflow totals only include rows that exist in `installment_schedule`; missing months will not be “guessed”.
- Converted mid-month: the purchase is excluded from cashflow mode as soon as an active/completed plan exists; ensure you generate schedules starting from the correct month (`start_month`).
- Multiple plans per transaction: the current logic assumes at most one active/completed plan per `transaction_id`.
- Subscriptions: subscription logic is unchanged; subscription purchases are treated as normal transactions unless they are linked to an installment plan.

