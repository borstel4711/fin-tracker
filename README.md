# My Cash Supervisor

CSV-basierte Haushaltsfinanz-App als Home-Assistant-Add-on (Ingress-only).
Siehe [CONCEPT.md](./CONCEPT.md) für Architektur, Datenmodell und API.

## Als HA Add-on installieren

In Home Assistant unter **Einstellungen → Add-ons → Add-on-Store → ⋮ →
Repositories** diese GitHub-URL eintragen. My Cash Supervisor erscheint danach
in der Liste verfügbarer Add-ons.

## Lokale Entwicklung

```bash
# Backend
cd fintrack/server
npm install
npm start            # http://localhost:8099

# Frontend (separat, mit Proxy auf das Backend)
cd fintrack/web
npm install
npm run dev
```

Für einen Produktionsbuild des Frontends, der vom Express-Server mitausgeliefert wird:

```bash
cd fintrack/web
npm run build         # erzeugt fintrack/web/dist
```
