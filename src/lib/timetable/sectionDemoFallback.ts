/**
 * Deterministic Demo Timetable Fallback Generator (Phase 16)
 * Generates plausible synthetic demo timetables for sections where real
 * curriculum allocations are missing or infeasible.
 *
 * Rules:
 * - Uses existing teachers from the college database (no staff invented)
 * - Uses existing rooms from the college database (classrooms for theory, labs for practical)
 * - Never schedules classes during lunch break (slot 5: 12:20 - 13:10)
 * - 5 working days: Monday to Friday
 * - Consecutive double periods for lab/practicals
 * - Zero collisions within the section
 * - Deterministic pseudo-random seed based on section ID so refreshing is predictable
 * - Purely in-memory preview (never persisted to database as official records)
 * - B.Voc is strictly excluded
 */

export interface DemoSectionInfo {
  id: string;
  name: string;
  course_code: string;
  semester_number: number;
}

export interface DemoTeacherInfo {
  id: string;
  employee_id: string;
  full_name: string;
}

export interface DemoRoomInfo {
  id: string;
  room_number: string;
  name?: string;
  type: string;
}

interface SyntheticSubjectSpec {
  code: string;
  name: string;
  type: "theory" | "practical";
  weeklyHours: number;
}

const SECTION_SUBJECT_SPECS: Record<string, SyntheticSubjectSpec[]> = {
  // AI/ML Semester 1
  "AIML_S1": [
    { code: "DEMO_AI101", name: "(Demo) Introduction to Artificial Intelligence", type: "theory", weeklyHours: 3 },
    { code: "DEMO_MTH101", name: "(Demo) Applied Mathematics & Linear Algebra", type: "theory", weeklyHours: 3 },
    { code: "DEMO_PHY101", name: "(Demo) Engineering Physics", type: "theory", weeklyHours: 3 },
    { code: "DEMO_ENG101", name: "(Demo) Professional Communication Skills", type: "theory", weeklyHours: 3 },
    { code: "DEMO_EE101", name: "(Demo) Basic Electrical Engineering", type: "theory", weeklyHours: 3 },
    { code: "DEMO_AI101P", name: "(Demo) AI & Python Programming Lab", type: "practical", weeklyHours: 2 },
  ],
  // CSE Semester 7
  "CSE_S7": [
    { code: "DEMO_CS701", name: "(Demo) Software Project Management", type: "theory", weeklyHours: 3 },
    { code: "DEMO_CS702", name: "(Demo) Data Mining & Warehousing", type: "theory", weeklyHours: 3 },
    { code: "DEMO_CS703", name: "(Demo) Ad-hoc & Wireless Sensor Networks", type: "theory", weeklyHours: 3 },
    { code: "DEMO_CS704", name: "(Demo) Network Security & Cryptography", type: "theory", weeklyHours: 3 },
    { code: "DEMO_CS705", name: "(Demo) Cloud Computing & DevOps", type: "theory", weeklyHours: 3 },
    { code: "DEMO_CS701P", name: "(Demo) Advanced Project & Network Lab", type: "practical", weeklyHours: 2 },
  ],
  // CS/DS Semester 1
  "CS/DS_S1": [
    { code: "DEMO_DS101", name: "(Demo) Introduction to Data Science", type: "theory", weeklyHours: 3 },
    { code: "DEMO_MTH101", name: "(Demo) Mathematical Foundations for Data Science", type: "theory", weeklyHours: 3 },
    { code: "DEMO_CS101", name: "(Demo) Programming for Problem Solving", type: "theory", weeklyHours: 3 },
    { code: "DEMO_ENG101", name: "(Demo) Technical Communication", type: "theory", weeklyHours: 3 },
    { code: "DEMO_DS101P", name: "(Demo) Data Science & Python Lab", type: "practical", weeklyHours: 2 },
  ],
  // CS/DS Semester 3
  "CS/DS_S3": [
    { code: "DEMO_DS301", name: "(Demo) Data Structures & Algorithms", type: "theory", weeklyHours: 4 },
    { code: "DEMO_DS302", name: "(Demo) Statistical Inference for Data Science", type: "theory", weeklyHours: 3 },
    { code: "DEMO_DS303", name: "(Demo) Object Oriented Programming", type: "theory", weeklyHours: 3 },
    { code: "DEMO_DS304", name: "(Demo) Database Management Systems", type: "theory", weeklyHours: 3 },
    { code: "DEMO_DS301P", name: "(Demo) Data Structures & Algorithms Lab", type: "practical", weeklyHours: 2 },
  ],
  // CS/DS Semester 5
  "CS/DS_S5": [
    { code: "DEMO_DS501", name: "(Demo) Big Data Analytics & Pipelines", type: "theory", weeklyHours: 4 },
    { code: "DEMO_DS502", name: "(Demo) Machine Learning & Predictive Modeling", type: "theory", weeklyHours: 3 },
    { code: "DEMO_DS503", name: "(Demo) Data Visualization & Business Intelligence", type: "theory", weeklyHours: 3 },
    { code: "DEMO_DS504", name: "(Demo) Cloud Data Warehousing", type: "theory", weeklyHours: 3 },
    { code: "DEMO_DS501P", name: "(Demo) Big Data Analytics Lab", type: "practical", weeklyHours: 2 },
  ],
  // IT Semester 1
  "IT_S1": [
    { code: "DEMO_IT101", name: "(Demo) Information Technology Foundations", type: "theory", weeklyHours: 3 },
    { code: "DEMO_MTH101", name: "(Demo) Engineering Mathematics I", type: "theory", weeklyHours: 3 },
    { code: "DEMO_CS101", name: "(Demo) Fundamentals of Computing & C", type: "theory", weeklyHours: 3 },
    { code: "DEMO_PHY101", name: "(Demo) Applied Physics for IT", type: "theory", weeklyHours: 3 },
    { code: "DEMO_IT101P", name: "(Demo) Computing & IT Workshop Lab", type: "practical", weeklyHours: 2 },
  ],
  // IT Semester 3
  "IT_S3": [
    { code: "DEMO_IT301", name: "(Demo) Data Structures using C++", type: "theory", weeklyHours: 4 },
    { code: "DEMO_IT302", name: "(Demo) Digital Systems & Architecture", type: "theory", weeklyHours: 3 },
    { code: "DEMO_IT303", name: "(Demo) Web Technologies & Frameworks", type: "theory", weeklyHours: 3 },
    { code: "DEMO_IT304", name: "(Demo) Discrete Mathematical Structures", type: "theory", weeklyHours: 3 },
    { code: "DEMO_IT301P", name: "(Demo) Web Development & DS Lab", type: "practical", weeklyHours: 2 },
  ],
  // IT Semester 5
  "IT_S5": [
    { code: "DEMO_IT501", name: "(Demo) Computer Networks & Protocols", type: "theory", weeklyHours: 4 },
    { code: "DEMO_IT502", name: "(Demo) Software Engineering Methodologies", type: "theory", weeklyHours: 3 },
    { code: "DEMO_IT503", name: "(Demo) Information & Cyber Security", type: "theory", weeklyHours: 3 },
    { code: "DEMO_IT504", name: "(Demo) Mobile Application Development", type: "theory", weeklyHours: 3 },
    { code: "DEMO_IT501P", name: "(Demo) Network Simulation & Security Lab", type: "practical", weeklyHours: 2 },
  ],
  // IT Semester 7
  "IT_S7": [
    { code: "DEMO_IT701", name: "(Demo) Enterprise Cloud Architecture", type: "theory", weeklyHours: 3 },
    { code: "DEMO_IT702", name: "(Demo) Distributed & Edge Computing", type: "theory", weeklyHours: 3 },
    { code: "DEMO_IT703", name: "(Demo) Cyber Forensics & Defense", type: "theory", weeklyHours: 3 },
    { code: "DEMO_IT704", name: "(Demo) Internet of Things & Embedded Systems", type: "theory", weeklyHours: 3 },
    { code: "DEMO_IT701P", name: "(Demo) Capstone Project & Cloud Lab", type: "practical", weeklyHours: 2 },
  ],
};

// Simple deterministic hash / seed generator
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Pseudo-random number generator with deterministic seed
function createDeterministicRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Checks if a section requires the synthetic demo timetable fallback.
 */
export function isDemoFallbackSection(section: {
  id: string;
  course_code?: string;
  semester_number?: number;
  name?: string;
}): boolean {
  const code = (section.course_code || "").toUpperCase();
  const sem = section.semester_number;

  // Phase 17: IT S1 Section A is kept labelled as incomplete / demo fallback until joint-class mapping is resolved.
  if ((code === "IT" || code.includes("INFORMATION")) && sem === 1) {
    return true;
  }

  // All other configured sections now have official curriculum allocations and real timetables
  return false;
}

/**
 * Generates deterministic in-memory timetable entries for a demo section.
 */
export function generateDeterministicDemoEntries(params: {
  section: DemoSectionInfo;
  teachers: DemoTeacherInfo[];
  rooms: DemoRoomInfo[];
  academicYear?: string;
}): any[] {
  const { section, teachers, rooms, academicYear = "2026-2027" } = params;

  // Determine key for subject specifications
  const courseKey = (section.course_code || "CSE").toUpperCase();
  const semKey = section.semester_number || 1;
  const lookupKey = `${courseKey}_S${semKey}`;

  const specs = SECTION_SUBJECT_SPECS[lookupKey] || [
    { code: `DEMO_${courseKey}${semKey}01`, name: `(Demo) Core Subject 1`, type: "theory", weeklyHours: 4 },
    { code: `DEMO_${courseKey}${semKey}02`, name: `(Demo) Core Subject 2`, type: "theory", weeklyHours: 3 },
    { code: `DEMO_${courseKey}${semKey}03`, name: `(Demo) Core Subject 3`, type: "theory", weeklyHours: 3 },
    { code: `DEMO_${courseKey}${semKey}04`, name: `(Demo) Elective Subject`, type: "theory", weeklyHours: 3 },
    { code: `DEMO_${courseKey}${semKey}P`, name: `(Demo) Practical Lab`, type: "practical", weeklyHours: 2 },
  ];

  const seed = hashString(`${section.id}-${section.name}-${section.course_code}`);
  const rng = createDeterministicRandom(seed);

  // Divide available rooms into classrooms and labs
  const classroomPool = rooms.filter((r) => r.type === "classroom" || !r.type);
  const labPool = rooms.filter((r) => r.type === "lab");
  const defaultClassroom = classroomPool.length > 0
    ? classroomPool[Math.floor(rng() * classroomPool.length)]
    : { id: "room-default", room_number: "B-101B", name: "B-101B", type: "classroom" };
  const defaultLab = labPool.length > 0
    ? labPool[Math.floor(rng() * labPool.length)]
    : { id: "room-lab-default", room_number: "CL-3", name: "CL-3", type: "lab" };

  // Assign teachers from the real list
  const teacherList = teachers.length > 0
    ? teachers
    : [{ id: "fac-default", employee_id: "FAC101", full_name: "Dr. Faculty" }];

  const subjectAllocations = specs.map((spec, idx) => {
    // Pick real teacher with deterministic offset
    const teacherIdx = (Math.floor(seed / 7) + idx) % teacherList.length;
    const teacher = teacherList[teacherIdx];
    const room = spec.type === "practical" ? defaultLab : defaultClassroom;

    return {
      spec,
      teacher,
      room,
    };
  });

  // Valid slots (1, 2, 3, 4 morning; 6, 7, 8, 9 afternoon). Slot 5 is NEVER scheduled (lunch).
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
  const morningSlots = [1, 2, 3, 4];
  const afternoonSlots = [6, 7, 8, 9];

  // Grid occupation tracker [day][slot] = boolean
  const occupied: Record<string, Record<number, boolean>> = {};
  days.forEach((d) => {
    occupied[d] = {};
    [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((slot) => {
      occupied[d][slot] = false;
    });
    // Slot 5 is break / lunch — unconditionally occupied/blocked
    occupied[d][5] = true;
  });

  const entries: any[] = [];

  // 1. Schedule practical/lab sessions first (must be consecutive 2 slots)
  const practicals = subjectAllocations.filter((a) => a.spec.type === "practical");
  practicals.forEach((p, pIdx) => {
    // Choose Wednesday (day 2) or Friday (day 4)
    const targetDay = pIdx === 0 ? days[2] : days[4];
    // Use slots 1-2 or slots 6-7
    const startSlot = (seed + pIdx) % 2 === 0 ? 1 : 6;
    const endSlot = startSlot + 1;

    for (let slot = startSlot; slot <= endSlot; slot++) {
      occupied[targetDay][slot] = true;
      entries.push({
        id: `demo-entry-${section.id}-${targetDay}-${slot}`,
        institution_id: "00000000-0000-0000-0000-000000000001",
        timetable_id: `demo-tt-${section.id}`,
        section_id: section.id,
        subject_id: `demo-sub-${p.spec.code}`,
        teacher_id: p.teacher.id,
        room_id: p.room.id,
        room_number: p.room.room_number,
        day_of_week: targetDay,
        slot_number: slot,
        batch_group: "G1",
        is_demo: true,
        subjects: {
          id: `demo-sub-${p.spec.code}`,
          code: p.spec.code,
          name: p.spec.name,
          type: "practical",
          weekly_hours: p.spec.weeklyHours,
        },
        teachers: {
          id: p.teacher.id,
          employee_id: p.teacher.employee_id,
          profiles: {
            full_name: p.teacher.full_name,
          },
        },
        rooms: {
          id: p.room.id,
          room_number: p.room.room_number,
          name: p.room.name || p.room.room_number,
          type: "lab",
        },
        timetables: {
          id: `demo-tt-${section.id}`,
          academic_year: academicYear,
          status: "draft",
          section_id: section.id,
          sections: {
            id: section.id,
            name: section.name,
          },
        },
      });
    }
  });

  // 2. Schedule theory subjects across available periods
  const theories = subjectAllocations.filter((a) => a.spec.type === "theory");
  theories.forEach((t) => {
    let hoursToSchedule = t.spec.weeklyHours;
    // Spread across different days if possible
    for (const day of days) {
      if (hoursToSchedule <= 0) break;

      // Find first free slot in morning or afternoon (skipping slot 5 lunch)
      const availableSlots = [...morningSlots, ...afternoonSlots].filter((s) => !occupied[day][s]);
      if (availableSlots.length > 0) {
        // Pick deterministically
        const slotIdx = (seed + hoursToSchedule) % availableSlots.length;
        const chosenSlot = availableSlots[slotIdx];

        occupied[day][chosenSlot] = true;
        hoursToSchedule--;

        entries.push({
          id: `demo-entry-${section.id}-${day}-${chosenSlot}`,
          institution_id: "00000000-0000-0000-0000-000000000001",
          timetable_id: `demo-tt-${section.id}`,
          section_id: section.id,
          subject_id: `demo-sub-${t.spec.code}`,
          teacher_id: t.teacher.id,
          room_id: t.room.id,
          room_number: t.room.room_number,
          day_of_week: day,
          slot_number: chosenSlot,
          batch_group: null,
          is_demo: true,
          subjects: {
            id: `demo-sub-${t.spec.code}`,
            code: t.spec.code,
            name: t.spec.name,
            type: "theory",
            weekly_hours: t.spec.weeklyHours,
          },
          teachers: {
            id: t.teacher.id,
            employee_id: t.teacher.employee_id,
            profiles: {
              full_name: t.teacher.full_name,
            },
          },
          rooms: {
            id: t.room.id,
            room_number: t.room.room_number,
            name: t.room.name || t.room.room_number,
            type: "classroom",
          },
          timetables: {
            id: `demo-tt-${section.id}`,
            academic_year: academicYear,
            status: "draft",
            section_id: section.id,
            sections: {
              id: section.id,
              name: section.name,
            },
          },
        });
      }
    }
  });

  return entries;
}
