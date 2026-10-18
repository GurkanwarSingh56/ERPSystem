import zipfile
import re
from parse_tt_sheets import parse_shared_strings, get_sheet_targets, parse_sheet_rows

with zipfile.ZipFile('tt.xlsx') as z:
    shared_strings = parse_shared_strings(z)
    sheet_targets = dict(get_sheet_targets(z))

    # Labs
    lab_rows = parse_sheet_rows(z, sheet_targets['LAB WISE'], shared_strings)
    labs = []
    for r_idx, cells in lab_rows:
        val = cells.get('A', '').strip()
        # Look for rows above LECTURE / DAY
        # If cells has CL- or B- or LAB
        for col, txt in cells.items():
            txt = txt.strip()
            if txt in ['CL-1', 'CL-2', 'CL-3', 'B-208A', 'B-208B', 'B-214B', 'B-209', 'B-214A', 'B-214']:
                labs.append((r_idx, col, txt))
    print(f"Discovered Labs: {list(dict.fromkeys([l[2] for l in labs]))}")

    # Rooms
    room_rows = parse_sheet_rows(z, sheet_targets['ROOM WISE'], shared_strings)
    rooms = []
    for r_idx, cells in room_rows:
        for col, txt in cells.items():
            txt = txt.strip()
            if re.match(r'^B-\d+[A-Z]?$', txt):
                rooms.append((r_idx, col, txt))
    print(f"Discovered Rooms: {list(dict.fromkeys([r[2] for r in rooms]))}")

