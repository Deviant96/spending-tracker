### Self-calc + AI features (except Plan Advisor)

#### Self-calculation engine (`src/lib/calc/`)
- Installment TCO, monthly breakdown, approximate APR, payoff month
- Cashflow calendar (installments + expanded subscriptions, peak/tight months)
- Accrual ↔ cashflow reconciliation
- Budget vs actual with month-end projection
- Subscription runway (monthly/yearly, next renewal, cancel-to-save)
- What-if scenarios: payoff early, refinance months, cut category
- Anomaly detection (spikes, duplicates, category drift, missed installments)
- Note/CSV auto-classification heuristics

#### APIs
- `/api/calc/*` — installment, cashflow, reconcile, budgets, subscriptions, scenarios, anomalies
- `/api/ai/*` — insights coach, NL ask, classify, monthly/weekly digest
- Optional `OPENAI_API_KEY` polishes copy; numbers always come from calc

#### UI
- Live installment calculator in `TransactionForm`
- Pages: `/cashflow`, `/budgets`, `/subscriptions`, `/scenarios`, `/insights`, `/ask`
- Dashboard quick links + smarter `InsightsBox`
- CSV import auto-classify hints
- Nav + site metadata updated

#### DB
- `migrations/002_budgets_and_digests.sql` — `budgets`, `financial_digests`

#### Tests
- `src/lib/calc/calc.test.ts` covers core calc + intent parsing
