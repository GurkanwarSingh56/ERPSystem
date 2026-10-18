import zipfile
import xml.etree.ElementTree as ET
import re
from parse_tt_sheets import parse_shared_strings, get_sheet_targets, parse_sheet_rows

with zipfile.ZipFile('tt.xlsx') as z:
    shared_strings = parse_shared_strings(z)
    sheet_targets = get_sheet_targets(z)
    
    for name, target in sheet_targets:
        rows = parse_sheet_rows(z, target, shared_strings)
        print(f"\n================ SHEET: {name} ================")
        
        # Scan for headers and section blocks
        blocks = []
        for r_idx, cells in rows:
            val_a = cells.get('A', '').strip()
            # Check for header rows
            if val_a and ('TIME TABLE' not in val_a) and ('UNIVERSITY' not in val_a) and ('LECTURE' not in val_a) and ('DAY' not in val_a) and ('-' not in val_a[:3]) and ('MONDAY' not in val_a) and ('TUESDAY' not in val_a) and ('WEDNESDAY' not in val_a) and ('THURSDAY' not in val_a) and ('FRIDAY' not in val_a):
                # Could be a section name, room name, or faculty name
                load_val = cells.get('J', '').strip() or cells.get('I', '').strip()
                blocks.append((r_idx, val_a, load_val))
        print(f"Total blocks detected in {name}: {len(blocks)}")
        for b in blocks[:15]:
            print(f"  Row {b[0]:3d}: {b[1]} | {b[2]}")
        if len(blocks) > 15:
            print(f"  ... and {len(blocks) - 15} more")

