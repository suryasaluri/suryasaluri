import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyCustomer } from "@/lib/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { StageStepper } from "@/components/StageStepper";
import { formatCurrency } from "@/lib/format";
import type { Property } from "@/lib/db-types";
import { Route as RouteIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/status")({
  component: StatusTracker,
});

function useOwnedProperties(customerId: string | undefined) {
  return useQuery({
    queryKey: ["status-tracker", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*, projects(name, location)")
        .eq("customer_id", customerId!);
      if (error) throw error;
      const properties = data as (Property & {
        projects: { name: string; location: string } | null;
      })[];

      const { data: approvals, error: aErr } = await supabase
        .from("approvals")
        .select("*")
        .eq("customer_id", customerId!);
      if (aErr) throw aErr;

      return properties.map((p) => ({
        property: p,
        approvals: approvals.filter((a) => a.property_id === p.id),
      }));
    },
  });
}

function StatusTracker() {
  const { data: customer } = useMyCustomer();
  const { data, isLoading } = useOwnedProperties(customer?.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Status Tracker</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow each property from booking through possession.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && !data?.length && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <RouteIcon className="h-8 w-8" />
            You don't have any booked properties to track yet.
            <Link to="/portal/browse" className="text-primary hover:underline">
              Browse properties
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {data?.map(({ property, approvals }) => (
          <Card key={property.id}>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">
                  {property.code}{" "}
                  <span className="ml-1 font-normal text-muted-foreground">
                    · {property.projects?.name}
                  </span>
                </CardTitle>
                <div className="mt-1 text-sm font-semibold text-primary">
                  {formatCurrency(property.price)}
                </div>
              </div>
              <StatusBadge status={property.status} />
            </CardHeader>
            <CardContent className="overflow-x-auto pt-2">
              <StageStepper approvals={approvals} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
