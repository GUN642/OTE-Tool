/* Offline-Vorlagen: Fähigkeitsbereiche für Drehflügler-Einsatzprüfungen.
   Werte für Objective/Threshold sind bewusst Platzhalter und müssen aus FFF/PFK übernommen werden. */
(function () {
  'use strict';
  const OTE = (window.OTE = window.OTE || {});
  const FFF = 'lt. FFF/PFK';

  const mop = (text, einheit, richtung, extra) => Object.assign({ typ: 'MOP', text, skala: 'messwert', einheit, richtung: richtung || '>=',
    objective: FFF, threshold: FFF, methode: 'Flugversuch' }, extra || {});
  const moa = (text, skala, extra) => {
    const d = { srs: ['2', '3'], hqr: ['3', '4'], bedford: ['3', '5'], drs: ['3', '4'], sfr: ['2', '4'], janein: ['Ja', 'Ja'] }[skala || 'srs'];
    return Object.assign({ typ: 'MOA', text, skala: skala || 'srs', einheit: '', objective: d[0], threshold: d[1], methode: 'Flugversuch' }, extra || {});
  };

  OTE.CATALOG = [
    { key: 'innenlast', titel: 'Lufttransport Innenlast', kat: 'E',
      kw: ['innenlast', 'lufttransport', 'transport von (personal|material)', 'fracht', 'cargo', 'palette', 'truppentransport', 'personentransport', 'lufttransportleistung'],
      frage: 'Kann das System Personal und Material im geforderten Umfang unter Einsatzbedingungen im Innenraum transportieren?',
      m: [
        { typ: 'MOE', titel: 'Materialtransport Innenlast', text: 'Der Materialtransport im Innenraum erfüllt die Missionsanforderung.', c: [
          mop('Transportierbare Nutzlast im Innenraum im Missionsprofil (Radius, Umgebungsbedingungen)', 'kg', '>='),
          mop('Zeit für Be- und Entladen einer einsatztypischen Ladung', 'min', '<=', { methode: 'Bodenversuch' }),
          moa('Laderaum und Ladungssicherung sind für einsatztypische Ladung geeignet.', 'srs', { methode: 'Bodenversuch' })] },
        { typ: 'MOE', titel: 'Personentransport', text: 'Der Transport von Soldaten mit Ausrüstung erfüllt die Missionsanforderung.', c: [
          mop('Anzahl transportierbarer, voll ausgerüsteter Soldaten', 'Anzahl', '>=', { methode: 'Bodenversuch' }),
          moa('Auf- und Absitzen unter taktischen Bedingungen ist zügig und sicher möglich.', 'srs')] }
      ] },
    { key: 'aussenlast', titel: 'Außenlast', kat: 'E',
      kw: ['au(ß|ss)enlast', 'external load', 'lasthaken', 'cargo hook', 'sling ?load', 'unterh(ä|ae)ngend'],
      frage: 'Kann das System Außenlasten im geforderten Gewichts- und Geschwindigkeitsbereich sicher und einsatzgerecht transportieren?',
      m: [
        { typ: 'MOE', titel: 'Außenlasttransport', text: 'Der Außenlasttransport erfüllt die Missionsanforderung.', c: [
          mop('Maximale Außenlast im HOGE unter Einsatzbedingungen', 'kg', '>='),
          mop('Erreichbare Transportgeschwindigkeit mit typischer Außenlast ohne Lastinstabilität', 'kt', '>='),
          mop('Zeit vom Einschweben bis Abflug mit angeschlagener Last', 's', '<='),
          moa('Lastverhalten und Steuerbarkeit im Schwebeflug über der Last', 'hqr'),
          moa('Arbeitsbelastung der Besatzung inkl. Kommunikation mit dem Lastenmeister', 'bedford')] }
      ] },
    { key: 'nvg', titel: 'Nachtflug mit NVG', kat: 'E',
      kw: ['nvg', 'nachtsicht', 'bildverst(ä|ae)rker', 'nachtflug', '\\bnacht\\b', 'night', 'nvd', 'nvis'],
      frage: 'Kann das System Einsätze bei Nacht unter Nutzung von Nachtsichtbrillen durchführen?',
      m: [
        { typ: 'MOE', titel: 'Nachtflugfähigkeit', text: 'Einsätze bei Nacht mit NVG sind im geforderten Umfang durchführbar.', c: [
          moa('Cockpit- und Kabinenbeleuchtung ist NVG-kompatibel.', 'srs', { methode: 'Bodenversuch' }),
          moa('Arbeitsbelastung im NVG-Tiefflug bei geringer Restlichtstärke', 'bedford'),
          mop('Anteil erfolgreich durchgeführter NVG-Landungen auf unvorbereiteten Landeplätzen', '%', '>=')] }
      ] },
    { key: 'ifr', titel: 'Instrumentenflug und Allwetter', kat: 'E',
      kw: ['\\bifr\\b', 'instrumentenflug', 'allwetter', '\\bimc\\b', 'vereisung', 'icing', '\\bpbn\\b', '\\brnp\\b', 'gnss', 'instrumentenanflug'],
      frage: 'Kann das System Einsätze unter Instrumentenflugbedingungen und im geforderten Wetterspektrum durchführen?',
      m: [
        { typ: 'MOE', titel: 'Instrumentenflugfähigkeit', text: 'Der Einsatz unter IMC ist sicher und einsatzgerecht möglich.', c: [
          mop('Navigationsgenauigkeit im Instrumentenanflug (lateral/vertikal)', 'm', '<='),
          moa('Bedienung von Avionik und FMS im IFR-Betrieb', 'srs'),
          moa('Arbeitsbelastung bei IFR-Verfahren inkl. Notverfahren', 'bedford', { methode: 'Simulation/Rechnerisch' })] }
      ] },
    { key: 'dve', titel: 'Eingeschränkte Sicht (DVE)', kat: 'E',
      kw: ['brownout', 'whiteout', '\\bdve\\b', 'degraded visual', 'staub', 'schneelandung'],
      frage: 'Kann das System unter eingeschränkten Sichtbedingungen (DVE, Brownout, Whiteout) sicher starten und landen?',
      m: [
        { typ: 'MOE', titel: 'Landungen unter DVE', text: 'Landungen unter DVE gelingen sicher und reproduzierbar.', c: [
          mop('Anteil sicherer Landungen unter Brownout-Bedingungen', '%', '>='),
          mop('Driftgeschwindigkeit beim Aufsetzen', 'kt', '<='),
          moa('Situationsbewusstsein der Besatzung in der Landephase', 'srs'),
          moa('Handling in der Landephase unter DVE', 'hqr')] }
      ] },
    { key: 'gebirge', titel: 'Gebirge und Hot and High', kat: 'E',
      kw: ['gebirge', 'hot and high', 'hoch und hei(ß|ss)', 'mountain', 'dichteh(ö|oe)he', 'density altitude', 'hochgebirge'],
      frage: 'Erfüllt das System die Leistungsanforderungen im Gebirge und unter Hot-and-High-Bedingungen?',
      m: [
        { typ: 'MOE', titel: 'Leistungsfähigkeit im Gebirge', text: 'Einsätze im Gebirge sind mit der geforderten Nutzlast durchführbar.', c: [
          mop('HOGE-Fähigkeit bei Einsatzmasse und geforderter Dichtehöhe', 'ft DA', '>='),
          mop('Nutzlast im Missionsprofil Gebirge', 'kg', '>='),
          moa('Eignung für Gebirgslandungen (Hang, Kante, enge Landeplätze)', 'srs')] }
      ] },
    { key: 'ase', titel: 'Selbstschutz (ASE)', kat: 'E',
      kw: ['selbstschutz', '\\base\\b', 'dircm', 'circm', 'cmws', '\\brwr\\b', '\\blwr\\b', 'flare', 't(ä|ae)uschk(ö|oe)rper', 'missile warning', 'apr-39', 'aircraft survivability'],
      frage: 'Erhöht die Selbstschutzausstattung die Überlebensfähigkeit des Systems in der Bedrohungsumgebung?',
      m: [
        { typ: 'MOE', titel: 'Bedrohungserkennung und Warnung', text: 'Bedrohungen werden rechtzeitig erkannt und der Besatzung verständlich angezeigt.', c: [
          mop('Warnzeit vor Bedrohung im Testszenario', 's', '>='),
          mop('Falschalarmrate', 'pro Fh', '<='),
          moa('Darstellung und Verständlichkeit der Warnungen', 'srs')] },
        { typ: 'MOE', titel: 'Gegenmaßnahmen', text: 'Gegenmaßnahmen sind wirksam in taktische Verfahren integrierbar.', c: [
          moa('Integration der Gegenmaßnahmen in Ausweichmanöver', 'srs'),
          moa('Arbeitsbelastung bei Bedrohungsreaktion', 'bedford')] }
      ] },
    { key: 'bewaffnung', titel: 'Bewaffnung', kat: 'E',
      kw: ['bewaffnung', 'maschinengewehr', '\\bmg ?\\d', 'm134', 'm3m', 'door ?gun', 'minigun', 'waffenstation', 'bordwaffe'],
      frage: 'Kann die Bewaffnung zum Eigenschutz und zur Unterstützung abgesessener Kräfte wirksam eingesetzt werden?',
      m: [
        { typ: 'MOE', titel: 'Wirksamkeit des Waffeneinsatzes', text: 'Der Waffeneinsatz erzielt die geforderte Wirkung im Ziel.', c: [
          mop('Trefferanteil im Zielgebiet bei definierter Entfernung', '%', '>='),
          mop('Zeit bis Feuerbereitschaft', 's', '<=', { methode: 'Bodenversuch' }),
          moa('Sicht- und Wirkungsbereich der Waffenstation', 'srs'),
          moa('Handhabung, Munitionszuführung und Hülsenmanagement', 'srs')] }
      ] },
    { key: 'komm', titel: 'Kommunikation und Datenlink', kat: 'E',
      kw: ['funk', 'kommunikation', 'satcom', 'datenlink', '\\btdl\\b', 'link ?16', '\\bvmf\\b', 'intercom', 'f(ü|ue)hrungsf(ä|ae)hig'],
      frage: 'Ermöglicht die Kommunikationsausstattung die geforderte Führungsfähigkeit und Interoperabilität im Einsatz?',
      m: [
        { typ: 'MOE', titel: 'Sprachkommunikation', text: 'Sprachverbindungen stehen im Einsatzraum zuverlässig zur Verfügung.', c: [
          mop('Funkreichweite mit verständlicher Verbindung im Tiefflug', 'NM', '>='),
          moa('Bedienbarkeit von Funk und Intercom unter hoher Arbeitsbelastung', 'srs')] },
        { typ: 'MOE', titel: 'Datenaustausch (TDL)', text: 'Das Lagebild über Datenlink unterstützt die Auftragserfüllung.', c: [
          mop('Aktualität des Lagebildes (Latenz)', 's', '<='),
          moa('Mehrwert des Lagebildes für die Besatzung', 'srs')] }
      ] },
    { key: 'winde', titel: 'Winde und Fastrope', kat: 'E',
      kw: ['winde', 'rettungswinde', 'hoist', 'fast ?rope', 'abseil', '\\bspie\\b', '\\bfrie\\b'],
      frage: 'Kann das System Personal mittels Winde und Fastrope sicher und zeitgerecht absetzen und aufnehmen?',
      m: [
        { typ: 'MOE', titel: 'Absetzen und Aufnehmen', text: 'Absetzen und Aufnehmen über Winde und Fastrope erfüllen die Missionsanforderung.', c: [
          mop('Zeit zum Absetzen einer Gruppe per Fastrope', 's', '<='),
          mop('Zeit für einen Windenzyklus (Aufnahme einer Person)', 's', '<='),
          moa('Schwebeflugpräzision über dem Absetzpunkt', 'hqr'),
          moa('Crew-Koordination und Kommunikation', 'srs')] }
      ] },
    { key: 'haar', titel: 'Luftbetankung (HAAR)', kat: 'E',
      kw: ['\\bhaar\\b', 'luftbetankung', 'air[- ]to[- ]air refuel', '\\baar\\b', 'tanker', 'betankung in der luft'],
      frage: 'Kann das System im Flug betankt werden und damit die geforderte Reichweite und Stehzeit erzielen?',
      m: [
        { typ: 'MOE', titel: 'Luftbetankung', text: 'Die Luftbetankung ist sicher und im geforderten Umfang durchführbar.', c: [
          mop('Erfolgsquote der Kontakte', '%', '>='),
          mop('Übernommene Kraftstoffmenge je Kontakt', 'kg', '>='),
          moa('Handling in der Tankerposition', 'hqr'),
          moa('Arbeitsbelastung während der Betankung', 'bedford')] }
      ] },
    { key: 'farp', titel: 'Vorgeschobene Betankung (FARP/FARE)', kat: 'E',
      kw: ['\\bfare\\b', '\\bfarp\\b', 'bodenbetankung', 'forward arming', 'hot refuel', 'rapid refuel', 'fare-kit'],
      frage: 'Kann das System an vorgeschobenen Plätzen betankt und munitioniert werden (FARP/FARE)?',
      m: [
        { typ: 'MOE', titel: 'Vorgeschobene Betankung', text: 'Die Betankung an vorgeschobenen Plätzen erfüllt die Missionsanforderung.', c: [
          mop('Zeit für Hot Refuel einer Standardmenge', 'min', '<=', { methode: 'Bodenversuch' }),
          mop('Aufbauzeit FARE-Kit', 'min', '<=', { methode: 'Bodenversuch' }),
          moa('Aufbau und Bedienung des FARE-Kits durch die Besatzung', 'srs', { methode: 'Bodenversuch' })] }
      ] },
    { key: 'medevac', titel: 'MedEvac und CSAR', kat: 'E',
      kw: ['medevac', 'verwundet', 'casevac', 'sanit(ä|ae)t', '\\bcsar\\b', 'personnel recovery', '\\bpr\\b', 'patient'],
      frage: 'Kann das System Verwundete und zu rettende Personen im geforderten Umfang aufnehmen, versorgen und transportieren?',
      m: [
        { typ: 'MOE', titel: 'Patiententransport', text: 'Der Patiententransport erfüllt die Missionsanforderung.', c: [
          mop('Anzahl liegend transportierbarer Patienten', 'Anzahl', '>=', { methode: 'Bodenversuch' }),
          mop('Rüstzeit für den Umbau auf MedEvac', 'min', '<=', { methode: 'Bodenversuch' }),
          moa('Arbeitsbedingungen für das Sanitätspersonal im Flug', 'srs')] },
        { typ: 'MOE', titel: 'CSAR-Missionsablauf', text: 'Der CSAR-Ablauf ist innerhalb der geforderten Zeit durchführbar.', c: [
          mop('Zeit vom Abruf bis zur Aufnahme der Person', 'min', '<=', { methode: 'Flugversuch' }),
          moa('Integration in PR-Verfahren und Kommunikation mit Isolated Personnel', 'srs')] }
      ] },
    { key: 'sof', titel: 'Spezialkräfte (SOF)', kat: 'E',
      kw: ['\\bsof\\b', 'spezialkr(ä|ae)fte', 'special operations', '\\bksk\\b', 'infil', 'exfil'],
      frage: 'Unterstützt das System Spezialkräfteoperationen (Infiltration, Exfiltration) im geforderten Verfahrensspektrum?',
      m: [
        { typ: 'MOE', titel: 'Infiltration und Exfiltration', text: 'Infil und Exfil sind schnell, verdeckt und sicher durchführbar.', c: [
          mop('Zeit am Boden beim Absetzen', 's', '<='),
          moa('Eignung der Kabine für Spezialkräfteausstattung', 'srs', { methode: 'Bodenversuch' }),
          moa('Durchführbarkeit taktischer Verfahren (Tiefflug, Formation)', 'srs')] }
      ] },
    { key: 'maritim', titel: 'Maritime Verfahren', kat: 'E',
      kw: ['maritim', '(ü|ue)ber see', 'auf see', 'seegebiet', 'schiff', '\\bdeck', 'offshore', 'ditching', '(ü|ue)berwasser', 'overwater'],
      frage: 'Kann das System über See und von Schiffsdecks aus eingesetzt werden?',
      m: [
        { typ: 'MOE', titel: 'Bordbetrieb', text: 'Start und Landung auf Schiffsdecks sind im geforderten Windbereich möglich.', c: [
          mop('Nutzbarer Windbereich (SHOL) für Decklandungen', 'kt', '>='),
          moa('Handling bei Decklandungen', 'hqr'),
          moa('Ausstattung für den Überwasserflug (Rettungsmittel, Ditching)', 'srs', { methode: 'Bodenversuch' })] }
      ] },
    { key: 'fallschirm', titel: 'Fallschirmsprung', kat: 'E',
      kw: ['fallschirm', 'paratroop', 'freifall', 'automatische[rn]? sprung', 'static line', 'springer'],
      frage: 'Kann das System Fallschirmspringer (automatisch und Freifall) sicher absetzen?',
      m: [
        { typ: 'MOE', titel: 'Fallschirmsprungbetrieb', text: 'Das Absetzen von Fallschirmspringern erfüllt die Missionsanforderung.', c: [
          mop('Absetzgenauigkeit zum geplanten Absetzpunkt', 'm', '<='),
          mop('Anzahl Springer je Anflug', 'Anzahl', '>='),
          moa('Absetzverfahren und Kabinenlayout', 'srs')] }
      ] },
    { key: 'taktik', titel: 'Taktische Flugverfahren', kat: 'E',
      kw: ['formation', 'taktik', 'tiefflug', 'nap of the earth', '\\bnoe\\b', 'verbandsflug', 'taktische'],
      frage: 'Kann das System taktische Flugverfahren (Tiefflug, Formationsflug) im Verband durchführen?',
      m: [
        { typ: 'MOE', titel: 'Taktische Flugführung', text: 'Taktische Flugverfahren sind sicher und einsatzgerecht durchführbar.', c: [
          moa('Handling im Tiefflug', 'hqr'),
          moa('Formationsflug: Sicht auf Führungsmaschine und Abstandshaltung', 'srs'),
          mop('Geschwindigkeit im Konturenflug bei Einsatzmasse', 'kt', '>=')] }
      ] },
    { key: 'navigation', titel: 'Missionsplanung und Navigation', kat: 'E',
      kw: ['missionsplanung', 'navigation', '\\bjmps\\b', 'mission planning', '\\bfms\\b', 'digitale karte', 'moving map'],
      frage: 'Ermöglicht das System eine einsatzgerechte Missionsplanung und präzise Navigation?',
      m: [
        { typ: 'MOE', titel: 'Missionsplanung und Datentransfer', text: 'Missionen können zeitgerecht geplant und ins Luftfahrzeug übertragen werden.', c: [
          mop('Zeit von Planungsbeginn bis Datenladen im Luftfahrzeug', 'min', '<=', { methode: 'Bodenversuch' }),
          mop('Navigationsgenauigkeit über Wegpunkte', 'm', '<='),
          moa('Bedienbarkeit von Planungs- und Navigationssystem', 'srs')] }
      ] },
    { key: 'verlegung', titel: 'Verlegefähigkeit', kat: 'S',
      kw: ['verleg', 'deploy', 'a400m', 'transportierbar', 'seetransport', 'strategisch', 'selbstverlegung', 'ferry'],
      frage: 'Kann das System im geforderten Zeitrahmen verlegt und am Einsatzort einsatzbereit gemacht werden?',
      m: [
        { typ: 'MOS', titel: 'Verlegefähigkeit', text: 'Das System ist im geforderten Zeitrahmen verlegbar und einsatzbereit herzustellen.', c: [
          mop('Zeit bis zur Einsatzbereitschaft nach Verlegung', 'h', '<=', { methode: 'Flugversuch' }),
          mop('Reichweite bei Selbstverlegung', 'NM', '>='),
          moa('Aufwand für Vorbereitung und Rüstung zur Verlegung', 'srs', { methode: 'Bodenversuch' })] }
      ] },
    { key: 'ausbildung', titel: 'Fliegerische Ausbildung und Human Factors', kat: 'S',
      kw: ['ausbildung', 'training', 'human factors', 'ergonomie', 'arbeitsbelastung', 'workload', 'simulator', 'mensch-maschine', '\\bhmi\\b'],
      frage: 'Ermöglichen Ausbildung und Mensch-Maschine-Schnittstelle einen sicheren und einsatzgerechten Betrieb durch typisches Personal?',
      m: [
        { typ: 'MOS', titel: 'Fliegerische Ausbildung', text: 'Die Ausbildung bereitet die Besatzungen auf die Einsatzaufgaben vor.', c: [
          moa('Ausbildungsunterlagen und Simulator bereiten auf die Einsatzaufgaben vor.', 'srs', { methode: 'SME-Bewertung' })] },
        { typ: 'MOS', titel: 'Human Factors', text: 'Die Mensch-Maschine-Schnittstelle unterstützt die Besatzung im Einsatz.', c: [
          moa('Cockpit-Ergonomie und Bedienlogik', 'srs'),
          moa('Arbeitsbelastung über die Gesamtmission', 'bedford')] }
      ] },
    { key: 'sicherheit', titel: 'Dokumentation und einsatzbezogene Sicherheit', kat: 'S',
      kw: ['sicherheit', 'safety', 'dokumentation', 'flughandbuch', 'checkliste', 'notverfahren', 'crashworth'],
      frage: 'Ermöglichen Flugbetriebsdokumentation und Sicherheitsausstattung einen sicheren Einsatzflugbetrieb?',
      m: [
        { typ: 'MOS', titel: 'Fliegerische Dokumentation', text: 'Die fliegerische Dokumentation ist ausreichend, um sicheren und operationellen Flugbetrieb durchzuführen.', c: [
          moa('Die Dokumentation ist in ausreichender Anzahl und für alle Betreffenden gut zugänglich.', 'srs', { methode: 'Dokumentenprüfung' }),
          moa('Die Dokumentation ist verständlich, vollständig und korrekt.', 'srs', { methode: 'Dokumentenprüfung' }),
          moa('Die Dokumentation ist vom Aufbau logisch und einzelne Punkte können schnell nachgeschlagen werden.', 'srs', { methode: 'Dokumentenprüfung' })] },
        { typ: 'MOS', titel: 'Einsatzbezogene Sicherheit', text: 'Die Sicherheitsausstattung entspricht den Einsatzanforderungen.', c: [
          moa('Notausstiege, Notausrüstung und Crashworthiness', 'srs', { methode: 'Bodenversuch' })] }
      ] },
    { key: 'verfuegbarkeit', titel: 'Verfügbarkeit und Zuverlässigkeit', kat: 'S',
      kw: ['verf(ü|ue)gbarkeit', 'klarstand', 'einsatzbereitschaft', 'zuverl(ä|ae)ssigkeit', 'availability', 'reliability', '\\bmtbf\\b'],
      frage: 'Erreicht das System im Einsatzflugbetrieb die geforderte Verfügbarkeit und Zuverlässigkeit?',
      m: [
        { typ: 'MOS', titel: 'Missionszuverlässigkeit', text: 'Missionen werden ohne systembedingte Abbrüche durchgeführt.', c: [
          mop('Mission Completion Rate', '%', '>=', { methode: 'Simulation/Rechnerisch' }),
          mop('Missionsrelevante Ausfälle je 100 Flugstunden', 'Anzahl', '<=', { methode: 'Simulation/Rechnerisch' })] }
      ] }
  ];

  /* ---------- Offline-Generatoren ---------- */
  function sentences(text) {
    return text.replace(/\s+/g, ' ').split(/(?<=[.!?;])\s+/).filter(s => s.length > 15 && s.length < 400);
  }

  OTE.offline = {
    analyze(text) {
      const sents = sentences(text);
      const lower = text.toLowerCase();
      const hits = OTE.CATALOG.map(e => {
        let n = 0, quote = '';
        e.kw.forEach(k => {
          const re = new RegExp(k, 'gi');
          const m = lower.match(re);
          if (m) {
            n += m.length;
            if (!quote) { const s = sents.find(x => new RegExp(k, 'i').test(x)); if (s) quote = s.trim(); }
          }
        });
        return { e, n, quote };
      }).filter(h => h.n > 0).sort((a, b) => b.n - a.n);
      const list = hits.length ? hits : OTE.CATALOG.filter(e => ['innenlast', 'ausbildung', 'sicherheit'].includes(e.key)).map(e => ({ e, n: 0, quote: '' }));
      const aimSent = sents.find(s => /(auftrag|ziel|zweck|aim|soll|beauftragt)/i.test(s)) || '';
      return {
        quelle: 'offline',
        zusammenfassung: hits.length
          ? 'Offline-Analyse per Stichwortsuche. ' + hits.length + ' Fähigkeitsbereiche im Dokument erkannt. Für eine inhaltliche Analyse den KI-Modus nutzen.'
          : 'Offline-Analyse: keine bekannten Fähigkeitsbereiche erkannt. Es werden Basis-COI vorgeschlagen.',
        aim: aimSent,
        missionen: [],
        hinweise: [],
        cois: list.map(h => ({
          kurz: h.e.titel, frage: h.e.frage, kategorie: h.e.kat, prioritaet: h.n > 4 ? 'hoch' : (h.n > 1 ? 'mittel' : 'niedrig'),
          begruendung: h.n ? h.n + ' Fundstellen zu Stichworten dieses Fähigkeitsbereichs.' : 'Basisvorschlag.',
          quelle: h.quote, template: h.e.key
        }))
      };
    },

    matchTemplate(coi) {
      if (coi.template) { const t = OTE.CATALOG.find(e => e.key === coi.template); if (t) return t; }
      const txt = ((coi.kurz || '') + ' ' + (coi.frage || '')).toLowerCase();
      let best = null, bn = 0;
      OTE.CATALOG.forEach(e => {
        let n = 0;
        e.kw.forEach(k => { if (new RegExp(k, 'i').test(txt)) n++; });
        if (n > bn) { bn = n; best = e; }
      });
      return best;
    },

    measures(coi) {
      const t = OTE.offline.matchTemplate(coi);
      if (!t) {
        const typ = coi.kategorie === 'S' ? 'MOS' : 'MOE';
        return [{ typ, titel: coi.kurz || 'Auftragserfüllung', text: 'Die Einsatzaufgabe „' + (coi.kurz || coi.frage) + '“ wird unter Einsatzbedingungen erfüllt.', c: [
          mop('Erfolgsquote der Einsatzaufgabe im Testszenario', '%', '>='),
          moa('Eignung des Systems für die Einsatzaufgabe aus Sicht der Besatzung', 'srs'),
          moa('Arbeitsbelastung der Besatzung bei der Einsatzaufgabe', 'bedford')] }];
      }
      return JSON.parse(JSON.stringify(t.m));
    },

    program(entries) {
      // bündelt offene Testpunkte je Verfahren in Blöcke zu max. 6, Reihenfolge nach Katalog
      const flights = [];
      OTE.PLANNABLE.forEach(meth => {
        const list = entries.filter(e => e.obj.methode === meth);
        for (let i = 0; i < list.length; i += 6) {
          const part = list.slice(i, i + 6);
          const cois = [...new Set(part.map(e => e.coi.kurz || 'COI'))];
          flights.push({
            titel: (meth === 'Flugversuch' ? 'Testflug' : meth) + ' ' + (flights.filter(f => f._m === meth).length + 1) + ': ' + cois.join(', '),
            _m: meth,
            profil: meth === 'Flugversuch' ? 'Testflug mit ' + part.length + ' Testpunkten' : meth + ' mit ' + part.length + ' Testpunkten',
            dauer_min: meth === 'Flugversuch' ? 60 + part.length * 10 : '',
            bedingungen: [...new Set(part.map(e => e.obj.bedingungen).filter(Boolean))].join('; '),
            konfiguration: '',
            testpunkte: part.map(e => e.obj.id),
            begruendung: 'Gebündelt nach Verfahren und Katalogreihenfolge (Vorlage).'
          });
        }
      });
      return { fluege: flights };
    },

    cards(flight, entries) {
      return {
        karten: entries.map(e => {
          const k = e.obj, s = OTE.scale(k.skala);
          const bew = k.typ === 'MOA'
            ? 'Bewertung nach ' + s.name + '. Objective ' + (k.objective || '?') + ', Threshold ' + (k.threshold || '?') + '. Begründung der Bewertung notieren.'
            : 'Messwert in ' + (k.einheit || 'Einheit') + ' erfassen (' + (k.richtung === '<=' ? '≤' : '≥') + '). Objective ' + (k.objective || '?') + ', Threshold ' + (k.threshold || '?') + '.';
          return {
            ref: k.id,
            titel: e.label + ' ' + (e.measure.titel || ''),
            testziel: k.text,
            tha: '[THA ergänzen: Gefährdungen, Mitigation, Notverfahren]',
            voraussetzungen: 'Briefing durchgeführt. Testkonfiguration hergestellt. ' + (k.methode === 'Flugversuch' ? 'Wetter innerhalb der Testgrenzen.' : ''),
            ftt: '1. Ausgangsbedingungen herstellen.\n2. Einsatzaufgabe gemäß Testziel durchführen.\n3. Daten und Beobachtungen erfassen.\n4. Bewertung durch die Besatzung unmittelbar nach dem Testpunkt.',
            konfiguration: flight.beladung || '',
            flugbedingungen: k.bedingungen || flight.bedingungen || '',
            limits: 'Flughandbuch-Grenzen',
            daten: bew + (k.daten ? '\n' + k.daten : ''),
            abbruch: 'Überschreiten von Grenzwerten, Verlust des Situationsbewusstseins, technische Störung.'
          };
        })
      };
    }
  };
})();
