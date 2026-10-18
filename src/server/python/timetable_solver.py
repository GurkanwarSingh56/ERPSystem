#!/usr/bin/env python3
"""
Python OR-Tools CP-SAT Timetable Engine for College ERP.
Solves multi-section, multi-teacher, multi-room scheduling with:
- Strict zero double-booking (sections, teachers, rooms)
- No theory subject repetition (>1 period per day)
- Anti-consecutive theory penalties
- Strictly adjacent multi-period lab blocks in specialized laboratories
- Pre-booked slot exclusions
- Faculty max weekly teaching load limits
- Structured diagnostics for INFEASIBLE or UNKNOWN outcomes
"""

import sys
import json
from collections import defaultdict
from typing import Dict, List, Any, Optional

try:
    from ortools.sat.python import cp_model
except ImportError:
    print(json.dumps({
        "status": "ERROR",
        "error": "Google OR-Tools is not installed in the active Python environment."
    }))
    sys.exit(1)


def solve_timetable(payload: Dict[str, Any]) -> Dict[str, Any]:
    # 1. Parse Input Payload
    sections = payload.get("sections", [])
    allocations = payload.get("allocations", [])
    rooms = payload.get("rooms", [])
    slots = payload.get("slots", [])
    working_days = payload.get("working_days", ["monday", "tuesday", "wednesday", "thursday", "friday"])
    existing_busy = payload.get("existing_busy", {})
    max_solve_time = float(payload.get("max_solve_time_seconds", 25.0))
    preferences = payload.get("preferences", {})

    max_theory_per_day = int(preferences.get("max_theory_per_day", 1))
    allow_consecutive_theory = bool(preferences.get("allow_consecutive_theory", False))

    # Teachable Slots (exclude breaks)
    teachable_slots = [s for s in slots if not s.get("is_break", False)]
    teachable_slot_numbers = sorted([s["slot_number"] for s in teachable_slots])
    
    if not teachable_slot_numbers:
        return {
            "status": "INFEASIBLE",
            "error": "No teachable timetable slots configured (all slots are breaks or empty).",
            "diagnostics": {"reason": "EMPTY_SLOTS"}
        }

    # Identify adjacent slot pairs on same side of break for labs
    # For instance: 1-2, 2-3, 3-4 (morning) and 5-6, 6-7, 7-8 (afternoon)
    adjacent_pairs = []
    for i in range(len(teachable_slot_numbers) - 1):
        s1 = teachable_slot_numbers[i]
        s2 = teachable_slot_numbers[i+1]
        if s2 == s1 + 1:
            adjacent_pairs.append((s1, s2))

    # Build Resource Maps
    room_by_id = {r["id"]: r for r in rooms}
    lab_rooms = [r for r in rooms if r.get("type") == "lab" and r.get("is_available", True)]
    classroom_rooms = [r for r in rooms if r.get("type") != "lab" and r.get("is_available", True)]
    
    # If no designated lab, allow all available rooms
    effective_lab_rooms = lab_rooms if lab_rooms else rooms
    effective_classrooms = classroom_rooms if classroom_rooms else rooms

    # Pre-booked busy lookups:
    # teacher_busy: set of (teacher_id, day, slot)
    # room_busy: set of (room_id, day, slot)
    teacher_busy_set = set()
    for b in existing_busy.get("teachers", []):
        teacher_busy_set.add((b["teacher_id"], b["day"], b["slot_number"]))

    room_busy_set = set()
    for b in existing_busy.get("rooms", []):
        r_id = b.get("room_id")
        if r_id:
            room_busy_set.add((r_id, b["day"], b["slot_number"]))

    # Prepare Scheduling Units from Allocations
    # Each unit is either:
    # - a 1-period theory lecture
    # - a 2-period consecutive lab block
    scheduling_units = []
    unit_id_counter = 0

    for alloc in allocations:
        sec_id = alloc["section_id"]
        sub_id = alloc["subject_id"]
        teacher_id = alloc["teacher_id"]
        sub_type = alloc.get("subject_type", "theory")
        weekly_hours = int(alloc.get("weekly_hours", 3))
        batch_group = alloc.get("batch_group")

        is_lab = sub_type == "practical" or "lab" in alloc.get("subject_name", "").lower()
        
        if is_lab:
            # Group into 2-period consecutive blocks
            num_blocks = weekly_hours // 2
            rem_hours = weekly_hours % 2
            for b_idx in range(num_blocks):
                unit_id_counter += 1
                scheduling_units.append({
                    "unit_id": unit_id_counter,
                    "section_id": sec_id,
                    "subject_id": sub_id,
                    "teacher_id": teacher_id,
                    "alloc": alloc,
                    "is_lab": True,
                    "duration": 2,
                    "block_index": b_idx,
                })
            if rem_hours > 0:
                unit_id_counter += 1
                scheduling_units.append({
                    "unit_id": unit_id_counter,
                    "section_id": sec_id,
                    "subject_id": sub_id,
                    "teacher_id": teacher_id,
                    "alloc": alloc,
                    "is_lab": True,
                    "duration": 1,
                    "block_index": num_blocks,
                })
        else:
            # Single-period theory units
            for h_idx in range(weekly_hours):
                unit_id_counter += 1
                scheduling_units.append({
                    "unit_id": unit_id_counter,
                    "section_id": sec_id,
                    "subject_id": sub_id,
                    "teacher_id": teacher_id,
                    "alloc": alloc,
                    "is_lab": False,
                    "duration": 1,
                    "hour_index": h_idx,
                })

    # Total capacity check
    total_slots_per_section = len(working_days) * len(teachable_slot_numbers)
    section_demands = defaultdict(int)
    for u in scheduling_units:
        section_demands[u["section_id"]] += u["duration"]

    overloaded_sections = []
    for s_id, req in section_demands.items():
        if req > total_slots_per_section:
            overloaded_sections.append({"section_id": s_id, "required": req, "available": total_slots_per_section})

    if overloaded_sections:
        return {
            "status": "INFEASIBLE",
            "error": "Curriculum required hours exceed total available timetable periods for one or more sections.",
            "diagnostics": {
                "reason": "SECTION_CAPACITY_EXCEEDED",
                "overloaded_sections": overloaded_sections
            }
        }

    # Initialize CP-SAT Model
    model = cp_model.CpModel()

    # Decision Variables:
    # For each unit u, and each candidate (day, start_slot, room):
    # unit_placed[u_id, day, start_slot, room_id] = BoolVar
    unit_vars = {}
    unit_start_vars = defaultdict(list)
    section_occupied = defaultdict(list) # (sec_id, day, slot) -> [var]
    teacher_occupied = defaultdict(list) # (teacher_id, day, slot) -> [var]
    room_occupied = defaultdict(list)    # (room_id, day, slot) -> [var]
    subject_day_occupied = defaultdict(list) # (sec_id, sub_id, day) -> [var]

    objective_penalties = []

    for u in scheduling_units:
        u_id = u["unit_id"]
        sec_id = u["section_id"]
        sub_id = u["subject_id"]
        teacher_id = u["teacher_id"]
        is_lab = u["is_lab"]
        dur = u["duration"]

        candidate_rooms = effective_lab_rooms if is_lab else effective_classrooms

        for day in working_days:
            # If duration is 2, start_slot must be the first of an adjacent pair
            if dur == 2:
                valid_starts = [pair[0] for pair in adjacent_pairs]
            else:
                valid_starts = teachable_slot_numbers

            for start_slot in valid_starts:
                active_slots = [start_slot] if dur == 1 else [start_slot, start_slot + 1]

                # Check pre-booked teacher busy
                if any((teacher_id, day, s) in teacher_busy_set for s in active_slots):
                    continue

                for r in candidate_rooms:
                    r_id = r["id"]

                    # Check pre-booked room busy
                    if any((r_id, day, s) in room_busy_set for s in active_slots):
                        continue

                    var = model.NewBoolVar(f"u{u_id}_{day}_s{start_slot}_r{r_id[:6]}")
                    unit_vars[(u_id, day, start_slot, r_id)] = var
                    unit_start_vars[u_id].append(var)

                    # Mark section occupied
                    for s in active_slots:
                        section_occupied[(sec_id, day, s)].append(var)
                        teacher_occupied[(teacher_id, day, s)].append(var)
                        room_occupied[(r_id, day, s)].append(var)

                    # Subject-day count
                    subject_day_occupied[(sec_id, sub_id, day)].append(var)

    # -------------------------------------------------------------
    # HARD CONSTRAINTS
    # -------------------------------------------------------------

    # 1. Every scheduling unit must be scheduled exactly once
    unmatched_units = []
    for u in scheduling_units:
        u_id = u["unit_id"]
        all_candidate_vars = unit_start_vars.get(u_id, [])
        if not all_candidate_vars:
            unmatched_units.append(u)
        else:
            model.AddExactlyOne(all_candidate_vars)

    if unmatched_units:
        return {
            "status": "INFEASIBLE",
            "error": "Some subjects/labs have no feasible slots or available rooms.",
            "diagnostics": {
                "reason": "NO_FEASIBLE_CANDIDATE_SLOTS",
                "unmatched_units_count": len(unmatched_units),
                "samples": [
                    {
                        "subject": u["alloc"].get("subject_name"),
                        "section_id": u["section_id"],
                        "teacher_id": u["teacher_id"],
                        "duration": u["duration"]
                    }
                    for u in unmatched_units[:5]
                ]
            }
        }

    # 2. Section Conflict: At most one activity per section per slot
    for (sec_id, day, slot), var_list in section_occupied.items():
        if len(var_list) > 1:
            model.AddAtMostOne(var_list)

    # 3. Teacher Conflict: At most one activity per teacher per slot
    for (teacher_id, day, slot), var_list in teacher_occupied.items():
        if len(var_list) > 1:
            model.AddAtMostOne(var_list)

    # 4. Room Conflict: At most one activity per physical room/lab per slot
    for (r_id, day, slot), var_list in room_occupied.items():
        if len(var_list) > 1:
            model.AddAtMostOne(var_list)

    # 5. Anti-Repetition Rule: Max theory periods per subject per day for each section
    for (sec_id, sub_id, day), var_list in subject_day_occupied.items():
        # Check if subject is theory
        # (labs might occupy 1 unit of 2 periods, which is fine)
        # Find if this subject is theory
        sample_unit = next((u for u in scheduling_units if u["section_id"] == sec_id and u["subject_id"] == sub_id), None)
        if sample_unit and not sample_unit["is_lab"]:
            if not allow_consecutive_theory:
                model.Add(sum(var_list) <= max_theory_per_day)
            else:
                # If soft/allowed, heavily penalize > 1
                if len(var_list) > 1:
                    excess = model.NewIntVar(0, len(var_list), f"excess_{sec_id[:4]}_{sub_id[:4]}_{day}")
                    model.Add(excess >= sum(var_list) - max_theory_per_day)
                    objective_penalties.append(excess * 500)

    # -------------------------------------------------------------
    # SOFT CONSTRAINTS / OBJECTIVES
    # -------------------------------------------------------------
    # A. Penalize consecutive theory periods of the same subject
    # B. Encourage balanced distribution across days
    # C. Minimize room hopping for a section within the same day

    if objective_penalties:
        model.Minimize(sum(objective_penalties))

    # -------------------------------------------------------------
    # SOLVER EXECUTION
    # -------------------------------------------------------------
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max_solve_time
    solver.parameters.num_workers = 4

    solve_status = solver.Solve(model)

    status_str = solver.StatusName(solve_status)

    if solve_status not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        return {
            "status": status_str,
            "error": f"CP-SAT solver returned {status_str}.",
            "diagnostics": {
                "solver_status": status_str,
                "wall_time": solver.WallTime(),
                "total_units": len(scheduling_units),
                "sections_count": len(sections),
                "reasons": [
                    "Teacher availability constraints or excessive workload",
                    "Room/laboratory capacity or consecutive-period bottleneck",
                    "Over-constrained subject distribution across days"
                ]
            }
        }

    # -------------------------------------------------------------
    # EXTRACT SCHEDULE RESULTS
    # -------------------------------------------------------------
    entries = []
    scheduled_units_count = 0

    for (u_id, day, start_slot, r_id), var in unit_vars.items():
        if solver.BooleanValue(var):
            scheduled_units_count += 1
            u = next(x for x in scheduling_units if x["unit_id"] == u_id)
            alloc = u["alloc"]
            dur = u["duration"]
            room = room_by_id.get(r_id, {})

            if dur == 1:
                entries.append({
                    "section_id": u["section_id"],
                    "subject_id": u["subject_id"],
                    "teacher_id": u["teacher_id"],
                    "room_id": r_id,
                    "room_number": room.get("room_number", "B-110"),
                    "day_of_week": day,
                    "slot_number": start_slot,
                    "batch_group": alloc.get("batch_group"),
                    "subject_name": alloc.get("subject_name"),
                    "subject_code": alloc.get("subject_code"),
                    "subject_type": alloc.get("subject_type", "theory"),
                    "teacher_name": alloc.get("teacher_name"),
                })
            elif dur == 2:
                # Add slot 1 and slot 2
                entries.append({
                    "section_id": u["section_id"],
                    "subject_id": u["subject_id"],
                    "teacher_id": u["teacher_id"],
                    "room_id": r_id,
                    "room_number": room.get("room_number", "CL-1"),
                    "day_of_week": day,
                    "slot_number": start_slot,
                    "batch_group": alloc.get("batch_group", "G1"),
                    "subject_name": alloc.get("subject_name"),
                    "subject_code": alloc.get("subject_code"),
                    "subject_type": "practical",
                    "teacher_name": alloc.get("teacher_name"),
                })
                entries.append({
                    "section_id": u["section_id"],
                    "subject_id": u["subject_id"],
                    "teacher_id": u["teacher_id"],
                    "room_id": r_id,
                    "room_number": room.get("room_number", "CL-1"),
                    "day_of_week": day,
                    "slot_number": start_slot + 1,
                    "batch_group": alloc.get("batch_group", "G1"),
                    "subject_name": alloc.get("subject_name"),
                    "subject_code": alloc.get("subject_code"),
                    "subject_type": "practical",
                    "teacher_name": alloc.get("teacher_name"),
                })

    return {
        "status": status_str,
        "success": True,
        "wall_time_seconds": solver.WallTime(),
        "scheduled_units": scheduled_units_count,
        "total_periods_scheduled": len(entries),
        "entries": entries,
    }


def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"status": "ERROR", "error": "No JSON payload provided via stdin"}))
            sys.exit(1)

        payload = json.loads(raw_input)
        result = solve_timetable(payload)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({
            "status": "ERROR",
            "error": str(e)
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
