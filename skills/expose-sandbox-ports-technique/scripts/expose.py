#!/usr/bin/env python3
"""Expose a BayLeaf sandbox web port without putting credentials in tool traffic."""
import argparse
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Arguments(argparse.ArgumentParser):
    def error(self, message):
        # Never echo arbitrary argument values: a mistakenly pasted key stays hidden.
        self.exit(2, 'Invalid arguments. Use --help; never pass credentials as arguments.\n')


def run(port, access='private', revoke=False):
    try:
        path = Path.home() / '.local/share/bayleaf/browser/credentials/owner-key'
        key = path.read_text().strip() if path.exists() else os.environ.get('BAYLEAF_API_KEY', '').strip()
        if not key.startswith('sk-bayleaf-') or key.startswith('sk-bayleaf-grant-'):
            return {'error': 'Personal BayLeaf credential unavailable. Resume browser setup from the dashboard.'}, 1
        url = 'https://api.bayleaf.dev/sandbox/expose' + (f'/{port}' if revoke else '')
        request = urllib.request.Request(url, method='DELETE' if revoke else 'POST',
            data=None if revoke else json.dumps({'port': port, 'access': access}).encode(),
            headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json',
                     'User-Agent': 'BayLeaf-Port-Preview/1'})
        # No environment-configured proxy and no redirects carrying our credential.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        with opener.open(request, timeout=30) as response:
            if revoke:
                return {'revoked': True, 'port': port}, 0
            data = json.loads(response.read(16384))
        parsed = urllib.parse.urlsplit(data['url'])
        if (parsed.scheme != 'https' or not parsed.hostname or
                not parsed.hostname.endswith('.bayleaf-proxies.dev') or
                parsed.username or parsed.password or parsed.port or
                parsed.path not in ('', '/') or parsed.query or parsed.fragment):
            return {'error': 'Unexpected preview response.'}, 1
        from datetime import datetime
        expires = datetime.fromisoformat(data['expires_at'].replace('Z', '+00:00')).isoformat()
        # Reconstruct the allowed output; never print response bodies or exceptions.
        return {'url': 'https://' + parsed.hostname + '/', 'expires_at': expires, 'access': access}, 0
    except urllib.error.HTTPError as error:
        messages = {401:'Your BayLeaf key needs refreshing. Resume browser setup.',
                    403:'A personal BayLeaf key is required.',
                    409:'Start the sandbox and web server before exposing it.',
                    503:'Preview access is temporarily unavailable.'}
        return {'error': messages.get(error.code, 'Preview request failed.'), 'status': error.code}, 1
    except Exception:
        # Exception text can contain URLs, headers, or provider diagnostics.
        return {'error': 'Could not complete the preview request. Check connectivity and try again.'}, 1


def main():
    parser = Arguments(description=__doc__)
    parser.add_argument('port', type=int)
    parser.add_argument('--access', choices=['private', 'public'], default='private')
    parser.add_argument('--revoke', action='store_true')
    args = parser.parse_args()
    if not 3000 <= args.port <= 9999 or args.port == 3100:
        parser.error('unsupported port')
    result, code = run(args.port, args.access, args.revoke)
    print(json.dumps(result))
    return code


if __name__ == '__main__':
    sys.exit(main())
