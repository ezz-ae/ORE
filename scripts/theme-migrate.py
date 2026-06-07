#!/usr/bin/env python3
"""One-shot migration: legacy slate palette + hardcoded brand hex -> theme tokens.

Scoped to the Freehold Intelligence product app and its shared components so the
public marketing site is untouched. Ordered so opacity variants collapse onto a
single token. Idempotent: re-running is a no-op once migrated.
"""
import re, pathlib, sys

ROOTS = ["app/freehold-intelligence", "components/freehold"]

# (regex, replacement) — applied in order. \b guards avoid partial hits.
RULES = [
    # ── hardcoded brand / shell hex -> tokens (case-insensitive on hex) ──
    (re.compile(r"\[#D4AF37\]", re.I), "gold"),
    (re.compile(r"\[#0D1520\]", re.I), "surface"),
    (re.compile(r"\[#0D1117\]", re.I), "ink"),
    (re.compile(r"\[#06090F\]", re.I), "chrome"),
    (re.compile(r"\[#060910\]", re.I), "chrome"),
    (re.compile(r"\[#090D16\]", re.I), "app"),
    (re.compile(r"\[#090C12\]", re.I), "app"),
    (re.compile(r"\[#0A0E14\]", re.I), "app"),

    # ── borders ──
    (re.compile(r"\bborder-slate-800(/\d+)?\b"), "border-line"),
    (re.compile(r"\bborder-slate-700(/\d+)?\b"), "border-line-strong"),
    (re.compile(r"\bborder-slate-600(/\d+)?\b"), "border-line-strong"),

    # ── dividers ──
    (re.compile(r"\bdivide-slate-800(/\d+)?\b"), "divide-line"),
    (re.compile(r"\bdivide-slate-700(/\d+)?\b"), "divide-line"),

    # ── rings ──
    (re.compile(r"\bring-slate-800(/\d+)?\b"), "ring-line"),
    (re.compile(r"\bring-slate-700(/\d+)?\b"), "ring-line-strong"),
    (re.compile(r"\bring-slate-600(/\d+)?\b"), "ring-line-strong"),

    # ── gradient stops (before bare bg rules) ──
    (re.compile(r"\b(from|via|to)-slate-900(/\d+)?\b"), r"\1-surface"),
    (re.compile(r"\b(from|via|to)-slate-800(/\d+)?\b"), r"\1-surface-2"),

    # ── backgrounds ──
    (re.compile(r"\bbg-slate-900(/\d+)?\b"), "bg-surface"),
    (re.compile(r"\bbg-slate-800(/\d+)?\b"), "bg-surface-2"),
    (re.compile(r"\bbg-slate-700(/\d+)?\b"), "bg-surface-3"),
    (re.compile(r"\bbg-slate-600(/\d+)?\b"), "bg-surface-3"),
]

counts = {}
files_changed = 0
for root in ROOTS:
    for path in pathlib.Path(root).rglob("*.tsx"):
        text = original = path.read_text()
        for rx, repl in RULES:
            text, n = rx.subn(repl, text)
            if n:
                counts[rx.pattern] = counts.get(rx.pattern, 0) + n
        if text != original:
            path.write_text(text)
            files_changed += 1

print(f"files changed: {files_changed}")
total = 0
for pat, n in sorted(counts.items(), key=lambda x: -x[1]):
    total += n
    print(f"  {n:5d}  {pat}")
print(f"total replacements: {total}")
