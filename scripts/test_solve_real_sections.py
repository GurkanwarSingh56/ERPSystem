import json
import subprocess
from test_cp_sat_real_db import db_data

# Let's test CP-SAT solver directly on each real section from the database
for s in db_data.get('sections', []):
    allocs = s.get('allocations') or []
    if not allocs:
        continue
    
    payload = {
        "sections": [{"id": s["id"], "name": f"{s['course_code']} Sem {s['semester']} {s['name']}"}],
        "slots": db_data.get("slots", []),
        "rooms": db_data.get("rooms", []),
        "working_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
        "allocations": allocs,
        "existing_busy": {"teachers": [], "rooms": []},
        "preferences": {"max_theory_per_day": 1}
    }
    
    p = subprocess.Popen(
        ["./.venv/bin/python", "src/server/python/timetable_solver.py"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    stdout, stderr = p.communicate(json.dumps(payload))
    res = json.loads(stdout.strip())
    print(f"Section {s['course_code']} Sem {s['semester']} {s['name']} (Required: {sum(a['weekly_hours'] for a in allocs)} hrs):")
    print(f"  Status: {res.get('status')} | Scheduled: {res.get('total_periods_scheduled')} periods | Reason: {res.get('diagnostics', {}).get('reason')}")
    if res.get('error'):
        print(f"  Error: {res.get('error')}")

