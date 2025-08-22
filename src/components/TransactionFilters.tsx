"use client";

import { Filters } from "@/types";

type Props = {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  categories: string[];
  years: number[];
};

export default function TransactionFilters({ filters, setFilters, categories, years }: Props) {
  return (
    <div style={{ marginBottom: "1rem", display: "flex", gap: "1rem" }}>
      {/* Category Filter */}
      <select
        value={filters.category}
        onChange={e => setFilters({ ...filters, category: e.target.value })}
      >
        <option value="all">All Categories</option>
        {categories.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      {/* Month Filter */}
      <select
        value={filters.month}
        onChange={e => setFilters({ ...filters, month: e.target.value })}
      >
        <option value="all">All Months</option>
        {Array.from({ length: 12 }).map((_, i) => (
          <option key={i + 1} value={i + 1}>
            {new Date(0, i).toLocaleString("default", { month: "long" })}
          </option>
        ))}
      </select>

      {/* Year Filter */}
      <select
        value={filters.year}
        onChange={e => setFilters({ ...filters, year: e.target.value })}
      >
        <option value="all">All Years</option>
        {years.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      {/* Search Filter */}
      <input
        type="text"
        placeholder="Search..."
        value={filters.search}
        onChange={e => setFilters({ ...filters, search: e.target.value })}
      />
    </div>
  );
}
