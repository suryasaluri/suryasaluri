import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Upload, Snowflake, Cloud, Database } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/load")({
  component: LoadPage,
});

const TYPES = [
  { id: "snowflake", label: "Snowflake", icon: Snowflake },
  { id: "bigquery", label: "BigQuery", icon: Cloud },
  { id: "redshift", label: "Redshift", icon: Database },
  { id: "s3", label: "AWS S3", icon: Cloud },
  { id: "postgres", label: "PostgreSQL", icon: Database },
];

function LoadPage() {
  const { data: org } = useOrg();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", dest_type: "snowflake", load_strategy: "upsert", schedule: "0 */6 * * *" });

  const { data: dests } = useQuery({
    queryKey: ["dests", org?.id],
    enabled: !!org?.id,
    queryFn: async () => (await supabase.from("load_destinations").select("*").eq("org_id", org!.id).order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!org) return;
      const { error } = await supabase.from("load_destinations").insert({
        org_id: org.id, name: form.name, dest_type: form.dest_type,
        load_strategy: form.load_strategy, schedule: form.schedule, status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dests"] }); setOpen(false); toast.success("Destination added"); setForm({ name: "", dest_type: "snowflake", load_strategy: "upsert", schedule: "0 */6 * * *" }); },
  });

  return (
    <div>
      <PageHeader phase="04 · Load" title="Load destinations" desc="Multi-destination delivery with smart upsert, append, full-replace, and SCD strategies."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" /> Add destination</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New load destination</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Analytics warehouse" /></div>
                <div>
                  <Label>Destination type</Label>
                  <Select value={form.dest_type} onValueChange={(v) => setForm({ ...form, dest_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Load strategy</Label>
                  <Select value={form.load_strategy} onValueChange={(v) => setForm({ ...form, load_strategy: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upsert">Upsert (smart merge)</SelectItem>
                      <SelectItem value="append">Append (event logs)</SelectItem>
                      <SelectItem value="full_replace">Full replace</SelectItem>
                      <SelectItem value="scd2">SCD Type 2 (versioned)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Schedule</Label><Input className="font-mono" value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.name}>Add</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="p-8">
        <div className="rounded-xl border border-border bg-card-gradient">
          {!dests?.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No destinations yet — add one to start loading.</div>
          ) : (
            <ul className="divide-y divide-border">
              {dests.map((d: any) => {
                const T = TYPES.find(t => t.id === d.dest_type);
                const Icon = T?.icon ?? Upload;
                return (
                  <li key={d.id} className="flex items-center gap-4 p-5">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{d.name}</span>
                        <Badge variant="outline" className="text-xs">{T?.label ?? d.dest_type}</Badge>
                        <Badge variant="outline" className="font-mono text-[10px]">{d.load_strategy}</Badge>
                      </div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">cron: {d.schedule} · {d.status}</div>
                    </div>
                    <Button size="sm" variant="outline">Configure</Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
