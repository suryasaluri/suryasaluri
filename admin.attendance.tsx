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
  ChevronLeft,
  ChevronRight,
  MapPin,
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
import {
  ATTENDANCE_STATUS_LABELS,
  type AttendanceRecord,
  type AttendanceStatus,
} from "@/lib/db-types";
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

const STATUS_CELL: Record<string, string> = {
  present: "bg-[var(--success)]/15 text-[var(--success)]",
  half_day: "bg-[var(--warning)]/15 text-[var(--warning)]",
  leave: "bg-[var(--warning)]/15 text-[var(--warning)]",
  absent: "bg-[var(--destructive)]/15 text-[var(--destructive)]",
};

function statusLabel(s: string): string {
  return ATTENDANCE_STATUS_LABELS[s as AttendanceStatus] ?? s;
}

const dateKey = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};
const startOfWeekMon = (d: Date) => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  const offset = (c.getDay() + 6) % 7;
  return addDays(c, -offset);
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

        {!isLoading && (
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">This month</div>
            <MyMonthCalendar records={monthRecords} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MyMonthCalendar({ records }: { records: AttendanceRecord[] }) {
  const byDate = useMemo(() => new Map(records.map((r) => [r.date, r])), [records]);
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const lead = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((lead + last.getDate()) / 7) * 7;
  const gridStart = addDays(first, -lead);
  const days = Array.from({ length: totalCells }, (_, i) => addDays(gridStart, i));
  const todayKey = todayStr();

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === today.getMonth();
          const key = dateKey(d);
          const rec = byDate.get(key);
          const isToday = key === todayKey;
          return (
            <div
              key={i}
              title={
                inMonth
                  ? `${formatDate(key)} · ${rec ? statusLabel(rec.status) : "No record"}`
                  : undefined
              }
              className={cn(
                "flex h-8 items-center justify-center rounded-md text-[11px]",
                !inMonth && "opacity-0",
                inMonth && isToday && "ring-1 ring-primary",
                inMonth && rec
                  ? STATUS_CELL[rec.status]
                  : inMonth
                    ? "text-muted-foreground/50"
                    : "",
              )}
            >
              {d.getDate()}
            </div>
          );
        })}
      </div>
    </div>
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

type TeamCalStaff = { id: string; full_name: string | null; role: string };
type TeamCalRecord = {
  profile_id: string;
  date: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
};
type TeamCalVisit = { assigned_staff: string | null; scheduled_date: string; status: string };

function useTeamCalendar(rangeStart: string, rangeEnd: string) {
  return useQuery({
    queryKey: ["team-calendar", rangeStart, rangeEnd],
    queryFn: async () => {
      const [staff, records, visits] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, role")
          .in("role", ["sales", "finance", "legal", "admin"])
          .order("full_name"),
        supabase
          .from("attendance_records")
          .select("profile_id, date, status, check_in, check_out")
          .gte("date", rangeStart)
          .lte("date", rangeEnd),
        supabase
          .from("site_visits")
          .select("assigned_staff, scheduled_date, status")
          .gte("scheduled_date", `${rangeStart}T00:00:00`)
          .lte("scheduled_date", `${rangeEnd}T23:59:59`),
      ]);
      if (staff.error) throw staff.error;
      if (records.error) throw records.error;
      if (visits.error) throw visits.error;
      return {
        staff: staff.data as TeamCalStaff[],
        records: records.data as TeamCalRecord[],
        visits: visits.data as TeamCalVisit[],
      };
    },
  });
}

function MonthGrid({
  days,
  monthStart,
  staff,
  recMap,
  visitMap,
}: {
  days: Date[];
  monthStart: Date;
  staff: TeamCalStaff[];
  recMap: Map<string, TeamCalRecord>;
  visitMap: Map<string, number>;
}) {
  const todayKey = todayStr();
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === monthStart.getMonth();
          const key = dateKey(d);
          const isToday = key === todayKey;
          const visitCount = staff.reduce(
            (sum, s) => sum + (visitMap.get(`${s.id}__${key}`) ?? 0),
            0,
          );
          return (
            <div
              key={i}
              className={cn(
                "min-h-[60px] rounded-lg border p-1",
                inMonth ? "border-border" : "border-transparent opacity-30",
                isToday && "ring-1 ring-primary",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{d.getDate()}</span>
                {visitCount > 0 && <MapPin className="h-3 w-3 text-[var(--chart-3)]" />}
              </div>
              <div className="mt-1 flex flex-wrap gap-0.5">
                {staff.map((s) => {
                  const rec = recMap.get(`${s.id}__${key}`);
                  return (
                    <span
                      key={s.id}
                      title={`${s.full_name ?? "—"} — ${rec ? statusLabel(rec.status) : "No record"}`}
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        rec ? (STATUS_DOT[rec.status] ?? "bg-muted-foreground/40") : "bg-muted",
                      )}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  days,
  staff,
  recMap,
  visitMap,
}: {
  days: Date[];
  staff: TeamCalStaff[];
  recMap: Map<string, TeamCalRecord>;
  visitMap: Map<string, number>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="w-32 pb-2 text-left font-medium text-muted-foreground">Staff</th>
            {days.map((d) => (
              <th key={dateKey(d)} className="pb-2 text-center font-medium text-muted-foreground">
                <div>{d.toLocaleDateString("en-IN", { weekday: "short" })}</div>
                <div className="text-[10px]">{d.getDate()}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id} className="border-t border-border/60">
              <td className="py-2 pr-2 font-medium">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary/15 text-[9px] text-primary">
                      {initials(s.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{s.full_name}</span>
                </div>
              </td>
              {days.map((d) => {
                const key = dateKey(d);
                const rec = recMap.get(`${s.id}__${key}`);
                const visits = visitMap.get(`${s.id}__${key}`) ?? 0;
                return (
                  <td key={key} className="py-2 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span
                        className={cn(
                          "inline-block rounded px-1.5 py-0.5 text-[10px]",
                          rec
                            ? (STATUS_CELL[rec.status] ?? "bg-muted text-muted-foreground")
                            : "text-muted-foreground/40",
                        )}
                      >
                        {rec ? statusLabel(rec.status) : "—"}
                      </span>
                      {visits > 0 && (
                        <span className="flex items-center gap-0.5 text-[9px] text-[var(--chart-3)]">
                          <MapPin className="h-2.5 w-2.5" />
                          {visits}
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayList({
  date,
  staff,
  recMap,
  visitMap,
}: {
  date: Date;
  staff: TeamCalStaff[];
  recMap: Map<string, TeamCalRecord>;
  visitMap: Map<string, number>;
}) {
  const key = dateKey(date);
  return (
    <div className="space-y-1.5">
      {staff.map((s) => {
        const rec = recMap.get(`${s.id}__${key}`);
        const visits = visitMap.get(`${s.id}__${key}`) ?? 0;
        return (
          <div
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2.5"
          >
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary/15 text-[10px] text-primary">
                  {initials(s.full_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-sm font-medium">{s.full_name}</div>
                <div className="text-[11px] capitalize text-muted-foreground">{s.role}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {visits > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-[var(--chart-3)]/15 px-2 py-0.5 text-[11px] text-[var(--chart-3)]">
                  <MapPin className="h-3 w-3" /> Site visit{visits > 1 ? ` ×${visits}` : ""}
                </span>
              )}
              {rec ? (
                <>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(rec.check_in)} – {formatTime(rec.check_out)}
                  </span>
                  <StatusBadge status={rec.status} />
                </>
              ) : (
                <span className="text-xs text-muted-foreground">No record</span>
              )}
            </div>
          </div>
        );
      })}
      {!staff.length && <p className="text-xs text-muted-foreground">No team members.</p>}
    </div>
  );
}

function TeamCalendarCard() {
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [anchor, setAnchor] = useState(() => new Date());

  const range = useMemo(() => {
    if (viewMode === "day") {
      return { start: dateKey(anchor), end: dateKey(anchor), days: [anchor], monthStart: anchor };
    }
    if (viewMode === "week") {
      const start = startOfWeekMon(anchor);
      const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      return { start: dateKey(days[0]), end: dateKey(days[6]), days, monthStart: anchor };
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const lead = (first.getDay() + 6) % 7;
    const gridStart = addDays(first, -lead);
    const totalCells = Math.ceil((lead + last.getDate()) / 7) * 7;
    const days = Array.from({ length: totalCells }, (_, i) => addDays(gridStart, i));
    return {
      start: dateKey(days[0]),
      end: dateKey(days[days.length - 1]),
      days,
      monthStart: first,
    };
  }, [viewMode, anchor]);

  const { data, isLoading } = useTeamCalendar(range.start, range.end);

  const recMap = useMemo(() => {
    const m = new Map<string, TeamCalRecord>();
    for (const r of data?.records ?? []) m.set(`${r.profile_id}__${r.date}`, r);
    return m;
  }, [data]);

  const visitMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of data?.visits ?? []) {
      if (!v.assigned_staff || v.status === "cancelled") continue;
      const k = `${v.assigned_staff}__${v.scheduled_date.slice(0, 10)}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [data]);

  const staff = data?.staff ?? [];

  const navigate = (dir: 1 | -1) => {
    setAnchor((a) => {
      if (viewMode === "day") return addDays(a, dir);
      if (viewMode === "week") return addDays(a, dir * 7);
      const c = new Date(a);
      c.setMonth(c.getMonth() + dir);
      return c;
    });
  };

  const rangeLabel =
    viewMode === "day"
      ? anchor.toLocaleDateString("en-IN", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : viewMode === "week"
        ? `${range.days[0].toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} – ${range.days[6].toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
        : anchor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-base">Team calendar</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            {(["day", "week", "month"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs capitalize transition",
                  viewMode === v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => setAnchor(new Date())}
            >
              Today
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 text-sm font-medium">{rangeLabel}</div>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && viewMode === "month" && (
          <MonthGrid
            days={range.days}
            monthStart={range.monthStart}
            staff={staff}
            recMap={recMap}
            visitMap={visitMap}
          />
        )}
        {!isLoading && viewMode === "week" && (
          <WeekGrid days={range.days} staff={staff} recMap={recMap} visitMap={visitMap} />
        )}
        {!isLoading && viewMode === "day" && (
          <DayList date={range.days[0]} staff={staff} recMap={recMap} visitMap={visitMap} />
        )}
      </CardContent>
    </Card>
  );
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
        {isAdmin && <TeamCalendarCard />}
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
