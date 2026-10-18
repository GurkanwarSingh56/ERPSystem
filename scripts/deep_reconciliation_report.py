import json

with open('scripts/parsed_tt_audit.json') as fp:
    wb_data = json.load(fp)

print("Workbook Stats:")
print(f"Total Classes in CLASS WISE: {len(wb_data['classes'])}")
for idx, c in enumerate(wb_data['classes'], 1):
    print(f"  {idx:2d}. {c['name']}")

print(f"\nTotal Labs in LAB WISE: {len(wb_data['labs'])}")
for idx, l in enumerate(wb_data['labs'], 1):
    print(f"  {idx:2d}. {l['name']}")

print(f"\nTotal Rooms in ROOM WISE: {len(wb_data['rooms'])}")
for idx, r in enumerate(wb_data['rooms'], 1):
    print(f"  {idx:2d}. {r['name']}")

print(f"\nTotal Faculty in FACULTY sheet: {len(wb_data['faculty'])}")
