import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import main
from db import init_db

init_db()

# Mock the cache so we don't have to wait for Playwright in tests
main.cached_full_sites = [{"slug": "test-site", "name": "Test Site", "popularity_score": "hot"}]
main.data_ready_event.set()

client = TestClient(main.app)

def test_read_sites_full():
    response = client.get("/api/sites_full")
    assert response.status_code == 200
    data = response.json()
    assert "sites" in data
    assert isinstance(data["sites"], list)
    assert data["sites"][0]["popularity_score"] == "hot"
