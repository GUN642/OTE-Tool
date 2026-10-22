/* OT&E Planer: UI-Grundbausteine (Modal, Drawer, Toast, Fortschritt) */
(function () {
  'use strict';
  const OTE = (window.OTE = window.OTE || {});

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nl2br = s => esc(s).replace(/\n/g, '<br>');
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
    upload: '<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>',
    print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M4 16V4h12"/>',
    download: '<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>',
    plane: '<path d="M2 13l8-2 4-8h2l-1 8 6 1 1-2h2l-1 4 1 4h-2l-1-2-6 1 1 8h-2l-4-8-8-2z"/>',
    check: '<path d="M5 12l5 5 9-10"/>'
  };
  const icon = (n, cls) => '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';

  OTE.ui = { esc, nl2br, $, $$, icon };

  /* Toast */
  OTE.ui.toast = function (msg, kind) {
    let host = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    el.textContent = msg;
    host.appendChild(el);
    while (host.children.length > 3) host.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, kind === 'error' ? 7000 : 3200);
  };

  /* Modal */
  OTE.ui.modal = function (html, opts) {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = '<div class="modal ' + (opts.wide ? 'wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(wrap);
    const close = (val) => {
      wrap.remove();
      document.removeEventListener('keydown', onKey);
      opts.onClose && opts.onClose(val);
    };
    const onKey = e => { if (e.key === 'Escape' && !opts.sticky) close(null); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('mousedown', e => { if (e.target === wrap && !opts.sticky) close(null); });
    $$('[data-close]', wrap).forEach(b => b.addEventListener('click', () => close(null)));
    const first = $('textarea, input, select, button.primary', wrap);
    if (first && !opts.noFocus) setTimeout(() => first.focus(), 30);
    return { el: wrap, close };
  };

  OTE.ui.confirm = function (msg, okLabel, danger) {
    return new Promise(res => {
      const m = OTE.ui.modal('<div class="modal-body"><p>' + esc(msg) + '</p></div><div class="modal-foot">' +
        '<button class="btn" data-close>Abbrechen</button><button class="btn primary ' + (danger ? 'danger' : '') + '" data-ok>' + esc(okLabel || 'OK') + '</button></div>',
        { onClose: v => res(v === true) });
      $('[data-ok]', m.el).addEventListener('click', () => m.close(true));
      setTimeout(() => $('[data-ok]', m.el).focus(), 40);
    });
  };

  /* Fortschritt bei KI-Anfragen */
  OTE.ui.progress = function (title, onCancel) {
    const m = OTE.ui.modal('<div class="modal-head"><h2>' + esc(title) + '</h2></div><div class="modal-body">' +
      '<div class="progress-row"><span class="spinner" aria-hidden="true"></span><span data-status>Anfrage an Claude läuft …</span></div>' +
      '<pre class="stream" data-stream aria-live="off"></pre></div>' +
      '<div class="modal-foot"><button class="btn" data-cancel>Abbrechen</button></div>', { sticky: true, noFocus: true });
    $('[data-cancel]', m.el).addEventListener('click', () => onCancel && onCancel());
    const st = $('[data-status]', m.el), pre = $('[data-stream]', m.el);
    return {
      update(text) {
        st.textContent = 'Antwort wird empfangen … ' + text.length.toLocaleString('de-DE') + ' Zeichen';
        pre.textContent = text.slice(-900);
        pre.scrollTop = pre.scrollHeight;
      },
      close() { m.close(); }
    };
  };

  /* Manueller KI-Modus: Prompt kopieren, Antwort einfügen */
  OTE.ui.manualPrompt = function (title, prompt) {
    return new Promise((resolve, reject) => {
      const m = OTE.ui.modal(
        '<div class="modal-head"><h2>' + esc(title) + '</h2><button class="icon-btn" data-close aria-label="Schließen">' + icon('close') + '</button></div>' +
        '<div class="modal-body">' +
        '<ol class="steps-mini"><li>Prompt kopieren und in claude.ai oder ein freigegebenes KI-Werkzeug einfügen.</li><li>Die JSON-Antwort vollständig kopieren.</li><li>Antwort unten einfügen und übernehmen.</li></ol>' +
        '<label class="lbl">Prompt (' + prompt.length.toLocaleString('de-DE') + ' Zeichen)</label>' +
        '<textarea class="mono" rows="8" readonly data-prompt>' + esc(prompt) + '</textarea>' +
        '<div class="row-end"><button class="btn" data-copy>' + icon('copy') + 'Prompt kopieren</button></div>' +
        '<label class="lbl" for="manual-answer">Antwort der KI (JSON)</label>' +
        '<textarea id="manual-answer" class="mono" rows="8" data-answer placeholder="{ … }"></textarea></div>' +
        '<div class="modal-foot"><button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Antwort übernehmen</button></div>',
        { wide: true, noFocus: true, onClose: v => { if (v === null) { const e = new Error('Abgebrochen.'); e.aborted = true; reject(e); } } });
      $('[data-copy]', m.el).addEventListener('click', async () => {
        const ta = $('[data-prompt]', m.el);
        try { await navigator.clipboard.writeText(prompt); } catch (e) { ta.select(); document.execCommand('copy'); }
        OTE.ui.toast('Prompt kopiert.');
      });
      $('[data-ok]', m.el).addEventListener('click', () => {
        const v = $('[data-answer]', m.el).value.trim();
        if (!v) { OTE.ui.toast('Bitte zuerst die Antwort einfügen.', 'error'); return; }
        try { OTE.ai.extractJSON(v); } catch (e) { OTE.ui.toast(e.message, 'error'); return; }
        resolve(v); m.close(true);
      });
    });
  };

  /* Drawer zum Bearbeiten */
  OTE.ui.drawer = function (title, bodyHtml, opts) {
    opts = opts || {};
    const old = $('.drawer-wrap'); if (old) old._close();
    const wrap = document.createElement('div');
    wrap.className = 'drawer-wrap';
    wrap.innerHTML = '<aside class="drawer" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<div class="drawer-head"><h2>' + esc(title) + '</h2><button class="icon-btn" data-close aria-label="Schließen">' + icon('close') + '</button></div>' +
      '<div class="drawer-body">' + bodyHtml + '</div>' +
      '<div class="drawer-foot">' + (opts.foot || '<span class="muted">Änderungen werden automatisch gespeichert.</span><button class="btn primary" data-close>Fertig</button>') + '</div></aside>';
    document.body.appendChild(wrap);
    const close = () => {
      wrap.remove(); document.removeEventListener('keydown', onKey);
      opts.onClose && opts.onClose();
    };
    wrap._close = close;
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
    $$('[data-close]', wrap).forEach(b => b.addEventListener('click', close));
    // Bindungen: data-bind="feld" schreibt direkt ins Objekt
    if (opts.obj) {
      $$('[data-bind]', wrap).forEach(inp => {
        const ev = inp.tagName === 'SELECT' || inp.type === 'checkbox' ? 'change' : 'input';
        inp.addEventListener(ev, () => {
          opts.obj[inp.dataset.bind] = inp.type === 'checkbox' ? inp.checked : inp.value;
          OTE.save();
          opts.onInput && opts.onInput(inp.dataset.bind, inp);
        });
      });
    }
    const f = $('input, textarea, select', wrap); if (f) setTimeout(() => f.focus(), 40);
    return { el: wrap, close };
  };

  /* Formularfelder */
  OTE.ui.field = function (label, name, value, opts) {
    opts = opts || {};
    const id = 'f-' + name + '-' + Math.random().toString(36).slice(2, 6);
    let input;
    if (opts.type === 'textarea') input = '<textarea id="' + id + '" data-bind="' + name + '" rows="' + (opts.rows || 3) + '" placeholder="' + esc(opts.ph || '') + '">' + esc(value) + '</textarea>';
    else if (opts.type === 'select') input = '<select id="' + id + '" data-bind="' + name + '">' + opts.options.map(o => {
      const v = typeof o === 'object' ? o.v : o, l = typeof o === 'object' ? o.l : o;
      return '<option value="' + esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('') + '</select>';
    else input = '<input id="' + id + '" data-bind="' + name + '" type="' + (opts.type || 'text') + '" value="' + esc(value) + '" placeholder="' + esc(opts.ph || '') + '"' + (opts.list ? ' list="' + opts.list + '"' : '') + '>';
    return '<div class="fld ' + (opts.cls || '') + '"><label class="lbl" for="' + id + '">' + esc(label) + '</label>' + input + (opts.hint ? '<div class="hint">' + opts.hint + '</div>' : '') + '</div>';
  };

  OTE.ui.download = function (filename, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  OTE.ui.fmtDate = ts => ts ? new Date(ts).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  OTE.ui.slug = s => String(s || 'projekt').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
})();
