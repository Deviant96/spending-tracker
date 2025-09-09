export type Transaction = {
  id: string;
  date: string;
  amount: number;
  category?: string;
  method?: string;
  notes?: string;
  installmentTotal?: number;
  installmentCurrent?: number;
  isSubscription?: boolean;
  subscriptionInterval?: "weekly" | "monthly" | "yearly";
};

export type Category = {
  id: number;
  name: string;
};

export type PaymentMethod = {
  id: string;
  name: string;
};

export type Filters = {
  category: string | null;
  month: string;
  year: string | null;
  search: string;
};