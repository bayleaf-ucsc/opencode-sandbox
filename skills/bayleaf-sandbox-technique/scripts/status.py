#!/usr/bin/env python3
"""Read safe BayLeaf account and sandbox metadata; never print credentials."""
import argparse
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    # Fixed choices prevent using this helper to send the credential elsewhere.
    routes = {'usage':'/usage', 'sandbox':'/sandbox', 'browser':'/sandbox/browser/status'}
    if len(sys.argv) != 2 or sys.argv[1] not in routes:
        print('Usage: status.py usage|sandbox|browser', file=sys.stderr)
        return 2
    try:
        path = Path.home() / '.local/share/bayleaf/browser/credentials/owner-key'
        key = path.read_text().strip() if path.exists() else os.environ.get('BAYLEAF_API_KEY', '').strip()
        if not key.startswith('sk-bayleaf-') or key.startswith('sk-bayleaf-grant-'):
            raise ValueError()
        request = urllib.request.Request('https://api.bayleaf.dev' + routes[sys.argv[1]],
            headers={'Authorization':'Bearer ' + key, 'User-Agent':'BayLeaf-Sandbox-Status/1'})
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        with opener.open(request, timeout=30) as response:
            data = json.loads(response.read(65536))
        allowed = {'usage': ('observed_at','budgets'),
                   'sandbox': ('id','state','cpu','memory','disk','createdAt','autoStopInterval','autoArchiveInterval'),
                   'browser': ('phase','machine','progress','deadline','updated_at','error')}
        result = {k:data[k] for k in allowed[sys.argv[1]] if k in data}
        output = json.dumps(result)
        if key in output:
            raise ValueError()
        print(output)
        return 0
    except urllib.error.HTTPError as error:
        print(json.dumps({'error':'BayLeaf status is unavailable.', 'status':error.code}))
    except Exception:
        print(json.dumps({'error':'Could not read BayLeaf status. Resume setup if your key changed.'}))
    return 1


if __name__ == '__main__':
    sys.exit(main())
