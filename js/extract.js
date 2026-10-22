/* OT&E Planer: Textextraktion aus PDF, DOCX und Textdateien (lokal im Browser) */
(function () {
  'use strict';
  const OTE = (window.OTE = window.OTE || {});
  // Bibliotheken liegen im Repo (js/vendor), damit kein externes CDN nötig ist
  const PDFJS = 'js/vendor/pdf.min.js';            // pdf.js 3.11.174
  const PDFJS_WORKER = 'js/vendor/pdf.worker.min.js';
  const MAMMOTH = 'js/vendor/mammoth.browser.min.js'; // mammoth 1.6.0

  const loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = res;
      s.onerror = () => { delete loaded[src]; rej(new Error('Bibliothek konnte nicht geladen werden (' + src.split('/').pop() + '). Text bitte über „Text einfügen“ übernehmen.')); };
      document.head.appendChild(s);
    });
    return loaded[src];
  }

  function toBase64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(bin);
  }

  async function pdfText(buf) {
    await loadScript(PDFJS);
    const lib = window.pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    const doc = await lib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      let line = '', out = '';
      tc.items.forEach(it => {
        line += it.str;
        if (it.hasEOL) { out += line.trimEnd() + '\n'; line = ''; } else if (it.str && !/\s$/.test(it.str)) line += ' ';
      });
      out += line;
      pages.push('[Seite ' + i + ']\n' + out.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim());
    }
    return { text: pages.join('\n\n'), pages: doc.numPages };
  }

  async function docxText(buf) {
    await loadScript(MAMMOTH);
    const r = await window.mammoth.extractRawText({ arrayBuffer: buf });
    return { text: r.value.replace(/\n{3,}/g, '\n\n').trim() };
  }

  OTE.extract = async function (file) {
    const name = file.name;
    const ext = (name.split('.').pop() || '').toLowerCase();
    const id = OTE.uid();
    if (ext === 'pdf') {
      const buf = await file.arrayBuffer();
      const r = await pdfText(buf);
      if (buf.byteLength < 25 * 1024 * 1024) OTE.mem.pdf[id] = toBase64(buf);
      const note = r.text.replace(/\[Seite \d+\]/g, '').trim().length < 300
        ? 'Kaum Text erkannt (gescanntes PDF?). Im API-Modus wird das PDF direkt an Claude übergeben.' : '';
      return { id, name, type: 'pdf', pages: r.pages, text: r.text, chars: r.text.length, note };
    }
    if (ext === 'docx') {
      const r = await docxText(await file.arrayBuffer());
      return { id, name, type: 'docx', text: r.text, chars: r.text.length };
    }
    if (['txt', 'md', 'csv', 'json', 'xml', 'html', 'htm', 'rtf'].includes(ext) || file.type.startsWith('text/')) {
      let t = await file.text();
      if (ext === 'html' || ext === 'htm') { const d = new DOMParser().parseFromString(t, 'text/html'); t = d.body.innerText || d.body.textContent; }
      return { id, name, type: ext, text: t, chars: t.length };
    }
    if (ext === 'doc') throw new Error(name + ': Altes Word-Format (.doc) wird nicht unterstützt. Bitte als .docx oder PDF speichern.');
    throw new Error(name + ': Dateityp .' + ext + ' wird nicht unterstützt. Erlaubt sind PDF, DOCX, TXT, MD.');
  };
})();
