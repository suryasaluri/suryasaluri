import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LogIn,
  LogOut,
  Download,
  Users,
  Search,
  Flame,
  CalendarCheck2,
  CalendarX2,
  TimerReset,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/useProfile";
import { formatDate, formatTime, initials } from "@/lib/format";
import { ATTENDANCE_STATUS_LABELS, type AttendanceRecord } from "@/lib/db-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/attendance")({
  component: Attendance,
});

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStartStr = () => `${new Date().toISOString().slice(0, 7)}-01`;

const STATUS_DOT: Record<string, string> = {
  present: "bg-[var(--success)]",
  half_day: "bg-[var(--warning)]",
  leave: "bg-[var(--warning)]",
  absent: "bg-[var(--destructive)]",
};

function elapsedLabel(from: string, to: Date): string {
  const totalMinutes = Math.max(0, Math.floor((to.getTime() - new Date(from).getTime()) / 60_000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function useMyAttendance(profileId: string | undefined) {
  return useQuery({
    queryKey: ["my-attendance", profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<AttendanceRecord[]> => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("profile_id", profileId!)
        .gte("date", monthStartStr())
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

function MyAttendanceCard({ profileId }: { profileId: string }) {
  const qc = useQueryClient();
  const { data: records, isLoading } = useMyAttendance(profileId);
  const today = records?.find((r) => r.date === todayStr());
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const clockIn = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("attendance_records").upsert(
        {
          profile_id: profileId,
          date: todayStr(),
          check_in: new Date().toISOString(),
          status: "present",
        },
        { onConflict: "profile_id,date" },
      );
      if (error) throw error;
      toast.success("Clocked in");
      qc.invalidateQueries({ queryKey: ["my-attendance"] });
      qc.invalidateQueries({ queryKey: ["team-attendance"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't clock in");
    } finally {
      setBusy(false);
    }
  };

  const clockOut = async () => {
    if (!today) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("attendance_records")
        .update({ check_out: new Date().toISOString() })
        .eq("id", today.id);
      if (error) throw error;
      toast.success("Clocked out");
      qc.invalidateQueries({ queryKey: ["my-attendance"] });
      qc.invalidateQueries({ queryKey: ["team-attendance"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't clock out");
    } finally {
      setBusy(false);
    }
  };

  const monthRecords = records ?? [];
  const monthCounts = monthRecords.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const completedDays = monthRecords.filter((r) => r.check_in && r.check_out);
  const avgHours =
    completedDays.length > 0
      ? completedDays.reduce(
          (sum, r) =>
            sum + (new Date(r.check_out!).getTime() - new Date(r.check_in!).getTime()) / 3_600_000,
          0,
        ) / completedDays.length
      : 0;

  let streak = 0;
  for (const r of monthRecords) {
    if (r.status === "present") streak++;
    else break;
  }

  const recentDays = monthRecords.filter((r) => r.date !== todayStr()).slice(0, 6);

  const tiles: { label: string; value: string | number; icon: typeof CalendarCheck2 }[] = [
    { label: "Present", value: monthCounts.present ?? 0, icon: CalendarCheck2 },
    { label: "Leave", value: monthCounts.leave ?? 0, icon: CalendarX2 },
    { label: "Avg hrs/day", value: avgHours ? avgHours.toFixed(1) : "—", icon: TimerReset },
    { label: "Day streak", value: streak, icon: Flame },
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">My attendance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {now.toLocaleDateString("en-IN", {
                weekday: "long",
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </div>
            <div className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight">
              {now.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {today ? (
                <>
                  <StatusBadge status={today.status} />
                  <span className="text-xs text-muted-foreground">
                    In {formatTime(today.check_in)}
                    {today.check_out
                      ? ` · Out ${formatTime(today.check_out)}`
                      : today.check_in
                        ? ` · ${elapsedLabel(today.check_in, now)} on the clock`
                        : ""}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Not clocked in yet</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="lg"
              className="rounded-full px-6 shadow-sm"
              onClick={clockIn}
              disabled={busy || !!today?.check_in}
            >
              <LogIn className="mr-2 h-4 w-4" /> Clock in
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full px-6"
              onClick={clockOut}
              disabled={busy || !today?.check_in || !!today?.check_out}
            >
              <LogOut className="mr-2 h-4 w-4" /> Clock out
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl border border-border p-3">
              <t.icon className="h-4 w-4 text-muted-foreground" />
              <div className="mt-2 text-xl font-semibold tabular-nums">{t.value}</div>
              <div className="text-xs text-muted-foreground">{t.label}</div>
            </div>
          ))}
        </div>

        {!isLoading && recentDays.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Recent days</div>
            <div className="space-y-1">
              {recentDays.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted/50"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        STATUS_DOT[r.status] ?? "bg-muted-foreground",
                      )}
                    />
                    {formatDate(r.date)}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {formatTime(r.check_in)} – {formatTime(r.check_out)}
                    </span>
                    <StatusBadge status={r.status} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type TeamRow = {
  profile_id: string;
  full_name: string | null;
  role: string;
  counts: Record<string, number>;
  hours: number;
};

function useTeamAttendance(month: string) {
  return useQuery({
    queryKey: ["team-attendance", month],
    queryFn: async (): Promise<TeamRow[]> => {
      const start = `${month}-01`;
      const end = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)
        .toISOString()
        .slice(0, 10);
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*, profiles(full_name, role)")
        .gte("date", start)
        .lte("date", end);
      if (error) throw error;

      const byProfile = new Map<string, TeamRow>();
      for (const r of data as (AttendanceRecord & {
        profiles: { full_name: string | null; role: string } | null;
      })[]) {
        if (!byProfile.has(r.profile_id)) {
          byProfile.set(r.profile_id, {
            profile_id: r.profile_id,
            full_name: r.profiles?.full_name ?? "—",
            role: r.profiles?.role ?? "—",
            counts: {},
            hours: 0,
          });
        }
        const row = byProfile.get(r.profile_id)!;
        row.counts[r.status] = (row.counts[r.status] ?? 0) + 1;
        if (r.check_in && r.check_out) {
          row.hours +=
            (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 3_600_000;
        }
      }
      return Array.from(byProfile.values()).sort((a, b) =>
        (a.full_name ?? "").localeCompare(b.full_name ?? ""),
      );
    },
  });
}

function downloadCsv(rows: TeamRow[], month: string) {
  const header = ["Name", "Role", "Present", "Half Day", "Leave", "Absent", "Total Hours"];
  const lines = rows.map((r) =>
    [
      r.full_name,
      r.role,
      r.counts.present ?? 0,
      r.counts.half_day ?? 0,
      r.counts.leave ?? 0,
      r.counts.absent ?? 0,
      r.hours.toFixed(1),
    ].join(","),
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance-payroll-${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function attendanceRate(row: TeamRow): number {
  const total = Object.values(row.counts).reduce((a, b) => a + b, 0);
  if (!total) return 0;
  const weighted = (row.counts.present ?? 0) + (row.counts.half_day ?? 0) * 0.5;
  return Math.round((weighted / total) * 100);
}

function TeamAttendanceCard() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [search, setSearch] = useState("");
  const { data: rows, isLoading } = useTeamAttendance(month);

  const filtered = useMemo(
    () =>
      (rows ?? []).filter((r) =>
        (r.full_name ?? "").toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [rows, search],
  );

  const teamSize = rows?.length ?? 0;
  const avgRate = teamSize
    ? Math.round(rows!.reduce((sum, r) => sum + attendanceRate(r), 0) / teamSize)
    : 0;
  const totalHours = (rows ?? []).reduce((sum, r) => sum + r.hours, 0);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Team attendance &amp; payroll report</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {teamSize} team member{teamSize === 1 ? "" : "s"} · {avgRate}% avg attendance ·{" "}
            {totalHours.toFixed(0)} hrs logged
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          />
          <Button size="sm" variant="outline" onClick={() => rows && downloadCsv(rows, month)}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Download for HR
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search team member…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && !filtered.length && (
          <p className="text-sm text-muted-foreground">
            {rows?.length
              ? "No team members match your search."
              : "No attendance records for this month."}
          </p>
        )}
        {!!filtered.length && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Present</TableHead>
                <TableHead>Half day</TableHead>
                <TableHead>Leave</TableHead>
                <TableHead>Absent</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead className="w-[160px]">Attendance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const rate = attendanceRate(r);
                return (
                  <TableRow key={r.profile_id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-primary/15 text-[10px] text-primary">
                            {initials(r.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        {r.full_name}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">{r.role}</TableCell>
                    <TableCell>{r.counts.present ?? 0}</TableCell>
                    <TableCell>{r.counts.half_day ?? 0}</TableCell>
                    <TableCell>{r.counts.leave ?? 0}</TableCell>
                    <TableCell>{r.counts.absent ?? 0}</TableCell>
                    <TableCell>{r.hours.toFixed(1)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={rate} className="h-1.5 w-20" />
                        <span className="text-xs tabular-nums text-muted-foreground">{rate}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function Attendance() {
  const { data: profile } = useProfile();
  const isAdmin = profile?.role === "admin";
  const legend = useMemo(() => Object.entries(ATTENDANCE_STATUS_LABELS), []);

  if (!profile) return null;

  return (
    <div>
      <PageHeader
        title="Attendance"
        desc="Clock in and out, and — for admins — audit the whole team and export a payroll-ready report."
      />
      <div className="space-y-6 p-4 md:p-8">
        <MyAttendanceCard profileId={profile.id} />
        {isAdmin && <TeamAttendanceCard />}
        {!isAdmin && (
          <Card>
            <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Team-wide audit and payroll export are visible to admins.
            </CardContent>
          </Card>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {legend.map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span
                className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[k] ?? "bg-muted-foreground")}
              />
              {v}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
