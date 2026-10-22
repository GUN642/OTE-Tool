/* OT&E Planer: Steuerung */
(function () {
  'use strict';
  const OTE = (window.OTE = window.OTE || {});
  const { esc, $, $$, icon, toast } = OTE.ui;
  const V = OTE.views;
  let currentFlight = null;

  const NAV = [
    { id: 'auftrag', label: 'Auftrag', sub: p => p.docs.length ? p.docs.length + ' Unterlagen' : 'Unterlagen laden' },
    { id: 'katalog', label: 'COI-Katalog', sub: p => { const i = OTE.index(p); return p.cois.length + ' COI, ' + i.criteria.length + ' Kriterien'; } },
    { id: 'flug', label: 'Flugplanung', sub: p => p.flights.length + ' Flüge, ' + p.flights.reduce((n, f) => n + f.karten.length, 0) + ' Karten' },
    { id: 'bewertung', label: 'Bewertung', sub: p => { const i = OTE.index(p); const d = i.criteria.filter(e => OTE.evalCriterion(e.obj) !== 'offen').length; return d + ' von ' + i.criteria.length + ' bewertet'; } },
    { id: 'export', label: 'Export und Review', sub: () => 'Sichern, drucken, prüfen' }
  ];

  /* ---------- Rendering ---------- */
  function applyTheme() {
    const t = OTE.state.settings.theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }

  function renderShell() {
    const s = OTE.state, p = OTE.project();
    $('#proj-select').innerHTML = s.projects.map(x => '<option value="' + x.id + '"' + (x.id === p.id ? ' selected' : '') + '>' + esc(x.name || 'Ohne Namen') + '</option>').join('') +
      '<option value="__new">+ Neues Projekt</option>';
    $('#nav').innerHTML = '<ol>' + NAV.map(n => '<li><button type="button" data-nav="' + n.id + '" class="' + (s.view === n.id ? 'active' : '') + '"' + (s.view === n.id ? ' aria-current="page"' : '') + '>' +
      '<span class="nav-l">' + esc(n.label) + '</span><span class="nav-s">' + esc(n.sub(p)) + '</span></button></li>').join('') + '</ol>' +
      '<div class="nav-foot"><span class="mode mode-' + s.settings.aiMode + '">' + ({ api: 'KI: Claude API', manual: 'KI: manuell', off: 'KI aus, nur Vorlagen' })[s.settings.aiMode] + '</span>' +
      '<span class="muted">v' + OTE.VERSION + '</span></div>';
    $('#theme-btn').innerHTML = icon(document.documentElement.getAttribute('data-theme') === 'dark' || (s.settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'sun' : 'moon');
  }

  function render(keepScroll) {
    const y = window.scrollY;
    const p = OTE.project(), v = OTE.state.view;
    renderShell();
    let html = '';
    if (v === 'auftrag') html = V.auftrag(p);
    else if (v === 'katalog') html = V.katalog(p);
    else if (v === 'flug') { if (currentFlight && !p.flights.find(f => f.id === currentFlight)) currentFlight = null; html = V.flugplanung(p, currentFlight); }
    else if (v === 'bewertung') html = V.bewertung(p);
    else html = V.export(p);
    $('#view').innerHTML = html;
    if (keepScroll) window.scrollTo(0, y);
  }
  OTE.render = render;

  function go(view) {
    OTE.state.view = view; currentFlight = null; OTE.save(); render(); window.scrollTo(0, 0);
    const h = $('#view h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  /* ---------- Normalisierung von KI-Ergebnissen ---------- */
  const str = v => v == null ? '' : (Array.isArray(v) ? v.join('\n') : String(v));
  const kat = v => /^s/i.test(String(v || '')) ? 'S' : 'E';
  function normCrit(c) {
    const typ = /moa/i.test(c.typ) ? 'MOA' : 'MOP';
    let sk = String(c.skala || '').toLowerCase().trim();
    if (!OTE.state.scales.find(s => s.id === sk)) {
      const byName = OTE.state.scales.find(s => sk && (s.name.toLowerCase().includes(sk) || s.kurz.toLowerCase() === sk));
      sk = byName ? byName.id : (typ === 'MOP' ? 'messwert' : 'srs');
    }
    return OTE.make.criterion({ typ, text: str(c.text), skala: sk, einheit: str(c.einheit), richtung: String(c.richtung).includes('<') ? '<=' : '>=',
      objective: str(c.objective), threshold: str(c.threshold), methode: OTE.normMethod(str(c.methode)),
      bedingungen: str(c.bedingungen), daten: str(c.daten) });
  }
  function normMeasure(m, coi) {
    let typ = /mos/i.test(m.typ) ? 'MOS' : (/moe/i.test(m.typ) ? 'MOE' : (coi && coi.kategorie === 'S' ? 'MOS' : 'MOE'));
    return OTE.make.measure({ typ, titel: str(m.titel), text: str(m.text), criteria: (m.criteria || m.c || []).map(normCrit) });
  }

  /* ---------- Aktionen ---------- */
  async function guard(fn) {
    try { await fn(); } catch (e) {
      if (e && e.aborted) { toast('Abgebrochen.'); return; }
      console.error(e); toast(e.message || String(e), 'error');
    }
  }

  async function addFiles(files) {
    const p = OTE.project();
    for (const f of files) {
      try {
        toast('Lese ' + f.name + ' …');
        const d = await OTE.extract(f);
        p.docs.push(d);
        if (d.note) toast(d.name + ': ' + d.note, 'error');
      } catch (e) { toast(e.message, 'error'); }
    }
    OTE.save(); render();
  }

  async function analyze(offline) {
    const p = OTE.project();
    if (!p.docs.length) { toast('Bitte zuerst eine Unterlage hinzufügen.', 'error'); return; }
    let res;
    if (offline || !OTE.ai.available()) res = OTE.offline.analyze(p.docs.map(d => d.text).join('\n\n'));
    else res = await OTE.ai.run(OTE.prompts.analyze(p));
    p.analysis = {
      quelle: res.quelle || 'ki', date: Date.now(),
      zusammenfassung: str(res.zusammenfassung), aim: str(res.aim),
      missionen: (res.missionen || []).map(str), hinweise: (res.hinweise || []).map(str),
      cois: (res.cois || []).map(c => ({ kurz: str(c.kurz), frage: str(c.frage), kategorie: kat(c.kategorie), prioritaet: ['hoch', 'mittel', 'niedrig'].includes(c.prioritaet) ? c.prioritaet : 'mittel',
        begruendung: str(c.begruendung), quelle: str(c.quelle), template: c.template }))
    };
    if (!p.aim && p.analysis.aim) p.aim = p.analysis.aim;
    OTE.save(); render();
    toast(p.analysis.cois.length + ' COI vorgeschlagen.');
    const a = $('.analysis'); if (a) a.scrollIntoView({ behavior: 'smooth' });
  }

  async function genMeasures(coi, silent) {
    const p = OTE.project();
    let list;
    if (!OTE.ai.available()) list = OTE.offline.measures(coi);
    else list = (await OTE.ai.run(OTE.prompts.measures(p, coi))).measures || [];
    const ms = list.map(m => normMeasure(m, coi));
    coi.measures.push(...ms); coi.collapsed = false;
    OTE.save(); render(true);
    if (!silent) toast(ms.length + ' Measures mit ' + ms.reduce((n, m) => n + m.criteria.length, 0) + ' Kriterien ergänzt.');
    return ms.length;
  }

  async function genCriteria(measure, coi) {
    const p = OTE.project();
    let crit;
    if (!OTE.ai.available()) {
      const t = OTE.offline.matchTemplate(coi);
      const tm = t && (t.m.find(x => x.titel && measure.titel && x.titel.toLowerCase() === measure.titel.toLowerCase()) || t.m[0]);
      crit = tm ? JSON.parse(JSON.stringify(tm.c)) : OTE.offline.measures(coi)[0].c;
      const have = new Set(measure.criteria.map(k => k.text));
      crit = crit.filter(c => !have.has(c.text));
    } else {
      const r = await OTE.ai.run(OTE.prompts.measures(p, coi, measure));
      crit = ((r.measures && r.measures[0] && r.measures[0].criteria) || r.criteria || []);
    }
    const ks = crit.map(normCrit);
    measure.criteria.push(...ks);
    OTE.save(); render(true);
    toast(ks.length ? ks.length + ' Kriterien ergänzt.' : 'Keine neuen Kriterien gefunden.');
  }

  async function genAll() {
    const p = OTE.project();
    const todo = p.cois.filter(c => !c.measures.length);
    if (!todo.length) { toast('Alle COI haben bereits Measures. Einzelne COI über das Funken-Symbol ergänzen.'); return; }
    if (OTE.ai.mode() === 'manual' && todo.length > 1) {
      if (!await OTE.ui.confirm('Im manuellen Modus wird für jedes der ' + todo.length + ' COI ein eigener Prompt erzeugt. Fortfahren?', 'Fortfahren')) return;
    }
    let n = 0;
    for (const c of todo) { await genMeasures(c, true); n++; }
    toast('Measures für ' + n + ' COI erzeugt.');
  }

  function openEditor(id) {
    const p = OTE.project();
    const f = V.editForm(p, id);
    if (!f) return;
    const d = OTE.ui.drawer(f.title, f.html, {
      obj: f.obj,
      onInput: (key) => {
        if (key === 'skala') {
          const h = $('[data-scale-help]', d.el); if (h) h.innerHTML = V.scaleHelp(OTE.scale(f.obj.skala));
          const s = OTE.scale(f.obj.skala);
          if (s.kind !== 'numeric' && f.obj.typ === 'MOP') { f.obj.typ = 'MOA'; const t = $('[data-bind="typ"]', d.el); if (t) t.value = 'MOA'; }
        }
      },
      onClose: () => render(true)
    });
    // Löschen im Drawer
    const foot = $('.drawer-foot', d.el);
    const del = document.createElement('button');
    del.className = 'btn ghost danger'; del.type = 'button'; del.textContent = 'Löschen';
    del.addEventListener('click', async () => { if (await delNode(id)) d.close(); });
    foot.insertBefore(del, foot.firstChild);
  }

  async function delNode(id) {
    const p = OTE.project(), e = OTE.index(p).byId[id];
    if (!e) return false;
    const n = e.kind === 'coi' ? e.obj.measures.length : e.kind === 'measure' ? e.obj.criteria.length : 0;
    const msg = e.label + ' löschen?' + (n ? ' Darunterliegende Einträge (' + n + ') werden ebenfalls gelöscht.' : '');
    if (!await OTE.ui.confirm(msg, 'Löschen', true)) return false;
    OTE.removeNode(p, id); OTE.save(); render(true); toast(e.label + ' gelöscht.');
    return true;
  }

  /* Flugplanung */
  function nextFlightNr(p) { return p.flights.reduce((n, f) => Math.max(n, parseInt(f.nr, 10) || 0), 0) + 1; }

  async function program() {
    const p = OTE.project(), idx = OTE.index(p);
    const assigned = new Set(); p.flights.forEach(f => f.testpunkte.forEach(t => assigned.add(t)));
    const open = idx.criteria.filter(e => OTE.PLANNABLE.includes(e.obj.methode) && !assigned.has(e.obj.id));
    if (!open.length) { toast('Alle Testpunkte sind bereits eingeplant.'); return; }
    const res = OTE.ai.available() ? await OTE.ai.run(OTE.prompts.program(p, open)) : OTE.offline.program(open);
    const valid = new Set(open.map(e => e.obj.id));
    let n = 0;
    (res.fluege || []).forEach(fl => {
      const tps = (fl.testpunkte || []).filter(t => valid.has(t));
      if (!tps.length) return;
      tps.forEach(t => valid.delete(t));
      const f = OTE.make.flight(nextFlightNr(p));
      Object.assign(f, { titel: str(fl.titel), profil: str(fl.profil) + (fl.begruendung ? '\n' + str(fl.begruendung) : ''), dauer: fl.dauer_min ? String(fl.dauer_min) : '',
        bedingungen: str(fl.bedingungen), beladung: str(fl.konfiguration), muster: p.system, testpunkte: tps });
      p.flights.push(f); n++;
    });
    OTE.save(); render();
    toast(n + ' Flüge angelegt.' + (valid.size ? ' ' + valid.size + ' Testpunkte blieben offen.' : ''));
  }

  async function makeCards(useAI) {
    const p = OTE.project(), f = p.flights.find(x => x.id === currentFlight), idx = OTE.index(p);
    const entries = f.testpunkte.map(t => idx.byId[t]).filter(Boolean);
    if (!entries.length) { toast('Bitte zuerst Testpunkte auswählen.', 'error'); return; }
    const res = useAI && OTE.ai.available() ? await OTE.ai.run(OTE.prompts.cards(p, f, entries)) : OTE.offline.cards(f, entries);
    const ids = new Set(entries.map(e => e.obj.id));
    const fresh = (res.karten || []).filter(k => ids.has(k.ref)).map(k => OTE.make.card({
      ref: k.ref, titel: str(k.titel), testziel: str(k.testziel), tha: str(k.tha), voraussetzungen: str(k.voraussetzungen), ftt: str(k.ftt),
      konfiguration: str(k.konfiguration), flugbedingungen: str(k.flugbedingungen), limits: str(k.limits), daten: str(k.daten), abbruch: str(k.abbruch) }));
    // fehlende Testpunkte aus Vorlage ergänzen
    const covered = new Set(fresh.map(k => k.ref));
    const missing = entries.filter(e => !covered.has(e.obj.id));
    if (missing.length) OTE.offline.cards(f, missing).karten.forEach(k => fresh.push(OTE.make.card(k)));
    const replaced = new Set(fresh.map(k => k.ref));
    f.karten = f.karten.filter(k => !replaced.has(k.ref)).concat(fresh);
    if (res.flugziel) f.flugziel = str(res.flugziel);
    if (res.hinweise) f.hinweise = str(res.hinweise);
    OTE.save(); render(true);
    toast(fresh.length + ' Testkarten erstellt.');
  }

  /* Einstellungen */
  function openSettings() {
    const s = OTE.state.settings;
    const models = OTE.ai.MODELS.map(m => '<option value="' + m.id + '"' + (s.model === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>').join('') +
      (OTE.ai.MODELS.find(m => m.id === s.model) ? '' : '<option value="' + esc(s.model) + '" selected>' + esc(s.model) + '</option>');
    const m = OTE.ui.modal('<div class="modal-head"><h2>Einstellungen</h2><button class="icon-btn" data-close aria-label="Schließen">' + icon('close') + '</button></div>' +
      '<div class="modal-body">' +
      '<fieldset class="radio-cards"><legend class="lbl">KI-Modus</legend>' +
      [['api', 'Claude API direkt', 'Anfragen gehen mit deinem API-Schlüssel aus dem Browser an Anthropic. Schnell und vollautomatisch.'],
        ['manual', 'Manuell', 'Das Tool erzeugt den Prompt, du kopierst ihn in ein freigegebenes KI-Werkzeug und fügst die Antwort ein.'],
        ['off', 'Aus', 'Keine KI. Vorschläge entstehen aus hinterlegten Vorlagen per Stichwortsuche.']]
        .map(o => '<label class="rc"><input type="radio" name="aimode" value="' + o[0] + '"' + (s.aiMode === o[0] ? ' checked' : '') + '><span><b>' + o[1] + '</b><span class="muted">' + o[2] + '</span></span></label>').join('') + '</fieldset>' +
      '<div data-apiblock' + (s.aiMode === 'api' ? '' : ' hidden') + '>' +
      '<div class="fld"><label class="lbl" for="set-key">Anthropic API-Schlüssel</label><input id="set-key" type="password" autocomplete="off" value="' + esc(s.apiKey) + '" placeholder="sk-ant-…">' +
      '<div class="hint">Der Schlüssel bleibt in diesem Browser und wird nur an api.anthropic.com gesendet. Schlüssel gibt es unter console.anthropic.com.</div></div>' +
      '<label class="chk"><input type="checkbox" id="set-session"' + (s.keyInSession ? ' checked' : '') + '><span>Schlüssel nur für diese Sitzung merken (nicht dauerhaft speichern)</span></label>' +
      '<div class="two"><div class="fld"><label class="lbl" for="set-model">Modell</label><select id="set-model">' + models + '</select></div>' +
      '<div class="fld"><label class="lbl" for="set-model-c">oder Modell-ID</label><input id="set-model-c" placeholder="eigene Modell-ID" value=""></div></div>' +
      '<div class="fld"><label class="lbl" for="set-tok">Max. Antwortlänge (Tokens)</label><input id="set-tok" type="number" min="2000" max="64000" step="1000" value="' + s.maxTokens + '"></div>' +
      '<div class="btn-row"><button class="btn sm" type="button" data-test>Verbindung testen</button><span data-testres class="muted"></span></div></div>' +
      '<div class="fld"><label class="lbl" for="set-theme">Darstellung</label><select id="set-theme">' + [['auto', 'wie System'], ['light', 'hell'], ['dark', 'dunkel']].map(o => '<option value="' + o[0] + '"' + (s.theme === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
      '<div class="notice">Verarbeite im KI-Modus nur Unterlagen, die für die Verarbeitung durch externe Dienste freigegeben sind (offen). Eingestufte Inhalte gehören nicht in dieses Tool.</div>' +
      '<details class="danger-zone"><summary>Alle Daten löschen</summary><p class="muted">Löscht alle Projekte und Einstellungen in diesem Browser.</p><button class="btn sm danger" type="button" data-wipe>Alles löschen</button></details>' +
      '</div><div class="modal-foot"><button class="btn primary" data-save>Speichern</button></div>', { onClose: () => render(true) });
    const el = m.el;
    $$('input[name=aimode]', el).forEach(r => r.addEventListener('change', () => { $('[data-apiblock]', el).hidden = r.value !== 'api' || !r.checked; }));
    const collect = () => {
      s.aiMode = ($('input[name=aimode]:checked', el) || {}).value || 'api';
      s.apiKey = $('#set-key', el).value.trim();
      s.keyInSession = $('#set-session', el).checked;
      s.model = $('#set-model-c', el).value.trim() || $('#set-model', el).value;
      s.maxTokens = Math.max(2000, Math.min(64000, parseInt($('#set-tok', el).value, 10) || 16000));
      s.theme = $('#set-theme', el).value;
      applyTheme(); OTE.saveNow();
    };
    $('[data-test]', el).addEventListener('click', async () => {
      collect();
      const out = $('[data-testres]', el); out.textContent = 'Teste …';
      try { await OTE.ai.test(); out.textContent = 'Verbindung erfolgreich.'; out.className = 'ok-text'; } catch (e) { out.textContent = e.message; out.className = 'err-text'; }
    });
    $('[data-save]', el).addEventListener('click', () => { collect(); m.close(); toast('Einstellungen gespeichert.'); });
    $('[data-wipe]', el).addEventListener('click', async () => {
      if (!await OTE.ui.confirm('Wirklich alle Projekte und Einstellungen in diesem Browser löschen? Das kann nicht rückgängig gemacht werden.', 'Alles löschen', true)) return;
      localStorage.removeItem('ote-planer'); try { sessionStorage.clear(); } catch (e) { /* ignore */ }
      location.reload();
    });
  }

  function editScales() {
    const m = OTE.ui.modal('<div class="modal-head"><h2>Bewertungsskalen bearbeiten</h2><button class="icon-btn" data-close aria-label="Schließen">' + icon('close') + '</button></div>' +
      '<div class="modal-body"><p class="muted">Skalen als JSON. Felder: id, name, kurz, kind (numeric, ordinal, binary), better (low oder high), min, max, info, levels mit v, label, desc. Die id einer verwendeten Skala nicht ändern.</p>' +
      '<textarea class="mono" rows="18" data-json>' + esc(JSON.stringify(OTE.state.scales, null, 2)) + '</textarea></div>' +
      '<div class="modal-foot"><button class="btn ghost" data-reset>Standard wiederherstellen</button><button class="btn" data-close>Abbrechen</button><button class="btn primary" data-save>Übernehmen</button></div>', { wide: true, onClose: () => render(true) });
    $('[data-save]', m.el).addEventListener('click', () => {
      try {
        const arr = JSON.parse($('[data-json]', m.el).value);
        if (!Array.isArray(arr) || !arr.every(s => s.id && s.name && s.kind)) throw new Error('Jede Skala braucht id, name und kind.');
        arr.forEach(s => { s.kurz = s.kurz || s.name; s.levels = s.levels || []; s.better = s.better || 'low'; });
        if (!arr.find(s => s.id === 'messwert')) throw new Error('Die Skala "messwert" wird benötigt.');
        OTE.state.scales = arr; OTE.saveNow(); m.close(); toast('Skalen übernommen.');
      } catch (e) { toast('Ungültig: ' + e.message, 'error'); }
    });
    $('[data-reset]', m.el).addEventListener('click', () => { $('[data-json]', m.el).value = JSON.stringify(OTE.DEFAULT_SCALES, null, 2); });
  }

  function textModal(title, name, text, onSave) {
    const m = OTE.ui.modal('<div class="modal-head"><h2>' + esc(title) + '</h2><button class="icon-btn" data-close aria-label="Schließen">' + icon('close') + '</button></div>' +
      '<div class="modal-body"><div class="fld"><label class="lbl" for="tm-name">Bezeichnung</label><input id="tm-name" value="' + esc(name) + '"></div>' +
      '<div class="fld"><label class="lbl" for="tm-text">Text</label><textarea id="tm-text" rows="16">' + esc(text) + '</textarea></div></div>' +
      '<div class="modal-foot"><button class="btn" data-close>Abbrechen</button><button class="btn primary" data-save>Speichern</button></div>', { wide: true });
    $('[data-save]', m.el).addEventListener('click', () => {
      const t = $('#tm-text', m.el).value;
      if (!t.trim()) { toast('Der Text ist leer.', 'error'); return; }
      onSave($('#tm-name', m.el).value.trim() || 'Eingefügter Text', t); m.close(); render(true);
    });
  }

  /* ---------- Ereignisse ---------- */
  const ACT = {
    goto: id => go(id),
    // Auftrag
    'doc-paste': () => textModal('Text einfügen', 'Auftrag', '', (n, t) => { OTE.project().docs.push({ id: OTE.uid(), name: n, type: 'txt', text: t, chars: t.length }); OTE.save(); }),
    'doc-view': id => { const d = OTE.project().docs.find(x => x.id === id); textModal('Unterlage bearbeiten', d.name, d.text, (n, t) => { d.name = n; d.text = t; d.chars = t.length; OTE.save(); }); },
    'doc-del': async id => { const p = OTE.project(); const d = p.docs.find(x => x.id === id); if (await OTE.ui.confirm(d.name + ' entfernen?', 'Entfernen', true)) { p.docs = p.docs.filter(x => x.id !== id); delete OTE.mem.pdf[id]; OTE.save(); render(true); } },
    analyze: () => guard(() => analyze(false)),
    'analyze-offline': () => guard(() => analyze(true)),
    'aim-take': () => { const p = OTE.project(); p.aim = p.analysis.aim; OTE.save(); render(true); },
    'prop-all': () => { OTE.project().analysis.cois.forEach(c => { c._sel = true; }); render(true); },
    'prop-none': () => { OTE.project().analysis.cois.forEach(c => { c._sel = false; }); render(true); },
    'prop-adopt': () => {
      const p = OTE.project(); let n = 0;
      const have = new Set(p.cois.map(c => c.frage.trim()));
      $$('[data-prop]').forEach(cb => {
        const c = p.analysis.cois[+cb.dataset.prop];
        if (cb.checked && !cb.disabled && !have.has(c.frage.trim())) {
          p.cois.push(OTE.make.coi({ kurz: c.kurz, frage: c.frage, kategorie: c.kategorie, prioritaet: c.prioritaet, begruendung: c.begruendung, quelle: c.quelle, template: c.template })); n++;
        }
      });
      if (!n) { toast('Keine neuen COI ausgewählt.', 'error'); return; }
      OTE.save(); toast(n + ' COI übernommen.'); go('katalog');
    },
    // Katalog
    'add-coi': () => { const p = OTE.project(); const c = OTE.make.coi({ frage: '' }); p.cois.push(c); OTE.save(); if (OTE.state.view !== 'katalog') go('katalog'); else render(true); openEditor(c.id); },
    'gen-all': () => guard(genAll),
    'expand-all': () => { OTE.project().cois.forEach(c => { c.collapsed = false; }); OTE.save(); render(true); },
    'collapse-all': () => { OTE.project().cois.forEach(c => { c.collapsed = true; }); OTE.save(); render(true); },
    toggle: id => { const c = OTE.project().cois.find(x => x.id === id); c.collapsed = !c.collapsed; OTE.save(); render(true); },
    edit: id => openEditor(id),
    up: id => { OTE.moveNode(OTE.project(), id, -1); OTE.save(); render(true); },
    down: id => { OTE.moveNode(OTE.project(), id, 1); OTE.save(); render(true); },
    del: id => delNode(id),
    'gen-meas': id => guard(() => genMeasures(OTE.project().cois.find(c => c.id === id))),
    'add-meas': id => { const c = OTE.project().cois.find(x => x.id === id); const m = OTE.make.measure({ typ: c.kategorie === 'S' ? 'MOS' : 'MOE' }); c.measures.push(m); c.collapsed = false; OTE.save(); render(true); openEditor(m.id); },
    'gen-crit': id => guard(() => { const r = OTE.findParent(OTE.project(), id); return genCriteria(r.item, r.coi); }),
    'add-crit': id => { const r = OTE.findParent(OTE.project(), id); const k = OTE.make.criterion({ typ: 'MOA', skala: 'srs', objective: '2', threshold: '3' }); r.item.criteria.push(k); OTE.save(); render(true); openEditor(k.id); },
    // Flüge
    'flight-add': () => { const p = OTE.project(); const f = OTE.make.flight(nextFlightNr(p)); f.muster = p.system; p.flights.push(f); currentFlight = f.id; OTE.save(); render(); window.scrollTo(0, 0); },
    'flight-open': id => { currentFlight = id; render(); window.scrollTo(0, 0); },
    'flight-back': () => { currentFlight = null; render(); },
    'flight-up': id => { const l = OTE.project().flights, i = l.findIndex(f => f.id === id); if (i > 0) { l.splice(i - 1, 0, l.splice(i, 1)[0]); OTE.save(); render(true); } },
    'flight-down': id => { const l = OTE.project().flights, i = l.findIndex(f => f.id === id); if (i < l.length - 1) { l.splice(i + 1, 0, l.splice(i, 1)[0]); OTE.save(); render(true); } },
    'flight-del': async id => { const p = OTE.project(), f = p.flights.find(x => x.id === id); if (await OTE.ui.confirm('Flug ' + f.nr + ' mit ' + f.karten.length + ' Testkarten löschen?', 'Löschen', true)) { p.flights = p.flights.filter(x => x.id !== id); OTE.save(); render(true); } },
    program: () => guard(program),
    'cards-ai': () => guard(() => makeCards(true)),
    'cards-tpl': () => guard(() => makeCards(false)),
    'card-up': id => { const f = OTE.project().flights.find(x => x.id === currentFlight), l = f.karten, i = l.findIndex(k => k.id === id); if (i > 0) { l.splice(i - 1, 0, l.splice(i, 1)[0]); OTE.save(); render(true); } },
    'card-down': id => { const f = OTE.project().flights.find(x => x.id === currentFlight), l = f.karten, i = l.findIndex(k => k.id === id); if (i < l.length - 1) { l.splice(i + 1, 0, l.splice(i, 1)[0]); OTE.save(); render(true); } },
    'card-del': async id => { const f = OTE.project().flights.find(x => x.id === currentFlight); if (await OTE.ui.confirm('Testkarte löschen?', 'Löschen', true)) { f.karten = f.karten.filter(k => k.id !== id); OTE.save(); render(true); } },
    'print-cards': () => { const p = OTE.project(); OTE.printCards(p, [p.flights.find(x => x.id === currentFlight)]); },
    // Export
    'export-json': () => { const p = OTE.project(); OTE.ui.download(OTE.ui.slug(p.name) + '_' + new Date().toISOString().slice(0, 10) + '.json', OTE.exportProject(p), 'application/json'); toast('Projekt gesichert.'); },
    'import-json': () => $('#import-in').click(),
    'project-dup': () => { const p = OTE.project(); const c = OTE.normalizeProject(JSON.parse(JSON.stringify(p))); c.id = OTE.uid(); c.name = p.name + ' (Kopie)'; OTE.state.projects.push(c); OTE.state.activeProjectId = c.id; OTE.save(); render(); toast('Projekt dupliziert.'); },
    'project-del': async () => {
      const s = OTE.state, p = OTE.project();
      if (!await OTE.ui.confirm('Projekt „' + p.name + '“ endgültig löschen? Vorher als Datei sichern, falls es noch gebraucht wird.', 'Projekt löschen', true)) return;
      s.projects = s.projects.filter(x => x.id !== p.id);
      if (!s.projects.length) s.projects.push(OTE.make.project('Neues Projekt'));
      s.activeProjectId = s.projects[0].id; OTE.save(); go('auftrag');
    },
    'print-plan': () => { const p = OTE.project(); if (!p.cois.length) return toast('Der Katalog ist leer.', 'error'); OTE.printPlan(p, false); },
    'print-eval': () => { const p = OTE.project(); if (!p.cois.length) return toast('Der Katalog ist leer.', 'error'); OTE.printPlan(p, true); },
    'export-csv': () => { const p = OTE.project(); if (!p.cois.length) return toast('Der Katalog ist leer.', 'error'); OTE.exportCSV(p); },
    'print-allcards': () => { const p = OTE.project(); OTE.printCards(p, p.flights); },
    'review-ai': () => guard(async () => {
      const p = OTE.project(); const r = await OTE.ai.run(OTE.prompts.review(p));
      p.review = { date: Date.now(), gesamt: str(r.gesamt), punkte: (r.punkte || []).map(x => ({ liste: /moe|moa/i.test(x.liste) ? 'moe' : 'coi', nr: +x.nr, bewertung: str(x.bewertung).toLowerCase(), kommentar: str(x.kommentar) })), vorschlaege: (r.vorschlaege || []).map(str) };
      OTE.save(); render(true); toast('Prüfung abgeschlossen.');
    }),
    'scales-edit': () => editScales()
  };

  function bindEvents() {
    document.addEventListener('click', e => {
      const nav = e.target.closest('[data-nav]');
      if (nav) { go(nav.dataset.nav); return; }
      const b = e.target.closest('[data-act]');
      if (b && !b.disabled && ACT[b.dataset.act]) { e.preventDefault(); ACT[b.dataset.act](b.dataset.id); }
    });
    $('#proj-select').addEventListener('change', e => {
      const v = e.target.value;
      if (v === '__new') { const p = OTE.make.project('Neues Projekt'); OTE.state.projects.push(p); OTE.state.activeProjectId = p.id; OTE.save(); go('auftrag'); setTimeout(() => { const i = $('#p-name'); if (i) { i.focus(); i.select(); } }, 50); return; }
      OTE.state.activeProjectId = v; currentFlight = null; OTE.save(); render();
    });
    $('#settings-btn').addEventListener('click', openSettings);
    $('#theme-btn').addEventListener('click', () => {
      const s = OTE.state.settings;
      const dark = document.documentElement.getAttribute('data-theme') === 'dark' || (s.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
      s.theme = dark ? 'light' : 'dark'; applyTheme(); OTE.save(); renderShell();
    });

    document.addEventListener('input', e => {
      const t = e.target, p = OTE.project();
      if (t.dataset.pbind) { p[t.dataset.pbind] = t.value; OTE.save(); if (t.dataset.pbind === 'name') renderShell(); return; }
      if (t.dataset.fbind) { const f = p.flights.find(x => x.id === currentFlight); f[t.dataset.fbind] = t.value; OTE.save(); return; }
      if (t.dataset.cbind) { const f = p.flights.find(x => x.id === currentFlight); const k = f.karten.find(x => x.id === t.dataset.card); k[t.dataset.cbind] = t.value; OTE.save(); return; }
      if (t.dataset.kbind && t.tagName === 'INPUT') { updateCrit(t); return; }
      if (t.dataset.cobind && t.tagName === 'TEXTAREA') { const c = p.cois.find(x => x.id === t.dataset.id); c[t.dataset.cobind] = t.value; OTE.save(); }
    });
    document.addEventListener('change', e => {
      const t = e.target, p = OTE.project();
      if (t.id === 'file-in') { addFiles(Array.from(t.files)); t.value = ''; return; }
      if (t.id === 'import-in') {
        const f = t.files[0]; t.value = '';
        if (!f) return;
        f.text().then(txt => {
          try { const added = OTE.importData(txt); OTE.state.activeProjectId = added[0].id; OTE.save(); go('auftrag'); toast(added.length + ' Projekt(e) geladen.'); }
          catch (err) { toast('Laden fehlgeschlagen: ' + err.message, 'error'); }
        });
        return;
      }
      if (t.dataset.prop !== undefined) { p.analysis.cois[+t.dataset.prop]._sel = t.checked; return; }
      if (t.dataset.tp) {
        const f = p.flights.find(x => x.id === currentFlight);
        if (t.checked) { if (!f.testpunkte.includes(t.dataset.tp)) f.testpunkte.push(t.dataset.tp); }
        else f.testpunkte = f.testpunkte.filter(x => x !== t.dataset.tp);
        OTE.save(); renderShell();
        const c = $('.panel h2 .count'); if (c) c.textContent = f.testpunkte.length;
        $$('[data-act="cards-ai"],[data-act="cards-tpl"]').forEach(b => { b.disabled = !f.testpunkte.length; });
        return;
      }
      if (t.dataset.fbind && t.tagName === 'SELECT') { const f = p.flights.find(x => x.id === currentFlight); f[t.dataset.fbind] = t.value; OTE.save(); return; }
      if (t.dataset.kbind && t.tagName === 'SELECT') { updateCrit(t); return; }
      if (t.dataset.cobind && t.tagName === 'SELECT') { const c = p.cois.find(x => x.id === t.dataset.id); c[t.dataset.cobind] = t.value; OTE.save(); return; }
      if (t.dataset.check) { p.checklist[t.dataset.check][t.dataset.i] = t.checked; OTE.save(); }
    });

    // Drag & Drop
    document.addEventListener('dragover', e => { const d = e.target.closest && e.target.closest('[data-drop]'); if (d) { e.preventDefault(); d.classList.add('over'); } });
    document.addEventListener('dragleave', e => { const d = e.target.closest && e.target.closest('[data-drop]'); if (d) d.classList.remove('over'); });
    document.addEventListener('drop', e => {
      const d = e.target.closest && e.target.closest('[data-drop]');
      if (!d) return;
      e.preventDefault(); d.classList.remove('over');
      if (e.dataTransfer.files.length) addFiles(Array.from(e.dataTransfer.files));
    });
    document.addEventListener('keydown', e => {
      const d = e.target.closest && e.target.closest('[data-drop]');
      if (d && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); $('#file-in').click(); }
    });
    window.addEventListener('beforeunload', () => OTE.saveNow());
  }

  function updateCrit(t) {
    const p = OTE.project(), r = OTE.findParent(p, t.dataset.id);
    if (!r) return;
    r.item[t.dataset.kbind] = t.value; OTE.save();
    const st = $('[data-st="' + r.item.id + '"]'); if (st) st.innerHTML = V.chipStatus(OTE.evalCriterion(r.item));
    const ms = $('[data-mst="' + r.measure.id + '"]'); if (ms) ms.innerHTML = V.chipStatus(OTE.rollup(r.measure.criteria).status);
    const all = []; r.coi.measures.forEach(m => all.push(...m.criteria));
    const cs = $('[data-cst="' + r.coi.id + '"]'); if (cs) cs.innerHTML = V.chipStatus(OTE.rollup(all).status);
    renderShell();
  }

  /* ---------- Start ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    OTE.load();
    applyTheme();
    bindEvents();
    render();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => renderShell());
    if (OTE.state.settings.aiMode === 'api' && !OTE.state.settings.apiKey && !localStorage.getItem('ote-planer.seen')) {
      localStorage.setItem('ote-planer.seen', '1');
      setTimeout(() => toast('Tipp: Unter Einstellungen den KI-Modus wählen und ggf. einen API-Schlüssel eintragen.'), 600);
    }
  });
})();
