"""Restore deployment photo assets from their Cloudflare copies when needed."""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import re
import urllib.request

root = Path(__file__).resolve().parent.parent
directories = [root / 'public/migrated-media', root / 'public/fonts']
entries = [(directory, name, metadata) for directory in directories
           for name, metadata in json.loads((directory / 'manifest.json').read_text()).items()]
origin = os.environ.get('MENU_MEDIA_ORIGIN', 'https://app.admakidigital.com').rstrip('/')
if not origin.startswith('https://'):
    raise ValueError('MENU_MEDIA_ORIGIN must use HTTPS.')

def restore(entry):
    directory, name, metadata = entry
    if not re.fullmatch(r'[a-f0-9]{24}\.(png|jpg|webp|avif|svg|woff2)', name):
        raise ValueError('Invalid asset filename.')
    path = directory / name
    if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == metadata['sha256']:
        return 0
    request = urllib.request.Request(origin + '/' + directory.name + '/' + name, headers={'User-Agent': 'Mozilla/5.0 MenuGo asset restore'})
    with urllib.request.urlopen(request, timeout=40) as response:
        data = response.read(metadata['size'] + 1)
    if len(data) != metadata['size'] or hashlib.sha256(data).hexdigest() != metadata['sha256']:
        raise ValueError('Photo checksum mismatch: ' + name)
    path.write_bytes(data)
    return 1

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    count = sum(pool.map(restore, entries))
print('Photo assets verified; restored', count, 'files.')
