"use client";

import { useState } from "react";
import { setStudentStatusAction } from "@/app/actions/students";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudentListItem } from "@/lib/students/types";
import { User, Mail, Phone, Calendar, BookOpen, AlertCircle, Loader2, UserX, UserCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";

export function StudentProfileView({
  student,
  canManage,
}: {
  student: StudentListItem;
  canManage: boolean;
}) {
  const [isPending, setIsPending] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const handleStatusChange = async (action: "deactivate" | "activate" | "drop" | "reinstate") => {
    setIsPending(true);
    setActionMessage(null);
    try {
      const res = await setStudentStatusAction(student.id, action);
      if (res.success) {
        setActionMessage(`Action '${action}' applied successfully.`);
        window.location.reload();
      } else {
        setActionMessage(res.error || "Action failed.");
      }
    } catch (err: unknown) {
      setActionMessage(err instanceof Error ? err.message : "Error executing action.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/admin/students">
          <Button variant="outline" size="sm" className="border-slate-800 text-xs gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Students
          </Button>
        </Link>
      </div>

      {actionMessage && (
        <div className="p-3 text-xs bg-slate-900 border border-slate-800 text-slate-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Main Profile Card */}
      <Card className="bg-slate-900/80 border-slate-800 text-slate-100 shadow-xl overflow-hidden">
        <CardHeader className="bg-slate-950/60 border-b border-slate-800 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-indigo-600/30">
                {student.profiles?.full_name?.charAt(0) || "S"}
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-white">
                  {student.profiles?.full_name}
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs font-mono pt-0.5">
                  Admission: {student.admission_number} • Roll: {student.roll_number}
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {student.is_dropped ? (
                <Badge variant="destructive" className="text-xs">Dropped Student</Badge>
              ) : student.profiles?.status === "active" ? (
                <Badge variant="success" className="text-xs">Active Enrolled</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">Account Deactivated</Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Academic Info */}
          <div>
            <h4 className="text-xs font-semibold text-indigo-300 uppercase font-mono tracking-wider mb-3">
              Academic Curriculum Affiliation
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
                <span className="text-[11px] text-slate-500 font-mono">Department</span>
                <p className="text-sm font-medium text-slate-200">{student.departments?.name || "N/A"}</p>
                <p className="text-[10px] text-slate-400 font-mono">{student.departments?.code}</p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
                <span className="text-[11px] text-slate-500 font-mono">Degree / Course</span>
                <p className="text-sm font-medium text-slate-200">{student.courses?.name || "N/A"}</p>
                <p className="text-[10px] text-slate-400 font-mono">{student.courses?.code}</p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
                <span className="text-[11px] text-slate-500 font-mono">Semester</span>
                <p className="text-sm font-medium text-slate-200">Semester {student.semesters?.semester_number || "N/A"}</p>
                <p className="text-[10px] text-slate-400">Current Term</p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
                <span className="text-[11px] text-slate-500 font-mono">Class Section</span>
                <p className="text-sm font-medium text-slate-200">Section {student.sections?.name || "N/A"}</p>
                <p className="text-[10px] text-slate-400">Division Assignment</p>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div>
            <h4 className="text-xs font-semibold text-indigo-300 uppercase font-mono tracking-wider mb-3">
              Contact & Profile Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <span className="text-[11px] text-slate-500 block">Email Address</span>
                  <span className="text-xs font-mono text-slate-200">{student.profiles?.email}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <span className="text-[11px] text-slate-500 block">Contact Phone</span>
                  <span className="text-xs text-slate-200">{student.profiles?.phone || "Not provided"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status Controls for Authorized Administrators */}
          {canManage && (
            <div className="pt-4 border-t border-slate-800/80">
              <h4 className="text-xs font-semibold text-indigo-300 uppercase font-mono tracking-wider mb-3">
                Account Status Governance
              </h4>
              <div className="flex flex-wrap items-center gap-3">
                {student.profiles?.status === "active" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleStatusChange("deactivate")}
                    className="border-red-900/60 text-red-300 hover:bg-red-950/40 text-xs gap-1.5"
                  >
                    <UserX className="w-3.5 h-3.5" /> Deactivate Account
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleStatusChange("activate")}
                    className="border-emerald-900/60 text-emerald-300 hover:bg-emerald-950/40 text-xs gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Re-activate Account
                  </Button>
                )}

                {student.is_dropped ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleStatusChange("reinstate")}
                    className="border-slate-800 text-xs text-slate-300"
                  >
                    Reinstate Dropped Status
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleStatusChange("drop")}
                    className="border-slate-800 text-xs text-amber-400 hover:bg-amber-950/30"
                  >
                    Mark as Dropped
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
