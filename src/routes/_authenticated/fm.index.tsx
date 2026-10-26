import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building, Ticket, AlertTriangle, Users, MapPin, Home } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/useProfile";
import { useComplex, useMyResident } from "@/lib/useFM";
import { computeAssetHealth } from "@/lib/assetHealth";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Resident } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/fm/")({
  component: FMOverview,
});

function useStaffOverview(complexId: string | undefined) {
  return useQuery({
    queryKey: ["fm-overview", complexId],
    enabled: !!complexId,
    queryFn: async () => {
      const [{ data: residents }, { data: tickets }, { data: bills }, { data: assets }] =
        await Promise.all([
          supabase.from("residents").select("*").eq("complex_id", complexId!).order("unit_number"),
          supabase
            .from("maintenance_tickets")
            .select("id")
            .eq("complex_id", complexId!)
            .in("status", ["open", "in_progress"]),
          supabase
            .from("maintenance_bills")
            .select("amount")
            .eq("complex_id", complexId!)
            .eq("status", "overdue"),
          supabase.from("assets").select("*").eq("complex_id", complexId!),
        ]);
      const atRisk = (assets ?? []).filter((a) => computeAssetHealth(a).band !== "good");
      return {
        residents: (residents ?? []) as Resident[],
        openTickets: tickets?.length ?? 0,
        overdueCount: bills?.length ?? 0,
        overdueAmount: (bills ?? []).reduce((s, b) => s + Number(b.amount), 0),
        atRiskAssets: atRisk.length,
        totalAssets: assets?.length ?? 0,
      };
    },
  });
}

function StaffOverview() {
  const { data: complex } = useComplex();
  const { data } = useStaffOverview(complex?.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">{complex?.name ?? "—"}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> {complex?.address}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{data?.residents.length ?? "—"}</div>
              <div className="text-xs text-muted-foreground">Residents on file</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-warning/15 text-warning">
              <Ticket className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{data?.openTickets ?? "—"}</div>
              <div className="text-xs text-muted-foreground">Open / in-progress tickets</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-destructive/12 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {data ? formatCurrency(data.overdueAmount) : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                Overdue across {data?.overdueCount ?? 0} bill(s)
              </div>
            </div>
          </CardContent>
        </Card>
        <Link to="/fm/assets">
          <Card className="h-full transition hover:shadow-card">
            <CardContent className="flex items-center gap-3 p-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-chart-3/15 text-chart-3">
                <Building className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {data?.atRiskAssets ?? 0}/{data?.totalAssets ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">Assets needing attention</div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Residents directory</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-4">Unit</th>
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Relation</th>
                <th className="pb-2 pr-4">Contact</th>
                <th className="pb-2">Move-in</th>
              </tr>
            </thead>
            <tbody>
              {data?.residents.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 pr-4 font-medium">{r.unit_number}</td>
                  <td className="py-2.5 pr-4">{r.name}</td>
                  <td className="py-2.5 pr-4 capitalize text-muted-foreground">{r.relation}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{r.phone ?? r.email ?? "—"}</td>
                  <td className="py-2.5 text-muted-foreground">{formatDate(r.move_in_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function ResidentOverview() {
  const { data: resident, isLoading } = useMyResident();
  const { data: complex } = useComplex();

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!resident) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
          <Home className="h-8 w-8" />
          You're not linked to a society record yet. Once your unit's possession is complete, we'll
          add you here automatically.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">
          Welcome, {resident.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Unit {resident.unit_number} · {complex?.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your unit</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">Unit number</div>
            <div className="mt-0.5 font-medium">{resident.unit_number}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Relation</div>
            <div className="mt-0.5 font-medium capitalize">{resident.relation}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Move-in date</div>
            <div className="mt-0.5 font-medium">{formatDate(resident.move_in_date)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About {complex?.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {complex?.address}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {complex?.amenities?.map((a) => (
              <span
                key={a}
                className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
              >
                {a}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link to="/fm/tickets">
          <Button variant="outline">Raise a ticket</Button>
        </Link>
        <Link to="/fm/billing">
          <Button variant="outline">View my bills</Button>
        </Link>
      </div>
    </div>
  );
}

function FMOverview() {
  const { data: profile } = useProfile();
  if (profile?.role === "customer") return <ResidentOverview />;
  return <StaffOverview />;
}
