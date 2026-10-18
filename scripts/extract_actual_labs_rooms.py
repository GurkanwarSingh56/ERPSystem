import zipfile
import re
from parse_tt_sheets import parse_shared_strings, get_sheet_targets, parse_sheet_rows

with zipfile.ZipFile('tt.xlsx') as z:
    shared_strings = parse_shared_strings(z)
    sheet_targets = dict(get_sheet_targets(z))

    # Labs
    lab_rows = parse_sheet_rows(z, sheet_targets['LAB WISE'], shared_strings)
    actual_labs = []
    for r_idx, cells in lab_rows:
        val_a = cells.get('A', '').strip()
        if val_a and ('TIME TABLE' not in val_a) and ('UNIVERSITY' not in val_a) and ('LECTURE' not in val_a) and ('DAY' not in val_a) and not any(val_a.startswith(d) for d in ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']) and '-' not in val_a[:4]:
            actual_labs.append((r_idx, val_a))

    print("Actual Lab Headings:")
    for l in actual_labs:
        print(f"  Row {l[0]:3d}: {l[1]}")

    # Rooms
    room_rows = parse_sheet_rows(z, sheet_targets['ROOM WISE'], shared_strings)
    actual_rooms = []
    for r_idx, cells in room_rows:
        val_a = cells.get('A', '').strip()
        if val_a and ('TIME TABLE' not in val_a) and ('UNIVERSITY' not in val_a) and ('LECTURE' not in val_a) and ('DAY' not in val_a) and not any(val_a.startswith(d) for d in ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']) and '-' not in val_a[:4]:
            actual_rooms.append((r_idx, val_a))

    print("\nActual Room Headings:")
    for r in actual_rooms:
        print(f"  Row {r[0]:3d}: {r[1]}")

