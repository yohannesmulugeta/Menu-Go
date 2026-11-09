"""Copy the source menu's public photo assets; never reads credentials."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.parse
import urllib.request

root = Path(__file__).resolve().parent.parent
source = json.loads((root / '.migration-private/source-snapshot.json').read_text())
output = root / 'public/migrated-media'
output.mkdir(parents=True, exist_ok=True)
urls = {row[key] for row in source['restaurants'] + source['menu_items']
        for key in ('image_url', 'cover_image_url', 'logo_url') if row.get(key)}
for obj in source['storage_objects']:
    urls.add('https://xwqdyffcbtvqdkrtxpsu.supabase.co/storage/v1/object/public/' + obj['bucket_id'] + '/' + obj['name'])
ALLOWED = {'images.unsplash.com', 'images.pexels.com', 'yohannesmulugeta.github.io', 'xwqdyffcbtvqdkrtxpsu.supabase.co'}
EXT = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/avif': '.avif', 'image/svg+xml': '.svg'}

def download(url):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname not in ALLOWED:
        return url, None, 'Source hostname needs review'
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'MenuGo-Migration/1.0'})
        with urllib.request.urlopen(request, timeout=40) as response:
            if urllib.parse.urlparse(response.url).hostname not in ALLOWED:
                return url, None, 'Redirect hostname needs review'
            content_type = response.headers.get_content_type()
            extension = EXT.get(content_type)
            if not extension:
                return url, None, 'Unexpected content type: ' + content_type
            data = response.read(10 * 1024 * 1024 + 1)
            if len(data) > 10 * 1024 * 1024:
                return url, None, 'Photo exceeds migration size limit'
        name = hashlib.sha256(url.encode()).hexdigest()[:24] + extension
        (output / name).write_bytes(data)
        return url, '/migrated-media/' + name, None
    except Exception as error:
        return url, None, type(error).__name__ + ': ' + str(error)

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    results = list(pool.map(download, sorted(urls)))
mapping = {url: path for url, path, error in results if path}
errors = [{'url': url, 'error': error} for url, path, error in results if error]
(root / '.migration-private/media-map.json').write_text(json.dumps(mapping, indent=2))
(root / '.migration-private/media-errors.json').write_text(json.dumps(errors, indent=2))
print(json.dumps({'copied': len(mapping), 'errors': errors, 'total_bytes': sum(p.stat().st_size for p in output.iterdir())}))
