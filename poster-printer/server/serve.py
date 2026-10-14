"""Ready Poster Printer — one-process local server for the built app.

Serves the static build (dist/ or ./app next to this file) and, when the optional AI extras are installed
(rembg + onnxruntime, see setup-ai.*), the background-removal API at /api/cutout in the same process.
Standard library only for the static part: any Python 3.9+ works.

usage: python3 server/serve.py [--port 5180] [--host 127.0.0.1] [--root PATH] [--no-open]
"""
import argparse, io, json, mimetypes, os, socket, sys, threading, webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
for ext, typ in {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2',
                 '.svg': 'image/svg+xml', '.webp': 'image/webp', '.wasm': 'application/wasm'}.items():
    mimetypes.add_type(typ, ext)

MODEL = os.environ.get('CUT_MODEL', 'isnet-general-use')
MAX_BYTES = 20 * 1024 * 1024
_session, _lock = None, threading.Lock()

def ai_available():
    try:
        import rembg, PIL  # noqa: F401
        return True
    except Exception:
        return False

def cutout(data: bytes) -> bytes:
    global _session
    from PIL import Image
    from rembg import new_session, remove
    im = Image.open(io.BytesIO(data)).convert('RGB')
    im.thumbnail((1024, 1024), Image.LANCZOS)
    with _lock:
        if _session is None:
            _session = new_session(MODEL)
        out = remove(im, session=_session)
    buf = io.BytesIO(); out.save(buf, 'PNG', optimize=True)
    return buf.getvalue()

class Handler(SimpleHTTPRequestHandler):
    def _json(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)

    def end_headers(self):
        p = self.path.split('?')[0]
        # hashed assets can be cached forever; html must revalidate so updates show up
        self.send_header('Cache-Control', 'public, max-age=31536000, immutable' if p.startswith('/assets/') else 'no-cache')
        super().end_headers()

    def do_GET(self):
        p = self.path.split('?')[0].rstrip('/')
        if p in ('/api/health', '/api/cutout/health'):
            ok = ai_available()
            return self._json(200 if ok else 503, {'ok': ok, 'model': MODEL, 'loaded': _session is not None, 'hint': None if ok else 'run setup-ai (see README-DIST)'})
        return super().do_GET()

    def do_POST(self):
        if self.path.split('?')[0].rstrip('/') != '/api/cutout':
            return self._json(404, {'error': 'not found'})
        if not ai_available():
            return self._json(503, {'error': 'AI cut-out not installed — run setup-ai'})
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0 or n > MAX_BYTES:
            return self._json(413, {'error': 'empty or too large'})
        try:
            b = cutout(self.rfile.read(n))
        except Exception as e:  # bad image or model failure
            return self._json(400, {'error': str(e)})
        self.send_response(200); self.send_header('Content-Type', 'image/png'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)

    def log_message(self, fmt, *args):
        if '/api/' in (args[0] if args else ''):
            sys.stderr.write('[rea] ' + fmt % args + '\n')

def free_port(host, start):
    for p in range(start, start + 50):
        with socket.socket() as s:
            try:
                s.bind((host, p)); return p
            except OSError:
                continue
    raise SystemExit('no free port found')

class Server(ThreadingHTTPServer):
    # a browser opens many connections at once (image thumbnails, fonts); the default backlog of 5 resets some of them
    request_queue_size = 128


def main():
    ap = argparse.ArgumentParser(description='Ready Poster Printer local server')
    ap.add_argument('--port', type=int, default=int(os.environ.get('REA_PORT', 5180)))
    ap.add_argument('--host', default=os.environ.get('REA_HOST', '127.0.0.1'))
    ap.add_argument('--root', default=None)
    ap.add_argument('--no-open', action='store_true')
    a = ap.parse_args()
    root = a.root or next((r for r in (os.path.join(HERE, '..', 'app'), os.path.join(HERE, '..', 'dist')) if os.path.exists(os.path.join(r, 'index.html'))), None)
    if not root:
        raise SystemExit('No built app found (expected ../app or ../dist). Run `npm run build` first.')
    port = free_port(a.host, a.port)
    url = f'http://{"localhost" if a.host in ("127.0.0.1", "0.0.0.0") else a.host}:{port}/'
    srv = Server((a.host, port), partial(Handler, directory=os.path.abspath(root)))
    print(f'Ready Poster Printer  →  {url}', flush=True)
    print(f'  palettes  →  {url}color.html   ·   deck  →  {url}?view=deck', flush=True)
    print(f'  AI cut-out: {"on (" + MODEL + ")" if ai_available() else "off (optional: run setup-ai)"}', flush=True)
    print('  Ctrl+C to stop.', flush=True)
    if not a.no_open:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print('\nbye')

if __name__ == '__main__':
    main()
