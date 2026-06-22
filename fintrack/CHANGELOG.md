# Changelog

## 0.1.5

- Kategorien sind jetzt direkt im UI bearbeitbar (nicht mehr nur anlegen/
  löschen); Formular wechselt per "bearbeiten"/"Abbrechen" zwischen Anlegen-
  und Bearbeiten-Modus.
- Kategorien können ein MDI-Icon erhalten (Freitext-Eingabe, kein Picker);
  das Icon wird zur Laufzeit über die öffentliche Iconify-API geladen statt
  als Icon-Set eingebettet zu werden.
- Löschen einer Kategorie entfernt sie jetzt kaskadierend aus allen
  betroffenen Buchungen, Regeln und gelernten Zuordnungen, statt an einer
  Fremdschlüssel-Verletzung zu scheitern.
- Dashboard-Diagramme laufen jetzt über ApexCharts statt Recharts
  (Monatsbilanz, Kontostandsverlauf inkl. Soll/Ist-Stützpunkten,
  Ausgaben-nach-Kategorie als Donut), weiterhin Dark/Light-Mode-bewusst.
- Datumsangaben werden im gesamten Frontend einheitlich als TT.MM.JJJJ
  dargestellt (Buchungen, Wertstellung, Saldo-Anker).
- Fehler behoben: Bei Bestandsinstallationen, deren "ING CSV"-Importprofil
  vor Einführung der Wertstellungsdatum-Spalte angelegt wurde, blieb das
  Wertstellungsdatum beim Import dauerhaft leer; ein einmaliges Backfill
  beim Start korrigiert das vorhandene Profil.

## 0.1.4

- Frontend-Styling überarbeitet und an das Design von my-wallpanel
  angeglichen: Dark-Mode als Standard mit per Toggle umschaltbarem
  Light-Mode (Auswahl bleibt über `localStorage` erhalten), einheitliches
  Farbschema, Abstände und Border-Radius über CSS-Variablen, neue
  Glass-Card-Optik für Panels und Tabellen, überarbeitete Titelzeile mit
  Navigation (inkl. mobilem Menü unter 768px).
- Tailwind CSS vollständig entfernt; das Frontend verwendet jetzt
  ausschließlich CSS Modules mit den gemeinsamen Design-Tokens, analog zu
  my-wallpanel.

## 0.1.3

- Port ist jetzt über die Add-on-Konfiguration einstellbar (`port`, Standard
  8099). Hinweis: Ingress ist intern fest auf 8099 verdrahtet; bei
  Abweichung wird beim Start eine Warnung ins HA-Log geschrieben.
- Vorkonfiguriertes Importprofil "ING CSV" wird beim ersten Start automatisch
  angelegt (Spalten Buchung/Valuta/Betrag/Auftraggeber-Empfänger/
  Verwendungszweck, Saldo ignoriert, Header in Zeile 14).

## 0.1.2

- `init: false` in der Add-on-Konfiguration ergänzt. Damit wird s6-overlay v3
  des Base-Images korrekt als PID 1 ausgeführt; behebt den Fehlstart
  `s6-overlay-suexec: fatal: can only run as pid 1`.

## 0.1.1

- App umbenannt zu "My Cash Supervisor" (Anzeigename in Add-on-Liste,
  Ingress-Panel und Web-UI; technischer Slug `fintrack` bleibt unverändert,
  damit HA dies weiterhin als Update des bestehenden Add-ons erkennt).
- CSV-Import unterstützt jetzt zusätzlich die Wertstellungsdatum-Spalte
  (Buchungsdatum bleibt für die Dublettenerkennung maßgeblich).
- Strukturiertes Logging (`[fintrack]` / `[fintrack:error]`) und robustere
  Fehlerbehandlung für Diagnosen über die HA-Logs.
- Start-Skript auf die s6-overlay-`services.d`-Konvention umgestellt; behebt
  einen Fehlstart (`s6-overlay-suexec: fatal: can only run as pid 1`) auf
  HA-Base-Images.

## 0.1.0

- Initial release: CSV-Import mit Importprofilen, Dedup, Saldo-Anker mit
  Soll/Ist-Abgleich, regelbasierte Kategorisierung mit Lernfunktion,
  Auswertungen (Monatsbilanz, Kontostandsverlauf, Kategorie, Vergleich).
