# OT&E Planer

Webbasiertes Werkzeug für die Planung von Operational Test & Evaluation (Einsatzprüfung).

**Live:** https://gun642.github.io/OTE-Tool/

## Ablauf

1. **Auftrag**: Auftrag der Einsatzprüfung hochladen (PDF, DOCX, TXT, MD) oder Text einfügen. Die KI fasst zusammen, formuliert das Aim und schlägt COI vor.
2. **COI-Katalog**: COI übernehmen, bearbeiten, löschen oder manuell anlegen. Darunter MOE/MOS und MOP/MOA automatisch erzeugen lassen, ebenfalls voll editierbar. Nummerierung (COI 1, MOE 1.1, MOA 1.1.1) läuft automatisch.
3. **Flugplanung**: Flüge anlegen oder ein Flugprogramm für alle offenen Testpunkte vorschlagen lassen. Je Flug Testkarten (Testziel, THA, FTT, Limits, Daten, Abbruchkriterien) generieren und drucken.
4. **Bewertung**: Ergebnisse je MOP/MOA gegen Objective und Threshold, Status erfüllt / eingeschränkt erfüllt / nicht erfüllt, Auswirkung nach Impact-Entscheidungsbaum, Antwort je COI.
5. **Export und Review**: Projekt sichern und laden, Testplan und Bewertungsbericht drucken, Traceability-Matrix als CSV, COI- und MOE/MOA-Review-Checklisten mit KI-Prüfung.

## KI-Modi (Einstellungen)

| Modus | Funktionsweise |
|---|---|
| Claude API direkt | Eigener Anthropic API-Schlüssel, Anfragen gehen direkt vom Browser an api.anthropic.com. |
| Manuell | Das Tool erzeugt den Prompt, man kopiert ihn in ein freigegebenes KI-Werkzeug und fügt die JSON-Antwort ein. |
| Aus | Vorschläge aus hinterlegten Vorlagen (Stichwortsuche), keine Datenübertragung. |

## Datenhaltung und Sicherheit

* Alle Projektdaten bleiben im Browser (localStorage). Nichts wird in dieses Repository geschrieben.
* Teamarbeit über Projektdateien (.json). Sicherungen des SharePoint-OT&E-Tools (`ote-datenstand.json`) können als neues Projekt geladen werden.
* Nur offen eingestufte Unterlagen verarbeiten. Eingestufte Inhalte gehören nicht in dieses Tool.

## Grundlagen

Terminologie und Methodik nach EFT OT&E Lehrgang (Terminology & Products, User Requirements, Requirement Tracking, Campaign Planning, Reporting), Review-Checklisten für COI und MOE/MOA, Bewertungsskalen nach EFT OT&E Guide V2.0 (SRS, Bedford, NASA-TLX, Cooper-Harper, Display Rating Scale, Simulation Fidelity Rating Scale).

## Technik

Statische Seite ohne Build-Schritt: `index.html`, `css/`, `js/`. pdf.js 3.11.174 und mammoth 1.6.0 liegen in `js/vendor/` (jeweilige Lizenzen beigelegt).
