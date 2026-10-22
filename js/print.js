/* OT&E Planer: Druckausgaben (Testkarten, Testplan, Bewertungsbericht) */
(function () {
  'use strict';
  const OTE = (window.OTE = window.OTE || {});
  const { esc, nl2br } = OTE.ui;

  function doPrint(html, cls) {
    const root = document.getElementById('print-root');
    root.innerHTML = html;
    document.body.classList.add('printing', cls);
    const done = () => {
      document.body.classList.remove('printing', cls);
      root.innerHTML = '';
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 60);
  }

  const d = v => v ? new Date(v).toLocaleDateString('de-DE') : '';
  const cell = (label, val, cls) => '<td class="' + (cls || '') + '"><span class="pl">' + esc(label) + '</span><span class="pv">' + nl2br(val || '') + '</span></td>';

  function cover(p, f, idx) {
    const list = f.karten.map((k, i) => { const r = idx.byId[k.ref]; return '<tr><td>' + (i + 1) + '</td><td>' + esc(r ? r.label : '') + '</td><td>' + esc(k.titel || k.testziel) + '</td></tr>'; }).join('');
    return '<section class="pc-page">' +
      '<div class="pc-card"><table class="pc">' +
      '<tr><td class="pc-brand"><b>' + esc(p.name) + '</b><span>' + esc(p.kampagne || 'OT&E') + '</span></td><td class="pc-title">FLIGHT / TEST CARD</td>' + cell('Datum', d(f.datum)) + '</tr>' +
      '<tr>' + cell('Testprogramm', p.name) + cell('Muster / Type', f.muster || p.system) + '<td></td></tr>' +
      '<tr>' + cell('Flug-Nr.', f.nr) + cell('Kennung / Serial No.', f.kennung) + '<td></td></tr>' +
      '<tr>' + cell('Besatzung', f.crew) + cell('Beobachter', f.beobachter) + cell('Callsign', f.callsign) + '</tr>' +
      '<tr><td colspan="3" class="pc-obj"><span class="pl big">Testziel</span><span class="pv">' + nl2br(f.flugziel || f.titel || '') + '</span></td></tr>' +
      '<tr>' + cell('Software', f.software) + cell('Hardware', f.hardware) + cell('Masse', f.masse) + '</tr>' +
      '<tr>' + cell('Sensoren', f.sensoren) + cell('Beladung und Schwerpunkt', f.beladung) + '<td></td></tr>' +
      '<tr><td colspan="3" class="pc-sec">Bedingungen am Testtag</td></tr>' +
      '<tr>' + cell('QNH', f.qnh) + cell('OAT', f.oat) + '<td></td></tr>' +
      '<tr>' + cell('Wind', f.wind) + cell('Testgebiet / Range', f.testgebiet) + '<td></td></tr>' +
      '<tr><td colspan="3" class="pc-sec">Zusammenfassung</td></tr>' +
      '<tr>' + cell('Test Start', f.start) + cell('Test Ende', f.ende) + '<td></td></tr>' +
      '<tr><td colspan="2" rowspan="2" class="pc-rem"><span class="pl">Bemerkungen</span><span class="pv">' + nl2br(f.bemerkung) + '</span></td>' + cell('Testzeit', '') + '</tr>' +
      '<tr><td class="pc-succ"><span class="pl">Erfolg</span><span class="box"></span> JA<br><span class="box"></span> NEIN<br><span class="box"></span> TEILWEISE ____ %</td></tr>' +
      '</table></div>' +
      '<div class="pc-side"><h3>Testpunkte dieses Fluges</h3><table class="pc-list"><thead><tr><th>Karte</th><th>Testpunkt</th><th>Titel</th></tr></thead><tbody>' + list + '</tbody></table>' +
      (f.profil ? '<h3>Flugprofil</h3><p>' + nl2br(f.profil) + '</p>' : '') + (f.bedingungen ? '<h3>Bedingungen</h3><p>' + nl2br(f.bedingungen) + '</p>' : '') +
      (f.hinweise ? '<h3>Hinweise</h3><p>' + nl2br(f.hinweise) + '</p>' : '') + '</div></section>';
  }

  function card(p, f, k, i, idx) {
    const r = idx.byId[k.ref];
    const crit = r && r.obj;
    let rating = '';
    if (crit) {
      const s = OTE.scale(crit.skala);
      if (s.levels && s.levels.length && s.levels.length <= 10) {
        rating = '<div class="pc-rating"><b>' + esc(s.name) + '</b> Obj ' + esc(crit.objective) + ' / Thr ' + esc(crit.threshold) +
          '<ul>' + s.levels.map(l => '<li><span class="box"></span><b>' + esc(l.v) + '</b> ' + esc(l.label) + '</li>').join('') + '</ul></div>';
      } else {
        rating = '<div class="pc-rating"><b>' + esc(crit.typ === 'MOP' ? 'Messwert' : s.name) + '</b> ' + esc(crit.einheit || '') + ' ' +
          (s.kind === 'numeric' ? (crit.richtung === '<=' ? '≤' : '≥') : '') + ' Obj ' + esc(crit.objective) + ' / Thr ' + esc(crit.threshold) +
          '<div class="pc-val">Ergebnis: ____________________</div></div>';
      }
    }
    const sec = (t, v) => v ? '<div class="pc-s"><b>' + esc(t) + '</b><div>' + nl2br(v) + '</div></div>' : '';
    return '<section class="pc-page">' +
      '<div class="pc-card"><table class="pc">' +
      '<tr><td class="pc-brand"><b>' + esc(p.name) + '</b><span>Flug ' + esc(f.nr) + (f.callsign ? ', ' + esc(f.callsign) : '') + '</span></td><td></td><td class="pc-no"><span class="pl">Karte</span><span class="num">' + (i + 1) + '</span></td></tr>' +
      '<tr><td class="pc-tp"><span class="pl">Testpunkt</span><b>' + esc(r ? r.label : '') + '</b></td><td colspan="2" class="pc-tp"><span class="pl">Testziel</span><b>' + nl2br(k.testziel || k.titel) + '</b></td></tr>' +
      '<tr><td colspan="2" class="pc-tha"><span class="pl">THA / Mitigation und Notverfahren</span>' + nl2br(k.tha) + '</td><td class="pc-limh">LIMIT</td></tr>' +
      '<tr><td colspan="2" class="pc-body">' + sec('Voraussetzungen', k.voraussetzungen) + sec('Flight Test Technique', k.ftt) + sec('Konfiguration', k.konfiguration) +
      sec('Flugbedingungen', k.flugbedingungen) + sec('Daten und Bewertung', k.daten) + sec('Abbruchkriterien', k.abbruch) + '</td>' +
      '<td class="pc-lim">' + nl2br(k.limits) + '</td></tr></table></div>' +
      '<div class="pc-side"><h3>Bemerkungen / Daten</h3>' + rating + '<div class="pc-lines"></div></div></section>';
  }

  OTE.printCards = function (p, flights) {
    const idx = OTE.index(p);
    const html = flights.filter(f => f.karten.length).map(f => cover(p, f, idx) + f.karten.map((k, i) => card(p, f, k, i, idx)).join('')).join('');
    if (!html) { OTE.ui.toast('Keine Testkarten vorhanden.', 'error'); return; }
    doPrint(html, 'print-cards');
  };

  function head(p, title) {
    return '<header class="pp-head"><div class="pp-kicker">' + esc(p.system || '') + (p.kampagne ? ', ' + esc(p.kampagne) : '') + '</div><h1>' + esc(title) + '</h1><h2>' + esc(p.name) + '</h2>' +
      (p.aim ? '<p><b>Aim:</b> ' + esc(p.aim) + '</p>' : '') + '<p class="pp-date">Stand ' + new Date().toLocaleDateString('de-DE') + '</p></header>';
  }

  OTE.printPlan = function (p, withResults) {
    const idx = OTE.index(p);
    let html = head(p, withResults ? 'Bewertungsbericht Einsatzprüfung' : 'Testplan Einsatzprüfung');
    html += '<section class="pp-overview"><h2>Übersicht</h2><table class="pp"><thead><tr><th>Nr.</th><th>Kat.</th><th>Critical Operational Issue</th>' + (withResults ? '<th>Antwort</th>' : '<th>Measures</th>') + '</tr></thead><tbody>' +
      p.cois.map(c => '<tr><td>' + esc(idx.byId[c.id].label) + '</td><td>' + c.kategorie + '</td><td>' + esc(c.frage) + '</td><td>' +
        (withResults ? esc({ offen: 'offen', ja: 'Ja', teilweise: 'Ja, mit Einschränkungen', nein: 'Nein' }[c.antwort]) : c.measures.map(m => esc(idx.byId[m.id].label)).join(', ')) + '</td></tr>').join('') +
      '</tbody></table></section>';
    p.cois.forEach(c => {
      html += '<section class="pp-coi"><h2>' + esc(idx.byId[c.id].label + (c.kurz ? ': ' + c.kurz : '')) + '</h2><p class="pp-q">' + esc(c.frage) + '</p>' +
        '<p class="pp-meta">' + (c.kategorie === 'S' ? 'Suitability' : 'Effectiveness') + ', Priorität ' + esc(c.prioritaet) + (c.quelle ? '. Fundstelle: ' + esc(c.quelle) : '') + '</p>';
      c.measures.forEach(m => {
        const me = idx.byId[m.id];
        html += '<h3>' + esc(me.label + (m.titel ? ' ' + m.titel : '')) + '</h3><table class="pp ms"><thead><tr><th class="w-nr">' + esc(me.label) + '</th><th>' + esc(m.text || m.titel) + '</th><th>Skala</th><th>Obj</th><th>Thr</th>' +
          (withResults ? '<th>Ergebnis</th><th>Status</th><th>Auswirkung</th>' : '<th>Methode</th><th>Result</th>') + '</tr></thead><tbody>' +
          m.criteria.map(k => {
            const s = OTE.scale(k.skala), imp = OTE.IMPACT.find(i => i.id === k.impact);
            return '<tr><td class="w-nr"><b>' + esc(idx.byId[k.id].label) + '</b></td><td>' + esc(k.text) + (k.bedingungen && !withResults ? '<div class="pp-sub">' + esc(k.bedingungen) + '</div>' : '') +
              (withResults && k.bemerkung ? '<div class="pp-sub">' + esc(k.bemerkung) + '</div>' : '') + '</td>' +
              '<td>' + esc(s.kind === 'numeric' ? (k.einheit || '') + ' ' + (k.richtung === '<=' ? '≤' : '≥') : s.kurz) + '</td><td>' + esc(k.objective) + '</td><td>' + esc(k.threshold) + '</td>' +
              (withResults ? '<td>' + esc(k.ergebnis) + '</td><td>' + esc(OTE.STATUS_TEXT[OTE.evalCriterion(k)]) + '</td><td>' + esc(imp ? imp.label + (imp.rec !== 'n/a' ? ', ' + imp.rec : '') : '') + '</td>'
                : '<td>' + esc(k.methode) + '</td><td></td>') + '</tr>';
          }).join('') + '</tbody></table>';
      });
      if (withResults) html += '<p class="pp-answer"><b>Antwort:</b> ' + esc({ offen: 'offen', ja: 'Ja', teilweise: 'Ja, mit Einschränkungen', nein: 'Nein' }[c.antwort]) + (c.antwortText ? '. ' + esc(c.antwortText) : '') + '</p>';
      html += '</section>';
    });
    if (!withResults) {
      const used = new Set(); p.cois.forEach(c => c.measures.forEach(m => m.criteria.forEach(k => used.add(k.skala))));
      const sc = OTE.state.scales.filter(s => used.has(s.id) && s.levels && s.levels.length);
      if (sc.length) html += '<section class="pp-annex"><h2>Anhang: Bewertungsskalen</h2>' + sc.map(s => '<h3>' + esc(s.name) + '</h3><table class="pp"><tbody>' +
        s.levels.map(l => '<tr><td class="w-nr"><b>' + esc(l.v) + '</b></td><td>' + esc(l.label) + '</td><td>' + esc(l.desc) + '</td></tr>').join('') + '</tbody></table>').join('') + '</section>';
    }
    doPrint('<div class="pp-doc">' + html + '</div>', 'print-plan');
  };

  OTE.exportCSV = function (p) {
    const idx = OTE.index(p);
    const flightOf = {};
    p.flights.forEach(f => f.testpunkte.forEach(t => { (flightOf[t] = flightOf[t] || []).push('Flug ' + f.nr); }));
    const head = ['COI', 'Kategorie', 'COI-Frage', 'Measure', 'Measure-Typ', 'Measure-Aussage', 'Kriterium', 'Typ', 'Text', 'Skala', 'Einheit', 'Richtung', 'Objective', 'Threshold', 'Methode', 'Bedingungen', 'Daten', 'Flüge', 'Ergebnis', 'Status', 'Auswirkung', 'Bemerkung'];
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [head.map(q).join(';')];
    idx.criteria.forEach(e => {
      const k = e.obj, c = e.coi, m = e.measure, imp = OTE.IMPACT.find(i => i.id === k.impact);
      rows.push([idx.byId[c.id].label, c.kategorie, c.frage, idx.byId[m.id].label, m.typ, (m.titel ? m.titel + ': ' : '') + m.text, e.label, k.typ, k.text,
        OTE.scale(k.skala).kurz, k.einheit, k.richtung, k.objective, k.threshold, k.methode, k.bedingungen, k.daten, (flightOf[k.id] || []).join(', '),
        k.ergebnis, OTE.STATUS_TEXT[OTE.evalCriterion(k)], imp ? imp.label + ' ' + imp.rec : '', k.bemerkung].map(q).join(';'));
    });
    OTE.ui.download(OTE.ui.slug(p.name) + '_traceability.csv', '﻿' + rows.join('\r\n'), 'text/csv;charset=utf-8');
  };
})();
