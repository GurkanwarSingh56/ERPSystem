import zipfile
import xml.etree.ElementTree as ET
from parse_tt_sheets import parse_shared_strings, get_sheet_targets, parse_sheet_rows

with zipfile.ZipFile('tt.xlsx') as z:
    shared_strings = parse_shared_strings(z)
    sheet_targets = dict(get_sheet_targets(z))
    rows = parse_sheet_rows(z, sheet_targets['LAB WISE'], shared_strings)
    for r_idx, cells in rows:
        val_a = cells.get('A', '').strip()
        val_b = cells.get('B', '').strip()
        val_c = cells.get('C', '').strip()
        if 'TIME TABLE' in val_a:
            # Check row r_idx + 1 or nearby
            print(f"Row {r_idx:3d}: A='{val_a}' | B='{val_b}' | C='{val_c}'")
        elif any(cells.values()) and not any(val_a.startswith(d) for d in ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'DAY', 'LECTURE']) and '-' not in val_a[:5]:
            print(f"  -> Title Row {r_idx:3d}: {cells}")

