/**
 * Synthetic Demo Dataset Fixture for Timetable End-to-End Testing (Phase 14.4.3).
 * Completely isolated from real academic records.
 *
 * Structure:
 * - 2 Departments: Computer Science (DEMO_CSE) and Artificial Intelligence (DEMO_AIML)
 * - 2 Semesters per Dept: Sem 3 & Sem 5
 * - 2 Sections per Semester: Sec A & Sec B (8 sections total)
 * - 8 Synthetic Faculty members (DEMO_FAC_001 to DEMO_FAC_008) with realistic load limits
 * - 4 Classrooms (DEMO_ROOM_101 to DEMO_ROOM_104) and 2 Labs (DEMO_LAB_01, DEMO_LAB_02)
 * - 1 Combined-Class lecture (DEMO_SEMD5_COMB) shared across CSE & AIML
 * - 2-Period consecutive Lab blocks (DEMO_DS_LAB, DEMO_AI_LAB, etc.)
 */

export interface DemoSection {
  id: string;
  name: string;
  dept_code: string;
  course_code: string;
  semester_number: number;
}

export interface DemoTeacher {
  id: string;
  name: string;
  faculty_id: string;
  specialization: string;
  max_weekly_load: number;
}

export interface DemoRoom {
  id: string;
  room_number: string;
  name: string;
  type: "classroom" | "lab" | "seminar_hall" | "other";
  capacity: number;
  is_available: boolean;
}

export interface DemoSubject {
  id: string;
  code: string;
  name: string;
  type: "theory" | "practical";
  weekly_hours: number;
}

export interface DemoAllocation {
  section_id: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  subject_type: "theory" | "practical";
  teacher_id: string;
  teacher_name: string;
  weekly_hours: number;
  batch_group?: string | null;
  combined_with_section_id?: string | null;
}

// 1. Departments
export const DEMO_DEPARTMENTS = [
  { id: "demo-dept-cse", name: "Computer Science & Engineering", code: "DEMO_CSE" },
  { id: "demo-dept-aiml", name: "Artificial Intelligence & ML", code: "DEMO_AIML" },
];

// 2. Sections (8 sections: 2 depts x 2 semesters x 2 sections)
export const DEMO_SECTIONS: DemoSection[] = [
  // CSE Sem 3
  { id: "demo-sec-cse-3a", name: "Section A", dept_code: "DEMO_CSE", course_code: "B.Tech CSE", semester_number: 3 },
  { id: "demo-sec-cse-3b", name: "Section B", dept_code: "DEMO_CSE", course_code: "B.Tech CSE", semester_number: 3 },
  // CSE Sem 5
  { id: "demo-sec-cse-5a", name: "Section A", dept_code: "DEMO_CSE", course_code: "B.Tech CSE", semester_number: 5 },
  { id: "demo-sec-cse-5b", name: "Section B", dept_code: "DEMO_CSE", course_code: "B.Tech CSE", semester_number: 5 },
  // AIML Sem 3
  { id: "demo-sec-aiml-3a", name: "Section A", dept_code: "DEMO_AIML", course_code: "B.Tech AI/ML", semester_number: 3 },
  { id: "demo-sec-aiml-3b", name: "Section B", dept_code: "DEMO_AIML", course_code: "B.Tech AI/ML", semester_number: 3 },
  // AIML Sem 5
  { id: "demo-sec-aiml-5a", name: "Section A", dept_code: "DEMO_AIML", course_code: "B.Tech AI/ML", semester_number: 5 },
  { id: "demo-sec-aiml-5b", name: "Section B", dept_code: "DEMO_AIML", course_code: "B.Tech AI/ML", semester_number: 5 },
];

// 3. Synthetic Faculty (8 instructors with realistic workload caps)
export const DEMO_FACULTY: DemoTeacher[] = [
  { id: "demo-fac-001", faculty_id: "DEMO_FAC_001", name: "Dr. Alice Turing", specialization: "Algorithms & DS", max_weekly_load: 18 },
  { id: "demo-fac-002", faculty_id: "DEMO_FAC_002", name: "Dr. Bob Shannon", specialization: "Networks & Security", max_weekly_load: 18 },
  { id: "demo-fac-003", faculty_id: "DEMO_FAC_003", name: "Prof. Carol Hopper", specialization: "Databases & Web", max_weekly_load: 18 },
  { id: "demo-fac-004", faculty_id: "DEMO_FAC_004", name: "Dr. David Knuth", specialization: "Software Eng & OS", max_weekly_load: 18 },
  { id: "demo-fac-005", faculty_id: "DEMO_FAC_005", name: "Dr. Elena McCarthy", specialization: "AI & Machine Learning", max_weekly_load: 18 },
  { id: "demo-fac-006", faculty_id: "DEMO_FAC_006", name: "Prof. Felix Hinton", specialization: "Deep Learning & NLP", max_weekly_load: 18 },
  { id: "demo-fac-007", faculty_id: "DEMO_FAC_007", name: "Ms. Grace Lovelace", specialization: "Soft Skills & Ethics", max_weekly_load: 16 },
  { id: "demo-fac-008", faculty_id: "DEMO_FAC_008", name: "Mr. Hector Dijkstra", specialization: "Aptitude & Math", max_weekly_load: 16 },
];

// 4. Classrooms & Laboratories
export const DEMO_ROOMS: DemoRoom[] = [
  { id: "demo-room-101", room_number: "DEMO_R101", name: "Demo Lecture Hall 101", type: "classroom", capacity: 60, is_available: true },
  { id: "demo-room-102", room_number: "DEMO_R102", name: "Demo Lecture Hall 102", type: "classroom", capacity: 60, is_available: true },
  { id: "demo-room-103", room_number: "DEMO_R103", name: "Demo Lecture Hall 103", type: "classroom", capacity: 60, is_available: true },
  { id: "demo-room-104", room_number: "DEMO_R104", name: "Demo Lecture Hall 104", type: "classroom", capacity: 60, is_available: true },
  { id: "demo-lab-01", room_number: "DEMO_LAB_01", name: "Demo Computing Lab 1", type: "lab", capacity: 35, is_available: true },
  { id: "demo-lab-02", room_number: "DEMO_LAB_02", name: "Demo AI & Networks Lab 2", type: "lab", capacity: 35, is_available: true },
];

// 5. Official College Slots (9:00 - 16:30, Break 12:20 - 13:10)
export const DEMO_SLOTS = [
  { slot_number: 1, start_time: "09:00:00", end_time: "09:50:00", is_break: false, label: "Period 1" },
  { slot_number: 2, start_time: "09:50:00", end_time: "10:40:00", is_break: false, label: "Period 2" },
  { slot_number: 3, start_time: "10:40:00", end_time: "11:30:00", is_break: false, label: "Period 3" },
  { slot_number: 4, start_time: "11:30:00", end_time: "12:20:00", is_break: false, label: "Period 4" },
  { slot_number: 5, start_time: "12:20:00", end_time: "13:10:00", is_break: true, label: "Recess / Lunch" },
  { slot_number: 6, start_time: "13:10:00", end_time: "14:00:00", is_break: false, label: "Period 5" },
  { slot_number: 7, start_time: "14:00:00", end_time: "14:50:00", is_break: false, label: "Period 6" },
  { slot_number: 8, start_time: "14:50:00", end_time: "15:40:00", is_break: false, label: "Period 7" },
  { slot_number: 9, start_time: "15:40:00", end_time: "16:30:00", is_break: false, label: "Period 8" },
];

// 6. Realistic Teaching Allocation Matrix
// Each section has 16-20 total weekly periods (well within 40 available periods).
// Includes 2-period lab blocks (practical) and combined-class lecture.
export const DEMO_ALLOCATIONS: DemoAllocation[] = [
  // --- CSE Sem 3 Sec A (18 periods) ---
  { section_id: "demo-sec-cse-3a", subject_id: "demo-sub-ds", subject_code: "DEMO_CS301", subject_name: "Data Structures", subject_type: "theory", teacher_id: "demo-fac-001", teacher_name: "Dr. Alice Turing", weekly_hours: 4 },
  { section_id: "demo-sec-cse-3a", subject_id: "demo-sub-dslab", subject_code: "DEMO_CS301P", subject_name: "Data Structures Lab", subject_type: "practical", teacher_id: "demo-fac-001", teacher_name: "Dr. Alice Turing", weekly_hours: 2, batch_group: "G1" },
  { section_id: "demo-sec-cse-3a", subject_id: "demo-sub-dc", subject_code: "DEMO_CS302", subject_name: "Digital Circuits", subject_type: "theory", teacher_id: "demo-fac-002", teacher_name: "Dr. Bob Shannon", weekly_hours: 3 },
  { section_id: "demo-sec-cse-3a", subject_id: "demo-sub-se", subject_code: "DEMO_CS303", subject_name: "Software Engineering", subject_type: "theory", teacher_id: "demo-fac-004", teacher_name: "Dr. David Knuth", weekly_hours: 3 },
  { section_id: "demo-sec-cse-3a", subject_id: "demo-sub-math", subject_code: "DEMO_MATH3", subject_name: "Discrete Mathematics", subject_type: "theory", teacher_id: "demo-fac-008", teacher_name: "Mr. Hector Dijkstra", weekly_hours: 3 },
  { section_id: "demo-sec-cse-3a", subject_id: "demo-sub-ss", subject_code: "DEMO_SS3", subject_name: "Soft Skills & Communication", subject_type: "theory", teacher_id: "demo-fac-007", teacher_name: "Ms. Grace Lovelace", weekly_hours: 3 },

  // --- CSE Sem 3 Sec B (18 periods) ---
  { section_id: "demo-sec-cse-3b", subject_id: "demo-sub-ds", subject_code: "DEMO_CS301", subject_name: "Data Structures", subject_type: "theory", teacher_id: "demo-fac-001", teacher_name: "Dr. Alice Turing", weekly_hours: 4 },
  { section_id: "demo-sec-cse-3b", subject_id: "demo-sub-dslab", subject_code: "DEMO_CS301P", subject_name: "Data Structures Lab", subject_type: "practical", teacher_id: "demo-fac-001", teacher_name: "Dr. Alice Turing", weekly_hours: 2, batch_group: "G2" },
  { section_id: "demo-sec-cse-3b", subject_id: "demo-sub-dc", subject_code: "DEMO_CS302", subject_name: "Digital Circuits", subject_type: "theory", teacher_id: "demo-fac-002", teacher_name: "Dr. Bob Shannon", weekly_hours: 3 },
  { section_id: "demo-sec-cse-3b", subject_id: "demo-sub-se", subject_code: "DEMO_CS303", subject_name: "Software Engineering", subject_type: "theory", teacher_id: "demo-fac-004", teacher_name: "Dr. David Knuth", weekly_hours: 3 },
  { section_id: "demo-sec-cse-3b", subject_id: "demo-sub-math", subject_code: "DEMO_MATH3", subject_name: "Discrete Mathematics", subject_type: "theory", teacher_id: "demo-fac-008", teacher_name: "Mr. Hector Dijkstra", weekly_hours: 3 },
  { section_id: "demo-sec-cse-3b", subject_id: "demo-sub-ss", subject_code: "DEMO_SS3", subject_name: "Soft Skills & Communication", subject_type: "theory", teacher_id: "demo-fac-007", teacher_name: "Ms. Grace Lovelace", weekly_hours: 3 },

  // --- CSE Sem 5 Sec A (18 periods) ---
  { section_id: "demo-sec-cse-5a", subject_id: "demo-sub-dbms", subject_code: "DEMO_CS501", subject_name: "Database Systems", subject_type: "theory", teacher_id: "demo-fac-003", teacher_name: "Prof. Carol Hopper", weekly_hours: 4 },
  { section_id: "demo-sec-cse-5a", subject_id: "demo-sub-dbmslab", subject_code: "DEMO_CS501P", subject_name: "Database Systems Lab", subject_type: "practical", teacher_id: "demo-fac-003", teacher_name: "Prof. Carol Hopper", weekly_hours: 2, batch_group: "G1" },
  { section_id: "demo-sec-cse-5a", subject_id: "demo-sub-cn", subject_code: "DEMO_CS502", subject_name: "Computer Networks", subject_type: "theory", teacher_id: "demo-fac-002", teacher_name: "Dr. Bob Shannon", weekly_hours: 3 },
  { section_id: "demo-sec-cse-5a", subject_id: "demo-sub-os", subject_code: "DEMO_CS503", subject_name: "Operating Systems", subject_type: "theory", teacher_id: "demo-fac-004", teacher_name: "Dr. David Knuth", weekly_hours: 3 },
  { section_id: "demo-sec-cse-5a", subject_id: "demo-sub-ethics", subject_code: "DEMO_ETH5", subject_name: "Professional Ethics & Values", subject_type: "theory", teacher_id: "demo-fac-007", teacher_name: "Ms. Grace Lovelace", weekly_hours: 3 },
  { section_id: "demo-sec-cse-5a", subject_id: "demo-sub-apt", subject_code: "DEMO_APT5", subject_name: "Quantitative Aptitude", subject_type: "theory", teacher_id: "demo-fac-008", teacher_name: "Mr. Hector Dijkstra", weekly_hours: 3 },

  // --- CSE Sem 5 Sec B (18 periods) ---
  { section_id: "demo-sec-cse-5b", subject_id: "demo-sub-dbms", subject_code: "DEMO_CS501", subject_name: "Database Systems", subject_type: "theory", teacher_id: "demo-fac-003", teacher_name: "Prof. Carol Hopper", weekly_hours: 4 },
  { section_id: "demo-sec-cse-5b", subject_id: "demo-sub-dbmslab", subject_code: "DEMO_CS501P", subject_name: "Database Systems Lab", subject_type: "practical", teacher_id: "demo-fac-003", teacher_name: "Prof. Carol Hopper", weekly_hours: 2, batch_group: "G2" },
  { section_id: "demo-sec-cse-5b", subject_id: "demo-sub-cn", subject_code: "DEMO_CS502", subject_name: "Computer Networks", subject_type: "theory", teacher_id: "demo-fac-002", teacher_name: "Dr. Bob Shannon", weekly_hours: 3 },
  { section_id: "demo-sec-cse-5b", subject_id: "demo-sub-os", subject_code: "DEMO_CS503", subject_name: "Operating Systems", subject_type: "theory", teacher_id: "demo-fac-004", teacher_name: "Dr. David Knuth", weekly_hours: 3 },
  { section_id: "demo-sec-cse-5b", subject_id: "demo-sub-ethics", subject_code: "DEMO_ETH5", subject_name: "Professional Ethics & Values", subject_type: "theory", teacher_id: "demo-fac-007", teacher_name: "Ms. Grace Lovelace", weekly_hours: 3 },
  { section_id: "demo-sec-cse-5b", subject_id: "demo-sub-apt", subject_code: "DEMO_APT5", subject_name: "Quantitative Aptitude", subject_type: "theory", teacher_id: "demo-fac-008", teacher_name: "Mr. Hector Dijkstra", weekly_hours: 3 },

  // --- AIML Sem 3 Sec A (18 periods) ---
  { section_id: "demo-sec-aiml-3a", subject_id: "demo-sub-aiintro", subject_code: "DEMO_AI301", subject_name: "Intro to Artificial Intelligence", subject_type: "theory", teacher_id: "demo-fac-005", teacher_name: "Dr. Elena McCarthy", weekly_hours: 4 },
  { section_id: "demo-sec-aiml-3a", subject_id: "demo-sub-ailab", subject_code: "DEMO_AI301P", subject_name: "AI & Python Lab", subject_type: "practical", teacher_id: "demo-fac-005", teacher_name: "Dr. Elena McCarthy", weekly_hours: 2, batch_group: "G1" },
  { section_id: "demo-sec-aiml-3a", subject_id: "demo-sub-ds", subject_code: "DEMO_CS301", subject_name: "Data Structures", subject_type: "theory", teacher_id: "demo-fac-001", teacher_name: "Dr. Alice Turing", weekly_hours: 3 },
  { section_id: "demo-sec-aiml-3a", subject_id: "demo-sub-math", subject_code: "DEMO_MATH3", subject_name: "Discrete Mathematics", subject_type: "theory", teacher_id: "demo-fac-008", teacher_name: "Mr. Hector Dijkstra", weekly_hours: 3 },
  { section_id: "demo-sec-aiml-3a", subject_id: "demo-sub-wt", subject_code: "DEMO_WT3", subject_name: "Web Technologies", subject_type: "theory", teacher_id: "demo-fac-003", teacher_name: "Prof. Carol Hopper", weekly_hours: 3 },
  { section_id: "demo-sec-aiml-3a", subject_id: "demo-sub-ss", subject_code: "DEMO_SS3", subject_name: "Soft Skills & Communication", subject_type: "theory", teacher_id: "demo-fac-007", teacher_name: "Ms. Grace Lovelace", weekly_hours: 3 },

  // --- AIML Sem 3 Sec B (18 periods) ---
  { section_id: "demo-sec-aiml-3b", subject_id: "demo-sub-aiintro", subject_code: "DEMO_AI301", subject_name: "Intro to Artificial Intelligence", subject_type: "theory", teacher_id: "demo-fac-005", teacher_name: "Dr. Elena McCarthy", weekly_hours: 4 },
  { section_id: "demo-sec-aiml-3b", subject_id: "demo-sub-ailab", subject_code: "DEMO_AI301P", subject_name: "AI & Python Lab", subject_type: "practical", teacher_id: "demo-fac-005", teacher_name: "Dr. Elena McCarthy", weekly_hours: 2, batch_group: "G2" },
  { section_id: "demo-sec-aiml-3b", subject_id: "demo-sub-ds", subject_code: "DEMO_CS301", subject_name: "Data Structures", subject_type: "theory", teacher_id: "demo-fac-001", teacher_name: "Dr. Alice Turing", weekly_hours: 3 },
  { section_id: "demo-sec-aiml-3b", subject_id: "demo-sub-math", subject_code: "DEMO_MATH3", subject_name: "Discrete Mathematics", subject_type: "theory", teacher_id: "demo-fac-008", teacher_name: "Mr. Hector Dijkstra", weekly_hours: 3 },
  { section_id: "demo-sec-aiml-3b", subject_id: "demo-sub-wt", subject_code: "DEMO_WT3", subject_name: "Web Technologies", subject_type: "theory", teacher_id: "demo-fac-003", teacher_name: "Prof. Carol Hopper", weekly_hours: 3 },
  { section_id: "demo-sec-aiml-3b", subject_id: "demo-sub-ss", subject_code: "DEMO_SS3", subject_name: "Soft Skills & Communication", subject_type: "theory", teacher_id: "demo-fac-007", teacher_name: "Ms. Grace Lovelace", weekly_hours: 3 },

  // --- AIML Sem 5 Sec A (18 periods) ---
  { section_id: "demo-sec-aiml-5a", subject_id: "demo-sub-ml", subject_code: "DEMO_AI501", subject_name: "Machine Learning Foundations", subject_type: "theory", teacher_id: "demo-fac-006", teacher_name: "Prof. Felix Hinton", weekly_hours: 4 },
  { section_id: "demo-sec-aiml-5a", subject_id: "demo-sub-mllab", subject_code: "DEMO_AI501P", subject_name: "Machine Learning Lab", subject_type: "practical", teacher_id: "demo-fac-006", teacher_name: "Prof. Felix Hinton", weekly_hours: 2, batch_group: "G1" },
  { section_id: "demo-sec-aiml-5a", subject_id: "demo-sub-nlp", subject_code: "DEMO_AI502", subject_name: "Natural Language Processing", subject_type: "theory", teacher_id: "demo-fac-005", teacher_name: "Dr. Elena McCarthy", weekly_hours: 3 },
  { section_id: "demo-sec-aiml-5a", subject_id: "demo-sub-dbms", subject_code: "DEMO_CS501", subject_name: "Database Systems", subject_type: "theory", teacher_id: "demo-fac-003", teacher_name: "Prof. Carol Hopper", weekly_hours: 3 },
  { section_id: "demo-sec-aiml-5a", subject_id: "demo-sub-ethics", subject_code: "DEMO_ETH5", subject_name: "Professional Ethics & Values", subject_type: "theory", teacher_id: "demo-fac-007", teacher_name: "Ms. Grace Lovelace", weekly_hours: 3 },
  { section_id: "demo-sec-aiml-5a", subject_id: "demo-sub-apt", subject_code: "DEMO_APT5", subject_name: "Quantitative Aptitude", subject_type: "theory", teacher_id: "demo-fac-008", teacher_name: "Mr. Hector Dijkstra", weekly_hours: 3 },

  // --- AIML Sem 5 Sec B (18 periods) ---
  { section_id: "demo-sec-aiml-5b", subject_id: "demo-sub-ml", subject_code: "DEMO_AI501", subject_name: "Machine Learning Foundations", subject_type: "theory", teacher_id: "demo-fac-006", teacher_name: "Prof. Felix Hinton", weekly_hours: 4 },
  { section_id: "demo-sec-aiml-5b", subject_id: "demo-sub-mllab", subject_code: "DEMO_AI501P", subject_name: "Machine Learning Lab", subject_type: "practical", teacher_id: "demo-fac-006", teacher_name: "Prof. Felix Hinton", weekly_hours: 2, batch_group: "G2" },
  { section_id: "demo-sec-aiml-5b", subject_id: "demo-sub-nlp", subject_code: "DEMO_AI502", subject_name: "Natural Language Processing", subject_type: "theory", teacher_id: "demo-fac-005", teacher_name: "Dr. Elena McCarthy", weekly_hours: 3 },
  { section_id: "demo-sec-aiml-5b", subject_id: "demo-sub-dbms", subject_code: "DEMO_CS501", subject_name: "Database Systems", subject_type: "theory", teacher_id: "demo-fac-003", teacher_name: "Prof. Carol Hopper", weekly_hours: 3 },
  { section_id: "demo-sec-aiml-5b", subject_id: "demo-sub-ethics", subject_code: "DEMO_ETH5", subject_name: "Professional Ethics & Values", subject_type: "theory", teacher_id: "demo-fac-007", teacher_name: "Ms. Grace Lovelace", weekly_hours: 3 },
  { section_id: "demo-sec-aiml-5b", subject_id: "demo-sub-apt", subject_code: "DEMO_APT5", subject_name: "Quantitative Aptitude", subject_type: "theory", teacher_id: "demo-fac-008", teacher_name: "Mr. Hector Dijkstra", weekly_hours: 3 },
];

/**
 * Returns a fully populated solver payload for the synthetic demo dataset.
 */
export function getDemoSolverPayload() {
  return {
    sections: DEMO_SECTIONS.map((s) => ({ id: s.id, name: `${s.course_code} S${s.semester_number} - ${s.name}` })),
    slots: DEMO_SLOTS.map((s) => ({ slot_number: s.slot_number, is_break: s.is_break })),
    rooms: DEMO_ROOMS.map((r) => ({
      id: r.id,
      room_number: r.room_number,
      type: r.type,
      is_available: r.is_available,
    })),
    working_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    allocations: DEMO_ALLOCATIONS,
    preferences: {
      max_theory_per_day: 1,
      allow_consecutive_theory: false,
    },
    max_solve_time_seconds: 30.0,
  };
}
