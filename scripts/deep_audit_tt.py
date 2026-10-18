import zipfile
import xml.etree.ElementTree as ET
import re
import json
from parse_tt_sheets import parse_shared_strings, get_sheet_targets, parse_sheet_rows

def run_deep_audit():
    with zipfile.ZipFile('tt.xlsx') as z:
        shared_strings = parse_shared_strings(z)
        sheet_targets = dict(get_sheet_targets(z))
        
        # 1. Parse Faculty Sheet
        faculty_rows = parse_sheet_rows(z, sheet_targets['FACULTY'], shared_strings)
        faculty_list = []
        current_fac = None
        for r_idx, cells in faculty_rows:
            val_a = cells.get('A', '').strip()
            # Faculty header row has teacher name in A, load in J or I
            if val_a and ('TIME TABLE' not in val_a) and ('UNIVERSITY' not in val_a) and ('LECTURE' not in val_a) and ('DAY' not in val_a) and not any(val_a.startswith(d) for d in ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']):
                load_str = cells.get('J', '').strip() or cells.get('I', '').strip()
                m_load = re.search(r'TOTAL\s*LOAD\s*[-:]?\s*(\d+)', load_str, re.IGNORECASE)
                load_val = int(m_load.group(1)) if m_load else None
                current_fac = {
                    'name': val_a,
                    'row': r_idx,
                    'load': load_val,
                    'entries': []
                }
                faculty_list.append(current_fac)
            elif current_fac and any(val_a.startswith(d) for d in ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']):
                day = val_a.split()[0]
                for col in ['B', 'C', 'D', 'E', 'G', 'H', 'I', 'J']: # F is break
                    txt = cells.get(col, '').strip()
                    if txt and txt != 'BREAK':
                        current_fac['entries'].append({'day': day, 'col': col, 'text': txt})

        # 2. Parse Class Wise Sheet
        class_rows = parse_sheet_rows(z, sheet_targets['CLASS WISE'], shared_strings)
        classes_list = []
        current_cls = None
        legend_map = {}
        for r_idx, cells in class_rows:
            val_a = cells.get('A', '').strip()
            # Detect legends at bottom of tables like "RPK-ER.RUPINDER KAUR MK-MS.MANINDER KAUR..."
            if '-' in val_a and ('TIME TABLE' not in val_a) and ('UNIVERSITY' not in val_a) and ('B.TECH' not in val_a) and ('MCA' not in val_a) and ('BCA' not in val_a):
                # parse legend tokens
                tokens = re.findall(r'([A-Z0-9]+)\s*[-:]\s*([A-Za-z0-9\.\s]+?)(?=\s+[A-Z0-9]+\s*[-:]|$)', val_a)
                for abbr, full in tokens:
                    legend_map[abbr.strip()] = full.strip()
                    
            if val_a and (any(kw in val_a.upper() for kw in ['B.TECH', 'BCA', 'MCA', 'B.SC', 'M.TECH', 'B.VOC']) or ('SEM' in val_a.upper() and 'TIME TABLE' not in val_a and 'UNIVERSITY' not in val_a)):
                current_cls = {
                    'name': val_a,
                    'row': r_idx,
                    'entries': []
                }
                classes_list.append(current_cls)
            elif current_cls and any(val_a.startswith(d) for d in ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']):
                day = val_a.split()[0]
                for col in ['B', 'C', 'D', 'E', 'G', 'H', 'I', 'J']:
                    txt = cells.get(col, '').strip()
                    if txt and txt != 'BREAK':
                        current_cls['entries'].append({'day': day, 'col': col, 'text': txt})

        # 3. Parse Lab Wise Sheet
        lab_rows = parse_sheet_rows(z, sheet_targets['LAB WISE'], shared_strings)
        labs_list = []
        current_lab = None
        for r_idx, cells in lab_rows:
            val_a = cells.get('A', '').strip()
            if '-' in val_a and ('TIME TABLE' not in val_a) and ('UNIVERSITY' not in val_a) and ('CL-' not in val_a) and ('LAB' not in val_a):
                tokens = re.findall(r'([A-Z0-9]+)\s*[-:]\s*([A-Za-z0-9\.\s]+?)(?=\s+[A-Z0-9]+\s*[-:]|$)', val_a)
                for abbr, full in tokens:
                    legend_map[abbr.strip()] = full.strip()

            if val_a and any(kw in val_a.upper() for kw in ['CL-', 'LAB', 'COMPUTER', 'MECHANICAL']):
                current_lab = {
                    'name': val_a,
                    'row': r_idx,
                    'entries': []
                }
                labs_list.append(current_lab)
            elif current_lab and any(val_a.startswith(d) for d in ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']):
                day = val_a.split()[0]
                for col in ['B', 'C', 'D', 'E', 'G', 'H', 'I', 'J']:
                    txt = cells.get(col, '').strip()
                    if txt and txt != 'BREAK':
                        current_lab['entries'].append({'day': day, 'col': col, 'text': txt})

        # 4. Parse Room Wise Sheet
        room_rows = parse_sheet_rows(z, sheet_targets['ROOM WISE'], shared_strings)
        rooms_list = []
        current_room = None
        for r_idx, cells in room_rows:
            val_a = cells.get('A', '').strip()
            if '-' in val_a and ('TIME TABLE' not in val_a) and ('UNIVERSITY' not in val_a) and not re.match(r'^[B|C|D|E|G|H]-\d+', val_a):
                tokens = re.findall(r'([A-Z0-9]+)\s*[-:]\s*([A-Za-z0-9\.\s]+?)(?=\s+[A-Z0-9]+\s*[-:]|$)', val_a)
                for abbr, full in tokens:
                    legend_map[abbr.strip()] = full.strip()

            if val_a and (re.match(r'^[A-Z]-\d+', val_a) or 'ROOM' in val_a.upper() or 'HALL' in val_a.upper() or 'LH-' in val_a.upper()):
                current_room = {
                    'name': val_a,
                    'row': r_idx,
                    'entries': []
                }
                rooms_list.append(current_room)
            elif current_room and any(val_a.startswith(d) for d in ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']):
                day = val_a.split()[0]
                for col in ['B', 'C', 'D', 'E', 'G', 'H', 'I', 'J']:
                    txt = cells.get(col, '').strip()
                    if txt and txt != 'BREAK':
                        current_room['entries'].append({'day': day, 'col': col, 'text': txt})

        print(f"Audit Summary:")
        print(f"- Total Faculty in FACULTY sheet: {len(faculty_list)}")
        print(f"- Total Classes in CLASS WISE sheet: {len(classes_list)}")
        print(f"- Total Labs in LAB WISE sheet: {len(labs_list)}")
        print(f"- Total Rooms in ROOM WISE sheet: {len(rooms_list)}")
        print(f"- Total Legend Abbreviations mapped: {len(legend_map)}")

        print("\n--- SAMPLE FACULTY & LOADS ---")
        for f in faculty_list[:12]:
            print(f"  {f['name']} | Configured Load: {f['load']} | Extracted Entries: {len(f['entries'])}")

        print("\n--- ALL CLASSES IN CLASS WISE SHEET ---")
        for c in classes_list:
            print(f"  Row {c['row']:3d}: {c['name']} ({len(c['entries'])} entries)")

        print("\n--- ALL LABS IN LAB WISE SHEET ---")
        for l in labs_list:
            print(f"  Row {l['row']:3d}: {l['name']} ({len(l['entries'])} entries)")

        print("\n--- ALL ROOMS IN ROOM WISE SHEET ---")
        for r in rooms_list:
            print(f"  Row {r['row']:3d}: {r['name']} ({len(r['entries'])} entries)")

        print("\n--- SAMPLE ABBREVIATIONS FROM LEGENDS ---")
        for k, v in list(legend_map.items())[:20]:
            print(f"  {k} -> {v}")

        # Save parsed structure to scratch for subsequent deep checks
        with open('scripts/parsed_tt_audit.json', 'w') as out:
            json.dump({
                'faculty': faculty_list,
                'classes': classes_list,
                'labs': labs_list,
                'rooms': rooms_list,
                'legends': legend_map
            }, out, indent=2)

run_deep_audit()
