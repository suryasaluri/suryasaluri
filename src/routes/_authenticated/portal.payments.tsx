import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyCustomer } from "@/lib/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatCurrencyFull, formatDate } from "@/lib/format";
import { downloadReceipt } from "@/lib/receipt";
import { toast } from "sonner";
import { Wallet, Download, CreditCard } from "lucide-react";
import type { Payment } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/portal/payments")({
  component: MyPayments,
});

type PaymentRow = Payment & { properties: { code: string } | null };

function usePayments(customerId: string | undefined) {
  return useQuery({
    queryKey: ["my-payments", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, properties(code)")
        .eq("customer_id", customerId!)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as PaymentRow[];
    },
  });
}

function PayNowDialog({
  amount,
  code,
  onClose,
}: {
  amount: number;
  code: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay installment — {code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <div className="text-xs text-muted-foreground">Amount due</div>
            <div className="mt-1 text-2xl font-bold text-primary">{formatCurrencyFull(amount)}</div>
          </div>
          <p className="text-xs text-muted-foreground">
            This is a demo placeholder — no real payment gateway is connected. In production this
            would redirect to a secure checkout.
          </p>
        </div>
        <DialogFooter>
          <Button
            className="w-full bg-primary text-primary-foreground"
            onClick={() => {
              toast.success(
                "Payment simulated — our finance team will confirm and update your receipt shortly.",
              );
              onClose();
            }}
          >
            <CreditCard className="mr-1.5 h-4 w-4" />
            Simulate payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MyPayments() {
  const { data: customer } = useMyCustomer();
  const { data: payments, isLoading } = usePayments(customer?.id);
  const [payTarget, setPayTarget] = useState<{ amount: number; code: string } | null>(null);

  const totals = payments?.reduce(
    (acc, p) => {
      acc.total += Number(p.amount);
      if (p.status === "paid") acc.paid += Number(p.amount);
      else acc.due += Number(p.amount);
      return acc;
    },
    { total: 0, paid: 0, due: 0 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">My Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your installment schedule and payment history.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Total value</div>
            <div className="mt-1 text-xl font-bold">{formatCurrency(totals?.total ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Paid so far</div>
            <div className="mt-1 text-xl font-bold text-success">
              {formatCurrency(totals?.paid ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Outstanding</div>
            <div className="mt-1 text-xl font-bold text-warning">
              {formatCurrency(totals?.due ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Installment schedule</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && !payments?.length && (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <Wallet className="h-8 w-8" />
              No payments yet.
            </div>
          )}
          {!!payments?.length && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.properties?.code}</TableCell>
                      <TableCell>{formatDate(p.due_date)}</TableCell>
                      <TableCell>{formatCurrencyFull(p.amount)}</TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">
                        {p.payment_mode?.replace("_", " ") ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.status === "paid" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              downloadReceipt({
                                receipt_reference: p.receipt_reference,
                                amount: p.amount,
                                paid_date: p.paid_date,
                                payment_mode: p.payment_mode,
                                property_code: p.properties?.code,
                                customer_name: customer?.name,
                              })
                            }
                          >
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            Receipt
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-primary text-primary-foreground"
                            onClick={() =>
                              setPayTarget({
                                amount: Number(p.amount),
                                code: p.properties?.code ?? "",
                              })
                            }
                          >
                            Pay Now
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {payTarget && (
        <PayNowDialog
          amount={payTarget.amount}
          code={payTarget.code}
          onClose={() => setPayTarget(null)}
        />
      )}
    </div>
  );
}
