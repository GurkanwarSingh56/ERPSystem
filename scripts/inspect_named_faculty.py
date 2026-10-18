import json

with open('scripts/parsed_tt_audit.json') as fp:
    wb_data = json.load(fp)

real_teachers = []
subject_faculty_blocks = []

for i, f in enumerate(wb_data['faculty']):
    name = f['name'].strip()
    if name == 'k':
        continue
    if name in ['HVPE', 'EVS', 'NCER', 'SETUP&LAUNCH(ENP)', 'OPS']:
        subject_faculty_blocks.append(f)
    else:
        real_teachers.append(f)

print(f"Total Individual Faculty Members: {len(real_teachers)}")
for idx, t in enumerate(real_teachers, 1):
    print(f"  {idx:2d}. {t['name']:25s} | Load in sheet: {str(t['load']):4s} | Entries: {len(t['entries'])}")

print(f"\nInstitutional/Subject-pooled Resource Rows: {len(subject_faculty_blocks)}")
for idx, s in enumerate(subject_faculty_blocks, 1):
    print(f"  {idx}. {s['name']:25s} | Entries: {len(s['entries'])}")

