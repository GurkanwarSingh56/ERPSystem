export type TimetableDay = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";
export type TimetableStatus = "draft" | "published" | "archived";

export interface TimetableSlot {
  id: string;
  institution_id: string;
  slot_number: number;
  start_time: string;
  end_time: string;
  is_break: boolean;
  label: string;
}

export interface RoomResource {
  id: string;
  room_number: string;
  name?: string | null;
  type: "classroom" | "lab" | "seminar_hall" | "other";
  capacity: number;
  is_available: boolean;
  requires_consecutive_slots: boolean;
}

export interface TimetableEntry {
  id?: string;
  timetable_id: string;
  day_of_week: TimetableDay;
  slot_number: number;
  subject_id: string;
  teacher_id: string;
  room_id?: string | null;
  room_number?: string | null;
  batch_group?: string | null; // e.g. "G1", "G2" matching TT reference
  subjects?: {
    id: string;
    name: string;
    code: string;
    type: string;
    weekly_hours?: number;
  };
  teachers?: {
    id: string;
    employee_id: string;
    profiles?: {
      full_name: string;
    };
  };
  rooms?: {
    id: string;
    room_number: string;
    name?: string | null;
    type: string;
  };
  sections?: {
    id: string;
    name: string;
    courses?: {
      code: string;
      name: string;
    };
    semesters?: {
      semester_number: number;
    };
  };
}

export interface SubjectAllocationRequirement {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  subject_type: string; // 'theory' | 'practical' | 'both'
  teacher_id: string;
  teacher_name: string;
  weekly_periods: number; // Required periods per week
  preferred_room_type?: "classroom" | "lab";
  batch_group?: string | null;
}

export interface TimetableConflict {
  type:
    | "TEACHER_DOUBLE_BOOKING"
    | "SECTION_DOUBLE_BOOKING"
    | "ROOM_DOUBLE_BOOKING"
    | "LAB_DOUBLE_BOOKING"
    | "BREAK_VIOLATION"
    | "UNAUTHORIZED_TEACHER"
    | "WORKLOAD_OVERFLOW";
  day: TimetableDay;
  slot_number: number;
  message: string;
}

export interface GeneratorResult {
  success: boolean;
  entries: TimetableEntry[];
  unassignedSubjects: {
    subject_code: string;
    subject_name: string;
    remaining_periods: number;
    reason: string;
  }[];
  conflicts: TimetableConflict[];
}

export const TIMETABLE_DAYS: TimetableDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/**
 * Enhanced Constraint-based Timetable Generator:
 * Features:
 * 1. Strict Conflict Avoidance: Teacher, Section, Classroom, and Lab double-booking prevention.
 * 2. Lab Consecutive Slots: Automatically schedules labs (practical) into pairs of consecutive periods.
 * 3. Break/Lunch Protection: Preserves breaks with 0 classes placed.
 * 4. Balanced Daily Distribution: Spreads subjects across days.
 * 5. Multi-View Derivation Ready: Assigns both room_id and room_number for CLASS WISE, LAB WISE, ROOM WISE, FACULTY views.
 */
export function generateTimetableSchedule(params: {
  timetableId: string;
  slots: TimetableSlot[];
  workingDays: TimetableDay[];
  allocations: SubjectAllocationRequirement[];
  rooms?: RoomResource[];
  existingTeacherBusySlots?: {
    teacher_id: string;
    day: TimetableDay;
    slot_number: number;
  }[];
  existingRoomBusySlots?: {
    room_id?: string | null;
    room_number?: string | null;
    day: TimetableDay;
    slot_number: number;
  }[];
  defaultRoomNumber?: string;
}): GeneratorResult {
  const {
    timetableId,
    slots,
    workingDays,
    allocations,
    rooms = [],
    existingTeacherBusySlots = [],
    existingRoomBusySlots = [],
    defaultRoomNumber = "Room-101",
  } = params;

  // Filter teachable periods (exclude breaks)
  const teachableSlots = slots
    .filter((s) => !s.is_break)
    .sort((a, b) => a.slot_number - b.slot_number);

  const entries: TimetableEntry[] = [];
  const conflicts: TimetableConflict[] = [];

  // Teacher Busy Registry: teacherId_day_slot
  const teacherSchedule = new Set<string>();
  existingTeacherBusySlots.forEach((busy) => {
    teacherSchedule.add(`${busy.teacher_id}_${busy.day}_${busy.slot_number}`);
  });

  // Section Busy Registry: day_slot
  const sectionSchedule = new Set<string>();

  // Room Busy Registry: roomId/roomNum_day_slot
  const roomSchedule = new Set<string>();
  existingRoomBusySlots.forEach((busy) => {
    if (busy.room_id) roomSchedule.add(`id_${busy.room_id}_${busy.day}_${busy.slot_number}`);
    if (busy.room_number) roomSchedule.add(`num_${busy.room_number.toUpperCase()}_${busy.day}_${busy.slot_number}`);
  });

  // Available classrooms and labs
  const classrooms = rooms.filter((r) => r.is_available && r.type !== "lab");
  const labs = rooms.filter((r) => r.is_available && r.type === "lab");

  // Track daily load per subject
  const subjectDayCount = new Map<string, number>();
  const unassignedSubjects: GeneratorResult["unassignedSubjects"] = [];

  // Sort allocations: Labs first (consecutive periods needed), then theory
  const sortedAllocations = [...allocations].sort((a, b) => {
    const isLabA = a.subject_type === "practical";
    const isLabB = b.subject_type === "practical";
    if (isLabA && !isLabB) return -1;
    if (!isLabA && isLabB) return 1;
    return b.weekly_periods - a.weekly_periods;
  });

  for (const alloc of sortedAllocations) {
    let remaining = alloc.weekly_periods;
    const isLab = alloc.subject_type === "practical";
    const eligibleRooms = isLab ? (labs.length > 0 ? labs : classrooms) : (classrooms.length > 0 ? classrooms : rooms);

    // If Lab requires consecutive periods (2 slots block)
    if (isLab && remaining >= 2) {
      for (const day of workingDays) {
        if (remaining < 2) break;

        const dayKey = `${alloc.subject_id}_${day}`;
        if ((subjectDayCount.get(dayKey) || 0) >= 2) continue;

        // Search for consecutive slots on this day
        for (let sIdx = 0; sIdx < teachableSlots.length - 1; sIdx++) {
          if (remaining < 2) break;

          const slot1 = teachableSlots[sIdx];
          const slot2 = teachableSlots[sIdx + 1];

          // Must be strictly adjacent in time without a break in between
          if (slot2.slot_number !== slot1.slot_number + 1) continue;

          const secKey1 = `${day}_${slot1.slot_number}`;
          const secKey2 = `${day}_${slot2.slot_number}`;
          if (sectionSchedule.has(secKey1) || sectionSchedule.has(secKey2)) continue;

          const teachKey1 = `${alloc.teacher_id}_${day}_${slot1.slot_number}`;
          const teachKey2 = `${alloc.teacher_id}_${day}_${slot2.slot_number}`;
          if (teacherSchedule.has(teachKey1) || teacherSchedule.has(teachKey2)) continue;

          // Find an available lab for both consecutive slots
          let chosenRoom: RoomResource | null = null;
          for (const room of eligibleRooms) {
            const rKey1 = `id_${room.id}_${day}_${slot1.slot_number}`;
            const rKey2 = `id_${room.id}_${day}_${slot2.slot_number}`;
            const rNumKey1 = `num_${room.room_number.toUpperCase()}_${day}_${slot1.slot_number}`;
            const rNumKey2 = `num_${room.room_number.toUpperCase()}_${day}_${slot2.slot_number}`;

            if (!roomSchedule.has(rKey1) && !roomSchedule.has(rKey2) &&
                !roomSchedule.has(rNumKey1) && !roomSchedule.has(rNumKey2)) {
              chosenRoom = room;
              break;
            }
          }

          if (!chosenRoom && eligibleRooms.length > 0) continue;

          // Commit consecutive double period
          const rId = chosenRoom?.id || null;
          const rNum = chosenRoom?.room_number || defaultRoomNumber;

          sectionSchedule.add(secKey1);
          sectionSchedule.add(secKey2);
          teacherSchedule.add(teachKey1);
          teacherSchedule.add(teachKey2);

          if (chosenRoom) {
            roomSchedule.add(`id_${chosenRoom.id}_${day}_${slot1.slot_number}`);
            roomSchedule.add(`id_${chosenRoom.id}_${day}_${slot2.slot_number}`);
            roomSchedule.add(`num_${chosenRoom.room_number.toUpperCase()}_${day}_${slot1.slot_number}`);
            roomSchedule.add(`num_${chosenRoom.room_number.toUpperCase()}_${day}_${slot2.slot_number}`);
          }

          subjectDayCount.set(dayKey, (subjectDayCount.get(dayKey) || 0) + 2);

          // Entry 1
          entries.push({
            timetable_id: timetableId,
            day_of_week: day,
            slot_number: slot1.slot_number,
            subject_id: alloc.subject_id,
            teacher_id: alloc.teacher_id,
            room_id: rId,
            room_number: rNum,
            batch_group: alloc.batch_group || "G1",
            subjects: {
              id: alloc.subject_id,
              name: alloc.subject_name,
              code: alloc.subject_code,
              type: alloc.subject_type,
            },
          });

          // Entry 2
          entries.push({
            timetable_id: timetableId,
            day_of_week: day,
            slot_number: slot2.slot_number,
            subject_id: alloc.subject_id,
            teacher_id: alloc.teacher_id,
            room_id: rId,
            room_number: rNum,
            batch_group: alloc.batch_group || "G1",
            subjects: {
              id: alloc.subject_id,
              name: alloc.subject_name,
              code: alloc.subject_code,
              type: alloc.subject_type,
            },
          });

          remaining -= 2;
        }
      }
    }

    // Schedule remaining single periods (Theory or leftover lab hours)
    for (const day of workingDays) {
      if (remaining <= 0) break;

      const dayKey = `${alloc.subject_id}_${day}`;
      const currentOnDay = subjectDayCount.get(dayKey) || 0;
      if (currentOnDay >= 2) continue;

      for (const slot of teachableSlots) {
        if (remaining <= 0) break;

        const secKey = `${day}_${slot.slot_number}`;
        if (sectionSchedule.has(secKey)) continue;

        const teachKey = `${alloc.teacher_id}_${day}_${slot.slot_number}`;
        if (teacherSchedule.has(teachKey)) continue;

        // Find available room
        let chosenRoom: RoomResource | null = null;
        for (const room of eligibleRooms) {
          const rKey = `id_${room.id}_${day}_${slot.slot_number}`;
          const rNumKey = `num_${room.room_number.toUpperCase()}_${day}_${slot.slot_number}`;
          if (!roomSchedule.has(rKey) && !roomSchedule.has(rNumKey)) {
            chosenRoom = room;
            break;
          }
        }

        if (!chosenRoom && eligibleRooms.length > 0) continue;

        sectionSchedule.add(secKey);
        teacherSchedule.add(teachKey);
        if (chosenRoom) {
          roomSchedule.add(`id_${chosenRoom.id}_${day}_${slot.slot_number}`);
          roomSchedule.add(`num_${chosenRoom.room_number.toUpperCase()}_${day}_${slot.slot_number}`);
        }
        subjectDayCount.set(dayKey, (subjectDayCount.get(dayKey) || 0) + 1);

        entries.push({
          timetable_id: timetableId,
          day_of_week: day,
          slot_number: slot.slot_number,
          subject_id: alloc.subject_id,
          teacher_id: alloc.teacher_id,
          room_id: chosenRoom?.id || null,
          room_number: chosenRoom?.room_number || defaultRoomNumber,
          batch_group: alloc.batch_group || null,
          subjects: {
            id: alloc.subject_id,
            name: alloc.subject_name,
            code: alloc.subject_code,
            type: alloc.subject_type,
          },
        });

        remaining--;
      }
    }

    if (remaining > 0) {
      unassignedSubjects.push({
        subject_code: alloc.subject_code,
        subject_name: alloc.subject_name,
        remaining_periods: remaining,
        reason: isLab
          ? "Consecutive lab slots or qualified lab rooms unavailable."
          : "Available teaching slots exhausted or faculty schedule booked.",
      });
    }
  }

  return {
    success: unassignedSubjects.length === 0,
    entries,
    unassignedSubjects,
    conflicts,
  };
}

/**
 * Validates timetable entries against multi-tenant institutional constraints:
 * - Teacher double-booking
 * - Section double-booking
 * - Room / Lab collision
 * - Break period violation
 */
export function validateTimetableEntries(params: {
  entries: TimetableEntry[];
  slots: TimetableSlot[];
  otherPublishedEntries?: {
    id: string;
    teacher_id: string;
    day_of_week: TimetableDay;
    slot_number: number;
    room_number?: string | null;
    room_id?: string | null;
  }[];
}): TimetableConflict[] {
  const { entries, slots, otherPublishedEntries = [] } = params;
  const conflicts: TimetableConflict[] = [];

  const breakSlotNumbers = new Set(slots.filter((s) => s.is_break).map((s) => s.slot_number));

  const sectionSeen = new Set<string>();
  const teacherSeen = new Set<string>();
  const roomSeen = new Set<string>();

  for (const entry of entries) {
    // 1. Break violation
    if (breakSlotNumbers.has(entry.slot_number)) {
      conflicts.push({
        type: "BREAK_VIOLATION",
        day: entry.day_of_week,
        slot_number: entry.slot_number,
        message: `Class scheduled during reserved break/lunch period ${entry.slot_number}.`,
      });
    }

    // 2. Section double booking
    const secKey = `${entry.day_of_week}_${entry.slot_number}`;
    if (sectionSeen.has(secKey)) {
      conflicts.push({
        type: "SECTION_DOUBLE_BOOKING",
        day: entry.day_of_week,
        slot_number: entry.slot_number,
        message: `Section has multiple subjects assigned in period ${entry.slot_number} on ${entry.day_of_week}.`,
      });
    }
    sectionSeen.add(secKey);

    // 3. Teacher double booking
    const teachKey = `${entry.teacher_id}_${entry.day_of_week}_${entry.slot_number}`;
    if (teacherSeen.has(teachKey)) {
      conflicts.push({
        type: "TEACHER_DOUBLE_BOOKING",
        day: entry.day_of_week,
        slot_number: entry.slot_number,
        message: `Teacher is double-booked in period ${entry.slot_number} on ${entry.day_of_week}.`,
      });
    }
    teacherSeen.add(teachKey);

    // 4. Room double booking
    if (entry.room_number) {
      const roomKey = `${entry.room_number.toUpperCase()}_${entry.day_of_week}_${entry.slot_number}`;
      if (roomSeen.has(roomKey)) {
        conflicts.push({
          type: "ROOM_DOUBLE_BOOKING",
          day: entry.day_of_week,
          slot_number: entry.slot_number,
          message: `Room/Lab '${entry.room_number}' is double-booked in period ${entry.slot_number} on ${entry.day_of_week}.`,
        });
      }
      roomSeen.add(roomKey);
    }
  }

  // Check against published schedules in other sections
  for (const entry of entries) {
    const isTeacherBusyElsewhere = otherPublishedEntries.some(
      (pub) =>
        pub.teacher_id === entry.teacher_id &&
        pub.day_of_week === entry.day_of_week &&
        pub.slot_number === entry.slot_number
    );

    if (isTeacherBusyElsewhere) {
      conflicts.push({
        type: "TEACHER_DOUBLE_BOOKING",
        day: entry.day_of_week,
        slot_number: entry.slot_number,
        message: `Teacher is already teaching another class in published schedule at period ${entry.slot_number} on ${entry.day_of_week}.`,
      });
    }

    if (entry.room_number) {
      const isRoomBusyElsewhere = otherPublishedEntries.some(
        (pub) =>
          pub.room_number?.toUpperCase() === entry.room_number?.toUpperCase() &&
          pub.day_of_week === entry.day_of_week &&
          pub.slot_number === entry.slot_number
      );

      if (isRoomBusyElsewhere) {
        conflicts.push({
          type: "ROOM_DOUBLE_BOOKING",
          day: entry.day_of_week,
          slot_number: entry.slot_number,
          message: `Room/Lab '${entry.room_number}' is occupied by another class at period ${entry.slot_number} on ${entry.day_of_week}.`,
        });
      }
    }
  }

  return conflicts;
}
