"""Local background-removal service for Poster Printer.

POST /api/cutout   body: image bytes (jpeg/png/webp)  ->  image/png with alpha
GET  /api/health   -> {"ok": true, "model": ...}

Uses rembg (MIT) with an open-source segmentation model:
  - isnet-general-use (IS-Net / DIS, Apache-2.0)  [default, light on memory]
  - birefnet-general-lite (BiRefNet, MIT)         [set CUT_MODEL=birefnet-general-lite]
Run:  server/.venv/bin/python server/cutout_server.py   (listens on 127.0.0.1:8787)
"""
import io, json, os, sys, threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from PIL import Image

MODEL = os.environ.get('CUT_MODEL', 'isnet-general-use')
PORT = int(os.environ.get('CUT_PORT', '8787'))
HOST = os.environ.get('CUT_HOST', '127.0.0.1')
MAX_BYTES = 20 * 1024 * 1024
_session = None
_lock = threading.Lock()

def session():
    global _session
    if _session is None:
        from rembg import new_session
        _session = new_session(MODEL)
    return _session

class H(BaseHTTPRequestHandler):
    def _json(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)

    def do_GET(self):
        if self.path.rstrip('/') in ('/api/health', '/health'):
            return self._json(200, {'ok': True, 'model': MODEL, 'loaded': _session is not None})
        self._json(404, {'error': 'not found'})

    def do_POST(self):
        if self.path.rstrip('/') not in ('/api/cutout', '/cutout'):
            return self._json(404, {'error': 'not found'})
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0 or n > MAX_BYTES:
            return self._json(413, {'error': 'empty or too large'})
        data = self.rfile.read(n)
        try:
            im = Image.open(io.BytesIO(data)).convert('RGB')
        except Exception as e:
            return self._json(400, {'error': 'bad image: %s' % e})
        im.thumbnail((1024, 1024), Image.LANCZOS)
        from rembg import remove
        with _lock:  # one inference at a time keeps memory bounded
            out = remove(im, session=session())
        buf = io.BytesIO(); out.save(buf, 'PNG', optimize=True)
        b = buf.getvalue()
        self.send_response(200); self.send_header('Content-Type', 'image/png'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)

    def log_message(self, fmt, *args):
        sys.stderr.write('[cutout] ' + fmt % args + '\n')

if __name__ == '__main__':
    print(f'cutout server on http://{HOST}:{PORT}  model={MODEL}', flush=True)
    ThreadingHTTPServer((HOST, PORT), H).serve_forever()
