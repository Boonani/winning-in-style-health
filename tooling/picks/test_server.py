import concurrent.futures
import http.client
import json
import tempfile
import threading
import unittest
import uuid
from pathlib import Path
from server import Store, LimitedServer, handler


class PickTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = Path(self.temp.name) / "picks.sqlite3"
        self.catalog = {"cubeVersion": 558, "cards": [{"name": "Lightning Bolt", "image": "https://cards.scryfall.io/example.jpg"}]}
        self.store = Store(self.db, self.catalog)
        self.origin = "https://draft.example"
        self.public = LimitedServer(("127.0.0.1", 0), handler(self.store, self.origin))
        self.private = LimitedServer(("127.0.0.1", 0), handler(self.store, self.origin, private=True))
        for server in (self.public, self.private):
            threading.Thread(target=server.serve_forever, daemon=True).start()

    def tearDown(self):
        for server in (self.public, self.private):
            server.shutdown()
            server.server_close()
        self.temp.cleanup()

    def pick(self, **changes):
        return dict({"submissionId": str(uuid.uuid4()), "card": "Lightning Bolt", "kind": "last", "pack": 1, "experience": 0}, **changes)

    def request(self, method, route, payload=None, private=False, headers=None, raw=None):
        server = self.private if private else self.public
        client = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=5)
        body = raw if raw is not None else (json.dumps(payload) if payload is not None else None)
        actual = {"Origin": self.origin, "Content-Type": "application/json", **(headers or {})}
        client.request(method, route, body=body, headers=actual)
        response = client.getresponse()
        result = (response.status, response.read(), dict(response.getheaders()))
        client.close()
        return result

    def test_save_retry_and_restart(self):
        item = self.pick()
        self.assertEqual(self.request("POST", "/api/picks", item)[0], 201)
        self.assertEqual(self.request("POST", "/api/picks", item)[0], 200)
        self.assertEqual(Store(self.db, self.catalog).stats()["total"], 1)
        self.assertEqual(self.request("POST", "/api/picks", dict(item, pack=2))[0], 400)
        self.assertEqual(self.store.stats()["total"], 1)

    def test_concurrent_retries_record_once(self):
        item = self.pick()
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            statuses = list(pool.map(lambda _: self.request("POST", "/api/picks", item)[0], range(8)))
        self.assertEqual(statuses.count(201), 1)
        self.assertEqual(statuses.count(200), 7)
        self.assertEqual(self.store.stats()["total"], 1)

    def test_strict_schema(self):
        for change in [{"card": "Not in cube"}, {"pack": 0}, {"pack": 4}, {"pack": True}, {"experience": -1}, {"experience": 6}, {"experience": False}, {"kind": "middle"}, {"submissionId": "bad"}, {"playerName": "test"}]:
            with self.subTest(change=change):
                self.assertEqual(self.request("POST", "/api/picks", self.pick(**change))[0], 400)
        self.assertEqual(self.request("POST", "/api/picks", raw="{")[0], 400)
        self.assertEqual(self.request("POST", "/api/picks", raw="x" * 2049)[0], 413)
        self.assertEqual(self.store.stats()["total"], 0)

    def test_security_boundaries(self):
        self.assertEqual(self.request("POST", "/api/picks", self.pick(), headers={"Origin": "https://evil.test"})[0], 403)
        self.assertEqual(self.request("POST", "/api/picks", self.pick(), headers={"Content-Type": "text/plain"})[0], 415)
        self.assertEqual(self.request("GET", "/cards.json", headers={"Host": "evil.test"})[0], 421)
        for route in ("/stats", "/export.csv", "/api/draft-stats", "/server.py", "/../server.py", "/.git/config"):
            self.assertEqual(self.request("GET", route)[0], 404)
        self.assertEqual(self.request("POST", "/api/picks", self.pick(), private=True)[0], 404)
        self.assertEqual(self.request("GET", "/stats", private=True, headers={"Host": "draft.example"})[0], 421)

    def test_aggregates_keep_pack_experience_kind_and_version(self):
        for pack in (1, 2, 3):
            for kind in ("first", "last"):
                for experience in (0, 5):
                    self.store.add(self.pick(pack=pack, kind=kind, experience=experience))
        stats = json.loads(self.request("GET", "/stats", private=True)[1])
        self.assertEqual(stats["total"], 12)
        self.assertEqual(len(stats["rows"]), 12)
        self.assertEqual(set(stats["rows"][0]), {"cubeVersion", "card", "kind", "pack", "experience", "count"})
        self.assertNotIn("submissionId", json.dumps(stats))
        status, body, _ = self.request("GET", "/export.csv", private=True)
        self.assertEqual(status, 200)
        self.assertEqual(len(body.decode().splitlines()), 13)

    def test_backup_and_no_identity_columns(self):
        self.store.add(self.pick())
        backup = Path(self.temp.name) / "backup.sqlite3"
        self.store.backup(backup)
        self.assertEqual(Store(backup, self.catalog).stats()["total"], 1)
        with self.store.connect() as db:
            columns = [row[1] for row in db.execute("PRAGMA table_info(picks)")]
        self.assertEqual(columns, ["submission_id", "day", "cube_version", "card_name", "kind", "pack", "experience"])
        self.assertEqual(self.db.stat().st_mode & 0o777, 0o600)

    def test_static_form_and_no_cookie(self):
        status, body, headers = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn(b"What is the last card", body)
        self.assertNotIn("Set-Cookie", headers)
        self.assertIn("frame-ancestors 'none'", headers["Content-Security-Policy"])


if __name__ == "__main__":
    unittest.main()
