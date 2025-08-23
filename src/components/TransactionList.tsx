"use client";

import { Transaction } from "@/types";
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Stack } from "@mui/material";
import dayjs from "dayjs";
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from "@mui/icons-material/Edit";
import { useState } from "react";

type Props = {
  transactions: Transaction[];
  onDelete: (id: string) => Promise<boolean | void>,
  isLoaded: boolean;
};

export default function TransactionList({ transactions, onDelete, isLoaded }: Props) {
  const [dialogDeleteOpen, setDialogDeleteOpen] = useState<boolean>(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  const handleDialogDeleteOpen = (id: string) => {
    setTransactionToDelete(id);
    setDialogDeleteOpen(true);
  }

  const handleDialogDeleteClose = () => {
    setDialogDeleteOpen(false);
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

  if (!isLoaded) {
    return <p>Loading...</p>
  }
  
  if (transactions.length === 0) {
    return <p>No transactions yet.</p>;
  }

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
            <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Method</th>
            <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Notes</th>
            <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Installment</th>
            <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Subscription</th>
            <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>{dayjs(t.date, "MM:DD").format("D MMMM, YYYY")}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
                {t.amount.toLocaleString()}
              </td>
              <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>{t.category}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>{t.method}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>{t.notes}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
                {t.installmentTotal && t.installmentCurrent && (
                  <div>
                    Installment {t.installmentCurrent} of {t.installmentTotal}
                  </div>
                )}
              </td>
              <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
                {t.isSubscription && (
                  <div>
                    Subscription {t.subscriptionInterval ?  ` (${t.subscriptionInterval})` : ""}
                  </div>
                )}
              </td>
              <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <IconButton aria-label="delete" size="small" color="error" onClick={(e) => handleDialogDeleteOpen(t.id)}>
                    <DeleteIcon fontSize="inherit" />
                  </IconButton>
                  <IconButton aria-label="edit" size="small" color="info">
                    <EditIcon fontSize="inherit" />
                  </IconButton>
                </Stack>
              </td>
            </tr>
          ))} 
        </tbody>
      </table>

      <Dialog
        open={dialogDeleteOpen}
        onClose={handleDialogDeleteClose}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          {"Confirm Deletion"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure want to delete this record?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogDeleteClose}>Cancel</Button>
          <Button onClick={handleDelete} autoFocus color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
