from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from playwright.async_api import async_playwright
import json
import asyncio
import traceback
import os
from datetime import datetime, timedelta
import db
import mailer
from pydantic import BaseModel

DANISH_MONTHS = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"]
DANISH_WEEKDAYS = ["mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag"]

def format_danish_date(d_str: str, include_weekday: bool = True) -> str:
    """Formatterer YYYY-MM-DD til f.eks. 'Fredag d. 18. juli'"""
    try:
        dt = datetime.strptime(d_str, "%Y-%m-%d").date()
        month = DANISH_MONTHS[dt.month - 1]
        if include_weekday:
            weekday = DANISH_WEEKDAYS[dt.weekday()].capitalize()
            return f"{weekday} d. {dt.day}. {month}"
        return f"{dt.day}. {month}"
    except Exception:
        return d_str

def format_danish_range(start_str: str, end_str: str) -> str:
    """Formatterer to datoer pænt på dansk, f.eks. '18. - 20. juli' eller '30. juni - 2. juli'"""
    try:
        d_start = datetime.strptime(start_str, "%Y-%m-%d").date()
        d_end = datetime.strptime(end_str, "%Y-%m-%d").date()
        m_start = DANISH_MONTHS[d_start.month - 1]
        m_end = DANISH_MONTHS[d_end.month - 1]
        
        if d_start == d_end:
            return f"{d_start.day}. {m_start}"
        if m_start == m_end and d_start.year == d_end.year:
            return f"{d_start.day}. - {d_end.day}. {m_start}"
        return f"{d_start.day}. {m_start} - {d_end.day}. {m_end}"
    except Exception:
        return f"{start_str} - {end_str}"

def get_site_display_name(site_slug: str) -> str:
    global cached_full_sites
    for s in cached_full_sites:
        if s.get('slug') == site_slug:
            return s.get('name', site_slug)
    for s in db.KNOWN_SITES:
        if s.get('slug') == site_slug:
            return s.get('name', site_slug)
    return site_slug.replace('-', ' ').title()

class PasswordVerify(BaseModel):
    password: str

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

ALERT_PASSWORD = os.getenv("ALERT_PASSWORD", "landjord2026")
ENABLE_TREND_ANALYSIS = os.getenv("ENABLE_TREND_ANALYSIS", "true").lower() == "true"
BASE_URL = os.getenv("BASE_URL", "https://landjord.aegaarden.dk").rstrip("/")

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
                site_name = get_site_display_name(t['site_slug'])
                freed_dates = t.get('freed_dates', [])
                matching_blocks = t.get('matching_blocks', [])
                
                # Formatter emnefelt og frigivne datoer
                if len(freed_dates) == 1:
                    d_formatted = format_danish_date(freed_dates[0])
                    subject = f"🔔 {d_formatted} er netop blevet ledig på {site_name}!"
                    freed_list_html = f"<li style='margin-bottom: 4px;'>{d_formatted}</li>"
                else:
                    subject = f"🔔 {len(freed_dates)} datoer er netop blevet ledige på {site_name}!"
                    freed_list_html = "".join(f"<li style='margin-bottom: 4px;'>{format_danish_date(d)}</li>" for d in freed_dates)
                
                # Opsummering af sammenhængende blokke
                blocks_html = ""
                if matching_blocks:
                    block_items = []
                    for b in matching_blocks:
                        range_str = format_danish_range(b['start'], b['end'])
                        days_count = b['count']
                        day_word = "dag" if days_count == 1 else "sammenhængende dage"
                        block_items.append(f"<li style='margin-bottom: 4px;'><b>{range_str}</b> ({days_count} {day_word})</li>")
                    
                    blocks_html = f"""
                    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
                        <h4 style="margin: 0 0 8px 0; color: #1e40af; font-size: 14px;">🏕️ Sammenhængende ledig periode:</h4>
                        <ul style="margin: 0; padding-left: 20px; color: #1e3a8a;">
                            {''.join(block_items)}
                        </ul>
                    </div>
                    """
                
                cond_text = "Hele perioden bliver ledig" if t.get('match_type') == 'all' else f"Min. {t.get('min_days', 1)} sammenhængende dage bliver ledige"
                
                print(f"EMAIL NOTIFIKATION: Sender til {t['email']} for {t['site_slug']} (Frigivne datoer: {freed_dates})")
                
                html_content = f"""
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
                    <h2 style="color: #059669; margin-bottom: 12px;">God nyhed! Der er blevet plads 🏕️</h2>
                    <p style="font-size: 16px; margin-top: 0;">
                        Der er sket en afbestilling eller ændring på <b>{site_name}</b>, så der nu er ledigt i din overvågede periode:
                    </p>
                    
                    <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
                        <h4 style="margin: 0 0 8px 0; color: #065f46; font-size: 14px;">📅 Netop frigivne dato(er):</h4>
                        <ul style="margin: 0; padding-left: 20px; color: #047857; font-weight: 600;">
                            {freed_list_html}
                        </ul>
                    </div>
                    
                    {blocks_html}
                    
                    <div style="text-align: center; margin: 26px 0;">
                        <a href="https://booking.landjord.com/sites/{t['site_slug']}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; font-weight: bold; text-decoration: none; border-radius: 8px;">
                            Gå til booking på booking.landjord.com →
                        </a>
                    </div>
                    
                    <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
                        Din overvågning dækker perioden <b>{format_danish_range(t['start_date'], t['end_date'])}</b> ({cond_text}).
                    </p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                    <p style="font-size: 12px; color: #94a3b8;">
                        Vil du tilpasse perioden? <a href="{BASE_URL}/#edit-alert?token={t['token']}" style="color: #2563eb;">Rediger overvågning</a>.<br>
                        Vil du slet ikke modtage flere beskeder? <a href="{BASE_URL}/api/alerts/unsubscribe?token={t['token']}" style="color: #ef4444;">Afmeld overvågning</a>.
                    </p>
                </div>
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
            # Hvis en observation peger tilbage i tid, ignoreres den
            if diff_days < 0:
                continue
                
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

@app.post("/api/alerts/verify-password")
async def verify_alert_password(payload: PasswordVerify):
    if payload.password == ALERT_PASSWORD:
        return {"status": "success", "message": "Adgang godkendt"}
    raise HTTPException(status_code=401, detail="Ugyldig adgangskode")

@app.post("/api/alerts")
async def create_alert(alert: AlertCreate, x_alert_password: str = Header(None)):
    if not x_alert_password or x_alert_password != ALERT_PASSWORD:
        raise HTTPException(status_code=401, detail="Uautoriseret adgang. Korrekt adgangskode er påkrævet.")
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
        site_name = get_site_display_name(alert.site_slug)
        subject = f"Overvågning oprettet for {site_name} 🏕️"
        sender_email = os.getenv("SMTP_USERNAME", "vores e-mailadresse")
        cond_text = "Hele perioden bliver ledig" if alert.match_type == "all" else f"Minimum {alert.min_days} sammenhængende dage bliver ledige"
        period_text = format_danish_range(alert.start_date, alert.end_date)
        
        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
            <h2 style="color: #059669; margin-bottom: 12px;">Din overvågning er aktiv! 🏕️</h2>
            <p style="font-size: 16px; margin-top: 0;">Vi holder nu automatisk øje med <b>{site_name}</b> for dig.</p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
                <ul style="margin: 0; padding-left: 20px; color: #334155;">
                    <li style="margin-bottom: 4px;"><b>Plads:</b> {site_name}</li>
                    <li style="margin-bottom: 4px;"><b>Ønsket periode:</b> {period_text}</li>
                    <li style="margin-bottom: 4px;"><b>Betingelse:</b> {cond_text}</li>
                </ul>
            </div>
            <p>Du får direkte besked via e-mail i samme øjeblik en afbestilling eller ændring frigiver pladser!</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="font-size: 12px; color: #64748b;">
                <b>Vigtigt:</b> For at sikre at vores notifikationer ikke havner i spam, kan du med fordel tilføje <i>{sender_email}</i> til dine betroede afsendere.<br><br>
                Har dine ferieplaner ændret sig? <a href="{BASE_URL}/#edit-alert?token={token}" style="color: #2563eb;">Klik her for at redigere overvågning</a>.<br>
                Fortryder du? <a href="{BASE_URL}/api/alerts/unsubscribe?token={token}" style="color: #ef4444;">Afmeld overvågning</a>.
            </p>
        </div>
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
