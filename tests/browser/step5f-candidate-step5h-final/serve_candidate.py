"""Verify and serve only this portable review package. No application mutation."""
import argparse
import functools
import hashlib
import http.server
import json
import pathlib
import urllib.parse


def verify_package(root):
    manifest = json.loads((root / 'PACKAGE_MANIFEST.json').read_text())
    if manifest.get('status') != 'PACKAGE_BYTES_VERIFIED':
        raise ValueError('Unverified package')
    for name, expected in manifest['files'].items():
        candidate = root / name
        if pathlib.PurePosixPath(name).is_absolute() or '..' in pathlib.PurePosixPath(name).parts or not candidate.is_file() or candidate.is_symlink():
            raise ValueError('Invalid package path: ' + name)
        if root.resolve() not in candidate.resolve().parents:
            raise ValueError('Package path escapes root')
        data = candidate.read_bytes()
        if len(data) != expected['bytes'] or hashlib.sha256(data).hexdigest() != expected['sha256']:
            raise ValueError('Package mismatch: ' + name)
    return manifest


class ReviewHandler(http.server.SimpleHTTPRequestHandler):
    allowed_files = frozenset()

    def send_head(self):
        name = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path).lstrip('/') or 'index.html'
        if name not in self.allowed_files:
            self.send_error(404, 'Not in verified package')
            return None
        return super().send_head()

    def list_directory(self, path):
        self.send_error(403, 'Directory listing disabled')
        return None

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bind', default='127.0.0.1', choices=['127.0.0.1', '0.0.0.0'])
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    root = pathlib.Path(__file__).resolve().parent
    manifest = verify_package(root)
    ReviewHandler.allowed_files = frozenset([*manifest['files'], 'PACKAGE_MANIFEST.json'])
    print('Candidate source:', manifest['candidateSource'], flush=True)
    print('Review URL: http://localhost:%d/?measurePerformance=1' % args.port, flush=True)
    if args.bind == '0.0.0.0':
        print('Explicit network bind: this server has no authentication or TLS. Use an authorized HTTPS review host for physical devices. Plain LAN HTTP is not a secure context and is not a supported physical-device qualification path.', flush=True)
    http.server.ThreadingHTTPServer((args.bind, args.port), functools.partial(ReviewHandler, directory=str(root))).serve_forever()
