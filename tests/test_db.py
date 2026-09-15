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

def test_alert_triggers_when_dates_become_free():
    from datetime import datetime, timedelta
    slug = "alert-test-site"
    today = datetime.now()
    d1 = (today + timedelta(days=10)).strftime("%Y-%m-%d")
    d2 = (today + timedelta(days=11)).strftime("%Y-%m-%d")
    d3 = (today + timedelta(days=12)).strftime("%Y-%m-%d")
    
    # Dag 1, 2, 3 er oprindeligt optaget
    db.save_snapshot(slug, [d1, d2, d3])
    
    # Opret alert for d1 til d3 (kræver min 2 sammenhængende dage)
    token = db.create_alert(
        email="camper@example.com",
        site_slug=slug,
        start_date=d1,
        end_date=d3,
        match_type="any",
        min_days=2
    )
    
    # Tjek alerts før nogen afbestilling: bør IKKE trigge
    triggered = db.check_and_trigger_alerts()
    assert len(triggered) == 0
    
    # 1. Kun d1 bliver afbestilt (kun 1 dag frigivet, min_days er 2)
    db.save_snapshot(slug, [d2, d3])
    triggered = db.check_and_trigger_alerts()
    assert len(triggered) == 0, "Skal ikke trigge når der kun er 1 frigivet dag og min_days er 2"
    
    # 2. d2 bliver også afbestilt (nu er d1 og d2 ledige sammenhængende, 2 dage)
    db.save_snapshot(slug, [d3])
    triggered = db.check_and_trigger_alerts()
    assert len(triggered) == 1, "Skal trigge nu hvor 2 sammenhængende dage er blevet ledige"
    assert triggered[0]["token"] == token
    assert d2 in triggered[0]["freed_dates"]
    assert len(triggered[0]["matching_blocks"]) == 1
    assert triggered[0]["matching_blocks"][0]["count"] == 2
    assert triggered[0]["matching_blocks"][0]["start"] == d1
    assert triggered[0]["matching_blocks"][0]["end"] == d2
    
    # 3. Næste tjek uden ændringer: må IKKE trigge igen (ingen nye dage blev ledige)
    triggered_again = db.check_and_trigger_alerts()
    assert len(triggered_again) == 0

def test_alert_match_type_all_triggers_only_when_fully_freed():
    from datetime import datetime, timedelta
    slug = "all-test-site"
    today = datetime.now()
    d1 = (today + timedelta(days=20)).strftime("%Y-%m-%d")
    d2 = (today + timedelta(days=21)).strftime("%Y-%m-%d")
    
    db.save_snapshot(slug, [d1, d2])
    
    token = db.create_alert(
        email="family@example.com",
        site_slug=slug,
        start_date=d1,
        end_date=d2,
        match_type="all",
        min_days=1
    )
    
    # Delvis frigivelse: kun d1 frigives
    db.save_snapshot(slug, [d2])
    triggered = db.check_and_trigger_alerts()
    assert len(triggered) == 0, "Bør ikke trigge for match_type='all' når kun halvdelen er ledig"
    
    # Fuld frigivelse: d2 frigives også
    db.save_snapshot(slug, [])
    triggered = db.check_and_trigger_alerts()
    assert len(triggered) == 1
    assert triggered[0]["token"] == token
    assert d2 in triggered[0]["freed_dates"]
    assert triggered[0]["matching_blocks"][0]["count"] == 2



