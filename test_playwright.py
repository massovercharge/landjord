import asyncio
from playwright.async_api import async_playwright
import json

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        print("Fetching main page...")
        await page.goto("https://booking.landjord.com/")
        await page.wait_for_selector("#app", timeout=20000)
        
        data_page = await page.locator("#app").get_attribute("data-page")
        data = json.loads(data_page)
        sites_raw = data.get("props", {}).get("sites", {})
        
        print("Type of sites_raw:", type(sites_raw))
        if isinstance(sites_raw, dict):
            print("Keys in sites_raw:", sites_raw.keys())
            sites = sites_raw.get("data", [])
        else:
            sites = sites_raw
        
        print("Number of sites found:", len(sites))
        
        if len(sites) > 0:
            site = sites[0]
            print(f"Fetching details for {site.get('slug')}...")
            await page.goto(f"https://booking.landjord.com/sites/{site.get('slug')}")
            await page.wait_for_selector("#app", timeout=10000)
            detail_page = await page.locator("#app").get_attribute("data-page")
            detail_data = json.loads(detail_page)
            detail = detail_data.get("props", {}).get("site", {})
            print("Occupied dates:", len(detail.get("occupiedDates", [])))
            print("Site keys:", detail.keys())
            
        await browser.close()

asyncio.run(main())
