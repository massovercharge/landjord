# Session Learnings: Landjord Overblik

## Opnåede Resultater
- Projektet er fuldt transformeret fra et aktivt booking-værktøj til et rent **Read-Only Dashboard** ("Landjord Overblik (Uofficielt)").
- Alle referencer til aktiv booking og tvetydige navne er fjernet fra UI, API, README og script-udskrifter for at mindske varemærke- og juridiske risici.
- Billedvisning fra landjord.com styres nu via flaget `ENABLE_EXTERNAL_IMAGES` i `App.jsx`. Standard er slået fra, men det er ændret til `true` forud for næste deployment.
- Deep links (URL-hash) er implementeret, så appens state (Kort, Matrix, Weekender) bevares ved browser-refresh.
- Default port er ændret fra `8080` til `5821` for at undgå kollisioner med eksisterende docker services.
- Systemet er opdateret til at køre en **baggrunds-task** (`background_fetch_all_data`), der scraper data i loop hver time for at holde en thread-safe cache (`cached_full_sites`), hvilket forhindrer API timeout.
- Frontenden har fået rettet den drilske UTC-tidszone fejl i datovalg (via `getLocalDateString()`).

## Refaktorering og Testsuites
- Applikationens **Frontend** (`App.jsx`) er fuldstændigt opsplittet i mindre, logiske og vedligeholdelsesvenlige React-komponenter (`MapView`, `MatrixView`, `WeekendsView`, `FilterBar`).
- Custom hooks (`useSites`) og utilities (`helpers.js`) sikrer at datalogik og rendering er adskilt i frontend.
- **Backenden** er sikret imod race-conditions, ved at fjerne direkte API-styring af Playwright browser-sessionen (dvs. `/api/sites` endpoints er slettet). Scraperen opererer nu udelukkende på baggrunds-thread'en og er sikret imod nedbrud via forbedret exception-håndtering og tracebacks.
- Implementeret automatiske **Testsuites** for at højne kodesikkerheden fremover:
  - `pytest` for backend API-validering (mocked data).
  - `vitest` for frontend util-funktioner (beregning af afstand og lokal tidszone).

## Deployment Flow
- Koden deployeres til `192.168.50.5` via SSH og rsync.
- Der logges direkte ind som `root` (vigtig læring fra en tidligere Fail2Ban blokering pga. mislykket `danielw` login).
- Deployment script er:
   ```bash
   ssh root@192.168.50.5 "mkdir -p /root/landjord"
   rsync -avz --exclude='venv' --exclude='node_modules' --exclude='.git' ./ root@192.168.50.5:/root/landjord/
   ssh root@192.168.50.5 "cd /root/landjord && docker compose up -d --build"
   ```
- For at fjerne gamle images/byggecache efter en deployment køres: `docker system prune -af` på serveren.

## Opsamling og Bedste Praksis (KI / AI)
- **"God" Documentation:** Sørg altid for at opdatere dokumentationen når større arkitektoniske refaktoreringer udføres. Testsuites bør forklares klart i README.
- **Race conditions:** Undgå altid at udsætte stateful objekter (som en Playwright browser page) for usynkrone multi-user inputs via FastAPI endpoints. Cache/proxy mønsteret med adskilt worker/API er nu etableret.

## Handover: Mobil UX & Real Estate Optimering

### 1. Nuværende Status (Commit 5536c60)
- Alt nyt kode er testet (`pytest`, `vitest`, `npm run build`) og pushet til `origin/main`.
- Inkluderer: `StatsView.jsx` (Recharts overblik), `EditAlertView.jsx` (e-mail alerts), `mailer.py`, database snapshots & popularitetsanalyse, POI beregning (bus/supermarked).

### 2. Gennemført Mobil UX Review (Flaskehalse & Løsninger)
Følgende forbedringer skal implementeres for at maksimere skærmplads (real estate) og mobiloplevelsen (375px - 412px viewports):
1. **Bundnavigation (Bottom Navigation Bar) på mobil:**
   - Flyt fanebladene (`Forside`, `Kort`, `Kalender`, `Weekender`, `Statistik`) fra top-headeren til en fast, ergonomisk bundbar på mobil (`@media (max-width: 768px)`).
   - Frigør 150-250px vertikal skærmplads i toppen.
2. **Kompakt Top Header:**
   - Reducer headerhøjde drastisk på mobil.
   - Skjul `.mode-help-text` (eller gør til et lille modal-info-ikon).
   - Placer datovælgere/by-søgning som kompakte chips eller en collapsible skuffe.
3. **Maksimal Skærmudnyttelse (Margin & Padding):**
   - `.view-container` har `padding: 2rem` (stjæler ~17% af bredden på mobil). Reducer til `0.5rem - 0.75rem` (8-12px) under 768px.
4. **Kortvisning (MapView):**
   - Kortet skal udfylde 100% af den resterende skærmhøjde uden at være klemt af store filtre.
5. **Kalender/Matrix (MatrixView):**
   - Fjern desktop-referencer ("Hold musen over...").
   - Juster sticky kolonne og touch-target størrelse for dato-celler.
6. **Weekends- & Statistik-visning:**
   - Touch-venlig skift mellem kort og billede på mobil for weekend-kort.
   - Sikr at Recharts grafer i StatsView ikke afskærer akser på mobilbredder.

### 3. Bemærkning om browser-test i AI-miljøet
- Antigravity browser-subagenten fejler pga. en upstream CDN 404 for Playwright linux-driver v1.57.0.
- Mobilvisning testes og verificeres derfor mest pålideligt direkte via brugerens lokale Chrome DevTools (Device Emulation / iPhone / Android mode) eller ved kørsel mod lokal dev-server (`localhost:5173`).

### 4. Gennemført Implementering af Mobil UX
- **Bundnavigation:** `BottomNav.jsx` og `BottomNav.test.jsx` implementeret med iOS safe-area support og active states.
- **Header:** `.mode-help-text` skjules på mobil for at frigøre 50-80px, logo og filtre strømlinet til kompakte enkeltlinje-rækker.
- **Skærmudnyttelse:** `.view-container` padding reduceret til 8-12px på mobil; bund-padding respekterer bundbaren.
- **Kortvisning:** Udfylder 100% af resterende viewport med touch-optimerede popups.
- **Matrix:** Faste touch-targets (32x38px) på mobil og enhedsuafhængige tips.
- **Weekender & Statistik:** Touch-venlig flip mellem kort og billede via badge og `toggleSiteMedia`; Recharts responsive akser og afkortede labels forhindrer afskæring.
- Alle testsuites bestået: Vitest (11/11), Pytest (5/5), Vite production build.

### 5. Cloudflare Tunnel & Domæne Opsætning (`https://landjord.aegaarden.dk`)
- **Årsag til oprindelig fejl:** Cloudflare Tunnel pegede med HTTP mod `http://192.168.50.5:5821`, men `docker-compose.yml` mapped port 5821 til containerens port 443 (SSL). Nginx afviste derfor med `400 The plain HTTP request was sent to HTTPS port`.
- **Løsning:** 
  - Portmapping i `docker-compose.yml` ændret fra `5821:443` til `5821:80` (HTTP).
  - Nginx modtager nu ukrypteret HTTP fra Cloudflare Tunnel, mens Cloudflare håndterer det gyldige offentlige SSL-certifikat overfor klienterne på `https://landjord.aegaarden.dk/`.
  - `main.py` er opdateret med `BASE_URL` (standard: `https://landjord.aegaarden.dk`), så alle links i e-mail-notifikationer virker overalt i verden.
  - `deploy.sh` har fået tilføjet `--exclude '.env'` til `rsync` for at forhindre utilsigtet sletning af serverens `.env`-fil.

