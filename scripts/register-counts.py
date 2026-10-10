#!/usr/bin/env python3
"""Recomputes the summary tables of docs/security/01-SECURITY-REQUIREMENTS.md
from the requirement rows (status column). Run after changing a row:
    python3 scripts/register-counts.py
"""
import re
from collections import Counter, defaultdict
from pathlib import Path

PATH = Path(__file__).resolve().parent.parent / 'docs/security/01-SECURITY-REQUIREMENTS.md'
DONE, PARTIAL, TODO = '✅ Fatto', '🟡 Parziale', '🔴 Da fare'

text = PATH.read_text()
rows = re.findall(r'^\| (SR-[A-Z]+)-\d+ \|.*?\| (P\d) \| ([^|]+) \|', text, re.M)
total = Counter(status.strip() for _, _, status in rows)
by_area = defaultdict(Counter)
open_p0 = Counter()
for area, prio, status in rows:
    by_area[area][status.strip()] += 1
    if prio == 'P0' and status.strip() != DONE:
        open_p0[area] += 1

text = re.sub(
    r'^\| \*\*\d+\*\* \| \d+ \| \d+ \| \d+ \|$',
    f'| **{len(rows)}** | {total[DONE]} | {total[PARTIAL]} | {total[TODO]} |',
    text, count=1, flags=re.M,
)

def area_row(match: re.Match) -> str:
    label, area = match.group(1), match.group(2)
    c = by_area[area]
    return f'| {label} | {sum(c.values())} | {c[DONE]} | {c[PARTIAL]} | {c[TODO]} | {open_p0[area]} |'

text = re.sub(r'^\| ((SR-[A-Z]+) · [^|]+?) \| \d+ \| \d+ \| \d+ \| \d+ \| \d+ \|$', area_row, text, flags=re.M)
PATH.write_text(text)
print(f'{len(rows)} requirements: {total[DONE]} done, {total[PARTIAL]} partial, {total[TODO]} to do')
