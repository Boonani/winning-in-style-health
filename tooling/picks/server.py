"""Anonymous pick collection. Public writes and private aggregate reads use separate ports."""
import csv
import io
import json
import os
import sqlite3
import threading
import time
import uuid
from collections import deque
from contextlib import contextmanager, closing
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
STATE = Path(os.environ.get("CUBE_PICKS_STATE", "/home/boon/state/cube-picks"))
ORIGIN = os.environ.get("CUBE_PICKS_ORIGIN", "https://draft.coolasheck.com")
PORT = int(os.environ.get("CUBE_PICKS_PORT", "8770"))
ADMIN_PORT = int(os.environ.get("CUBE_PICKS_ADMIN_PORT", "8771"))


class Store:
    def __init__(self, database, catalog):
        self.database = Path(database)
        self.database.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.catalog = catalog
        self.names = {card["name"] for card in catalog["cards"]}
        with self.connect() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("""CREATE TABLE IF NOT EXISTS picks (
                submission_id TEXT PRIMARY KEY, day TEXT NOT NULL,
                cube_version INTEGER NOT NULL, card_name TEXT NOT NULL,
                kind TEXT NOT NULL CHECK(kind IN ('first','last')),
                pack INTEGER NOT NULL CHECK(pack BETWEEN 1 AND 3),
                experience INTEGER NOT NULL CHECK(experience BETWEEN 0 AND 5))""")
            db.execute("CREATE INDEX IF NOT EXISTS picks_day ON picks(day)")
        os.chmod(self.database, 0o600)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.database, timeout=10)
        try:
            db.execute("PRAGMA synchronous=FULL")
            with db:
                yield db
        finally:
            db.close()

    def validate(self, value):
        if not isinstance(value, dict) or set(value) != {"submissionId", "card", "kind", "pack", "experience"}:
            raise ValueError("Choose a card, pack, and experience.")
        try:
            identifier = uuid.UUID(value["submissionId"])
            if identifier.version != 4 or str(identifier) != value["submissionId"]:
                raise ValueError()
        except (ValueError, TypeError, AttributeError):
            raise ValueError("Reload the form and try again.") from None
        if not isinstance(value["card"], str) or value["card"] not in self.names:
            raise ValueError("Choose a card from this cube.")
        if value["kind"] not in ("first", "last"):
            raise ValueError("Choose first pick or last card.")
        if type(value["pack"]) is not int or value["pack"] not in (1, 2, 3):
            raise ValueError("Choose pack 1, 2, or 3.")
        if type(value["experience"]) is not int or not 0 <= value["experience"] <= 5:
            raise ValueError("Choose experience from 0 to 5.")
        return (value["card"], value["kind"], value["pack"], value["experience"])

    def add(self, value):
        fields = self.validate(value)
        day = datetime.now(timezone.utc).date().isoformat()
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            previous = db.execute("SELECT card_name,kind,pack,experience FROM picks WHERE submission_id=?", (value["submissionId"],)).fetchone()
            if previous:
                if previous != fields:
                    raise ValueError("That submission was already saved with different choices.")
                return False
            if db.execute("SELECT COUNT(*) FROM picks WHERE day=?", (day,)).fetchone()[0] >= 10000:
                raise OverflowError("Daily limit reached. Try again tomorrow.")
            db.execute("INSERT INTO picks VALUES (?,?,?,?,?,?,?)", (value["submissionId"], day, self.catalog["cubeVersion"], *fields))
        return True

    def stats(self):
        with self.connect() as db:
            rows = db.execute("""SELECT cube_version,card_name,kind,pack,experience,COUNT(*)
                FROM picks GROUP BY cube_version,card_name,kind,pack,experience
                ORDER BY card_name,kind,pack,experience""").fetchall()
        return {"rows": [dict(zip(("cubeVersion", "card", "kind", "pack", "experience", "count"), row)) for row in rows],
                "total": sum(row[-1] for row in rows)}

    def backup(self, destination):
        destination = Path(destination)
        destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with self.connect() as source, closing(sqlite3.connect(destination)) as target:
            source.backup(target)
        os.chmod(destination, 0o600)


class LimitedServer(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 32
    def __init__(self, *args, **kwargs):
        self.slots = threading.BoundedSemaphore(24)
        super().__init__(*args, **kwargs)
    def handle_error(self, request, address):
        print('A request was interrupted; no request details retained.', flush=True)
    def process_request(self, request, address):
        if not self.slots.acquire(False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, address)
        except Exception:
            self.slots.release()
            raise
    def process_request_thread(self, request, address):
        try:
            super().process_request_thread(request, address)
        finally:
            self.slots.release()


def handler(store, origin, private=False):
    burst = deque()
    lock = threading.Lock()
    public_host = urlsplit(origin).netloc

    class Handler(BaseHTTPRequestHandler):
        server_version = "CubePicks"
        def setup(self):
            super().setup()
            self.connection.settimeout(10)
        def log_message(self, *_):
            pass  # Never log IP addresses, user agents, or requests.
        def send(self, status, body, mime="application/json"):
            if not isinstance(body, bytes):
                body = json.dumps(body, ensure_ascii=False).encode()
            self.send_response(status)
            for key, value in {
                "Content-Type": mime, "Content-Length": str(len(body)), "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
                "Content-Security-Policy": "default-src 'self'; img-src 'self' https://assets.cubecobra.com https://cards.scryfall.io; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
                "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
            }.items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(body)
        def host_ok(self):
            local = "127.0.0.1:" + str(self.server.server_port)
            allowed = {local} if private else {public_host, local}
            if self.headers.get("Host") not in allowed:
                self.send(421, {"error": "Host rejected."})
                return False
            return True
        def do_GET(self):
            if not self.host_ok():
                return
            route = urlsplit(self.path).path
            if private:
                if route == "/stats":
                    return self.send(200, store.stats())
                if route == "/export.csv":
                    output = io.StringIO()
                    writer = csv.writer(output)
                    writer.writerow(["cube_version", "card", "pick", "pack", "experience", "reports"])
                    for row in store.stats()["rows"]:
                        name = row["card"]
                        if name.startswith(("=", "+", "-", "@")):
                            name = "'" + name
                        writer.writerow([row["cubeVersion"], name, row["kind"], row["pack"], row["experience"], row["count"]])
                    return self.send(200, output.getvalue().encode(), "text/csv; charset=utf-8")
                return self.send(404, {"error": "Not found."})
            if route == "/health":
                return self.send(200, {"ok": True})
            if route == "/cards.json":
                return self.send(200, store.catalog)
            static = {"/": ("index.html", "text/html; charset=utf-8"),
                      "/app.js": ("app.js", "text/javascript; charset=utf-8"),
                      "/style.css": ("style.css", "text/css; charset=utf-8")}
            if route in static:
                name, mime = static[route]
                return self.send(200, (ROOT / name).read_bytes(), mime)
            if route == "/save.svg":
                return self.send(200, (ROOT.parent / "assets/icons/save.svg").read_bytes(), "image/svg+xml")
            return self.send(404, {"error": "Not found."})
        def do_POST(self):
            if not self.host_ok():
                return
            if private or urlsplit(self.path).path != "/api/picks":
                return self.send(404, {"error": "Not found."})
            if self.headers.get("Origin") != origin:
                return self.send(403, {"error": "Origin rejected."})
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                return self.send(415, {"error": "JSON required."})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if self.headers.get("Transfer-Encoding") or not 0 < length <= 2048:
                    return self.send(413, {"error": "Request too large."})
                with lock:
                    now = time.monotonic()
                    while burst and burst[0] < now - 60:
                        burst.popleft()
                    if len(burst) >= 240:
                        return self.send(429, {"error": "Busy. Wait a minute, then retry."})
                    burst.append(now)
                value = json.loads(self.rfile.read(length))
                created = store.add(value)
                return self.send(201 if created else 200, {"saved": True})
            except (ValueError, UnicodeError):
                return self.send(400, {"error": "Choose a listed card, pack 1-3, and experience 0-5."})
            except OverflowError as error:
                return self.send(429, {"error": str(error)})
            except (sqlite3.Error, OSError):
                return self.send(503, {"error": "Not saved yet. Please retry."})
    return Handler


if __name__ == "__main__":
    os.umask(0o077)
    store = Store(STATE / "picks.sqlite3", json.loads((ROOT / "cards.json").read_text()))
    public = LimitedServer(("127.0.0.1", PORT), handler(store, ORIGIN))
    private = LimitedServer(("127.0.0.1", ADMIN_PORT), handler(store, ORIGIN, private=True))
    threading.Thread(target=private.serve_forever, daemon=True).start()
    print("Cube picks ready; request logging disabled.", flush=True)
    public.serve_forever()
