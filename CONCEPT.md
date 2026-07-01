# FinTrack – Einnahmen-/Ausgaben-Überwachung (HA Add-on)

CSV-basierte Haushaltsfinanz-App. Liest Banken-CSV-Exporte ein, kategorisiert
Buchungen heuristisch, führt einen berechneten Saldo gegen manuell gesetzte
Stützpunkte und liefert Monats-/Kategorieauswertungen.

Läuft als **Home Assistant Add-on, nur per Ingress erreichbar** (kein offener
Port). Stack: React + Vite + TypeScript + CSS-Modules + ApexCharts (Frontend),
Node/Express + SQLite (better-sqlite3) (Backend).

---

## 1. Architektur

```
┌─────────────────────────────────────────────┐
│ HA Supervisor (Ingress)                      │
│   └─ Add-on Container                         │
│        ├─ Express (interner Port, s.u.)      │
│        │    ├─ /api/...        REST           │
│        │    └─ serviert gebautes React-Frontend │
│        └─ SQLite  (/data/fintrack.db)         │
└─────────────────────────────────────────────┘
```

- **Ein Container**, ein Prozess. Express serviert sowohl die API als auch die
  statischen Vite-Build-Dateien. Das hält das Add-on schlank.
- **Persistenz** liegt in `/data` (von HA persistent gemountet) → DB übersteht
  Add-on-Updates und Neustarts.
- **Interner Port**: `config.yaml` setzt `ingress_port: 0`, d.h. der Supervisor
  teilt zur Laufzeit einen freien Port zu. Das Run-Skript liest ihn über
  `bashio::addon.ingress_port` aus und reicht ihn als `PORT` an Express. Lokal
  (ohne HA) fällt Express auf den Default `8099` zurück.
- **Ingress**: HA reicht Requests unter einem Pfad-Präfix durch. Frontend muss
  daher mit *relativen* Pfaden arbeiten (siehe §7).
- **Kein Auth im Add-on nötig**: Ingress erzwingt, dass nur authentifizierte
  HA-Nutzer rankommen. Port wird nicht nach außen gemappt.

---

## 2. Datenmodell (SQLite)

```sql
-- Importprofile: ein Datensatz pro Bank/Konto-CSV-Layout
CREATE TABLE import_profiles (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,          -- "Sparkasse Giro"
  delimiter     TEXT NOT NULL DEFAULT ';',
  encoding      TEXT NOT NULL DEFAULT 'latin1',  -- latin1 | utf8
  date_format   TEXT NOT NULL DEFAULT 'DD.MM.YYYY',
  decimal_comma INTEGER NOT NULL DEFAULT 1,  -- 1 = "1.234,56"
  skip_rows     INTEGER NOT NULL DEFAULT 0,  -- Müllzeilen vor Header
  col_date      TEXT NOT NULL,          -- Spaltenname Buchungsdatum
  col_amount    TEXT,                   -- ein Betragsfeld (mit Vorzeichen)
  col_debit     TEXT,                   -- ODER getrennt Soll
  col_credit    TEXT,                   -- ODER getrennt Haben
  col_counterparty TEXT,
  col_purpose   TEXT,
  col_balance   TEXT                    -- optional: Saldo-Spalte je Zeile
);

CREATE TABLE categories (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  parent_id INTEGER REFERENCES categories(id),
  color     TEXT                        -- Hex für Charts
);

CREATE TABLE rules (
  id           INTEGER PRIMARY KEY,
  match_field  TEXT NOT NULL DEFAULT 'counterparty', -- counterparty | purpose | both
  match_type   TEXT NOT NULL DEFAULT 'contains',     -- contains | regex | exact
  pattern      TEXT NOT NULL,
  category_id  INTEGER NOT NULL REFERENCES categories(id),
  priority     INTEGER NOT NULL DEFAULT 100,  -- niedriger = zuerst
  enabled      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE transactions (
  id                 INTEGER PRIMARY KEY,
  date               TEXT NOT NULL,          -- ISO YYYY-MM-DD (Buchungsdatum)
  value_date         TEXT,                   -- ISO YYYY-MM-DD (Wertstellung, optional)
  amount             REAL NOT NULL,          -- + Einnahme, - Ausgabe
  type               TEXT NOT NULL,          -- in | out
  counterparty       TEXT,
  purpose            TEXT,
  category_id        INTEGER REFERENCES categories(id),
  category_src       TEXT,                   -- rule | learned | manual | llm | null
  source_file        TEXT,
  import_batch       INTEGER REFERENCES import_batches(id),
  loan_id            INTEGER REFERENCES loans(id),
  loan_payment_type  TEXT,                   -- rate | sondertilgung
  hash               TEXT NOT NULL UNIQUE    -- Dedup: date|amount|counterparty|purpose
                                              -- (bei mehreren identischen Buchungen am
                                              -- selben Tag ab der zweiten mit "#1",
                                              -- "#2", ... Suffix, siehe §3)
);

CREATE TABLE import_batches (
  id          INTEGER PRIMARY KEY,
  profile_id  INTEGER REFERENCES import_profiles(id),
  filename    TEXT,
  imported_at TEXT NOT NULL,
  row_count   INTEGER,
  inserted    INTEGER,                  -- neu
  skipped     INTEGER                   -- als Dubletten verworfen
);

-- Gelernte Zuordnungen: einmal manuell -> künftig automatisch
CREATE TABLE learned_map (
  id            INTEGER PRIMARY KEY,
  norm_key      TEXT NOT NULL UNIQUE,   -- normalisierter Empfänger
  category_id   INTEGER NOT NULL REFERENCES categories(id),
  hits          INTEGER NOT NULL DEFAULT 1
);

-- Saldo-Anker: Startsaldo + spätere Stützpunkte. source='csv' wird
-- automatisch aus der Saldo-Spalte eines Imports gepflegt (siehe §3);
-- ein manuell gesetzter Anker (source='manual') am selben Datum hat
-- Vorrang und wird nie überschrieben.
CREATE TABLE balance_anchors (
  id      INTEGER PRIMARY KEY,
  date    TEXT NOT NULL,                -- ISO YYYY-MM-DD
  balance REAL NOT NULL,
  type    TEXT NOT NULL DEFAULT 'checkpoint', -- start | checkpoint | month_end
  source  TEXT NOT NULL DEFAULT 'manual',     -- manual | csv
  note    TEXT
);

-- Settings, Investitionen und Darlehen sind eigenständige Ausbaustufen
-- (siehe §5/§6) und hier nur der Vollständigkeit halber erwähnt:
-- settings (buffer), investments (name, amount, priority),
-- loans (principal_amount, interest_rate_annual, monthly_payment, ...).
```

### Saldo-Logik (zentral)

- **Anker + Bewegungen** ist die Rechengrundlage: Es gibt genau **einen
  `start`-Anker**. Saldo(t) = Startsaldo + Σ(amount) aller Buchungen mit
  date ≤ t.
- **Checkpoints / Monatsende-Salden** sind zusätzliche `balance_anchors`, die
  *nicht* in die Rechnung eingehen, sondern als **Soll/Ist-Abgleich** dienen:
  An jedem Checkpoint vergleicht die App `berechnet` vs. `eingetragen`.
  Differenz ≠ 0 ⇒ Buchungen fehlen oder es gibt Doppler → Warnhinweis.
- Diese Validierung ist der eingebaute Schutz gegen Importfehler. Bewusst so
  getrennt: Bewegungen rechnen, Anker prüfen.

---

## 3. Import-Pipeline

1. **Upload** CSV → Backend wählt/anwendet `import_profile`.
2. **Encoding** dekodieren (latin1/utf8) — sonst Umlaute kaputt.
3. **skip_rows** abschneiden, Headerzeile finden.
4. **Parse** mit papaparse (Delimiter aus Profil).
5. **Normalisieren** pro Zeile:
   - Datum `DD.MM.YYYY` → ISO `YYYY-MM-DD`
   - Betrag `1.234,56` → `1234.56`; Soll/Haben → Vorzeichen
   - `type` aus Vorzeichen ableiten
6. **Hash** bilden (`date|amount|counterparty|purpose`), Dedup gegen DB. Mehrere
   Buchungen mit identischer Kombination *innerhalb derselben Datei* (z. B.
   zwei gleich hohe Bargeldabhebungen am selben Tag) bekommen ab der zweiten
   einen `#1`, `#2`, … Suffix, damit sie sich nicht gegenseitig als Dublette
   verwerfen — ein erneuter Import derselben Datei reproduziert dieselbe
   Reihenfolge und bleibt damit idempotent.
7. **Kategorisieren** (siehe §4) für neue Zeilen.
8. **Insert** + `import_batch`-Protokoll (inserted/skipped).
9. **CSV-Checkpoint**: falls das Profil eine Saldo-Spalte (`col_balance`)
   mitbringt, wird aus der Zeile mit dem spätesten Datum automatisch ein
   `balance_anchors`-Eintrag mit `source='csv'` angelegt bzw. aktualisiert —
   der eingebaute Soll/Ist-Abgleich ganz ohne manuellen Zusatzschritt.

Idempotent: dieselbe oder überlappende CSV mehrfach einlesen erzeugt keine
Dubletten.

---

## 4. Kategorisierung (mehrstufig)

Reihenfolge je Buchung, erste Übereinstimmung gewinnt:

1. **Regeln** (`rules`, nach `priority`): Empfänger/Zweck contains/regex/exact.
2. **Gelernt** (`learned_map`): normalisierter Empfänger schon mal manuell
   zugeordnet → übernehmen.
3. Sonst `category_id = NULL` → landet in „Nicht kategorisiert".

> **Geplant, noch nicht implementiert**: optionaler LLM-Fallback (abschaltbar),
> der den nicht zugeordneten Rest gebündelt an die Claude-API schickt und
> JSON-Kategorien zurückbekommt — **nur normalisierter Empfänger + Zweck**, keine
> IBANs/Salden, standardmäßig aus. Aktuell existiert serverseitig kein
> Anthropic-Aufruf; die Kategorisierung endet bei Regeln + Gelerntem.

Manuelle Zuordnung im UI schreibt nach `learned_map` (lernt für die Zukunft)
und setzt `category_src = manual`.

---

## 5. Auswertungen

**MVP**
- Monatsbilanz: Einnahmen / Ausgaben / Netto je Monat (Balken + Netto-Linie)
- Sparquote je Monat (Netto/Einnahmen), gleitender 3-/6-Monats-Schnitt
- Kontostandsverlauf (berechnet) als Linie, mit Soll/Ist-Markern an
  Checkpoints, plus linearer Forecast (Gesamt- und Baseline-Rate)
- Restbudget im laufenden Monat: Kontostand + erwartete restliche
  wiederkehrende Einnahmen − erwartete restliche wiederkehrende Ausgaben −
  Puffer (KPI-Kachel im Dashboard, `/api/reports/month-status`)
- Ausgaben nach Kategorie (Donut für Monat, Balken im Zeitverlauf), netto
  je Kategorie verrechnet (Erstattungen mindern die Ausgabe)
- Kategorie-Übersichtstabelle mit Trends (1/6/12/24 Monate) und
  Kategorie-Heatmap (Kategorie × Monat)
- Monatsvergleich: Monat vs. Vormonat / Vorjahresmonat
- Größte Einzelbuchungen (Top-N) im gewählten Zeitraum
- Erkannte Abos/Daueraufträge (gleicher Empfänger + Betrag, monatlicher
  Abstand, mind. 3 Vorkommen)
- Anomalien: Buchungen, die deutlich über dem Kategorie-Ø liegen
- „Nicht kategorisiert"-Liste als Arbeitsvorrat
- Darlehen: Tilgungsplan, Zins-/Tilgungsverlauf, Sondertilgungs-Ersparnis
- Investitionsplanung: leistbare Investitionen anhand Kontostand, Puffer
  und Ø wiederkehrendem Cashflow
- Persönliche vs. offizielle Inflation (Eurostat HICP) nach COICOP-Gruppe

**Ausbau (später)**
- Kategorie-Drilldown
- Optionaler LLM-Fallback für die Kategorisierung (siehe §4)
- Einheitliche Lade-/Fehlerzustände in der UI (aktuell scheitern Requests
  clientseitig still)

---

## 6. REST-API

```
GET  /api/health
# Transaktionen
GET   /api/transactions?from&to&category&uncategorized&q&loan&unassigned_loan
POST  /api/transactions              { date, amount, ... }
PATCH /api/transactions/:id          { category_id, loan_id, ... } -> schreibt learned_map
DELETE /api/transactions/:id
# Import
POST /api/import                     multipart CSV + profile_id -> legt ggf. CSV-Checkpoint an
GET  /api/import/batches
GET/POST/PATCH/DELETE /api/profiles  # Importprofile
# Kategorien & Regeln
GET/POST/PATCH/DELETE /api/categories
GET/POST/PATCH/DELETE /api/rules
POST /api/recategorize               # Regeln+Gelerntes neu anwenden, räumt veraltete Treffer ab
# Saldo
GET/POST /api/balance/anchors
PATCH/DELETE /api/balance/anchors/:id
GET  /api/balance/series?from&to&field   # berechneter Verlauf + Checkpoint-Diffs + Forecast
# Auswertungen
GET  /api/reports/monthly?from&to&field
GET  /api/reports/savings-rate?from&to&field
GET  /api/reports/by-category?from&to&field
GET  /api/reports/by-category-monthly?type&from&to&field
GET  /api/reports/compare?month&field
GET  /api/reports/category-summary?rollup&field   # Summen/Trends/Monatsraster je Kategorie
GET  /api/reports/month-status                    # Restbudget-KPI für den laufenden Monat
GET  /api/reports/top-transactions?type&from&to&field&limit
GET  /api/reports/subscriptions?months            # erkannte Abos/Daueraufträge
GET  /api/reports/anomalies?months&threshold
# Sonstiges
GET/PUT  /api/settings                # aktuell nur { buffer }
GET/POST/PATCH/DELETE /api/investments
GET/POST/PATCH/DELETE /api/loans      # inkl. GET /api/loans/:id mit Tilgungsplan/Prognose
GET  /api/inflation/headline?months
GET  /api/inflation/breakdown
GET  /api/inflation/meta
```

---

## 7. Ingress-Besonderheiten (wichtig!)

- **Relative Asset-Pfade**: in `vite.config.ts` `base: './'` setzen, sonst
  lädt das Frontend hinter dem Ingress-Präfix keine Assets.
- **API-Calls relativ**: nie `http://host:port/api`, immer `./api/...` bzw.
  über einen aus `window.location` abgeleiteten Base-Pfad.
- Express liefert das SPA mit Catch-all-Route (`/* -> index.html`), API-Routen
  davor registrieren.
- Ingress terminiert Auth — innerhalb der App keine zusätzliche Anmeldung.

---

## 8. Repo-Struktur

```
fintrack-addon/
├─ README.md
├─ CONCEPT.md                ← dieses Dokument
├─ fintrack/                 ← das eigentliche Add-on
│  ├─ config.yaml            ← HA Add-on Manifest (Ingress)
│  ├─ Dockerfile
│  ├─ .dockerignore
│  ├─ rootfs/etc/services.d/fintrack/run  ← Startskript (s6/bashio)
│  ├─ CHANGELOG.md
│  ├─ server/                ← Express + SQLite (better-sqlite3)
│  │  ├─ index.js  db.js  log.js
│  │  ├─ routes/ import/ rules/ lib/ services/
│  │  ├─ test/             ← node:test Unit-Tests
│  │  ├─ eslint.config.js
│  │  └─ package.json
│  └─ web/                   ← React + Vite + TypeScript + CSS-Modules
│     ├─ index.html
│     ├─ vite.config.ts
│     ├─ eslint.config.js
│     └─ src/  (pages/ components/ utils/)
└─ repository.yaml           ← macht das Repo als HA-Add-on-Quelle nutzbar
```

`repository.yaml` im Root lässt dich in HA **Einstellungen → Add-ons →
Add-on-Store → ⋮ → Repositories** einfach die GitHub-URL eintragen; das Add-on
erscheint dann direkt zur Installation.

---

## 9. Bauplan (Reihenfolge)

1. Repo-Gerüst + HA-Configs, Add-on installierbar (zeigt „Hello")
2. CSV-Import + Normalisierung + Dedup-Hash (sauber, sonst Müllfortpflanzung)
3. Saldo-Anker (Start + Checkpoints) + berechneter Verlauf + Soll/Ist-Diff
4. Regelbasierte Kategorisierung + manuelles Nachordnen im UI + learned_map
5. Auswertungen MVP (Monatsbilanz, Verlauf, Kategorie, Vergleich)
6. Ausbaustufen (Heatmap, Abo-Erkennung, Forecast, optional LLM-Fallback)
