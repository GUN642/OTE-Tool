/* OT&E Planer: Datenhaltung, Migration, Nummerierung, Bewertung */
(function () {
  'use strict';
  const OTE = (window.OTE = window.OTE || {});

  const STORAGE_KEY = 'ote-planer';
  const SESSION_KEY = 'ote-planer.apikey';
  OTE.SCHEMA = 1;
  OTE.VERSION = '1.0.1';

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  OTE.uid = uid;

  /* ---------- Fabriken ---------- */
  OTE.make = {
    project(name) {
      return {
        id: uid(), name: name || 'Neues Projekt', system: '', kampagne: '', rahmen: '', aim: '',
        created: Date.now(), updated: Date.now(),
        docs: [], analysis: null, cois: [], flights: [],
        checklist: { coi: {}, moe: {} }, review: null
      };
    },
    coi(o = {}) {
      return Object.assign({ id: uid(), kurz: '', frage: '', kategorie: 'E', begruendung: '', quelle: '',
        prioritaet: 'mittel', antwort: 'offen', antwortText: '', collapsed: false, measures: [] }, o);
    },
    measure(o = {}) {
      return Object.assign({ id: uid(), typ: 'MOE', titel: '', text: '', notiz: '', criteria: [] }, o);
    },
    criterion(o = {}) {
      return Object.assign({ id: uid(), typ: 'MOP', text: '', skala: 'messwert', einheit: '', richtung: '>=',
        objective: '', threshold: '', methode: 'Flugversuch', daten: '', bedingungen: '',
        ergebnis: '', impact: '', empfehlung: '', bemerkung: '' }, o);
    },
    flight(nr) {
      return { id: uid(), nr: nr || 1, titel: '', datum: '', muster: '', kennung: '', callsign: '', crew: '',
        beobachter: '', testgebiet: '', software: '', hardware: '', masse: '', sensoren: '', beladung: '',
        dauer: '', profil: '', bedingungen: '', status: 'geplant', testpunkte: [], karten: [], notizen: '',
        qnh: '', oat: '', wind: '', start: '', ende: '', startort: '', phase: '', erfolg: '', bemerkung: '' };
    },
    card(o = {}) {
      return Object.assign({ id: uid(), ref: '', titel: '', testziel: '', tha: '', voraussetzungen: '', ftt: '',
        konfiguration: '', flugbedingungen: '', limits: '', daten: '', abbruch: '', ergebnis: '', bemerkung: '' }, o);
    }
  };

  /* ---------- Zustand ---------- */
  function defaultState() {
    return {
      schema: OTE.SCHEMA,
      activeProjectId: null,
      view: 'auftrag',
      projects: [],
      scales: JSON.parse(JSON.stringify(OTE.DEFAULT_SCALES)),
      settings: { theme: 'auto', aiMode: 'api', apiKey: '', keyInSession: false,
        model: 'claude-sonnet-5-5', maxTokens: 16000 }
    };
  }

  function migrate(s) {
    if (!s || typeof s !== 'object') return defaultState();
    const d = defaultState();
    s.schema = s.schema || 1;
    // künftige Migrationen: if (s.schema < 2) {...}
    s.settings = Object.assign(d.settings, s.settings || {});
    s.scales = Array.isArray(s.scales) && s.scales.length ? s.scales : d.scales;
    // fehlende Standardskalen ergänzen, eigene behalten
    d.scales.forEach(ds => { if (!s.scales.find(x => x.id === ds.id)) s.scales.push(ds); });
    s.projects = (s.projects || []).map(normalizeProject);
    s.view = s.view || 'auftrag';
    return s;
  }

  function normalizeProject(p) {
    const base = OTE.make.project(p.name);
    p = Object.assign(base, p);
    p.cois = (p.cois || []).map(c => {
      c = OTE.make.coi(c);
      c.measures = (c.measures || []).map(m => {
        m = OTE.make.measure(m);
        m.criteria = (m.criteria || []).map(k => { k = OTE.make.criterion(k); k.methode = OTE.normMethod(k.methode); return k; });
        return m;
      });
      return c;
    });
    p.flights = (p.flights || []).map(f => {
      f = Object.assign(OTE.make.flight(f.nr), f);
      f.karten = (f.karten || []).map(k => OTE.make.card(k));
      f.testpunkte = f.testpunkte || [];
      return f;
    });
    p.checklist = Object.assign({ coi: {}, moe: {} }, p.checklist || {});
    p.docs = p.docs || [];
    return p;
  }
  OTE.normalizeProject = normalizeProject;

  OTE.load = function () {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { s = null; }
    OTE.state = migrate(s);
    try {
      const k = sessionStorage.getItem(SESSION_KEY);
      if (k && OTE.state.settings.keyInSession) OTE.state.settings.apiKey = k;
    } catch (e) { /* ignore */ }
    if (!OTE.state.projects.length) {
      const p = OTE.make.project('Erstes Projekt');
      OTE.state.projects.push(p);
      OTE.state.activeProjectId = p.id;
    }
    if (!OTE.project()) OTE.state.activeProjectId = OTE.state.projects[0].id;
    return OTE.state;
  };

  let saveTimer = null;
  OTE.saveNow = function () {
    const s = OTE.state;
    const copy = Object.assign({}, s, { settings: Object.assign({}, s.settings) });
    if (s.settings.keyInSession) {
      try { sessionStorage.setItem(SESSION_KEY, s.settings.apiKey || ''); } catch (e) { /* ignore */ }
      copy.settings.apiKey = '';
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
      OTE.saveError = null;
    } catch (e) {
      OTE.saveError = 'Speichern im Browser fehlgeschlagen (Speicher voll?). Bitte Projekt als Datei sichern.';
      if (OTE.ui && OTE.ui.toast) OTE.ui.toast(OTE.saveError, 'error');
    }
  };
  OTE.save = function () {
    const p = OTE.project();
    if (p) p.updated = Date.now();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(OTE.saveNow, 250);
  };

  OTE.project = () => OTE.state.projects.find(p => p.id === OTE.state.activeProjectId);

  /* ---------- Baum-Helfer ---------- */
  // liefert flache Liste mit Nummern
  OTE.index = function (p) {
    p = p || OTE.project();
    const out = { byId: {}, criteria: [], measures: [] };
    (p.cois || []).forEach((c, i) => {
      const cn = String(i + 1);
      out.byId[c.id] = { kind: 'coi', obj: c, nr: cn, label: 'COI ' + cn };
      c.measures.forEach((m, j) => {
        const mn = cn + '.' + (j + 1);
        const e = { kind: 'measure', obj: m, nr: mn, label: m.typ + ' ' + mn, coi: c };
        out.byId[m.id] = e; out.measures.push(e);
        m.criteria.forEach((k, l) => {
          const kn = mn + '.' + (l + 1);
          const ce = { kind: 'criterion', obj: k, nr: kn, label: k.typ + ' ' + kn, coi: c, measure: m };
          out.byId[k.id] = ce; out.criteria.push(ce);
        });
      });
    });
    return out;
  };

  OTE.findParent = function (p, id) {
    for (const c of p.cois) {
      if (c.id === id) return { list: p.cois, item: c };
      for (const m of c.measures) {
        if (m.id === id) return { list: c.measures, item: m, coi: c };
        for (const k of m.criteria) if (k.id === id) return { list: m.criteria, item: k, coi: c, measure: m };
      }
    }
    return null;
  };

  OTE.removeNode = function (p, id) {
    const r = OTE.findParent(p, id);
    if (!r) return;
    r.list.splice(r.list.indexOf(r.item), 1);
    // Testpunkt-Zuordnungen bereinigen
    const ids = new Set([id]);
    if (r.item.measures) r.item.measures.forEach(m => { ids.add(m.id); m.criteria.forEach(k => ids.add(k.id)); });
    if (r.item.criteria) r.item.criteria.forEach(k => ids.add(k.id));
    p.flights.forEach(f => { f.testpunkte = f.testpunkte.filter(t => !ids.has(t)); });
  };

  OTE.moveNode = function (p, id, dir) {
    const r = OTE.findParent(p, id);
    if (!r) return;
    const i = r.list.indexOf(r.item), j = i + dir;
    if (j < 0 || j >= r.list.length) return;
    r.list.splice(i, 1); r.list.splice(j, 0, r.item);
  };

  /* ---------- Skalen & Bewertung ---------- */
  OTE.scale = id => OTE.state.scales.find(s => s.id === id) || OTE.state.scales.find(s => s.id === 'messwert');

  function num(v) {
    if (v === null || v === undefined) return NaN;
    const m = String(v).replace(',', '.').match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : NaN;
  }
  OTE.num = num;

  // Ergebnis: 'offen' | 'obj' | 'thr' | 'fail' | 'na'
  OTE.evalCriterion = function (k) {
    const r = String(k.ergebnis == null ? '' : k.ergebnis).trim();
    if (!r) return 'offen';
    if (r === OTE.NP) return 'na';
    const s = OTE.scale(k.skala);
    if (s.kind === 'binary') {
      const yes = /^(ja|yes|j|y|1|true|erfüllt)$/i.test(r);
      return yes ? 'obj' : 'fail';
    }
    const v = num(r), o = num(k.objective), t = num(k.threshold);
    if (isNaN(v)) return 'na';
    let better = s.better;
    if (s.kind === 'numeric') better = k.richtung === '<=' ? 'low' : 'high';
    const ok = (val, lim) => isNaN(lim) ? null : (better === 'low' ? val <= lim : val >= lim);
    if (ok(v, o) === true) return 'obj';
    const th = ok(v, t);
    if (th === true) return 'thr';
    if (th === false) return 'fail';
    if (ok(v, o) === false) return 'thr';
    return 'na';
  };

  const RANK = { fail: 4, na: 2, thr: 1, obj: 0 };
  OTE.rollup = function (criteria) {
    const st = criteria.map(OTE.evalCriterion);
    const done = st.filter(s => s !== 'offen');
    if (!criteria.length) return { status: 'leer', done: 0, total: 0 };
    let worst = null;
    done.forEach(s => { if (worst === null || RANK[s] > RANK[worst]) worst = s; });
    return { status: done.length === 0 ? 'offen' : worst, done: done.length, total: criteria.length };
  };

  OTE.STATUS_TEXT = {
    offen: 'offen', obj: 'erfüllt', thr: 'eingeschränkt erfüllt', fail: 'nicht erfüllt',
    na: 'nicht prüfbar', leer: 'keine Kriterien'
  };
  OTE.NP = 'n. p.'; // Ergebniswert "nicht prüfbar"

  /* ---------- Standardskalen ----------
     Quelle: EFT OT&E Guide V2.0, Kap. V "Rating Scales". Wortlaut im englischen Original.
     Stufen aufsteigend nach Wert, better gibt an, welche Richtung besser ist. */
  const lv = arr => arr.map(a => ({ v: a[0], label: a[1], desc: a[2] || '' }));
  OTE.DEFAULT_SCALES = [
    { id: 'messwert', name: 'Messwert (quantitativ)', kurz: 'Messwert', kind: 'numeric', better: 'high', levels: [],
      info: 'Für MOP. Einheit und Richtung (≥ / ≤) am Kriterium festlegen.' },
    { id: 'janein', name: 'Ja / Nein', kurz: 'JN', kind: 'binary', better: 'high', levels: lv([['Ja', 'Ja', 'Erfüllt'], ['Nein', 'Nein', 'Nicht erfüllt']]),
      info: 'Einfache Erfüllung oder Nichterfüllung ohne Abstufung.' },
    { id: 'srs', name: 'Subjective Rating Scale (SRS)', kurz: 'SRS', kind: 'ordinal', better: 'low', min: 1, max: 6,
      info: 'Operative Bewertungen. EFT OT&E Guide V2.0, S. 21.',
      levels: lv([[1, 'Very satisfactory', 'Meets or exceeds all mission requirements.'],
        [2, 'Satisfactory', 'Meets all mission requirements.'],
        [3, 'Marginally satisfactory', 'Meets most mission requirements.'],
        [4, 'Marginally unsatisfactory', 'Minor deficiencies. Some mission restrictions.'],
        [5, 'Unsatisfactory', 'Major deficiencies. Seriously degrades mission.'],
        [6, 'Very unsatisfactory', 'Major deficiencies. Unsafe or unusable.']]) },
    { id: 'bedford', name: 'Bedford Rating Scale (BRS)', kurz: 'BRS', kind: 'ordinal', better: 'low', min: 1, max: 10,
      info: 'Subjektive Workload-Bewertung. EFT OT&E Guide V2.0, S. 22.',
      levels: lv([[1, 'Workload insignificant', ''], [2, 'Workload low', ''],
        [3, 'Enough spare capacity', 'Enough spare capacity for all desirable additional tasks.'],
        [4, 'Insufficient spare capacity', 'Insufficient spare capacity for easy attention to additional tasks.'],
        [5, 'Reduced spare capacity', 'Additional tasks cannot be given the desired amount of attention.'],
        [6, 'Little spare capacity', 'Level of effort allows little attention to additional tasks.'],
        [7, 'Very little spare capacity', 'Maintenance of effort in the primary task not in question.'],
        [8, 'Very high workload', 'Almost no spare capacity. Difficulty in maintaining level of effort.'],
        [9, 'Extremely high workload', 'No spare capacity. Serious doubts as to ability to maintain level of effort.'],
        [10, 'Task abandoned', 'Pilot unable to apply sufficient effort.']]) },
    { id: 'tlx', name: 'NASA TLX Rating Scale', kurz: 'TLX', kind: 'ordinal', better: 'low', min: 0, max: 100, levels: [],
      info: 'Subjektive Workload-Bewertung. Gewichteter Gesamtindex aus Mental, Physical, Temporal Demand, Performance, Effort, Frustration (0 bis 100).' },
    { id: 'hqr', name: 'Cooper-Harper Rating Scale (CHR)', kurz: 'CHR', kind: 'ordinal', better: 'low', min: 1, max: 10,
      info: 'System-Handling-Qualitäten. Level 1 = 1 bis 3, Level 2 = 4 bis 6, Level 3 = 7 bis 9.',
      levels: lv([[1, 'Excellent, highly desirable', 'Pilot compensation not a factor for desired performance.'],
        [2, 'Good, negligible deficiencies', 'Pilot compensation not a factor for desired performance.'],
        [3, 'Fair, some mildly unpleasant deficiencies', 'Minimal pilot compensation required for desired performance.'],
        [4, 'Minor but annoying deficiencies', 'Desired performance requires moderate pilot compensation.'],
        [5, 'Moderately objectionable deficiencies', 'Adequate performance requires considerable pilot compensation.'],
        [6, 'Very objectionable but tolerable deficiencies', 'Adequate performance requires extensive pilot compensation.'],
        [7, 'Major deficiencies', 'Adequate performance not attainable with maximum tolerable pilot compensation. Controllability not in question.'],
        [8, 'Major deficiencies', 'Considerable pilot compensation is required for control.'],
        [9, 'Major deficiencies', 'Intense pilot compensation is required to retain control.'],
        [10, 'Major deficiencies', 'Control will be lost during some portion of required operation.']]) },
    { id: 'drs', name: 'Display Rating Scale (DRS)', kurz: 'DRS', kind: 'ordinal', better: 'low', min: 1, max: 10,
      info: 'Anzeigeprüfung. EFT OT&E Guide V2.0, S. 23.',
      levels: lv([[1, 'Excellent, highly desirable', 'Pilot compensation is not a factor for desired performance.'],
        [2, 'Good, negligible deficiencies', 'Pilot compensation is not a factor for desired performance.'],
        [3, 'Fair, some mildly unpleasant deficiencies', 'Minimal pilot compensation required for desired performance.'],
        [4, 'Minor but annoying deficiencies', 'Desired performance requires moderate pilot compensation.'],
        [5, 'Moderately objectionable deficiencies', 'Adequate performance requires moderate pilot compensation.'],
        [6, 'Very objectionable, tolerable deficiencies', 'Adequate performance requires extensive pilot compensation.'],
        [7, 'Major deficiencies', 'Adequate performance not attainable with maximum tolerable pilot workload. Readability not in question.'],
        [8, 'Major deficiencies', 'Considerable pilot compensation is required to interpret symbology.'],
        [9, 'Major deficiencies', 'Intense pilot compensation is required to interpret symbology.'],
        [10, 'Major deficiencies', 'Symbology cannot be used for required operation.']]) },
    { id: 'sfr', name: 'Simulation Fidelity Rating Scale (SFR)', kurz: 'SFR', kind: 'ordinal', better: 'low', min: 1, max: 10,
      info: 'Prüfung der Simulation. EFT OT&E Guide V2.0, S. 24.',
      levels: lv([[1, 'Fit for purpose', 'Negligible adaptation of task strategy required for equivalent performance. (Fidelity Level 1)'],
        [2, 'Fit for purpose', 'Minimal adaptation of task strategy required for equivalent performance. (Fidelity Level 1)'],
        [3, 'Fidelity warrants improvement', 'Similar performance attainable with minimal adaptation of task strategy. (Fidelity Level 2)'],
        [4, 'Fidelity warrants improvement', 'Equivalent performance attainable with moderate adaptation of task strategy. (Fidelity Level 2)'],
        [5, 'Fidelity warrants improvement', 'Similar performance attainable with moderate adaptation of task strategy. (Fidelity Level 2)'],
        [6, 'Fidelity warrants improvement', 'Similar or equivalent performance attainable with considerable adaptation of task strategy. (Fidelity Level 2)'],
        [7, 'Not fit for purpose', 'Similar or equivalent performance attainable but excessive adaptation of task strategy required. (Fidelity Level 3)'],
        [8, 'Not fit for purpose', 'Similar performance not attainable with considerable or less adaptation of task strategy. (Fidelity Level 3)'],
        [9, 'Not fit for purpose', 'Similar performance not attainable with excessive adaptation of task strategy. (Fidelity Level 3)'],
        [10, 'Not fit for purpose', 'An entirely inappropriate task strategy is required, or similar performance is not attainable. (Fidelity Level 4)']]) }
  ];

  /* Impact-Entscheidungsbaum (Report) */
  OTE.IMPACT = [
    { id: 'unacceptable', label: 'Unacceptable', kat: 'Deficiency', rec: 'Essential', verb: 'muss',
      desc: 'Verhindert die Erfüllung der Einsatzaufgabe oder führt wahrscheinlich zu Unfällen. Notwendige Einschränkungen sind nicht tolerierbar.' },
    { id: 'unsat-hd', label: 'Unsatisfactory', kat: 'Shortcoming', rec: 'Highly desirable', verb: 'sollte',
      desc: 'Schränkt die Einsatzleistung deutlich ein oder gefährdet die Sicherheit, sofern nicht erhebliche Kompensation oder Einschränkungen erfolgen.' },
    { id: 'unsat-d', label: 'Unsatisfactory', kat: 'Shortcoming', rec: 'Desirable', verb: 'sollte',
      desc: 'Behindert zeitweise die Effizienz, erhöht die Arbeitsbelastung. Verbesserung würde das System leistungsfähiger oder sicherer machen.' },
    { id: 'satisfactory', label: 'Satisfactory', kat: 'n/a', rec: 'n/a', verb: '',
      desc: 'Geeignet, die Einsatzziele effizient und sicher zu erreichen.' }
  ];

  /* Review-Checklisten */
  OTE.CHECKLISTS = {
    coi: [
      'Spiegeln die COI die Prioritäten des Nutzers wider?',
      'Können alle COI mit Ja oder Nein beantwortet werden?',
      'Sind alle COI durch MOE und MOA hinterlegt?',
      'Sind die COI konsistent mit der Strategy-to-Task-Methodik?',
      'Sind die COI spezifisch für die Einsatzaufgaben des Systems?',
      'Sind alle COI mit dem Hauptzweck der OT&E vereinbar?',
      'Können die COI in der vorliegenden Form durch OT&E beantwortet werden?',
      'Überschneiden sich COI?',
      'Sind die COI konsistent mit bestehenden oder geplanten Einsatz- und Instandhaltungskonzepten, Vorschriften, Verfahren und Techniken?',
      'Sind für den Test neue Vorschriften und Verfahren nötig und in den COI berücksichtigt?',
      'Adressieren die COI Schnittstellen zu anderen Systemen der Nutzer?'
    ],
    moe: [
      'Beziehen sich alle MOE auf die COI?',
      'Sind die MOA mit den MOE verknüpft? Mit den COI?',
      'Sind MOE/MOA quantitativ, wo praktikabel?',
      'Adressieren die MOE/MOA die Nutzerforderungen?',
      'Sind MOE/MOA hinsichtlich Zeit, Kosten und Ressourcen durchführbar?',
      'Können MOE/MOA durch Beantwortung anderer COI oder durch zusätzliche Datenerfassung ohne Beeinflussung abgedeckt werden?',
      'Welche MOE/MOA sind im Feldtest abdeckbar, welche nur durch Modellierung oder eine Kombination?',
      'Adressieren MOE/MOA den Informations- und Datenbedarf in strittigen Bereichen?',
      'Können Tests gestrafft werden und dennoch den Daten- und Informationsbedarf decken?',
      'Welche Defizite und Einschränkungen bestehen bei der Abdeckung der Forderungen? Auswirkungen? Workarounds?',
      'Fordern MOE/MOA die Bewertung von Instandhaltung und weiteren logistischen Forderungen?',
      'Gibt es systemspezifische Unterstützungsaspekte, die in MOE/MOA integriert werden sollten?'
    ]
  };

  OTE.METHODS = ['Flugversuch', 'Bodenversuch', 'SME-Bewertung', 'Simulation/Rechnerisch', 'Dokumentenprüfung', 'Herstellernachweis'];
  OTE.PLANNABLE = ['Flugversuch', 'Bodenversuch', 'SME-Bewertung'];
  const METHOD_ALIAS = { Flugtest: 'Flugversuch', 'Übung / Exercise': 'Flugversuch', Bodentest: 'Bodenversuch', Befragung: 'SME-Bewertung',
    Simulator: 'Simulation/Rechnerisch', Simulation: 'Simulation/Rechnerisch', Analyse: 'Simulation/Rechnerisch', Rechnerisch: 'Simulation/Rechnerisch' };
  OTE.normMethod = m => OTE.METHODS.includes(m) ? m : (METHOD_ALIAS[m] || (m ? 'Flugversuch' : 'Flugversuch'));

  /* ---------- Import / Export ---------- */
  OTE.exportProject = function (p) {
    return JSON.stringify({ app: 'ote-planer', schema: OTE.SCHEMA, version: OTE.VERSION, exported: new Date().toISOString(),
      scales: OTE.state.scales, project: p }, null, 2);
  };

  /* Übernahme einer Sicherung (ote-datenstand.json) des SharePoint-OT&E-Tools.
     Dort sind MOE und MOP geteilte Datensätze, hier entsteht je COI ein eigener Baum. */
  const SP_SCALE = { JN: 'janein', SRS: 'srs', BRS: 'bedford', TLX: 'tlx', CHR: 'hqr', DRS: 'drs', SFR: 'sfr' };
  const SP_METHOD = { 'Flugversuch': 'Flugversuch', 'Bodenversuch': 'Bodenversuch', 'SME-Bewertung': 'SME-Bewertung',
    'Simulation/Rechnerisch': 'Simulation/Rechnerisch', 'Dokumentenprüfung': 'Dokumentenprüfung', 'Herstellernachweis': 'Herstellernachweis' };
  const SP_VERDICT = { 'erfüllt': 'ja', 'eingeschränkt erfüllt': 'teilweise', 'nicht erfüllt': 'nein' };
  OTE.fromSharePointTool = function (d) {
    const byId = {};
    ['coi', 'moe', 'mop', 'flt', 'equ'].forEach(L => (d[L] || []).forEach(r => { byId[r.id] = r; }));
    const tomb = d.geloescht || {};
    const alive = (L, r) => !(tomb[L] && tomb[L][r.id] && tomb[L][r.id] >= (r.ge || ''));
    const code = (a, b) => String(a.code).localeCompare(String(b.code), 'de', { numeric: true });
    const p = OTE.make.project('Import OT&E Tool ' + new Date().toLocaleDateString('de-DE'));
    p.system = 'CH-47F Block II (STH)';
    p.rahmen = 'Taktisch-operativer Anteil der Einsatzprüfung, kein technisch-logistischer Bereich.';
    const mopMap = {}; // SharePoint-MOP-id -> [Kriterium-ids]
    (d.coi || []).filter(c => alive('coi', c)).sort(code).forEach(c => {
      const moes = (c.moeRefs || []).map(id => byId[id]).filter(m => m && alive('moe', m));
      const coi = OTE.make.coi({
        kurz: [c.code, c.title].filter(Boolean).join(' '), frage: c.question || c.title || '',
        kategorie: moes.length && moes.every(m => m.kind === 'MOS') ? 'S' : 'E',
        begruendung: [c.phase ? 'EinsPrfg ' + c.phase : '', c.mp ? 'Missionsprofil: ' + c.mp : '', c.scope || ''].filter(Boolean).join('\n'),
        prioritaet: { K: 'hoch', M: 'mittel', S: 'niedrig', Z: 'niedrig' }[c.prio] || 'mittel',
        antwort: SP_VERDICT[c.verdict] || 'offen', antwortText: c.summary || '', collapsed: true
      });
      moes.forEach(m => {
        const meas = OTE.make.measure({ typ: m.kind === 'MOS' ? 'MOS' : 'MOE', titel: [m.code, m.title].filter(Boolean).join(' '), text: m.desc || m.title || '' });
        (m.mopRefs || []).map(id => byId[id]).filter(x => x && alive('mop', x)).forEach(mp => {
          const k = (c.criteria || {})[mp.id] || {};
          const sk = SP_SCALE[k.scale] || (k.scale === 'NP' ? 'janein' : 'janein');
          const quant = (k.op === '≥' || k.op === '≤' || k.op === '=') && sk === 'janein' && !mp.art;
          const crit = OTE.make.criterion({
            typ: mp.art === 'MOA' ? 'MOA' : 'MOP',
            text: [mp.code, mp.title].filter(Boolean).join(' ') + (mp.desc ? '. ' + mp.desc : ''),
            skala: quant ? 'messwert' : sk, einheit: mp.unit || '', richtung: k.op === '≤' ? '<=' : '>=',
            objective: quant ? '' : (k.scaleObjective || ''), threshold: quant ? (k.threshold || '') : (k.scaleThreshold || ''),
            bedingungen: quant ? '' : [k.op && k.op !== 'qualitativ' ? k.op : '', k.threshold || ''].join(' ').trim(),
            methode: SP_METHOD[mp.method] || 'Flugversuch',
            ergebnis: k.scale === 'NP' ? OTE.NP : (quant ? (mp.value || '') : (k.scaleRating || '')),
            bemerkung: [k.rationale, mp.notes].filter(Boolean).join(' '), daten: mp.evidence || ''
          });
          meas.criteria.push(crit);
          (mopMap[mp.id] = mopMap[mp.id] || []).push(crit.id);
        });
        coi.measures.push(meas);
      });
      p.cois.push(coi);
    });
    (d.flt || []).filter(f => alive('flt', f)).sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).forEach((f, i) => {
      const fl = OTE.make.flight(i + 1);
      Object.assign(fl, { titel: [f.code, f.title].filter(Boolean).join(' '), datum: f.date || '', start: f.timeStart || '', ende: f.timeEnd || '',
        kennung: f.acReg || '', callsign: f.callsign || '', startort: f.dep || '', testgebiet: f.area || '', beladung: f.config || '',
        notizen: f.remarks || '', phase: f.phase || '', muster: p.system,
        crew: (f.crew || []).map(c => [c.role, c.name].filter(Boolean).join(' ')).filter(Boolean).join(', '),
        status: { geplant: 'geplant', bestätigt: 'bereit', durchgeführt: 'durchgeführt', verschoben: 'geplant', entfallen: 'abgebrochen' }[f.status] || 'geplant' });
      (f.mopRefs || []).forEach(id => (mopMap[id] || []).forEach(cid => { if (!fl.testpunkte.includes(cid)) fl.testpunkte.push(cid); }));
      p.flights.push(fl);
    });
    return p;
  };

  OTE.importData = function (text) {
    const data = JSON.parse(text);
    let projects = [];
    if (Array.isArray(data.coi) && Array.isArray(data.mop)) projects = [OTE.fromSharePointTool(data)];
    else if (data.project) projects = [data.project];
    else if (Array.isArray(data.projects)) projects = data.projects;
    else if (data.cois) projects = [data];
    else throw new Error('Unbekanntes Dateiformat. Erwartet wird eine Sicherung des OT&E Planers.');
    if (Array.isArray(data.scales)) data.scales.forEach(s => {
      if (s && s.id && !OTE.state.scales.find(x => x.id === s.id)) OTE.state.scales.push(s);
    });
    const added = [];
    projects.forEach(p => {
      p = normalizeProject(p);
      const exists = OTE.state.projects.find(x => x.id === p.id);
      if (exists) { p.id = uid(); p.name += ' (Import)'; }
      OTE.state.projects.push(p); added.push(p);
    });
    return added;
  };
})();
