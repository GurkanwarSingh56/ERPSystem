import json

with open('scripts/parsed_tt_audit.json') as fp:
    wb_data = json.load(fp)

wb_faculty = [f['name'].strip() for f in wb_data['faculty']]
print(f"Total Faculty in Workbook: {len(wb_faculty)}")
for i, name in enumerate(wb_faculty, 1):
    print(f"  {i:2d}. {name}")

print("\nWorkbook Class Headings:")
for i, c in enumerate(wb_data['classes'], 1):
    print(f"  {i:2d}. {c['name']}")

