# Changelog

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
