import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import {
  MapPin,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  Building2,
  ShieldCheck,
  FileCheck2,
  Wallet,
  ClipboardCheck,
  Users,
  LayoutGrid,
  TrendingDown,
  Clock,
  FileSearch,
  Quote,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SAN Connect — Real Estate Sales & Operations Platform" },
      {
        name: "description",
        content:
          "The subscription platform real estate companies run their sales, finance and legal teams on — plus a branded portal and AI assistant for every buyer.",
      },
    ],
  }),
  component: Landing,
});

function useFeaturedProjects() {
  return useQuery({
    queryKey: ["landing-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at")
        .limit(3);
      if (error) throw error;
      return data;
    },
  });
}

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2400&q=80";
const HERO_IMAGE_FALLBACK =
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=2400&q=80";

const RESULTS = [
  {
    icon: Clock,
    metric: "Faster collections",
    desc: "Automatic overdue flags and installment reminders mean fewer manual follow-up calls from your finance team.",
  },
  {
    icon: FileSearch,
    metric: "Full audit trail",
    desc: "Every document, approval and status change is timestamped and attributable — nothing lost between teams.",
  },
  {
    icon: TrendingDown,
    metric: "Fewer status calls",
    desc: "Buyers track their own booking, payments and documents in a live portal, instead of calling your sales desk.",
  },
];

const STORIES = [
  {
    quote:
      "We used to run bookings on spreadsheets across three teams. SAN Connect gave every one of our plot buyers a self-serve portal, and our finance team finally sees overdue accounts the moment they slip.",
    name: "Priya Ramesh",
    role: "Operations Head, Sanview Developers",
    result: "Unified pipeline across 3 projects",
  },
  {
    quote:
      "The approval board changed how legal and finance work together — nothing moves to registration until every stage is actually cleared, and we can see exactly who's holding things up.",
    name: "Arvind Nair",
    role: "Legal Counsel, Meridian Realty Group",
    result: "5-stage approval visibility",
  },
  {
    quote:
      "Our buyers ask the AI assistant about their installment schedule before they ever call us. It's the first thing prospects mention when they tour the portal during our sales pitch.",
    name: "Kavya Iyer",
    role: "VP Sales, Horizon Estates",
    result: "AI assistant handles routine buyer questions",
  },
];

const PILLARS = [
  { icon: Building2, label: "Inventory", sub: "Plots & flats, live status" },
  { icon: Users, label: "Leads & CRM", sub: "Pipeline + site visits" },
  { icon: Wallet, label: "Finance", sub: "Collections & dues" },
  { icon: ShieldCheck, label: "Legal", sub: "Docs & approvals" },
];

function HeroPhoto() {
  const [src, setSrc] = useState<string | null>(HERO_IMAGE);

  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-[#161029] via-[#1f1744] to-[#0a0714]">
      {src && (
        <img
          src={src}
          alt=""
          loading="eager"
          decoding="async"
          className="animate-kenburns absolute inset-0 h-full w-full object-cover"
          style={{ filter: "brightness(0.6) saturate(1.15)", mixBlendMode: "luminosity" }}
          onError={() => setSrc((s) => (s === HERO_IMAGE ? HERO_IMAGE_FALLBACK : null))}
        />
      )}
      {/* Tints the photo's luminance into the gradient's navy/purple palette,
          so the hero reads as a moody night cityscape regardless of the
          source photo's actual lighting — and still looks intentional if the
          image never loads at all. */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#241a3d]/40 via-transparent to-[#0a0714]/60 mix-blend-multiply" />
    </div>
  );
}

function Landing() {
  const { data: projects } = useFeaturedProjects();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ============================================================= HERO */}
      <section className="relative flex min-h-[100svh] flex-col overflow-hidden bg-black text-white">
        <HeroPhoto />
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/35 to-black/85" />

        <header className="relative z-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
            <Link to="/" className="flex items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="h-4 w-4" />
              </span>
              <span className="text-base font-bold tracking-tight text-white">
                SAN <span className="text-primary">Connect</span>
              </span>
            </Link>
            <nav className="hidden gap-8 text-sm text-white/70 md:flex">
              <a href="#results" className="hover:text-white">
                Results
              </a>
              <a href="#how-it-works" className="hover:text-white">
                Buyer journey
              </a>
              <a href="#platform" className="hover:text-white">
                For your team
              </a>
              <a href="#stories" className="hover:text-white">
                Customer stories
              </a>
            </nav>
            <div className="flex items-center gap-2">
              <Link to="/auth">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 hover:text-white"
                >
                  Sign in
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="sm" className="bg-white text-black hover:bg-white/90">
                  Request a demo
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="animate-fade-up font-mono text-xs uppercase tracking-[0.3em] text-white/60">
            Subscription platform for real estate teams
          </div>
          <h1
            className="animate-fade-up mx-auto mt-6 max-w-4xl text-6xl font-bold leading-[0.98] tracking-tight md:text-8xl"
            style={{ animationDelay: "0.1s" }}
          >
            Your real estate
            <br />
            business, connected.
          </h1>
          <p
            className="animate-fade-up mx-auto mt-8 max-w-xl text-lg text-white/70"
            style={{ animationDelay: "0.2s" }}
          >
            One platform for sales, finance and legal — with a branded portal and AI assistant for
            every buyer. From first lead to final possession.
          </p>
          <div
            className="animate-fade-up mt-10 flex flex-wrap justify-center gap-3"
            style={{ animationDelay: "0.3s" }}
          >
            <Link to="/auth">
              <Button size="lg" className="bg-primary text-primary-foreground hover:opacity-90">
                See the platform <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                See the buyer journey
              </Button>
            </a>
          </div>
        </div>

        <a
          href="#results"
          className="relative z-10 mb-8 flex flex-col items-center gap-2 self-center text-white/50 transition hover:text-white"
        >
          <span className="font-mono text-[10px] uppercase tracking-widest">Scroll</span>
          <ArrowDown className="h-4 w-4 animate-bounce" />
        </a>
      </section>

      {/* ============================================================= RESULTS (light) */}
      <section id="results" className="bg-background py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
              Why teams switch
            </div>
            <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
              Built around the outcomes that matter.
            </h2>
          </div>
          <div className="mt-16 grid gap-12 md:grid-cols-3">
            {RESULTS.map((r) => (
              <div key={r.metric}>
                <r.icon className="h-6 w-6 text-primary" />
                <div className="mt-4 text-xl font-bold">{r.metric}</div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================= LIVE PROJECTS (dark, full-bleed tiles) */}
      <section id="projects" className="bg-black py-28 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
                See it on real inventory
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
                Live projects running on this platform.
              </h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {(projects ?? []).map((p) => (
              <Link
                key={p.id}
                to="/auth"
                className="group relative block aspect-[3/4] overflow-hidden rounded-xl"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-105"
                  style={{ backgroundImage: `url(${p.cover_image_url})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <div className="flex items-center gap-1.5 text-xs text-white/70">
                    <MapPin className="h-3.5 w-3.5" />
                    {p.location}
                  </div>
                  <h3 className="mt-1.5 text-xl font-bold">{p.name}</h3>
                  <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-white group-hover:underline">
                    View details <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================= BUYER JOURNEY (light) */}
      <section id="how-it-works" className="bg-background py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
              What your buyers experience
            </div>
            <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
              Everything tracked, nothing lost.
            </h2>
          </div>
          <div className="mt-16 grid gap-10 md:grid-cols-5">
            {[
              {
                icon: LayoutGrid,
                label: "Browse",
                desc: "Filter plots & flats by budget, size and location.",
              },
              {
                icon: CheckCircle2,
                label: "Book",
                desc: "Express interest and lock in a property instantly.",
              },
              {
                icon: Wallet,
                label: "Pay",
                desc: "Track installment schedule and apply for financing.",
              },
              {
                icon: FileCheck2,
                label: "Verify",
                desc: "Upload KYC & legal documents, see their status.",
              },
              {
                icon: ClipboardCheck,
                label: "Possess",
                desc: "Follow booking through to registration & handover.",
              },
            ].map((s, i) => (
              <div key={s.label} className="text-center">
                <div className="font-mono text-[11px] text-muted-foreground">0{i + 1}</div>
                <s.icon className="mx-auto mt-3 h-6 w-6 text-primary" />
                <div className="mt-3 font-semibold">{s.label}</div>
                <p className="mt-1.5 text-xs text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================= PLATFORM (dark) */}
      <section id="platform" className="bg-black py-28 text-white">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-16 md:grid-cols-2">
            <div>
              <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
                What your subscription includes
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
                One operations dashboard, built for real estate.
              </h2>
              <p className="mt-6 text-white/70">
                Sales tracks leads and site visits, finance manages collections and overdue
                accounts, legal verifies documents and clears approvals — admin sees it all. Connect
                your website, YouTube, Instagram and TikTok channels to feed leads straight into the
                pipeline.
              </p>
              <ul className="mt-8 space-y-3 text-sm">
                {[
                  "Kanban pipeline from New lead to Sold",
                  "Installment schedules with automatic overdue flags",
                  "Document verification queue with audit trail",
                  "Multi-stage approval board across booking → possession",
                  "Marketing & lead-capture integrations",
                  "AI assistant for both your team and your buyers",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-white/85">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="mt-10 inline-block">
                <Button className="bg-white text-black hover:bg-white/90">
                  Staff sign in <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/10">
              {PILLARS.map((c) => (
                <div key={c.label} className="bg-black p-8">
                  <c.icon className="h-6 w-6 text-primary" />
                  <div className="mt-4 font-semibold">{c.label}</div>
                  <div className="mt-1 text-xs text-white/50">{c.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================= STORIES (light) */}
      <section id="stories" className="bg-background py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
              Customer stories
            </div>
            <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
              What teams on SAN Connect say.
            </h2>
          </div>
          <div className="mt-16 grid gap-10 md:grid-cols-3">
            {STORIES.map((s) => (
              <div key={s.name} className="flex flex-col">
                <Quote className="h-6 w-6 text-primary/50" />
                <p className="mt-4 flex-1 text-sm leading-relaxed text-foreground/85">{s.quote}</p>
                <div className="mt-6 border-t border-border pt-4">
                  <div className="text-sm font-semibold">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.role}</div>
                  <div className="mt-2 text-[11px] font-medium text-primary">{s.result}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-12 text-center text-xs text-muted-foreground">
            Illustrative customer stories based on typical team workflows on SAN Connect.
          </p>
        </div>
      </section>

      {/* ============================================================= CLOSING CTA (dark) */}
      <section className="bg-black py-32 text-center text-white">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-4xl font-bold tracking-tight md:text-6xl">
            Bring your team onto one platform.
          </h2>
          <p className="mt-6 text-white/60">
            Sign in to explore the live demo — buyer portal, operations dashboard and AI assistant,
            all running on real inventory.
          </p>
          <Link to="/auth">
            <Button size="lg" className="mt-10 bg-primary text-primary-foreground hover:opacity-90">
              Get started <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="bg-black py-8 text-center text-xs text-white/40">
        © 2026 SAN Connect — Real Estate Sales &amp; Operations Platform
      </footer>
    </div>
  );
}
