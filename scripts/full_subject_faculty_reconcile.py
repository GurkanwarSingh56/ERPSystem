import json
import re

with open('scripts/parsed_tt_audit.json') as fp:
    wb_data = json.load(fp)

legend_map = wb_data['legends']

# Manual mappings for known standard abbreviations in Rayat Bahra TT
legend_map.update({
    'AU': 'Er. Akshit Ummat',
    'CS': 'Er. Chetna Saini',
    'SK': 'Er. Supinder Kaur',
    'SD': 'Dr. Sameer Dixit',
    'KA': 'Er. Karan',
    'RK': 'Er. Rajveer Kaur', # in CSE 5A/5B WT is Rajveer Kaur
    'MG': 'Ms. Megha',
    'AP': 'Mr. Anand Parkash',
    'RPK': 'Er. Rupinder Kaur',
    'OM': 'Er. Omkar',
    'RH': 'Er. Rahul',
    'RP': 'Ms. Rupika',
    'DP': 'Er. Deepak / NF-1',
    'PP': 'Er. Palak Puri',
    'JS': 'Er. Jastej Singh',
    'SBK': 'Er. Sarbjeet Kaur',
    'CK': 'Er. Chandandeep Kaur',
    'GS': 'Er. Gursharan Saini',
    'PR': 'Er. Priya',
    'MK': 'Ms. Maninder Kaur',
    'SA': 'Er. Sahil',
    'RA': 'Er. Ram',
    'AT': 'Mr. Anil Thakur',
    'RO': 'Er. Robin',
    'AS': 'Er. Aditya Srivastava',
    'AB': 'Er. Abhishek Singh',
    'IS': 'Er. Inderjeet Singh',
    'RR': 'Er. Ritu Rani',
    'RB': 'Er. Renu Bala',
    'NJ': 'Ms. Neeru Jambal',
})

# Collect all distinct subject tokens per class cohort
class_subjects = {}

for c in wb_data['classes']:
    c_name = c['name']
    subjects = {}
    for e in c['entries']:
        txt = e['text'].strip()
        if not txt or txt in ['LIBRARY', 'BREAK']:
            continue
        # Split token e.g. "WT LAB [G1] RK CL-2" or "DBMS[L] KA B-211"
        # Match subject abbreviation
        m = re.match(r'^([A-Z0-9\+\&\/\s\-]+?)(?:\[([A-Z0-9\s]+)\]|\s+LAB|\s+\[)', txt)
        sub_abbr = m.group(1).strip() if m else txt.split()[0].strip()
        # Clean sub_abbr
        sub_abbr = re.sub(r'\[.*\]', '', sub_abbr).strip()
        if not sub_abbr or sub_abbr in ['LIBRARY', 'BREAK']:
            continue
        
        is_lab = 'LAB' in txt.upper() or '[G1]' in txt or '[G2]' in txt or '[P]' in txt
        key = f"{sub_abbr} ({'Lab' if is_lab else 'Theory'})"
        
        # Detect faculty from legend
        fac = "Unknown"
        for abbr, full_name in legend_map.items():
            if re.search(r'\b' + re.escape(abbr) + r'\b', txt):
                fac = f"{abbr} ({full_name})"
                break
        if fac == "Unknown":
            # Check for institutional
            for inst in ['HVPE', 'EVS', 'NCER', 'OPS', 'ENP', 'SETUP']:
                if inst in txt:
                    fac = f"{inst} (Institutional)"
                    break
        
        if key not in subjects:
            subjects[key] = {'count': 0, 'faculty': set(), 'samples': []}
        subjects[key]['count'] += 1
        subjects[key]['faculty'].add(fac)
        subjects[key]['samples'].append(txt)
    class_subjects[c_name] = subjects

print(f"=== DETAILED CURRICULUM & SUBJECT ALLOCATIONS FROM WORKBOOK ===")
for c_name in ['B.TECH - CSE-3(A) SEM', 'B.TECH - CSE (B)/IT 3RD SEM', 'B.TECH - CSE (A) 5TH SEM', 'B.TECH -CSE(B) 5TH SEM']:
    print(f"\nCohort: {c_name}")
    subs = class_subjects.get(c_name, {})
    for s_name, s_info in sorted(subs.items()):
        fac_str = ", ".join(s_info['faculty'])
        print(f"  - {s_name:25s} | Weekly Hours in TT: {s_info['count']:2d} | Faculty: {fac_str}")

