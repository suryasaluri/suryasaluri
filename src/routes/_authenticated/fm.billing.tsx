import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wallet2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useMyCustomer } from "@/lib/useProfile";
import { useComplex } from "@/lib/useFM";
import { formatCurrency, formatDate } from "@/lib/format";
import { BILL_TYPE_LABELS, type MaintenanceBill } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/fm/billing")({
  component: Billing,
});

function useBills(
  complexId: string | undefined,
  staffView: boolean,
  customerId: string | undefined,
) {
  return useQuery({
    queryKey: ["fm-bills", complexId, staffView, customerId],
    enabled: !!complexId && (staffView || !!customerId),
    queryFn: async (): Promise<
      (MaintenanceBill & { residents: { unit_number: string; name: string } | null })[]
    > => {
      let query = supabase
        .from("maintenance_bills")
        .select("*, residents(unit_number, name)")
        .eq("complex_id", complexId!)
        .order("period", { ascending: false });
      if (!staffView) query = query.eq("customer_id", customerId!);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

function PayButton({ bill }: { bill: MaintenanceBill }) {
  const qc = useQueryClient();
  const pay = async () => {
    const { error } = await supabase
      .from("maintenance_bills")
      .update({ status: "paid", paid_date: new Date().toISOString().slice(0, 10) })
      .eq("id", bill.id);
    if (error) return toast.error(error.message);
    toast.success("Payment recorded — thank you!");
    qc.invalidateQueries({ queryKey: ["fm-bills"] });
  };
  if (bill.status === "paid") return null;
  return (
    <Button size="sm" onClick={pay}>
      Pay now
    </Button>
  );
}

function Billing() {
  const { data: profile } = useProfile();
  const { data: complex } = useComplex();
  const { data: customer } = useMyCustomer();
  const staffView = profile ? profile.role !== "customer" : false;
  const { data: bills, isLoading } = useBills(complex?.id, staffView, customer?.id);

  const overdue = (bills ?? []).filter((b) => b.status === "overdue");
  const overdueTotal = overdue.reduce((s, b) => s + Number(b.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">
          {staffView ? "Billing & Collections" : "My Bills"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {staffView
            ? "Maintenance, sinking fund and special assessment bills across the complex."
            : "Your monthly maintenance and fund contributions."}
        </p>
      </div>

      {staffView && !!overdue.length && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm">
            <span className="font-semibold text-destructive">
              {formatCurrency(overdueTotal)} overdue
            </span>{" "}
            across {overdue.length} bill(s).
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && !bills?.length && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <Wallet2 className="h-8 w-8" />
            No bills yet.
          </CardContent>
        </Card>
      )}

      {!!bills?.length && (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {bills.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {BILL_TYPE_LABELS[b.bill_type]}
                    {staffView && b.residents && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        · Unit {b.residents.unit_number} ({b.residents.name})
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Period {formatDate(b.period)} · Due {formatDate(b.due_date)}
                    {b.paid_date ? ` · Paid ${formatDate(b.paid_date)}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{formatCurrency(b.amount)}</span>
                  <StatusBadge status={b.status} />
                  {!staffView && <PayButton bill={b} />}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
