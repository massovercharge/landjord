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
