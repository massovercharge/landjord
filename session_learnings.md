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
