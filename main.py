from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from playwright.async_api import async_playwright
import json
import asyncio
import traceback
import os
import db
import mailer
from pydantic import BaseModel

class AlertCreate(BaseModel):
    email: str
    site_slug: str
    start_date: str
    end_date: str
    match_type: str
    min_days: int = 1

class AlertUpdate(BaseModel):
    start_date: str
    end_date: str
    match_type: str
    min_days: int = 1

ENABLE_TREND_ANALYSIS = os.getenv("ENABLE_TREND_ANALYSIS", "true").lower() == "true"

app = FastAPI(title="Landjord Overblik API Proxy")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cached_full_sites = []
data_ready_event = asyncio.Event()
last_fetch_time = None
is_fetching = False

async def fetch_site_details_with_retry(page, site, max_retries=3):
    for attempt in range(max_retries):
        try:
            print(f"Henter detaljer for {site['slug']} (Forsøg {attempt + 1}/{max_retries})...")
            await page.goto(f"https://booking.landjord.com/sites/{site['slug']}")
            await page.wait_for_selector("#app", timeout=15000)
            
            detail_page = await page.locator("#app").get_attribute("data-page")
            detail_data = json.loads(detail_page)
            return detail_data.get("props", {}).get("site", {})
        except Exception as e:
            print(f"Fejl ved indlæsning af {site['slug']}: {e}")
            if attempt == max_retries - 1:
                raise e
            await asyncio.sleep(2)

async def fetch_data_task():
    global cached_full_sites, last_fetch_time, is_fetching
    is_fetching = True
    pw = None
    browser = None
    from datetime import datetime
    try:
        print("Starter ny Playwright session for on-demand fetch...")
        pw = await async_playwright().start()
        browser = await pw.chromium.launch(
            headless=True,
            args=["--disable-features=AsyncDns", "--disable-dev-shm-usage"]
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        print("Starter udtrækning af alle plads-data til cache...")
        await page.goto("https://booking.landjord.com/")
        await page.wait_for_selector("#app", timeout=20000)
        
        data_page = await page.locator("#app").get_attribute("data-page")
        data = json.loads(data_page)
        sites_raw = data.get("props", {}).get("sites", [])
        
        if isinstance(sites_raw, dict):
            sites = sites_raw.get("data", list(sites_raw.values()))
        else:
            sites = sites_raw
            
        full_sites = []
        for site in sites:
            try:
                detail = await fetch_site_details_with_retry(page, site)
                
                site['occupiedDates'] = detail.get('occupiedDates', [])
                if 'images' in detail:
                    site['images'] = detail['images']
                if 'description' in detail:
                    site['description'] = detail['description']
                    
                if ENABLE_TREND_ANALYSIS:
                    db.save_snapshot(site['slug'], site.get('occupiedDates', []))
                    site['popularity_score'] = db.get_popularity_score(site['slug'])
                    
                lat = site.get('latitude', 0.0)
                lon = site.get('longitude', 0.0)
                if lat and lon:
                    site['pois'] = db.get_pois(site['slug'], lat, lon)
                    
                full_sites.append(site)
            except Exception as e:
                print(f"Kunne ikke hente detaljer for {site['slug']} trods retries: {e}")
                traceback.print_exc()
                full_sites.append(site)
                
        if len(full_sites) > 0:
            cached_full_sites = full_sites
            last_fetch_time = datetime.now()
            print(f"Cache opdateret succesfuldt med {len(cached_full_sites)} pladser kl {last_fetch_time}!")
            data_ready_event.set()
            
            # Tjek alerts
            triggered = db.check_and_trigger_alerts()
            if triggered:
                print(f"Fandt {len(triggered)} alerts der skal udløses!")
            for t in triggered:
                # MOCK PRINT
                print(f"MOCK EMAIL: Sender besked til {t['email']} om at {t['site_slug']} er ledig ({t['start_date']} til {t['end_date']}).")
                
                # ACTUAL EMAIL
                subject = f"Plads ledig på {t['site_slug']}!"
                html_content = f"""
                <h2>God nyhed! Der er ledige pladser!</h2>
                <p>Din overvågning for <b>{t['site_slug']}</b> har fundet ledige datoer i din ønskede periode ({t['start_date']} - {t['end_date']}).</p>
                <br>
                <p>Skynd dig ind og book på <a href="https://booking.landjord.com/sites/{t['site_slug']}">booking.landjord.com</a>.</p>
                <hr>
                <p style="font-size: 12px; color: #666;">
                    Ønsker du at ændre din overvågning? <a href="https://192.168.50.5:5821/#edit-alert?token={t['token']}">Klik her for at redigere</a>.<br>
                    Ønsker du slet ikke flere beskeder? <a href="https://192.168.50.5:5821/api/alerts/unsubscribe?token={t['token']}">Afmeld overvågning</a>.
                </p>
                """
                mailer.send_direct_email(t['email'], subject, html_content)
            
    except Exception as e:
        print(f"Kritisk fejl under dataindsamling: {e}")
        traceback.print_exc()
        
    finally:
        is_fetching = False
        try:
            if browser: await browser.close()
            if pw: await pw.stop()
        except Exception as cleanup_err:
            print(f"Fejl ved oprydning af browser: {cleanup_err}")

async def trigger_fetch():
    global last_fetch_time, is_fetching
    
    if is_fetching:
        return
        
    from datetime import datetime
    now = datetime.now()
    if last_fetch_time is None or (now - last_fetch_time).total_seconds() > 3600:
        print("Cachen er over 1 time gammel (eller tom). Starter baggrundsfetch...")
        asyncio.create_task(fetch_data_task())

async def periodic_background_fetch():
    """
    Sikrer at der automatisk indsamles nye data og statistikker mindst én gang hver 12. time,
    selv hvis ingen brugere besøger appen.
    """
    while True:
        try:
            await asyncio.sleep(12 * 3600) # 12 timer
            print("12-timers timer udløbet. Tjekker for opdateringer...")
            await trigger_fetch()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Fejl i periodic_background_fetch: {e}")
            await asyncio.sleep(60)

background_scheduler_task = None

@app.on_event("startup")
async def startup_event():
    global cached_full_sites, background_scheduler_task
    db.init_db()
    if not cached_full_sites:
        cached_full_sites = db.get_seeded_full_sites()
        data_ready_event.set()
    print("Initialiserer API...")
    # Vi kickstarter fetch med det samme ved startup, så første bruger ikke altid skal vente
    await trigger_fetch()
    # Starter fast 12-timers baggrunds-timer
    background_scheduler_task = asyncio.create_task(periodic_background_fetch())

@app.on_event("shutdown")
async def shutdown_event():
    global background_scheduler_task
    if background_scheduler_task:
        background_scheduler_task.cancel()

@app.get("/api/sites_full")
async def get_all_sites_full():
    # Tjek om vi skal opdatere i baggrunden (stale-while-revalidate)
    await trigger_fetch()
    
    if not data_ready_event.is_set():
        try:
            await asyncio.wait_for(data_ready_event.wait(), timeout=60.0)
        except asyncio.TimeoutError:
            raise HTTPException(status_code=503, detail="Data loader stadig, prøv igen om lidt")
    return JSONResponse(content={"sites": cached_full_sites})

@app.get("/api/stats")
async def get_stats():
    # Hent det tidsmæssige datasæt fra DB for de næste 30 dage
    stats_data = db.get_occupancy_stats()
    
    # Byg live-data pr. plads fra den nuværende cache (næste 30 dage)
    site_stats = []
    from datetime import datetime, timedelta
    today = datetime.now().date()
    next_30 = [(today + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(30)]
    
    for site in cached_full_sites:
        occupied = site.get('occupiedDates', [])
        booked_days = len([d for d in occupied if d in next_30])
        site_stats.append({
            "name": site.get('name', site['slug']),
            "reservations": booked_days
        })
        
    # Sorter efter mest bookede og tag top 15
    site_stats.sort(key=lambda x: x["reservations"], reverse=True)
    top_sites = site_stats[:15]
        
    return JSONResponse(content={
        "historical": stats_data.get("historical", []), 
        "weekdays": stats_data.get("weekdays", []),
        "sites": top_sites
    })

@app.get("/api/booking_trends")
async def get_booking_trends(site_slug: str = "all"):
    """
    Returnerer statistik fra ledgeren for, hvor lang tid i forvejen folk booker.
    """
    import sqlite3
    from datetime import datetime
    
    conn = sqlite3.connect(db.DB_PATH)
    c = conn.cursor()
    
    if site_slug == "all" or site_slug.startswith("region_"):
        # For simpeltheds skyld tager vi alle bookinger. Hvis man vil have specifik region, 
        # burde man joine med en geo-tabel, men for proof of concept returnerer vi aggregeret data.
        c.execute("SELECT target_date, observed_at FROM booking_ledger WHERE event_type = 'booked'")
    else:
        c.execute("SELECT target_date, observed_at FROM booking_ledger WHERE event_type = 'booked' AND site_slug = ?", (site_slug,))
        
    rows = c.fetchall()
    conn.close()
    
    # Grupper i kasser til trend-analyse
    buckets = {
        "0-2 dage før": 0,
        "3-7 dage før": 0,
        "8-14 dage før": 0,
        "15-30 dage før": 0,
        "1-3 mdr. før": 0,
        "3-6 mdr. før": 0,
        "Over 6 mdr. før": 0
    }
    
    total = 0
    for target_str, obs_str in rows:
        try:
            target = datetime.strptime(target_str, "%Y-%m-%d").date()
            obs = datetime.fromisoformat(obs_str).date()
            diff_days = (target - obs).days
            
            if diff_days < 0:
                diff_days = 0
                
            if diff_days <= 2:
                buckets["0-2 dage før"] += 1
            elif diff_days <= 7:
                buckets["3-7 dage før"] += 1
            elif diff_days <= 14:
                buckets["8-14 dage før"] += 1
            elif diff_days <= 30:
                buckets["15-30 dage før"] += 1
            elif diff_days <= 90:
                buckets["1-3 mdr. før"] += 1
            elif diff_days <= 180:
                buckets["3-6 mdr. før"] += 1
            else:
                buckets["Over 6 mdr. før"] += 1
                
            total += 1
        except:
            pass
            
    # Format til recharts
    result = []
    for k, v in buckets.items():
        result.append({"name": k, "count": v, "percentage": round((v / total * 100) if total > 0 else 0)})
        
    return JSONResponse(content={"trends": result, "total": total})

@app.post("/api/alerts")
async def create_alert(alert: AlertCreate):
    try:
        token = db.create_alert(
            email=alert.email,
            site_slug=alert.site_slug,
            start_date=alert.start_date,
            end_date=alert.end_date,
            match_type=alert.match_type,
            min_days=alert.min_days
        )
        
        # SEND CONFIRMATION EMAIL
        subject = f"Overvågning oprettet for {alert.site_slug}"
        sender_email = os.getenv("SMTP_USERNAME", "vores e-mailadresse")
        html_content = f"""
        <h2>Din overvågning er aktiv! 🏕️</h2>
        <p>Vi holder nu øje med pladsen <b>{alert.site_slug}</b> for dig.</p>
        <ul>
            <li>Periode: {alert.start_date} til {alert.end_date}</li>
            <li>Betingelse: {alert.match_type} (min. {alert.min_days} sammenhængende dage)</li>
        </ul>
        <br>
        <p>Du får direkte besked, så snart der bliver en plads ledig!</p>
        <hr>
        <p style="font-size: 12px; color: #666;">
            <b>Vigtigt:</b> For at sikre, at vores notifikationer ikke havner i spam, bedes du tilføje <i>{sender_email}</i> til dine betroede afsendere eller faste kontakter.<br><br>
            Har dine ferieplaner ændret sig? <a href="https://192.168.50.5:5821/#edit-alert?token={token}">Klik her for at redigere din overvågning</a>.<br>
            Fortryder du? <a href="https://192.168.50.5:5821/api/alerts/unsubscribe?token={token}">Afmeld overvågning</a>.
        </p>
        """
        mailer.send_direct_email(alert.email, subject, html_content)
        
        return {"status": "success", "message": "Alert created successfully"}
    except Exception as e:
        print(f"Error creating alert: {e}")
        raise HTTPException(status_code=500, detail="Could not create alert")

@app.get("/api/alerts/{token}")
async def get_alert(token: str):
    alert = db.get_alert_by_token(token)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "success", "alert": alert}

@app.put("/api/alerts/{token}")
async def update_alert_endpoint(token: str, alert: AlertUpdate):
    success = db.update_alert(
        token=token,
        start_date=alert.start_date,
        end_date=alert.end_date,
        match_type=alert.match_type,
        min_days=alert.min_days
    )
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "success", "message": "Alert updated successfully"}

@app.get("/api/alerts/unsubscribe")
async def unsubscribe_alert(token: str):
    try:
        db.deactivate_alert(token)
        return HTMLResponse(
            content="""
            <html>
                <body style='font-family: sans-serif; padding: 2rem; text-align: center; background-color: #0f172a; color: #fff;'>
                    <h2 style='color: #10b981;'>Afmeldt succesfuldt</h2>
                    <p>Din overvågning er nu deaktiveret, og din e-mail er slettet fra systemet (GDPR-compliance).</p>
                </body>
            </html>
            """
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error unsubscribing")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
