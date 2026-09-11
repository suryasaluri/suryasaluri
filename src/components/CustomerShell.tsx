import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Home,
  Search,
  FileText,
  Wallet,
  Route as RouteIcon,
  LogOut,
  Menu,
  Bell,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useMyCustomer, useProfile } from "@/lib/useProfile";
import { initials, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/portal", label: "Home", icon: Home, exact: true },
  { to: "/portal/browse", label: "Browse Properties", icon: Search },
  { to: "/portal/documents", label: "My Documents", icon: FileText },
  { to: "/portal/payments", label: "My Payments", icon: Wallet },
  { to: "/portal/status", label: "Status Tracker", icon: RouteIcon },
];

function NotificationsBell() {
  const { data: customer } = useMyCustomer();
  const qc = useQueryClient();
  const { data: notifications } = useQuery({
    queryKey: ["notifications", customer?.id],
    enabled: !!customer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("customer_id", customer!.id)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data;
    },
  });
  const unread = notifications?.filter((n) => !n.is_read).length ?? 0;

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", customer?.id] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">Notifications</div>
        <div className="max-h-96 overflow-y-auto">
          {!notifications?.length && (
            <div className="p-4 text-sm text-muted-foreground">You're all caught up.</div>
          )}
          {notifications?.map((n) => (
            <button
              key={n.id}
              onClick={() => markRead(n.id)}
              className={cn(
                "block w-full border-b border-border/60 px-4 py-3 text-left text-sm last:border-0 hover:bg-muted/60",
                !n.is_read && "bg-accent/40",
              )}
            >
              <div className="font-medium">{n.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{n.message}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {formatDateTime(n.created_at)}
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CustomerShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const [mobileOpen, setMobileOpen] = useState(false);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {nav.map((n) => {
        const active = n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to);
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
              active ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-muted",
            )}
          >
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-8">
            <Link to="/portal">
              <Logo />
            </Link>
            <nav className="hidden items-center gap-1 lg:flex">
              <NavLinks />
            </nav>
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationsBell />
            <div className="hidden items-center gap-2 pl-2 sm:flex">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/15 text-xs text-primary">
                  {initials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="text-sm">
                <div className="font-medium leading-tight">{profile?.full_name ?? "—"}</div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-4">
          <SheetTitle className="mb-4">
            <Logo />
          </SheetTitle>
          <nav className="flex flex-col gap-1">
            <NavLinks onNavigate={() => setMobileOpen(false)} />
          </nav>
        </SheetContent>
      </Sheet>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
