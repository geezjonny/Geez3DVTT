"""Local web server for the table (used by serve.cmd)."""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Always check for newer files: a reused old script once showed gm.html as the player page.
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 8000), Handler).serve_forever()
