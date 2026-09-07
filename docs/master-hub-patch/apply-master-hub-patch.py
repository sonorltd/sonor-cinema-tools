#!/usr/bin/env python3
"""Insert the Cinema Tools card into Master Hub (sonor-master/index.html).
Run from the workspace root:  python3 "APP - Cinema Tools/docs/master-hub-patch/apply-master-hub-patch.py"
Idempotent — safe to re-run. Backs up index.html first (archive rule)."""
import os, re, shutil, sys, datetime
here = os.path.dirname(os.path.abspath(__file__))
hub = None
for cand in ['sonor-master/index.html', 'APP - Master Hub/index.html', 'Master Hub/index.html']:
    if os.path.exists(cand): hub = cand; break
if not hub:
    sys.exit('Master Hub index.html not found — run from the workspace root (folder containing sonor-master/)')
src = open(hub, encoding='utf-8').read()
card = open(os.path.join(here, 'card.html'), encoding='utf-8').read()
stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M')
shutil.copy(hub, hub + '.bak-' + stamp)
changed = False
if 'data-app-key="cinema-tools"' not in src:
    m = re.search(r'    <a class="app-card" data-app-key="cinema-aesthetic".*?</a>\n\n', src, re.S)
    if not m: sys.exit('Could not find the Cinema Aesthetic card to insert after')
    src = src[:m.end()] + card + src[m.end():]
    changed = True
if "'cinema-tools'" not in src.split('const APP_TYPES')[1][:2000]:
    src = src.replace("printworkwear:'app', inventory:'app', master:'app', workshop:'app', seating:'app',",
                      "printworkwear:'app', inventory:'app', master:'app', workshop:'app', seating:'app', 'cinema-tools':'app',", 1)
    changed = True
if changed:
    open(hub, 'w', encoding='utf-8').write(src)
    print('Master Hub patched:', hub, '(backup', hub + '.bak-' + stamp + ')')
else:
    print('Master Hub already has the Cinema Tools card — nothing to do')
# workspace-apps.tsv (if present) — one row, tab-separated: key  name  type  path
tsv = 'workspace-apps.tsv'
if os.path.exists(tsv):
    t = open(tsv, encoding='utf-8').read()
    if 'cinema-tools' not in t:
        with open(tsv, 'a', encoding='utf-8') as f:
            f.write(('' if t.endswith('\n') else '\n') + 'cinema-tools\tCinema Tools\tapp\tAPP - Cinema Tools/dashboard/sonor-cinema-tools.html\n')
        print('workspace-apps.tsv: row added (check column order matches the file header)')
