import sqlite3
import json
from datetime import datetime, timedelta
import os
import secrets

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
    # Ledger table to track individual booking and cancellation events
    c.execute('''
        CREATE TABLE IF NOT EXISTS booking_ledger (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            site_slug TEXT,
            target_date DATE,
            observed_at TIMESTAMP,
            event_type TEXT
        )
    ''')
    # Alerts table for Watchlist Feature
    c.execute('''
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT,
            site_slug TEXT,
            start_date DATE,
            end_date DATE,
            match_type TEXT,
            token TEXT UNIQUE,
            is_active BOOLEAN,
            last_notified_at TIMESTAMP,
            known_free_dates TEXT,
            min_days INTEGER DEFAULT 1
        )
    ''')
    try:
        c.execute("ALTER TABLE alerts ADD COLUMN known_free_dates TEXT")
    except sqlite3.OperationalError:
        pass # Column already exists
        
    try:
        c.execute("ALTER TABLE alerts ADD COLUMN min_days INTEGER DEFAULT 1")
    except sqlite3.OperationalError:
        pass # Column already exists
    conn.commit()
    conn.close()
    
    seed_known_sites()

KNOWN_SITES = [
    {
        "id": 101,
        "name": "Østervang Plads",
        "slug": "ostervang-plads",
        "latitude": 55.353049,
        "longitude": 9.893281,
        "description": "Ude midt imellem markerne ligger denne smukke lille naturlejrplads. Smuk udsigt udover marker og fjord og absolut ro. Du kører langt ud af et markspor, før du kommer til denne lille lomme.",
        "images": [
            "https://images.squarespace-cdn.com/content/v1/66e875efbbf8191c959f873e/8896d6ea-0661-449c-aa91-8e5890cd197b/20260822_125818000_iOS.jpg",
            "https://images.squarespace-cdn.com/content/v1/66e875efbbf8191c959f873e/a2db74a3-db49-4113-a4c3-e82eb5ba0e52/20260822_125842000_iOS.jpg",
            "https://images.squarespace-cdn.com/content/v1/66e875efbbf8191c959f873e/06d649ff-039c-4eb2-a9b0-c0b793dc0738/20260822_130044000_iOS.jpg",
            "https://images.squarespace-cdn.com/content/v1/66e875efbbf8191c959f873e/dd5c490e-85a2-4a0b-85fb-a0efd12ea6ae/20260822_130054000_iOS.jpg"
        ],
        "occupiedDates": []
    },
    {
        "id": 102,
        "name": "Fynslund Plads",
        "slug": "fynslund-plads",
        "latitude": 55.538845,
        "longitude": 9.338100,
        "description": "Langt inde i skoven, dybt under disse træer ligger Fynslund Plads. En lille lysning midt i skoven, hvor du kan nyde vinden i de høje smukke træer og skovens fred og ro. Pladsen er ikke særlig stor. Der er plads til cirka to telte og to biler.",
        "images": [
            "https://images.squarespace-cdn.com/content/v1/66e875efbbf8191c959f873e/a74a8cf7-b4a1-471b-8c13-e9492d7537db/30_1.jpg",
            "https://images.squarespace-cdn.com/content/v1/66e875efbbf8191c959f873e/bf65a190-2ff5-4e78-bc51-0320ea4b8156/30_2.jpg",
            "https://images.squarespace-cdn.com/content/v1/66e875efbbf8191c959f873e/e2c020ce-3829-4113-91c8-bb84092b7692/30_3.jpg",
            "https://images.squarespace-cdn.com/content/v1/66e875efbbf8191c959f873e/a3ea125e-3cf7-4a0b-8fd1-e94d8cb845ee/20260825_105255457_iOS.jpg"
        ],
        "occupiedDates": []
    },
    {
        "id": 103,
        "name": "Nyrup Plads",
        "slug": "nyrup-plads",
        "latitude": 55.715303,
        "longitude": 11.029584,
        "description": "Nyrup Plads er fred og ro. Her er der kun vinden og fårene du kan høre. Pladsen er etableret hos Mikael og Karen. Lejrpladsen er placeret lige ned til en lille sø og du ligger i en lille dal.",
        "images": [
            "https://images.squarespace-cdn.com/content/v1/66e875efbbf8191c959f873e/9672fb83-7400-4cb2-b8d7-13275d73624f/20260702_083709426_iOS.jpg",
            "https://images.squarespace-cdn.com/content/v1/66e875efbbf8191c959f873e/326848be-f4a2-4a00-9836-8e50a98218df/20260702_083713838_iOS.jpg",
            "https://images.squarespace-cdn.com/content/v1/66e875efbbf8191c959f873e/60a66d0c-a9ad-4a17-b769-cfecff4f6da6/20260702_083733075_iOS.jpg"
        ],
        "occupiedDates": []
    }
]

def seed_known_sites():
    """
    Sikrer at kendte pladser (herunder de nyeste lejrpladser) har POI-data
    og et indledende snapshot i databasen hvis de ikke allerede findes.
    """
    for site in KNOWN_SITES:
        slug = site["slug"]
        lat = site.get("latitude")
        lon = site.get("longitude")
        if lat and lon:
            get_pois(slug, lat, lon)
        
        # Tjek om der findes et snapshot for sitet
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM availability_snapshots WHERE site_slug = ?", (slug,))
        count = c.fetchone()[0]
        conn.close()
        
        if count == 0:
            save_snapshot(slug, site.get("occupiedDates", []))

def get_seeded_full_sites():
    """
    Returnerer en liste over kendte pladser beriget med POIs og popularitetsscore.
    """
    sites = []
    for s in KNOWN_SITES:
        item = dict(s)
        item['popularity_score'] = get_popularity_score(s['slug'])
        item['pois'] = get_pois(s['slug'], s['latitude'], s['longitude'])
        sites.append(item)
    return sites

def save_snapshot(site_slug, occupied_dates):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # 1. Hent seneste kendte snapshot
    c.execute("SELECT occupied_dates FROM availability_snapshots WHERE site_slug = ? ORDER BY date_checked DESC LIMIT 1", (site_slug,))
    row = c.fetchone()
    
    old_dates = set()
    is_initial_baseline = (row is None)
    if row:
        try:
            old_dates = set(json.loads(row[0]))
        except:
            pass
            
    new_dates = set(occupied_dates)
    today_str = datetime.now().strftime("%Y-%m-%d")
    now_iso = datetime.now().isoformat()
    
    # 2. Beregn diffs og indsæt i ledger (Kun ægte ændringer logges)
    # VIGTIGT: Første gang vi observerer en plads (row is None), er alle eksisterende bookinger
    # lavet før overvågningen startede. De må IKKE logges i ledgeren, da det forvansker
    # statistikken over, hvor lang tid i forvejen der bookes.
    cancelled_dates = set()
    if not is_initial_baseline:
        # Bookings: Datoer der er i new_dates, men ikke var i old_dates, OG er >= i dag
        booked_dates = {d for d in (new_dates - old_dates) if d >= today_str}
        for d in booked_dates:
            c.execute("INSERT INTO booking_ledger (site_slug, target_date, observed_at, event_type) VALUES (?, ?, ?, ?)", (site_slug, d, now_iso, 'booked'))
            
        # Cancellations: Datoer der var i old_dates, IKKE er i new_dates, OG er >= i dag
        cancelled_dates = {d for d in old_dates if d not in new_dates and d >= today_str}
        for d in cancelled_dates:
            c.execute("INSERT INTO booking_ledger (site_slug, target_date, observed_at, event_type) VALUES (?, ?, ?, ?)", (site_slug, d, now_iso, 'cancelled'))
            
        final_dates = (old_dates.union(new_dates)) - cancelled_dates
    else:
        final_dates = new_dates
    
    c.execute(
        "INSERT OR REPLACE INTO availability_snapshots (site_slug, date_checked, occupied_dates) VALUES (?, ?, ?)",
        (site_slug, today_str, json.dumps(sorted(list(final_dates))))
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
        
    import hashlib
    h = int(hashlib.md5(site_slug.encode()).hexdigest(), 16)
    supermarket_dist = round(1.0 + (h % 50) / 10.0, 1) # Mellem 1.0 og 6.0 km
    bus_dist = round(0.1 + (h % 30) / 10.0, 1) # Mellem 0.1 og 3.1 km
    
    try:
        c.execute(
            "INSERT INTO pois (site_slug, supermarket_dist, bus_dist) VALUES (?, ?, ?)",
            (site_slug, supermarket_dist, bus_dist)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        pass
    conn.close()
    
    return {"supermarket": supermarket_dist, "bus": bus_dist}

def get_occupancy_stats():
    """
    Beregner den forventede belægningsgrad for de næste 30 dage frem,
    baseret på de nyeste kalenderdata.
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Hent nyeste snapshot for hver plads
    c.execute('''
        SELECT site_slug, occupied_dates
        FROM availability_snapshots
        WHERE date_checked = (SELECT MAX(date_checked) FROM availability_snapshots)
    ''')
    rows = c.fetchall()
    
    total_sites = len(rows)
    if total_sites == 0:
        conn.close()
        return []
        
    from collections import defaultdict
    from datetime import datetime, timedelta
    
    date_counts = defaultdict(int)
    for row in rows:
        try:
            dates = json.loads(row[1])
            for d in dates:
                date_counts[d] += 1
        except:
            pass
            
    historical = []
    weekdays = {"Mandag": 0, "Tirsdag": 0, "Onsdag": 0, "Torsdag": 0, "Fredag": 0, "Lørdag": 0, "Søndag": 0}
    weekday_names = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"]
    
    today = datetime.now().date()
    for i in range(30):
        d = today + timedelta(days=i)
        d_str = d.strftime("%Y-%m-%d")
        booked = date_counts.get(d_str, 0)
        
        display_date = d.strftime("%d/%m")
        historical.append({"date": display_date, "reservations": booked})
        
        wd = weekday_names[d.weekday()]
        weekdays[wd] += booked
        
    weekday_stats = [{"name": k, "reservations": v} for k, v in weekdays.items()]
        
    conn.close()
    return {"historical": historical, "weekdays": weekday_stats}

def create_alert(email, site_slug, start_date, end_date, match_type, min_days=1):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    token = secrets.token_urlsafe(16)
    
    # Udregn current free dates til initial state
    c.execute("SELECT occupied_dates FROM availability_snapshots WHERE site_slug = ? ORDER BY date_checked DESC LIMIT 1", (site_slug,))
    row = c.fetchone()
    occupied = set()
    if row:
        try:
            occupied = set(json.loads(row[0]))
        except:
            pass
            
    d_start = datetime.strptime(start_date, "%Y-%m-%d").date()
    d_end = datetime.strptime(end_date, "%Y-%m-%d").date()
    
    free_dates = []
    curr = d_start
    while curr <= d_end:
        d_str = curr.strftime("%Y-%m-%d")
        if d_str not in occupied:
            free_dates.append(d_str)
        curr += timedelta(days=1)
        
    known_free_dates = json.dumps(free_dates)
    
    c.execute('''
        INSERT INTO alerts (email, site_slug, start_date, end_date, match_type, token, is_active, known_free_dates, min_days)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    ''', (email, site_slug, start_date, end_date, match_type, token, known_free_dates, min_days))
    conn.commit()
    conn.close()
    return token

def get_alert_by_token(token):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        SELECT id, email, site_slug, start_date, end_date, match_type, min_days, is_active
        FROM alerts WHERE token = ?
    ''', (token,))
    row = c.fetchone()
    conn.close()
    if row:
        return {
            "id": row[0],
            "email": row[1],
            "site_slug": row[2],
            "start_date": row[3],
            "end_date": row[4],
            "match_type": row[5],
            "min_days": row[6],
            "is_active": bool(row[7])
        }
    return None

def update_alert(token, start_date, end_date, match_type, min_days):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Hent alert
    c.execute("SELECT site_slug FROM alerts WHERE token = ?", (token,))
    row = c.fetchone()
    if not row:
        conn.close()
        return False
    site_slug = row[0]
    
    # Genberegn known_free_dates for den nye periode
    c.execute("SELECT occupied_dates FROM availability_snapshots WHERE site_slug = ? ORDER BY date_checked DESC LIMIT 1", (site_slug,))
    snap = c.fetchone()
    occupied = set()
    if snap:
        try: occupied = set(json.loads(snap[0]))
        except: pass
        
    d_start = datetime.strptime(start_date, "%Y-%m-%d").date()
    d_end = datetime.strptime(end_date, "%Y-%m-%d").date()
    free_dates = []
    curr = d_start
    while curr <= d_end:
        d_str = curr.strftime("%Y-%m-%d")
        if d_str not in occupied:
            free_dates.append(d_str)
        curr += timedelta(days=1)
        
    known_free_dates = json.dumps(free_dates)
    
    c.execute('''
        UPDATE alerts 
        SET start_date = ?, end_date = ?, match_type = ?, min_days = ?, known_free_dates = ?
        WHERE token = ?
    ''', (start_date, end_date, match_type, min_days, known_free_dates, token))
    
    conn.commit()
    conn.close()
    return True

def deactivate_alert(token):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("UPDATE alerts SET is_active = 0, email = NULL WHERE token = ?", (token,))
    conn.commit()
    conn.close()

def check_and_trigger_alerts():
    """
    Kigger på aktive alerts og availability_snapshots.
    Returnerer en liste af alerts der skal triggeres, og opdaterer deres known_free_dates state.
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Hent nyeste snapshot per site
    c.execute('''
        SELECT site_slug, occupied_dates
        FROM availability_snapshots
        WHERE date_checked = (SELECT MAX(date_checked) FROM availability_snapshots)
    ''')
    rows = c.fetchall()
    
    # Byg dictionary med site_slug -> sæt af optagne datoer
    occupied_by_site = {}
    for r in rows:
        try:
            occupied_by_site[r[0]] = set(json.loads(r[1]))
        except:
            occupied_by_site[r[0]] = set()

    # Find aktive alerts
    now_iso = datetime.now().isoformat()
    
    c.execute('''
        SELECT id, email, site_slug, start_date, end_date, match_type, token, known_free_dates, min_days
        FROM alerts
        WHERE is_active = 1
    ''')
    
    alerts = c.fetchall()
    
    triggered_alerts = []
    
    for alert in alerts:
        a_id, email, site_slug, start_date, end_date, match_type, token, known_free_dates_json, min_days = alert
        
        # Hvis der ikke er snapshot data for sitet, kan vi ikke vide noget
        if site_slug not in occupied_by_site:
            continue
            
        occupied = occupied_by_site[site_slug]
        
        known_free = set()
        if known_free_dates_json:
            try:
                known_free = set(json.loads(known_free_dates_json))
            except:
                pass
        
        # Generer liste af datoer i alertens periode
        d_start = datetime.strptime(start_date, "%Y-%m-%d").date()
        d_end = datetime.strptime(end_date, "%Y-%m-%d").date()
        
        all_dates_in_period = []
        current_free = set()
        curr = d_start
        while curr <= d_end:
            d_str = curr.strftime("%Y-%m-%d")
            all_dates_in_period.append(d_str)
            if d_str not in occupied:
                current_free.add(d_str)
            curr += timedelta(days=1)
            
        # Tjek betingelser
        is_triggered = False
        
        if match_type == 'all':
            # ALLE dage i perioden skal være LEDIGE, og der skal være mindst én "ny" ledig dag 
            all_free_now = len(current_free) == len(all_dates_in_period)
            all_free_before = len(known_free) == len(all_dates_in_period)
            if all_free_now and not all_free_before:
                is_triggered = True
        elif match_type == 'any':
            # Trigger hvis der findes en sammenhængende blok af mindst 'min_days' dage i 'current_free'
            # som ikke er et subset af 'known_free'
            
            # Find alle sammenhængende blokke af præcis længde `min_days`
            # For hver dag i perioden, check om [d, d+1, ..., d+min_days-1] alle er i current_free
            
            d_i = d_start
            while d_i <= d_end - timedelta(days=min_days - 1):
                block = []
                for offset in range(min_days):
                    block.append((d_i + timedelta(days=offset)).strftime("%Y-%m-%d"))
                
                # Er hele blokken ledig nu?
                if all(d in current_free for d in block):
                    # Var hele blokken ledig før?
                    if not all(d in known_free for d in block):
                        is_triggered = True
                        break
                d_i += timedelta(days=1)
            
        if is_triggered:
            triggered_alerts.append({
                "id": a_id,
                "email": email,
                "site_slug": site_slug,
                "start_date": start_date,
                "end_date": end_date,
                "match_type": match_type,
                "token": token
            })
            
            # Opdater last_notified_at og known_free_dates
            new_known_json = json.dumps(sorted(list(current_free)))
            c.execute("UPDATE alerts SET last_notified_at = ?, known_free_dates = ? WHERE id = ?", (now_iso, new_known_json, a_id))
            
    conn.commit()
    conn.close()
    return triggered_alerts
