import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatCurrencyFull, formatDate } from "@/lib/format";
import { downloadReceipt } from "@/lib/receipt";
import { useProfile } from "@/lib/useProfile";
import type { PaymentMode, Payment, InstallmentPlan } from "@/lib/db-types";
import { toast } from "sonner";
import { Plus, Download, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: PaymentsFinance,
});

type PaymentRow = Payment & {
  customers: { name: string } | null;
  properties: { code: string } | null;
  installments: {
    plan_id: string;
    installment_plans: { penalty_rate_percent: number; penalty_grace_days: number } | null;
  } | null;
};

function usePayments() {
  return useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          "*, customers(name), properties(code), installments(plan_id, installment_plans(penalty_rate_percent, penalty_grace_days))",
        )
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data as PaymentRow[];
    },
  });
}

function useCustomerProperties() {
  return useQuery({
    queryKey: ["customers-with-properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });
}

function daysOverdue(dueDate: string | null) {
  if (!dueDate) return 0;
  const diff = Date.now() - new Date(dueDate).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function LogPaymentDialog() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { data: customers } = useCustomerProperties();
  const [customerId, setCustomerId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [installmentId, setInstallmentId] = useState("none");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentMode>("bank_transfer");
  const [saving, setSaving] = useState(false);

  const { data: properties } = useQuery({
    queryKey: ["customer-properties", customerId],
    enabled: !!customerId,
    queryFn: async () =>
      (await supabase.from("properties").select("id, code").eq("customer_id", customerId)).data ??
      [],
  });

  const { data: installments } = useQuery({
    queryKey: ["property-installments", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("installment_plans")
        .select("id")
        .eq("property_id", propertyId)
        .maybeSingle();
      if (!data) return [];
      const res = await supabase
        .from("installments")
        .select("*")
        .eq("plan_id", data.id)
        .in("status", ["pending", "overdue"])
        .order("seq_no");
      return res.data ?? [];
    },
  });

  const save = async () => {
    if (!customerId || !propertyId || !amount) return toast.error("Fill in all required fields");
    setSaving(true);
    const receipt_reference = `RCPT-${Date.now().toString().slice(-8)}`;
    const { error: payError } = await supabase.from("payments").insert({
      customer_id: customerId,
      property_id: propertyId,
      installment_id: installmentId === "none" ? null : installmentId,
      amount: Number(amount),
      due_date: new Date().toISOString().slice(0, 10),
      paid_date: new Date().toISOString().slice(0, 10),
      status: "paid",
      payment_mode: mode,
      receipt_reference,
      created_by: profile?.id,
    });
    if (payError) {
      setSaving(false);
      return toast.error(payError.message);
    }
    if (installmentId !== "none")
      await supabase.from("installments").update({ status: "paid" }).eq("id", installmentId);
    setSaving(false);
    toast.success("Payment logged");
    qc.invalidateQueries({ queryKey: ["admin-payments"] });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground">
          <Plus className="mr-1.5 h-4 w-4" />
          Log payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block text-xs">Customer</Label>
            <Select
              onValueChange={(v) => {
                setCustomerId(v);
                setPropertyId("");
                setInstallmentId("none");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Property</Label>
            <Select
              value={propertyId}
              onValueChange={(v) => {
                setPropertyId(v);
                setInstallmentId("none");
              }}
              disabled={!customerId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                {properties?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!!installments?.length && (
            <div>
              <Label className="mb-1.5 block text-xs">Settle installment (optional)</Label>
              <Select
                value={installmentId}
                onValueChange={(v) => {
                  setInstallmentId(v);
                  const inst = installments?.find((i) => i.id === v);
                  if (inst) setAmount(String(inst.amount));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Custom amount</SelectItem>
                  {installments?.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      #{i.seq_no} · {formatCurrencyFull(i.amount)} · due {formatDate(i.due_date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">Amount (₹)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Payment mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["cash", "cheque", "bank_transfer", "upi", "card", "other"].map((m) => (
                    <SelectItem key={m} value={m} className="capitalize">
                      {m.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground">
            {saving ? "Saving…" : "Log payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentsTab() {
  const { data: payments, isLoading } = usePayments();
  const [statusFilter, setStatusFilter] = useState("all");
  const filtered = (payments ?? []).filter(
    (p) => statusFilter === "all" || p.status === statusFilter,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[160px]">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <LogPaymentDialog />
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead className="text-right">Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.customers?.name}</TableCell>
                <TableCell>{p.properties?.code}</TableCell>
                <TableCell>{formatDate(p.due_date)}</TableCell>
                <TableCell>{formatCurrencyFull(p.amount)}</TableCell>
                <TableCell>
                  <StatusBadge status={p.status} />
                </TableCell>
                <TableCell className="capitalize text-muted-foreground">
                  {p.payment_mode?.replace("_", " ") ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  {p.status === "paid" && (
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
                          customer_name: p.customers?.name,
                        })
                      }
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      PDF
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function OverdueTab() {
  const { data: payments, isLoading } = usePayments();
  const overdue = useMemo(() => {
    return (payments ?? [])
      .filter((p) => p.status === "overdue")
      .map((p) => {
        const plan = p.installments?.installment_plans;
        const rate = plan?.penalty_rate_percent ?? 2;
        const grace = plan?.penalty_grace_days ?? 7;
        const overdueDays = Math.max(0, daysOverdue(p.due_date) - grace);
        const penalty = overdueDays > 0 ? Math.round(Number(p.amount) * (rate / 100)) : 0;
        return { ...p, overdueDays, penalty, rate };
      });
  }, [payments]);

  return (
    <div className="space-y-4">
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && !overdue.length && (
        <p className="text-sm text-muted-foreground">No overdue accounts. 🎉</p>
      )}
      <div className="grid gap-3">
        {overdue.map((p) => (
          <Card key={p.id} className="border-destructive/25">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">
                    {p.customers?.name} · {p.properties?.code}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Due {formatDate(p.due_date)} ·{" "}
                    {p.overdueDays > 0
                      ? `${p.overdueDays} days past grace period`
                      : "Within grace period"}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">
                  Outstanding:{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrencyFull(p.amount)}
                  </span>
                </div>
                {p.penalty > 0 && (
                  <div className="text-sm font-semibold text-destructive">
                    + {formatCurrencyFull(p.penalty)} penalty ({p.rate}%)
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

type InstallmentPlanRow = InstallmentPlan & {
  customers: { name: string } | null;
  properties: { code: string } | null;
  installments: { status: string }[];
};

function InstallmentPlansTab() {
  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-installment-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installment_plans")
        .select("*, customers(name), properties(code), installments(status)")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as InstallmentPlanRow[];
    },
  });

  return (
    <div className="space-y-4">
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {plans?.map((plan) => {
          const paid = plan.installments.filter((i) => i.status === "paid").length;
          return (
            <Card key={plan.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{plan.customers?.name}</div>
                  <span className="text-xs text-muted-foreground">{plan.properties?.code}</span>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {formatCurrency(plan.total_amount)} across {plan.num_installments}{" "}
                  {plan.frequency} installments
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${(paid / plan.num_installments) * 100}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {paid} of {plan.num_installments} paid · Penalty {plan.penalty_rate_percent}%
                  after {plan.penalty_grace_days} days
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function PaymentsFinance() {
  return (
    <div>
      <PageHeader
        title="Payments & Finance"
        desc="Log payments, monitor installment plans and flag overdue accounts."
      />
      <div className="p-4 md:p-8">
        <Tabs defaultValue="payments">
          <TabsList>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="plans">Installment plans</TabsTrigger>
            <TabsTrigger value="overdue">Overdue accounts</TabsTrigger>
          </TabsList>
          <TabsContent value="payments" className="mt-4">
            <PaymentsTab />
          </TabsContent>
          <TabsContent value="plans" className="mt-4">
            <InstallmentPlansTab />
          </TabsContent>
          <TabsContent value="overdue" className="mt-4">
            <OverdueTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
