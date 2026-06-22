# Changelog

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
