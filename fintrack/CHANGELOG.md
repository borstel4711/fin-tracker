# Changelog

## 0.1.26

- Neue KPI-Kachelzeile im Dashboard: verfügbares Restbudget im laufenden
  Monat (Kontostand + erwartete restliche wiederkehrende Einnahmen −
  erwartete restliche wiederkehrende Ausgaben − Puffer), Kontostand,
  Ausgaben MTD, nicht kategorisierte Buchungen.
- Neue Sektion "Auffällige Buchungen": Buchungen, die deutlich über dem
  Kategorie-Durchschnitt der letzten 12 Monate liegen, inklusive
  Warnsymbol in der Buchungsliste.
- Neue Sektion "Erkannte Abos & Daueraufträge": wiederkehrende Zahlungen
  (gleicher Empfänger + Betrag, monatlicher Abstand, mind. 3 Vorkommen)
  automatisch erkannt und mit Zeitraum/Vorkommen aufgelistet.
- Neue Sektion "Größte Ausgaben": Top-10-Einzelbuchungen im gewählten
  Zeitraum.
- Neuer Chart "Sparquote": Netto/Einnahmen je Monat, plus gleitender
  3-/6-Monats-Schnitt.
- Import-Historie jetzt auf der Import-Seite sichtbar; CSV-Imports mit
  Saldo-Spalte legen automatisch einen Soll/Ist-Checkpoint an bzw.
  aktualisieren ihn.
- Dublettenerkennung beim CSV-Import: mehrere identische Buchungen am
  selben Tag (z. B. zwei gleich hohe Bargeldabhebungen) werden nicht mehr
  fälschlich als Dubletten verworfen.
- Wertstellungs-Umschalter (Buchungsdatum/Wertstellung) gilt jetzt auch für
  Kontostandsverlauf und Kategorie-Übersicht.
- Diverse Konsistenz-Korrekturen: Erstattungen werden netto je Kategorie
  verrechnet (Donut/Verlauf stimmen wieder mit der Kategorien-Tabelle
  überein), Monatsdurchschnitte rechnen über die tatsächlich verfügbare
  Historie statt fix durch 12, "Regeln neu anwenden" räumt veraltete
  Zuordnungen auf, Importprofile lassen sich löschen, auch wenn bereits
  darüber importiert wurde, einheitliche Währungsformatierung und
  Lösch-Bestätigungen in der gesamten App.

## 0.1.21

- Neuer Menüpunkt "Darlehen": Darlehen anlegen, bearbeiten und löschen
  (Darlehenssumme, Zinssatz p.a., monatliche Rate, Startdatum, optionales
  Suchmuster zur Rate-Erkennung).
- Darlehen-Detailseite: Zuordnung einzelner Buchungen als Rate oder
  Sondertilgung, automatische Vorschläge passender unzugeordneter Buchungen
  anhand des Suchmusters bzw. der Ratenhöhe, sowie manuelle Verknüpfung per
  Suche.
- Jede zugeordnete Buchung wird automatisch in Zins- und Tilgungsanteil
  aufgeteilt; Kennzahlen zeigen gezahlte Zinsen, gezahlte Tilgung, gezahlte
  Sondertilgung, Restschuld und die aktuell berechnete Restlaufzeit.
- Neuer Chart "Darlehensverlauf" (Zins-/Tilgungsanteil je Buchung gestapelt
  plus Restschuld-Linie, gestrichelt für die Prognose) und neuer Chart
  "Ersparnis durch Sondertilgung" (Restschuld mit vs. ohne Sondertilgung als
  Liniendiagramm) inklusive Tabelle, die die Zins- und Laufzeitersparnis je
  einzelner Sondertilgung ausweist.
- Buchungen: neuer Button "Neue Buchung" zum manuellen Anlegen sowie
  Bearbeiten- und Löschen-Aktionen pro Zeile; verknüpfte Darlehensraten
  zeigen jetzt eine Spalte mit Link zum jeweiligen Darlehen.

## 0.1.19

- Salden: neue Spalte "Δ % Vormonatsende" in der Anker-Tabelle, zeigt die
  prozentuale Veränderung des erfassten Saldos gegenüber dem vorherigen
  Monatsende-Anker (nur für Monatsende-Zeilen, sonst "–").
- Salden und Kategorien: beide Tabellen scrollen jetzt horizontal statt auf
  schmalen Bildschirmen (Smartphone) zu zerquetschen.
- Kategorien: Spalte "Betrag insg." in der Übersichtstabelle durch "Betrag
  PYM" (Summe des Vorjahresmonats) ersetzt, direkt rechts neben "Betrag
  YTD".
- Kategorien: neuer Dropdown-Filter einmalig/wiederkehrend/beides für die
  Übersichtstabelle.
- Kategorien: Name wiederkehrender Kategorien wird in der Übersichtstabelle
  jetzt fett (font-weight 600) dargestellt.
- Kategorien: neue Spalte "24M Trend" in der Übersichtstabelle; liegen noch
  keine 24 Monate Buchungshistorie vor, wird stattdessen das Maximum der
  verfügbaren (auf eine gerade Anzahl abgerundeten) Monate verglichen.
- Übersicht: neuer Umschalter Buchungsdatum/Wertstellungsdatum für die
  Monatsgruppierung, wirkt auf beide Monatscharts, den Monatsvergleich und
  die gefilterte "Ausgaben nach Kategorie"-Donut.
- Buchungen: neues Textfeld filtert die Tabelle gleichzeitig nach
  Empfänger/Absender und Zweck.

## 0.1.18

- fixed bugs
