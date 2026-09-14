import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import main
from db import init_db

init_db()

# Mock the cache and trigger_fetch so we don't have to wait for Playwright in tests
async def mock_trigger_fetch():
    pass

main.trigger_fetch = mock_trigger_fetch
main.cached_full_sites = main.db.get_seeded_full_sites()
main.data_ready_event.set()

client = TestClient(main.app)

def test_read_sites_full():
    response = client.get("/api/sites_full")
    assert response.status_code == 200
    data = response.json()
    assert "sites" in data
    assert isinstance(data["sites"], list)
    slugs = [s["slug"] for s in data["sites"]]
    assert "ostervang-plads" in slugs
    assert "fynslund-plads" in slugs
