"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RotateCcw } from "lucide-react";

interface TeacherFiltersBarProps {
  departments: Array<{ id: string; name: string; code: string }>;
}

export function TeacherFiltersBar({ departments }: TeacherFiltersBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [departmentId, setDepartmentId] = useState(searchParams.get("departmentId") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "all");

  const applyFilters = (
    newSearch: string,
    newDept: string,
    newStatus: string
  ) => {
    const params = new URLSearchParams(searchParams.toString());

    if (newSearch.trim()) {
      params.set("search", newSearch.trim());
    } else {
      params.delete("search");
    }

    if (newDept) {
      params.set("departmentId", newDept);
    } else {
      params.delete("departmentId");
    }

    if (newStatus && newStatus !== "all") {
      params.set("status", newStatus);
    } else {
      params.delete("status");
    }

    params.set("page", "1");

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(search, departmentId, status);
  };

  const handleReset = () => {
    setSearch("");
    setDepartmentId("");
    setStatus("all");
    startTransition(() => {
      router.push(pathname);
    });
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
      <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by faculty name, employee ID, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-950/60 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500"
          />
        </div>
        <Button
          type="submit"
          disabled={isPending}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 cursor-pointer"
        >
          {isPending ? "Searching..." : "Search"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          className="border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 mr-2 text-slate-400" />
          Reset
        </Button>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800/60">
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1 block">Department</label>
          <select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              applyFilters(search, e.target.value, status);
            }}
            className="w-full h-9 rounded-md border border-slate-800 bg-slate-950/80 px-3 py-1 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name} ({dept.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-400 mb-1 block">Employment Status</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              applyFilters(search, departmentId, e.target.value);
            }}
            className="w-full h-9 rounded-md border border-slate-800 bg-slate-950/80 px-3 py-1 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Faculty</option>
            <option value="inactive">Inactive Faculty</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>
    </div>
  );
}
