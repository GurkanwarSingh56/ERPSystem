import Link from "next/link";
import { TeacherListItem, PaginatedResult } from "@/lib/teachers/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, User, Eye, Mail, Phone, BookOpen } from "lucide-react";

interface TeacherTableProps {
  paginatedData: PaginatedResult<TeacherListItem>;
  searchParams: Record<string, string | undefined>;
}

export function TeacherTable({ paginatedData, searchParams }: TeacherTableProps) {
  const { data: teachers, total, page, totalPages } = paginatedData;

  const createPageUrl = (targetPage: number) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    params.set("page", targetPage.toString());
    return `?${params.toString()}`;
  };

  if (teachers.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 text-center space-y-3">
        <User className="w-10 h-10 text-slate-500 mx-auto" />
        <h3 className="text-base font-semibold text-slate-200">No faculty members found</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          No faculty matched the selected filters. Try broadening your search or enroll a new faculty member.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Faculty Member</th>
                <th className="px-5 py-3.5">Employee ID</th>
                <th className="px-5 py-3.5">Department</th>
                <th className="px-5 py-3.5">Designation</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {teachers.map((teacher) => {
                const profile = teacher.profiles;
                const dept = teacher.departments;
                const isActive = profile?.status === "active";

                return (
                  <tr key={teacher.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-950/80 border border-indigo-700/50 flex items-center justify-center text-indigo-300 font-medium text-xs">
                          {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "T"}
                        </div>
                        <div>
                          <div className="font-medium text-white">{profile?.full_name || "Unknown"}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-500" />
                              {profile?.email}
                            </span>
                            {profile?.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-500" />
                                {profile.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-indigo-300">
                      {teacher.employee_id}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-slate-200">{dept?.name || "Unassigned"}</div>
                      <div className="text-xs text-slate-500 font-mono">{dept?.code}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-300 font-medium">
                      {teacher.designation}
                    </td>
                    <td className="px-5 py-4">
                      {isActive ? (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-xs">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 text-xs">
                          Inactive
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/dashboard/admin/teachers/${teacher.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-300 hover:text-white hover:bg-slate-800 text-xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 px-1">
        <div>
          Showing <span className="font-medium text-slate-200">{teachers.length}</span> of{" "}
          <span className="font-medium text-slate-200">{total}</span> total faculty members
        </div>

        <div className="flex items-center gap-2">
          <span>
            Page <span className="font-medium text-slate-200">{page}</span> of{" "}
            <span className="font-medium text-slate-200">{totalPages || 1}</span>
          </span>

          <div className="flex items-center gap-1">
            <Link href={page > 1 ? createPageUrl(page - 1) : "#"}>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                className="h-8 border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
            </Link>

            <Link href={page < totalPages ? createPageUrl(page + 1) : "#"}>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                className="h-8 border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
