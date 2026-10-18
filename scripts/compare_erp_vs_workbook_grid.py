import json
import subprocess

cmd = ["docker", "exec", "supabase_db_erp", "psql", "-U", "postgres", "-d", "postgres", "-t", "-A", "-c", """
SELECT json_agg(json_build_object(
  'day', e.day_of_week,
  'slot', e.slot_number,
  'section_name', sec.name,
  'course_code', c.code,
  'sem', sem.semester_number,
  'subject_code', sub.code,
  'subject_name', sub.name,
  'teacher_name', p.full_name,
  'room_number', e.room_number
))
FROM public.timetable_entries e
JOIN public.timetables t ON t.id = e.timetable_id
JOIN public.sections sec ON sec.id = t.section_id
JOIN public.courses c ON c.id = sec.course_id
JOIN public.semesters sem ON sem.id = sec.semester_id
JOIN public.subjects sub ON sub.id = e.subject_id
JOIN public.teachers teach ON teach.id = e.teacher_id
JOIN public.profiles p ON p.id = teach.id
WHERE t.academic_year = '2026-2027';
"""]

raw = subprocess.check_output(cmd).decode('utf-8').strip()
erp_entries = json.loads(raw) if raw and raw != 'null' else []

with open('scripts/parsed_tt_audit.json') as fp:
    wb_data = json.load(fp)

print(f"Total Draft Timetable Entries Currently in Database: {len(erp_entries)}")
print(f"Total Cohorts in Workbook: {len(wb_data['classes'])}")

# Analyze overlap for CSE Sem 5 Section A
cse5a_erp = [e for e in erp_entries if e['course_code'] == 'CSE' and e['sem'] == 5 and e['section_name'] == 'Section A']
print(f"CSE Sem 5 Section A - Database Entries: {len(cse5a_erp)}")

# Compare with workbook B.TECH - CSE (A) 5TH SEM
wb_cse5a = next((c for c in wb_data['classes'] if 'CSE (A) 5TH' in c['name']), None)
if wb_cse5a:
    wb_teach_entries = [e for e in wb_cse5a['entries'] if e['text'] not in ['BREAK', 'LIBRARY', '']]
    print(f"CSE Sem 5 Section A - Workbook Teaching Entries: {len(wb_teach_entries)}")
    print(f"\nWorkbook Schedule Samples for CSE 5A:")
    for w in wb_teach_entries[:8]:
        print(f"  {w['day'][:3]} Col {w['col']}: {w['text']}")

