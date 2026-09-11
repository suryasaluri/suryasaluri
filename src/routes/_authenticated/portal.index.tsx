import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyCustomer } from "@/lib/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Property, SiteVisit } from "@/lib/db-types";
import {
  Building2,
  Wallet,
  FileText,
  CalendarClock,
  ArrowRight,
  Home as HomeIcon,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/")({
  component: PortalHome,
});

function usePortalSummary(customerId: string | undefined) {
  return useQuery({
    queryKey: ["portal-summary", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const [properties, payments, documents, siteVisits] = await Promise.all([
        supabase
          .from("properties")
          .select("*, projects(name, location)")
          .eq("customer_id", customerId!),
        supabase
          .from("payments")
          .select("*")
          .eq("customer_id", customerId!)
          .in("status", ["pending", "overdue"])
          .order("due_date"),
        supabase
          .from("documents")
          .select("*")
          .eq("customer_id", customerId!)
          .eq("verification_status", "pending"),
        supabase
          .from("site_visits")
          .select("*, projects(name)")
          .eq("customer_id", customerId!)
          .eq("status", "scheduled")
          .order("scheduled_date")
          .limit(1),
      ]);
      if (properties.error) throw properties.error;
      if (payments.error) throw payments.error;
      if (documents.error) throw documents.error;
      if (siteVisits.error) throw siteVisits.error;
      return {
        properties: properties.data as (Property & {
          projects: { name: string; location: string } | null;
        })[],
        duePayments: payments.data,
        pendingDocs: documents.data,
        nextVisit: (siteVisits.data[0] ?? null) as
          (SiteVisit & { projects: { name: string } | null }) | null,
      };
    },
  });
}

function PortalHome() {
  const { data: customer } = useMyCustomer();
  const { data, isLoading } = usePortalSummary(customer?.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">
          Welcome back{customer?.name ? `, ${customer.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's the latest on your properties with SAN Connect.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/portal/status">
          <Card className="h-full transition hover:shadow-card">
            <CardContent className="flex items-center gap-3 p-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{data?.properties.length ?? "—"}</div>
                <div className="text-xs text-muted-foreground">Owned / booked properties</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/portal/payments">
          <Card className="h-full transition hover:shadow-card">
            <CardContent className="flex items-center gap-3 p-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-warning/15 text-warning">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{data?.duePayments.length ?? "—"}</div>
                <div className="text-xs text-muted-foreground">Payments due / overdue</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/portal/documents">
          <Card className="h-full transition hover:shadow-card">
            <CardContent className="flex items-center gap-3 p-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{data?.pendingDocs.length ?? "—"}</div>
                <div className="text-xs text-muted-foreground">Documents pending</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Card className="h-full">
          <CardContent className="flex items-center gap-3 p-5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-success/15 text-success">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {data?.nextVisit ? formatDate(data.nextVisit.scheduled_date) : "No visit scheduled"}
              </div>
              <div className="text-xs text-muted-foreground">
                {data?.nextVisit ? data.nextVisit.projects?.name : "Upcoming site visit"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Your properties</CardTitle>
          <Link to="/portal/browse">
            <Button variant="outline" size="sm">
              Browse more <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && !data?.properties.length && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center">
              <HomeIcon className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                You don't have any booked properties yet.
              </p>
              <Link to="/portal/browse">
                <Button size="sm">Browse properties</Button>
              </Link>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {data?.properties.map((p) => (
              <Link
                key={p.id}
                to="/portal/properties/$id"
                params={{ id: p.id }}
                className="group flex gap-3 rounded-xl border border-border p-3 transition hover:shadow-card"
              >
                <div
                  className="h-20 w-24 shrink-0 rounded-lg bg-cover bg-center"
                  style={{ backgroundImage: `url(${p.cover_image_url})` }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{p.code}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {p.projects?.name} · {p.projects?.location}
                  </div>
                  <div className="mt-1.5 text-sm font-semibold text-primary">
                    {formatCurrency(p.price)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
