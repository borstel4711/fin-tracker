# Changelog

## 0.1.15

- Neue Seite "Einstellungen" (erreichbar über ein neues Zahnrad-Symbol in der
  Titelzeile, links vom Theme-Switch); enthält vorerst die Einstellung
  "Puffer" für einen Mindestsaldo-Betrag.
- Salden: beim Anlegen eines neuen Eintrags wird das Datumsfeld jetzt mit dem
  nächsten Monatsende vorbelegt statt leer zu bleiben.
- Salden: Button "Anker speichern" heißt jetzt einheitlich "Speichern" (wie
  beim Bearbeiten).
- Salden: in der Tabelle lässt sich ein Eintrag jetzt auch löschen (bisher
  nur bearbeiten); die Notiz eines Eintrags erscheint außerdem als Sublabel
  unterhalb des Typs.
- Salden: im Saldenverlauf markiert eine gestrichelte Linie jetzt den
  Mittelwert der eingetragenen Salden; liegt ein Puffer (siehe
  Einstellungen) vor, wird der Bereich darunter zusätzlich rot eingefärbt,
  damit eine Unterschreitung sofort auffällt.

## 0.1.14

- Saldo-Seite umbenannt zu "Salden" (vorher "Saldo-Anker"); die Typ-Spalte
  sowie das Typ-Dropdown im Formular zeigen jetzt sprechende Labels
  ("Startsaldo"/"Monatsende"/"Stichtag") statt der internen Werte
  start/month_end/checkpoint.
- Saldo: neues Liniendiagramm "Saldenverlauf" unterhalb der Anker-Tabelle,
  analog zum Kontostandsverlauf im Dashboard. Zeigt den eingetragenen und
  den berechneten Saldo je Anker als Linien mit Punktmarkern, X-Achse auf
  Monatsbasis.
- Saldo: Die Diff-Spalte auf der Saldo-Seite (sowie der zugrunde liegende
  Warnhinweis im Dashboard) vergleicht den eingetragenen Saldo eines
  Stützpunkts jetzt gegen den vorherigen Anker plus die Buchungen seither,
  statt gegen die kumulierte Summe seit dem Start-Anker. Vorher blieb eine
  einmal aufgetretene Abweichung dauerhaft in allen späteren Diffs sichtbar,
  auch wenn die nachfolgenden Buchungen exakt zum eingetragenen Saldo
  passten – die Diff war dadurch nicht nachvollziehbar.

## 0.1.13

- Kategorien: Heatmap "Kategorie × Monat" jetzt dark-mode-kompatibel.
  Vorzeichenbehaftete Beträge statt absoluter Werte, dark-mode-feste
  Farbskala, die von einer neutralen Mitte aus in Richtung Rot (Ausgaben)
  bzw. Grün (Einnahmen) ausschlägt (vorher: einfarbig, lief in dunklen
  Themes auf weiß/blass aus).
- Kategorien: einzelne Kategorien lassen sich jetzt über Klick-Pills
  oberhalb der Heatmap ausblenden, analog zu den Kategorie-Filter-Pills auf
  der Buchungsseite.

## 0.1.12

- Kategorien: neue sortierbare Übersichtstabelle oberhalb der Anlegen/
  Bearbeiten-Kachel mit Symbol, Name, Betrag insgesamt, Betrag im aktuellen
  Jahr, Betrag im aktuellen Monat, Ø Betrag/Monat (letzte 12 Monate) sowie
  6M-/12M-Trend als farbige mdi-Pfeile (Vergleich der jeweiligen
  Fenster-Hälfte, ±5 % Schwelle für "gleichbleibend").
- Kategorien: neue Heatmap "Kategorie × Monat" für die letzten 12 Monate
  (absolute Beträge, alle Kategorien) unterhalb der Übersichtstabelle.
- Neuer Endpunkt `GET /api/reports/category-summary` liefert Summen, Trends
  und das Monatsraster pro Kategorie für die neue Übersicht.

## 0.1.11

- Buchungen-Tabelle lässt sich jetzt per Klick auf eine Spaltenüberschrift sortieren (auf-/absteigend, mit Pfeil-Indikator).
- "Bearbeiten"/"Löschen"/"Hinzufügen" bei Kategorien, Regeln, Saldo-Ankern und Importprofilen sind jetzt mdi-Icon-Buttons statt reiner Textlinks.
- Auf der Buchungsseite steht das Kategorie-Icon jetzt ganz links in der Zelle, Farbpunkt und Name folgen rechts davon.
- Das fixed/variable/income/transfer-Enum (categories.kind) wurde entfernt; bestehende Datenbanken migrieren die Spalte automatisch weg (ALTER TABLE ... DROP COLUMN).
- "Ausgaben nach Kategorie" berücksichtigt jetzt den aktuellen Datumsfilter der Übersicht statt fest auf den aktuellen Kalendermonat zu zeigen; daneben gibt es jetzt zusätzlich eine ungefilterte "alle Zeit"-Variante.
- Beide Donut-Charts zeigen den Anteil je Kategorie als Prozentangabe und formatieren die Tooltip-Werte korrekt als €-Betrag mit zwei Dezimalstellen.


## 0.1.10

- Buchungen: Tabelle lässt sich jetzt per Klick auf eine Spaltenüberschrift
  sortieren (auf-/absteigend, mit Pfeil-Indikator in der aktiven Spalte).
- Buchungen: Kategorie-Icon steht jetzt ganz links in der Zelle, Farbpunkt
  und Name folgen rechts davon.
- UI: die Aktionen "bearbeiten"/"löschen"/"hinzufügen" bei Kategorien,
  Regeln, Saldo-Ankern und Importprofilen sind jetzt mdi-Icon-Buttons statt
  reiner Textlinks.
- Kategorien: das Feld "Art" (fixed/variable/income/transfer) wurde wieder
  entfernt — in der Praxis ungenutzt und durch keine Auswertung
  konsumiert. Bestehende Datenbanken migrieren die Spalte automatisch weg.
- Übersicht: "Ausgaben nach Kategorie" berücksichtigt jetzt den aktuellen
  Datumsfilter der Seite statt fest auf den aktuellen Kalendermonat zu
  zeigen; daneben gibt es jetzt zusätzlich eine ungefilterte "alle
  Zeit"-Variante. Beide Donut-Charts zeigen den Anteil je Kategorie jetzt
  als Prozentangabe und formatieren die Tooltip-Werte korrekt als €-Betrag
  mit zwei Dezimalstellen.

## 0.1.9

- Übersicht: Y-Achsen von Monatsbilanz und Kontostandsverlauf zeigen jetzt
  Währungsbeträge mit zwei Dezimalstellen statt Rohwerten.
- Übersicht: Im Kontostandsverlauf heißt die Serie jetzt "Saldo" (vorher
  "Soll/Ist-Stützpunkt"); zusätzlich projiziert eine neue, gestrichelte
  Prognose-Linie den Kontostand 30/60/90 Tage in die Zukunft, basierend auf
  der durchschnittlichen täglichen Veränderung.
- Übersicht: zwei neue Säulendiagramme "Ausgaben nach Kategorie (Verlauf)"
  und "Einnahmen nach Kategorie (Verlauf)" zeigen die Kategorieverteilung
  pro Monat, berücksichtigen den Datumsbereichsfilter und werden über einen
  neuen Endpunkt `GET /reports/by-category-monthly` beliefert.
- Kategorien: neues Feld "Modus" (Einmalig/Wiederkehrend) zur
  Klassifizierung, vorbereitend für spätere Auswertungen in den Charts.
- Saldo: Anker lassen sich jetzt im UI bearbeiten (nicht mehr nur anlegen),
  analog zum bestehenden "bearbeiten"/"Abbrechen"-Muster bei Kategorien und
  Importprofilen.

## 0.1.8

- App umbenannt zu "Finance Tracker" (Anzeigename in Add-on-Liste, Ingress-
  Panel und Web-UI; passend zum umbenannten GitHub-Repository
  `fin-tracker`. Technischer Slug `fintrack` bleibt unverändert, damit HA
  dies weiterhin als Update des bestehenden Add-ons erkennt).
- `url`-Felder in `config.yaml`/`repository.yaml` auf die neue
  GitHub-Repository-Adresse aktualisiert.

## 0.1.7

- Importprofile lassen sich jetzt im UI bearbeiten (nicht mehr nur anlegen/
  löschen); Formular wechselt per "bearbeiten"/"Abbrechen" zwischen Anlegen-
  und Bearbeiten-Modus, analog zu den Kategorien.
- Fehler behoben: Wertstellungsdatum blieb bei Buchungen, die bereits vor der
  Profil-Korrektur (siehe 0.1.5) importiert wurden, dauerhaft leer, weil ein
  erneuter Import derselben Datei per Dublettenerkennung übersprungen wurde,
  ohne das Feld nachzutragen. Ein erneuter Import ergänzt die Wertstellung
  jetzt nachträglich an bereits vorhandenen Buchungen, sofern sie dort noch
  fehlt.

## 0.1.6

- Buchungen: neue Filterleiste oberhalb der Tabelle (Datumsbereich per
  Schnellauswahl-Pills oder manuellem Datumsfeld, plus Kategorie-Pills inkl.
  Farbe/Icon je Kategorie); beide Filter wirken kombiniert (UND). Die
  bisherige Checkbox "nur nicht kategorisierte" ist jetzt einer der
  Kategorie-Pills.
- Buchungen: die Kategorie-Spalte zeigt pro Zeile jetzt ein farbiges
  Icon-Badge statt nur des Namens; ein Klick darauf blendet weiterhin das
  Dropdown zum Ändern ein.
- Übersicht: die Monatsbilanz lässt sich jetzt über dieselbe
  Datumsbereichs-Filterleiste wie auf der Buchungen-Seite einschränken.
- Ingress-Port wird jetzt dynamisch vom Supervisor zugewiesen
  (`ingress_port: 0`) statt fix auf 8099 zu bestehen; behebt Konflikte, wenn
  Port 8099 bereits von einem anderen Add-on belegt ist. Die bisherige
  `port`-Konfigurationsoption entfällt, da sie ohnehin nie einen echten
  Port-Konflikt vermeiden konnte (kein Host-Port-Mapping für dieses
  Ingress-only-Add-on).

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
