import zipfile
from parse_tt_sheets import parse_shared_strings, get_sheet_targets, parse_sheet_rows

with zipfile.ZipFile('tt.xlsx') as z:
    shared_strings = parse_shared_strings(z)
    sheet_targets = dict(get_sheet_targets(z))
    rows = parse_sheet_rows(z, sheet_targets['LAB WISE'], shared_strings)
    row_map = {r[0]: r[1] for r in rows}
    for r in [6, 28, 50, 72, 94, 115, 135]:
        if r in row_map:
            print(f"Row {r}: {row_map[r]}")
        elif r-1 in row_map:
            print(f"Row {r-1}: {row_map[r-1]}")
        elif r+1 in row_map:
            print(f"Row {r+1}: {row_map[r+1]}")

