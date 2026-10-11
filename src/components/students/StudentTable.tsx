import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StudentListItem } from "@/lib/students/types";
import { Eye, ChevronLeft, ChevronRight, UserX, UserCheck } from "lucide-react";

export function StudentTable({
  students,
  total,
  page,
  pageSize,
  totalPages,
}: {
  students: StudentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-xs uppercase font-mono text-slate-400">
              <tr>
                <th className="py-3.5 px-4">Student</th>
                <th className="py-3.5 px-4">Roll No</th>
                <th className="py-3.5 px-4">Admission</th>
                <th className="py-3.5 px-4">Branch & Section</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                    No students match the criteria. Try clearing search filters.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-200">{student.profiles?.full_name}</div>
                      <div className="text-xs text-slate-400 font-mono">{student.profiles?.email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-indigo-300">
                      {student.roll_number}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                      {student.admission_number}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-xs text-slate-300">
                        {student.courses?.code || "Course"} • Sem {student.semesters?.semester_number}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Section {student.sections?.name}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {student.is_dropped ? (
                        <Badge variant="destructive" className="text-[10px]">Dropped</Badge>
                      ) : student.profiles?.status === "active" ? (
                        <Badge variant="success" className="text-[10px]">Enrolled</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link href={`/dashboard/admin/students/${student.id}`}>
                        <Button variant="outline" size="sm" className="border-slate-800 text-xs h-8 px-2.5 gap-1">
                          <Eye className="w-3.5 h-3.5" /> View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 text-xs text-slate-400">
        <div>
          Showing <span className="text-slate-200 font-medium">{students.length}</span> of{" "}
          <span className="text-slate-200 font-medium">{total}</span> total students
        </div>

        <div className="flex items-center gap-2">
          <span>Page {page} of {Math.max(1, totalPages)}</span>
          <div className="flex items-center gap-1">
            <Link
              href={page > 1 ? `?page=${page - 1}` : "#"}
              className={page <= 1 ? "pointer-events-none opacity-40" : ""}
            >
              <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-800" disabled={page <= 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </Link>
            <Link
              href={page < totalPages ? `?page=${page + 1}` : "#"}
              className={page >= totalPages ? "pointer-events-none opacity-40" : ""}
            >
              <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-800" disabled={page >= totalPages}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
