import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { useState } from "react";
import { toast } from "sonner";
import { Wand2, ShoppingCart, Heart, Banknote, Briefcase, Plus, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/transform")({
  component: TransformPage,
});

const TEMPLATES = [
  { id: "ecommerce", name: "E-Commerce", icon: ShoppingCart, desc: "PII masking, currency standardization, order dedup, customer segmentation",
    rules: [{ op: "mask", col: "email" }, { op: "round", col: "revenue", decimals: 2 }, { op: "dedup", col: "order_id" }, { op: "segment", col: "revenue" }] },
  { id: "saas", name: "SaaS / Subscription", icon: Briefcase, desc: "Churn risk, cohort prep, trial vs paid, usage metrics",
    rules: [{ op: "churn_risk" }, { op: "cohort", col: "signup_date" }, { op: "normalize", col: "plan" }] },
  { id: "healthcare", name: "Healthcare (HIPAA)", icon: Heart, desc: "PHI encryption, patient de-identification, audit trail",
    rules: [{ op: "hipaa_mask", col: "ssn" }, { op: "encrypt", col: "diagnosis" }, { op: "audit" }] },
  { id: "fintech", name: "Financial (PCI-DSS)", icon: Banknote, desc: "Card masking, fraud patterns, AML flagging, regulatory format",
    rules: [{ op: "pci_mask", col: "credit_card" }, { op: "fraud_score" }, { op: "aml_check" }] },
];

function TransformPage() {
  const { data: org } = useOrg();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", template: "" });

  const { data: policies } = useQuery({
    queryKey: ["policies", org?.id],
    enabled: !!org?.id,
    queryFn: async () => (await supabase.from("transformation_policies").select("*").eq("org_id", org!.id).order("created_at", { ascending: false })).data ?? [],
  });

  const apply = useMutation({
    mutationFn: async (t: typeof TEMPLATES[number]) => {
      if (!org) return;
      const { error } = await supabase.from("transformation_policies").insert({
        org_id: org.id, name: `${t.name} policy`, template: t.id, rules: t.rules,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["policies"] }); toast.success("Policy applied"); },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!org) return;
      const { error } = await supabase.from("transformation_policies").insert({
        org_id: org.id, name: form.name, template: form.template || "custom", rules: [],
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["policies"] }); setOpen(false); setForm({ name: "", template: "" }); toast.success("Custom policy created"); },
  });

  return (
    <div>
      <PageHeader phase="03 · Transform" title="Transformation policies"
        desc="No-code builder with industry templates for compliance (GDPR, HIPAA, PCI-DSS) and quality."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Custom policy</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New custom policy</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Policy name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <p className="text-xs text-muted-foreground">Use the visual rule builder to add cleansing, masking, enrichment, and quality rules.</p>
              </div>
              <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.name}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="space-y-8 p-8">
        <div>
          <div className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">Industry templates · 1-click apply</div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {TEMPLATES.map((t) => (
              <Card key={t.id} className="border-border bg-card-gradient p-5">
                <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><t.icon className="h-5 w-5" /></div>
                <div className="font-semibold">{t.name}</div>
                <p className="mt-1 text-xs text-muted-foreground">{t.desc}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {t.rules.slice(0, 3).map((r, i) => <Badge key={i} variant="outline" className="font-mono text-[10px]">{r.op}</Badge>)}
                </div>
                <Button size="sm" className="mt-4 w-full bg-primary text-primary-foreground" onClick={() => apply.mutate(t)} disabled={apply.isPending}>
                  <Wand2 className="mr-2 h-3 w-3" /> Apply template
                </Button>
              </Card>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card-gradient">
          <div className="border-b border-border p-5 flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /><h3 className="font-semibold">Active policies</h3></div>
          {!policies?.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No policies yet. Apply a template above.</div>
          ) : (
            <ul className="divide-y divide-border">
              {policies.map((p: any) => (
                <li key={p.id} className="flex items-center gap-4 p-5">
                  <Wand2 className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">{p.template}</Badge>
                      <Badge variant="outline" className="text-[10px]">v{p.version}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{(p.rules as any[])?.length ?? 0} transformation rules · {p.active ? "active" : "draft"}</div>
                  </div>
                  <Button size="sm" variant="outline">Edit</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
