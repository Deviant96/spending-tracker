"use client";

import { Filters } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { FormControl, FormField } from "./ui/form";
import { Input } from "./ui/input";

type Props = {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  categories: string[];
  years: number[];
};

export default function TransactionFilters({ filters, setFilters, categories, years }: Props) {
  console.log(categories);
  return (
    <div style={{ marginBottom: "1rem", display: "flex", gap: "1rem" }}>
      {/* Category Filter */}
      <div className="flex flex-row flex-nowrap items-center gap-2.5">
        <label htmlFor="category" className="font-semibold">Category:</label>
        <Select
          onValueChange={value => setFilters({ ...filters, category: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <>
              <SelectItem value="all">
                All
              </SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </>
          </SelectContent>
        </Select>
      </div>

      {/* Month Filter */}
      <div className="flex flex-row flex-nowrap items-center gap-2.5">
        <label htmlFor="month" className="font-semibold">Month:</label>
        <Select
          onValueChange={value => setFilters({ ...filters, month: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <>
              <SelectItem value="all">
                All
              </SelectItem>
              {Array.from({ length: 12 }).map((_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  {new Date(0, i).toLocaleString("default", { month: "long" })}
                </SelectItem>
              ))}
            </>
          </SelectContent>
        </Select>
      </div>

      {/* Year Filter */}
      <div className="flex flex-row flex-nowrap items-center gap-2.5">
        <label htmlFor="year" className="font-semibold">Year:</label>
        <Select
          value={filters.year ?? "all"}
          onValueChange={value => setFilters({ ...filters, year: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <>
              <SelectItem value="all">
                All Years
              </SelectItem>
              {years.map(y => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </>
          </SelectContent>
        </Select>
      </div>

      {/* Search Filter */}
      <Input
        type="text"
        placeholder="Search..."
        value={filters.search}
        onChange={e => setFilters({ ...filters, search: e.target.value })}
      />
    </div>
  );
}
