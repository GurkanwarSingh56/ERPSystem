import json
import re

with open('scripts/parsed_tt_audit.json') as fp:
    wb_data = json.load(fp)

# Let's inspect class entries to understand format:
# Typical cell in CLASS WISE: "WT LAB [G1] RK CL-2" or "DBMS[L] KA B-110" or "LIBRARY"
# Or combined like "HVPE[L] B-110"

subjects_found = set()
faculty_abbrs = set()
rooms_found = set()
classes_info = []

for c in wb_data['classes']:
    c_name = c['name']
    entries_count = len(c['entries'])
    parsed_entries = []
    for e in c['entries']:
        txt = e['text'].strip()
        if txt in ['LIBRARY', 'BREAK', '']:
            continue
        # extract components
        # Pattern: SUBJECT[L or LAB or P] or similar
        parsed_entries.append({'day': e['day'], 'col': e['col'], 'raw': txt})
    classes_info.append({'name': c_name, 'total_periods': len(parsed_entries)})

print("=== CLASS COHORTS AND PERIOD COUNTS IN WORKBOOK ===")
for ci in classes_info:
    print(f"  {ci['name']:35s} : {ci['total_periods']} teaching periods")

