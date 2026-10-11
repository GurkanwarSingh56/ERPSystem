"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createTeacherAction, TeacherActionResponse } from "@/app/actions/teachers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, ArrowLeft, UserPlus, Shield } from "lucide-react";
import Link from "next/link";

interface AddTeacherFormProps {
  departments: Array<{ id: string; name: string; code: string }>;
}

const initialState: TeacherActionResponse = {
  success: false,
};

export function AddTeacherForm({ departments }: AddTeacherFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createTeacherAction, initialState);
  const [selectedDept, setSelectedDept] = useState("");

  useEffect(() => {
    if (state.success && state.teacherId) {
      router.push(`/dashboard/admin/teachers/${state.teacherId}`);
    }
  }, [state, router]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/admin/teachers">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-900 cursor-pointer">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Faculty Directory
          </Button>
        </Link>
      </div>

      <Card className="bg-slate-900/90 border-slate-800 shadow-xl">
        <CardHeader className="border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white">Enroll New Faculty Member</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Creates an authenticated staff identity, public profile, and faculty academic record.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {state.error && (
            <div className="mb-6 p-4 rounded-lg bg-red-950/40 border border-red-800/60 flex items-start gap-3 text-red-200 text-sm">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Failed to enroll faculty</p>
                <p className="text-xs text-red-300/80 mt-0.5">{state.error}</p>
              </div>
            </div>
          )}

          {state.success && (
            <div className="mb-6 p-4 rounded-lg bg-emerald-950/40 border border-emerald-800/60 flex items-start gap-3 text-emerald-200 text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Faculty Member Enrolled Successfully!</p>
                <p className="text-xs text-emerald-300/80 mt-0.5">Redirecting to faculty profile...</p>
              </div>
            </div>
          )}

          <form action={formAction} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Personal & Account Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <Input
                    name="fullName"
                    placeholder="e.g. Dr. Arvinder Singh"
                    required
                    className="bg-slate-950/80 border-slate-800 text-slate-100"
                  />
                  {state.fieldErrors?.fullName && (
                    <p className="text-xs text-red-400 mt-1">{state.fieldErrors.fullName}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                    Institutional Email <span className="text-red-400">*</span>
                  </label>
                  <Input
                    type="email"
                    name="email"
                    placeholder="arvinder.singh@campus.edu"
                    required
                    className="bg-slate-950/80 border-slate-800 text-slate-100"
                  />
                  {state.fieldErrors?.email && (
                    <p className="text-xs text-red-400 mt-1">{state.fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                    Phone Number
                  </label>
                  <Input
                    type="tel"
                    name="phone"
                    placeholder="+91 98765 43210"
                    className="bg-slate-950/80 border-slate-800 text-slate-100"
                  />
                  {state.fieldErrors?.phone && (
                    <p className="text-xs text-red-400 mt-1">{state.fieldErrors.phone}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                    Temporary Password <span className="text-red-400">*</span>
                  </label>
                  <Input
                    type="password"
                    name="password"
                    placeholder="Min. 8 characters"
                    required
                    className="bg-slate-950/80 border-slate-800 text-slate-100"
                  />
                  {state.fieldErrors?.password && (
                    <p className="text-xs text-red-400 mt-1">{state.fieldErrors.password}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-800">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Departmental & Academic Hierarchy
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                    Employee ID <span className="text-red-400">*</span>
                  </label>
                  <Input
                    name="employeeId"
                    placeholder="e.g. EMP-CSE-012"
                    required
                    className="bg-slate-950/80 border-slate-800 text-slate-100 uppercase"
                  />
                  {state.fieldErrors?.employeeId && (
                    <p className="text-xs text-red-400 mt-1">{state.fieldErrors.employeeId}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                    Academic Designation <span className="text-red-400">*</span>
                  </label>
                  <Input
                    name="designation"
                    placeholder="e.g. Associate Professor, HOD, Assistant Professor"
                    required
                    className="bg-slate-950/80 border-slate-800 text-slate-100"
                  />
                  {state.fieldErrors?.designation && (
                    <p className="text-xs text-red-400 mt-1">{state.fieldErrors.designation}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                    Department <span className="text-red-400">*</span>
                  </label>
                  <select
                    name="departmentId"
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    required
                    className="w-full h-10 rounded-md border border-slate-800 bg-slate-950/80 px-3 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Select Academic Department...</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                  {state.fieldErrors?.departmentId && (
                    <p className="text-xs text-red-400 mt-1">{state.fieldErrors.departmentId}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>Tenant isolation & RBAC automatically enforced.</span>
              </div>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 cursor-pointer"
              >
                {isPending ? "Creating Faculty Record..." : "Confirm & Enroll Faculty"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
