import zipfile
import xml.etree.ElementTree as ET
import re

NS = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def parse_shared_strings(z):
    try:
        xml_content = z.read('xl/sharedStrings.xml')
        root = ET.fromstring(xml_content)
        strings = []
        for si in root.findall('ns:si', NS):
            text = "".join(t.text for t in si.findall('.//ns:t', NS) if t.text)
            strings.append(text)
        return strings
    except KeyError:
        return []

def get_sheet_targets(z):
    wb_tree = ET.fromstring(z.read('xl/workbook.xml'))
    rels_tree = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    
    rel_map = {}
    for rel in rels_tree:
        rel_map[rel.attrib['Id']] = rel.attrib['Target']
        
    sheets = []
    for s in wb_tree.findall('.//ns:sheet', NS):
        name = s.attrib['name']
        rId = s.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
        target = rel_map[rId]
        if not target.startswith('xl/'):
            target = 'xl/' + target
        sheets.append((name, target))
    return sheets

def parse_sheet_rows(z, target, shared_strings):
    sheet_tree = ET.fromstring(z.read(target))
    sheet_data = sheet_tree.find('ns:sheetData', NS)
    
    rows = []
    for r in sheet_data.findall('ns:row', NS):
        r_idx = int(r.attrib.get('r', 0))
        row_cells = {}
        for c in r.findall('ns:c', NS):
            ref = c.attrib.get('r', '')
            col_letter = re.match(r'([A-Z]+)', ref).group(1)
            t = c.attrib.get('t', '')
            v = c.find('ns:v', NS)
            val = ""
            if v is not None and v.text is not None:
                val = v.text
                if t == 's':
                    val = shared_strings[int(val)] if int(val) < len(shared_strings) else val
            elif t == 'inlineStr':
                is_el = c.find('ns:is', NS)
                if is_el is not None:
                    val = "".join(t_el.text for t_el in is_el.findall('.//ns:t', NS) if t_el.text)
            row_cells[col_letter] = val
        rows.append((r_idx, row_cells))
    return rows

with zipfile.ZipFile('tt.xlsx') as z:
    shared_strings = parse_shared_strings(z)
    sheet_targets = get_sheet_targets(z)
    for name, target in sheet_targets:
        rows = parse_sheet_rows(z, target, shared_strings)
        print(f"\n================ SHEET: {name} ({len(rows)} rows) ================")
        for r_idx, cells in rows[:25]:
            vals = [f"{col}:{val}" for col, val in sorted(cells.items()) if val.strip()]
            if vals:
                print(f"Row {r_idx:2d}: " + " | ".join(vals[:12]))
