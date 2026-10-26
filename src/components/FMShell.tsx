import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building, Ticket, Wallet2, Gauge, LogOut, Menu, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useProfile } from "@/lib/useProfile";
import { cn } from "@/lib/utils";

const STAFF_NAV = [
  { to: "/fm", label: "Overview", icon: Building, exact: true },
  { to: "/fm/tickets", label: "Tickets", icon: Ticket },
  { to: "/fm/assets", label: "Assets & Health", icon: Gauge },
  { to: "/fm/billing", label: "Billing & Collections", icon: Wallet2 },
];

const RESIDENT_NAV = [
  { to: "/fm", label: "My Society", icon: Building, exact: true },
  { to: "/fm/tickets", label: "My Tickets", icon: Ticket },
  { to: "/fm/billing", label: "My Bills", icon: Wallet2 },
];

export function FMShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isStaff = profile ? profile.role !== "customer" : false;
  const nav = isStaff ? STAFF_NAV : RESIDENT_NAV;
  const homePath = isStaff ? "/admin" : "/portal";

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
          <div className="flex items-center gap-6">
            <Link
              to={homePath}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Link>
            <Link to="/fm" className="flex items-center gap-2">
              <Logo iconOnly />
              <span className="text-sm font-semibold">
                Facility <span className="text-primary">Management</span>
              </span>
            </Link>
            <nav className="hidden items-center gap-1 lg:flex">
              <NavLinks />
            </nav>
          </div>
          <div className="flex items-center gap-1.5">
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
