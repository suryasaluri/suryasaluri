import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useOrg } from "@/lib/useOrg";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, Users, Building2, ScrollText, KeyRound, Loader2, AlertTriangle, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data: org, isLoading } = useOrg();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? "");
    });
  }, []);

  const isAdmin = !!org && !!userId && org.owner_id === userId;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div>
        <PageHeader phase="Admin" title="Settings" desc="Workspace administration." />
        <div className="p-8">
          <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-8 text-center">
            <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 font-display text-lg font-semibold">Admins only</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You don't have permission to view organization settings. Contact your workspace admin.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        phase="Admin"
        title="Settings"
        desc="Manage your organization, members, security, and audit history."
        action={<Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" /> Admin</Badge>}
      />
      <div className="p-8">
        <Tabs defaultValue="org" className="space-y-6">
          <TabsList>
            <TabsTrigger value="org"><Building2 className="mr-2 h-4 w-4" />Organization</TabsTrigger>
            <TabsTrigger value="members"><Users className="mr-2 h-4 w-4" />Members</TabsTrigger>
            <TabsTrigger value="security"><KeyRound className="mr-2 h-4 w-4" />Security</TabsTrigger>
            <TabsTrigger value="audit"><ScrollText className="mr-2 h-4 w-4" />Audit log</TabsTrigger>
          </TabsList>

          <TabsContent value="org">
            <OrgTab org={org!} onSaved={() => qc.invalidateQueries({ queryKey: ["org"] })} />
          </TabsContent>
          <TabsContent value="members">
            <MembersTab orgId={org!.id} />
          </TabsContent>
          <TabsContent value="security">
            <SecurityTab email={email} />
          </TabsContent>
          <TabsContent value="audit">
            <AuditTab orgId={org!.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Card({ title, desc, children, footer }: { title: string; desc?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-6 py-4">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      </div>
      <div className="space-y-4 p-6">{children}</div>
      {footer && <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-3">{footer}</div>}
    </div>
  );
}

function OrgTab({ org, onSaved }: { org: { id: string; name: string; industry: string | null }; onSaved: () => void }) {
  const [name, setName] = useState(org.name);
  const [industry, setIndustry] = useState(org.industry ?? "");
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("organizations")
        .update({ name: name.trim(), industry: industry.trim() || null })
        .eq("id", org.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Organization updated");
      onSaved();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update"),
  });

  return (
    <Card
      title="Organization profile"
      desc="Workspace identity used across Nexus Command."
      footer={
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="org-name">Workspace name</Label>
          <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-industry">Industry</Label>
          <Input id="org-industry" value={industry} placeholder="e.g. Financial Services" onChange={(e) => setIndustry(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Workspace ID</Label>
          <Input value={org.id} readOnly className="font-mono text-xs" />
        </div>
      </div>
    </Card>
  );
}

function MembersTab({ orgId }: { orgId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["members", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card title="Members" desc="People with access to this workspace.">
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading</div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="text-sm text-muted-foreground">No members yet.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">User ID</th>
                <th className="px-4 py-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data!.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-4 py-2">{m.full_name ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{m.id.slice(0, 8)}…</td>
                  <td className="px-4 py-2 text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function SecurityTab({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const sendReset = async () => {
    if (!email) return;
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent");
  };
  return (
    <div className="space-y-6">
      <Card title="Account" desc="Your admin sign-in identity.">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={email} readOnly />
        </div>
        <Button variant="outline" onClick={sendReset} disabled={sending}>
          {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send password reset link
        </Button>
      </Card>
      <Card title="Data governance" desc="Org-wide controls enforced by NEXUS policy agents.">
        <ul className="space-y-2 text-sm">
          {[
            ["PII masking", "Enabled across all transform policies"],
            ["RLS enforcement", "Active on all workspace tables"],
            ["Audit log retention", "365 days"],
            ["SoD compliance", "Monitored continuously"],
          ].map(([k, v]) => (
            <li key={k} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="font-medium">{k}</span>
              <span className="text-muted-foreground">{v}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Danger zone" desc="Irreversible actions. Proceed with care.">
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
          <div className="flex-1 text-sm">
            <div className="font-medium">Delete workspace</div>
            <div className="text-muted-foreground">Permanently removes all sources, jobs, and history. This cannot be undone.</div>
          </div>
          <Button variant="destructive" size="sm" disabled>Delete</Button>
        </div>
      </Card>
    </div>
  );
}

function AuditTab({ orgId }: { orgId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["audit", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, resource_type, resource_id, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Card title="Audit log" desc="Most recent 50 governance events in this workspace.">
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading</div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="text-sm text-muted-foreground">No audit events recorded yet.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Resource</th>
              </tr>
            </thead>
            <tbody>
              {data!.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-2 text-muted-foreground">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2"><Badge variant="secondary">{row.action}</Badge></td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{row.resource_type ?? "—"} {row.resource_id?.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
