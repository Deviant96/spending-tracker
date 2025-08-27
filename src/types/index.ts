export type Transaction = {
  id: string;
  date: string;
  amount: number;
  category?: string;
  categoryId?: string;
  methodId: string;
  method?: string;
  notes?: string;
  installmentTotal?: number;
  installmentCurrent?: number;
  isSubscription?: boolean;
  subscriptionInterval?: "weekly" | "monthly" | "yearly";
};

export type Category = {
  id: string;
  name: string;
};

export type PaymentMethod = {
  id: string;
  name: string;
};

export type Filters = {
  category: string;
  month: string;
  year: string;
  search: string;
};