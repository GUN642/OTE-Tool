/* OT&E Planer: KI-Anbindung (Claude API direkt aus dem Browser) und Prompts */
(function () {
  'use strict';
  const OTE = (window.OTE = window.OTE || {});
  const API = 'https://api.anthropic.com/v1/messages';
  const DOC_LIMIT = 180000;   // Zeichen Dokumenttext für die Analyse
  const DOC_LIMIT_SUB = 40000; // Zeichen Dokumenttext für Folgeschritte

  OTE.mem = OTE.mem || { pdf: {} }; // PDF-Rohdaten nur im Arbeitsspeicher

  const MODELS = [
    { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5 (empfohlen)' },
    { id: 'claude-opus-5-5', name: 'Claude Opus 5.5 (gründlicher, langsamer)' },
    { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5 (schnell, günstig)' }
  ];

  function apiError(status, msg) {
    const map = {
      400: 'Anfrage ungültig',
      401: 'API-Schlüssel ungültig',
      403: 'Zugriff verweigert',
      404: 'Modell nicht gefunden. Modellname in den Einstellungen prüfen',
      413: 'Anfrage zu groß. Dokument kürzen',
      429: 'Rate-Limit erreicht. Kurz warten und erneut versuchen',
      500: 'Serverfehler bei Anthropic',
      529: 'Anthropic API überlastet. Später erneut versuchen'
    };
    const e = new Error((map[status] || 'Fehler ' + status) + (msg ? ': ' + msg : '.'));
    e.status = status;
    return e;
  }

  async function stream({ system, content, maxTokens, signal, onDelta }) {
    const s = OTE.state.settings;
    let res;
    try {
      res = await fetch(API, {
        method: 'POST', signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': s.apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({ model: s.model, max_tokens: maxTokens, system, stream: true,
          messages: [{ role: 'user', content }] })
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      throw new Error('Keine Verbindung zur Anthropic API. Im Dienstnetz ist der Zugriff evtl. gesperrt. Dann den manuellen Modus in den Einstellungen nutzen.');
    }
    if (!res.ok) {
      let msg = '';
      try { const j = await res.json(); msg = j.error && j.error.message; } catch (e) { /* ignore */ }
      throw apiError(res.status, msg);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', text = '', stop = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const raw = buf.slice(0, i); buf = buf.slice(i + 2);
        const data = raw.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('');
        if (!data) continue;
        let ev; try { ev = JSON.parse(data); } catch (e) { continue; }
        if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') {
          text += ev.delta.text; onDelta && onDelta(text);
        } else if (ev.type === 'message_delta' && ev.delta) {
          stop = ev.delta.stop_reason || stop;
        } else if (ev.type === 'error') {
          throw new Error((ev.error && ev.error.message) || 'Fehler im Antwortstrom.');
        }
      }
    }
    return { text, stop };
  }

  function extractJSON(t) {
    let s = String(t || '').trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('Die Antwort enthält kein JSON-Objekt.');
    s = s.slice(a, b + 1);
    try { return JSON.parse(s); } catch (e) {
      const r = s.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"');
      try { return JSON.parse(r); } catch (e2) { throw new Error('Die Antwort ist kein gültiges JSON: ' + e.message); }
    }
  }

  /* ---------- Kontextbausteine ---------- */
  function scalesText() {
    return OTE.state.scales.map(s => {
      let t = '- ' + s.id + ': ' + s.name;
      if (s.kind === 'numeric') t += ' (Messwert mit Einheit, Richtung am Kriterium)';
      else if (s.kind === 'binary') t += ' (Ja/Nein)';
      else t += ' (' + (s.min != null ? s.min + ' bis ' + s.max + ', ' : '') + (s.better === 'low' ? 'kleiner ist besser' : 'größer ist besser') + ')';
      return t;
    }).join('\n');
  }

  function projectContext(p) {
    const a = p.analysis || {};
    return [
      'Projekt: ' + (p.name || ''),
      'System: ' + (p.system || 'nicht angegeben'),
      'Kampagne/Phase: ' + (p.kampagne || 'nicht angegeben'),
      'Rahmen und Ausschlüsse: ' + (p.rahmen || 'keine Angaben'),
      'Aim: ' + (p.aim || a.aim || 'noch nicht festgelegt'),
      a.zusammenfassung ? 'Zusammenfassung des Auftrags: ' + a.zusammenfassung : ''
    ].filter(Boolean).join('\n');
  }

  function docsText(p, limit) {
    let out = '';
    p.docs.forEach(d => {
      if (!d.text) return;
      out += '\n<dokument name="' + d.name.replace(/"/g, "'") + '">\n' + d.text + '\n</dokument>\n';
    });
    if (out.length > limit) out = out.slice(0, limit) + '\n[... Dokument gekürzt ...]\n</dokument>';
    return out;
  }

  function pdfBlocks(p) {
    // Gescannte PDFs ohne Textebene direkt an Claude übergeben
    const blocks = [];
    p.docs.forEach(d => {
      const b64 = OTE.mem.pdf[d.id];
      if (b64 && (d.text || '').trim().length < 300) {
        blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 }, title: d.name });
      }
    });
    return blocks;
  }

  const SYSTEM = () => `Du bist ein erfahrener Planer für Operational Test & Evaluation (OT&E) der Luftwaffe und unterstützt ein Prüfteam bei der Einsatzprüfung eines Waffensystems. Arbeite methodisch nach dieser Logik und Terminologie:

Hierarchie: Auftrag und Aim, ggf. Operational Test Objectives (OTO), COI, darunter MOE bzw. MOS, darunter MOP bzw. MOA, daraus Testpunkte und Testkarten.

COI (Critical Operational Issue): Top-Level-Frage, die in der OT&E beantwortet werden muss, um die Fähigkeit des Systems zur Auftragserfüllung festzustellen. Immer als Ja/Nein-Frage formuliert. Kategorie Effectiveness (E) oder Suitability (S). Abgeleitet aus den Nutzerforderungen (FFF/PFK, Design Missions, Einsatzszenare). Ein COI enthält keine Parameter, Objectives oder Thresholds. COI überschneiden sich nicht, sind missionsspezifisch und durch OT&E beantwortbar.
MOE (Measure of Effectiveness): misst den militärischen Effekt, also die Auftragserfüllung beim Einsatz im erwarteten Umfeld mit allen beteiligten Systemen, nicht bloß systemspezifische Leistungsparameter. Quantifizierbar, relevant zum COI, mess- und testbar.
MOS (Measure of Suitability): wie MOE, für Suitability-Aspekte (Verfügbarkeit, Zuverlässigkeit, Verlegefähigkeit, Ausbildung, Human Factors, Sicherheit, Dokumentation, Interoperabilität).
MOP (Measure of Performance): quantitatives Maß der Leistung (Reichweite, Geschwindigkeit, Nutzlast, Zeit, Genauigkeit). Mit Einheit, Richtung (>= oder <=), Objective (gewünschter Wert) und Threshold (minimal akzeptabler Wert). Eng an das MOE gekoppelt.
MOA (Measure of Assessment): qualitative Bewertung durch militärische Beurteilung, gestützt auf Beobachtungen (Handling, Workload, Situationsbewusstsein, Human Factors), auf einer Bewertungsskala mit Objective und Threshold als Skalenwert.
Threshold ist der minimal akzeptable Wert, unterhalb dessen der Nutzen fraglich ist. Objective ist der gewünschte Wert.
Zahlenwerte, die nicht aus den Unterlagen hervorgehen, werden NICHT erfunden. Dann "lt. FFF/PFK" oder "[festlegen]" eintragen.

Verfügbare Bewertungsskalen (id: Beschreibung):
${scalesText()}

Verfahren (Feld "methode", exakt einer dieser Werte): ${OTE.METHODS.join(', ')}.

Antworte ausschließlich mit einem gültigen JSON-Objekt. Kein Markdown, keine Code-Fences, kein Text davor oder danach. Inhalte auf Deutsch, knapp und präzise. Verwende keine Gedankenstriche.`;

  /* ---------- Aufgaben ---------- */
  OTE.prompts = {
    analyze(p) {
      return {
        title: 'Auftrag analysieren und COI vorschlagen',
        docBlocks: pdfBlocks(p),
        user: `Analysiere den Auftrag der Einsatzprüfung und schlage COI vor.

${projectContext(p)}

Unterlagen:
${docsText(p, DOC_LIMIT) || '[Nur als angehängtes PDF verfügbar]'}

Aufgaben:
1. Fasse den Auftrag in 3 bis 6 Sätzen zusammen.
2. Formuliere das Aim in einem Satz.
3. Liste die Design Missions bzw. Einsatzszenare und wesentliche Rahmenbedingungen.
4. Schlage 6 bis 20 COI vor, priorisiert nach Relevanz für den Nutzer. Jede COI als Ja/Nein-Frage mit Kategorie, kurzer Begründung und Fundstelle (kurzes wörtliches Zitat oder Abschnittsangabe).
5. Nenne Unklarheiten, Widersprüche oder fehlende Angaben in den Unterlagen als Hinweise.
Beachte Rahmen und Ausschlüsse des Projekts.

JSON-Schema:
{"zusammenfassung":"string","aim":"string","missionen":["string"],"hinweise":["string"],"cois":[{"kurz":"Kurztitel, max. 5 Wörter","frage":"Ja/Nein-Frage?","kategorie":"E oder S","prioritaet":"hoch|mittel|niedrig","begruendung":"string","quelle":"string"}]}`
      };
    },

    measures(p, coi, measure) {
      const idx = OTE.index(p);
      const existing = coi.measures.map(m => '- ' + idx.byId[m.id].label + ' ' + (m.titel || m.text) +
        (m.criteria.length ? ' (' + m.criteria.map(k => k.typ + ': ' + k.text).join('; ') + ')' : '')).join('\n') || 'keine';
      const others = p.cois.filter(c => c.id !== coi.id).map(c => '- ' + idx.byId[c.id].label + ': ' + c.frage).join('\n') || 'keine';
      const target = measure
        ? `Erstelle für das folgende ${measure.typ} die zugehörigen MOP und MOA (3 bis 6). Bereits vorhandene Kriterien nicht duplizieren.
${measure.typ}: ${measure.titel ? measure.titel + ': ' : ''}${measure.text}
Vorhandene Kriterien: ${measure.criteria.map(k => k.typ + ': ' + k.text).join('; ') || 'keine'}`
        : `Erstelle für das folgende COI die MOE (bei Suitability MOS) und darunter jeweils die MOP und MOA. 2 bis 4 Measures je COI, je Measure 2 bis 5 Kriterien. Vorhandene Measures nicht duplizieren.`;
      return {
        title: measure ? 'MOP/MOA für ' + measure.typ + ' generieren' : 'MOE/MOS und MOP/MOA für ' + idx.byId[coi.id].label + ' generieren',
        user: `${target}

${projectContext(p)}

COI: ${coi.frage}
Kurztitel: ${coi.kurz || ''}
Kategorie: ${coi.kategorie === 'S' ? 'Suitability' : 'Effectiveness'}
Begründung: ${coi.begruendung || ''}
Fundstelle: ${coi.quelle || ''}
Vorhandene Measures unter diesem COI:
${existing}
Andere COI im Katalog (Überschneidungen vermeiden):
${others}

Auszug aus den Unterlagen (für Werte und Bedingungen):
${docsText(p, DOC_LIMIT_SUB) || 'keine'}

Vorgaben: Quantitative MOP und qualitative MOA sinnvoll mischen. MOA erhalten eine Skalen-id aus der Liste, Objective und Threshold als Skalenwert. MOP erhalten skala "messwert", Einheit, Richtung und Werte aus den Unterlagen, sonst "lt. FFF/PFK". "bedingungen" beschreibt die Testbedingungen (Tag/Nacht, Masse, Wetter, Umgebung). "daten" beschreibt benötigte Daten und Messmittel (FTI, Video, Fragebogen, Beobachter).

JSON-Schema:
{"measures":[{"typ":"MOE|MOS","titel":"Kurztitel","text":"Aussage, die erfüllt sein soll","criteria":[{"typ":"MOP|MOA","text":"string","skala":"Skalen-id","einheit":"string","richtung":">=|<=","objective":"string","threshold":"string","methode":"string","bedingungen":"string","daten":"string"}]}]}${measure ? '\nGib genau ein Measure zurück, das die neuen Kriterien enthält.' : ''}`
      };
    },

    program(p, entries) {
      const tps = entries.map(e => ({ id: e.obj.id, label: e.label, coi: e.coi.kurz || e.coi.frage, measure: e.measure.titel || e.measure.text,
        text: e.obj.text, methode: e.obj.methode, bedingungen: e.obj.bedingungen }));
      return {
        title: 'Flugprogramm vorschlagen',
        user: `Plane ein Flugprogramm für die folgenden offenen Testpunkte.

${projectContext(p)}

Regeln: Gruppiere Testpunkte zu Flügen (Bodenversuche als eigene Bodentermine), so dass Konfiguration, Bedingungen (Tag/Nacht, Wetter, Beladung) und Testgebiet sinnvoll gebündelt werden. Aufbau vom Einfachen zum Komplexen, risikoreiche Punkte erst nach den Grundlagen. Etwa 60 bis 120 Minuten je Flug, 3 bis 8 Testpunkte je Flug. Jeder Testpunkt genau einmal. Alle übergebenen Testpunkte einplanen.

Testpunkte:
${JSON.stringify(tps, null, 1)}

JSON-Schema:
{"fluege":[{"titel":"string","profil":"Kurzbeschreibung des Flugprofils","dauer_min":90,"bedingungen":"string","konfiguration":"string","testpunkte":["Testpunkt-id"],"begruendung":"string"}]}`
      };
    },

    cards(p, flight, entries) {
      const tps = entries.map(e => {
        const s = OTE.scale(e.obj.skala);
        return { id: e.obj.id, label: e.label, coi: e.coi.frage, measure: (e.measure.titel ? e.measure.titel + ': ' : '') + e.measure.text,
          text: e.obj.text, typ: e.obj.typ, skala: s.name, einheit: e.obj.einheit, richtung: e.obj.richtung,
          objective: e.obj.objective, threshold: e.obj.threshold, methode: e.obj.methode, bedingungen: e.obj.bedingungen, daten: e.obj.daten };
      });
      const f = Object.assign({}, flight); delete f.karten; delete f.testpunkte; delete f.id;
      return {
        title: 'Testkarten für Flug ' + flight.nr + ' erstellen',
        user: `Erstelle Testkarten (Flight Test Cards) für den folgenden Flug. Je Testpunkt genau eine Karte, in sinnvoller Flugreihenfolge.

${projectContext(p)}

Flug:
${JSON.stringify(f, null, 1)}

Testpunkte:
${JSON.stringify(tps, null, 1)}

Inhalt je Karte: Testziel, THA (Test Hazard Analysis: Gefährdungen, Mitigation und Notverfahren), Voraussetzungen, Flight Test Technique als nummerierte, im Cockpit ausführbare Schritte, Konfiguration, Flugbedingungen, Limits (Grenz- und Abbruchwerte), zu erfassende Daten inkl. Bewertungsskala mit Objective/Threshold, Abbruchkriterien. Knapp und cockpittauglich. Keine erfundenen systemspezifischen Grenzwerte: dann "lt. Flughandbuch" oder "[festlegen]".

JSON-Schema:
{"flugziel":"string","hinweise":"string","karten":[{"ref":"Testpunkt-id","titel":"string","testziel":"string","tha":"string","voraussetzungen":"string","ftt":"string","konfiguration":"string","flugbedingungen":"string","limits":"string","daten":"string","abbruch":"string"}]}`
      };
    },

    review(p) {
      const idx = OTE.index(p);
      const tree = p.cois.map(c => {
        let t = idx.byId[c.id].label + ' [' + c.kategorie + '] ' + c.frage;
        c.measures.forEach(m => {
          t += '\n  ' + idx.byId[m.id].label + ' ' + (m.titel ? m.titel + ': ' : '') + m.text;
          m.criteria.forEach(k => { t += '\n    ' + idx.byId[k.id].label + ' ' + k.text + ' (Skala ' + k.skala + ', Obj ' + k.objective + ', Thr ' + k.threshold + ', ' + k.methode + ')'; });
        });
        return t;
      }).join('\n');
      const cl = (list, key) => list.map((q, i) => key + ' ' + (i + 1) + ': ' + q).join('\n');
      return {
        title: 'Katalog prüfen',
        user: `Prüfe den folgenden OT&E-Katalog anhand der Review-Checklisten. Bewerte jede Checklistenfrage und gib konkrete, umsetzbare Verbesserungsvorschläge mit Bezug auf die Nummern.

${projectContext(p)}

Katalog:
${tree || 'leer'}

Checkliste COI:
${cl(OTE.CHECKLISTS.coi, 'coi')}

Checkliste MOE/MOA:
${cl(OTE.CHECKLISTS.moe, 'moe')}

JSON-Schema:
{"gesamt":"Gesamteinschätzung in 2 bis 4 Sätzen","punkte":[{"liste":"coi|moe","nr":1,"bewertung":"ok|teilweise|nein","kommentar":"string"}],"vorschlaege":["string"]}`
      };
    }
  };

  /* ---------- Ausführung ---------- */
  OTE.ai = {
    MODELS,
    extractJSON,
    mode: () => OTE.state.settings.aiMode,
    available: () => OTE.state.settings.aiMode !== 'off',
    async run(task, maxTokens) {
      const system = SYSTEM();
      const s = OTE.state.settings;
      if (s.aiMode === 'manual') {
        const pdfNote = (task.docBlocks && task.docBlocks.length)
          ? '\n\nHINWEIS: Ein Dokument liegt nur als gescanntes PDF vor. Bitte das PDF zusätzlich im Chat anhängen.' : '';
        const text = await OTE.ui.manualPrompt(task.title, system + '\n\n---\n\n' + task.user + pdfNote);
        return extractJSON(text);
      }
      if (!s.apiKey) throw new Error('Kein API-Schlüssel hinterlegt. Unter Einstellungen einen Schlüssel eintragen oder den manuellen Modus wählen.');
      const ctrl = new AbortController();
      const prog = OTE.ui.progress(task.title, () => ctrl.abort());
      try {
        const content = (task.docBlocks || []).concat([{ type: 'text', text: task.user }]);
        const r = await stream({ system, content, maxTokens: maxTokens || s.maxTokens, signal: ctrl.signal, onDelta: t => prog.update(t) });
        try { return extractJSON(r.text); } catch (e) {
          if (r.stop === 'max_tokens') throw new Error('Die Antwort wurde abgeschnitten. In den Einstellungen das Token-Limit erhöhen.');
          throw e;
        }
      } catch (e) {
        if (e.name === 'AbortError') { const x = new Error('Abgebrochen.'); x.aborted = true; throw x; }
        throw e;
      } finally { prog.close(); }
    },
    async test() {
      const s = OTE.state.settings;
      const res = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': s.apiKey.trim(),
        'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: s.model, max_tokens: 16, messages: [{ role: 'user', content: 'Antworte nur mit OK.' }] }) })
        .catch(() => { throw new Error('Keine Verbindung zur Anthropic API.'); });
      if (!res.ok) { let m = ''; try { m = (await res.json()).error.message; } catch (e) { /* ignore */ } throw apiError(res.status, m); }
      return true;
    }
  };
})();
