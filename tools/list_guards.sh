#!/usr/bin/env bash
# outputs available Guard IDs, one per line
grep -oP '^# ---------- \K[^(]+' tools/turn_guard.sh | tr ' ' '-' | sed 's/-$//' | grep -v '^$'