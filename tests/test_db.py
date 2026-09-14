import os
import json
import pytest
import sqlite3
import sys

# Setup sti så vi kan importere db.py fra roden
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db

TEST_DB = "test_db.sqlite"

@pytest.fixture(autouse=True)
def setup_teardown():
    # Setup
    os.environ["DB_PATH"] = TEST_DB
    db.DB_PATH = TEST_DB
    db.init_db()
    yield
    # Teardown
    if os.path.exists(TEST_DB):
        try:
            os.remove(TEST_DB)
        except:
            pass

def test_save_and_get_snapshot():
    slug = "test-plads"
    dates = ["2024-05-01", "2024-05-02"]
    
    db.save_snapshot(slug, dates)
    
    # Tjek at den fik en 'low' score da der kun er få optagede datoer
    score = db.get_popularity_score(slug)
    assert score == "low"

def test_popularity_score_hot():
    slug = "popular-plads"
    dates = [f"2024-05-{i:02d}" for i in range(1, 150)] # > 100 dates
    
    db.save_snapshot(slug, dates)
    
    score = db.get_popularity_score(slug)
    assert score == "hot"

def test_seed_known_sites():
    db.seed_known_sites()
    
    conn = sqlite3.connect(TEST_DB)
    c = conn.cursor()
    
    # Check that the new sites are seeded in availability_snapshots
    c.execute("SELECT DISTINCT site_slug FROM availability_snapshots")
    slugs = {row[0] for row in c.fetchall()}
    assert "ostervang-plads" in slugs
    assert "fynslund-plads" in slugs
    
    # Check that POIs exist for the new sites
    c.execute("SELECT site_slug, supermarket_dist, bus_dist FROM pois")
    poi_dict = {row[0]: (row[1], row[2]) for row in c.fetchall()}
    assert "ostervang-plads" in poi_dict
    assert "fynslund-plads" in poi_dict
    assert poi_dict["ostervang-plads"][0] > 0
    assert poi_dict["ostervang-plads"][1] > 0
    
    conn.close()

def test_get_seeded_full_sites():
    sites = db.get_seeded_full_sites()
    slugs = [s["slug"] for s in sites]
    assert "ostervang-plads" in slugs
    assert "fynslund-plads" in slugs
    
    ostervang = next(s for s in sites if s["slug"] == "ostervang-plads")
    assert ostervang["name"] == "Østervang Plads"
    assert ostervang["latitude"] == 55.353049
    assert ostervang["longitude"] == 9.893281
    assert "supermarket" in ostervang["pois"]
    
    fynslund = next(s for s in sites if s["slug"] == "fynslund-plads")
    assert fynslund["name"] == "Fynslund Plads"
    assert fynslund["latitude"] == 55.538845
    assert fynslund["longitude"] == 9.338100
    assert "supermarket" in fynslund["pois"]

def test_booking_ledger_baseline_and_delta():
    from datetime import datetime, timedelta
    slug = "ledger-test-site"
    today = datetime.now()
    d1 = (today + timedelta(days=5)).strftime("%Y-%m-%d")
    d2 = (today + timedelta(days=6)).strftime("%Y-%m-%d")
    d3 = (today + timedelta(days=10)).strftime("%Y-%m-%d")

    # 1. Initial snapshot: must NOT populate booking_ledger
    db.save_snapshot(slug, [d1, d2])
    
    conn = sqlite3.connect(TEST_DB)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM booking_ledger WHERE site_slug = ?", (slug,))
    count_initial = c.fetchone()[0]
    assert count_initial == 0, "Initial snapshot should not log to booking_ledger"

    # 2. Subsequent snapshot: adding d3 and removing d1
    db.save_snapshot(slug, [d2, d3])
    
    c.execute("SELECT target_date, event_type FROM booking_ledger WHERE site_slug = ? ORDER BY id ASC", (slug,))
    events = c.fetchall()
    conn.close()

    assert len(events) == 2
    assert (d3, "booked") in events
    assert (d1, "cancelled") in events


