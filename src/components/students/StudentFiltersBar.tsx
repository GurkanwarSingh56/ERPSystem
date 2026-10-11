"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, X } from "lucide-react";

export function StudentFiltersBar({
  departments,
  courses,
}: {
  departments: Array<{ id: string; name: string; code: string }>;
  courses: Array<{ id: string; name: string; code: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [dept, setDept] = useState(searchParams.get("departmentId") || "");
  const [course, setCourse] = useState(searchParams.get("courseId") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "all");

  const handleApply = () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (dept) params.set("departmentId", dept);
    if (course) params.set("courseId", course);
    if (status && status !== "all") params.set("status", status);
    params.set("page", "1");

    router.push(`?${params.toString()}`);
  };

  const handleReset = () => {
    setSearch("");
    setDept("");
    setCourse("");
    setStatus("all");
    router.push("?");
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Search roll/admission..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
            className="pl-9 bg-slate-950/70 border-slate-800 text-sm"
          />
        </div>

        {/* Department Filter */}
        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          className="flex h-10 w-full rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.code})
            </option>
          ))}
        </select>

        {/* Course Filter */}
        <select
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          className="flex h-10 w-full rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <option value="">All Courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="flex h-10 w-full rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Enrolled</option>
          <option value="dropped">Dropped</option>
        </select>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="border-slate-800 text-slate-400 hover:text-slate-200 text-xs"
        >
          <X className="w-3.5 h-3.5 mr-1" /> Clear
        </Button>
        <Button
          size="sm"
          onClick={handleApply}
          className="bg-indigo-600 hover:bg-indigo-500 text-xs"
        >
          <Filter className="w-3.5 h-3.5 mr-1" /> Apply Filters
        </Button>
      </div>
    </div>
  );
}
