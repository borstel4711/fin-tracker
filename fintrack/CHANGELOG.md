# Changelog

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
