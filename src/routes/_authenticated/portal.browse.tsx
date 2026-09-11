import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/format";
import type { Project, Property, PropertyType } from "@/lib/db-types";
import { MapPin, LayoutGrid, Rows3, Ruler, Compass, Car, BedDouble } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/portal/browse")({
  component: BrowseProperties,
});

function useProjects() {
  return useQuery({
    queryKey: ["projects-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("name");
      if (error) throw error;
      return data as Project[];
    },
  });
}

function useProperties(type: PropertyType) {
  return useQuery({
    queryKey: ["browse-properties", type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*, projects(name, location)")
        .eq("property_type", type)
        .order("code");
      if (error) throw error;
      return data as (Property & { projects: Pick<Project, "name" | "location"> })[];
    },
  });
}

function PropertyCard({ p }: { p: Property & { projects?: Pick<Project, "name" | "location"> } }) {
  return (
    <Link to="/portal/properties/$id" params={{ id: p.id }}>
      <Card className="h-full overflow-hidden transition hover:-translate-y-0.5 hover:shadow-card">
        <div
          className="relative h-40 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${p.cover_image_url})` }}
        >
          <div className="absolute right-2 top-2">
            <StatusBadge status={p.status} />
          </div>
        </div>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{p.code}</span>
            <span className="font-semibold text-primary">{formatCurrency(p.price)}</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {p.projects?.name}
            {p.projects?.location ? ` · ${p.projects.location}` : ""}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {p.property_type === "plot" ? (
              <>
                <span className="flex items-center gap-1">
                  <Ruler className="h-3 w-3" />
                  {p.size_sqyd} sq.yd
                </span>
                <span className="flex items-center gap-1 capitalize">
                  <Compass className="h-3 w-3" />
                  {p.facing}
                  {p.is_corner ? " · Corner" : ""}
                </span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1">
                  <BedDouble className="h-3 w-3" />
                  {p.bhk}
                </span>
                <span>{p.carpet_area_sqft} sq.ft</span>
                <span className="flex items-center gap-1">
                  <Car className="h-3 w-3" />
                  {p.parking_slots}
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function TowerFloorGrid({
  properties,
}: {
  properties: (Property & { projects?: Pick<Project, "name" | "location"> })[];
}) {
  const towers = useMemo(() => {
    const map = new Map<string, typeof properties>();
    for (const p of properties) {
      const key = p.tower ?? "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).map(([tower, units]) => {
      const floors = new Map<number, typeof properties>();
      for (const u of units) {
        const f = u.floor_number ?? 0;
        if (!floors.has(f)) floors.set(f, []);
        floors.get(f)!.push(u);
      }
      const sortedFloors = Array.from(floors.entries()).sort((a, b) => b[0] - a[0]);
      return { tower, sortedFloors };
    });
  }, [properties]);

  return (
    <div className="space-y-8">
      {towers.map(({ tower, sortedFloors }) => (
        <div key={tower}>
          <h3 className="mb-3 font-display text-lg font-semibold">{tower}</h3>
          <div className="space-y-2 overflow-x-auto rounded-xl border border-border bg-card p-4">
            {sortedFloors.map(([floor, units]) => (
              <div key={floor} className="flex items-center gap-3">
                <div className="w-14 shrink-0 text-xs font-medium text-muted-foreground">
                  Floor {floor}
                </div>
                <div className="flex flex-1 flex-wrap gap-2">
                  {units.map((u) => (
                    <Link key={u.id} to="/portal/properties/$id" params={{ id: u.id }}>
                      <div
                        title={`${u.code} · ${u.bhk} · ${formatCurrency(u.price)}`}
                        className={cn(
                          "flex h-14 w-20 flex-col items-center justify-center rounded-lg border text-[10px] font-medium transition hover:scale-105",
                          u.status === "available" &&
                            "border-success/40 bg-success/10 text-success",
                          u.status === "blocked" && "border-warning/40 bg-warning/15 text-warning",
                          u.status === "sold" && "border-primary/30 bg-primary/10 text-primary",
                        )}
                      >
                        <span className="font-semibold">{u.code.split("-").pop()}</span>
                        <span>{u.bhk}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-success" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-warning" />
          Blocked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          Sold
        </span>
      </div>
    </div>
  );
}

function BrowseProperties() {
  const [type, setType] = useState<PropertyType>("plot");
  const [projectId, setProjectId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bhk, setBhk] = useState<string>("all");
  const [view, setView] = useState<"cards" | "grid">("cards");

  const { data: projects } = useProjects();
  const { data: properties, isLoading } = useProperties(type);

  const filtered = useMemo(() => {
    return (properties ?? []).filter((p) => {
      if (projectId !== "all" && p.project_id !== projectId) return false;
      if (status !== "all" && p.status !== status) return false;
      if (minPrice && Number(p.price) < Number(minPrice)) return false;
      if (maxPrice && Number(p.price) > Number(maxPrice)) return false;
      if (type === "flat" && bhk !== "all" && p.bhk !== bhk) return false;
      return true;
    });
  }, [properties, projectId, status, minPrice, maxPrice, bhk, type]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Browse Properties</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Explore live inventory across all SAN Connect projects.
        </p>
      </div>

      <Tabs
        value={type}
        onValueChange={(v) => {
          setType(v as PropertyType);
          setProjectId("all");
        }}
      >
        <TabsList>
          <TabsTrigger value="plot">Plots</TabsTrigger>
          <TabsTrigger value="flat">Flats</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Project</label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects
                ?.filter(
                  (p) =>
                    p.type_mix === "both" || p.type_mix === (type === "plot" ? "plots" : "flats"),
                )
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[140px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {type === "flat" && (
          <div className="min-w-[120px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">BHK</label>
            <Select value={bhk} onValueChange={setBhk}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                <SelectItem value="2BHK">2BHK</SelectItem>
                <SelectItem value="3BHK">3BHK</SelectItem>
                <SelectItem value="4BHK">4BHK</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="min-w-[120px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Min price</label>
          <Input
            type="number"
            placeholder="₹"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
        </div>
        <div className="min-w-[120px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Max price</label>
          <Input
            type="number"
            placeholder="₹"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </div>
        {type === "flat" && (
          <div className="ml-auto flex gap-1 rounded-lg border border-border p-1">
            <Button
              size="sm"
              variant={view === "cards" ? "default" : "ghost"}
              onClick={() => setView("cards")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={view === "grid" ? "default" : "ghost"}
              onClick={() => setView("grid")}
            >
              <Rows3 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} {type === "plot" ? "plots" : "flats"} found
      </p>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && type === "flat" && view === "grid" ? (
        <TowerFloorGrid properties={filtered} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <PropertyCard key={p.id} p={p} />
          ))}
          {!filtered.length && !isLoading && (
            <p className="text-sm text-muted-foreground">No properties match your filters.</p>
          )}
        </div>
      )}
    </div>
  );
}
