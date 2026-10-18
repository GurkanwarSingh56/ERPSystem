import json
import subprocess
import os

# Connect to database via psql in docker or query directly
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

print(f"Total CSE Sections in DB: {len(db_data.get('sections', []))}")
for s in db_data.get('sections', []):
    allocs = s.get('allocations') or []
    tot_hours = sum(a['weekly_hours'] for a in allocs)
    print(f"  Section: {s['course_code']} Sem {s['semester']} {s['name']} -> {len(allocs)} assignments, {tot_hours} required periods")
    for a in allocs:
        print(f"     - {a['subject_code']} ({a['subject_name']}): {a['weekly_hours']} hrs | {a['teacher_name']}")

