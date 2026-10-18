import json
import subprocess

cmd = ["docker", "exec", "supabase_db_erp", "psql", "-U", "postgres", "-d", "postgres", "-t", "-A", "-c", """
SELECT json_build_object(
  'slots', (SELECT json_agg(s ORDER BY slot_number) FROM public.timetable_slots s WHERE institution_id = '00000000-0000-0000-0000-000000000001'),
  'rooms', (SELECT json_agg(r ORDER BY room_number) FROM public.rooms r WHERE institution_id = '00000000-0000-0000-0000-000000000001'),
  'sections', (
    SELECT json_agg(json_build_object(
      'id', sec.id,
      'name', sec.name,
      'course_code', c.code,
      'semester', sem.semester_number,
      'allocations', (
        SELECT json_agg(json_build_object(
          'section_id', ts.section_id,
          'subject_id', ts.subject_id,
          'subject_name', sub.name,
          'subject_code', sub.code,
          'subject_type', sub.type,
          'weekly_hours', sub.weekly_hours,
          'teacher_id', ts.teacher_id,
          'teacher_name', p.full_name
        ))
        FROM public.teacher_subjects ts
        JOIN public.subjects sub ON sub.id = ts.subject_id
        JOIN public.teachers t ON t.id = ts.teacher_id
        JOIN public.profiles p ON p.id = t.id
        WHERE ts.section_id = sec.id
          AND sub.code NOT IN ('CS501', 'CS501P', 'CS502', 'CS503', 'CS503P', 'CS504', 'CS504P', 'CS505', 'CS505P', 'CS506')
          AND NOT (sub.code = 'DMW_S7' AND p.full_name = 'Er. Gursharan Saini')
      )
    ))
    FROM public.sections sec
    JOIN public.courses c ON c.id = sec.course_id
    JOIN public.semesters sem ON sem.id = sec.semester_id
    WHERE c.code = 'CSE'
  )
);
"""]

raw_json = subprocess.check_output(cmd).decode('utf-8').strip()
db_data = json.loads(raw_json)

from ortools.sat.python import cp_model
import sys

print(f"Total CSE Sections in DB: {len(db_data.get('sections', []))}")
for s in db_data.get('sections', []):
    allocs = s.get('allocations') or []
    tot_hours = sum(a['weekly_hours'] for a in allocs)
    print(f"  Section: {s['course_code']} Sem {s['semester']} {s['name']} -> {len(allocs)} assignments, {tot_hours} required periods")

# Let's run CP-SAT department-wide with the corrected allocations!
all_sections = [s for s in db_data.get('sections', []) if s.get('allocations')]
slots = [s for s in db_data['slots'] if not s.get('is_break')]
rooms = db_data['rooms']

# Build CP-SAT department-wide model
payload = {
    "sections": all_sections,
    "slots": slots,
    "working_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
    "rooms": rooms,
    "existing_assignments": [],
    "preferences": {
        "max_theory_per_day": 1,
        "allow_consecutive_theory": False
    }
}

with open("scratch_payload.json", "w") as f:
    json.dump(payload, f)

# Run timetable_solver.py
res = subprocess.check_output([".venv/bin/python3", "src/server/python/timetable_solver.py"], input=json.dumps(payload).encode('utf-8'))
out = json.loads(res.decode('utf-8'))
print("\n=== SOLVER RESULT ===")
print("Status:", out.get("status"))
print("Wall Time:", out.get("wall_time"))
print("Scheduled Entries:", len(out.get("entries", [])))
if out.get("diagnostics"):
    print("Diagnostics:", out.get("diagnostics"))

