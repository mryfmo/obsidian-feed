#!/usr/bin/env python3
"""
Generate draft_wbs.md skeleton from triage.md
Usage:  tools/gen_wbs.py docs/triage.md > draft_wbs.md
"""
import sys, re, textwrap
src = open(sys.argv[1]).read()
verbs = re.findall(r'\b([a-z]{3,})\b', src, re.I)
with open('draft_wbs.md','w') as f:
    f.write("| Phase | Step | Task | Guard |\n|------|------|------|------|\n")
    for i,v in enumerate(set(verbs)[:5],1):
        f.write(f"| ANA | A-{i} | {v} analysis | – |\n")