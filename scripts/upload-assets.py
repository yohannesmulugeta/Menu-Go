"""Upload static assets using a one-hour, assets-only token passed on stdin."""
import base64
import json
import mimetypes
from pathlib import Path
import sys
import termios
import urllib.request
import urllib.error
import uuid

if sys.stdin.isatty():
    attrs = termios.tcgetattr(sys.stdin.fileno())
    attrs[3] &= ~termios.ECHO
    termios.tcsetattr(sys.stdin.fileno(), termios.TCSANOW, attrs)
print('Ready for scoped upload session on stdin.', flush=True)
config = json.loads(sys.stdin.readline())
root = Path(config['directory']).resolve()
manifest = json.loads(Path(config['manifest_path']).read_text())
paths = {v['hash']: root / k.lstrip('/') for k, v in manifest.items()}
completion = config['jwt'] if not config['buckets'] else None
for bucket in config['buckets']:
    boundary = 'MenuGoAsset' + uuid.uuid4().hex
    parts = []
    for hash_value in bucket:
        path = paths[hash_value]
        parts.extend([('--' + boundary).encode(), ('Content-Disposition: form-data; name="' + hash_value + '"; filename="' + path.name + '"').encode(), ('Content-Type: ' + (mimetypes.guess_type(path.name)[0] or 'application/octet-stream')).encode(), b'', base64.b64encode(path.read_bytes())])
    parts.extend([('--' + boundary + '--').encode(), b''])
    request = urllib.request.Request('https://api.cloudflare.com/client/v4/accounts/' + config['account_id'] + '/workers/assets/upload?base64=true', data=b'\r\n'.join(parts), method='POST', headers={'Authorization': 'Bearer ' + config['jwt'], 'Content-Type': 'multipart/form-data; boundary=' + boundary})
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            data = json.load(response)
    except urllib.error.HTTPError as error:
        data = json.loads(error.read())
        raise RuntimeError('Asset upload failed: HTTP ' + str(error.code) + ' ' + json.dumps(data.get('errors', []))) from None
    if not data.get('success'):
        raise RuntimeError('Asset upload failed: ' + json.dumps(data.get('errors', [])))
    if data.get('result', {}).get('jwt'):
        completion = data['result']['jwt']
if not completion:
    raise RuntimeError('Asset upload did not return a completion token.')
print(json.dumps({'completion_jwt': completion, 'uploaded_assets': len(manifest)}), flush=True)
