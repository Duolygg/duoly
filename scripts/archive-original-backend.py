"""Create a non-executable archive of the exact original Duoly backend.

Usage: python3 scripts/archive-original-backend.py --source /path/to/original/repo
No source checkout mutation, network requests, credentials or prototype execution.
"""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile

REVISION = '7f0299fe35d4ebbba1ebea36f1ecd46bab5f0280'
REPOSITORY = 'https://github.com/duoly-admin/duoly'
ROOT = Path(__file__).resolve().parents[1]

def git(source, *args):
    return subprocess.run(['git', '-C', str(source), *args], check=True,
                          capture_output=True).stdout

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path)
    args = parser.parse_args()
    inventory = json.loads((ROOT / 'docs/product/backend-salvage.json').read_text())
    entries = inventory['entries']
    actual = {}
    for line in git(args.source, 'ls-tree', '-r', REVISION).decode().splitlines():
        metadata, path = line.split('\t', 1)
        if ((path.startswith('lib/') and path.endswith('.js')) or
                (path.startswith('app/api/') and path.endswith('/route.js')) or
                path == 'instrumentation.js'):
            actual[path] = metadata.split()[2]
    assert len(actual) == 78, 'Unexpected original backend scope'
    declared = {row['source_path']: row['git_blob_sha'] for row in entries}
    assert len(declared) == len(entries) and declared == actual, 'Inventory/tree mismatch'
    provenance = {'repository': REPOSITORY, 'revision': REVISION,
                  'files': actual, 'warning': 'Reference only. Do not execute prototype persistence or payments.'}
    output = ROOT / 'docs/source-archives/duoly-next-backend-7f0299f.tar.gz'
    output.parent.mkdir(parents=True, exist_ok=True)
    raw = io.BytesIO()
    with gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0) as compressed:
        with tarfile.open(mode='w', fileobj=compressed) as archive:
            for path, blob in sorted(actual.items()):
                data = git(args.source, 'show', f'{REVISION}:{path}')
                assert hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == blob
                info = tarfile.TarInfo(path); info.size = len(data); info.mode = 0o644
                archive.addfile(info, io.BytesIO(data))
            data = (json.dumps(provenance, sort_keys=True, indent=2) + '\n').encode()
            info = tarfile.TarInfo('PROVENANCE.json'); info.size = len(data); info.mode = 0o644
            archive.addfile(info, io.BytesIO(data))
    data = raw.getvalue()
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        assert len(archive.getmembers()) == 79
        for path, blob in actual.items():
            stored = archive.extractfile(path)
            assert stored is not None, 'Missing archived source file'
            content = stored.read()
            assert hashlib.sha1(b'blob '+str(len(content)).encode()+b'\0'+content).hexdigest() == blob
    output.write_bytes(data)
    print(json.dumps({'archive': str(output), 'source_files': len(actual),
                      'archive_entries': 79, 'bytes': len(data),
                      'sha256': hashlib.sha256(data).hexdigest(), 'verified': True}))

if __name__ == '__main__':
    main()
