/* MapGaps user interface. */
(function () {
  'use strict';

  const A = window.MapGapsAnalysis;
  const IO = window.MapGapsIO;
  const VOCABULARY = window.MAPGAPS_VOCABULARY || [];

  const TYPE_LABEL = Object.fromEntries(A.FLAG_TYPES.map((t) => [t.id, t.label]));
  const UNCERTAIN_TYPES = ['inconsistent', 'incomplete', 'contested'];
  const TYPE_COLOUR = {
    inconsistent: 'var(--inconsistent)', incomplete: 'var(--incomplete)',
    contested: 'var(--contested)', missing: 'var(--missing)',
  };

  const state = {
    analysis: null,
    filter: { mode: 'uncertain', dimension: 'temporal', type: 'incomplete' },
    selectedId: null,
    popup: { groupId: null, variant: null },
  };

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') node.className = v;
      else if (k === 'style') node.style.cssText = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) node.append(c);
    return node;
  };
  const dot = (type) => el('i', { class: `dot ${type}`, 'aria-hidden': 'true' });

  // ---------------------------------------------------------------- data

  function load(rows, label) {
    state.analysis = A.analyse(rows, VOCABULARY);
    state.selectedId = null;
    $('#source-label').textContent = label;
    $('#record-count').textContent = state.analysis.records.length;
    render();
  }

  function setStatus(message, isError = false) {
    const node = $('#source-status');
    node.textContent = message;
    node.classList.toggle('error', isError);
  }

  $('#file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const rows = IO.parseFile(file.name, await file.text());
      if (!rows.length) throw new Error('No records found in the file.');
      load(rows, file.name);
      setStatus(`Loaded ${rows.length} records from ${file.name}.`);
      $('#source').open = false;
    } catch (err) {
      setStatus(err.message, true);
    }
    e.target.value = '';
  });

  $('#europeana-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const button = e.target.querySelector('button');
    button.disabled = true;
    try {
      setStatus('Contacting Europeana…');
      const items = await IO.fetchEuropeana({
        apiKey: form.get('apiKey').trim(),
        query: form.get('query').trim(),
        max: Number(form.get('max')) || 200,
        onProgress: (n, total) => setStatus(`Fetched ${n} of ${total ?? '?'} results…`),
      });
      if (!items.length) throw new Error('The query returned no records.');
      load(items, `Europeana: ${form.get('query').trim() || 'all'}`);
      setStatus(`Loaded ${items.length} records from Europeana.`);
      $('#source').open = false;
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      button.disabled = false;
    }
  });

  $('#use-sample').addEventListener('click', () => {
    load(window.MAPGAPS_SAMPLE, 'Sample collection');
    setStatus('');
    $('#source').open = false;
  });

  // ------------------------------------------------------------- filters

  function buildFilters() {
    const dimension = $('#dimension');
    dimension.append(...A.DIMENSIONS.map((d) => el('option', { value: d.id }, d.label)), el('option', { value: 'all' }, 'All dimensions'));
    dimension.value = state.filter.dimension;

    $('#types').append(...UNCERTAIN_TYPES.map((t) =>
      el('label', {},
        el('input', { type: 'radio', name: 'type', value: t, checked: t === state.filter.type }),
        dot(t), TYPE_LABEL[t])));

    document.addEventListener('change', (e) => {
      if (e.target === dimension) state.filter.dimension = dimension.value;
      else if (e.target.name === 'mode') state.filter.mode = e.target.value;
      else if (e.target.name === 'type') state.filter.type = e.target.value;
      else return;
      keepRelevantSelection();
      render();
    });
  }

  /** After a filter change, jump to the top record if the selected one has nothing to show. */
  function keepRelevantSelection() {
    const current = state.analysis.records.find((r) => r.id === state.selectedId);
    if (current && A.matchingFlags(current, state.filter).length) return;
    const top = sortedRecords()[0];
    if (top && top.n) state.selectedId = top.record.id;
  }

  const activeType = () => (state.filter.mode === 'missing' ? 'missing' : state.filter.type);
  const inDimension = (fieldKey) =>
    state.filter.dimension === 'all' || A.FIELD_BY_KEY[fieldKey].dimension === state.filter.dimension;

  // ------------------------------------------------------------- render

  function render() {
    $('#type-filter').disabled = state.filter.mode === 'missing';
    renderOverview();
    renderGrid();
    renderRecord();
  }

  function renderOverview() {
    const rows = state.analysis.fieldStats.map((s) => {
      const pct = (n) => (s.total ? (100 * n) / s.total : 0);
      const { missing, incomplete } = s.completeness;
      return el('div', {
        class: `ov-row${inDimension(s.key) ? '' : ' dim'}`,
        title: `${s.label}: ${missing} missing, ${incomplete} incomplete, ${s.completeness.complete} complete`,
      },
      el('span', { class: 'ov-label' }, s.label),
      el('span', { class: 'ov-bar', role: 'img', 'aria-label': `${s.label}: ${Math.round(pct(missing))}% missing, ${Math.round(pct(incomplete))}% incomplete` },
        el('i', { class: 'missing', style: `width:${pct(missing)}%` }),
        el('i', { class: 'incomplete', style: `width:${pct(incomplete)}%` })),
      el('span', { class: 'ov-pct' }, `${Math.round(pct(s.completeness.complete))}%`));
    });
    const head = el('div', { class: 'ov-row ov-head' }, el('span', {}, 'Field'), el('span', {}, 'Share of records'), el('span', {}, 'Complete'));
    $('#overview').replaceChildren(head, ...rows);
  }

  function sortedRecords() {
    return state.analysis.records
      .map((r) => ({ record: r, n: A.matchingFlags(r, state.filter).length }))
      .sort((a, b) => b.n - a.n || b.record.flags.length - a.record.flags.length);
  }

  function intensity(n, max) {
    if (!n) return '0%';
    const steps = [35, 55, 75, 100];
    return `${steps[Math.min(steps.length - 1, Math.ceil((n / max) * steps.length) - 1)]}%`;
  }

  function renderGrid() {
    const list = sortedRecords();
    const max = Math.max(1, ...list.map((x) => x.n));
    const type = activeType();
    const flagged = list.filter((x) => x.n > 0).length;
    const dim = state.filter.dimension === 'all' ? 'all dimensions' : `${state.filter.dimension}`;

    $('#grid-title').textContent = `Records · ${TYPE_LABEL[type].toLowerCase()} (${dim})`;
    $('#grid-sub').textContent = `${flagged} of ${list.length} flagged · sorted from most to least`;

    if (!state.selectedId || !state.analysis.records.some((r) => r.id === state.selectedId)) {
      state.selectedId = list[0] && list[0].record.id;
    }

    $('#grid').replaceChildren(...list.map(({ record, n }) =>
      el('button', {
        class: 'tile', role: 'option', 'data-n': n, 'aria-selected': String(record.id === state.selectedId),
        style: `--c:${TYPE_COLOUR[type]};--k:${intensity(n, max)}`,
        title: `${record.title || record.id}\n${n} ${TYPE_LABEL[type].toLowerCase()} field value${n === 1 ? '' : 's'}`,
        'aria-label': `${record.title || record.id}: ${n} flagged`,
        onclick: () => select(record.id),
      }, n || '')));

    const scaleSteps = ['0%', '35%', '55%', '75%', '100%'];
    $('#scale').replaceChildren('fewer',
      ...scaleSteps.map((k) => el('i', { style: k === '0%' ? '' : `background:color-mix(in srgb, ${TYPE_COLOUR[type]} ${k}, var(--surface));border-color:transparent` })),
      `more flags (max ${max})`);
  }

  function select(id) {
    state.selectedId = id;
    renderGrid();
    renderRecord();
  }

  // ------------------------------------------------------ record detail

  function renderValue(record, field, value, valueIndex) {
    const flags = record.flags.filter((fl) => fl.field === field && fl.valueIndex === valueIndex);
    if (flags.some((fl) => fl.type === 'missing')) {
      return el('span', { class: 'value hl-missing' }, value || 'none');
    }
    const whole = flags.find((fl) => fl.type === 'contested') || flags.find((fl) => fl.type === 'incomplete');
    const terms = record.terms
      .filter((t) => t.field === field && t.valueIndex === valueIndex)
      .sort((a, b) => a.start - b.start);
    const parts = [];
    let cursor = 0;
    for (const t of terms) {
      if (t.start < cursor) continue;
      const flag = flags.find((fl) => fl.type === 'inconsistent' && fl.groupId === t.groupId && fl.start === t.start);
      const open = () => openSimilar(t.groupId, t.variant);
      parts.push(value.slice(cursor, t.start));
      parts.push(el('mark', {
        class: flag ? 'term' : 'term ref', tabindex: '0', role: 'button',
        title: `${flag ? flag.reason : 'Reference term; other forms are used elsewhere in the collection'}\nClick to see records with similar terms`,
        onclick: open,
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } },
      }, value.slice(t.start, t.end)));
      cursor = t.end;
    }
    parts.push(value.slice(cursor));
    return el('span', { class: `value${whole ? ` hl-${whole.type}` : ''}` }, ...parts);
  }

  function renderRecord() {
    const record = state.analysis.records.find((r) => r.id === state.selectedId);
    if (!record) {
      $('#record').replaceChildren(el('p', { class: 'empty' }, 'No records loaded.'));
      return;
    }
    const counts = {};
    for (const fl of record.flags) counts[fl.type] = (counts[fl.type] || 0) + 1;

    const head = el('div', { class: 'record-head' },
      el('p', { class: 'eyebrow' }, 'Selected record'),
      el('h2', {}, record.title || 'Untitled record'),
      el('div', { class: 'record-meta' },
        el('span', {}, record.id),
        record.provider && el('span', {}, record.provider),
        record.link && el('a', { href: record.link, target: '_blank', rel: 'noopener' }, 'View on Europeana ↗')),
      el('div', { class: 'counts' }, ...A.FLAG_TYPES.map((t) =>
        el('span', { class: 'count' }, dot(t.id), `${counts[t.id] || 0} ${t.label.toLowerCase()}`))));

    const cards = A.FIELDS.map((f) => {
      const values = f.multi ? record[f.key] : [record[f.key]];
      const flags = record.flags.filter((fl) => fl.field === f.key);
      const active = inDimension(f.key);
      return el('article', { class: `field ${active ? 'active' : 'inactive'}` },
        el('div', { class: 'field-label' }, f.label),
        el('div', { class: `values${f.key === 'description' ? ' long' : ''}` },
          values.length ? values.map((v, i) => renderValue(record, f.key, v, i)) : el('span', { class: 'value hl-missing' }, 'none')),
        flags.length ? el('ul', { class: 'reasons' }, ...flags.map((fl) =>
          el('li', {}, dot(fl.type), el('span', {}, el('b', {}, `(${TYPE_LABEL[fl.type].toLowerCase()})`), ' ', fl.reason)))) : null);
    });

    // cards of the selected dimension come first
    cards.sort((a, b) => b.classList.contains('active') - a.classList.contains('active'));
    $('#record').replaceChildren(head, el('div', { class: 'fields' }, ...cards));
  }

  // -------------------------------------------------- similar-terms popup

  function openSimilar(groupId, variant) {
    state.popup = { groupId, variant: variant || null };
    renderSimilar();
    const dialog = $('#similar');
    if (!dialog.open) dialog.showModal();
  }

  function renderSimilar() {
    const group = state.analysis.groups[state.popup.groupId];
    if (!group) return;
    $('#similar-title').textContent = group.label;
    $('#similar-note').textContent = group.note || (group.kind === 'variant'
      ? 'Values that look like the same term written in different ways.' : '');

    const chip = (key, label, count, preferred) => el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(state.popup.variant === key),
      onclick: () => { state.popup.variant = key; renderSimilar(); },
    }, label, el('span', { class: 'n' }, count), preferred ? el('span', { class: 'pref' }, 'reference') : null);

    $('#similar-variants').replaceChildren(
      chip(null, 'All', group.total, false),
      ...group.variants.map((v) => chip(v.key, v.label, v.count, v.preferred)));

    const recordById = new Map(state.analysis.records.map((r) => [r.id, r]));
    const occurrences = group.variants
      .filter((v) => !state.popup.variant || v.key === state.popup.variant)
      .flatMap((v) => v.occurrences.map((o) => ({ ...o, preferred: v.preferred })));

    $('#similar-list').replaceChildren(...occurrences.map((o) => {
      const record = recordById.get(o.recordId);
      const value = A.FIELD_BY_KEY[o.field].multi ? record[o.field][o.valueIndex] : record[o.field];
      const snippet = el('span', { class: 'snippet' },
        clip(value.slice(0, o.start), 'start'),
        el('mark', { class: o.preferred ? 'pref' : '' }, value.slice(o.start, o.end)),
        clip(value.slice(o.end), 'end'),
        el('span', { class: 'field-name' }, A.FIELD_BY_KEY[o.field].label));
      return el('li', {}, el('button', {
        type: 'button',
        onclick: () => { $('#similar').close(); select(o.recordId); },
      }, el('span', { class: 'item' }, el('b', {}, record.title || 'Untitled'), record.id), snippet));
    }));
  }

  function clip(s, side, n = 60) {
    if (s.length <= n) return s;
    return side === 'start' ? `…${s.slice(-n)}` : `${s.slice(0, n)}…`;
  }

  $('#similar').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.close(); // backdrop click
  });

  // ---------------------------------------------------------------- init

  buildFilters();
  load(window.MAPGAPS_SAMPLE || [], 'Sample collection');
})();
