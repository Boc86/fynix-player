#!/usr/bin/env python3
"""
Music Web App server — serves static files + proxies SoulSync API calls
to avoid CORS issues when SoulSync is on a different origin.

Usage:
  python3 server.py

Then open http://localhost:8080 in your browser.
"""
import http.server
import urllib.request
import urllib.error
import json
import os
import sys

PORT = int(os.environ.get('PORT', 8080))
WEB_ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_ROOT, **kwargs)

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')

    def _json(self, status, data):
        self.send_response(status)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path.startswith('/api/'):
            self.send_error(400)
            return
        super().do_GET()

    def do_POST(self):
        if self.path != '/api/proxy':
            self.send_error(405)
            return

        content_length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(content_length)) if content_length else {}

        url = body.get('url', '')
        method = body.get('method', 'POST')
        req_body = body.get('body')
        headers = body.get('headers', {})

        if not url:
            self._json(400, {'error': 'Missing "url" in request body'})
            return

        data = json.dumps(req_body).encode() if req_body else None
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                'Content-Type': 'application/json',
                **headers
            },
            method=method
        )

        try:
            resp = urllib.request.urlopen(req, timeout=30)
            resp_body = resp.read()
            self.send_response(resp.status)
            self._cors()
            self.send_header('Content-Type', resp.headers.get('Content-Type', 'application/json'))
            self.end_headers()
            self.wfile.write(resp_body)
        except urllib.error.HTTPError as e:
            err_body = e.read()
            try:
                err_data = json.loads(err_body)
            except json.JSONDecodeError:
                err_data = {'error': f'Upstream HTTP {e.code}'}
            self._json(e.code, err_data)
        except urllib.error.URLError as e:
            self._json(502, {'error': f'Cannot reach server: {e.reason}'})
        except Exception as e:
            self._json(500, {'error': str(e)})

    def log_message(self, fmt, *args):
        pass


if __name__ == '__main__':
    server = http.server.HTTPServer(('0.0.0.0', PORT), Handler)
    print(f'Open http://localhost:{PORT} in your browser')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
