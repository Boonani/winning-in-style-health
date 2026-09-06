"""Snapshot the live SQLite database without interrupting collection."""
import json
from datetime import datetime, timezone
from server import ROOT, STATE, Store
store = Store(STATE / "picks.sqlite3", json.loads((ROOT / "cards.json").read_text()))
path = STATE / "backups" / (datetime.now(timezone.utc).strftime("%Y-%m-%d") + ".sqlite3")
store.backup(path)
print("Anonymous pick database backed up.")
