# Nutzerhandbuch

## Was die Plattform tut — und was nicht

WORKFORCE OS stellt spezialisierte KI-Agenten bereit, die wiederkehrende
Büroarbeit vorbereiten: sichten, einordnen, herausziehen, verdichten, entwerfen,
berichten. Was Außenwirkung hat — eine E-Mail an Kundschaft, eine Zahlung, eine
Personalentscheidung — bereitet ein Agent vor, entscheidet aber nie selbst.

Ausdrücklich nicht: autonome Unternehmensführung, Rechts-, Steuer- oder
medizinische Beratung, Ersatz für Fachpersonal.

## Einrichtung in 14 Schritten

Der Assistent führt durch die Einrichtung. Die Reihenfolge ist bewusst gewählt:
erst verstehen, dann empfehlen, dann Voraussetzungen schaffen, dann testen — und
erst danach aktivieren.

| # | Schritt | Was passiert |
| --- | --- | --- |
| 1 | Willkommen | Leistung und Grenzen vorab |
| 2 | Unternehmensprofil | Branche und Größe |
| 3 | Zeitfresser | wo heute Zeit verloren geht |
| 4 | Departments | welche Bereiche relevant sind |
| 5 | Empfehlung | serverseitig berechneter Vorschlag |
| 6 | Plan | Tarif und Zahlungszyklus |
| 7 | Datenquellen | Connectoren verbinden |
| 8 | Wissen | Dokumente hochladen |
| 9 | Team | Personen einladen, Rollen vergeben |
| 10 | Automatisierung | Stufen je Fähigkeit |
| 11 | Freigaben | wer entscheidet was |
| 12 | Benachrichtigungen | Kanäle und Zusammenfassung |
| 13 | Sandbox-Testlauf | Testlauf ohne Außenwirkung |
| 14 | Aktivierung | Übernahme in den Produktivbetrieb |

Die Schritte 7, 8, 9 und 12 sind überspringbar und später nachholbar.
**Schritt 13 nicht:** ohne bestandenen Sandbox-Testlauf lässt sich ein Agent
nicht aktivieren. Das ist keine Formalie — der Testlauf zeigt an echten
Beispieldaten, was der Agent produziert, bevor er es auf reale Daten anwendet.

## Automatisierungsstufen

Die zentrale Einstellung. Sie gilt **je Fähigkeit**, nicht je Agent — derselbe
Agent darf einordnen (Stufe 4) und trotzdem nur entwerfen (Stufe 2).

| Stufe | Name | Bedeutung |
| --- | --- | --- |
| 0 | Ausgeschaltet | Die Fähigkeit läuft nicht. |
| 1 | Beobachten | Analysiert und meldet, führt nichts aus. |
| 2 | Entwurf | Erstellt Vorschläge oder Entwürfe. |
| 3 | Freigabe erforderlich | Bereitet die Aktion vollständig vor, führt sie erst nach Freigabe aus. |
| 4 | Autonom innerhalb von Regeln | Führt klar definierte risikoarme Aktionen selbst aus. |
| 5 | Erweiterte Autonomie | Nur für ausdrücklich erlaubte, getestete und reversible Aktionen. |

Zwei Grenzen greifen unabhängig von der Einstellung:

- Jede Fähigkeit hat im Katalog eine Höchststufe. Eine höhere Einstellung wird
  auf diese gedeckelt — sie erzeugt keinen Fehler, sie wirkt nur nicht.
- Fähigkeiten mit Risiko `hoch` (11 von 126) sind fest auf Stufe 3 begrenzt.
  Was rechtlich, finanziell, personell oder für den Ruf zählt, wird vorbereitet
  und nicht ausgeführt — auch nicht auf Stufe 5.

Empfehlung: mit 2 oder 3 beginnen. Nach zwei Wochen zeigt die Freigabe-Historie,
wie oft unverändert zugestimmt wurde — das ist die belastbare Grundlage für eine
Erhöhung.

## Freigaben

Eine Freigabeanfrage zeigt die vollständige, fertige Aktion — nicht eine
Absichtserklärung. Vier Wege:

- **Freigeben** — genau die gezeigte Aktion wird ausgeführt.
- **Bearbeiten und freigeben** — die bearbeitete Fassung wird ausgeführt.
- **Ablehnen** — mit optionaler Begründung; der Agent lernt daraus nichts
  automatisch, aber die Begründung steht im Protokoll.
- **Später** — die Anfrage bleibt offen, bis sie verfällt.

Es läuft dabei **kein zweiter Agentenlauf**. Was Sie gesehen und bestätigt
haben, wird identisch ausgeführt.

**Sammelfreigabe** gibt es nur für risikoarme Aktionen desselben Typs, höchstens
25 auf einmal. Wer zehn E-Mails gleichzeitig freigeben will, hat sie nicht
gelesen — deshalb ist das für Aktionen mit Außenwirkung gesperrt. Die Prüfung
erfolgt serverseitig, nicht nur durch Ausblenden in der Oberfläche.

## Rollen

| Rolle | Darf |
| --- | --- |
| `owner` | alles, inkl. Abrechnung, Eigentumsübertragung, Löschung der Organisation |
| `admin` | wie Owner, ohne Abrechnungsverwaltung und ohne Eigentumsübertragung |
| `manager` | Departments überwachen, Freigaben entscheiden, zugewiesene Agenten konfigurieren |
| `member` | Agenten nutzen, Freigaben erteilen soweit berechtigt |
| `viewer` | ausschließlich lesen |
| `billingAdmin` | Abrechnung und Pläne — **kein** Zugriff auf operative Daten |

Die letzte Person mit `owner` kann ihre Rolle nicht abgeben und nicht entfernt
werden. Eine Organisation ohne Vollzugriff wäre nicht mehr verwaltbar.

Rollen werden serverseitig geprüft. Was die Oberfläche ausblendet, ist zusätzlich
ausgeblendet — nicht stattdessen.

## Wissen

Unterstützt: PDF, DOCX, TXT, Markdown. Nach dem Upload: Textextraktion →
Zerlegung in Abschnitte → Einbettung. Die Suche kombiniert Vektorähnlichkeit mit
deutscher Volltextsuche.

Zwei Zugriffsmodelle je Dokument: **Organisation** (alle mit Leserecht) oder
**Eingeschränkt** (nur gewählte Rollen). Die Prüfung findet in der Suchabfrage
statt: ein Agent, der ein Dokument nicht sehen darf, erhält es nicht als Treffer
— er sieht auch nicht, dass es existiert.

Antworten aus dem Wissenssystem nennen ihre Quellen. Findet ein Agent keinen
Beleg, sagt er das, statt zu formulieren, was plausibel klingt.

**Von Agenten geschriebenes Wissen** ist gekennzeichnet — in der Übersicht und
im Text des Eintrags selbst („Von einem digitalen Mitarbeiter erzeugt. Inhalt
nicht menschlich geprüft."). Das ist wichtig: ein Agent, der eine Antwort
belegt, kann sonst einen von einem anderen Agenten geschriebenen Text wie einen
hochgeladenen Vertrag zitieren. Erzeugte Dokumente tragen zusätzlich „[Entwurf]"
im Titel. Zu jedem solchen Eintrag ist nachvollziehbar, welcher Agent ihn in
welchem Lauf angelegt hat.

## Fachdaten: Kontakte, Tickets, Personal

Damit die Agenten auf echten Daten arbeiten, führt die Plattform eigene, schlanke
Bestände. Sie ersetzen kein gewachsenes CRM, Helpdesk oder HR-System — sie sind
das, worauf die Agenten zugreifen, solange kein Fremdsystem angebunden ist.

Daten kommen über **CSV-Import** (*Integrations → Datenaustausch*), den
**Webhook** oder die **Demo-Daten** hinein und über CSV-Export hinaus. Eine
eigene Verwaltungsansicht zum Pflegen einzelner Datensätze gibt es noch nicht.

Drei Regeln, die durchgehend gelten:

- **Ein Sperrvermerk ist endgültig.** Ein Agent kann „keine Ansprache" setzen,
  aber niemals aufheben. Gesperrte Kontakte erscheinen für Agenten gar nicht in
  den Ergebnissen — sie können sie also auch nicht versehentlich anschreiben.
- **Kein Agent legt Stammdaten an.** Eine Person, ein Vorgang oder ein
  Beschäftigungsverhältnis entsteht durch eine Entscheidung, nicht durch einen
  Agentenlauf. Fehlt ein Datensatz, sagt der Agent das.
- **Kein Agent entscheidet einen Personalvorgang.** Ein Urlaubsantrag wird
  formal geprüft und bleibt auf „beantragt". Genehmigen kann nur ein Mensch.

Bei Personaldaten speichert die Plattform bewusst weniger als möglich: **kein
Gehalt, keine Bankverbindung, kein Geburtsdatum, keine Gesundheitsdaten.** Ein
Krankheitsgrund, der in einem Antrag steht, wird an keinen Agentenlauf
weitergegeben.

## Aktivität und Protokoll

Jeder Lauf ist einzeln nachvollziehbar: Auslöser, Ziel, jeder Schritt mit
Phase und Werkzeugaufruf, verbrauchte Tokens, Kosten, Ergebnis. Fehlgeschlagene
Läufe stehen mit ihrem Fehler dort — sie werden nicht verborgen.

Das Protokoll ist unveränderlich. Auch die Anwendung selbst kann Einträge nicht
nachträglich ändern oder löschen.

Greift der Betreiber zur Unterstützung auf Ihre Organisation zu, erscheint das
mit Begründung in **Ihrem** Protokoll.

## Auswertungen

Berichte entstehen ausschließlich aus echten Laufdaten. Sandbox-Läufe zählen
nicht mit.

Eine Kennzahl ohne Datengrundlage bleibt leer und nennt den Grund — sie wird
nicht geschätzt. Die einzige Ausnahme ist die eingesparte Zeit: sie beruht auf
einem festen Minutenwert je Lauf und ist überall als Schätzung gekennzeichnet.

## Wenn etwas nicht funktioniert

| Meldung | Bedeutung |
| --- | --- |
| „Tool … ist noch nicht verfügbar" | Der Connector ist nicht verbunden oder nicht implementiert. Der Agent arbeitet mit dem weiter, was er hat, und benennt die Lücke. |
| „Kontingent erschöpft" | Das monatliche Laufkontingent oder KI-Kostenkontingent ist erreicht. Läufe werden abgelehnt, statt still weiterzulaufen. Tarif ändern oder auf den Monatswechsel warten. |
| Lauf mit Status `failed` | Der Fehler steht im Protokoll. Erneut starten oder den Agenten pausieren. |
| Wissenssuche findet nichts | Dokument noch in Verarbeitung, Zugriff eingeschränkt, oder es steht nichts Passendes darin. |
| „Simulierte Abrechnung" | Es ist kein Zahlungsdienstleister verbunden. Keine echte Zahlung findet statt. |

## Was Sie jederzeit können

- Einen laufenden Agentenlauf abbrechen.
- Einen Agenten pausieren — er verliert dabei keine Konfiguration.
- Eine Fähigkeit einzeln abschalten, ohne den Agenten zu deaktivieren.
- Eine Automatisierungsstufe senken; sie gilt ab dem nächsten Lauf.
- Ein Werkzeug oder eine Datenquelle entziehen.
- Eine offene Freigabe ablehnen oder verfallen lassen.
- Demo-Daten restlos entfernen.
