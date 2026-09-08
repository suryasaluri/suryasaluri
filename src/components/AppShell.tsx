import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Search, Download, Wand2, Upload, BarChart3, Database, LogOut, LayoutDashboard, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useOrg } from "@/lib/useOrg";
import { AICopilot } from "@/components/AICopilot";

const nav = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/app/find", label: "Find", icon: Search, badge: "01" },
  { to: "/app/extract", label: "Extract", icon: Download, badge: "02" },
  { to: "/app/transform", label: "Transform", icon: Wand2, badge: "03" },
  { to: "/app/load", label: "Load", icon: Upload, badge: "04" },
  { to: "/app/analyze", label: "Analyze", icon: BarChart3, badge: "05" },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: org } = useOrg();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <Link to="/app" className="flex items-center gap-2 border-b border-sidebar-border px-5 py-4">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary-gradient text-primary-foreground"><Database className="h-4 w-4" /></div>
          <span className="font-display text-base font-bold">Nexus <span className="text-primary">Command</span></span>
        </Link>
        <div className="px-3 py-3 text-xs uppercase tracking-wider text-sidebar-foreground/60">Pipeline</div>
        <nav className="flex-1 space-y-0.5 px-2">
          {nav.map((n) => {
            const active = n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"
                }`}
              >
                <n.icon className="h-4 w-4" />
                <span className="flex-1">{n.label}</span>
                {n.badge && <span className="font-mono text-[10px] text-sidebar-foreground/50">{n.badge}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 rounded-lg bg-sidebar-accent/40 px-3 py-2 text-xs">
            <div className="text-sidebar-foreground/60">Workspace</div>
            <div className="truncate font-medium">{org?.name ?? "—"}</div>
          </div>
          <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/50">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
      <AICopilot />
    </div>
  );
}

export function PageHeader({ phase, title, desc, action }: { phase?: string; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="border-b border-border bg-card/30 px-8 py-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          {phase && <div className="font-mono text-xs uppercase tracking-widest text-primary">{phase}</div>}
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{title}</h1>
          {desc && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{desc}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
