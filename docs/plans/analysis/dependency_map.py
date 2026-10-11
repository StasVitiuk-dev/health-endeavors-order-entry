#!/usr/bin/env python3
"""Read-only dependency map of owner-login.html (no changes to the file).

Run:  python3 docs/plans/analysis/dependency_map.py > /tmp/depmap.txt

It finds every top-level declaration inside initApp() (indent = 4 spaces),
assigns each to an "area" by line range, and reports which declarations each
area uses from other areas, which shared variables are written where, and
where the database is called. It is a text scan, not a JavaScript parser, so
treat the numbers as a close guide rather than exact truth.
"""
import re, sys, collections, json, os

SRC = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'owner-login.html')
lines = open(SRC, encoding='utf-8').read().split('\n')

# Areas by starting line (1-based), from the section comments in the file.
AREAS = [
    (1740, 'core'), (1778, 'helpers'), (1798, 'theme'), (1826, 'helpers'), (1858, 'auth'),
    (2048, 'shell'), (2069, 'shell'), (2169, 'search'), (2192, 'labels'), (2289, 'search'), (2431, 'shell'),
    (2635, 'feedback'), (2703, 'loading'), (2749, 'help'), (2873, 'palette'), (3001, 'keyboard'),
    (3077, 'activity'), (3387, 'inspector'), (3692, 'attention'), (3873, 'calendar'), (3914, 'keyboard'),
    (4016, 'shell'), (4108, 'inventory'), (4153, 'purchasing'), (4669, 'compliance'), (4838, 'compliance'),
    (5049, 'calendar'), (5504, 'loading'), (5523, 'orders'), (5651, 'tasks'), (5734, 'compliance'),
    (5776, 'operations'), (6057, 'orders'), (6250, 'operations'), (6993, 'compliance'), (7077, 'operations'),
    (7240, 'compliance'), (7840, 'inventory'), (8168, 'returns'), (8501, 'money'), (8701, 'money'),
    (9020, 'core'),
]
def area_of(n):
    a = AREAS[0][1]
    for start, name in AREAS:
        if n >= start: a = name
    return a

DECL = re.compile(r'^    (?:async )?function ([A-Za-z_$][\w$]*)\s*\(|^    (?:const|let) ([A-Za-z_$][\w$]*)\b')
START, END = 1740, 9025
decls = []  # (name, kind, line)
for i in range(START - 1, END):
    m = DECL.match(lines[i])
    if m:
        name = m.group(1) or m.group(2)
        kind = 'function' if m.group(1) else ('let' if lines[i].lstrip().startswith('let') else 'const')
        decls.append((name, kind, i + 1))
        # let A = 1, B = 2 on one line
        if kind == 'let':
            for extra in re.findall(r',\s*([A-Za-z_$][\w$]*)\s*=', lines[i]):
                decls.append((extra, 'let', i + 1))
names = {d[0]: d for d in decls}

# Body of each declaration = its line up to the next top-level declaration.
starts = sorted(set(d[2] for d in decls))
body_of = {}
for name, kind, ln in decls:
    nxt = next((s for s in starts if s > ln), END)
    body_of[name] = '\n'.join(lines[ln - 1:nxt - 1])

ident = re.compile(r'(?<![\w$.])([A-Za-z_$][\w$]*)\b')
uses = collections.defaultdict(set)
for name, body in body_of.items():
    for tok in set(ident.findall(body)):
        if tok in names and tok != name:
            uses[name].add(tok)

# Whole-file usage by area (includes anonymous top-level handlers).
used_in_areas = collections.defaultdict(set)
for i in range(START - 1, END):
    a = area_of(i + 1)
    for tok in set(ident.findall(lines[i])):
        if tok in names:
            used_in_areas[tok].add(a)

# Writes to shared `let` variables, by area.
writes = collections.defaultdict(set)
for name, kind, ln in decls:
    if kind != 'let': continue
    pat = re.compile(r'(?<![\w$.])' + re.escape(name) + r'\s*(=(?!=)|\+\+|--|\+=|-=)')
    for i in range(START - 1, END):
        if i + 1 == ln: continue
        if pat.search(lines[i]):
            writes[name].add(area_of(i + 1))

# Database calls by area and table.
db = collections.defaultdict(collections.Counter)
for i in range(START - 1, END):
    for t in re.findall(r"\.from\('([a-z_]+)'\)", lines[i]):
        if 'storage' in lines[i]: continue
        db[area_of(i + 1)][t] += 1
    for f in re.findall(r"\.rpc\('([a-z_]+)'", lines[i]):
        db[area_of(i + 1)]['rpc:' + f] += 1

# Cross-area dependencies (declaration in area X used by code in area Y).
cross = collections.defaultdict(collections.Counter)
for name, (n, kind, ln) in names.items():
    home = area_of(ln)
    for a in used_in_areas[name]:
        if a != home:
            cross[a][home] += 1

out = sys.stdout
print('# Declarations inside initApp():', len(decls),
      '({} functions, {} const, {} let)'.format(*[sum(1 for d in decls if d[1] == k) for k in ('function', 'const', 'let')]), file=out)
print('\n## Shared mutable state (`let`) and which areas write it', file=out)
for name, kind, ln in decls:
    if kind == 'let':
        print(f'- {name} (line {ln}, {area_of(ln)}): used in {sorted(used_in_areas[name])}; written in {sorted(writes[name]) or ["(only at declaration)"]}', file=out)
print('\n## Declarations used by 3 or more areas (shared utilities)', file=out)
for name, (n, kind, ln) in sorted(names.items(), key=lambda kv: -len(used_in_areas[kv[0]])):
    if len(used_in_areas[name]) >= 3:
        print(f'- {name} ({kind}, line {ln}, {area_of(ln)}): {len(used_in_areas[name])} areas: {", ".join(sorted(used_in_areas[name]))}', file=out)
print('\n## Cross-area dependencies (area -> areas it borrows from: count of names)', file=out)
for a in sorted(cross):
    print(f'- {a}: ' + ', '.join(f'{b}({c})' for b, c in cross[a].most_common()), file=out)
print('\n## Database access by area', file=out)
for a in sorted(db):
    print(f'- {a}: ' + ', '.join(f'{t}×{c}' for t, c in db[a].most_common()), file=out)
print('\n## Functions reassigned after declaration (monkey-patched)', file=out)
for name, kind, ln in decls:
    if kind == 'function':
        for i in range(ln, END):
            if re.match(r'^\s*' + re.escape(name) + r'\s*=\s*function', lines[i]):
                print(f'- {name}: declared line {ln}, reassigned line {i + 1}', file=out)
