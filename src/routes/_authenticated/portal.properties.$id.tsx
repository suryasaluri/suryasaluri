import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyCustomer } from "@/lib/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatCurrencyFull } from "@/lib/format";
import { estimateCost } from "@/lib/costEstimator";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  Ruler,
  Compass,
  Car,
  BedDouble,
  Building2,
  ShieldCheck,
  Sparkles,
  Layers,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/properties/$id")({
  component: PropertyDetail,
});

function useProperty(id: string) {
  return useQuery({
    queryKey: ["property", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*, projects(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

function PropertyDetail() {
  const { id } = Route.useParams();
  const { data: property, isLoading } = useProperty(id);
  const { data: customer } = useMyCustomer();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState<"interest" | "book" | null>(null);

  const submit = async (kind: "interest" | "book") => {
    if (!customer || !property) return;
    setSubmitting(kind);
    try {
      const note =
        kind === "interest"
          ? `Expressed interest in ${property.code} (${property.projects?.name}) via customer portal.`
          : `Requested booking for ${property.code} (${property.projects?.name}) via customer portal — awaiting sales confirmation.`;

      const nextStatus =
        kind === "book"
          ? "booked"
          : customer.lead_status === "new"
            ? "contacted"
            : customer.lead_status;

      const [{ error: noteError }, { error: custError }] = await Promise.all([
        supabase.from("lead_notes").insert({ customer_id: customer.id, author_id: null, note }),
        supabase.from("customers").update({ lead_status: nextStatus }).eq("id", customer.id),
      ]);
      if (noteError) throw noteError;
      if (custError) throw custError;

      toast.success(
        kind === "interest"
          ? "Interest recorded — our team will reach out shortly."
          : "Booking request sent! Our sales team will confirm shortly.",
      );
      qc.invalidateQueries({ queryKey: ["my-customer"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(null);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!property) return <p className="text-sm text-muted-foreground">Property not found.</p>;

  const { lines, total } = estimateCost(property);
  const gallery = [
    property.cover_image_url,
    property.projects?.cover_image_url,
    property.cover_image_url,
  ].filter(Boolean) as string[];
  const isOwn = property.customer_id === customer?.id;

  return (
    <div className="space-y-6">
      <Link
        to="/portal/browse"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to browse
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid grid-cols-3 gap-2 overflow-hidden rounded-2xl">
            <div
              className="col-span-2 h-72 bg-cover bg-center"
              style={{ backgroundImage: `url(${gallery[0]})` }}
            />
            <div className="flex flex-col gap-2">
              {gallery.slice(1, 3).map((g, i) => (
                <div
                  key={i}
                  className="h-[8.5rem] flex-1 bg-cover bg-center"
                  style={{ backgroundImage: `url(${g})` }}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl font-bold">{property.code}</h1>
                  <StatusBadge status={property.status} />
                  {isOwn && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Your property
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {property.projects?.name} · {property.projects?.location}
                </div>
              </div>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(property.price)}
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{property.projects?.description}</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Specifications</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {property.property_type === "plot" ? (
                <>
                  <Spec icon={Ruler} label="Size" value={`${property.size_sqyd} sq.yd`} />
                  <Spec icon={Compass} label="Facing" value={property.facing ?? "—"} capitalize />
                  <Spec
                    icon={ShieldCheck}
                    label="Corner plot"
                    value={property.is_corner ? "Yes" : "No"}
                  />
                  <Spec icon={Layers} label="Road width" value={`${property.road_width_ft} ft`} />
                </>
              ) : (
                <>
                  <Spec icon={Building2} label="Tower" value={property.tower ?? "—"} />
                  <Spec icon={Layers} label="Floor" value={String(property.floor_number ?? "—")} />
                  <Spec icon={BedDouble} label="Configuration" value={property.bhk ?? "—"} />
                  <Spec
                    icon={Ruler}
                    label="Carpet area"
                    value={`${property.carpet_area_sqft} sq.ft`}
                  />
                  <Spec
                    icon={Ruler}
                    label="Built-up area"
                    value={`${property.builtup_area_sqft} sq.ft`}
                  />
                  <Spec icon={Car} label="Parking" value={`${property.parking_slots} slot(s)`} />
                </>
              )}
            </CardContent>
          </Card>

          {property.property_type === "flat" && !!property.amenities?.length && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Amenities</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {property.amenities.map((a) => (
                  <span
                    key={a}
                    className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground"
                  >
                    <Sparkles className="h-3 w-3 text-primary" />
                    {a}
                  </span>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Location</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-xl border border-border">
                <iframe
                  title="map"
                  className="h-64 w-full"
                  loading="lazy"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=77.55%2C12.90%2C77.75%2C13.10&layer=mapnik"
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Approximate location — {property.projects?.location}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-primary/20 shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Cost Estimator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lines.map((l) => (
                <div key={l.label} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <div>{l.label}</div>
                    {l.note && <div className="text-xs text-muted-foreground">{l.note}</div>}
                  </div>
                  <div className="shrink-0 font-medium">{formatCurrencyFull(l.amount)}</div>
                </div>
              ))}
              <Separator />
              <div className="flex items-center justify-between font-semibold">
                <span>Estimated total</span>
                <span className="text-primary">{formatCurrencyFull(total)}</span>
              </div>
            </CardContent>
          </Card>

          {property.status === "available" && !isOwn && (
            <Card>
              <CardContent className="space-y-3 p-4">
                <Button
                  className="w-full bg-primary text-primary-foreground"
                  disabled={!!submitting}
                  onClick={() => submit("book")}
                >
                  {submitting === "book" ? "Sending…" : "Book Now"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!!submitting}
                  onClick={() => submit("interest")}
                >
                  {submitting === "interest" ? "Sending…" : "Express Interest"}
                </Button>
              </CardContent>
            </Card>
          )}

          {isOwn && (
            <Card className="border-success/30 bg-success/5">
              <CardContent className="flex items-center gap-3 p-4 text-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                <span>
                  This property is linked to your account. Track its progress on the{" "}
                  <Link to="/portal/status" className="font-medium text-primary hover:underline">
                    Status Tracker
                  </Link>
                  .
                </span>
              </CardContent>
            </Card>
          )}

          {property.status !== "available" && !isOwn && (
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="p-4 text-sm text-muted-foreground">
                This property is currently {property.status} and not available for booking.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Spec({
  icon: Icon,
  label,
  value,
  capitalize,
}: {
  icon: typeof Ruler;
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-sm font-medium ${capitalize ? "capitalize" : ""}`}>{value}</div>
      </div>
    </div>
  );
}
