import sqlite3
import json
from datetime import datetime
import os

DB_PATH = os.getenv("DB_PATH", "db.sqlite")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # High fidelity snapshot table: records EXACTLY which dates are occupied on a given check date
    c.execute('''
        CREATE TABLE IF NOT EXISTS availability_snapshots (
            site_slug TEXT,
            date_checked DATE,
            occupied_dates TEXT,
            PRIMARY KEY (site_slug, date_checked)
        )
    ''')
    # POI table for caching distance to nearest supermarket/bus
    c.execute('''
        CREATE TABLE IF NOT EXISTS pois (
            site_slug TEXT PRIMARY KEY,
            supermarket_dist REAL,
            bus_dist REAL
        )
    ''')
    conn.commit()
    conn.close()

def save_snapshot(site_slug, occupied_dates):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    today_str = datetime.now().strftime("%Y-%m-%d")
    c.execute(
        "INSERT OR REPLACE INTO availability_snapshots (site_slug, date_checked, occupied_dates) VALUES (?, ?, ?)",
        (site_slug, today_str, json.dumps(occupied_dates))
    )
    conn.commit()
    conn.close()

def get_popularity_score(site_slug):
    """
    Simpel popularitetsscore baseret på hvor mange dage der var optaget de sidste 7 dage.
    For now, returnerer en simpel string.
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "SELECT occupied_dates FROM availability_snapshots WHERE site_slug = ? ORDER BY date_checked DESC LIMIT 1",
        (site_slug,)
    )
    row = c.fetchone()
    conn.close()
    
    if not row:
        return "ukendt"
        
    try:
        dates = json.loads(row[0])
        if len(dates) > 100:
            return "hot"
        elif len(dates) > 50:
            return "medium"
        return "low"
    except:
        return "ukendt"

def get_pois(site_slug, lat, lon):
    """
    Henter POIs (supermarked og bus) for en plads. 
    Bruger en simpel beregning eller cachet data for ikke at rate-limite.
    I et fuldt produktionsmiljø vil dette kalde Overpass API, 
    men for at sikre stabilitet under proof-of-concept simulerer vi det 
    eller returnerer statisk data indtil det er cached.
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT supermarket_dist, bus_dist FROM pois WHERE site_slug = ?", (site_slug,))
    row = c.fetchone()
    
    if row:
        conn.close()
        return {"supermarket": row[0], "bus": row[1]}
        
    # Mock POI data based on coordinates hash to be consistent
    # In reality: urllib.request to http://overpass-api.de/api/interpreter
    # query = f'[out:json];(node["amenity"="supermarket"](around:5000,{lat},{lon});node["highway"="bus_stop"](around:2000,{lat},{lon}););out center;'
    import hashlib
    h = int(hashlib.md5(site_slug.encode()).hexdigest(), 16)
    supermarket_dist = round(1.0 + (h % 50) / 10.0, 1) # Mellem 1.0 og 6.0 km
    bus_dist = round(0.1 + (h % 30) / 10.0, 1) # Mellem 0.1 og 3.1 km
    
    c.execute(
        "INSERT INTO pois (site_slug, supermarket_dist, bus_dist) VALUES (?, ?, ?)",
        (site_slug, supermarket_dist, bus_dist)
    )
    conn.commit()
    conn.close()
    
    return {"supermarket": supermarket_dist, "bus": bus_dist}
