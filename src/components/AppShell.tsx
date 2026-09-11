import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Users,
  Wallet,
  FileCheck2,
  ClipboardCheck,
  BarChart3,
  ListTodo,
  LogOut,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useProfile } from "@/lib/useProfile";
import { initials, titleCase } from "@/lib/format";
import type { UserRole } from "@/lib/db-types";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
  exact?: boolean;
};

const nav: NavItem[] = [
  {
    to: "/admin",
    label: "Overview",
    icon: LayoutDashboard,
    exact: true,
    roles: ["admin", "sales", "finance", "legal"],
  },
  { to: "/admin/inventory", label: "Inventory", icon: Building2, roles: ["admin", "sales"] },
  { to: "/admin/leads", label: "Leads & CRM", icon: Users, roles: ["admin", "sales"] },
  { to: "/admin/payments", label: "Payments & Finance", icon: Wallet, roles: ["admin", "finance"] },
  { to: "/admin/documents", label: "Document Center", icon: FileCheck2, roles: ["admin", "legal"] },
  {
    to: "/admin/approvals",
    label: "Approvals",
    icon: ClipboardCheck,
    roles: ["admin", "legal", "finance", "sales"],
  },
  { to: "/admin/reports", label: "Reports", icon: BarChart3, roles: ["admin"] },
  {
    to: "/admin/tasks",
    label: "Team & Tasks",
    icon: ListTodo,
    roles: ["admin", "sales", "finance", "legal"],
  },
];

function SidebarNav({ role, onNavigate }: { role: UserRole; onNavigate?: () => void }) {
  const location = useLocation();
  const items = nav.filter((n) => n.roles.includes(role));
  return (
    <nav className="flex-1 space-y-0.5 px-2">
      {items.map((n) => {
        const active = n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to);
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50",
            )}
          >
            <n.icon className="h-4 w-4" />
            <span className="flex-1">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = profile?.role ?? "admin";

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <Link
          to="/admin"
          className="flex items-center gap-2 border-b border-sidebar-border px-5 py-4"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-gradient text-primary-foreground">
            <Building2 className="h-4 w-4" />
          </span>
          <span className="font-display text-base font-bold text-sidebar-foreground">
            SAN <span className="text-primary">Connect</span>
          </span>
        </Link>
        <div className="px-3 py-3 text-xs uppercase tracking-wider text-sidebar-foreground/50">
          Operations
        </div>
        <SidebarNav role={role} />
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-sidebar-accent/40 px-3 py-2 text-xs">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary/25 text-[10px] text-sidebar-foreground">
                {initials(profile?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate font-medium text-sidebar-foreground">
                {profile?.full_name ?? "—"}
              </div>
              <div className="text-sidebar-foreground/50">{titleCase(role)}</div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetTitle className="flex items-center gap-2 border-b border-sidebar-border px-5 py-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-gradient text-primary-foreground">
              <Building2 className="h-4 w-4" />
            </span>
            <span className="font-display text-base font-bold text-sidebar-foreground">
              SAN <span className="text-primary">Connect</span>
            </span>
          </SheetTitle>
          <div className="flex flex-col py-3">
            <SidebarNav role={role} onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="flex items-center justify-between border-b border-border bg-card/40 px-4 py-3 lg:hidden">
          <Logo />
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
        </header>
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border bg-card/30 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
          {desc && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{desc}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
