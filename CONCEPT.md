# FinTrack – Einnahmen-/Ausgaben-Überwachung (HA Add-on)

CSV-basierte Haushaltsfinanz-App. Liest Banken-CSV-Exporte ein, kategorisiert
Buchungen heuristisch, führt einen berechneten Saldo gegen manuell gesetzte
Stützpunkte und liefert Monats-/Kategorieauswertungen.

Läuft als **Home Assistant Add-on, nur per Ingress erreichbar** (kein offener
Port). Stack: React + Vite + Tailwind (Frontend), Node/Express + SQLite (Backend).

---

## 1. Architektur

```
┌─────────────────────────────────────────────┐
│ HA Supervisor (Ingress)                      │
│   └─ Add-on Container                         │
│        ├─ Express (Port 8099, intern)        │
│        │    ├─ /api/...        REST           │
│        │    └─ serviert gebautes React-Frontend │
│        └─ SQLite  (/data/fintrack.db)         │
└─────────────────────────────────────────────┘
```

- **Ein Container**, ein Prozess. Express serviert sowohl die API als auch die
  statischen Vite-Build-Dateien. Das hält das Add-on schlank.
- **Persistenz** liegt in `/data` (von HA persistent gemountet) → DB übersteht
  Add-on-Updates und Neustarts.
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
  color     TEXT,                       -- Hex für Charts
  kind      TEXT NOT NULL DEFAULT 'variable'  -- fixed | variable | income | transfer
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
  id            INTEGER PRIMARY KEY,
  date          TEXT NOT NULL,          -- ISO YYYY-MM-DD
  amount        REAL NOT NULL,          -- + Einnahme, - Ausgabe
  type          TEXT NOT NULL,          -- in | out
  counterparty  TEXT,
  purpose       TEXT,
  category_id   INTEGER REFERENCES categories(id),
  category_src  TEXT,                   -- rule | learned | manual | llm | null
  source_file   TEXT,
  import_batch  INTEGER REFERENCES import_batches(id),
  hash          TEXT NOT NULL UNIQUE    -- Dedup: date|amount|counterparty|purpose
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

-- Saldo-Anker: Startsaldo + spätere Stützpunkte
CREATE TABLE balance_anchors (
  id      INTEGER PRIMARY KEY,
  date    TEXT NOT NULL,                -- ISO YYYY-MM-DD
  balance REAL NOT NULL,
  type    TEXT NOT NULL DEFAULT 'checkpoint', -- start | checkpoint | month_end
  source  TEXT NOT NULL DEFAULT 'manual',     -- manual | csv
  note    TEXT
);
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
6. **Hash** bilden (`date|amount|counterparty|purpose`), Dedup gegen DB.
7. **Kategorisieren** (siehe §4) für neue Zeilen.
8. **Insert** + `import_batch`-Protokoll (inserted/skipped).

Idempotent: dieselbe oder überlappende CSV mehrfach einlesen erzeugt keine
Dubletten.

---

## 4. Kategorisierung (mehrstufig)

Reihenfolge je Buchung, erste Übereinstimmung gewinnt:

1. **Regeln** (`rules`, nach `priority`): Empfänger/Zweck contains/regex/exact.
2. **Gelernt** (`learned_map`): normalisierter Empfänger schon mal manuell
   zugeordnet → übernehmen.
3. **LLM-Fallback (optional, abschaltbar)**: Rest gebündelt an Claude-API,
   JSON-Kategorien zurück. **Nur normalisierter Empfänger + Zweck**, keine
   IBANs/Salden. Standardmäßig aus.
4. Sonst `category_id = NULL` → landet in „Nicht kategorisiert".

Manuelle Zuordnung im UI schreibt nach `learned_map` (lernt für die Zukunft)
und setzt `category_src = manual`.

---

## 5. Auswertungen

**MVP**
- Monatsbilanz: Einnahmen / Ausgaben / Netto je Monat (Balken + Netto-Linie)
- Kontostandsverlauf (berechnet) als Linie, mit Soll/Ist-Markern an Checkpoints
- Ausgaben nach Kategorie (Donut für Monat, Balken im Zeitverlauf)
- Monatsvergleich: Monat vs. Vormonat / Vorjahresmonat
- „Nicht kategorisiert"-Liste als Arbeitsvorrat

**Ausbau (später)**
- Sparquote je Monat, gleitender 3-/6-Monats-Schnitt
- Kategorie-Heatmap (Kategorie × Monat)
- Top-N Einzelbuchungen, Kategorie-Drilldown
- Abo-/Daueraufträge erkennen (regelmäßiger Empfänger + Betrag)
- Fix vs. variabel (via `categories.kind`), einfacher Monatsend-Forecast
- Anomalien (Buchung ≫ Kategorie-Schnitt)

---

## 6. REST-API (Skizze)

```
GET  /api/health
# Transaktionen
GET  /api/transactions?from&to&category&uncategorized
PATCH /api/transactions/:id        { category_id }   -> schreibt learned_map
# Import
POST /api/import                    multipart CSV + profile_id
GET  /api/import/batches
# Kategorien & Regeln
GET/POST/PATCH/DELETE /api/categories
GET/POST/PATCH/DELETE /api/rules
POST /api/recategorize              # Regeln neu auf alle anwenden
# Saldo
GET  /api/balance/anchors
POST /api/balance/anchors           { date, balance, type }
GET  /api/balance/series?from&to    # berechneter Verlauf + Checkpoint-Diffs
# Auswertungen
GET  /api/reports/monthly?from&to
GET  /api/reports/by-category?month
GET  /api/reports/compare?month
```

---

## 7. Ingress-Besonderheiten (wichtig!)

- **Relative Asset-Pfade**: in `vite.config.js` `base: './'` setzen, sonst
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
│  ├─ run.sh                 ← Startskript (s6/bashio)
│  ├─ icon.png  logo.png
│  ├─ CHANGELOG.md
│  ├─ server/                ← Express + SQLite
│  │  ├─ index.js
│  │  ├─ db.js
│  │  ├─ import/ rules/ reports/
│  │  └─ package.json
│  └─ web/                   ← React + Vite + Tailwind
│     ├─ index.html
│     ├─ vite.config.js
│     ├─ tailwind.config.js
│     └─ src/
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
