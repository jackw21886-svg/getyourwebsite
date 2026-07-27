/**
 * Demo sandbox behaviour — a no-backend recreation of the client portal.
 *
 * Everything lives in the `state` object below. There are no network calls, no
 * auth and no storage: reload the page (or press "Reset demo") and you're back
 * to the seed data.
 *
 * The element picker, the friendly labels and the prompt format are ported
 * directly from the real app so the "What we'll send" preview is byte-for-byte
 * what our client portal would actually deliver:
 *   client/src/clientRevision.js  → friendlyElementLabel, buildClientRevisionPrompt,
 *                                   formatClientPageLabel
 *   client/src/revisePicker.js    → the parent side of the picker messaging
 *   backend/src/siteRevisionPreview.js → the picker script injected into the preview
 */

const root = document.querySelector('[data-sandbox]');
if (root) init(root);

// ── Seed data ──────────────────────────────────────────────────────────────
// Shapes mirror what /api/client/sites returns in the real app.

function seed() {
  return {
    tab: 'mock-site',
    businessName: "Rosa's Bakery",
    mock: { placeId: 'demo-rosas-bakery', businessName: "Rosa's Bakery", createdAt: '2025-03-04' },
    site: {
      businessName: "Rosa's Bakery",
      viewStatus: 'ready',
      versionId: 'v3',
      versionNumber: 3,
      approvedAt: '2025-06-18',
      versions: [
        { versionId: 'v3', versionNumber: 3, approvedAt: '2025-06-18' },
        { versionId: 'v2', versionNumber: 2, approvedAt: '2025-05-02' },
        { versionId: 'v1', versionNumber: 1, approvedAt: '2025-04-11' },
      ],
    },
    // Change requests sent during this demo session.
    sent: [],
    // The workspace, when it's open.
    revising: null,
  };
}

// ── Ported from client/src/clientRevision.js ───────────────────────────────

const KIND_BY_TAG = {
  h1: 'main title', h2: 'section title', h3: 'section title', h4: 'heading',
  h5: 'heading', h6: 'heading', p: 'paragraph', img: 'image', button: 'button',
  nav: 'menu', header: 'top area', footer: 'bottom area', section: 'section',
  article: 'section', main: 'section', ul: 'list', ol: 'list', li: 'list item',
  form: 'form', input: 'form field', textarea: 'form field', select: 'form field',
  video: 'video', span: 'text', strong: 'text', em: 'text', small: 'text',
  div: 'part of the page',
};

function formatClientPageLabel(pagePath) {
  if (!pagePath || pagePath === 'index.html') return 'Home page';
  const clean = String(pagePath).replace(/\.html?$/i, '').replace(/[-_]/g, ' ');
  return clean
    .split('/')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ');
}

function friendlyElementLabel(descriptor = {}) {
  const tag = String(descriptor.tagName ?? 'div').toLowerCase();
  const kind = KIND_BY_TAG[tag] || 'part of the page';
  const preview = String(descriptor.textPreview ?? '').trim();

  if (tag === 'img') {
    if (preview && preview.toLowerCase() !== 'image') return `The image labeled "${preview}"`;
    return 'This image';
  }
  if (preview) return `The ${kind} that says "${preview}"`;
  return `This ${kind}`;
}

function buildClientRevisionPrompt({ overallNotes = '', pageEditsByPage = {}, elementNotes = [] } = {}) {
  const sections = [];
  const overall = String(overallNotes ?? '').trim();

  if (overall) sections.push(`Overall changes for the whole website:\n${overall}`);

  const pages = new Set([
    ...Object.keys(pageEditsByPage),
    ...elementNotes.map((note) => note.page || 'index.html'),
  ]);

  for (const page of [...pages].sort((a, b) => a.localeCompare(b))) {
    const pageLabel = formatClientPageLabel(page);
    const pageWide = String(pageEditsByPage[page] ?? '').trim();
    const notes = elementNotes.filter(
      (note) => (note.page || 'index.html') === page && String(note.comment ?? '').trim()
    );

    if (!pageWide && notes.length === 0) continue;

    const lines = [`On the ${pageLabel}:`];
    if (pageWide) lines.push(`- Page-wide changes: ${pageWide}`);

    notes.forEach((note) => {
      const label = note.friendlyLabel || friendlyElementLabel(note);
      lines.push(
        [`- ${label}: ${String(note.comment).trim()}`, note.selector ? `  (reference: ${note.selector})` : null]
          .filter(Boolean)
          .join('\n')
      );
    });

    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
}

function isClientRevisionValid({ overallNotes = '', pageEditsByPage = {}, elementNotes = [] } = {}) {
  if (String(overallNotes ?? '').trim()) return true;
  if (Object.values(pageEditsByPage).some((v) => String(v ?? '').trim())) return true;
  return elementNotes.some((n) => String(n.comment ?? '').trim());
}

// ── The picker, injected into the preview iframe ───────────────────────────
// Same behaviour and the same outline colours as the real preview: indigo
// dashed on hover, cyan solid once a note is attached.

const PICKER_SOURCE = 'gywn-revise-picker';
const IGNORE_TAGS = new Set(['html', 'body', 'head', 'script', 'style', 'link', 'meta']);

function installPicker(doc, onSelect) {
  if (doc.getElementById('gywn-revise-styles')) return;

  const style = doc.createElement('style');
  style.id = 'gywn-revise-styles';
  style.textContent =
    '.gywn-revise-hover{outline:2px dashed rgba(99,102,241,.9)!important;outline-offset:2px;cursor:crosshair!important}' +
    '.gywn-revise-selected{outline:3px solid rgba(34,211,238,.95)!important;outline-offset:2px}' +
    'a:hover,a:hover *{outline:2px dashed rgba(251,191,36,.85)!important;outline-offset:2px}';
  doc.head.appendChild(style);

  const isSelectable = (el) =>
    el &&
    el.nodeType === 1 &&
    !IGNORE_TAGS.has(el.tagName.toLowerCase()) &&
    el !== doc.body &&
    el !== doc.documentElement;

  function findSelectable(start) {
    let current = start && start.nodeType === 1 ? start : start && start.parentElement;
    while (current) {
      if (isSelectable(current)) return current;
      current = current.parentElement;
    }
    return null;
  }

  function textPreview(el) {
    if (el.tagName === 'IMG') return (el.getAttribute('alt') || el.getAttribute('title') || 'Image').trim();
    return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100);
  }

  function buildSelector(el) {
    if (el.id) return `#${el.id}`;
    const path = [];
    let current = el;

    while (current && current.nodeType === 1 && current.tagName !== 'HTML') {
      let part = current.tagName.toLowerCase();
      if (current.id) {
        path.unshift(`#${current.id}`);
        break;
      }
      const parent = current.parentElement;
      if (parent) {
        const sameTag = [...parent.children].filter((c) => c.tagName === current.tagName);
        if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
      }
      path.unshift(part);
      current = parent;
      if (path.length >= 8) break;
    }
    return path.join(' > ');
  }

  let hovered = null;

  doc.addEventListener('mouseover', (e) => {
    const el = findSelectable(e.target);
    if (hovered && hovered !== el) hovered.classList.remove('gywn-revise-hover');
    if (el) el.classList.add('gywn-revise-hover');
    hovered = el;
  });

  doc.addEventListener('mouseleave', () => {
    if (hovered) hovered.classList.remove('gywn-revise-hover');
    hovered = null;
  });

  doc.addEventListener(
    'click',
    (e) => {
      // Links inside the preview must not navigate the demo away.
      e.preventDefault();
      e.stopPropagation();

      const el = findSelectable(e.target);
      if (!el) return;

      onSelect(
        {
          tagName: el.tagName.toLowerCase(),
          selector: buildSelector(el),
          textPreview: textPreview(el),
        },
        el
      );
    },
    true
  );

  doc.__gywnPickerSource = PICKER_SOURCE;
}

// ── Wiring ─────────────────────────────────────────────────────────────────

function init(root) {
  let state = seed();

  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => [...root.querySelectorAll(sel)];

  const el = {
    tabs: $$('[data-tab]'),
    panels: { 'mock-site': $('[data-panel="mock-site"]'), 'real-site': $('[data-panel="real-site"]') },
    versions: $('[data-versions]'),
    success: $('[data-success]'),
    latestVersion: $('[data-latest-version]'),
    latestApproved: $('[data-latest-approved]'),
    mockDate: $('[data-mock-date]'),
    overlay: $('[data-revise]'),
    frame: $('[data-frame]'),
    revisePill: $('[data-revise-version]'),
    pagePill: $('[data-page-pill]'),
    form: $('[data-revise-form]'),
    overall: $('[data-overall]'),
    pageEdits: $('[data-page-edits]'),
    notes: $('[data-notes]'),
    notesEmpty: $('[data-notes-empty]'),
    promptBox: $('[data-prompt-box]'),
    prompt: $('[data-prompt]'),
    send: $('[data-send]'),
    log: $('[data-log]'),
    logItems: $('[data-log-items]'),
  };

  const fmtDate = (iso) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

  // The demo's stand-in for a hosted version of the site. Version 3 is the
  // current bakery mock; earlier versions get a small style override so you can
  // see that revisions actually changed something.
  const BASE = document.documentElement.dataset.base || '/';
  const previewUrl = () => `${BASE}bakery.html`.replace(/\/{2,}/g, '/');

  const VERSION_TWEAKS = {
    1: ':root{--terra:#8d8f93!important;--terra-d:#6f7175!important;--gold:#b9b199!important}',
    2: ':root{--terra:#b8763f!important;--terra-d:#96591f!important}',
    3: '',
  };

  // ── Rendering ────────────────────────────────────────────────────────────

  function renderTabs() {
    el.tabs.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === state.tab));
    Object.entries(el.panels).forEach(([id, panel]) => {
      panel.hidden = id !== state.tab;
    });
  }

  function renderSite() {
    const site = state.site;
    el.latestVersion.textContent = `Version ${site.versionNumber}`;
    el.latestApproved.textContent = `Approved ${fmtDate(site.approvedAt)}`;
    el.mockDate.textContent = `Finished ${fmtDate(state.mock.createdAt)}`;

    el.versions.innerHTML = '';
    site.versions.forEach((v) => {
      const isLatest = v.versionNumber === site.versionNumber;
      const li = document.createElement('li');
      li.className = 'portal-version-item';
      li.innerHTML = `
        <div>
          <div class="portal-version-name">Version ${v.versionNumber}${isLatest ? ' (latest)' : ''}</div>
          <div class="portal-meta">Approved ${fmtDate(v.approvedAt)}</div>
        </div>
        <div class="portal-version-actions">
          <button type="button" class="client-btn-soft" data-open-version="${v.versionNumber}">Open</button>
          <button type="button" class="client-btn-soft" data-revise-vnum="${v.versionNumber}">Request changes</button>
        </div>`;
      el.versions.appendChild(li);
    });
  }

  function renderLog() {
    el.log.hidden = state.sent.length === 0;
    el.logItems.innerHTML = '';
    state.sent.forEach((entry) => {
      const li = document.createElement('li');
      const time = document.createElement('time');
      time.textContent = `Version ${entry.versionNumber} · just now`;
      const pre = document.createElement('pre');
      pre.textContent = entry.prompt;
      li.append(time, pre);
      el.logItems.appendChild(li);
    });
  }

  function renderNotes() {
    const r = state.revising;
    if (!r) return;

    const pageNotes = r.elementNotes.filter((n) => n.page === r.currentPage);

    el.notesEmpty.hidden = pageNotes.length > 0;
    el.notes.hidden = pageNotes.length === 0;
    el.notes.innerHTML = '';

    pageNotes.forEach((note, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'client-revise-note-wrap';

      const card = document.createElement('div');
      card.className = 'client-revise-note';
      card.innerHTML = `
        <div class="client-revise-note-header">
          <span class="client-revise-note-index">${i + 1}</span>
          <div class="client-revise-note-meta">
            <div class="client-revise-note-label"></div>
          </div>
          <button type="button" class="client-revise-note-remove" aria-label="Remove this note">✕</button>
        </div>`;
      card.querySelector('.client-revise-note-label').textContent = note.friendlyLabel;

      const ta = document.createElement('textarea');
      ta.className = 'client-revise-textarea';
      ta.rows = 3;
      ta.placeholder = 'What should we change about this?';
      ta.value = note.comment;
      ta.addEventListener('input', () => {
        note.comment = ta.value;
        renderPrompt();
      });
      card.appendChild(ta);

      card.querySelector('.client-revise-note-remove').addEventListener('click', () => {
        unmark(note.id);
        r.elementNotes = r.elementNotes.filter((n) => n.id !== note.id);
        renderNotes();
        renderPrompt();
      });

      wrap.appendChild(card);
      el.notes.appendChild(wrap);
    });

    el.pagePill.textContent = formatClientPageLabel(r.currentPage);
  }

  function renderPrompt() {
    const r = state.revising;
    if (!r) return;

    const payload = {
      overallNotes: r.overallNotes,
      pageEditsByPage: r.pageEditsByPage,
      elementNotes: r.elementNotes,
    };

    const valid = isClientRevisionValid(payload);
    el.send.disabled = !valid;
    el.promptBox.hidden = !valid;
    if (valid) el.prompt.textContent = buildClientRevisionPrompt(payload);
  }

  // ── The revision workspace ───────────────────────────────────────────────

  function unmark(noteId) {
    const doc = el.frame.contentDocument;
    if (!doc) return;
    const marked = doc.querySelector(`[data-gywn-revise-id="${noteId}"]`);
    if (marked) {
      marked.classList.remove('gywn-revise-selected');
      marked.removeAttribute('data-gywn-revise-id');
    }
  }

  function openRevise(versionNumber) {
    state.revising = {
      versionNumber,
      currentPage: 'index.html',
      overallNotes: '',
      pageEditsByPage: {},
      elementNotes: [],
    };

    el.revisePill.textContent = `Version ${versionNumber}`;
    el.overall.value = '';
    el.pageEdits.value = '';
    el.overlay.hidden = false;
    el.send.disabled = true;
    el.promptBox.hidden = true;

    loadPreview(versionNumber);
    renderNotes();

    // Focus the dialog so keyboard users land inside it.
    el.overlay.querySelector('[role="dialog"]').setAttribute('tabindex', '-1');
    el.overlay.querySelector('[role="dialog"]').focus();
  }

  function closeRevise() {
    el.overlay.hidden = true;
    state.revising = null;
  }

  function loadPreview(versionNumber) {
    el.frame.src = previewUrl();
    el.frame.onload = () => {
      const doc = el.frame.contentDocument;
      if (!doc) return;

      // Make earlier versions look like earlier drafts.
      const tweak = VERSION_TWEAKS[versionNumber];
      if (tweak) {
        const s = doc.createElement('style');
        s.textContent = tweak;
        doc.head.appendChild(s);
      }

      installPicker(doc, (descriptor, node) => {
        const r = state.revising;
        if (!r) return;

        const existing = r.elementNotes.find(
          (n) => n.page === r.currentPage && n.selector === descriptor.selector
        );
        if (existing) return;

        const note = {
          id: `note-${r.elementNotes.length + 1}-${descriptor.selector.length}`,
          page: r.currentPage,
          tagName: descriptor.tagName,
          selector: descriptor.selector,
          textPreview: descriptor.textPreview,
          friendlyLabel: friendlyElementLabel(descriptor),
          comment: '',
        };

        r.elementNotes.push(note);
        node.classList.add('gywn-revise-selected');
        node.setAttribute('data-gywn-revise-id', note.id);

        renderNotes();
        renderPrompt();

        // Focus the textarea for the note that was just added, as the real
        // panel does.
        const boxes = el.notes.querySelectorAll('textarea');
        boxes[boxes.length - 1]?.focus();
      });
    };
  }

  // ── Events ───────────────────────────────────────────────────────────────

  el.tabs.forEach((btn) =>
    btn.addEventListener('click', () => {
      state.tab = btn.dataset.tab;
      el.success.hidden = true;
      renderTabs();
    })
  );

  root.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;

    // "Check again" — the real button re-fetches; here it just blinks.
    if (t.dataset.check) {
      const original = t.textContent;
      t.textContent = 'Checking…';
      t.disabled = true;
      setTimeout(() => {
        t.textContent = original;
        t.disabled = false;
      }, 700);
      return;
    }

    if (t.hasAttribute('data-open-mock') || t.hasAttribute('data-open-site')) {
      window.open(previewUrl(), '_blank', 'noopener,noreferrer');
      return;
    }

    if (t.dataset.openVersion) {
      window.open(previewUrl(), '_blank', 'noopener,noreferrer');
      return;
    }

    if (t.hasAttribute('data-revise-latest')) {
      openRevise(state.site.versionNumber);
      return;
    }

    if (t.dataset.reviseVnum) {
      openRevise(Number(t.dataset.reviseVnum));
      return;
    }

    if (t.hasAttribute('data-close') || t.hasAttribute('data-cancel')) {
      closeRevise();
      return;
    }

    if (t.hasAttribute('data-refresh')) {
      if (state.revising) loadPreview(state.revising.versionNumber);
      return;
    }

    if (t.hasAttribute('data-signout')) {
      // There's no auth here — say so rather than pretending.
      alert('This is a demo, so there is nothing to sign out of. In the real portal this returns you to the login screen.');
      return;
    }

    if (t.hasAttribute('data-reset')) {
      state = seed();
      closeRevise();
      el.success.hidden = true;
      renderTabs();
      renderSite();
      renderLog();
      return;
    }
  });

  el.overall.addEventListener('input', () => {
    if (!state.revising) return;
    state.revising.overallNotes = el.overall.value;
    renderPrompt();
  });

  el.pageEdits.addEventListener('input', () => {
    if (!state.revising) return;
    state.revising.pageEditsByPage[state.revising.currentPage] = el.pageEdits.value;
    renderPrompt();
  });

  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const r = state.revising;
    if (!r) return;

    const prompt = buildClientRevisionPrompt({
      overallNotes: r.overallNotes,
      pageEditsByPage: r.pageEditsByPage,
      elementNotes: r.elementNotes,
    });
    if (!prompt.trim()) return;

    el.send.disabled = true;
    el.send.textContent = 'Sending…';

    // Mimic the real round trip so the interaction feels the same.
    setTimeout(() => {
      state.sent.unshift({ versionNumber: r.versionNumber, prompt });
      closeRevise();

      el.send.textContent = 'Send change request';
      el.success.textContent = 'Your change request was sent. We’ll update your website from there.';
      el.success.hidden = false;

      state.tab = 'real-site';
      renderTabs();
      renderLog();

      el.success.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 650);
  });

  // Escape closes the workspace, as a dialog should.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.overlay.hidden) closeRevise();
  });

  renderTabs();
  renderSite();
  renderLog();
}
