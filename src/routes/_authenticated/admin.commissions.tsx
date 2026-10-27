import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wallet, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/useProfile";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Commission } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/admin/commissions")({
  component: Commissions,
});

type Row = Commission & {
  customers: { name: string } | null;
  properties: { code: string } | null;
  profiles: { full_name: string | null } | null;
};

function useCommissions(isAdmin: boolean, userId: string | undefined) {
  return useQuery({
    queryKey: ["commissions", isAdmin, userId],
    enabled: !!userId,
    queryFn: async (): Promise<Row[]> => {
      let query = supabase
        .from("commissions")
        .select("*, customers(name), properties(code), profiles(full_name)")
        .order("created_at", { ascending: false });
      if (!isAdmin) query = query.eq("sales_staff_id", userId!);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

function MarkPaidButton({ commission }: { commission: Commission }) {
  const qc = useQueryClient();
  if (commission.status === "paid") return null;
  const markPaid = async () => {
    const { error } = await supabase
      .from("commissions")
      .update({ status: "paid" })
      .eq("id", commission.id);
    if (error) return toast.error(error.message);
    toast.success("Marked as paid");
    qc.invalidateQueries({ queryKey: ["commissions"] });
  };
  return (
    <Button size="sm" variant="outline" onClick={markPaid}>
      Mark paid
    </Button>
  );
}

function Commissions() {
  const { data: profile } = useProfile();
  const isAdmin = profile?.role === "admin";
  const { data: rows, isLoading } = useCommissions(isAdmin, profile?.id);

  const pending = (rows ?? []).filter((r) => r.status === "pending");
  const paid = (rows ?? []).filter((r) => r.status === "paid");
  const pendingTotal = pending.reduce((s, r) => s + Number(r.amount), 0);
  const paidTotal = paid.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div>
      <PageHeader
        title="Commissions"
        desc={
          isAdmin
            ? "Every commission earned across the sales team."
            : "Your commission earnings across confirmed sales."
        }
      />
      <div className="space-y-6 p-4 md:p-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{formatCurrency(paidTotal)}</div>
                <div className="text-xs text-muted-foreground">Paid out</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-warning/15 text-warning">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{formatCurrency(pendingTotal)}</div>
                <div className="text-xs text-muted-foreground">
                  Pending across {pending.length} deal(s)
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{(rows ?? []).length}</div>
                <div className="text-xs text-muted-foreground">Total commission records</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All commissions</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!isLoading && !rows?.length && (
              <p className="text-sm text-muted-foreground">No commissions recorded yet.</p>
            )}
            {!!rows?.length && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    {isAdmin && <th className="pb-2 pr-4">Sales rep</th>}
                    <th className="pb-2 pr-4">Customer</th>
                    <th className="pb-2 pr-4">Property</th>
                    <th className="pb-2 pr-4">Rate</th>
                    <th className="pb-2 pr-4">Amount</th>
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Status</th>
                    {isAdmin && <th className="pb-2" />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      {isAdmin && (
                        <td className="py-2.5 pr-4 font-medium">{r.profiles?.full_name ?? "—"}</td>
                      )}
                      <td className="py-2.5 pr-4">{r.customers?.name ?? "—"}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs">{r.properties?.code ?? "—"}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{r.rate_percent}%</td>
                      <td className="py-2.5 pr-4 font-semibold">{formatCurrency(r.amount)}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="py-2.5 pr-4">
                        <StatusBadge status={r.status} />
                      </td>
                      {isAdmin && (
                        <td className="py-2.5">
                          <MarkPaidButton commission={r} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
