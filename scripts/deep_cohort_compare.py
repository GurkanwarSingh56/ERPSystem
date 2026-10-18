import json

with open('scripts/parsed_tt_audit.json') as fp:
    wb_data = json.load(fp)

# Compare official workbook sections vs ERP database sections
wb_classes = [c['name'] for c in wb_data['classes']]

print("=== OFFICIAL TIMETABLE WORKBOOK CLASSES ===")
for i, c in enumerate(wb_classes, 1):
    print(f"  {i:2d}. {c}")

