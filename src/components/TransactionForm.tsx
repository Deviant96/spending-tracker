"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, Controller, FieldErrors } from "react-hook-form";
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
import FieldError from "./FieldError";

const NONE_VALUE = "__none__";

const transactionSchema = z
  .object({
    id: z.string().uuid(),
    date: z
      .string({ error: "Date is required" })
      .min(1, "Date is required")
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be a valid date"),
    amount: z
      .number({ error: "Amount is required" })
      .refine((value) => !Number.isNaN(value), { message: "Amount is required" })
      .min(1, "Amount must be greater than 0"),
    categoryId: z.string().optional(),
    methodId: z.string().optional(),
    notes: z.string().optional(),
    isInstallment: z.boolean(),
    installmentMonths: z.number().optional(),
    interestTotal: z.number().optional(),
    feesTotal: z.number().optional(),
    isSubscription: z.boolean(),
    subscriptionInterval: z.enum(["weekly", "monthly", "yearly"]).optional(),
  })
  .refine((data) => !(data.isInstallment && data.isSubscription), {
    message: "A transaction cannot be both an installment and a subscription",
    path: ["isSubscription"],
  })
  .refine(
    (data) => !data.isInstallment || (data.installmentMonths != null && data.installmentMonths > 1),
    {
      message: "Installment months must be greater than 1",
      path: ["installmentMonths"],
    }
  )
  .refine(
    (data) => !data.isSubscription || Boolean(data.subscriptionInterval),
    {
      message: "Subscription interval is required",
      path: ["subscriptionInterval"],
    }
  );

type TransactionFormValues = z.infer<typeof transactionSchema>;

type Props = {
  onSubmit: (t: Transaction) => boolean | void | Promise<boolean | void>;
  initialTransaction?: Transaction | null;
  /** After a successful add, keep the date and clear other fields for the next entry. */
  keepDateAfterSubmit?: boolean;
};

export default function TransactionForm({
  onSubmit,
  initialTransaction,
  keepDateAfterSubmit = false,
}: Props) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    shouldUnregister: true,
    defaultValues: {
      id: initialTransaction?.id ?? crypto.randomUUID(),
      date: initialTransaction?.date ?? "",
      amount: initialTransaction?.amount ?? undefined,
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
        date: initialTransaction.date ?? "",
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

  const amountInputRef = useRef<HTMLInputElement | null>(null);

  const resetForNextEntry = (preservedDate: string) => {
    reset({
      id: crypto.randomUUID(),
      date: preservedDate,
      amount: undefined,
      categoryId: undefined,
      methodId: undefined,
      notes: "",
      isInstallment: false,
      installmentMonths: undefined,
      interestTotal: undefined,
      feesTotal: undefined,
      isSubscription: false,
      subscriptionInterval: undefined,
    });

    requestAnimationFrame(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    });
  };

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

  const onSubmitHandler = async (data: TransactionFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await onSubmit({
        id: data.id,
        date: data.date,
        amount: data.amount,
        categoryId: data.categoryId ? Number(data.categoryId) : undefined,
        methodId: data.methodId || undefined,
        notes: data.notes,
        isInstallment: data.isInstallment,
        installmentMonths: data.installmentMonths,
        interestTotal: data.interestTotal,
        feesTotal: data.feesTotal,
        isSubscription: data.isSubscription,
        subscriptionInterval: data.subscriptionInterval,
      });

      if (keepDateAfterSubmit && result !== false) {
        resetForNextEntry(data.date);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onError = (formErrors: FieldErrors<TransactionFormValues>) => {
    console.error("Form validation errors:", formErrors);
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
    if (!isInstallment) {
      setValue("installmentMonths", undefined);
      setValue("interestTotal", undefined);
      setValue("feesTotal", undefined);
    }
  }, [isInstallment, setValue]);

  useEffect(() => {
    fetchCategories();
    fetchPaymentMethods();

    if (refDatePicker.current) {
      refDatePicker.current.focus();
      refDatePicker.current.select();
    }
  }, []);

  const amountField = register("amount", {
    setValueAs: (value) => {
      if (value === "" || value === null || value === undefined) return undefined;
      const parsed = Number(value);
      return Number.isNaN(parsed) ? undefined : parsed;
    },
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmitHandler, onError)}
      className="flex flex-col gap-6 max-w-md"
    >
      <Input type="hidden" {...register("id")} />

      {/* Date */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="date" className="px-1">
          Date <span className="text-red-500">*</span>
        </Label>
        <Controller
          name="date"
          control={control}
          render={({ field }) => (
            <DatePicker
              id="date"
              value={field.value || null}
              placeholder="Select a date"
              helperText="MM/DD/YYYY"
              onDateChange={(date) => field.onChange(date ? toLocalDateString(date) : "")}
              autoFocus
              showTodayButton
            />
          )}
        />
        <FieldError message={errors.date?.message} />
      </div>

      {/* Amount */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">
          Amount <span className="text-red-500">*</span>
        </Label>
        <Input
          id="amount"
          type="number"
          onFocus={(e) => e.target.select()}
          name={amountField.name}
          onBlur={amountField.onBlur}
          onChange={amountField.onChange}
          ref={(element) => {
            amountField.ref(element);
            amountInputRef.current = element;
          }}
        />
        <FieldError message={errors.amount?.message} />
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
              onValueChange={(value) => field.onChange(value === NONE_VALUE ? undefined : value)}
              value={field.value ? String(field.value) : NONE_VALUE}
            >
              {isLoadingCategories ? (
                <Skeleton className="h-[36px] w-full rounded-full" />
              ) : (
                <>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
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
      </div>

      {/* Payment Method */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="methodId">Payment Method</Label>
        <Controller
          name="methodId"
          control={control}
          render={({ field }) => (
            <Select
              onValueChange={(value) => field.onChange(value === NONE_VALUE ? undefined : value)}
              value={field.value ? String(field.value) : NONE_VALUE}
            >
              {isLoadingPaymentMethods ? (
                <Skeleton className="h-[36px] w-full rounded-full" />
              ) : (
                <>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a payment method (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>None</SelectItem>
                {paymentMethods.map((method) => (
                  <SelectItem key={method.id} value={String(method.id)}>
                    {method.name}
                  </SelectItem>
                ))}
              </SelectContent>
                </>
              )}
            </Select>
          )}
        />
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" type="text" {...register("notes")} />
        <FieldError message={errors.notes?.message} />
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
                disabled={isSubscription}
                onCheckedChange={(checked) => {
                  const isChecked = checked === true;
                  field.onChange(isChecked);
                  if (isChecked) {
                    setValue("isSubscription", false);
                    setValue("subscriptionInterval", undefined);
                  }
                }}
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
                {...register("installmentMonths", {
                  setValueAs: (value) => {
                    if (value === "" || value === null || value === undefined) return undefined;
                    const parsed = Number(value);
                    return Number.isNaN(parsed) ? undefined : parsed;
                  },
                })}
              />
              <FieldError message={errors.installmentMonths?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interestTotal">Total Interest</Label>
              <Input
                id="interestTotal"
                type="number"
                placeholder="e.g. 500000"
                {...register("interestTotal", {
                  setValueAs: (value) => {
                    if (value === "" || value === null || value === undefined) return undefined;
                    const parsed = Number(value);
                    return Number.isNaN(parsed) ? undefined : parsed;
                  },
                })}
              />
              <FieldError message={errors.interestTotal?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feesTotal">Total Fees (Optional)</Label>
              <Input
                id="feesTotal"
                type="number"
                placeholder="e.g. 100000"
                {...register("feesTotal", {
                  setValueAs: (value) => {
                    if (value === "" || value === null || value === undefined) return undefined;
                    const parsed = Number(value);
                    return Number.isNaN(parsed) ? undefined : parsed;
                  },
                })}
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
                disabled={isInstallment}
                onCheckedChange={(checked) => {
                  const isChecked = checked === true;
                  field.onChange(isChecked);
                  if (isChecked) {
                    setValue("isInstallment", false);
                    setValue("installmentMonths", undefined);
                    setValue("interestTotal", undefined);
                    setValue("feesTotal", undefined);
                  }
                }}
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
            <FieldError message={errors.subscriptionInterval?.message} />
          </div>
        )}
        <FieldError message={errors.isSubscription?.message} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? "Saving..."
          : initialTransaction
            ? "Update"
            : keepDateAfterSubmit
              ? "Save & Add Another"
              : "Save"}
      </Button>
    </form>
  );
}
