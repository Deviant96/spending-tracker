export type Transaction = {
  id: string;
  date: string;
  amount: number;
  categoryId?: number;
  methodId?: number;
  category?: string;
  method?: string;
  notes?: string;
  
  // Financing status
  financingStatus?: 'one_time' | 'converted' | 'subscription';
  
  // Subscription fields
  isSubscription?: boolean;
  subscriptionInterval?: "weekly" | "monthly" | "yearly";
  
  // Installment plan details (when joined)
  planId?: number;
  planMonths?: number;
  planInterest?: number;
  planPrincipal?: number;
  planStartMonth?: string;
  planStatus?: 'active' | 'completed' | 'cancelled';
  
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
};

export type InstallmentPlan = {
  planId: number;
  transactionId: string;
  principal: number;
  months: number;
  interestTotal: number;
  feesTotal: number;
  startMonth: string;
  status: 'active' | 'completed' | 'cancelled';
  createdAt?: string;
  updatedAt?: string;
  
  // Joined transaction fields
  transactionDate?: string;
  transactionAmount?: number;
  category?: string;
  method?: string;
  notes?: string;
  
  // Aggregated schedule info
  totalInstallments?: number;
  paidInstallments?: number;
  schedule?: InstallmentSchedule[];
};

export type InstallmentSchedule = {
  scheduleId: number;
  planId: number;
  dueMonth: string;
  amountPrincipal: number;
  amountInterest: number;
  amountFee: number;
  status: 'pending' | 'paid' | 'overdue';
  paidAt?: string | null;
  createdAt?: string;
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