"use client";

import { Category, PaymentMethod, Transaction } from "@/types";
import { formatToRupiah } from "@/utils/currency";
import { useEffect, useState, useCallback, useRef } from "react";

interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  category: string;
  paymentMethod: string;
}

type ReportRow = {
  period: string;
  count: number;
  total: number;
};

type SortField = "period" | "count" | "total";
type SortDirection = "asc" | "desc";

export default function ReportsPage() {
  const [groupBy, setGroupBy] = useState<"month" | "year">("month");
  const [data, setData] = useState<ReportRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingGroupedSpending, setLoadingGroupedSpending] = useState(false);

  // New loading states for static resources
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);

  // convenience flag if needed
  const loadingStatic = loadingCategories || loadingPaymentMethods;

  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("period");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const abortStaticRef = useRef<AbortController | null>(null);
  const abortReportRef = useRef<AbortController | null>(null);

  const [spendingData, setSpendingData] = useState<Transaction[]>([]);
  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: new Date(new Date().setMonth(new Date().getMonth() - 1))
      .toISOString()
      .split("T")[0],
    dateTo: new Date().toISOString().split("T")[0],
    category: "all",
    paymentMethod: "all",
  });

  console.log(filters);

  // Apply filters to data
  const filteredData = spendingData.filter((item: Transaction) => {
    const itemDate = new Date(item.date);
    const fromDate = new Date(filters.dateFrom);
    const toDate = new Date(filters.dateTo);
    const categoryMatch =
      filters.category === "all" || item.category === filters.category;
    const paymentMethodMatch =
      filters.paymentMethod === "all" || item.method === filters.paymentMethod;

    return (
      itemDate >= fromDate &&
      itemDate <= toDate &&
      categoryMatch &&
      paymentMethodMatch
    );
  });

  // Calculate totals for summary
  const totalSpending = filteredData.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  const abortControllerRef = useRef<AbortController | null>(null);

  const sortData = useCallback(
    (data: ReportRow[]) => {
      return [...data].sort((a, b) => {
        if (sortField === "period") {
          return sortDirection === "asc"
            ? a.period.localeCompare(b.period)
            : b.period.localeCompare(a.period);
        } else {
          const valueA = a[sortField];
          const valueB = b[sortField];
          return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
        }
      });
    },
    [sortField, sortDirection]
  );

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleFilterChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const fetchStaticData = useCallback(async () => {
    if (abortStaticRef.current) {
      abortStaticRef.current.abort();
    }
    const controller = new AbortController();
    abortStaticRef.current = controller;

    try {
      setLoadingCategories(true);
      setLoadingPaymentMethods(true);
      setError(null);

      const [categoriesRes, paymentMethodsRes] = await Promise.all([
        fetch("/api/categories", { signal: controller.signal }),
        fetch("/api/payment_methods", { signal: controller.signal }),
      ]);

      if (!categoriesRes.ok) {
        throw new Error(`Failed to fetch categories: ${categoriesRes.status}`);
      }
      if (!paymentMethodsRes.ok) {
        throw new Error(`Failed to fetch payment methods: ${paymentMethodsRes.status}`);
      }

      const categories = await categoriesRes.json();
      setCategories(categories.data);

      const paymentMethods = await paymentMethodsRes.json();
      setPaymentMethods(paymentMethods.data);

    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message || "Something went wrong");
      }
    } finally {
      setLoadingCategories(false);
      setLoadingPaymentMethods(false);
    }
  }, []);

  const fetchReport = useCallback(async () => {
    if (abortReportRef.current) {
      abortReportRef.current.abort();
    }
    const controller = new AbortController();
    abortReportRef.current = controller;

    try {
      setLoadingGroupedSpending(true);
      setError(null);

      const [res, resTransactions] = await Promise.all([
        fetch(`/api/reports/grouped?groupBy=${groupBy}`, {
          signal: controller.signal,
        }),
        fetch(`/api/transactions`, {
          signal: controller.signal,
        }),
      ]);

      if (!res.ok) {
        throw new Error(`Failed to fetch report: ${res.status}`);
      }
      if (!resTransactions.ok) {
        throw new Error(`Failed to fetch transactions: ${resTransactions.status}`);
      }

      const data = await res.json();
      setData(sortData(data));

      const spendingData = await resTransactions.json();
      setSpendingData(spendingData);

    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message || "Something went wrong");
      }
    } finally {
      setLoadingGroupedSpending(false);
    }
  }, [groupBy, sortData]);

  // Fetch static data once on mount
  useEffect(() => {
    fetchStaticData();

    return () => {
      if (abortStaticRef.current) {
        abortStaticRef.current.abort();
      }
    };
  }, [fetchStaticData]);

  // Fetch report data on groupBy change
  useEffect(() => {
    fetchReport();

    return () => {
      if (abortReportRef.current) {
        abortReportRef.current.abort();
      }
    };
  }, [fetchReport]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Reports</h1>

      <section>
        <div className="mb-6 flex gap-4 items-center">
          <label className="flex items-center gap-2" htmlFor="group-by">
            Group By:
            <select
              id="group-by"
              className="border rounded p-2"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as "month" | "year")}
            >
              <option value="month">month</option>
              <option value="year">year</option>
            </select>
          </label>
        </div>

        <table aria-label="Expense reports">
          <thead>
            <tr>
              <th
                className="border p-2 text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handleSort("period")}
              >
                Period{" "}
                {sortField === "period" &&
                  (sortDirection === "asc" ? "▲" : "▼")}
              </th>
              <th
                className="border p-2 text-right cursor-pointer hover:bg-gray-200"
                onClick={() => handleSort("count")}
              >
                Count{" "}
                {sortField === "count" &&
                  (sortDirection === "asc" ? "▲" : "▼")}
              </th>
              <th
                className="border p-2 text-right cursor-pointer hover:bg-gray-200"
                onClick={() => handleSort("total")}
              >
                Total{" "}
                {sortField === "total" &&
                  (sortDirection === "asc" ? "▲" : "▼")}
              </th>
            </tr>
          </thead>
          <tbody>
              <>
                {data.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-gray-500">
                      No data available
                    </td>
                  </tr>
                )}
                {data.map((row) => (
                  <tr key={row.period} className="hover:bg-gray-50">
                    <td className="border p-2">{row.period}</td>
                    <td className="border p-2 text-right">{row.count}</td>
                    <td className="border p-2 text-right">
                      {row.total.toLocaleString("id-ID", {
                        style: "currency",
                        currency: "IDR",
                      })}
                    </td>
                  </tr>
                ))}
              </>
          </tbody>
        </table>
      </section>

      

      <section
        className="filters"
        style={{
          marginBottom: "2rem",
          padding: "1rem",
          backgroundColor: "#f7f7f7",
          borderRadius: "8px",
        }}
      >
        <h2>Filters</h2>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <label htmlFor="dateFrom">From: </label>
            <input
              type="date"
              id="dateFrom"
              name="dateFrom"
              value={filters.dateFrom}
              onChange={handleFilterChange}
            />
          </div>
          <div>
            <label htmlFor="dateTo">To: </label>
            <input
              type="date"
              id="dateTo"
              name="dateTo"
              value={filters.dateTo}
              onChange={handleFilterChange}
            />
          </div>
          <div>
            <label htmlFor="category">Category: </label>
            <select
              id="category"
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
            >
              <option key="all" value="all">
                All Categories
              </option>
              {loadingCategories && <option disabled aria-disabled="true">Loading categories...</option>}
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="paymentMethod">Payment Method: </label>
            <select
              id="paymentMethod"
              name="paymentMethod"
              value={filters.paymentMethod}
              onChange={handleFilterChange}
            >
              <option key="all" value="all">
                All Payment Methods
              </option>
              {loadingPaymentMethods && <option disabled aria-disabled="true">Loading payment methods...</option>}
              {paymentMethods.map((paymentMethod) => (
                <option key={paymentMethod.id} value={paymentMethod.name}>
                  {paymentMethod.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {loading && <div>Loading report data...</div>}

      {error && <div style={{ color: "red" }}>{error}</div>}

      {!loading && !error && (
        <>
          <div>
            <section className="summary" style={{ marginBottom: "2rem" }}>
              <h2>Spending Summary</h2>
              <div
                style={{
                  padding: "1rem",
                  backgroundColor: "#e6f7ff",
                  borderRadius: "8px",
                }}
              >
                <p>
                  Total Spending: <strong>{formatToRupiah(totalSpending)}</strong>
                </p>
                <p>
                  Number of Transactions: <strong>{filteredData.length}</strong>
                </p>
              </div>
            </section>

            <section className="data-table">
              <h2>Spending Details</h2>
              {filteredData.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f0f0f0" }}>
                      <th style={{ padding: "0.5rem", textAlign: "left" }}>
                        Date
                      </th>
                      <th style={{ padding: "0.5rem", textAlign: "left" }}>
                        Category
                      </th>
                      <th style={{ padding: "0.5rem", textAlign: "left" }}>
                        Method
                      </th>
                      <th style={{ padding: "0.5rem", textAlign: "left" }}>
                        Notes
                      </th>
                      <th style={{ padding: "0.5rem", textAlign: "left" }}>
                        Installments
                      </th>
                      <th style={{ padding: "0.5rem", textAlign: "left" }}>
                        Subscription
                      </th>
                      <th style={{ padding: "0.5rem", textAlign: "right" }}>
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item) => (
                      <tr
                        key={item.id}
                        style={{ borderBottom: "1px solid #ddd" }}
                      >
                        <td style={{ padding: "0.5rem" }}>
                          {new Date(item.date).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          {item.category ? item.category.charAt(0).toUpperCase() + item.category.slice(1) : 'Unknown'}
                        </td>
                        <td style={{ padding: "0.5rem" }}>{item.method}</td>
                        <td style={{ padding: "0.5rem" }}>
                          {item.notes || "-"}
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          {item.installmentCurrent && item.installmentTotal
                            ? `${item.installmentCurrent} of ${item.installmentTotal}`
                            : "-"}
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          {item.isSubscription
                            ? `Yes (${item.subscriptionInterval || "N/A"})`
                            : "No"}
                        </td>
                        <td style={{ padding: "0.5rem", textAlign: "right" }}>
                          {formatToRupiah(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No spending data found for the selected filters.</p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
