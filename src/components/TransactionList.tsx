"use client";

import { Transaction } from "@/types";
import { useState } from "react";
import TransactionForm from "./TransactionForm";
import { useTransactions } from "@/hooks/useTransactions";
import { formatToRupiah } from "@/utils/currency";

type Props = {
  transactions: Transaction[];
  onDelete: (id: string) => Promise<boolean | void>,
  onEdit: (t: Transaction) => Promise<boolean | void>,
  isLoaded: boolean;
};

export default function TransactionList({ transactions, onDelete, onEdit, isLoaded }: Props) {
  const [dialogDeleteOpen, setDialogDeleteOpen] = useState<boolean>(false);
  const [dialogEditOpen, setDialogEditOpen] = useState<boolean>(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [transactionToEdit, setTransactionToEdit] = useState<string | null>(null);
  const { getTransaction } = useTransactions();
  const [ singleTransaction, setSingleTransaction ] = useState<Transaction | undefined>(undefined);

  const getSingleTransaction = (id: string) => {
    if (id) {
      const transaction = getTransaction(id);
      setSingleTransaction(transaction ?? undefined);
    } else {
      setSingleTransaction(undefined);
    }
  }

  const handleDialogDeleteOpen = (id: string) => {
    setTransactionToDelete(id);
    setDialogDeleteOpen(true);
  }

  const handleDialogDeleteClose = () => {
    setDialogDeleteOpen(false);
  }

  async function getATransaction(id: string) {
    const res = await fetch(`/api/transactions/${id}`);
    // if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  }

  const handleDialogEditOpen = async (id: string) => {
    setDialogEditOpen(true);
    // console.log(transactionToEdit);
    const data = await getATransaction(id);
    console.log(data.data);
    setSingleTransaction(data.data);
    // console.log(transactionToEdit);
  }

  const handleDialogEditClose = () => {
    setDialogEditOpen(false);
    setSingleTransaction(undefined);
    setTransactionToEdit(null);
  }

  const handleDelete = async () => {
    if (transactionToDelete){
      try {
        await onDelete(transactionToDelete);
      } catch (error) {
        console.error(error);
      } finally {
        setTransactionToDelete(null);
        handleDialogDeleteClose();
      }
    }
  }

  const handleEdit = async (t: Transaction) => {
    try {
      const result = await onEdit(t);
    } catch (error) {
      console.error(error);
    } finally {
      handleDialogEditClose();
    }
  };

  if (!isLoaded) {
    return <p>Loading...</p>
  }
  
  if (transactions.length === 0) {
    return <p>No transactions yet.</p>;
  }

  // Replaced dayjs with native JavaScript date handling
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <>
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          marginTop: "1rem",
        }}
      >
        <thead>
          <tr>
            <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Date</th>
            <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Amount</th>
            <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Category</th>
            <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Payment Method</th>
            <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Notes</th>
            <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Installment</th>
            <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Subscription</th>
            <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>{formatDate(t.date)}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
                {formatToRupiah(t.amount)}
              </td>
              <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>{t.category}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>{t.method}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>{t.notes}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
                {t.installmentTotal && t.installmentCurrent && (
                  <div>
                    {t.installmentCurrent} of {t.installmentTotal}
                  </div>
                )}
              </td>
              <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
                {t.isSubscription === true && (
                  <div>
                    Subscription {t.subscriptionInterval ?  ` (${t.subscriptionInterval})` : ""}
                  </div>
                ) || (
                  <div style={{ color: "rgb(0, 0, 0, 0.35)" }}>
                    No
                  </div>
                )}
              </td>
              <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={(e) => handleDialogDeleteOpen(t.id)} className="text-red-500 hover:text-red-700">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18.75A2.25 2.25 0 008.25 21h7.5A2.25 2.25 0 0018 18.75V7.5H6v11.25zM9.75 10.5v6m4.5-6v6M8.25 7.5V6A2.25 2.25 0 0110.5 3.75h3A2.25 2.25 0 0115.75 6v1.5m-9 0h10.5" />
                    </svg>
                  </button>
                  <button onClick={() => handleDialogEditOpen(t.id)} className="text-blue-500 hover:text-blue-700">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.25 2.25 0 113.182 3.182L7.061 20.652a4.5 4.5 0 01-1.691 1.07l-3.387 1.13 1.13-3.387a4.5 4.5 0 011.07-1.691L16.862 4.487z" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))} 
        </tbody>
      </table>

      {dialogDeleteOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
            <h2 className="text-lg font-semibold mb-4">Confirm Deletion</h2>
            <p className="text-gray-700 mb-4">Are you sure want to delete this record?</p>
            <div className="flex justify-end gap-2">
              <button onClick={handleDialogDeleteClose} className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">
                Cancel
              </button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {dialogEditOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
            <TransactionForm
              onSubmit={handleEdit}
              initialTransaction={singleTransaction}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={handleDialogEditClose} className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
