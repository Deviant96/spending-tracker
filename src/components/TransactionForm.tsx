"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Category, PaymentMethod, Transaction } from "@/types";
import { formatToRupiah } from "@/utils/currency";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import DatePicker from "./ui/DatePicker";
import { Skeleton } from "./ui/skeleton";

const transactionSchema = z.object({
  id: z.string().uuid(),
  date: z.string().nullable(),
  amount: z.number().min(1, "Amount must be greater than 0"),
  categoryId: z.string().nonempty("Category is required"),
  methodId: z.string().nonempty("Payment method is required"),
  notes: z.string().optional(),
  isInstallment: z.boolean(),
  installmentTotal: z.number().optional(),
  installmentCurrent: z.number().optional(),
  isSubscription: z.boolean(),
  subscriptionInterval: z.enum(["weekly", "monthly", "yearly"]).optional(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

type Props = {
  onSubmit: (t: Transaction) => void;
  initialTransaction?: Transaction | null;
};

export default function TransactionForm({ onSubmit, initialTransaction }: Props) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState<boolean>(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState<boolean>(false);

  const refDatePicker = useRef<HTMLInputElement>(null);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      id: initialTransaction?.id ?? crypto.randomUUID(),
      date: initialTransaction?.date ?? null,
      amount: initialTransaction?.amount ?? 0,
      categoryId: initialTransaction?.categoryId ?? "",
      methodId: initialTransaction?.methodId ?? "",
      notes: initialTransaction?.notes ?? "",
      isInstallment:
        !!initialTransaction?.installmentTotal ||
        !!initialTransaction?.installmentCurrent,
      installmentTotal: initialTransaction?.installmentTotal ?? undefined,
      installmentCurrent: initialTransaction?.installmentCurrent ?? undefined,
      isSubscription: initialTransaction?.isSubscription ?? false,
      subscriptionInterval: initialTransaction?.subscriptionInterval ?? undefined,
    },
  });

  const isInstallment = watch("isInstallment");
  const isSubscription = watch("isSubscription");
  useEffect(() => {
    if (initialTransaction) {
      Object.entries(initialTransaction).forEach(([key, value]) => {
        setValue(key as keyof TransactionFormValues, value);
      });
    }
  }, [initialTransaction, setValue]);

  const onSubmitHandler = (data: TransactionFormValues) => {
    onSubmit({ ...data, date: data.date || "" });
  };

  const fetchCategories = async () => {
    setIsLoadingCategories(true);
    try {
      const response = await fetch("/api/categories");
      const { data } = await response.json();
      setCategories(data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const fetchPaymentMethods = async () => {
    setIsLoadingPaymentMethods(true);
      try {
        const response = await fetch("/api/payment-methods");
      const { data } = await response.json();
      setPaymentMethods(data);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
    } finally {
      setIsLoadingPaymentMethods(false);
    };
  }

  useEffect(() => {
    console.log(isSubscription);
  }, [isSubscription]); 

  useEffect(() => {
    fetchCategories();
    fetchPaymentMethods();

    if (refDatePicker.current) {
      refDatePicker.current.focus();
      refDatePicker.current.select();
    }
  }, []);

  return (
    <form
      onSubmit={handleSubmit(onSubmitHandler)}
      className="flex flex-col gap-6 max-w-md"
    >
      {/* Date */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="date" className="px-1">
          Date
        </Label>
        <Controller
          name="date"
          control={control}
          render={({ field }) => (
            <DatePicker
              id="date"
              placeholder="Select a date"
              helperText="MM/DD/YYYY"
              onDateChange={(date) => field.onChange(date?.toISOString())}
              autoFocus
            />
          )}
        />
        {errors.date && <span>{errors.date.message}</span>}
      </div>

      {/* Amount */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">Amount</Label>
        <Input
          id="amount"
          type="number"
          onFocus={(e) => e.target.select()}
          {...register("amount", { valueAsNumber: true })}
        />
        {errors.amount && <span>{errors.amount.message}</span>}
        <small 
          style={{ 
            display: "block", 
            marginTop: "4px", 
            color: "#888", 
            fontSize: "0.8em" 
            }}
        >
          {formatToRupiah(watch("amount") || 0)}
        </small>
      </div>

      {/* Category */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="categoryId">Category</Label>
        <Controller
          name="categoryId"
          control={control}
          render={({ field }) => (
            <Select 
              onValueChange={field.onChange} 
              defaultValue={field.value}
            >
              {isLoadingCategories ? (
                <Skeleton className="h-[36px] w-full rounded-full" />
              ) : (
                <>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
                </>
              )}
            </Select>
          )}
        />
        {errors.categoryId && <span>{errors.categoryId.message}</span>}
      </div>

      {/* Payment Method */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="methodId">Payment Method</Label>
        <Controller
          name="methodId"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger>
                <SelectValue placeholder="Select a payment method" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((method) => (
                  <SelectItem key={method.id} value={method.id}>
                    {method.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.methodId && <span>{errors.methodId.message}</span>}
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" type="text" {...register("notes")} />
        {errors.notes && <span>{errors.notes.message}</span>}
      </div>

      {/* Is Installment */}
      <div>
        <Controller
          name="isInstallment"
          control={control}
          render={({ field }) => (
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange} // very important
                id="isInstallment"
              />
              <Label htmlFor="isInstallment">Is Installment?</Label>
            </div>
          )}
        />
        {isInstallment && (
          <div className="mt-2 flex flex-col gap-2">
            <Input
              type="number"
              placeholder="Installment Current"
              {...register("installmentCurrent", { valueAsNumber: true })}
            />
            <Input
              type="number"
              placeholder="Installment Total"
              {...register("installmentTotal", { valueAsNumber: true })}
            />
          </div>
        )}
      </div>

      {/* Is Subscription */}
      <div>
        <Controller
          name="isSubscription"
          control={control}
          render={({ field }) => (
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange} // very important
                id="isSubscription"
              />
              <Label htmlFor="isSubscription">Is Subscription?</Label>
            </div>
          )}
        />
        {isSubscription && (
          <div className="mt-2">
            <Controller
              name="subscriptionInterval"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Interval" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        )}
      </div>

      <Button type="submit">
        {initialTransaction ? "Update" : "Save"}
      </Button>
    </form>
  );
}
