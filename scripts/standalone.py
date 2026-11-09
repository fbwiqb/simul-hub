import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / '.standalone'

SIMS = {
    'spectrum': 'spectrum-sim',
    'stellar-evolution': 'stellar-evolution-sim',
    'quake-volcano': 'quake-volcano-sim',
    'central-dogma': 'central-dogma-sim',
    'thermalbalance': 'radiation-balance-sim',
    'magnet': 'magnet-sim',
    'Evosnail': 'evosnail-sim',
    'enso-simulation': 'enso-sim',
    'acid-base': 'acid-base-sim',
    'neuronsimul': 'action-potential-sim',
    'musclesimul': 'muscle-sim',
    'glycolysis': 'cell-respiration-sim',
}

SKIP = ('.test.js', '.test.mjs')


def build(folder, project):
    dst = OUT / project
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(ROOT / folder, dst, ignore=lambda d, names: [n for n in names if n.endswith(SKIP)])
    shutil.copytree(ROOT / 'assets', dst / 'assets')
    (dst / 'vercel.json').write_text(json.dumps({'outputDirectory': '.', 'buildCommand': '', 'installCommand': ''}), encoding='utf-8')
    vercel_dir = dst / '.vercel'
    keep = ROOT / '.standalone-links' / project / 'project.json'
    if keep.exists():
        vercel_dir.mkdir(exist_ok=True)
        shutil.copy(keep, vercel_dir / 'project.json')
    return dst


def deploy(dst, project):
    env = dict(os.environ)
    env['NODE_OPTIONS'] = '--require=C:/Users/신도경/.claude/codex-legacy/helpers/vercel-ascii-host.cjs'
    cfg = str(Path.home() / '.vercel-profiles' / 'simul')
    r = subprocess.run(['vercel', 'deploy', '--prod', '--yes', '--global-config', cfg],
                       cwd=dst, env=env, capture_output=True, text=True, encoding='utf-8', shell=True)
    print(project, r.returncode, (r.stdout or '').strip().splitlines()[-1:] , (r.stderr or '').strip().splitlines()[-2:])
    linked = dst / '.vercel' / 'project.json'
    if linked.exists():
        keep = ROOT / '.standalone-links' / project
        keep.mkdir(parents=True, exist_ok=True)
        shutil.copy(linked, keep / 'project.json')


if __name__ == '__main__':
    names = sys.argv[1:] or list(SIMS)
    for folder in names:
        project = SIMS[folder]
        dst = build(folder, project)
        if os.environ.get('BUILD_ONLY') != '1':
            deploy(dst, project)
        else:
            print('built', dst)
