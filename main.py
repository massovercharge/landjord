from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from playwright.async_api import async_playwright
import json
import asyncio

app = FastAPI(title="Landjord Booking API Proxy")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
pw = None
browser = None
context = None
page = None

cached_full_sites = []
data_ready_event = asyncio.Event()

async def background_fetch_all_data():
    global cached_full_sites
    try:
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
                print(f"Henter detaljer for {site['slug']}...")
                await page.goto(f"https://booking.landjord.com/sites/{site['slug']}")
                await page.wait_for_selector("#app", timeout=10000)
                detail_page = await page.locator("#app").get_attribute("data-page")
                detail_data = json.loads(detail_page)
                detail = detail_data.get("props", {}).get("site", {})
                
                site['occupiedDates'] = detail.get('occupiedDates', [])
                if 'images' in detail:
                    site['images'] = detail['images']
                if 'description' in detail:
                    site['description'] = detail['description']
                full_sites.append(site)
            except Exception as e:
                print(f"Kunne ikke hente {site['slug']}: {e}")
                full_sites.append(site)
                
        cached_full_sites = full_sites
        print(f"Cache opdateret med {len(cached_full_sites)} pladser!")
        data_ready_event.set()
        
        # Gå tilbage til forsiden for at holde en ren state
        await page.goto("https://booking.landjord.com/")
    except Exception as e:
        print("Fejl i background_fetch_all_data:", e)

@app.on_event("startup")
async def startup_event():
    global pw, browser, context, page
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True)
    context = await browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    page = await context.new_page()
    print("Initialiserer browser session og omgår WAF...")
    try:
        await page.goto("https://booking.landjord.com/")
        await page.wait_for_selector("#app", timeout=20000)
        print("WAF omgået. Session gemt!")
        
        # Start background fetch
        asyncio.create_task(background_fetch_all_data())
    except Exception as e:
        print("Kunne ikke omgå WAF:", e)

@app.on_event("shutdown")
async def shutdown_event():
    global pw, browser
    if browser:
        await browser.close()
    if pw:
        await pw.stop()

@app.get("/api/sites")
async def get_all_sites():
    try:
        await page.goto("https://booking.landjord.com/")
        await page.wait_for_selector("#app", timeout=10000)
        data_page = await page.locator("#app").get_attribute("data-page")
        data = json.loads(data_page)
        return JSONResponse(content=data.get("props", {}))
    except Exception as e:
        print(f"Error api/sites: {e}")
    raise HTTPException(status_code=500, detail="Kunne ikke hente pladser")

@app.get("/api/sites_full")
async def get_all_sites_full():
    if not data_ready_event.is_set():
        try:
            await asyncio.wait_for(data_ready_event.wait(), timeout=60.0)
        except asyncio.TimeoutError:
            raise HTTPException(status_code=503, detail="Data loader stadig, prøv igen om lidt")
    return JSONResponse(content={"sites": cached_full_sites})

@app.get("/api/sites/{site_slug}")
async def get_site_details(site_slug: str):
    try:
        await page.goto(f"https://booking.landjord.com/sites/{site_slug}")
        await page.wait_for_selector("#app", timeout=10000)
        data_page = await page.locator("#app").get_attribute("data-page")
        data = json.loads(data_page)
        return JSONResponse(content=data.get("props", {}))
    except Exception as e:
        print(f"Error api/sites/slug: {e}")
    raise HTTPException(status_code=500, detail="Kunne ikke hente plads-detaljer")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
