"use client";

import { useEffect, useState } from "react";
import { InstallmentPlan, InstallmentSchedule } from "@/types";
import { formatToRupiah } from "@/utils/currency";
import { Button } from "./ui/button";

type Props = {
  transactionId?: string;
  showAll?: boolean;
};

export default function InstallmentManager({ transactionId, showAll = false }: Props) {
  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<InstallmentPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, [transactionId, showAll]);

  const fetchPlans = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = transactionId 
        ? `/api/installments?transactionId=${transactionId}`
        : `/api/installments`;
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.success) {
        setPlans(data.data);
      } else {
        setError(data.error || "Failed to fetch installment plans");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to fetch installment plans");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPlanDetails = async (planId: number) => {
    try {
      const res = await fetch(`/api/installments/${planId}`);
      const data = await res.json();
      
      if (data.success) {
        setSelectedPlan(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markAsPaid = async (planId: number, scheduleId: number) => {
    try {
      const res = await fetch(`/api/installments/${planId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleIds: [scheduleId] }),
      });

      const data = await res.json();
      if (data.success) {
        // Refresh plan details
        await fetchPlanDetails(planId);
        await fetchPlans();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deletePlan = async (planId: number) => {
    if (!confirm("Are you sure you want to delete this installment plan? The transaction will be reverted to one-time payment.")) {
      return;
    }

    try {
      const res = await fetch(`/api/installments/${planId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        setSelectedPlan(null);
        await fetchPlans();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) return <p>Loading installment plans...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (plans.length === 0) return <p>No installment plans found.</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Installment Plans</h2>
      
      {/* Plans List */}
      <div className="grid gap-4">
        {plans.map((plan) => {
          const totalAmount = plan.principal + plan.interestTotal + plan.feesTotal;
          const monthlyAmount = Math.ceil(totalAmount / plan.months);
          const progress = plan.paidInstallments && plan.totalInstallments
            ? (plan.paidInstallments / plan.totalInstallments) * 100
            : 0;

          return (
            <div
              key={plan.planId}
              className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50"
              onClick={() => fetchPlanDetails(plan.planId)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{plan.category || "Uncategorized"}</h3>
                  <p className="text-sm text-gray-600">
                    {plan.transactionDate} • {plan.method}
                  </p>
                  <p className="text-sm mt-1">
                    {formatToRupiah(monthlyAmount)} × {plan.months} months
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatToRupiah(totalAmount)}</p>
                  <span className={`text-sm px-2 py-1 rounded ${
                    plan.status === 'active' ? 'bg-green-100 text-green-800' :
                    plan.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {plan.status}
                  </span>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{plan.paidInstallments || 0} of {plan.totalInstallments || 0} paid</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Plan Details Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold">{selectedPlan.category}</h3>
                <p className="text-sm text-gray-600">{selectedPlan.transactionDate}</p>
              </div>
              <Button
                variant="outline"
                onClick={() => setSelectedPlan(null)}
              >
                Close
              </Button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Principal</p>
                <p className="font-semibold">{formatToRupiah(selectedPlan.principal)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Interest</p>
                <p className="font-semibold">{formatToRupiah(selectedPlan.interestTotal)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Fees</p>
                <p className="font-semibold">{formatToRupiah(selectedPlan.feesTotal)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="font-semibold text-lg">
                  {formatToRupiah(
                    selectedPlan.principal + 
                    selectedPlan.interestTotal + 
                    selectedPlan.feesTotal
                  )}
                </p>
              </div>
            </div>

            {/* Payment Schedule */}
            <h4 className="font-semibold mb-3">Payment Schedule</h4>
            <div className="space-y-2">
              {selectedPlan.schedule?.map((schedule: InstallmentSchedule) => {
                const totalPayment = 
                  schedule.amountPrincipal + 
                  schedule.amountInterest + 
                  schedule.amountFee;

                return (
                  <div
                    key={schedule.scheduleId}
                    className={`border rounded p-3 flex justify-between items-center ${
                      schedule.status === 'paid' ? 'bg-green-50 border-green-200' :
                      schedule.status === 'overdue' ? 'bg-red-50 border-red-200' :
                      'bg-white'
                    }`}
                  >
                    <div>
                      <p className="font-medium">{schedule.dueMonth}</p>
                      <p className="text-sm text-gray-600">
                        Principal: {formatToRupiah(schedule.amountPrincipal)} | 
                        Interest: {formatToRupiah(schedule.amountInterest)}
                        {schedule.amountFee > 0 && ` | Fee: ${formatToRupiah(schedule.amountFee)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-semibold">{formatToRupiah(totalPayment)}</p>
                      {schedule.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => markAsPaid(selectedPlan.planId, schedule.scheduleId)}
                        >
                          Mark Paid
                        </Button>
                      )}
                      {schedule.status === 'paid' && (
                        <span className="text-sm text-green-600">✓ Paid</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <Button
                variant="destructive"
                onClick={() => deletePlan(selectedPlan.planId)}
              >
                Delete Plan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
