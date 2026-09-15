import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import main
from db import init_db

TEST_MAIN_DB = "test_main_db.sqlite"

@pytest.fixture(autouse=True)
def setup_main_db():
    os.environ["DB_PATH"] = TEST_MAIN_DB
    main.db.DB_PATH = TEST_MAIN_DB
    main.db.init_db()
    yield
    if os.path.exists(TEST_MAIN_DB):
        try:
            os.remove(TEST_MAIN_DB)
        except:
            pass

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

def test_verify_alert_password():
    # Forkert kode
    res_fail = client.post("/api/alerts/verify-password", json={"password": "wrong_password"})
    assert res_fail.status_code == 401

    # Korrekt kode
    res_ok = client.post("/api/alerts/verify-password", json={"password": main.ALERT_PASSWORD})
    assert res_ok.status_code == 200
    assert res_ok.json()["status"] == "success"

def test_create_alert_password_protection(monkeypatch):
    # Mock mailer så der ikke sendes reel mail
    monkeypatch.setattr(main.mailer, "send_direct_email", lambda email, subject, html: True)
    
    payload = {
        "email": "test@example.com",
        "site_slug": "ostervang-plads",
        "start_date": "2026-09-01",
        "end_date": "2026-09-05",
        "match_type": "any",
        "min_days": 2
    }

    # 1. Ingen header: 401
    res_no_header = client.post("/api/alerts", json=payload)
    assert res_no_header.status_code == 401

    # 2. Forkert header: 401
    res_wrong_header = client.post("/api/alerts", json=payload, headers={"X-Alert-Password": "forkert"})
    assert res_wrong_header.status_code == 401

    # 3. Korrekt header: 200
    res_ok = client.post("/api/alerts", json=payload, headers={"X-Alert-Password": main.ALERT_PASSWORD})
    assert res_ok.status_code == 200
    assert res_ok.json()["status"] == "success"

