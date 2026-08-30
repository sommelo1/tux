/*!
 * TUX Review Client — framework-agnostic browser overlay (vanilla, zero deps).
 *
 * Injected by the TUX server (or included manually). Requires the TUX
 * bootstrap on window.__TUX__ (see server.js / server.py). The running UI
 * is the review artifact: reviewers select elements directly on the page,
 * leave structured feedback, and markers restore across reloads and
 * client-side navigation.
 *
 * Layers of control (SPC sections 62–70):
 *   build inclusion  →  window.__TUX__.enabled (startup config)
 *                    →  URL override ?tux=on|?tux=off (runtime, sticky per tab)
 */
(() => {
  'use strict';

  const OVERRIDE_KEY = 'tux:override';
  const apiBase = (window.__TUX__ && window.__TUX__.apiBase) || '/api/tux';
  const identity = {
    user_id: (window.__TUX__ && window.__TUX__.user) || 'anonymous',
    display_name: (window.__TUX__ && window.__TUX__.displayName) || 'Anonymous',
  };

  // ─── activation (SPC 64–69) ───
  function urlOverride() {
    try {
      const v = new URLSearchParams(location.search).get('tux');
      if (v === 'on' || v === 'off') {
        try { sessionStorage.setItem(OVERRIDE_KEY, v); } catch (e) { /* ignore */ }
        return v;
      }
      if (v !== null) {
        console.warn(`[tux] unknown ?tux value ignored: ${v} (expected on or off)`);
      }
    } catch (e) { /* ignore */ }
    return null;
  }
  function stickyOverride() {
    try { return sessionStorage.getItem(OVERRIDE_KEY); } catch (e) { return null; }
  }
  function resolveEnabled() {
    const override = urlOverride() ?? stickyOverride();
    if (override === 'on') return true;
    if (override === 'off') return false;
    return !!(window.__TUX__ && window.__TUX__.enabled);
  }

  // ─── api ───
  async function api(path, options = {}) {
    const res = await fetch(apiBase + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-TUX-User-Id': identity.user_id,
        'X-TUX-Display-Name': identity.display_name,
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.error && data.error.message) || `HTTP ${res.status}`);
    return data;
  }

  // ─── target identification (SPC 16) ───
  function cssEscape(value) {
    return (window.CSS && CSS.escape) ? CSS.escape(value) : String(value).replace(/"/g, '\\"');
  }
  function accessibleName(el) {
    return el.getAttribute('aria-label')
      || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent.trim())
      || (el.tagName === 'IMG' && el.getAttribute('alt'))
      || null;
  }
  function domPath(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 25) {
      let seg = node.tagName.toLowerCase();
      if (node.id) seg += `#${node.id}`;
      else if (node.parentElement) {
        const same = Array.from(node.parentElement.children).filter((c) => c.tagName === node.tagName);
        if (same.length > 1) seg += `:nth-of-type(${same.indexOf(node) + 1})`;
      }
      parts.unshift(seg);
      node = node.parentElement;
    }
    return parts.join(' > ');
  }
  function cssSelectorOf(el) {
    if (el.id) return `#${cssEscape(el.id)}`;
    const tag = el.tagName.toLowerCase();
    const classes = Array.from(el.classList || []).filter((c) => !c.startsWith('tux-'));
    let sel = tag + (classes.length ? '.' + classes.map(cssEscape).join('.') : '');
    const parent = el.parentElement;
    if (parent) {
      const same = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
      if (same.length > 1) sel += `:nth-of-type(${same.indexOf(el) + 1})`;
    }
    return sel;
  }
  function fingerprint(el) {
    const anchorComponent = el.closest('[data-tux-component]');
    const anchorInstance = el.closest('[data-tux-instance]');
    const rect = el.getBoundingClientRect();
    const target = {};
    const tuxId = el.closest('[data-tux-id]');
    const testId = el.closest('[data-testid]') || el.closest('[data-test-id]');
    if (tuxId) target.tux_id = tuxId.getAttribute('data-tux-id');
    if (testId) target.test_id = testId.getAttribute('data-testid') || testId.getAttribute('data-test-id');
    if (anchorComponent) target.component = anchorComponent.getAttribute('data-tux-component');
    if (anchorInstance && anchorInstance !== anchorComponent) {
      target.component_instance = anchorInstance.getAttribute('data-tux-instance');
    } else if (anchorComponent && anchorComponent.getAttribute('data-tux-instance')) {
      target.component_instance = anchorComponent.getAttribute('data-tux-instance');
    }
    const role = el.getAttribute('role');
    if (role) target.role = role;
    const aname = accessibleName(el);
    if (aname) target.accessible_name = aname;
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (text) target.text = text;
    target.css_selector = cssSelectorOf(el);
    target.dom_path = domPath(el);
    target.bounding_box = {
      x: Math.round(rect.left + window.scrollX),
      y: Math.round(rect.top + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
    return target;
  }
  function locate(target) {
    if (!target) return null;
    // Fingerprint validation: when a resolution strategy yields several
    // candidates (nth-child paths drift after DOM changes), pick the one
    // that best matches the stored fingerprint — component/instance scope,
    // captured text, role. Score 0 keeps the first candidate (SPC 16).
    function scoreCandidate(el) {
      let score = 0;
      if (target.component && el.closest(`[data-tux-component="${cssEscape(target.component)}"]`)) score += 4;
      if (target.component_instance && el.closest(`[data-tux-instance="${cssEscape(target.component_instance)}"]`)) score += 3;
      if (target.text) {
        const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
        if (t === target.text) score += 2;
        else if (target.text.length > 12 && t.includes(target.text.slice(0, 40))) score += 1;
      }
      if (target.role && el.getAttribute('role') === target.role) score += 1;
      return score;
    }
    function pickBest(nodes) {
      let best = null, bestScore = -1;
      for (const n of nodes) {
        const s = scoreCandidate(n);
        if (s > bestScore) { bestScore = s; best = n; }
      }
      return best;
    }
    function resolveByPath() {
      if (target.css_selector) {
        try {
          const nodes = document.querySelectorAll(target.css_selector);
          if (nodes.length) return pickBest(nodes);
        } catch (e) { /* invalid selector */ }
      }
      if (target.dom_path) {
        try {
          const snapshot = document.evaluate(target.dom_path, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          if (snapshot.snapshotLength) {
            const nodes = [];
            for (let i = 0; i < snapshot.snapshotLength; i++) nodes.push(snapshot.snapshotItem(i));
            return pickBest(nodes);
          }
        } catch (e) { /* invalid path */ }
      }
      return null;
    }

    const byTest = target.test_id
      ? document.querySelector(`[data-testid="${cssEscape(target.test_id)}"], [data-test-id="${cssEscape(target.test_id)}"]`)
      : null;
    if (byTest) return byTest; // explicit test hook: exact element (SPC 16)

    const byPath = resolveByPath();
    const byId = target.tux_id
      ? document.querySelector(`[data-tux-id="${cssEscape(target.tux_id)}"]`)
      : null;

    // A tux_id on a CONTAINER must not coarsen the target: when the path
    // resolves to an element inside the id element, the path is the finer,
    // correct target. Only trust the id over a path that drifted outside
    // of it (SPC 16: multiple independent signals, finest wins).
    if (byId) {
      if (byPath && (byId === byPath || byId.contains(byPath))) return byPath;
      return byId;
    }
    return byPath;
  }

  // ─── route + state tracking (SPC 13–15, 59) ───
  function currentRoute() {
    return location.pathname;
  }
  function uiState() {
    const state = {};
    document.querySelectorAll('[data-tux-state]').forEach((el) => {
      for (const pair of (el.getAttribute('data-tux-state') || '').split(';')) {
        const idx = pair.indexOf('=');
        if (idx > 0) state[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
      }
    });
    const tab = document.querySelector('[role="tab"][aria-selected="true"]');
    if (tab) state.tab = (tab.getAttribute('data-tux-tab') || tab.textContent || '').trim().toLowerCase().replace(/\s+/g, '-');
    const dialog = document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]');
    if (dialog) {
      state.modal = dialog.getAttribute('data-tux-id') || dialog.id
        || (dialog.getAttribute('aria-label') || 'dialog').trim().toLowerCase().replace(/\s+/g, '-');
    }
    return state;
  }

  let routeListenersBound = false;
  let onRouteChange = () => {};
  function trackRoute(cb) {
    onRouteChange = cb;
    if (routeListenersBound) return;
    routeListenersBound = true;
    const wrap = (orig) => function (...args) {
      const r = orig.apply(this, args);
      onRouteChange();
      return r;
    };
    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);
    window.addEventListener('popstate', () => onRouteChange());
    window.addEventListener('hashchange', () => onRouteChange());
  }

  // ─── UI shell ───
  let mode = false;
  let items = []; // feedback for current route
  const root = () => document.getElementById('tux-root');

  function ensureRoot() {
    let r = root();
    if (!r) {
      r = document.createElement('div');
      r.id = 'tux-root';
      document.body.appendChild(r);
    }
    return r;
  }
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function buildShell() {
    ensureRoot().innerHTML = `
      <div class="tux-float" data-tux-float data-tux-ui>
        <button class="tux-launcher" data-tux-launcher data-tux-ui>⬢</button>
        <span class="tux-launcher-hint" data-tux-hint data-tux-ui></span>
      </div>
      <aside class="tux-sidebar" data-tux-sidebar data-tux-ui>
        <div class="tux-sb-head"><span>TUX Review</span><button class="tux-sb-close" data-tux-sb-close>✕</button></div>
        <div class="tux-sb-meta" data-tux-sb-meta></div>
        <div class="tux-sb-list" data-tux-sb-list></div>
      </aside>
      <div class="tux-layer" data-tux-layer data-tux-ui></div>
      <div class="tux-toast" data-tux-toast data-tux-ui></div>`;
    const launcher = document.querySelector('[data-tux-launcher]');
    launcher.addEventListener('click', () => setMode(!mode));
    root().querySelector('[data-tux-sb-close]').addEventListener('click', closeSidebar);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { setMode(false); closeEditor(); }
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        setMode(!mode); // works even when a native <dialog> holds the top layer
      }
    });
  }

  // ─── top layer: keep the launcher clickable above modal backdrops ───
  // While a native <dialog> is open, everything outside the top layer sits
  // below its backdrop. The floating activation surface therefore moves
  // into the open dialog and returns when it closes (same wrapping
  // technique as the route tracking above).
  let topLayerBound = false;
  function bindTopLayer() {
    if (topLayerBound) return;
    topLayerBound = true;
    // Sidebar and toast move together with the float: while a modal is
    // open they would otherwise sit behind the backdrop.
    const MOVED = ['[data-tux-float]', '[data-tux-sidebar]', '[data-tux-toast]'];
    const enter = (dialog) => {
      for (const sel of MOVED) {
        const n = document.querySelector(sel);
        if (n && n.parentElement !== dialog) dialog.appendChild(n);
      }
    };
    const exit = () => {
      const r = root();
      if (!r) return;
      for (const sel of MOVED) {
        const n = document.querySelector(sel);
        if (n && n.parentElement !== r) r.appendChild(n);
      }
    };
    const proto = window.HTMLDialogElement && HTMLDialogElement.prototype;
    if (!proto) return;
    for (const name of ['showModal', 'close']) {
      const orig = proto[name];
      proto[name] = function (...args) {
        const r = orig.apply(this, args);
        if (name === 'showModal') enter(this); else exit();
        return r;
      };
    }
  }

  // Launcher state: boot invite → persistent "commenting on/off" label
  // plus a hover tooltip on the collapsed button.
  let interacted = false;
  function updateLauncherHint() {
    const launcher = document.querySelector('[data-tux-launcher]');
    const hint = document.querySelector('[data-tux-hint]');
    if (!launcher || !hint) return;
    let text;
    if (!interacted) {
      text = 'To activate TUX review, click here';
      hint.className = 'tux-launcher-hint tux-hint-invite';
      launcher.classList.add('tux-invite');
    } else if (mode) {
      text = 'Commenting on';
      hint.className = 'tux-launcher-hint tux-hint-on';
      launcher.classList.remove('tux-invite');
    } else {
      text = 'Commenting off';
      hint.className = 'tux-launcher-hint tux-hint-off';
      launcher.classList.remove('tux-invite');
    }
    hint.textContent = text;
  }

  function toast(msg) {
    const t = document.querySelector('[data-tux-toast]');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('tux-visible');
    clearTimeout(t._tm);
    t._tm = setTimeout(() => t.classList.remove('tux-visible'), 2200);
  }

  function setMode(v) {
    mode = !!v;
    document.body.classList.toggle('tux-mode', mode);
    document.querySelector('[data-tux-launcher]').classList.toggle('tux-active', mode);
    if (!interacted) interacted = true;
    updateLauncherHint();
    if (mode) {
      openSidebar();
      toast('Review mode on — click an element');
    } else {
      clearHover();
      closeEditor();
    }
  }

  // ─── selection ───
  let hoverEl = null;
  function clearHover() {
    if (hoverEl) { hoverEl.classList.remove('tux-hover'); hoverEl = null; }
  }
  // TUX's own chrome (overlay root, float, sidebar, layer, toast, editor,
  // markers) is never reviewable — independent of any user-set [data-tux-ui]
  // scope markers (SPC 16, 66). The attribute selectors also match while the
  // float/sidebar/toast reparent into a dialog's top layer.
  const TUX_CHROME = '#tux-root, [data-tux-float], [data-tux-sidebar], [data-tux-toast], [data-tux-layer], .tux-editor, .tux-marker';
  function inChrome(el) {
    return !!(el.closest && el.closest(TUX_CHROME));
  }
  // [data-tux-ui] marks reviewable scopes. With no user-set scope on the
  // page the whole document is reviewable; with scopes, only inside them.
  // TUX's own chrome never counts as a scope — it carries data-tux-ui too
  // and would otherwise make every page element unreachable (SPC 16, 66).
  function inScope(el) {
    const scopes = [...document.querySelectorAll('[data-tux-ui]')].filter((s) => !inChrome(s));
    if (!scopes.length) return true;
    return scopes.some((s) => s.contains(el));
  }
  function onMouseOver(e) {
    if (!mode) return;
    clearHover();
    const t = e.target.closest('body *');
    if (t && !inChrome(t) && inScope(t)) {
      t.classList.add('tux-hover');
      hoverEl = t;
    }
  }
  function onClick(e) {
    if (!mode) return;
    if (inChrome(e.target) || !inScope(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.target.closest('body *');
    if (target) openEditor({ el: target, mode: 'create' });
  }

  // ─── editor ───
  let editorState = null;
  function overlayHostFor(target) {
    // Targets inside a native <dialog> live in the browser top layer —
    // overlay UI must be portaled into the dialog or the backdrop covers it.
    return target.closest('dialog[open], [role="dialog"][aria-modal="true"]') || root().querySelector('[data-tux-layer]');
  }
  function closeEditor() {
    document.querySelectorAll('.tux-editing').forEach((n) => n.classList.remove('tux-editing'));
    const layer = root() && root().querySelector('[data-tux-layer]');
    if (layer) layer.querySelectorAll('.tux-editor').forEach((n) => n.remove());
    document.querySelectorAll('dialog[open] .tux-editor, [role="dialog"] .tux-editor').forEach((n) => n.remove());
    editorState = null;
  }
  function openEditor(state) {
    closeEditor();
    editorState = state;
    // keep the edit target visually marked for as long as its editor is
    // open — same treatment as the hover outline
    if (state.mode === 'edit' && state.el) state.el.classList.add('tux-editing');
    const host = overlayHostFor(state.el);
    const inTopLayer = host !== root().querySelector('[data-tux-layer]');
    const rect = state.el.getBoundingClientRect();
    const isCreate = state.mode === 'create';
    const box = el('div', 'tux-editor tux-open', `
      <div class="tux-ed-head"><span>${isCreate ? 'New feedback' : 'Edit feedback'}</span>
        <button class="tux-x" data-act="cancel">✕</button></div>
      <div class="tux-ed-target">${esc(describe(state.el))}</div>
      <label class="tux-ed-row"><span>Type</span>
        <select data-ed-type>
          <option value="change">change</option>
          <option value="issue">issue</option>
          <option value="question">question</option>
          <option value="approval">approval</option>
        </select></label>
      <textarea data-ed-text placeholder="What should change?"></textarea>
      <div class="tux-ed-actions">
        ${!isCreate ? '<button class="tux-btn-danger" data-act="delete">Delete</button>' : '<span></span>'}
        <button class="tux-btn-ghost" data-act="cancel">Cancel</button>
        <button class="tux-btn-primary" data-act="save">${isCreate ? 'Create' : 'Save'}</button>
      </div>`);
    host.appendChild(box);
    box.setAttribute('data-tux-ui', '');
    box.querySelector('[data-ed-type]').value = state.item ? state.item.feedback.type : 'change';
    box.querySelector('[data-ed-text]').value = state.item ? state.item.feedback.text : '';
    const place = () => {
      const b = box.getBoundingClientRect();
      let left;
      let top;
      if (inTopLayer) {
        left = Math.min(rect.left, window.innerWidth - b.width - 12);
        top = rect.bottom + 8;
        if (top + b.height > window.innerHeight - 8) top = rect.top - b.height - 8;
      } else {
        left = Math.min(rect.left + window.scrollX, window.innerWidth - b.width - 12);
        top = rect.bottom + window.scrollY + 8;
        if (top + b.height > window.scrollY + window.innerHeight) top = rect.top + window.scrollY - b.height - 8;
      }
      box.style.position = inTopLayer ? 'fixed' : 'absolute';
      box.style.left = `${Math.max(8, left)}px`;
      box.style.top = `${Math.max(8, top)}px`;
    };
    place();
    box.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const act = btn.dataset.act;
        if (act === 'cancel') return closeEditor();
        const type = box.querySelector('[data-ed-type]').value;
        const text = box.querySelector('[data-ed-text]').value.trim();
        try {
          if (act === 'save' && isCreate) {
            const fp = fingerprint(state.el);
            const { component_instance: instance, ...target } = fp;
            await api('/feedback', {
              method: 'POST',
              body: JSON.stringify({
                type, text,
                location: {
                  route: currentRoute(),
                  ...(fp.component ? { component: fp.component } : {}),
                  ...(instance ? { component_instance: instance } : {}),
                },
                target,
                ui_state: uiState(),
              }),
            });
            toast('Feedback created');
            closeEditor();
            await refresh();
          } else if (act === 'save') {
            await api(`/feedback/${encodeURIComponent(state.item.id)}`, {
              method: 'PATCH',
              body: JSON.stringify({ type, text }),
            });
            toast('Feedback updated');
            closeEditor();
            await refresh();
          } else if (act === 'delete') {
            await api(`/feedback/${encodeURIComponent(state.item.id)}`, { method: 'DELETE' });
            toast('Feedback deleted');
            closeEditor();
            await refresh();
          }
        } catch (err) {
          toast(`✗ ${err.message}`);
        }
      });
    });
    box.querySelector('[data-ed-text]').focus();
  }

  function describe(elm) {
    const cls = Array.from(elm.classList || []).filter((c) => !c.startsWith('tux-')).join('.');
    const txt = (elm.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    const name = elm.getAttribute('data-tux-id');
    return name ? `#${name}` : elm.tagName.toLowerCase() + (cls ? `.${cls}` : '') + (txt ? ` — ${txt}` : '');
  }

  // ─── markers ───
  function renderMarkers() {
    const layer = root().querySelector('[data-tux-layer]');
    layer.querySelectorAll('.tux-marker').forEach((m) => m.remove());
    document.querySelectorAll('dialog .tux-marker, [role="dialog"] .tux-marker').forEach((m) => m.remove());
    pinRegistry = [];
    for (const item of items) {
      const target = locate(item.target);
      if (!target) continue; // target temporarily gone; feedback stays persisted (SPC 60)
      const host = overlayHostFor(target);
      const inTopLayer = host !== layer;
      const pin = el('button', 'tux-marker', String(item.feedback.type[0].toUpperCase()));
      pin.dataset.id = item.id;
      pin.classList.toggle('tux-resolved', item.status !== 'open');
      pin.title = `${item.feedback.type}: ${item.feedback.text}`;
      pin.setAttribute('data-tux-ui', '');
      pin.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditor({ el: target, mode: 'edit', item });
      });
      host.appendChild(pin);
      pinRegistry.push({ target, pin, inTopLayer, lastKey: '' });
    }
    positionPins();
    bindReposition();
  }

  // Markers are anchored to the element's CURRENT rect — never to
  // coordinates captured at creation time. positionPins() runs on
  // resize/scroll/DOM mutations (rAF-throttled) so markers follow layout
  // changes: splitter drag, carousel transforms, dialogs opening and
  // closing, route-level reflows. Invisible targets hide their pin and
  // reveal it again when the element becomes visible (SPC 60).
  let pinRegistry = [];
  function positionPins() {
    for (const entry of pinRegistry) {
      const { pin, target, inTopLayer } = entry;
      const rects = target.getClientRects();
      const rect = target.getBoundingClientRect();
      const visible = rects.length > 0 && rect.width > 0 && rect.height > 0;
      const key = visible
        ? `${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)}x${Math.round(rect.height)}|${Math.round(window.scrollX)},${Math.round(window.scrollY)}`
        : 'hidden';
      if (entry.lastKey === key) continue;
      entry.lastKey = key;
      if (!visible) { pin.style.display = 'none'; continue; }
      pin.style.display = '';
      if (inTopLayer) {
        pin.style.position = 'fixed';
        pin.style.left = `${rect.left + rect.width - 12}px`;
        pin.style.top = `${Math.max(0, rect.top - 8)}px`;
      } else {
        pin.style.left = `${rect.left + window.scrollX + rect.width - 12}px`;
        pin.style.top = `${rect.top + window.scrollY - 8}px`;
      }
    }
  }
  let rafPending = false;
  function scheduleReposition() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; positionPins(); });
  }
  let repositionBound = false;
  function bindReposition() {
    if (repositionBound) return;
    repositionBound = true;
    window.addEventListener('resize', scheduleReposition);
    document.addEventListener('scroll', scheduleReposition, true);
    const start = () => {
      new MutationObserver(scheduleReposition).observe(document.documentElement, {
        childList: true, subtree: true, attributes: true,
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }

  async function refresh() {
    const route = currentRoute();
    const q = new URLSearchParams({ route });
    const payload = await api(`/feedback?${q}`).catch(() => null);
    items = payload ? payload.feedback : [];
    renderMarkers();
    renderSidebar();
  }

  // ─── sidebar ───
  function openSidebar() {
    document.querySelector('[data-tux-sidebar]').classList.add('tux-open');
    renderSidebar();
  }
  function closeSidebar() {
    document.querySelector('[data-tux-sidebar]').classList.remove('tux-open');
  }
  function renderSidebar() {
    const sb = document.querySelector('[data-tux-sidebar]');
    if (!sb) return;
    const open = items.filter((i) => i.status === 'open').length;
    sb.querySelector('[data-tux-sb-meta]').textContent =
      `${open} open · ${items.length - open} done · ${identity.display_name}`;
    const list = sb.querySelector('[data-tux-sb-list]');
    list.innerHTML = items.length
      ? items.map((i) => `
        <div class="tux-sb-item${i.status !== 'open' ? ' tux-done' : ''}" data-id="${esc(i.id)}">
          <span class="tux-sb-type tux-type-${esc(i.feedback.type)}">${esc(i.feedback.type)}</span>
          <span class="tux-sb-text">${esc(i.feedback.text)}</span>
          <span class="tux-sb-route">${esc((i.location && i.location.route) || '')}</span>
        </div>`).join('')
      : '<div class="tux-sb-empty">No feedback on this route.</div>';
    list.querySelectorAll('.tux-sb-item').forEach((node) => {
      node.addEventListener('click', () => {
        const item = items.find((i) => i.id === node.dataset.id);
        if (!item) return;
        const target = locate(item.target);
        if (target) {
          target.scrollIntoView({ block: 'center', behavior: 'smooth' });
          openEditor({ el: target, mode: 'edit', item });
        } else {
          toast('Target not on this page — feedback kept');
        }
      });
    });
  }

  // ─── boot ───
  function ensureStyles() {
    if (document.querySelector('link[data-tux-styles]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/__tux__/client.css';
    link.setAttribute('data-tux-styles', '');
    document.head.appendChild(link);
  }

  function boot() {
    if (!resolveEnabled()) return; // ?tux=off or config disabled → stay inert (SPC 66–68)
    ensureStyles();
    buildShell();
    updateLauncherHint();
    bindTopLayer();
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('click', onClick, true);
    trackRoute(() => { refresh(); });
    refresh();
    window.__TUX_READY__ = true;
    document.dispatchEvent(new CustomEvent('tux:ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.TUXReview = {
    setMode, refresh, uiState, fingerprint, resolveEnabled,
    get mode() { return mode; },
  };
})();
