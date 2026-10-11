"use client";

import { useActionState } from "react";
import { createStudentAction } from "@/app/actions/students";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { UserPlus, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export function AddStudentForm({
  departments,
  courses,
  semesters,
  sections,
}: {
  departments: Array<{ id: string; name: string; code: string }>;
  courses: Array<{ id: string; name: string; code: string; department_id: string }>;
  semesters: Array<{ id: string; semester_number: number; course_id: string }>;
  sections: Array<{ id: string; name: string; semester_id: string }>;
}) {
  const [state, formAction, isPending] = useActionState(createStudentAction, { success: false });

  return (
    <Card className="bg-slate-900/80 border-slate-800 text-slate-100 shadow-xl max-w-3xl mx-auto">
      <CardHeader className="border-b border-slate-800/80 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white">Enroll New Student</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Creates Supabase Auth identity, public profile, and academic curriculum record
              </CardDescription>
            </div>
          </div>
          <Link href="/dashboard/admin/students">
            <Button variant="outline" size="sm" className="border-slate-800 text-xs gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
          </Link>
        </div>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-6 pt-6">
          {state?.error && (
            <div className="p-3 text-xs bg-red-950/60 border border-red-800/60 text-red-300 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          {state?.success && (
            <div className="p-3 text-xs bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Student enrolled successfully! Credentials and academic record active.</span>
            </div>
          )}

          {/* Personal Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-indigo-300 uppercase font-mono tracking-wider">
              1. Personal & Authentication Info
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Full Name *</label>
                <Input
                  name="fullName"
                  placeholder="e.g. Gurkanwar Singh"
                  required
                  className="bg-slate-950/60 border-slate-800 text-sm"
                />
                {state?.fieldErrors?.fullName && (
                  <p className="text-xs text-red-400">{state.fieldErrors.fullName}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Email Address *</label>
                <Input
                  type="email"
                  name="email"
                  placeholder="student@college.edu"
                  required
                  className="bg-slate-950/60 border-slate-800 text-sm"
                />
                {state?.fieldErrors?.email && (
                  <p className="text-xs text-red-400">{state.fieldErrors.email}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Contact Phone</label>
                <Input
                  name="phone"
                  placeholder="+91 9876543210"
                  className="bg-slate-950/60 border-slate-800 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Initial Password *</label>
                <Input
                  type="password"
                  name="password"
                  placeholder="At least 8 characters"
                  required
                  className="bg-slate-950/60 border-slate-800 text-sm"
                />
                {state?.fieldErrors?.password && (
                  <p className="text-xs text-red-400">{state.fieldErrors.password}</p>
                )}
              </div>
            </div>
          </div>

          {/* Academic Info */}
          <div className="space-y-4 pt-4 border-t border-slate-800/80">
            <h3 className="text-sm font-semibold text-indigo-300 uppercase font-mono tracking-wider">
              2. Academic Identity & Enrollment
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Roll Number *</label>
                <Input
                  name="rollNumber"
                  placeholder="e.g. 21BCSE042"
                  required
                  className="bg-slate-950/60 border-slate-800 text-sm font-mono"
                />
                {state?.fieldErrors?.rollNumber && (
                  <p className="text-xs text-red-400">{state.fieldErrors.rollNumber}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Admission Number *</label>
                <Input
                  name="admissionNumber"
                  placeholder="e.g. ADM-2024-001"
                  required
                  className="bg-slate-950/60 border-slate-800 text-sm font-mono"
                />
                {state?.fieldErrors?.admissionNumber && (
                  <p className="text-xs text-red-400">{state.fieldErrors.admissionNumber}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Department *</label>
                <select
                  name="departmentId"
                  required
                  className="flex h-10 w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Course / Degree *</label>
                <select
                  name="courseId"
                  required
                  className="flex h-10 w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="">Select Course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Semester *</label>
                <select
                  name="semesterId"
                  required
                  className="flex h-10 w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="">Select Semester</option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>Semester {s.semester_number}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Section *</label>
                <select
                  name="sectionId"
                  required
                  className="flex h-10 w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="">Select Section</option>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>Section {sec.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
          <Link href="/dashboard/admin/students">
            <Button variant="outline" className="border-slate-800 text-xs">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={isPending}
            className="bg-indigo-600 hover:bg-indigo-500 text-xs font-medium px-6"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Provisioning Student...
              </span>
            ) : (
              "Complete Enrollment"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
