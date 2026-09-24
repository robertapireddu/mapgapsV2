/* MapGaps user interface. */
(function () {
  'use strict';

  const A = window.MapGapsAnalysis;
  const IO = window.MapGapsIO;
  const TAXONOMY = window.MAPGAPS_TAXONOMY;
  const VOCABULARY = window.MAPGAPS_VOCABULARY || {};

  const TYPE_LABEL = Object.fromEntries(A.TYPES.map((t) => [t.id, t.label]));
  const ORIGIN_LABEL = Object.fromEntries(A.ORIGINS.map((o) => [o.id, o.label]));
  const RULES = Object.fromEntries(TAXONOMY.rules.map((r) => [r.id, r]));
  const UNCERTAIN_TYPES = ['inconsistent', 'incomplete', 'contested'];
  const TYPE_COLOUR = {
    inconsistent: 'var(--inconsistent)', incomplete: 'var(--incomplete)',
    contested: 'var(--contested)', missing: 'var(--missing)',
  };
  const TYPE_PRIORITY = ['inconsistent', 'contested', 'incomplete', 'missing'];

  const state = {
    analysis: null,
    filter: {
      mode: 'uncertain', dimension: 'temporal', type: 'incomplete',
      origins: new Set(A.ORIGINS.map((o) => o.id)),
    },
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
    state.analysis = A.analyse(rows, { taxonomy: TAXONOMY, vocabulary: VOCABULARY });
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
        full: form.get('full') === 'on',
        onProgress: (n, total, what = 'results') => setStatus(`Fetched ${n} of ${total ?? '?'} ${what}…`),
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

  const originsForMode = () => (state.filter.mode === 'missing'
    ? ['Empty field', 'Data conversion']
    : ['Epistemic', 'User input', 'Data conversion']);

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
      else if (e.target.name === 'origin') state.filter.origins[e.target.checked ? 'add' : 'delete'](e.target.value);
      else return;
      keepRelevantSelection();
      render();
    });
  }

  function renderOrigins() {
    $('#origins').replaceChildren(...originsForMode().map((o) =>
      el('label', { class: 'toggle' },
        el('input', { type: 'checkbox', name: 'origin', value: o, checked: state.filter.origins.has(o) }),
        el('span', {}, ORIGIN_LABEL[o]))));
  }

  /** After a filter change, jump to the top record if the selected one has nothing to show. */
  function keepRelevantSelection() {
    const current = state.analysis.records.find((r) => r.id === state.selectedId);
    if (current && A.flaggedFieldCount(current, state.filter)) return;
    const top = sortedRecords()[0];
    if (top && top.n) state.selectedId = top.record.id;
  }

  const activeType = () => (state.filter.mode === 'missing' ? 'missing' : state.filter.type);
  const fieldInDimension = (key) => state.filter.dimension === 'all' ||
    A.dimensionsOf(TAXONOMY, key).includes(state.filter.dimension);

  // ------------------------------------------------------------- render

  function render() {
    $('#type-filter').disabled = state.filter.mode === 'missing';
    renderOrigins();
    renderOverview();
    renderGrid();
    renderRules();
    renderRecord();
  }

  function renderOverview() {
    const head = el('div', { class: 'ov-row ov-head' }, el('span', {}, 'Field'), el('span', {}, 'Share of records'), el('span', {}, 'Complete'));
    const rows = state.analysis.fieldStats.map((s) => {
      const pct = (n) => (s.total ? (100 * n) / s.total : 0);
      return el('div', {
        class: `ov-row${fieldInDimension(s.key) ? '' : ' dim'}`,
        title: `${s.label} (${s.dimensions.join(', ')}): ${s.missing} missing, ${s.incomplete} incomplete, ${s.complete} complete`,
      },
      el('span', { class: 'ov-label' }, s.label),
      el('span', { class: 'ov-bar', role: 'img', 'aria-label': `${s.label}: ${Math.round(pct(s.missing))}% missing, ${Math.round(pct(s.incomplete))}% incomplete` },
        el('i', { class: 'missing', style: `width:${pct(s.missing)}%` }),
        el('i', { class: 'incomplete', style: `width:${pct(s.incomplete)}%` })),
      el('span', { class: 'ov-pct' }, `${Math.round(pct(s.complete))}%`));
    });
    $('#overview').replaceChildren(head, ...rows);
  }

  function sortedRecords() {
    return state.analysis.records
      .map((r) => ({ record: r, n: A.flaggedFieldCount(r, state.filter), flags: A.matchingFlags(r, state.filter).length }))
      .sort((a, b) => b.n - a.n || b.flags - a.flags || b.record.flags.length - a.record.flags.length);
  }

  function intensity(n, max) {
    if (!n) return '0%';
    const steps = [35, 55, 75, 100];
    return `${steps[Math.min(steps.length - 1, Math.ceil((n / max) * steps.length) - 1)]}%`;
  }

  const recordTitle = (r) => r.values.dcTitle[0] || r.id;

  function renderGrid() {
    const list = sortedRecords();
    const max = Math.max(1, ...list.map((x) => x.n));
    const type = activeType();
    const flagged = list.filter((x) => x.n > 0).length;
    const dim = state.filter.dimension === 'all' ? 'all dimensions' : state.filter.dimension;

    $('#grid-title').textContent = `Records · ${TYPE_LABEL[type].toLowerCase()} (${dim})`;
    $('#grid-sub').textContent = `${flagged} of ${list.length} flagged · most to least flagged fields`;

    if (!state.selectedId || !state.analysis.records.some((r) => r.id === state.selectedId)) {
      state.selectedId = list[0] && list[0].record.id;
    }

    $('#grid').replaceChildren(...list.map(({ record, n }) =>
      el('button', {
        class: 'tile', role: 'option', 'data-n': n, 'aria-selected': String(record.id === state.selectedId),
        style: `--c:${TYPE_COLOUR[type]};--k:${intensity(n, max)}`,
        title: `${recordTitle(record)}\n${n} ${TYPE_LABEL[type].toLowerCase()} field${n === 1 ? '' : 's'}`,
        'aria-label': `${recordTitle(record)}: ${n} flagged fields`,
        onclick: () => select(record.id),
      }, n || '')));

    const scaleSteps = ['0%', '35%', '55%', '75%', '100%'];
    $('#scale').replaceChildren('fewer',
      ...scaleSteps.map((k) => el('i', { style: k === '0%' ? '' : `background:color-mix(in srgb, ${TYPE_COLOUR[type]} ${k}, var(--surface));border-color:transparent` })),
      `more flagged fields (max ${max})`);
  }

  function renderRules() {
    const counts = new Map();
    for (const r of state.analysis.records) {
      for (const f of A.matchingFlags(r, state.filter)) {
        if (!counts.has(f.rule)) counts.set(f.rule, new Set());
        counts.get(f.rule).add(r.id);
      }
    }
    const type = activeType();
    const relevant = TAXONOMY.rules.filter((rule) =>
      (state.filter.dimension === 'all' || rule.dimension === state.filter.dimension) &&
      state.filter.origins.has(rule.subCategory || 'Empty field') &&
      (rule.type === type || counts.has(rule.id)));
    $('#rules-sub').textContent = `from ${TAXONOMY.source}`;
    $('#rules').replaceChildren(...relevant.map((rule) => {
      const n = counts.has(rule.id) ? counts.get(rule.id).size : 0;
      const needsProxies = /DATAC/.test(rule.id) && !state.analysis.hasProxies && !['EXT-DATAC-TEMP-INCOM', 'EXT-DATAC-TEMP-INCONS', 'EXT-DATAC-SPA-INCONS', 'EXT-DATAC-LING-INCONS', 'EXT-DATAC-LINK-INCOMP'].includes(rule.id);
      return el('li', { class: n ? '' : 'none', title: rule.issue },
        el('code', {}, rule.code),
        el('span', { class: 'rule-issue' }, rule.issue),
        el('span', { class: 'rule-meta' }, `${rule.scope} · ${rule.fields.join(', ')}`,
          needsProxies ? el('em', {}, ' · needs full records (both proxies)') : null),
        el('span', { class: 'rule-n' }, n));
    }));
  }

  function select(id) {
    state.selectedId = id;
    renderGrid();
    renderRecord();
  }

  // ------------------------------------------------------ record detail

  const strongest = (flags) => TYPE_PRIORITY.find((t) => flags.some((f) => f.type === t));

  function renderValue(record, field, value, valueIndex) {
    const flags = record.flags.filter((f) => f.field === field && f.valueIndex === valueIndex);
    const spanned = flags.filter((f) => f.start != null);
    const whole = flags.filter((f) => f.start == null);

    // spans: flagged terms plus terms that belong to a variant group (clickable)
    const spans = [];
    for (const f of spanned) spans.push({ start: f.start, end: f.end, flags: [f], groupId: f.groupId, variant: f.variant });
    for (const t of record.terms.filter((x) => x.field === field && x.valueIndex === valueIndex)) {
      const same = spans.find((s) => s.start === t.start && s.end === t.end);
      if (same) { same.groupId = same.groupId || t.groupId; same.variant = same.variant || t.variant; } else spans.push({ start: t.start, end: t.end, flags: [], groupId: t.groupId, variant: t.variant });
    }
    // merge flags that share a span, drop overlaps (longest first)
    const merged = [];
    for (const s of spans.sort((a, b) => b.end - b.start - (a.end - a.start))) {
      const same = merged.find((m) => m.start === s.start && m.end === s.end);
      if (same) { same.flags.push(...s.flags); same.groupId = same.groupId || s.groupId; same.variant = same.variant || s.variant; continue; }
      if (!merged.some((m) => s.start < m.end && m.start < s.end)) merged.push({ ...s, flags: [...s.flags] });
    }
    merged.sort((a, b) => a.start - b.start);

    const parts = [];
    let cursor = 0;
    for (const s of merged) {
      parts.push(value.slice(cursor, s.start));
      const type = strongest(s.flags);
      const clickable = Boolean(s.groupId && state.analysis.groups[s.groupId]);
      const open = () => openSimilar(s.groupId, s.variant);
      parts.push(el('mark', {
        class: `term${type ? ` t-${type}` : ' ref'}${clickable ? ' linked' : ''}`,
        tabindex: clickable ? '0' : null, role: clickable ? 'button' : null,
        title: [...s.flags.map((f) => `${f.code}: ${f.reason}`), clickable ? 'Click to see records with similar terms' : null].filter(Boolean).join('\n'),
        onclick: clickable ? open : null,
        onkeydown: clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } } : null,
      }, value.slice(s.start, s.end)));
      cursor = s.end;
    }
    parts.push(value.slice(cursor));
    const wholeType = strongest(whole);
    const groupId = (whole.find((f) => f.groupId) || {}).groupId;
    const node = el('span', { class: `value${wholeType ? ` hl-${wholeType}` : ''}${A.isPlaceholder(value) ? ' hl-missing' : ''}` }, ...parts);
    if (groupId && state.analysis.groups[groupId] && !merged.length) {
      node.classList.add('linked');
      node.tabIndex = 0;
      node.title = 'Click to see the related records';
      node.addEventListener('click', () => openSimilar(groupId, (whole.find((f) => f.groupId) || {}).variant));
    }
    return node;
  }

  function reasonItem(f) {
    return el('li', {},
      dot(f.type),
      el('span', {},
        el('code', { title: (RULES[f.rule] || {}).issue || '' }, f.code), ' ',
        el('b', {}, TYPE_LABEL[f.type].toLowerCase()), ' ',
        f.reason,
        el('span', { class: 'scope' }, ` · ${f.scope} · ${ORIGIN_LABEL[f.origin]}`)));
  }

  function renderRecord() {
    const record = state.analysis.records.find((r) => r.id === state.selectedId);
    if (!record) {
      $('#record').replaceChildren(el('p', { class: 'empty' }, 'No records loaded.'));
      return;
    }
    const counts = {};
    for (const f of record.flags) counts[f.type] = (counts[f.type] || 0) + 1;

    const head = el('div', { class: 'record-head' },
      el('p', { class: 'eyebrow' }, 'Selected record'),
      el('h2', {}, recordTitle(record)),
      el('div', { class: 'record-meta' },
        el('span', {}, record.id),
        record.provider && el('span', {}, record.provider),
        record.target && el('span', {}, 'provider + Europeana proxies'),
        record.link && el('a', { href: record.link, target: '_blank', rel: 'noopener' }, 'View on Europeana ↗')),
      el('div', { class: 'counts' }, ...A.TYPES.map((t) =>
        el('span', { class: 'count' }, dot(t.id), `${counts[t.id] || 0} ${t.label.toLowerCase()}`))),
      record.sameObject && record.sameObject.length ? el('p', { class: 'same-object' },
        'Same object also described in: ',
        ...record.sameObject.map((id, i) => [i ? ', ' : '', el('button', { type: 'button', class: 'linkish', onclick: () => select(id) }, id)])) : null);

    const cards = A.FIELDS.map((f) => {
      const values = record.values[f.key];
      const flags = record.flags.filter((x) => x.field === f.key);
      const active = fieldInDimension(f.key);
      const shown = flags.filter((x) => state.filter.dimension === 'all' || x.dimension === state.filter.dimension || !active);
      const target = record.target && record.target[f.key];
      return el('article', { class: `field ${active ? 'active' : 'inactive'}` },
        el('div', { class: 'field-label' }, f.label, el('span', { class: 'dims' }, A.dimensionsOf(TAXONOMY, f.key).join(' · '))),
        el('div', { class: `values${f.key === 'dcDescription' ? ' long' : ''}` },
          values.length ? values.map((v, i) => renderValue(record, f.key, v, i)) : el('span', { class: 'value hl-missing' }, 'none')),
        target && (target.length || values.length) ? el('p', { class: 'target' },
          el('span', {}, 'Europeana proxy: '), target.length ? target.join(' · ') : el('em', {}, 'nothing')) : null,
        shown.length ? el('ul', { class: 'reasons' }, ...shown.map(reasonItem)) : null);
    });

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
    if (state.popup.variant && !group.variants.some((v) => v.key === state.popup.variant)) state.popup.variant = null;
    const rule = RULES[group.rule || (group.kind === 'vocabulary' && !group.spatial ? 'INT-LING-INCONS' : '')];
    $('#similar-title').textContent = group.label;
    $('#similar-note').replaceChildren(
      rule ? el('code', {}, rule.code) : '', rule ? ' ' : '',
      group.note || '');

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
      const value = record.values[o.field][o.valueIndex];
      const snippet = el('span', { class: 'snippet' },
        clip(value.slice(0, o.start), 'start'),
        el('mark', { class: o.preferred ? 'pref' : '' }, value.slice(o.start, o.end)),
        clip(value.slice(o.end), 'end'),
        el('span', { class: 'field-name' }, A.FIELD_BY_KEY[o.field].label));
      return el('li', {}, el('button', {
        type: 'button',
        onclick: () => { $('#similar').close(); select(o.recordId); },
      }, el('span', { class: 'item' }, el('b', {}, recordTitle(record)), record.id), snippet));
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
