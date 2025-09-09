import { useEffect, useState } from "react";
import { Category } from "@/types";

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    async function fetchCategories() {
      const response = await fetch("/api/categories");
      const { data } = await response.json();
      setCategories(data);
    }

    fetchCategories();
  }, []);

  return { categories };
}