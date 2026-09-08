import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, Target, Send } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/app/analyze")({
  component: AnalyzePage,
});

const revenueData = Array.from({ length: 12 }, (_, i) => ({
  m: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i],
  mrr: Math.round(1800 + i * 120 + Math.random() * 100),
  churn: +(3 - i * 0.08 + Math.random() * 0.3).toFixed(2),
}));
const segData = [
  { name: "Enterprise", v: 45, fill: "var(--chart-1)" },
  { name: "Mid-market", v: 35, fill: "var(--chart-2)" },
  { name: "SMB", v: 20, fill: "var(--chart-3)" },
];
const cohortData = Array.from({ length: 8 }, (_, i) => ({ w: `W${i+1}`, retention: Math.round(100 - i * (6 + Math.random() * 2)) }));

function AnalyzePage() {
  const [q, setQ] = useState("");
  return (
    <div>
      <PageHeader phase="05 · Analyze" title="Executive intelligence"
        desc="Auto-generated dashboards, anomaly detection, and natural-language query — built from your loaded data." />
      <div className="space-y-6 p-8">
        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-5">
          {[
            { k: "Customers", v: "125,430", d: "+8.2%", up: true },
            { k: "MRR", v: "$2.5M", d: "+12.1%", up: true },
            { k: "Churn", v: "2.1%", d: "-0.3%", up: true },
            { k: "CAC payback", v: "4.2 mo", d: "-0.6mo", up: true },
            { k: "NPS", v: "62", d: "+5", up: true },
          ].map((k) => (
            <div key={k.k} className="rounded-xl border border-border bg-card-gradient p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{k.k}</div>
              <div className="mt-2 font-display text-2xl font-bold">{k.v}</div>
              <div className={`mt-1 text-xs ${k.up ? "text-success" : "text-destructive"}`}>{k.d}</div>
            </div>
          ))}
        </div>

        {/* AI insights */}
        <div className="rounded-xl border border-primary/40 bg-card-gradient p-6 shadow-glow">
          <div className="mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h3 className="font-semibold">AI-generated insights</h3></div>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { icon: AlertTriangle, color: "text-destructive", t: "Churn spike in EU region", d: "Up 1.4pp vs last month. Likely tied to billing change rollout." },
              { icon: TrendingUp, color: "text-success", t: "Mobile signups +23% YoY", d: "Accelerating in APAC. Consider mobile-first onboarding tweaks." },
              { icon: Lightbulb, color: "text-warning", t: "West Coast expansion potential", d: "18% untapped — based on lookalike modeling vs East Coast cohort." },
              { icon: Target, color: "text-primary", t: "Q2 forecast: +15K customers", d: "95% confidence. Below target by 3K — recommend boosting paid acquisition." },
            ].map((i) => (
              <div key={i.t} className="flex gap-3 rounded-lg bg-secondary/40 p-3">
                <i.icon className={`h-4 w-4 shrink-0 ${i.color}`} />
                <div><div className="text-sm font-medium">{i.t}</div><div className="mt-1 text-xs text-muted-foreground">{i.d}</div></div>
              </div>
            ))}
          </div>
        </div>

        {/* NL Query */}
        <div className="rounded-xl border border-border bg-card-gradient p-5">
          <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Natural language query</div>
          <div className="flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Show me revenue trends by region last quarter" />
            <Button className="bg-primary text-primary-foreground"><Send className="mr-2 h-4 w-4" /> Ask</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Top 10 churning customers", "Revenue by acquisition source", "What drove growth this month?", "Forecast Q3 ARR"].map((s) => (
              <Badge key={s} variant="outline" className="cursor-pointer hover:bg-secondary" onClick={() => setQ(s)}>{s}</Badge>
            ))}
          </div>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card-gradient p-5 lg:col-span-2">
            <h3 className="mb-4 font-display text-lg font-semibold">MRR & churn · last 12 months</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="m" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Area dataKey="mrr" stroke="var(--chart-1)" fill="url(#ga)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card-gradient p-5">
            <h3 className="mb-4 font-display text-lg font-semibold">Revenue by segment</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={segData} dataKey="v" innerRadius={50} outerRadius={85} paddingAngle={3}>
                    {segData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 space-y-1 text-xs">
              {segData.map((s) => (
                <li key={s.name} className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: s.fill }} /> {s.name}</span><span className="font-mono">{s.v}%</span></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card-gradient p-5">
            <h3 className="mb-4 font-display text-lg font-semibold">Cohort retention</h3>
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart data={cohortData}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="w" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Line dataKey="retention" stroke="var(--chart-2)" strokeWidth={2} dot={{ fill: "var(--chart-2)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card-gradient p-5">
            <h3 className="mb-4 font-display text-lg font-semibold">Churn rate trend</h3>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={revenueData}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="m" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Bar dataKey="churn" fill="var(--chart-3)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
