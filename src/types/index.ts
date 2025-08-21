export type Transaction = {
  id: string;
  date: string;
  amount: number;
  category: string;
  method: string;
  notes?: string;
};

export type Category = {
  id: string;
  name: string;
  type: "expense" | "income";
};
