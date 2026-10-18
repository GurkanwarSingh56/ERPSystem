import json

with open('scripts/parsed_tt_audit.json') as fp:
    wb_data = json.load(fp)

for c in wb_data['classes']:
    if 'CSE-3(A)' in c['name'] or 'CSE (A) 5TH' in c['name']:
        print(f"\n================ {c['name']} ================")
        for e in c['entries']:
            if e['text'] not in ['BREAK', '']:
                print(f"  {e['day'][:3]:3s} Col {e['col']}: {e['text']}")

