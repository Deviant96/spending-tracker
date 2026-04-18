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
  installmentMonths: z.number().optional(),
  interestTotal: z.number().optional(),
  feesTotal: z.number().optional(),
  isSubscription: z.boolean(),
  subscriptionInterval: z.enum(["weekly", "monthly", "yearly"]).optional(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

type Props = {
  onSubmit: (t: any) => void;
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
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      id: initialTransaction?.id ?? crypto.randomUUID(),
      date: initialTransaction?.date ?? null,
      amount: initialTransaction?.amount ?? 0,
      categoryId: initialTransaction?.categoryId?.toString() ?? undefined,
      methodId: initialTransaction?.methodId?.toString() ?? undefined,
      notes: initialTransaction?.notes ?? undefined,
      isInstallment: !!initialTransaction?.planMonths,
      installmentMonths: initialTransaction?.planMonths ?? undefined,
      interestTotal: initialTransaction?.planInterest ?? 0,
      feesTotal: 0,
      isSubscription: Boolean(initialTransaction?.isSubscription) ?? false,
      subscriptionInterval: initialTransaction?.subscriptionInterval ?? undefined,
    },
  });

  const isInstallment = watch("isInstallment");
  const isSubscription = watch("isSubscription");

  const toLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const normalizeId = (value: unknown): string | undefined => {
    if (value === null || value === undefined) return undefined;
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : undefined;
  };
  
  // Set form values when initialTransaction is available
  useEffect(() => {
    if (initialTransaction) {
      const categoryId = normalizeId(initialTransaction.categoryId);
      const methodId = normalizeId(initialTransaction.methodId);
      const planMonths = Number(initialTransaction.planMonths ?? 0);
      const isSubscription = Boolean(initialTransaction.isSubscription);

      reset({
        id: initialTransaction.id,
        date: initialTransaction.date ?? null,
        amount: Number(initialTransaction.amount ?? 0),
        categoryId,
        methodId,
        notes: initialTransaction.notes ?? "",
        isInstallment: planMonths > 0 || initialTransaction.financingStatus === "converted",
        installmentMonths: planMonths || undefined,
        interestTotal: Number(initialTransaction.planInterest ?? 0),
        feesTotal: 0,
        isSubscription,
        subscriptionInterval: initialTransaction.subscriptionInterval ?? undefined,
      });
    }
  }, [initialTransaction, reset]);

  useEffect(() => {
    if (!initialTransaction) return;

    const currentCategoryId = getValues("categoryId");
    if (!currentCategoryId && initialTransaction.category && categories.length > 0) {
      const match = categories.find(
        (category) => category.name.toLowerCase() === initialTransaction.category?.toLowerCase()
      );
      if (match) {
        setValue("categoryId", String(match.id));
      }
    }
  }, [categories, initialTransaction, getValues, setValue]);

  useEffect(() => {
    if (!initialTransaction) return;

    const currentMethodId = getValues("methodId");
    if (!currentMethodId && initialTransaction.method && paymentMethods.length > 0) {
      const match = paymentMethods.find(
        (method) => method.name.toLowerCase() === initialTransaction.method?.toLowerCase()
      );
      if (match) {
        setValue("methodId", String(match.id));
      }
    }
  }, [paymentMethods, initialTransaction, getValues, setValue]);

  // Re-apply category and method values after they are loaded
  useEffect(() => {
    if (initialTransaction && (categories.length > 0 || paymentMethods.length > 0)) {
      const categoryId = initialTransaction.categoryId?.toString();
      const methodId = initialTransaction.methodId?.toString();
      
      if (categoryId && categories.length > 0) {
        setValue("categoryId", categoryId);
      }
      if (methodId && paymentMethods.length > 0) {
        setValue("methodId", methodId);
      }
    }
  }, [categories, paymentMethods, initialTransaction, setValue]);

  const onSubmitHandler = (data: TransactionFormValues) => {
    console.log("Form submitted with data:", data);
    onSubmit({ ...data, date: data.date || "" });
  };

  const onError = (errors: any) => {
    console.error("Form validation errors:", errors);
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
      setPaymentMethods(
        data.map((method: PaymentMethod) => ({
          ...method,
          id: String(method.id),
        }))
      );
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
      onSubmit={handleSubmit(onSubmitHandler, onError)}
      className="flex flex-col gap-6 max-w-md"
    >
      {/* Debug: Show validation errors */}
      {Object.keys(errors).length > 0 && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <h3 className="font-bold">Validation Errors:</h3>
          <ul className="list-disc ml-5">
            {Object.entries(errors).map(([field, error]: [string, any]) => (
              <li key={field}>
                {field}: {error?.message || "Invalid"}
              </li>
            ))}
          </ul>
        </div>
      )}

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
              value={field.value}
              placeholder="Select a date"
              helperText="MM/DD/YYYY"
              onDateChange={(date) => field.onChange(date ? toLocalDateString(date) : null)}
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
              value={field.value ? String(field.value) : undefined}
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
                    <SelectItem key={category.id} value={String(category.id)}>
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
            <Select onValueChange={field.onChange} value={field.value ? String(field.value) : undefined}>
              <SelectTrigger>
                <SelectValue placeholder="Select a payment method" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((method) => (
                  <SelectItem key={method.id} value={String(method.id)}>
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
          <div className="mt-2 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="installmentMonths">Total Months</Label>
              <Input
                id="installmentMonths"
                type="number"
                placeholder="e.g. 12"
                {...register("installmentMonths", { valueAsNumber: true })}
              />
              {errors.installmentMonths && (
                <p className="text-sm text-red-500">
                  {errors.installmentMonths.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="interestTotal">Total Interest</Label>
              <Input
                id="interestTotal"
                type="number"
                placeholder="e.g. 500000"
                {...register("interestTotal", { valueAsNumber: true })}
              />
              {errors.interestTotal && (
                <p className="text-sm text-red-500">
                  {errors.interestTotal.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="feesTotal">Total Fees (Optional)</Label>
              <Input
                id="feesTotal"
                type="number"
                placeholder="e.g. 100000"
                {...register("feesTotal", { valueAsNumber: true })}
              />
            </div>
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
                <Select onValueChange={field.onChange} value={field.value}>
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
