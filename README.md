# Landjord Overblik (Uofficielt)

Dette projekt er et lynhurtigt, moderne og alternativt interface til at skabe overblik over, hvor og hvornår lejrpladser på **Landjord.com** er ledige. 

**Vigtigt:** Applikationen er designet som et rent *Read-Only* værktøj. Systemet læser udelukkende offentligt tilgængelig data fra Landjord.com for at generere overblikket, og den **sender intet data, interaktioner eller bookinger den anden vej**. Alt der kræver input, foregår direkte på den officielle platform.

Projektet løser udfordringen med uoverskuelig kalendersøgning ved at tilbyde en række smarte visninger, der gør det markant lettere at planlægge ture ud i naturen. Samtidig omgår backend-proxyen server-udfordringer (WAF browser verifikation) gennem en varm, headless Playwright session.

---

## Features

*   **90-dages Matrix Kalender**: Et massivt, scrollbart overblik over ledige dage på tværs af pladser med ugenumre og fremhævning af weekender.
*   **Geolokalisering (Distance Filter)**: Klik på kompaspilen for at tillade browseren at finde din lokation automatisk. Systemet sorterer derefter alle pladser efter afstanden til dig, beregnet i luftlinje.
*   **Fleksibel Weekend-mode**: Søg ikke kun på hele weekender, men filtrer lynhurtigt for 1 overnatning (f.eks. kun Fredag-Lørdag eller Lørdag-Søndag).
*   **Interaktive "Hover" Kort & Billeder**: Få øjeblikkeligt vist pladsens geografiske placering på et kort eller store billeder af naturen blot ved at holde musen over pladsens navn – uden unødige klik.
*   **Direkte Viderestilling**: Genveje integreret i alle visninger, der tager dig direkte videre til den specifikke plads på det officielle Landjord.com-website, hvor du kan foretage din booking.
*   **Mørkt Tema**: Moderne, rent og roligt design, der er behageligt for øjnene.

---

## Teknisk Arkitektur

Applikationen er opdelt i to uafhængige tjenester:

1.  **Frontend (React + Vite)**: 
    *   Responsive og lynende hurtig SPA (Single Page Application).
    *   Koden er modulært opbygget med isolerede komponenter for kort, matrix og weekend-visning.
    *   Indeholder omfattende Unit-tests (Vitest) for distanceudregninger og tidszoner for at forhindre UTC-bugging.
2.  **Backend Proxy (Python + FastAPI + Playwright)**:
    *   Kører en isoleret og sikker baggrundstråd, som henter ledighed og pladsdata via headless Chromium hver time.
    *   Serverer udelukkende fra en lynhurtig indbygget memory-cache (`/api/sites_full`), for at undgå API overload og Playwright race-conditions.
    *   Ekstraherer React/Inertia JSON payloads direkte fra `data-page` attributterne i DOM'en for at omgå WAF og bot-beskyttelse.

---

## Testsuite
Projektet er sikret via moderne test-frameworks:

- **Frontend (Vitest):** Kør `npm run test` inde i `/frontend` mappen for at sikre at afstandsberegninger og dato-formatering kører fejlfrit.
- **Backend (Pytest):** Kør `pytest tests/` i roden for at teste proxy cachen.

---

## Deployment

### Metode 1: Standard Docker Compose (Fra kildekode)
Den nemmeste måde at starte projektet lokalt på, er ved blot at lade Docker Compose bygge og starte det hele i én kommando – uden yderligere indgriben:
```bash
docker compose up -d --build
```
*(Alternativt kan du køre `bash deploy.sh` for en endnu mere guidet opstart).*

**Vigtigt om Sikkerhed & Lokalisering:** For at browserens lokalisering (kompasset) kan fungere på lokale netværk (f.eks. på en hjemmeserver), bygger containeren automatisk et selv-signeret SSL-certifikat. Du skal derfor tilgå dashboardet via **HTTPS** (f.eks. `https://localhost:5821` eller din servers IP). Browseren vil advare om at certifikatet er "usikkert", men du klikker bare "Avanceret -> Fortsæt" for at få adgang.

### Metode 2: Portainer (Via Git Repository / Stacks)
Projektet er bygget til fuld integration med **Portainer**. Du kan lade Portainer hente og bygge projektet direkte fra Git uden du behøver en terminal:
1. Åbn din Portainer instans og gå til **Stacks**.
2. Klik på **Add stack**.
3. Navngiv din stack (f.eks. `landjord`).
4. Vælg **Repository** som Build Method.
5. Indsæt dit Git repository URL.
6. Efterlad *Compose path* som `docker-compose.yml` (da den ligger i roden).
7. Klik **Deploy the stack**. 
Portainer vil nu automatisk downloade filerne, bygge de to Docker-images (`backend` og `frontend`) i baggrunden, og starte projektet op.

*Bemærk:* Skal du kunne deploye projektet udelukkende med filen `docker-compose.yml` (uden at have kildekoden lokalt), kræver det at vi uploader (pusher) de byggede Docker images til et image registry (som f.eks. Docker Hub eller GitHub Container Registry), og opdaterer compose-filen til at pege på `image: ...` i stedet for `build: ...`.

---

## Billeder & Copyright (Legal Safeguard)
For at sikre at projektet ikke automatisk distribuerer eller indlæser tredjeparts ophavsretligt beskyttet materiale (billeder af lejrpladser), er hentning af billeder **deaktiveret som standard**.

Hvis du hoster projektet privat og selv ønsker at se billeder fra Landjord, skal du åbne filen `frontend/src/App.jsx` og ændre flaget i toppen af filen (linje ~20) fra `false` til `true`:
```javascript
// LEGAL SAFEGUARD: Set to true to enable displaying copyrighted images from landjord.com
const ENABLE_EXTERNAL_IMAGES = true;
```
Herefter skal du genbygge din frontend container.

---

## Stop eller genstart
For at stoppe serveren:
```bash
docker compose down
```

For at se logs og fejlfinde:
```bash
docker compose logs -f
```

---

## Juridisk Ansvarsfraskrivelse (Disclaimer)

**Dette projekt er uofficielt og udelukkende skabt til uddannelses- og forskningsmæssige formål (Proof of Concept).**

*   **Ingen affiliation:** Dette projekt er på ingen måde associeret med, støttet af, eller vedligeholdt af Landjord, Simply.com eller nogen af deres samarbejdspartnere.
*   **Intet ansvar for brug:** Al brug af kildekoden, scripts og tilknyttede systemer sker fuldstændigt på **eget ansvar**. Forfatteren af dette projekt påtager sig **intet** juridisk eller økonomisk ansvar for eventuelle konsekvenser, skader, datatab, blokerede IP-adresser eller brud på tredjeparts brugerbetingelser (Terms of Service) forårsaget af at downloade, installere eller eksekvere denne kode.
*   **"As-Is" software:** Koden stilles til rådighed "som den er" (as-is), uden nogen form for garanti, hverken udtrykt eller underforstået. Der gives ingen garanti for, at koden er fejlfri, sikker eller lovlig at anvende i din specifikke jurisdiktion.
*   **Ophavsret og Varemærker:** Alle rettigheder til varemærker, navne, logoer og billeder tilhører udelukkende deres respektive ejere. Dette repository distribuerer ikke tredjeparts ophavsretligt beskyttede aktiver.
*   **Opfordring til lovlig brug:** Brugere af dette repository opfordres på det kraftigste til at gennemlæse og respektere de gældende betingelser for Landjord.com. Koden må ikke benyttes til overbelastningsangreb, uautoriseret dataminering, chikane eller andre skadelige aktiviteter. Målet med projektet er udelukkende at demonstrere alternative UI-løsninger. Hvis du ønsker at bygge kommercielle løsninger, skal du rette direkte henvendelse til ejerne af platformen.
