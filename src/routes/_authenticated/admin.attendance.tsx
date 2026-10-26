import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, LogIn, LogOut, Download, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/useProfile";
import { formatDate, formatTime } from "@/lib/format";
import { ATTENDANCE_STATUS_LABELS, type AttendanceRecord } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/admin/attendance")({
  component: Attendance,
});

const todayStr = () => new Date().toISOString().slice(0, 10);

function useMyAttendance(profileId: string | undefined) {
  return useQuery({
    queryKey: ["my-attendance", profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<AttendanceRecord[]> => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("profile_id", profileId!)
        .gte("date", since.toISOString().slice(0, 10))
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">My attendance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
          <div>
            <div className="text-xs text-muted-foreground">Today, {formatDate(todayStr())}</div>
            <div className="mt-1 flex items-center gap-2 text-sm">
              {today ? (
                <>
                  <StatusBadge status={today.status} />
                  <span className="text-muted-foreground">
                    In {formatTime(today.check_in)} · Out {formatTime(today.check_out)}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Not clocked in yet</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={clockIn} disabled={busy || !!today?.check_in}>
              <LogIn className="mr-1.5 h-3.5 w-3.5" /> Clock in
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={clockOut}
              disabled={busy || !today?.check_in || !!today?.check_out}
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Clock out
            </Button>
          </div>
        </div>

        {!isLoading && !!records?.length && (
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Last 7 days</div>
            {records
              .filter((r) => r.date !== todayStr())
              .map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{formatDate(r.date)}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {formatTime(r.check_in)} – {formatTime(r.check_out)}
                    </span>
                    <StatusBadge status={r.status} />
                  </span>
                </div>
              ))}
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

function TeamAttendanceCard() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const { data: rows, isLoading } = useTeamAttendance(month);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-base">Team attendance &amp; payroll report</CardTitle>
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
      <CardContent className="overflow-x-auto">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && !rows?.length && (
          <p className="text-sm text-muted-foreground">No attendance records for this month.</p>
        )}
        {!!rows?.length && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Role</th>
                <th className="pb-2 pr-4">Present</th>
                <th className="pb-2 pr-4">Half Day</th>
                <th className="pb-2 pr-4">Leave</th>
                <th className="pb-2 pr-4">Absent</th>
                <th className="pb-2">Total Hours</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.profile_id} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 pr-4 font-medium">{r.full_name}</td>
                  <td className="py-2.5 pr-4 capitalize text-muted-foreground">{r.role}</td>
                  <td className="py-2.5 pr-4">{r.counts.present ?? 0}</td>
                  <td className="py-2.5 pr-4">{r.counts.half_day ?? 0}</td>
                  <td className="py-2.5 pr-4">{r.counts.leave ?? 0}</td>
                  <td className="py-2.5 pr-4">{r.counts.absent ?? 0}</td>
                  <td className="py-2.5">{r.hours.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {legend.map(([k, v]) => (
            <span key={k}>{v}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
