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
import { Plus, Play, Clock, Zap, RotateCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/extract")({
  component: ExtractPage,
});

function ExtractPage() {
  const { data: org } = useOrg();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", data_source_id: "", mode: "incremental", schedule: "0 2 * * *" });

  const { data: jobs } = useQuery({
    queryKey: ["jobs", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const { data } = await supabase.from("extraction_jobs").select("*, data_sources(name, service_type)").eq("org_id", org!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const { data: sources } = useQuery({
    queryKey: ["sources-min", org?.id],
    enabled: !!org?.id,
    queryFn: async () => (await supabase.from("data_sources").select("id, name, service_type").eq("org_id", org!.id)).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!org) return;
      const { error } = await supabase.from("extraction_jobs").insert({
        org_id: org.id, name: form.name, data_source_id: form.data_source_id || null,
        mode: form.mode, schedule: form.schedule, status: "scheduled",
        next_run: new Date(Date.now() + 86400000).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); setOpen(false); toast.success("Job created"); setForm({ name: "", data_source_id: "", mode: "incremental", schedule: "0 2 * * *" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const run = useMutation({
    mutationFn: async (id: string) => {
      const rows = Math.floor(50000 + Math.random() * 500000);
      const { error } = await supabase.from("extraction_jobs").update({
        status: "completed", last_run: new Date().toISOString(), rows_extracted: rows,
      }).eq("id", id);
      if (error) throw error;
      return rows;
    },
    onSuccess: (rows) => { qc.invalidateQueries({ queryKey: ["jobs"] }); toast.success(`Extracted ${rows.toLocaleString()} rows`); },
  });

  return (
    <div>
      <PageHeader phase="02 · Extract" title="Extraction jobs" desc="Incremental, full, or streaming extraction with auto schema discovery."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" /> New job</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create extraction job</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Daily customers sync" /></div>
                <div>
                  <Label>Data source</Label>
                  <Select value={form.data_source_id} onValueChange={(v) => setForm({ ...form, data_source_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pick source" /></SelectTrigger>
                    <SelectContent>{sources?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.service_type}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mode</Label>
                  <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="incremental">Incremental (recommended)</SelectItem>
                      <SelectItem value="full">Full extract</SelectItem>
                      <SelectItem value="streaming">Real-time streaming</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Schedule (cron)</Label><Input value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} className="font-mono" /></div>
              </div>
              <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="p-8">
        <div className="rounded-xl border border-border bg-card-gradient">
          {!jobs?.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No extraction jobs yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {jobs.map((j: any) => (
                <li key={j.id} className="flex items-center gap-4 p-5">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    {j.mode === "streaming" ? <Zap className="h-5 w-5" /> : j.mode === "full" ? <RotateCw className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{j.name}</span>
                      <Badge variant="outline" className="text-xs">{j.mode}</Badge>
                      <Badge variant="outline" className={j.status === "completed" ? "border-success/40 text-success" : "border-muted-foreground/30 text-muted-foreground"}>{j.status}</Badge>
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      {j.data_sources?.name ?? "—"} · cron: {j.schedule}
                      {j.last_run && ` · last run ${new Date(j.last_run).toLocaleString()} · ${j.rows_extracted?.toLocaleString()} rows`}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => run.mutate(j.id)} disabled={run.isPending}><Play className="mr-2 h-3 w-3" />Run now</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
