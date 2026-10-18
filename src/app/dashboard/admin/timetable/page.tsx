import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { AdminTimetableView } from "@/components/dashboard/AdminTimetableView";
import { getOrCreateDraftTimetableAction } from "@/app/actions/timetable";
import { Calendar } from "lucide-react";

export const metadata = {
  title: "Smart Timetable Management & 4-View Schedule — College ERP",
};

interface TimetablePageProps {
  searchParams: Promise<{
    sectionId?: string;
    year?: string;
  }>;
}

export default async function AdminTimetablePage({ searchParams }: TimetablePageProps) {
  const user = await requireRole(["admin", "principal"]);
  const params = await searchParams;
  const supabase = await createClient();

  const selectedYear = params.year || "2026-2027";

  // 1. Fetch available departments, courses, semesters, sections, slots, rooms, and faculty
  const [deptsRes, coursesRes, semestersRes, sectionsRes, slotsRes, roomsRes, teachersRes] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name, code")
      .eq("institution_id", user.institutionId)
      .order("name", { ascending: true }),
    supabase
      .from("courses")
      .select("id, name, code, department_id")
      .eq("institution_id", user.institutionId)
      .order("name", { ascending: true }),
    supabase
      .from("semesters")
      .select("id, semester_number, course_id")
      .eq("institution_id", user.institutionId)
      .order("semester_number", { ascending: true }),
    supabase
      .from("sections")
      .select(`
        id,
        name,
        course_id,
        semester_id,
        institution_id,
        semesters (
          id,
          semester_number,
          courses (
            id,
            name,
            code
          )
        )
      `)
      .eq("institution_id", user.institutionId)
      .order("name", { ascending: true }),
    supabase
      .from("timetable_slots")
      .select("*")
      .eq("institution_id", user.institutionId)
      .order("slot_number", { ascending: true }),
    supabase
      .from("rooms")
      .select("*")
      .eq("institution_id", user.institutionId)
      .order("room_number", { ascending: true }),
    supabase
      .from("teachers")
      .select("id, employee_id, designation, min_load, max_load, profiles!inner(full_name, email)")
      .eq("institution_id", user.institutionId)
      .order("employee_id", { ascending: true }),
  ]);

  const rawSections = sectionsRes.data || [];
  const sectionList = rawSections.map((sec: any) => {
    const courseObj = Array.isArray(sec.semesters?.courses)
      ? sec.semesters?.courses[0]
      : sec.semesters?.courses;
    const semNum = sec.semesters?.semester_number;
    return {
      id: sec.id,
      name: sec.name,
      course_id: sec.course_id,
      semester_id: sec.semester_id,
      semester_number: semNum,
      course_name: courseObj?.name || "Degree Program",
      course_code: courseObj?.code || "",
    };
  });

  const departments = deptsRes.data || [];
  const courses = coursesRes.data || [];
  const semesters = semestersRes.data || [];
  const slots = slotsRes.data || [];
  const rooms = roomsRes.data || [];
  const teachers = teachersRes.data || [];

  const selectedSectionId = params.sectionId || (sectionList.length > 0 ? sectionList[0].id : undefined);

  // 2. Fetch all entries across the institution for the selected academic year to power all 4 views
  const { data: allYearEntries } = await supabase
    .from("timetable_entries")
    .select(`
      id,
      timetable_id,
      day_of_week,
      slot_number,
      subject_id,
      teacher_id,
      room_id,
      room_number,
      batch_group,
      subjects (id, name, code, type, weekly_hours),
      teachers (
        id,
        employee_id,
        profiles (full_name)
      ),
      rooms (
        id,
        room_number,
        name,
        type
      ),
      timetables!inner (
        id,
        academic_year,
        status,
        section_id,
        sections (
          id,
          name,
          semesters (
            semester_number,
            courses (
              name,
              code
            )
          )
        )
      )
    `)
    .eq("institution_id", user.institutionId)
    .eq("timetables.academic_year", selectedYear);

  // 3. If a section is selected, load or create draft timetable
  let timetable: any = null;
  let sectionEntries: any[] = [];

  if (selectedSectionId) {
    const selectedSection = sectionList.find((s) => s.id === selectedSectionId);
    if (selectedSection) {
      const draftRes = await getOrCreateDraftTimetableAction({
        academicYear: selectedYear,
        courseId: selectedSection.course_id,
        semesterId: selectedSection.semester_id,
        sectionId: selectedSection.id,
      });

      if (draftRes.success && draftRes.data) {
        const { data: tRow } = await supabase
          .from("timetables")
          .select("*")
          .eq("id", draftRes.data.timetableId)
          .single();

        timetable = tRow;

        const { data: eRows } = await supabase
          .from("timetable_entries")
          .select(`
            id,
            timetable_id,
            day_of_week,
            slot_number,
            subject_id,
            teacher_id,
            room_id,
            room_number,
            batch_group,
            subjects (id, name, code, type, weekly_hours),
            teachers (
              id,
              employee_id,
              profiles (full_name)
            ),
            rooms (
              id,
              room_number,
              name,
              type
            )
          `)
          .eq("timetable_id", draftRes.data.timetableId);

        sectionEntries = eRows || [];
      }
    }
  }

  // Phase 16: If section has no entries and is a demo fallback section, supply deterministic in-memory demo entries
  let isDemoFallback = false;
  if (selectedSectionId) {
    const selectedSec = sectionList.find((s) => s.id === selectedSectionId);
    if (selectedSec && sectionEntries.length === 0) {
      const { isDemoFallbackSection, generateDeterministicDemoEntries } = await import(
        "@/lib/timetable/sectionDemoFallback"
      );
      if (isDemoFallbackSection(selectedSec)) {
        const demoTeachers = teachers.map((t: any) => ({
          id: t.id,
          employee_id: t.employee_id,
          full_name: t.profiles?.full_name || t.employee_id,
        }));
        const demoRooms = rooms.map((r: any) => ({
          id: r.id,
          room_number: r.room_number,
          name: r.name,
          type: r.type,
        }));

        sectionEntries = generateDeterministicDemoEntries({
          section: selectedSec,
          teachers: demoTeachers,
          rooms: demoRooms,
          academicYear: selectedYear,
        });
        isDemoFallback = true;
      }
    }
  }

  // 4. Check readiness criteria for selected section
  let readiness = {
    hasSlots: slots.length > 0,
    slotsCount: slots.length,
    hasSubjects: false,
    subjectsCount: 0,
    hasTeacherAssignments: false,
    teacherAssignmentsCount: 0,
    hasRooms: rooms.length > 0,
    roomsCount: rooms.length,
    missingDetails: [] as string[],
    isReady: false,
    sectionSubjects: [] as any[],
    sectionAssignments: [] as any[],
  };

  const selectedSection = sectionList.find((s) => s.id === selectedSectionId);

  if (selectedSection) {
    const [subsRes, teacherSubsRes] = await Promise.all([
      supabase
        .from("subjects")
        .select("id, name, code, type, weekly_hours")
        .eq("institution_id", user.institutionId)
        .eq("course_id", selectedSection.course_id)
        .eq("semester_id", selectedSection.semester_id),
      supabase
        .from("teacher_subjects")
        .select(`
          id,
          subject_id,
          teacher_id,
          subjects (id, name, code, type, weekly_hours),
          teachers (
            id,
            employee_id,
            designation,
            min_load,
            max_load,
            profiles (full_name)
          )
        `)
        .eq("institution_id", user.institutionId)
        .eq("section_id", selectedSection.id),
    ]);

    const subs = subsRes.data || [];
    const teacherSubs = teacherSubsRes.data || [];

    readiness.subjectsCount = subs.length;
    readiness.hasSubjects = subs.length > 0;
    readiness.teacherAssignmentsCount = teacherSubs.length;
    readiness.hasTeacherAssignments = teacherSubs.length > 0;
    readiness.sectionSubjects = subs;
    readiness.sectionAssignments = teacherSubs;

    if (!readiness.hasSlots) {
      readiness.missingDetails.push("Institution time periods are not configured.");
    }
    if (!readiness.hasSubjects) {
      readiness.missingDetails.push("No subjects configured for this course and semester.");
    }
    if (!readiness.hasTeacherAssignments) {
      readiness.missingDetails.push("No teachers assigned to teach this section's subjects.");
    }
    if (!readiness.hasRooms) {
      readiness.missingDetails.push("No classrooms or laboratories configured.");
    }

    readiness.isReady =
      readiness.hasSlots && readiness.hasSubjects && readiness.hasTeacherAssignments && readiness.hasRooms;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-bold tracking-tight text-white">
              College Timetable Engine & Multi-View Schedule
            </h1>
          </div>
          <p className="text-slate-400 text-xs pt-1">
            Resource-aware schedule generator with CLASS WISE, LAB WISE, ROOM WISE, and FACULTY views matching reference TT.
          </p>
        </div>

        <AdminTimetableView
          initialTimetable={timetable}
          slots={slots}
          entries={sectionEntries}
          allYearEntries={allYearEntries || []}
          departments={departments}
          courses={courses}
          semesters={semesters}
          sections={sectionList}
          rooms={rooms}
          teachers={teachers}
          academicYears={["2026-2027", "2025-2026", "2024-2025"]}
          selectedSectionId={selectedSectionId}
          selectedAcademicYear={selectedYear}
          readiness={readiness}
          isDemoFallback={isDemoFallback}
        />
      </main>
    </div>
  );
}
