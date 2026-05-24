"use client";

import { Filters } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";

type Props = {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  categories: string[];
  years: number[];
};

export default function TransactionFilters({ filters, setFilters, categories, years }: Props) {
  return (
    <div className="mb-6 rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-[0_18px_70px_-44px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Category Filter */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="category" className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Category</label>
        <Select
          value={filters.category ?? "all"}
          onValueChange={value => setFilters({ ...filters, category: value })}
        >
          <SelectTrigger className="w-full border-zinc-200 bg-white">
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
      <div className="flex flex-col gap-1.5">
        <label htmlFor="month" className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Month</label>
        <Select
          value={filters.month ?? "all"}
          onValueChange={value => setFilters({ ...filters, month: value })}
        >
          <SelectTrigger className="w-full border-zinc-200 bg-white">
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
      <div className="flex flex-col gap-1.5">
        <label htmlFor="year" className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Year</label>
        <Select
          value={filters.year ?? "all"}
          onValueChange={value => setFilters({ ...filters, year: value })}
        >
          <SelectTrigger className="w-full border-zinc-200 bg-white">
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
      <div className="flex flex-col gap-1.5">
        <label htmlFor="search" className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Search</label>
        <Input
          id="search"
          type="text"
          placeholder="Search notes or category"
          className="border-zinc-200 bg-white"
          value={filters.search}
          onChange={e => setFilters({ ...filters, search: e.target.value })}
        />
      </div>
      </div>
    </div>
  );
}
