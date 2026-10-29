import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, ShieldCheck, Mail, Phone, KeyRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { createIsolatedAuthClient } from "@/integrations/supabase/adminClient";
import { initials, formatDate, titleCase } from "@/lib/format";
import type { Profile, Customer, UserRole } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UserManagement,
});

const STAFF_ROLES: UserRole[] = ["sales", "finance", "legal", "admin"];

function genPassword() {
  return `San${Math.random().toString(36).slice(2, 8)}!${Math.floor(Math.random() * 90 + 10)}`;
}

/* ------------------------------- Employees ------------------------------- */

function useStaff() {
  return useQuery({
    queryKey: ["admin-staff"],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("role", STAFF_ROLES)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

function AddEmployeeDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "sales" as UserRole,
    password: genPassword(),
  });

  const reset = () =>
    setForm({ full_name: "", email: "", phone: "", role: "sales", password: genPassword() });

  const create = async () => {
    if (!form.full_name.trim() || !form.email.trim() || form.password.length < 8) {
      return toast.error("Fill in name, email and an 8+ character password");
    }
    setSaving(true);
    try {
      const authClient = createIsolatedAuthClient();
      const { error } = await authClient.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: { role: form.role, full_name: form.full_name.trim(), phone: form.phone.trim() },
        },
      });
      if (error) throw error;
      toast.success(`${form.full_name} added as ${titleCase(form.role)}`);
      qc.invalidateQueries({ queryKey: ["admin-staff"] });
      qc.invalidateQueries({ queryKey: ["sales-staff"] });
      setOpen(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground">
          <UserPlus className="mr-1.5 h-4 w-4" /> Add employee
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a team member</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block text-xs">Full name</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="98765 43210"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v as UserRole }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {titleCase(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Temporary password</Label>
              <div className="flex gap-1.5">
                <Input
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setForm((f) => ({ ...f, password: genPassword() }))}
                  title="Generate a new password"
                >
                  <KeyRound className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Share this password with them directly — they can change it after signing in. In this
            demo, the account is created client-side, so treat it as a trusted-admin-only action
            rather than a production-grade provisioning flow.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={saving} className="bg-primary text-primary-foreground">
            {saving ? "Creating…" : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmployeesTab() {
  const { data: staff, isLoading } = useStaff();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AddEmployeeDialog />
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Added</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff?.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary/15 text-[10px] text-primary">
                        {initials(s.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    {s.full_name}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={s.role} />
                </TableCell>
                <TableCell className="text-muted-foreground">{s.email ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{s.phone ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(s.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ------------------------------- Customers ------------------------------- */

function useAllCustomers() {
  return useQuery({
    queryKey: ["admin-users-customers"],
    queryFn: async (): Promise<Customer[]> => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

function AddCustomerDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [withLogin, setWithLogin] = useState(false);
  const qc = useQueryClient();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    referral_source: "",
    password: genPassword(),
  });

  const reset = () => {
    setForm({ full_name: "", email: "", phone: "", referral_source: "", password: genPassword() });
    setWithLogin(false);
  };

  const create = async () => {
    if (!form.full_name.trim()) return toast.error("Enter a name");
    if (withLogin && (!form.email.trim() || form.password.length < 8)) {
      return toast.error("Login access needs an email and an 8+ character password");
    }
    setSaving(true);
    try {
      if (withLogin) {
        const authClient = createIsolatedAuthClient();
        const { error } = await authClient.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            data: {
              role: "customer",
              full_name: form.full_name.trim(),
              phone: form.phone.trim(),
              referral_source: form.referral_source.trim() || "Added by admin",
            },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert({
          name: form.full_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          referral_source: form.referral_source.trim() || "Added by admin",
          lead_status: "new",
        });
        if (error) throw error;
      }
      toast.success(`${form.full_name} added`);
      qc.invalidateQueries({ queryKey: ["admin-users-customers"] });
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      setOpen(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add customer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground">
          <UserPlus className="mr-1.5 h-4 w-4" /> Add customer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a customer</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block text-xs">Full name</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">Email {withLogin && "(required)"}</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="98765 43210"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Referral source</Label>
            <Input
              value={form.referral_source}
              onChange={(e) => setForm((f) => ({ ...f, referral_source: e.target.value }))}
              placeholder="Walk-in, Website, Referral…"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">Create portal login</div>
              <p className="text-xs text-muted-foreground">
                Off adds a lead-only record (no account). On lets them sign in immediately.
              </p>
            </div>
            <Switch checked={withLogin} onCheckedChange={setWithLogin} />
          </div>
          {withLogin && (
            <div>
              <Label className="mb-1.5 block text-xs">Temporary password</Label>
              <div className="flex gap-1.5">
                <Input
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setForm((f) => ({ ...f, password: genPassword() }))}
                  title="Generate a new password"
                >
                  <KeyRound className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={saving} className="bg-primary text-primary-foreground">
            {saving ? "Adding…" : withLogin ? "Create account" : "Add lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomersTab() {
  const { data: customers, isLoading } = useAllCustomers();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AddCustomerDialog />
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Lead status</TableHead>
              <TableHead>Login</TableHead>
              <TableHead>Added</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary/15 text-[10px] text-primary">
                        {initials(c.name)}
                      </AvatarFallback>
                    </Avatar>
                    {c.name}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex flex-col gap-0.5 text-xs">
                    {c.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={c.lead_status} />
                </TableCell>
                <TableCell>
                  {c.user_id ? (
                    <span className="inline-flex items-center gap-1 text-xs text-success">
                      <ShieldCheck className="h-3.5 w-3.5" /> Active
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Lead only</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(c.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function UserManagement() {
  return (
    <div>
      <PageHeader
        title="Team & Users"
        desc="Create employee accounts with system access, and add customer records or logins."
      />
      <div className="p-4 md:p-8">
        <Tabs defaultValue="employees">
          <TabsList>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
          </TabsList>
          <TabsContent value="employees" className="mt-4">
            <EmployeesTab />
          </TabsContent>
          <TabsContent value="customers" className="mt-4">
            <CustomersTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
