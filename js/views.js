/* OT&E Planer: Ansichten */
(function () {
  'use strict';
  const OTE = (window.OTE = window.OTE || {});
  const { esc, nl2br, icon } = OTE.ui;
  const V = (OTE.views = {});

  const btn = (act, label, opts) => {
    opts = opts || {};
    return '<button type="button" class="btn ' + (opts.cls || '') + '" data-act="' + act + '"' + (opts.id ? ' data-id="' + opts.id + '"' : '') +
      (opts.title ? ' title="' + esc(opts.title) + '"' : '') + (opts.disabled ? ' disabled' : '') + '>' + (opts.icon ? icon(opts.icon) : '') + (label ? '<span>' + esc(label) + '</span>' : '') + '</button>';
  };
  const ibtn = (act, ic, title, id, cls) => '<button type="button" class="icon-btn ' + (cls || '') + '" data-act="' + act + '" data-id="' + id + '" title="' + esc(title) + '" aria-label="' + esc(title) + '">' + icon(ic) + '</button>';
  V.btn = btn; V.ibtn = ibtn;

  const aiLabel = () => ({ api: 'KI', manual: 'KI manuell', off: 'Vorlage' })[OTE.state.settings.aiMode];

  const chipStatus = st => '<span class="st st-' + st + '">' + esc(OTE.STATUS_TEXT[st] || st) + '</span>';
  V.chipStatus = chipStatus;

  const pfield = (label, key, val, opts) => {
    opts = opts || {};
    const id = 'p-' + key;
    const inp = opts.area
      ? '<textarea id="' + id + '" data-pbind="' + key + '" rows="' + (opts.rows || 3) + '" placeholder="' + esc(opts.ph || '') + '">' + esc(val) + '</textarea>'
      : '<input id="' + id + '" data-pbind="' + key + '" value="' + esc(val) + '" placeholder="' + esc(opts.ph || '') + '">';
    return '<div class="fld"><label class="lbl" for="' + id + '">' + esc(label) + '</label>' + inp + (opts.hint ? '<div class="hint">' + opts.hint + '</div>' : '') + '</div>';
  };

  /* ================= 1 Auftrag ================= */
  V.auftrag = function (p) {
    const a = p.analysis;
    const adopted = new Set(p.cois.map(c => (c.frage || '').trim()));
    const docs = p.docs.map(d => '<li class="doc">' +
      '<div class="doc-main"><span class="doc-type">' + esc((d.type || '').toUpperCase()) + '</span><span class="doc-name">' + esc(d.name) + '</span></div>' +
      '<div class="doc-meta">' + (d.pages ? d.pages + ' Seiten, ' : '') + (d.chars || 0).toLocaleString('de-DE') + ' Zeichen' +
      (d.note ? '<span class="warn-inline">' + esc(d.note) + '</span>' : '') + '</div>' +
      '<div class="doc-act">' + ibtn('doc-view', 'edit', 'Text ansehen und bearbeiten', d.id) + ibtn('doc-del', 'trash', 'Entfernen', d.id, 'danger') + '</div></li>').join('');

    let res = '';
    if (a) {
      const props = (a.cois || []).map((c, i) => {
        const isIn = adopted.has((c.frage || '').trim());
        return '<li class="prop ' + (isIn ? 'is-in' : '') + '">' +
          '<label class="prop-check"><input type="checkbox" data-prop="' + i + '"' + (c._sel !== false && !isIn ? ' checked' : '') + (isIn ? ' disabled' : '') + '><span class="sr">Auswählen</span></label>' +
          '<div class="prop-body"><div class="prop-top"><span class="kat kat-' + esc(c.kategorie) + '">' + (c.kategorie === 'S' ? 'Suitability' : 'Effectiveness') + '</span>' +
          '<span class="prio prio-' + esc(c.prioritaet) + '">Priorität ' + esc(c.prioritaet || 'mittel') + '</span>' + (isIn ? '<span class="tag-in">' + icon('check') + 'im Katalog</span>' : '') + '</div>' +
          '<h3>' + esc(c.frage) + '</h3>' + (c.kurz ? '<div class="prop-kurz">' + esc(c.kurz) + '</div>' : '') +
          (c.begruendung ? '<p class="prop-why">' + esc(c.begruendung) + '</p>' : '') +
          (c.quelle ? '<blockquote>' + esc(c.quelle) + '</blockquote>' : '') + '</div></li>';
      }).join('');
      res = '<section class="panel analysis">' +
        '<div class="panel-head"><h2>Analyse</h2><span class="muted">' + (a.quelle === 'offline' ? 'Offline-Vorlage' : 'KI-Analyse') + ', ' + OTE.ui.fmtDate(a.date) + '</span></div>' +
        '<div class="an-grid"><div><h3 class="h-sub">Zusammenfassung</h3><p>' + nl2br(a.zusammenfassung) + '</p>' +
        (a.aim ? '<h3 class="h-sub">Aim</h3><p class="aim">' + esc(a.aim) + '</p>' + (p.aim !== a.aim ? btn('aim-take', 'Als Aim übernehmen', { cls: 'sm' }) : '') : '') + '</div>' +
        '<div>' + ((a.missionen || []).length ? '<h3 class="h-sub">Design Missions und Rahmen</h3><ul class="bul">' + a.missionen.map(m => '<li>' + esc(m) + '</li>').join('') + '</ul>' : '') +
        ((a.hinweise || []).length ? '<h3 class="h-sub">Offene Punkte im Auftrag</h3><ul class="bul warn">' + a.hinweise.map(m => '<li>' + esc(m) + '</li>').join('') + '</ul>' : '') + '</div></div>' +
        '<div class="panel-head sub"><h2>COI-Vorschläge <span class="count">' + (a.cois || []).length + '</span></h2>' +
        '<div class="btn-row">' + btn('prop-all', 'Alle', { cls: 'sm ghost' }) + btn('prop-none', 'Keine', { cls: 'sm ghost' }) + '</div></div>' +
        '<ul class="props">' + props + '</ul>' +
        '<div class="row-end">' + btn('prop-adopt', 'Ausgewählte in den COI-Katalog übernehmen', { cls: 'primary', icon: 'check' }) + '</div></section>';
    }

    return '<section class="view">' +
      '<header class="view-head"><h1>Auftrag</h1><p class="lead">Lade den Auftrag der Einsatzprüfung hoch oder füge den Text ein. Daraus werden COI-Vorschläge abgeleitet, die du übernimmst, bearbeitest oder verwirfst.</p></header>' +
      '<div class="grid-2">' +
      '<section class="panel"><div class="panel-head"><h2>Projekt</h2></div>' +
      pfield('Projektname', 'name', p.name) +
      '<div class="two">' + pfield('System', 'system', p.system, { ph: 'z. B. CH-47F Block II' }) + pfield('Kampagne / Phase', 'kampagne', p.kampagne, { ph: 'z. B. Phase 1.0' }) + '</div>' +
      pfield('Aim', 'aim', p.aim, { area: true, rows: 2, ph: 'Was soll die Einsatzprüfung insgesamt erreichen?' }) +
      pfield('Rahmen und Ausschlüsse', 'rahmen', p.rahmen, { area: true, rows: 3, ph: 'z. B. nur taktisch-operativer Anteil, kein technisch-logistischer Bereich', hint: 'Wird bei jeder KI-Anfrage berücksichtigt.' }) +
      '</section>' +
      '<section class="panel"><div class="panel-head"><h2>Unterlagen</h2></div>' +
      '<label class="drop" data-drop tabindex="0"><input type="file" id="file-in" multiple accept=".pdf,.docx,.txt,.md,.html,.htm,.csv,.json" hidden>' +
      icon('upload', 'big') + '<strong>Datei hierher ziehen oder auswählen</strong><span>PDF, DOCX, TXT oder MD. Die Textextraktion läuft lokal im Browser.</span></label>' +
      '<div class="btn-row">' + btn('doc-paste', 'Text einfügen', { cls: 'sm' }) + '</div>' +
      (docs ? '<ul class="docs">' + docs + '</ul>' : '') +
      '<div class="notice">' + (OTE.state.settings.aiMode === 'api'
        ? 'Im KI-Modus wird der Dokumenttext an die Anthropic API übertragen. Nur offen eingestufte Unterlagen verwenden.'
        : OTE.state.settings.aiMode === 'manual' ? 'Manueller KI-Modus: Du kopierst den Prompt selbst in ein freigegebenes KI-Werkzeug.'
          : 'KI ist ausgeschaltet. Vorschläge entstehen per Stichwortsuche aus Vorlagen.') + '</div>' +
      '<div class="row-end">' + btn('analyze-offline', 'Vorschlag aus Vorlagen', { cls: 'ghost', disabled: !p.docs.length }) +
      (OTE.ai.available() ? btn('analyze', 'Auftrag analysieren', { cls: 'primary', icon: 'spark', disabled: !p.docs.length }) : '') + '</div>' +
      '</section></div>' + res + '</section>';
  };

  /* ================= 2 COI-Katalog ================= */
  V.katalog = function (p) {
    const idx = OTE.index(p);
    const cnt = { E: 0, S: 0, MOE: 0, MOS: 0, MOP: 0, MOA: 0 };
    p.cois.forEach(c => { cnt[c.kategorie]++; c.measures.forEach(m => { cnt[m.typ]++; m.criteria.forEach(k => cnt[k.typ]++); }); });
    const ai = OTE.ai.available();

    const coiHtml = p.cois.map(c => {
      const e = idx.byId[c.id];
      const measures = c.measures.map(m => {
        const me = idx.byId[m.id];
        const rows = m.criteria.map(k => {
          const ke = idx.byId[k.id], s = OTE.scale(k.skala);
          const scaleTxt = s.kind === 'numeric' ? (k.richtung === '<=' ? '≤ ' : '≥ ') + (k.einheit || '') : s.kurz;
          return '<tr data-row="' + k.id + '">' +
            '<td class="c-nr"><button type="button" class="linkish" data-act="edit" data-id="' + k.id + '">' + esc(ke.label) + '</button></td>' +
            '<td class="c-text">' + esc(k.text) + (k.bedingungen ? '<div class="c-sub">' + esc(k.bedingungen) + '</div>' : '') + '</td>' +
            '<td class="c-sc">' + esc(scaleTxt) + '</td><td class="c-v">' + esc(k.objective) + '</td><td class="c-v">' + esc(k.threshold) + '</td>' +
            '<td class="c-m">' + esc(k.methode) + '</td>' +
            '<td class="c-act">' + ibtn('up', 'up', 'Nach oben', k.id) + ibtn('down', 'down', 'Nach unten', k.id) + ibtn('del', 'trash', 'Löschen', k.id, 'danger') + '</td></tr>';
        }).join('');
        return '<div class="measure" data-node="' + m.id + '">' +
          '<div class="m-head"><button type="button" class="m-label linkish" data-act="edit" data-id="' + m.id + '">' + esc(me.label) + '</button>' +
          '<div class="m-text"><strong>' + esc(m.titel) + '</strong>' + (m.titel && m.text ? ' ' : '') + esc(m.text) + '</div>' +
          '<div class="acts">' + (ai || true ? ibtn('gen-crit', 'spark', 'MOP/MOA generieren (' + aiLabel() + ')', m.id, 'accent') : '') +
          ibtn('add-crit', 'plus', 'MOP/MOA hinzufügen', m.id) + ibtn('edit', 'edit', 'Bearbeiten', m.id) +
          ibtn('up', 'up', 'Nach oben', m.id) + ibtn('down', 'down', 'Nach unten', m.id) + ibtn('del', 'trash', 'Löschen', m.id, 'danger') + '</div></div>' +
          (rows ? '<div class="tbl-wrap"><table class="crit"><thead><tr><th>Nr.</th><th>Kriterium</th><th>Skala</th><th>Obj</th><th>Thr</th><th>Methode</th><th><span class="sr">Aktionen</span></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
            : '<div class="empty-sm">Noch keine MOP/MOA. ' + '<button type="button" class="linkish" data-act="gen-crit" data-id="' + m.id + '">Generieren</button> oder <button type="button" class="linkish" data-act="add-crit" data-id="' + m.id + '">manuell hinzufügen</button>.</div>') +
          '</div>';
      }).join('');
      return '<article class="coi kat-' + c.kategorie + (c.collapsed ? ' collapsed' : '') + '" data-node="' + c.id + '">' +
        '<div class="coi-head">' +
        '<button type="button" class="tog" data-act="toggle" data-id="' + c.id + '" aria-expanded="' + !c.collapsed + '" aria-label="Auf- oder zuklappen">' + icon('chevron') + '</button>' +
        '<div class="coi-id"><button type="button" class="linkish" data-act="edit" data-id="' + c.id + '">' + esc(e.label) + '</button><span class="kat kat-' + c.kategorie + '">' + (c.kategorie === 'S' ? 'S' : 'E') + '</span></div>' +
        '<div class="coi-q"><h3>' + esc(c.frage || '(ohne Frage)') + '</h3><div class="coi-meta">' + (c.kurz ? '<span>' + esc(c.kurz) + '</span>' : '') +
        '<span class="prio prio-' + esc(c.prioritaet) + '">Priorität ' + esc(c.prioritaet) + '</span><span>' + c.measures.length + ' Measures, ' +
        c.measures.reduce((n, m) => n + m.criteria.length, 0) + ' Kriterien</span></div></div>' +
        '<div class="acts">' + ibtn('gen-meas', 'spark', 'MOE/MOS und MOP/MOA generieren (' + aiLabel() + ')', c.id, 'accent') +
        ibtn('add-meas', 'plus', (c.kategorie === 'S' ? 'MOS' : 'MOE') + ' hinzufügen', c.id) + ibtn('edit', 'edit', 'Bearbeiten', c.id) +
        ibtn('up', 'up', 'Nach oben', c.id) + ibtn('down', 'down', 'Nach unten', c.id) + ibtn('del', 'trash', 'Löschen', c.id, 'danger') + '</div></div>' +
        '<div class="coi-body">' + (measures || '<div class="empty-sm">Noch keine MOE/MOS. <button type="button" class="linkish" data-act="gen-meas" data-id="' + c.id + '">Generieren</button> oder <button type="button" class="linkish" data-act="add-meas" data-id="' + c.id + '">manuell hinzufügen</button>.</div>') + '</div></article>';
    }).join('');

    return '<section class="view">' +
      '<header class="view-head"><h1>COI-Katalog</h1><p class="lead">Critical Operational Issues mit den zugehörigen Measures. Nummern werden automatisch vergeben. Ein Klick auf eine Nummer öffnet die Bearbeitung.</p></header>' +
      '<div class="toolbar">' + btn('add-coi', 'COI hinzufügen', { icon: 'plus' }) +
      btn('gen-all', 'Measures für alle COI ohne Measures generieren', { icon: 'spark', cls: 'accent-btn', disabled: !p.cois.length }) +
      '<span class="grow"></span>' + btn('expand-all', 'Alle aufklappen', { cls: 'ghost sm' }) + btn('collapse-all', 'Alle zuklappen', { cls: 'ghost sm' }) + '</div>' +
      '<div class="stats"><span><b>' + p.cois.length + '</b> COI (' + cnt.E + ' E, ' + cnt.S + ' S)</span><span><b>' + cnt.MOE + '</b> MOE</span><span><b>' + cnt.MOS + '</b> MOS</span><span><b>' + cnt.MOP + '</b> MOP</span><span><b>' + cnt.MOA + '</b> MOA</span></div>' +
      (coiHtml ? '<div class="tree">' + coiHtml + '</div>'
        : '<div class="empty"><h2>Noch keine COI</h2><p>Analysiere den Auftrag und übernimm die Vorschläge, oder lege das erste COI selbst an.</p><div class="btn-row center">' +
          btn('goto', 'Zum Auftrag', { id: 'auftrag' }) + btn('add-coi', 'COI hinzufügen', { cls: 'primary', icon: 'plus' }) + '</div></div>') +
      '</section>';
  };

  /* Editor-Formulare */
  V.editForm = function (p, id) {
    const e = OTE.index(p).byId[id];
    if (!e) return null;
    const o = e.obj, F = OTE.ui.field;
    if (e.kind === 'coi') {
      return { title: e.label + ' bearbeiten', obj: o, html:
        F('Frage (Ja/Nein)', 'frage', o.frage, { type: 'textarea', rows: 3 }) +
        '<div class="two">' + F('Kurztitel', 'kurz', o.kurz) +
        F('Kategorie', 'kategorie', o.kategorie, { type: 'select', options: [{ v: 'E', l: 'Effectiveness' }, { v: 'S', l: 'Suitability' }] }) + '</div>' +
        F('Priorität', 'prioritaet', o.prioritaet, { type: 'select', options: ['hoch', 'mittel', 'niedrig'] }) +
        F('Begründung', 'begruendung', o.begruendung, { type: 'textarea', rows: 3 }) +
        F('Fundstelle im Auftrag', 'quelle', o.quelle, { type: 'textarea', rows: 2 }) };
    }
    if (e.kind === 'measure') {
      return { title: e.label + ' bearbeiten', obj: o, html:
        F('Typ', 'typ', o.typ, { type: 'select', options: [{ v: 'MOE', l: 'MOE (Effectiveness)' }, { v: 'MOS', l: 'MOS (Suitability)' }] }) +
        F('Kurztitel', 'titel', o.titel) +
        F('Aussage', 'text', o.text, { type: 'textarea', rows: 3, ph: 'z. B. Die fliegerische Dokumentation ist ausreichend, um sicheren und operationellen Flugbetrieb durchzuführen.' }) +
        F('Notiz', 'notiz', o.notiz, { type: 'textarea', rows: 2 }) };
    }
    const scales = OTE.state.scales.map(s => ({ v: s.id, l: s.name }));
    const s = OTE.scale(o.skala);
    return { title: e.label + ' bearbeiten', obj: o, html:
      '<div class="two">' + F('Typ', 'typ', o.typ, { type: 'select', options: [{ v: 'MOP', l: 'MOP (quantitativ)' }, { v: 'MOA', l: 'MOA (Bewertung)' }] }) +
      F('Methode', 'methode', o.methode, { type: 'select', options: OTE.METHODS }) + '</div>' +
      F('Kriterium', 'text', o.text, { type: 'textarea', rows: 3 }) +
      F('Skala', 'skala', o.skala, { type: 'select', options: scales }) +
      '<div class="scale-help" data-scale-help>' + V.scaleHelp(s) + '</div>' +
      '<div class="three">' + F('Einheit', 'einheit', o.einheit, { ph: 'kg, kt, min, %' }) +
      F('Richtung', 'richtung', o.richtung, { type: 'select', options: [{ v: '>=', l: '≥ größer ist besser' }, { v: '<=', l: '≤ kleiner ist besser' }] }) + '<div></div></div>' +
      '<div class="two">' + F('Objective', 'objective', o.objective, { hint: 'gewünschter Wert' }) + F('Threshold', 'threshold', o.threshold, { hint: 'minimal akzeptabler Wert' }) + '</div>' +
      F('Testbedingungen', 'bedingungen', o.bedingungen, { type: 'textarea', rows: 2 }) +
      F('Daten und Messmittel', 'daten', o.daten, { type: 'textarea', rows: 2 }) };
  };

  V.scaleHelp = function (s) {
    if (!s) return '';
    let h = '<strong>' + esc(s.name) + '</strong>' + (s.info ? '<span class="muted"> ' + esc(s.info) + '</span>' : '');
    if (s.levels && s.levels.length) h += '<ol class="levels">' + s.levels.map(l => '<li><b>' + esc(l.v) + '</b> ' + esc(l.label) + (l.desc ? '<span class="muted"> ' + esc(l.desc) + '</span>' : '') + '</li>').join('') + '</ol>';
    return h;
  };

  /* ================= 3 Flugplanung ================= */
  const TESTABLE = OTE.PLANNABLE;
  V.flugplanung = function (p, flightId) {
    const idx = OTE.index(p);
    const assigned = {};
    p.flights.forEach(f => f.testpunkte.forEach(t => { (assigned[t] = assigned[t] || []).push(f); }));
    const plannable = idx.criteria.filter(e => TESTABLE.includes(e.obj.methode));
    const open = plannable.filter(e => !assigned[e.obj.id]);
    const f = flightId && p.flights.find(x => x.id === flightId);
    if (f) return V.flight(p, f, idx, assigned);

    const rows = p.flights.map(fl => '<tr><td class="c-nr"><button type="button" class="linkish" data-act="flight-open" data-id="' + fl.id + '">Flug ' + esc(fl.nr) + '</button></td>' +
      '<td>' + esc(fl.titel || '(ohne Titel)') + (fl.profil ? '<div class="c-sub">' + esc(fl.profil) + '</div>' : '') + '</td>' +
      '<td>' + esc(fl.datum ? new Date(fl.datum).toLocaleDateString('de-DE') : '') + '</td><td>' + esc(fl.dauer ? fl.dauer + ' min' : '') + '</td>' +
      '<td>' + fl.testpunkte.length + '</td><td>' + fl.karten.length + '</td><td><span class="fst fst-' + esc(fl.status) + '">' + esc(fl.status) + '</span></td>' +
      '<td class="c-act">' + ibtn('flight-up', 'up', 'Nach oben', fl.id) + ibtn('flight-down', 'down', 'Nach unten', fl.id) + ibtn('flight-del', 'trash', 'Löschen', fl.id, 'danger') + '</td></tr>').join('');

    const pct = plannable.length ? Math.round((plannable.length - open.length) / plannable.length * 100) : 0;
    return '<section class="view">' +
      '<header class="view-head"><h1>Flugplanung</h1><p class="lead">Testpunkte (MOP/MOA) zu Flügen bündeln und daraus Testkarten erzeugen. Eingeplant werden Kriterien mit dem Verfahren Flugversuch, Bodenversuch oder SME-Bewertung.</p></header>' +
      '<div class="toolbar">' + btn('flight-add', 'Flug anlegen', { icon: 'plus' }) +
      btn('program', 'Flugprogramm für offene Testpunkte vorschlagen', { icon: 'spark', cls: 'accent-btn', disabled: !open.length }) + '</div>' +
      '<div class="coverage"><div class="cov-bar"><span style="width:' + pct + '%"></span></div><div><b>' + (plannable.length - open.length) + '</b> von <b>' + plannable.length + '</b> Testpunkten eingeplant (' + pct + ' %)</div></div>' +
      (p.flights.length ? '<div class="tbl-wrap"><table class="list"><thead><tr><th>Flug</th><th>Titel / Profil</th><th>Datum</th><th>Dauer</th><th>TP</th><th>Karten</th><th>Status</th><th><span class="sr">Aktionen</span></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<div class="empty"><h2>Noch keine Flüge</h2><p>' + (plannable.length ? 'Lege einen Flug an oder lass ein Flugprogramm für alle offenen Testpunkte vorschlagen.' : 'Lege zuerst im COI-Katalog MOP/MOA an.') + '</p></div>') +
      (open.length ? '<details class="panel open-tp"><summary><h2>Nicht eingeplante Testpunkte <span class="count">' + open.length + '</span></h2></summary><ul class="tp-list">' +
        open.map(e => '<li><span class="tp-label">' + esc(e.label) + '</span> ' + esc(e.obj.text) + ' <span class="muted">(' + esc(e.obj.methode) + ')</span></li>').join('') + '</ul></details>' : '') +
      '</section>';
  };

  V.flight = function (p, f, idx, assigned) {
    const F = (label, key, opts) => {
      opts = opts || {};
      const id = 'fl-' + key;
      const inp = opts.area ? '<textarea id="' + id + '" data-fbind="' + key + '" rows="' + (opts.rows || 2) + '">' + esc(f[key]) + '</textarea>'
        : opts.options ? '<select id="' + id + '" data-fbind="' + key + '">' + opts.options.map(o => '<option' + (o === f[key] ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>'
          : '<input id="' + id + '" data-fbind="' + key + '" type="' + (opts.type || 'text') + '" value="' + esc(f[key]) + '" placeholder="' + esc(opts.ph || '') + '">';
      return '<div class="fld"><label class="lbl" for="' + id + '">' + esc(label) + '</label>' + inp + '</div>';
    };
    const tp = new Set(f.testpunkte);
    const tree = p.cois.map(c => {
      const items = [];
      c.measures.forEach(m => m.criteria.forEach(k => {
        if (!TESTABLE.includes(k.methode) && !tp.has(k.id)) return;
        const e = idx.byId[k.id];
        const other = (assigned[k.id] || []).filter(x => x.id !== f.id).map(x => 'Flug ' + x.nr);
        items.push('<li><label class="tp-pick"><input type="checkbox" data-tp="' + k.id + '"' + (tp.has(k.id) ? ' checked' : '') + '>' +
          '<span class="tp-label">' + esc(e.label) + '</span><span class="tp-text">' + esc(k.text) + '</span>' +
          '<span class="muted">' + esc(k.methode) + (other.length ? ', bereits in ' + esc(other.join(', ')) : '') + '</span></label></li>');
      }));
      if (!items.length) return '';
      return '<li class="tp-coi"><div class="tp-coi-h">' + esc(idx.byId[c.id].label) + ' ' + esc(c.kurz || c.frage) + '</div><ul>' + items.join('') + '</ul></li>';
    }).join('');

    const cards = f.karten.map((k, i) => {
      const ref = idx.byId[k.ref];
      const ta = (key, label, rows, cls) => '<div class="fld ' + (cls || '') + '"><label class="lbl">' + label + '</label><textarea data-cbind="' + key + '" data-card="' + k.id + '" rows="' + (rows || 2) + '">' + esc(k[key]) + '</textarea></div>';
      return '<article class="tcard">' +
        '<div class="tcard-head"><span class="tcard-no">Karte ' + (i + 1) + '</span><span class="tp-label">' + esc(ref ? ref.label : 'Testpunkt gelöscht') + '</span>' +
        '<input class="tcard-title" data-cbind="titel" data-card="' + k.id + '" value="' + esc(k.titel) + '" aria-label="Kartentitel">' +
        '<div class="acts">' + ibtn('card-up', 'up', 'Nach oben', k.id) + ibtn('card-down', 'down', 'Nach unten', k.id) + ibtn('card-del', 'trash', 'Karte löschen', k.id, 'danger') + '</div></div>' +
        '<div class="tcard-grid">' + ta('testziel', 'Testziel', 2, 'span2') + ta('tha', 'THA / Mitigation und Notverfahren', 3, 'span2 tha') +
        ta('voraussetzungen', 'Voraussetzungen', 2) + ta('konfiguration', 'Konfiguration', 2) +
        ta('ftt', 'Flight Test Technique', 6, 'span2') + ta('flugbedingungen', 'Flugbedingungen', 2) + ta('limits', 'Limits', 2) +
        ta('daten', 'Daten und Bewertung', 3) + ta('abbruch', 'Abbruchkriterien', 3) + '</div></article>';
    }).join('');

    return '<section class="view">' +
      '<div class="crumbs"><button type="button" class="linkish" data-act="flight-back">Flugplanung</button> / Flug ' + esc(f.nr) + '</div>' +
      '<header class="view-head row"><h1>Flug ' + esc(f.nr) + (f.titel ? ': ' + esc(f.titel) : '') + '</h1>' +
      '<div class="btn-row">' + btn('print-cards', 'Testkarten drucken', { icon: 'print', disabled: !f.karten.length }) + '</div></header>' +
      '<section class="panel"><div class="panel-head"><h2>Flugdaten</h2><span class="muted">Erscheinen auf dem Deckblatt der Testkarten</span></div>' +
      '<div class="fgrid">' + F('Flug-Nr.', 'nr') + F('Titel', 'titel') + F('Datum', 'datum', { type: 'date' }) + F('Status', 'status', { options: ['geplant', 'bereit', 'durchgeführt', 'abgebrochen'] }) +
      F('Muster / Type', 'muster', { ph: p.system }) + F('Kennung / Serial No.', 'kennung') + F('Callsign', 'callsign') + F('Geplante Dauer (min)', 'dauer', { type: 'number' }) +
      F('Startort', 'startort') + F('Start (LT)', 'start', { type: 'time' }) + F('Landung (LT)', 'ende', { type: 'time' }) + F('Phase', 'phase', { ph: p.kampagne }) +
      F('Besatzung', 'crew') + F('Beobachter', 'beobachter') + F('Testgebiet / Range', 'testgebiet') + F('Masse', 'masse') +
      F('Software', 'software') + F('Hardware', 'hardware') + F('Sensoren', 'sensoren') + F('Beladung und Schwerpunkt', 'beladung') + '</div>' +
      '<div class="two">' + F('Flugprofil', 'profil', { area: true }) + F('Bedingungen (Tag/Nacht, Wetter)', 'bedingungen', { area: true }) + '</div></section>' +
      '<section class="panel"><div class="panel-head"><h2>Testpunkte <span class="count">' + f.testpunkte.length + '</span></h2></div>' +
      (tree ? '<ul class="tp-tree">' + tree + '</ul>' : '<p class="muted">Keine planbaren Testpunkte vorhanden. Lege im COI-Katalog MOP/MOA an.</p>') + '</section>' +
      '<section class="panel"><div class="panel-head"><h2>Testkarten <span class="count">' + f.karten.length + '</span></h2>' +
      '<div class="btn-row">' + btn('cards-tpl', 'Aus Vorlage erzeugen', { cls: 'ghost', disabled: !f.testpunkte.length }) +
      (OTE.ai.available() ? btn('cards-ai', 'Testkarten generieren', { cls: 'primary', icon: 'spark', disabled: !f.testpunkte.length }) : '') + '</div></div>' +
      (f.flugziel ? '<p class="aim">' + esc(f.flugziel) + '</p>' : '') + (f.hinweise ? '<div class="notice">' + nl2br(f.hinweise) + '</div>' : '') +
      (cards ? '<div class="tcards">' + cards + '</div>' : '<p class="muted">Noch keine Testkarten. Testpunkte auswählen und Karten erzeugen. Vorhandene Karten zu denselben Testpunkten werden dabei ersetzt.</p>') +
      '</section></section>';
  };

  /* ================= 4 Bewertung ================= */
  V.bewertung = function (p) {
    const idx = OTE.index(p);
    if (!p.cois.length) return '<section class="view"><header class="view-head"><h1>Bewertung</h1></header><div class="empty"><h2>Noch nichts zu bewerten</h2><p>Lege zuerst COI mit Measures an.</p></div></section>';
    const resultInput = k => {
      const s = OTE.scale(k.skala);
      const np = '<option value="' + OTE.NP + '"' + (k.ergebnis === OTE.NP ? ' selected' : '') + '>nicht prüfbar</option>';
      if (s.levels && s.levels.length) return '<select data-kbind="ergebnis" data-id="' + k.id + '" aria-label="Ergebnis"><option value=""></option>' + s.levels.map(l => '<option value="' + esc(l.v) + '"' + (String(k.ergebnis) === String(l.v) ? ' selected' : '') + '>' + esc(s.kind === 'binary' ? l.label : l.v + ' ' + l.label) + '</option>').join('') + np + '</select>';
      return '<input data-kbind="ergebnis" data-id="' + k.id + '" value="' + esc(k.ergebnis) + '" placeholder="' + esc(k.einheit || 'Wert') + '" aria-label="Ergebnis" title="Messwert eintragen, n. p. = nicht prüfbar">';
    };
    const impactSel = k => '<select data-kbind="impact" data-id="' + k.id + '" aria-label="Auswirkung"><option value=""></option>' + OTE.IMPACT.map(i => '<option value="' + i.id + '"' + (k.impact === i.id ? ' selected' : '') + '>' + esc(i.label + (i.rec !== 'n/a' ? ', ' + i.rec : '')) + '</option>').join('') + '</select>';

    const html = p.cois.map(c => {
      const all = []; c.measures.forEach(m => all.push(...m.criteria));
      const r = OTE.rollup(all);
      const sug = r.status === 'fail' ? 'nein' : (r.done === r.total && r.total ? ({ obj: 'ja', thr: 'teilweise' })[r.status] : null);
      const ms = c.measures.map(m => {
        const mr = OTE.rollup(m.criteria);
        const rows = m.criteria.map(k => {
          const st = OTE.evalCriterion(k), ke = idx.byId[k.id], s = OTE.scale(k.skala);
          return '<tr><td class="c-nr">' + esc(ke.label) + '</td><td class="c-text">' + esc(k.text) + '</td>' +
            '<td class="c-sc" title="' + esc(s.name) + '">' + esc(s.kind === 'numeric' ? (k.richtung === '<=' ? '≤ ' : '≥ ') + (k.einheit || '') : s.kurz) + '</td>' +
            '<td class="c-v">' + esc(k.objective) + '</td><td class="c-v">' + esc(k.threshold) + '</td>' +
            '<td class="c-res">' + resultInput(k) + '</td><td data-st="' + k.id + '">' + chipStatus(st) + '</td>' +
            '<td class="c-imp">' + impactSel(k) + '</td>' +
            '<td class="c-rem"><input data-kbind="bemerkung" data-id="' + k.id + '" value="' + esc(k.bemerkung) + '" aria-label="Bemerkung"></td></tr>';
        }).join('');
        return '<div class="ev-measure"><div class="ev-mh"><span class="tp-label">' + esc(idx.byId[m.id].label) + '</span> ' + esc(m.titel || m.text) +
          ' <span data-mst="' + m.id + '">' + chipStatus(mr.status) + '</span><span class="muted"> ' + mr.done + '/' + mr.total + '</span></div>' +
          (rows ? '<div class="tbl-wrap"><table class="crit ev"><thead><tr><th>Nr.</th><th>Kriterium</th><th>Skala</th><th>Obj</th><th>Thr</th><th>Ergebnis</th><th>Status</th><th>Auswirkung</th><th>Bemerkung</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '') + '</div>';
      }).join('');
      return '<article class="ev-coi kat-' + c.kategorie + '"><div class="ev-ch"><span class="tp-label">' + esc(idx.byId[c.id].label) + '</span><h3>' + esc(c.frage) + '</h3>' +
        '<span data-cst="' + c.id + '">' + chipStatus(r.status) + '</span></div>' + ms +
        '<div class="ev-answer"><div class="fld"><label class="lbl" for="ans-' + c.id + '">Antwort auf das COI</label><select id="ans-' + c.id + '" data-cobind="antwort" data-id="' + c.id + '">' +
        [['offen', 'offen'], ['ja', 'Ja'], ['teilweise', 'Ja, mit Einschränkungen'], ['nein', 'Nein']].map(o => '<option value="' + o[0] + '"' + (c.antwort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
        (sug ? '<div class="hint">Vorschlag aus den Ergebnissen: ' + ({ ja: 'Ja', teilweise: 'Ja, mit Einschränkungen', nein: 'Nein' })[sug] + '</div>' : '') + '</div>' +
        '<div class="fld grow"><label class="lbl" for="anst-' + c.id + '">Begründung</label><textarea id="anst-' + c.id + '" rows="2" data-cobind="antwortText" data-id="' + c.id + '">' + esc(c.antwortText) + '</textarea></div></div></article>';
    }).join('');

    const legend = OTE.IMPACT.map(i => '<li class="imp imp-' + i.id + '"><b>' + esc(i.label) + '</b>' + (i.kat !== 'n/a' ? ' (' + esc(i.kat) + ', Empfehlung ' + esc(i.rec) + ')' : '') + '<span>' + esc(i.desc) + '</span></li>').join('');
    return '<section class="view"><header class="view-head"><h1>Bewertung</h1><p class="lead">Ergebnisse je MOP/MOA eintragen. Der Status ergibt sich aus Objective und Threshold. Die Auswirkung folgt dem Impact-Entscheidungsbaum für Test Reports.</p></header>' +
      '<details class="panel"><summary><h2>Impact-Entscheidungsbaum</h2></summary><ol class="impact">' + legend + '</ol></details>' +
      '<div class="ev-list">' + html + '</div></section>';
  };

  /* ================= 5 Export & Review ================= */
  V.export = function (p) {
    const cl = (key) => OTE.CHECKLISTS[key].map((q, i) => {
      const id = key + '-' + i, rv = p.review && (p.review.punkte || []).find(x => x.liste === key && Number(x.nr) === i + 1);
      return '<li><label class="chk"><input type="checkbox" data-check="' + key + '" data-i="' + i + '"' + (p.checklist[key][i] ? ' checked' : '') + ' id="' + id + '"><span>' + esc(q) + '</span></label>' +
        (rv ? '<div class="rv rv-' + esc(rv.bewertung) + '"><b>' + esc({ ok: 'erfüllt', teilweise: 'teilweise', nein: 'nicht erfüllt' }[rv.bewertung] || rv.bewertung) + '</b> ' + esc(rv.kommentar) + '</div>' : '') + '</li>';
    }).join('');
    const scales = OTE.state.scales.map(s => '<details class="scale"><summary>' + esc(s.name) + '</summary>' + V.scaleHelp(s) + '</details>').join('');
    return '<section class="view"><header class="view-head"><h1>Export und Review</h1><p class="lead">Projekt sichern, Testplan und Matrix ausgeben, Katalog gegen die Review-Checklisten prüfen.</p></header>' +
      '<div class="grid-2">' +
      '<section class="panel"><div class="panel-head"><h2>Sicherung</h2></div><p class="muted">Daten liegen nur in diesem Browser. Für Teamarbeit und als Backup das Projekt als Datei sichern und weitergeben. „Sicherung laden“ liest auch Sicherungskopien des SharePoint-OT&amp;E-Tools (ote-datenstand.json) und legt daraus ein neues Projekt an.</p>' +
      '<div class="btn-row">' + btn('export-json', 'Projekt sichern (.json)', { icon: 'download', cls: 'primary' }) + btn('import-json', 'Sicherung laden', { icon: 'upload' }) + '</div>' +
      '<input type="file" id="import-in" accept=".json,application/json" hidden>' +
      '<div class="btn-row danger-zone">' + btn('project-dup', 'Projekt duplizieren', { cls: 'ghost sm' }) + btn('project-del', 'Projekt löschen', { cls: 'ghost sm danger' }) + '</div></section>' +
      '<section class="panel"><div class="panel-head"><h2>Ausgaben</h2></div>' +
      '<div class="out-list">' +
      '<div><b>Testplan</b><span class="muted">COI mit MOE/MOS und MOP/MOA als Tabellen, druckbar oder als PDF.</span>' + btn('print-plan', 'Drucken', { icon: 'print', cls: 'sm' }) + '</div>' +
      '<div><b>Bewertungsbericht</b><span class="muted">Ergebnisse, Status, Auswirkung und COI-Antworten.</span>' + btn('print-eval', 'Drucken', { icon: 'print', cls: 'sm' }) + '</div>' +
      '<div><b>Traceability-Matrix</b><span class="muted">Alle Kriterien mit COI, Measure, Skala, Werten und Flugzuordnung als CSV für Excel.</span>' + btn('export-csv', 'CSV', { icon: 'download', cls: 'sm' }) + '</div>' +
      '<div><b>Alle Testkarten</b><span class="muted">Testkarten aller Flüge in einem Druckauftrag.</span>' + btn('print-allcards', 'Drucken', { icon: 'print', cls: 'sm' }) + '</div>' +
      '</div></section></div>' +
      '<section class="panel"><div class="panel-head"><h2>Review-Checklisten</h2>' + (OTE.ai.available() ? btn('review-ai', 'Katalog prüfen lassen', { icon: 'spark', cls: 'primary', disabled: !p.cois.length }) : '') + '</div>' +
      (p.review ? '<div class="review-sum"><h3 class="h-sub">Ergebnis der Prüfung, ' + OTE.ui.fmtDate(p.review.date) + '</h3><p>' + esc(p.review.gesamt) + '</p>' +
        ((p.review.vorschlaege || []).length ? '<ul class="bul">' + p.review.vorschlaege.map(v => '<li>' + esc(v) + '</li>').join('') + '</ul>' : '') + '</div>' : '') +
      '<div class="grid-2"><div><h3 class="h-sub">Critical Operational Issues</h3><ul class="checklist">' + cl('coi') + '</ul></div>' +
      '<div><h3 class="h-sub">MOE und MOA</h3><ul class="checklist">' + cl('moe') + '</ul></div></div></section>' +
      '<section class="panel"><div class="panel-head"><h2>Bewertungsskalen</h2>' + btn('scales-edit', 'Skalen bearbeiten', { cls: 'sm', icon: 'edit' }) + '</div>' + scales + '</section>' +
      '</section>';
  };
})();
