import json

with open('scripts/parsed_tt_audit.json') as fp:
    wb_data = json.load(fp)

for i, f in enumerate(wb_data['faculty']):
    if any(k in f['name'] for k in ['HVPE', 'EVS', 'NCER', 'SETUP', 'OPS', 'k', 'NF']):
        print(f"Index {i:2d}: Name='{f['name']}' | Row={f['row']} | Load={f['load']} | EntriesCount={len(f['entries'])}")
        for e in f['entries'][:5]:
            print(f"     {e['day']} col {e['col']}: {e['text']}")

