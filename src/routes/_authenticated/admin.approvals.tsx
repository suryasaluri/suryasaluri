import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { APPROVAL_STAGES, STAGE_LABELS } from "@/lib/db-types";
import type { ApprovalStage, UserRole, Approval } from "@/lib/db-types";
import { formatDate } from "@/lib/format";
import { useProfile } from "@/lib/useProfile";
import { toast } from "sonner";
import { Check, X, Clock, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  component: ApprovalsWorkflow,
});

const STAGE_ROLES: Record<ApprovalStage, UserRole[]> = {
  booking: ["sales", "admin"],
  legal_verification: ["legal", "admin"],
  finance_clearance: ["finance", "admin"],
  registration: ["legal", "admin"],
  possession: ["legal", "admin"],
};

function useApprovals() {
  return useQuery({
    queryKey: ["admin-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approvals")
        .select("*, customers(name), properties(code)")
        .order("created_at");
      if (error) throw error;
      return data as (Approval & { customers: { name: string }; properties: { code: string } })[];
    },
  });
}

function RejectDialog({ approval, onSaved }: { approval: Approval; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: profile } = useProfile();

  const submit = async () => {
    if (!comment.trim()) return toast.error("A comment is required to reject");
    setSaving(true);
    const { error } = await supabase
      .from("approvals")
      .update({
        status: "rejected",
        comments: comment,
        approved_by: profile?.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", approval.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Stage rejected");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="border-destructive/40 text-destructive hover:bg-destructive/10"
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Reject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {STAGE_LABELS[approval.stage]}</DialogTitle>
        </DialogHeader>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Explain what's needed to proceed…"
          rows={3}
        />
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={saving}
            className="bg-destructive text-destructive-foreground hover:opacity-90"
          >
            {saving ? "Saving…" : "Confirm rejection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApprovalGroup({
  customerId,
  propertyId,
  label,
  code,
  approvals,
  onChange,
}: {
  customerId: string;
  propertyId: string;
  label: string;
  code: string;
  approvals: Approval[];
  onChange: () => void;
}) {
  const { data: profile } = useProfile();
  const byStage = new Map(approvals.map((a) => [a.stage, a]));
  const firstIncompleteIdx = APPROVAL_STAGES.findIndex(
    (s) => byStage.get(s)?.status !== "approved",
  );

  const approve = async (stage: ApprovalStage) => {
    const existing = byStage.get(stage);
    const payload = {
      status: "approved" as const,
      approved_by: profile?.id,
      approved_at: new Date().toISOString(),
      comments: null,
    };
    const { error } = existing
      ? await supabase.from("approvals").update(payload).eq("id", existing.id)
      : await supabase
          .from("approvals")
          .insert({ customer_id: customerId, property_id: propertyId, stage, ...payload });
    if (error) return toast.error(error.message);
    toast.success(`${STAGE_LABELS[stage]} approved`);
    onChange();
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <span className="font-semibold">{label}</span>{" "}
            <span className="text-sm text-muted-foreground">· {code}</span>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          {APPROVAL_STAGES.map((stage, i) => {
            const a = byStage.get(stage);
            const status = a?.status ?? "pending";
            const isCurrent = i === firstIncompleteIdx && status !== "rejected";
            const canAct =
              profile &&
              STAGE_ROLES[stage].includes(profile.role) &&
              (isCurrent || status === "rejected");
            return (
              <div
                key={stage}
                className={cn(
                  "rounded-lg border p-3",
                  status === "approved" && "border-success/30 bg-success/5",
                  status === "rejected" && "border-destructive/30 bg-destructive/5",
                  status === "pending" && "border-border",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full text-white",
                      status === "approved" && "bg-success",
                      status === "rejected" && "bg-destructive",
                      status === "pending" && (isCurrent ? "bg-warning" : "bg-muted-foreground/40"),
                    )}
                  >
                    {status === "approved" && <Check className="h-3.5 w-3.5" />}
                    {status === "rejected" && <X className="h-3.5 w-3.5" />}
                    {status === "pending" && isCurrent && <Clock className="h-3.5 w-3.5" />}
                    {status === "pending" && !isCurrent && <Circle className="h-2.5 w-2.5" />}
                  </span>
                  <span className="text-sm font-medium">{STAGE_LABELS[stage]}</span>
                </div>
                <div className="mt-1.5 text-xs text-muted-foreground">
                  {status === "approved" && `Approved ${formatDate(a?.approved_at)}`}
                  {status === "rejected" && (a?.comments || "Rejected")}
                  {status === "pending" && (isCurrent ? "Awaiting action" : "Upcoming")}
                </div>
                {canAct && (
                  <div className="mt-2.5 flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-7 bg-success px-2 text-xs text-success-foreground hover:opacity-90"
                      onClick={() => approve(stage)}
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Approve
                    </Button>
                    {a && <RejectDialog approval={a} onSaved={onChange} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ApprovalsWorkflow() {
  const { data: approvals, isLoading } = useApprovals();
  const qc = useQueryClient();
  const onChange = () => qc.invalidateQueries({ queryKey: ["admin-approvals"] });

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { customerId: string; propertyId: string; label: string; code: string; approvals: Approval[] }
    >();
    for (const a of approvals ?? []) {
      const key = `${a.customer_id}_${a.property_id}`;
      if (!map.has(key))
        map.set(key, {
          customerId: a.customer_id,
          propertyId: a.property_id,
          label: a.customers.name,
          code: a.properties.code,
          approvals: [],
        });
      map.get(key)!.approvals.push(a);
    }
    return Array.from(map.values());
  }, [approvals]);

  return (
    <div>
      <PageHeader
        title="Approvals Workflow"
        desc="Move each booking through Booking → Legal → Finance → Registration → Possession."
      />
      <div className="space-y-4 p-4 md:p-8">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && !groups.length && (
          <p className="text-sm text-muted-foreground">No bookings in the approval pipeline yet.</p>
        )}
        {groups.map((g) => (
          <ApprovalGroup
            key={`${g.customerId}_${g.propertyId}`}
            customerId={g.customerId}
            propertyId={g.propertyId}
            label={g.label}
            code={g.code}
            approvals={g.approvals}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}
