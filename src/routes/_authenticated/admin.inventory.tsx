import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/format";
import type {
  Project,
  Property,
  PropertyStatus,
  PropertyType,
  FacingDirection,
} from "@/lib/db-types";
import type { TablesInsert } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Plus, Pencil, Search, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/inventory")({
  component: Inventory,
});

function useProjects() {
  return useQuery({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("name");
      if (error) throw error;
      return data as Project[];
    },
  });
}

type PropertyRow = Property & {
  projects: { name: string } | null;
  customers: { name: string } | null;
};

function useProperties() {
  return useQuery({
    queryKey: ["admin-properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*, projects(name), customers(name)")
        .order("code");
      if (error) throw error;
      return data as PropertyRow[];
    },
  });
}

function useCustomersBrief() {
  return useQuery({
    queryKey: ["customers-brief"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });
}

/* ---------------------------------- Projects tab ---------------------------------- */

function ProjectDialog({ project, trigger }: { project?: Project; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: project?.name ?? "",
    location: project?.location ?? "",
    description: project?.description ?? "",
    cover_image_url: project?.cover_image_url ?? "",
    type_mix: (project?.type_mix ?? "both") as Project["type_mix"],
  });
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = project
      ? await supabase.from("projects").update(form).eq("id", project.id)
      : await supabase.from("projects").insert(form);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(project ? "Project updated" : "Project created");
    qc.invalidateQueries({ queryKey: ["admin-projects"] });
    qc.invalidateQueries({ queryKey: ["landing-projects"] });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block">Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label className="mb-1.5 block">Location</Label>
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Cover image URL</Label>
            <Input
              value={form.cover_image_url}
              onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Property type mix</Label>
            <Select
              value={form.type_mix}
              onValueChange={(v) => setForm({ ...form, type_mix: v as Project["type_mix"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plots">Plots only</SelectItem>
                <SelectItem value="flats">Flats only</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground">
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectsTab() {
  const { data: projects, isLoading } = useProjects();
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ProjectDialog
          trigger={
            <Button className="bg-primary text-primary-foreground">
              <Plus className="mr-1.5 h-4 w-4" />
              New project
            </Button>
          }
        />
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects?.map((p) => (
          <Card key={p.id} className="overflow-hidden">
            <div
              className="h-32 bg-cover bg-center"
              style={{ backgroundImage: `url(${p.cover_image_url})` }}
            />
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.location}</div>
                </div>
                <ProjectDialog
                  project={p}
                  trigger={
                    <Button size="icon" variant="ghost">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  }
                />
              </div>
              <span className="mt-2 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs capitalize text-secondary-foreground">
                {p.type_mix === "both" ? "Plots & Flats" : p.type_mix}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- Property form ---------------------------------- */

type PropertyForm = {
  project_id: string;
  property_type: PropertyType;
  code: string;
  price: string;
  status: PropertyStatus;
  cover_image_url: string;
  customer_id: string;
  size_sqyd: string;
  facing: FacingDirection | "";
  is_corner: boolean;
  road_width_ft: string;
  tower: string;
  floor_number: string;
  bhk: string;
  carpet_area_sqft: string;
  builtup_area_sqft: string;
  parking_slots: string;
  amenities: string;
};

function emptyForm(p?: Property): PropertyForm {
  return {
    project_id: p?.project_id ?? "",
    property_type: p?.property_type ?? "plot",
    code: p?.code ?? "",
    price: p ? String(p.price) : "",
    status: p?.status ?? "available",
    cover_image_url: p?.cover_image_url ?? "",
    customer_id: p?.customer_id ?? "none",
    size_sqyd: p?.size_sqyd ? String(p.size_sqyd) : "",
    facing: p?.facing ?? "",
    is_corner: p?.is_corner ?? false,
    road_width_ft: p?.road_width_ft ? String(p.road_width_ft) : "",
    tower: p?.tower ?? "",
    floor_number: p?.floor_number ? String(p.floor_number) : "",
    bhk: p?.bhk ?? "2BHK",
    carpet_area_sqft: p?.carpet_area_sqft ? String(p.carpet_area_sqft) : "",
    builtup_area_sqft: p?.builtup_area_sqft ? String(p.builtup_area_sqft) : "",
    parking_slots: p?.parking_slots ? String(p.parking_slots) : "1",
    amenities: p?.amenities?.join(", ") ?? "",
  };
}

function PropertyDialog({
  property,
  projects,
  customers,
  trigger,
}: {
  property?: Property;
  projects: Project[];
  customers: { id: string; name: string }[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PropertyForm>(emptyForm(property));
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const set = <K extends keyof PropertyForm>(k: K, v: PropertyForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.project_id || !form.code || !form.price)
      return toast.error("Project, code and price are required");
    setSaving(true);
    const payload: TablesInsert<"properties"> = {
      project_id: form.project_id,
      property_type: form.property_type,
      code: form.code,
      price: Number(form.price),
      status: form.status,
      cover_image_url: form.cover_image_url || null,
      customer_id: form.customer_id === "none" ? null : form.customer_id,
      size_sqyd: form.property_type === "plot" ? Number(form.size_sqyd) || null : null,
      facing: form.property_type === "plot" ? form.facing || null : null,
      is_corner: form.property_type === "plot" ? form.is_corner : null,
      road_width_ft: form.property_type === "plot" ? Number(form.road_width_ft) || null : null,
      tower: form.property_type === "flat" ? form.tower || null : null,
      floor_number: form.property_type === "flat" ? Number(form.floor_number) || null : null,
      bhk: form.property_type === "flat" ? form.bhk || null : null,
      carpet_area_sqft:
        form.property_type === "flat" ? Number(form.carpet_area_sqft) || null : null,
      builtup_area_sqft:
        form.property_type === "flat" ? Number(form.builtup_area_sqft) || null : null,
      parking_slots: form.property_type === "flat" ? Number(form.parking_slots) || 0 : null,
      amenities:
        form.property_type === "flat"
          ? form.amenities
              .split(",")
              .map((a) => a.trim())
              .filter(Boolean)
          : null,
    };
    const { error } = property
      ? await supabase.from("properties").update(payload).eq("id", property.id)
      : await supabase.from("properties").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(property ? "Property updated" : "Property created");
    qc.invalidateQueries({ queryKey: ["admin-properties"] });
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setForm(emptyForm(property));
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{property ? `Edit ${property.code}` : "New property"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Type</Label>
              <Select
                value={form.property_type}
                onValueChange={(v) => set("property_type", v as PropertyType)}
                disabled={!!property}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plot">Plot</SelectItem>
                  <SelectItem value="flat">Flat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Project</Label>
              <Select value={form.project_id} onValueChange={(v) => set("project_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="mb-1.5 block">Code</Label>
              <Input
                value={form.code}
                onChange={(e) => set("code", e.target.value)}
                placeholder="SVM-P-010"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Price (₹)</Label>
              <Input
                type="number"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as PropertyStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">Cover image URL</Label>
            <Input
              value={form.cover_image_url}
              onChange={(e) => set("cover_image_url", e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Linked customer</Label>
            <Select value={form.customer_id} onValueChange={(v) => set("customer_id", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.property_type === "plot" ? (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
              <div>
                <Label className="mb-1.5 block">Size (sq.yd)</Label>
                <Input
                  type="number"
                  value={form.size_sqyd}
                  onChange={(e) => set("size_sqyd", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Facing</Label>
                <Select
                  value={form.facing || undefined}
                  onValueChange={(v) => set("facing", v as FacingDirection)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {["east", "west", "north", "south"].map((f) => (
                      <SelectItem key={f} value={f} className="capitalize">
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Road width (ft)</Label>
                <Input
                  type="number"
                  value={form.road_width_ft}
                  onChange={(e) => set("road_width_ft", e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  checked={form.is_corner}
                  onCheckedChange={(v) => set("is_corner", !!v)}
                  id="corner"
                />
                <Label htmlFor="corner">Corner plot</Label>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
              <div>
                <Label className="mb-1.5 block">Tower</Label>
                <Input value={form.tower} onChange={(e) => set("tower", e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block">Floor number</Label>
                <Input
                  type="number"
                  value={form.floor_number}
                  onChange={(e) => set("floor_number", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">BHK</Label>
                <Select value={form.bhk} onValueChange={(v) => set("bhk", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["2BHK", "3BHK", "4BHK"].map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Parking slots</Label>
                <Input
                  type="number"
                  value={form.parking_slots}
                  onChange={(e) => set("parking_slots", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Carpet area (sq.ft)</Label>
                <Input
                  type="number"
                  value={form.carpet_area_sqft}
                  onChange={(e) => set("carpet_area_sqft", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Built-up area (sq.ft)</Label>
                <Input
                  type="number"
                  value={form.builtup_area_sqft}
                  onChange={(e) => set("builtup_area_sqft", e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Label className="mb-1.5 block">Amenities (comma separated)</Label>
                <Input
                  value={form.amenities}
                  onChange={(e) => set("amenities", e.target.value)}
                  placeholder="Clubhouse, Gym, Swimming Pool"
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground">
            {saving ? "Saving…" : "Save property"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------- Properties tab ---------------------------------- */

function PropertiesTab() {
  const { data: properties, isLoading } = useProperties();
  const { data: projects } = useProjects();
  const { data: customers } = useCustomersBrief();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<PropertyStatus>("available");

  const filtered = useMemo(() => {
    return (properties ?? []).filter((p) => {
      if (projectFilter !== "all" && p.project_id !== projectFilter) return false;
      if (typeFilter !== "all" && p.property_type !== typeFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search && !p.code.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [properties, projectFilter, typeFilter, statusFilter, search]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected((s) =>
      s.size === filtered.length ? new Set() : new Set(filtered.map((p) => p.id)),
    );

  const applyBulk = async () => {
    if (!selected.size) return;
    const { error } = await supabase
      .from("properties")
      .update({ status: bulkStatus })
      .in("id", Array.from(selected));
    if (error) return toast.error(error.message);
    toast.success(`Updated ${selected.size} properties to ${bulkStatus}`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["admin-properties"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="min-w-[160px] flex-1">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Search code</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SVM-P-001"
            />
          </div>
        </div>
        <FilterSelect
          label="Project"
          value={projectFilter}
          onChange={setProjectFilter}
          options={[
            { v: "all", l: "All" },
            ...(projects ?? []).map((p) => ({ v: p.id, l: p.name })),
          ]}
        />
        <FilterSelect
          label="Type"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { v: "all", l: "All" },
            { v: "plot", l: "Plot" },
            { v: "flat", l: "Flat" },
          ]}
        />
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { v: "all", l: "All" },
            { v: "available", l: "Available" },
            { v: "blocked", l: "Blocked" },
            { v: "sold", l: "Sold" },
          ]}
        />
        <PropertyDialog
          projects={projects ?? []}
          customers={customers ?? []}
          trigger={
            <Button className="bg-primary text-primary-foreground">
              <Plus className="mr-1.5 h-4 w-4" />
              Add property
            </Button>
          }
        />
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <span>{selected.size} selected</span>
          <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as PropertyStatus)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={applyBulk}>
            Apply bulk status
          </Button>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={!!filtered.length && selected.size === filtered.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                </TableCell>
                <TableCell className="font-medium">{p.code}</TableCell>
                <TableCell className="text-muted-foreground">{p.projects?.name}</TableCell>
                <TableCell className="capitalize">{p.property_type}</TableCell>
                <TableCell>{formatCurrency(p.price)}</TableCell>
                <TableCell>
                  <StatusBadge status={p.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">{p.customers?.name ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <PropertyDialog
                    property={p}
                    projects={projects ?? []}
                    customers={customers ?? []}
                    trigger={
                      <Button size="icon" variant="ghost">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="min-w-[140px]">
      <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.v} value={o.v}>
              {o.l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ---------------------------------- Layout view tab ---------------------------------- */

function LayoutTab() {
  const { data: projects } = useProjects();
  const { data: properties } = useProperties();
  const [projectId, setProjectId] = useState<string>("");
  const project = projects?.find((p) => p.id === (projectId || projects?.[0]?.id));
  const activeId = projectId || projects?.[0]?.id;
  const props = (properties ?? []).filter((p) => p.project_id === activeId);
  const plots = props.filter((p) => p.property_type === "plot");
  const flats = props.filter((p) => p.property_type === "flat");

  const towers = useMemo(() => {
    const map = new Map<string, typeof flats>();
    for (const f of flats) {
      const key = f.tower ?? "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return Array.from(map.entries());
  }, [flats]);

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <FilterSelect
          label="Project"
          value={activeId ?? ""}
          onChange={setProjectId}
          options={(projects ?? []).map((p) => ({ v: p.id, l: p.name }))}
        />
      </div>

      {!!plots.length && (
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <LayoutGrid className="h-4 w-4" />
              Site map — plots
            </h3>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6">
              {plots.map((p) => (
                <div
                  key={p.id}
                  title={`${p.code} · ${formatCurrency(p.price)}`}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center rounded-lg border text-[11px] font-medium",
                    p.status === "available" && "border-success/40 bg-success/10 text-success",
                    p.status === "blocked" && "border-warning/40 bg-warning/15 text-warning",
                    p.status === "sold" && "border-primary/30 bg-primary/10 text-primary",
                  )}
                >
                  <span className="font-semibold">{p.code.split("-").pop()}</span>
                  <span>{p.size_sqyd} yd</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!!towers.length && (
        <Card>
          <CardContent className="space-y-6 p-5">
            <h3 className="flex items-center gap-2 font-semibold">
              <LayoutGrid className="h-4 w-4" />
              Tower / floor grid — flats
            </h3>
            {towers.map(([tower, units]) => {
              const floors = new Map<number, typeof units>();
              for (const u of units) {
                const f = u.floor_number ?? 0;
                if (!floors.has(f)) floors.set(f, []);
                floors.get(f)!.push(u);
              }
              const sorted = Array.from(floors.entries()).sort((a, b) => b[0] - a[0]);
              return (
                <div key={tower}>
                  <div className="mb-2 text-sm font-medium text-muted-foreground">{tower}</div>
                  <div className="space-y-2">
                    {sorted.map(([floor, fUnits]) => (
                      <div key={floor} className="flex items-center gap-3">
                        <div className="w-12 shrink-0 text-xs text-muted-foreground">F{floor}</div>
                        <div className="flex flex-wrap gap-2">
                          {fUnits.map((u) => (
                            <div
                              key={u.id}
                              title={`${u.code} · ${u.bhk} · ${formatCurrency(u.price)}`}
                              className={cn(
                                "flex h-12 w-16 flex-col items-center justify-center rounded-md border text-[10px] font-medium",
                                u.status === "available" &&
                                  "border-success/40 bg-success/10 text-success",
                                u.status === "blocked" &&
                                  "border-warning/40 bg-warning/15 text-warning",
                                u.status === "sold" &&
                                  "border-primary/30 bg-primary/10 text-primary",
                              )}
                            >
                              {u.code.split("-").pop()}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {!plots.length && !towers.length && project && (
        <p className="text-sm text-muted-foreground">No properties in this project yet.</p>
      )}
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

function Inventory() {
  return (
    <div>
      <PageHeader
        title="Inventory Management"
        desc="Manage projects, plots and flats across your portfolio."
      />
      <div className="p-4 md:p-8">
        <Tabs defaultValue="properties">
          <TabsList>
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="layout">Layout view</TabsTrigger>
          </TabsList>
          <TabsContent value="properties" className="mt-4">
            <PropertiesTab />
          </TabsContent>
          <TabsContent value="projects" className="mt-4">
            <ProjectsTab />
          </TabsContent>
          <TabsContent value="layout" className="mt-4">
            <LayoutTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
