import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowLeft, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";
import { TIMETABLE_DAYS } from "@/lib/timetable/generator";

export const metadata = {
  title: "My Teaching Schedule — College ERP",
};

export default async function TeacherTimetablePage() {
  const user = await requireRole(["teacher", "admin"]);
  const supabase = await createClient();

  // 1. Fetch configured slots
  const { data: slots } = await supabase
    .from("timetable_slots")
    .select("*")
    .eq("institution_id", user.institutionId)
    .order("slot_number", { ascending: true });

  const slotList = slots || [];

  // 2. Fetch published entries assigned to this teacher
  const { data: entries, error } = await supabase
    .from("timetable_entries")
    .select(`
      id,
      day_of_week,
      slot_number,
      room_number,
      subjects (id, name, code, type),
      timetables!inner (
        id,
        status,
        academic_year,
        sections (name)
      )
    `)
    .eq("teacher_id", user.userId)
    .eq("timetables.status", "published");

  const entryList = entries || [];

  // Map entries for matrix display
  const entryMatrix = new Map<string, any>();
  entryList.forEach((e: any) => {
    entryMatrix.set(`${e.day_of_week}_${e.slot_number}`, e);
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/teacher">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white p-2">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <Calendar className="w-6 h-6 text-indigo-400" />
              <h1 className="text-2xl font-bold tracking-tight text-white">Faculty Teaching Schedule</h1>
            </div>
            <p className="text-slate-400 text-xs pt-1">
              Personal weekly teaching timetable across all assigned class cohorts.
            </p>
          </div>

          <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
            {entryList.length} Weekly Teaching Periods
          </Badge>
        </div>

        {error && (
          <div className="p-4 bg-rose-950/60 border border-rose-800/60 text-rose-300 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Failed to query schedule: {error.message}</span>
          </div>
        )}

        {/* Weekly Timetable Grid */}
        {entryList.length === 0 ? (
          <Card className="bg-slate-900/60 border-slate-800 py-16 text-center text-slate-500 text-sm">
            <Clock className="w-10 h-10 mx-auto text-slate-600 mb-3 opacity-50" />
            <p className="text-slate-400 font-medium">No published teaching schedule found.</p>
            <p className="text-xs text-slate-500 pt-1">
              Once administration publishes the class timetable, your personal teaching periods will appear here.
            </p>
          </Card>
        ) : (
          <Card className="bg-slate-900/90 border-slate-800 overflow-hidden shadow-2xl">
            <CardHeader className="border-b border-slate-800/80 pb-3">
              <CardTitle className="text-sm font-semibold text-white">Weekly Class Matrix</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/90 border-b border-slate-800 font-mono text-slate-400">
                    <th className="py-3 px-3 w-28 text-center uppercase border-r border-slate-800/80">Day / Period</th>
                    {slotList.map((s) => (
                      <th
                        key={s.id}
                        className={`py-2 px-2.5 text-center border-r border-slate-800/60 min-w-36 ${
                          s.is_break ? "bg-amber-950/20 text-amber-400/80" : ""
                        }`}
                      >
                        <div className="font-semibold text-slate-200">{s.label}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {TIMETABLE_DAYS.slice(0, 5).map((day) => (
                    <tr key={day} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-3 px-3 text-center uppercase font-bold text-indigo-300 bg-slate-950/50 border-r border-slate-800/80">
                        {day}
                      </td>
                      {slotList.map((s) => {
                        if (s.is_break) {
                          return (
                            <td
                              key={s.id}
                              className="p-2 text-center bg-amber-950/10 text-amber-500/50 border-r border-slate-800/60 text-[11px] font-sans"
                            >
                              <span className="italic">{s.label}</span>
                            </td>
                          );
                        }

                        const entry = entryMatrix.get(`${day}_${s.slot_number}`);
                        return (
                          <td key={s.id} className="p-2 border-r border-slate-800/60 align-top">
                            {entry ? (
                              <div className="bg-slate-950/80 border border-slate-800 p-2 rounded-lg font-sans space-y-1 shadow-sm">
                                <div className="font-bold text-slate-100 truncate text-xs">
                                  {entry.subjects?.name || "Subject"}
                                </div>
                                <div className="text-[11px] text-indigo-300 font-mono truncate">
                                  {entry.subjects?.code || "—"}
                                </div>
                                <div className="text-[11px] text-emerald-400 truncate">
                                  Section {entry.timetables?.sections?.name || "Cohort"}
                                </div>
                                {entry.room_number && (
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    {entry.room_number}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="h-14 border border-dashed border-slate-800/50 rounded-lg flex items-center justify-center text-slate-600 text-[11px]">
                                —
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
