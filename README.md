# Finance Tracker

CSV-basierte Haushaltsfinanz-App als Home-Assistant-Add-on (Ingress-only).
Siehe [CONCEPT.md](./CONCEPT.md) für Architektur, Datenmodell und API.

## Als HA Add-on installieren

In Home Assistant unter **Einstellungen → Add-ons → Add-on-Store → ⋮ →
Repositories** diese GitHub-URL eintragen. Finance Tracker erscheint danach
in der Liste verfügbarer Add-ons.

## Lokale Entwicklung

```bash
# Backend
cd fintrack/server
npm install
npm start            # http://localhost:8099 (Default-Port lokal)
npm test             # Unit-Tests (node:test)
npm run lint         # ESLint

# Frontend (separat, mit Proxy auf das Backend)
cd fintrack/web
npm install
npm run dev
npm run lint         # ESLint
```

Für einen Produktionsbuild des Frontends, der vom Express-Server mitausgeliefert wird:

```bash
cd fintrack/web
npm run build         # erzeugt fintrack/web/dist
```

GitHub Actions (`.github/workflows/ci.yml`) führt Lint, Tests und den
Frontend-Build bei jedem Push/PR aus.

## Konventionen

- **Styling**: gemeinsame Primitive (`.card`, `.button`, `.input`, `.iconButton`)
  liegen als globale Klassen in `fintrack/web/src/index.css`; alles
  Seitenspezifische als `*.module.css` (CSS-Modules) neben Komponente/Seite.
- **Chart-Farben**: kommen ausschließlich aus
  `fintrack/web/src/utils/chartTheme.ts` (Single Source of Truth, spiegelt die
  Theme-Tokens aus `index.css`) — keine Hex-Werte direkt in Chart-Optionen.
