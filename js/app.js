/* MapGaps Version 3 user interface: attribute-first incompleteness map. */
(function () {
  'use strict';

  const A = window.MapGapsAnalysis;
  const IO = window.MapGapsIO;
  const TAXONOMY = window.MAPGAPS_TAXONOMY;
  const VOCABULARY = window.MAPGAPS_VOCABULARY || {};
  const RULES = Object.fromEntries(TAXONOMY.rules.map((r) => [r.id, r]));

  /** The seven attributes the dashboard maps, in reading order. */
  const ATTRIBUTES = [
    { key: 'dcTitle', name: 'Title', short: 'Title', dimension: 'Linguistic', role: 'Baseline identification of the object' },
    { key: 'dcDescription', name: 'Description', short: 'Descr.', dimension: 'Linguistic', role: 'Main descriptive content: vague or non-descriptive text matters most here' },
    { key: 'dcSubject', name: 'Subject', short: 'Subject', dimension: 'Linguistic', role: 'What the object is about' },
    { key: 'dcCreator', name: 'Creator', short: 'Creator', dimension: 'Attributional', role: 'Who made it' },
    { key: 'dctermsCreated', name: 'Created / year', short: 'Created', field: 'dctermsCreated · year', dimension: 'Temporal · intrinsic', role: 'When it was made' },
    { key: 'edmCountry', name: 'Country', short: 'Country', dimension: 'Spatial · intrinsic', role: 'Place of origin' },
    { key: 'dcType', name: 'Type', short: 'Type', dimension: 'Linguistic', role: 'Genre or category: gives interpretive context' },
  ];
  const ATTR_KEYS = ATTRIBUTES.map((a) => a.key);
  const ATTR_BY_KEY = Object.fromEntries(ATTRIBUTES.map((a) => [a.key, a]));
  const CONTEXT_FIELDS = ['dcDate', 'dcCoverage', 'dctermsProvenance', 'dcContributor'];

  const DIMENSIONS = [{ id: 'all', label: 'All' }, ...A.DIMENSIONS];
  const TYPES = [
    { id: 'all', label: 'All gaps' },
    { id: 'missing', label: 'Missing' },
    { id: 'incomplete', label: 'Incomplete' },
    { id: 'inconsistent', label: 'Inconsistent' },
    { id: 'contested', label: 'Contested' },
  ];
  const TYPE_LABEL = Object.fromEntries(A.TYPES.map((t) => [t.id, t.label]));
  const ORIGIN_LABEL = {
    Epistemic: 'Intrinsic · epistemic', 'User input': 'Extrinsic · user input',
    'Data conversion': 'Extrinsic · data conversion', 'Empty field': 'Empty field',
  };
  const TYPE_PRIORITY = ['inconsistent', 'contested', 'incomplete', 'missing'];

  const state = {
    analysis: null,
    dimension: 'all',
    type: 'all',
    origins: new Set(Object.keys(ORIGIN_LABEL)),
    focus: null, // attribute key picked from the cards
    onlyGaps: true,
    selectedId: null,
    selectedField: null,
    popup: { groupId: null, variant: null },
  };

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') node.className = v;
      else if (k === 'style') node.style.cssText = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) node.append(c);
    return node;
  };
  const dot = (type) => el('i', { class: `dot ${type}`, 'aria-hidden': 'true' });
  const pct = (n, total) => (total ? Math.round((100 * n) / total) : 0);
  const recordTitle = (r) => r.values.dcTitle[0] || r.id;

  // ------------------------------------------------------------ filters → flags

  const inDimension = (key) => state.dimension === 'all' || A.dimensionsOf(TAXONOMY, key).includes(state.dimension);
  const attrsInView = () => ATTR_KEYS.filter((k) => inDimension(k) && (!state.focus || state.focus === k));

  /** Flags on one attribute of a record that pass the dimension, type and origin filters. */
  function flagsInView(record, key, { ignoreType = false } = {}) {
    return record.flags.filter((f) => f.field === key &&
      (state.dimension === 'all' || f.dimension === state.dimension) &&
      (ignoreType || state.type === 'all' || f.type === state.type) &&
      state.origins.has(f.origin));
  }

  /** How one matrix cell looks under the current filters. */
  function cellState(record, key) {
    if (!attrsInView().includes(key)) return { cls: 's-off', flags: [] };
    const flags = flagsInView(record, key);
    if (state.type !== 'all') return { cls: flags.length ? `h-${state.type}` : 's-clear', flags };
    const types = new Set(flags.map((f) => f.type));
    const cls = types.has('missing') ? 's-missing' : types.has('incomplete') ? 's-incomplete' : 's-complete';
    return { cls, flags, inconsistent: types.has('inconsistent'), contested: types.has('contested') };
  }

  /** Incompleteness level over the seven attributes: missing counts 1, incomplete ½. */
  function levelOf(record) {
    let score = 0;
    for (const key of ATTR_KEYS) {
      const s = A.completenessOf(record, key);
      score += s === 'missing' ? 1 : s === 'incomplete' ? 0.5 : 0;
    }
    return score / ATTR_KEYS.length;
  }

  function rows() {
    const keys = attrsInView();
    return state.analysis.records
      .map((record) => {
        const gaps = keys.filter((k) => flagsInView(record, k).length).length;
        return { record, gaps, level: levelOf(record) };
      })
      .filter((r) => !state.onlyGaps || r.gaps > 0)
      .sort((a, b) => b.gaps - a.gaps || b.level - a.level);
  }

  // ---------------------------------------------------------------- data

  function load(input, label) {
    state.analysis = A.analyse(input, { taxonomy: TAXONOMY, vocabulary: VOCABULARY });
    state.selectedId = null;
    state.selectedField = null;
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
      const input = IO.parseFile(file.name, await file.text());
      if (!input.length) throw new Error('No records found in the file.');
      load(input, file.name);
      setStatus(`Loaded ${input.length} records from ${file.name}.`);
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
      if (!items.length) throw new Error('The query returned no records. Try a broader query.');
      load(items, `Europeana: ${form.get('query').trim() || 'all'}`);
      setStatus(`Loaded ${items.length} records from Europeana.`);
      $('#source').open = false;
    } catch (err) {
      setStatus(`${err.message} Check the API key and query, or load a saved file instead.`, true);
    } finally {
      button.disabled = false;
    }
  });

  $('#use-sample').addEventListener('click', () => {
    load(window.MAPGAPS_SAMPLE, 'Sample collection');
    setStatus('');
    $('#source').open = false;
  });

  $('#only-gaps').addEventListener('change', (e) => {
    state.onlyGaps = e.target.checked;
    render();
  });

  // ------------------------------------------------------------- filter controls

  function segmented(container, options, get, set) {
    container.replaceChildren(...options.map((o) => el('button', {
      type: 'button', role: 'radio', 'aria-checked': String(get() === o.id),
      onclick: () => { set(o.id); render(); },
    }, o.id !== 'all' && TYPE_LABEL[o.id] ? dot(o.id) : null, o.label)));
  }

  function renderFilters() {
    segmented($('#dimension-filter'), DIMENSIONS, () => state.dimension, (v) => { state.dimension = v; });
    segmented($('#type-filter'), TYPES, () => state.type, (v) => { state.type = v; });
    $('#origin-filter').replaceChildren(...Object.entries(ORIGIN_LABEL).map(([id, label]) => el('button', {
      type: 'button', class: 'chip-toggle', 'aria-pressed': String(state.origins.has(id)),
      onclick: () => { state.origins[state.origins.has(id) ? 'delete' : 'add'](id); render(); },
    }, label)));

    const dim = state.dimension === 'all' ? 'all dimensions' : `${state.dimension} gaps`;
    const type = state.type === 'all' ? 'every gap type' : state.type;
    const names = attrsInView().map((k) => ATTR_BY_KEY[k].name);
    $('#filter-summary').replaceChildren(el('span', {},
      'Showing ', el('b', {}, dim), ', ', el('b', {}, type),
      names.length ? [' in ', el('b', {}, names.join(', '))] : ' (no attribute is checked for this dimension)',
      state.focus ? [' · ', el('button', { type: 'button', class: 'linkish', onclick: () => { state.focus = null; render(); } }, 'show all attributes')] : ''));
  }

  // ------------------------------------------------------------- render

  function render() {
    hideTooltip();
    renderFilters();
    renderAttributes();
    const list = rows();
    if (!state.selectedId || !state.analysis.records.some((r) => r.id === state.selectedId) ||
        (list.length && !list.some((r) => r.record.id === state.selectedId))) {
      state.selectedId = list[0] ? list[0].record.id : (state.analysis.records[0] || {}).id;
      state.selectedField = null;
    }
    renderMatrix(list);
    renderRules();
    renderRecord();
  }

  function renderAttributes() {
    const stats = Object.fromEntries(state.analysis.fieldStats.map((s) => [s.key, s]));
    const records = state.analysis.records;
    $('#attributes').replaceChildren(...ATTRIBUTES.map((a) => {
      const s = stats[a.key];
      const count = (pred) => records.filter((r) => r.flags.some((f) => f.field === a.key && pred(f))).length;
      const inconsistent = count((f) => f.type === 'inconsistent');
      const contested = count((f) => f.type === 'contested');
      const vague = count((f) => f.vague);
      const derived = records.filter((r) => r.derived && r.derived[a.key]).length;
      const view = attrsInView().includes(a.key);
      return el('button', {
        type: 'button',
        class: `attr${view ? ' in-view' : ''}${!inDimension(a.key) || (state.focus && state.focus !== a.key) ? ' out' : ''}`,
        'aria-pressed': String(state.focus === a.key),
        title: state.focus === a.key ? 'Show all attributes again' : `Focus the map on ${a.name}`,
        onclick: () => { state.focus = state.focus === a.key ? null : a.key; render(); },
      },
      el('span', { class: 'attr-dim' }, a.dimension),
      el('span', { class: 'attr-name' }, el('b', {}, a.name)),
      el('span', { class: 'attr-field' }, a.field || a.key),
      el('span', { class: 'attr-role' }, a.role),
      el('span', { class: 'attr-pct' }, el('b', {}, `${pct(s.complete, s.total)}%`), 'complete'),
      el('span', { class: 'bar', role: 'img', 'aria-label': `${a.name}: ${pct(s.complete, s.total)}% complete, ${pct(s.incomplete, s.total)}% incomplete, ${pct(s.missing, s.total)}% missing` },
        el('i', { class: 'complete', style: `flex:${s.complete}` }),
        el('i', { class: 'incomplete', style: `flex:${s.incomplete}` }),
        el('i', { class: 'missing', style: `flex:${s.missing}` })),
      el('span', { class: 'attr-gaps' },
        el('span', {}, `${pct(s.incomplete, s.total)}% incomplete`),
        el('span', {}, `${pct(s.missing, s.total)}% missing`),
        inconsistent ? el('span', {}, el('i', { class: 'mk mk-inconsistent' }), `${inconsistent} inconsistent`) : null,
        contested ? el('span', {}, el('i', { class: 'mk mk-contested' }), `${contested} contested`) : null,
        vague ? el('span', {}, `${vague} vague`) : null,
        derived ? el('span', {}, `${derived} from year`) : null));
    }));
  }

  function renderMatrix(list) {
    const view = attrsInView();
    $('#matrix thead').replaceChildren(el('tr', {},
      el('th', { class: 'rec-h', scope: 'col' }, 'Record'),
      ...ATTRIBUTES.map((a) => el('th', { scope: 'col', class: view.includes(a.key) ? '' : 'out', title: a.role }, a.short, el('span', { class: 'mono' }, a.key === 'dctermsCreated' ? 'created' : a.key.replace(/^(dc|edm)/, '').toLowerCase()))),
      el('th', { scope: 'col', title: 'Share of the seven attributes that are missing (1) or incomplete (½)' }, 'Level')));

    const total = state.analysis.records.length;
    $('#map-sub').textContent = state.onlyGaps
      ? `${list.length} of ${total} records have gaps in view · sorted by attributes affected, then incompleteness level`
      : `${total} records · sorted by attributes affected, then incompleteness level`;

    if (!list.length) {
      $('#matrix tbody').replaceChildren(el('tr', { class: 'empty-row' }, el('td', { colspan: ATTRIBUTES.length + 2 },
        'No record has gaps for this selection. Choose another dimension or gap type, or turn on more origins.')));
      return;
    }

    $('#matrix tbody').replaceChildren(...list.map(({ record, level }) => {
      const selected = record.id === state.selectedId;
      return el('tr', { class: selected ? 'selected' : '' },
        el('td', { class: 'rec' }, el('button', {
          type: 'button', class: 'rec-btn', onclick: () => select(record.id, null),
        }, el('b', {}, recordTitle(record)), el('span', {}, record.id))),
        ...ATTRIBUTES.map((a) => {
          const s = cellState(record, a.key);
          const n = state.type !== 'all' && s.flags.length > 1 ? s.flags.length : null;
          return el('td', { class: 'c' }, el('button', {
            type: 'button', class: `cell ${s.cls}`,
            'aria-label': `${recordTitle(record)}, ${a.name}: ${describeCell(record, a.key, s)}`,
            onclick: () => select(record.id, a.key),
            onmouseenter: (e) => showTooltip(e.currentTarget, record, a, s),
            onfocus: (e) => showTooltip(e.currentTarget, record, a, s),
            onmouseleave: hideTooltip, onblur: hideTooltip,
          },
          s.inconsistent ? el('i', { class: 'm-inc' }) : null,
          s.contested ? el('i', { class: 'm-con' }) : null,
          n ? el('span', { class: 'n' }, n) : null));
        }),
        el('td', { class: 'lvl' }, el('span', { class: 'lvl-bar' }, el('i', { style: `--w:${Math.round(level * 100)}%` }), `${Math.round(level * 100)}%`)));
    }));
  }

  function describeCell(record, key, s) {
    if (s.cls === 's-off') return 'not checked for this dimension';
    if (state.type === 'all') {
      const base = A.completenessOf(record, key);
      const extra = [s.inconsistent && 'inconsistent', s.contested && 'contested'].filter(Boolean);
      const shown = s.cls === 's-missing' ? 'missing' : s.cls === 's-incomplete' ? 'incomplete' : base === 'complete' ? 'complete' : 'no gaps in view';
      return [shown, ...extra].join(', ');
    }
    return s.flags.length ? `${s.flags.length} ${state.type} flag${s.flags.length > 1 ? 's' : ''}` : `no ${state.type} gaps`;
  }

  // ------------------------------------------------------------- tooltip

  function showTooltip(anchor, record, attr, s) {
    const tip = $('#tooltip');
    const reasons = s.flags.slice(0, 4).map((f) => el('li', {}, `${f.code}: ${f.reason}`));
    tip.replaceChildren(...[
      el('b', {}, recordTitle(record)),
      el('span', { class: 't-state' }, `${attr.name} · ${describeCell(record, attr.key, s)}`),
      reasons.length ? el('ul', {}, ...reasons) : null,
      s.flags.length > 4 ? el('div', {}, `+ ${s.flags.length - 4} more`) : null].filter(Boolean));
    tip.hidden = false;
    const r = anchor.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    const top = r.top - h - 8 > 8 ? r.top - h - 8 : r.bottom + 8;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }
  function hideTooltip() {
    const tip = $('#tooltip');
    if (tip) tip.hidden = true;
  }
  window.addEventListener('scroll', hideTooltip, true);

  // ------------------------------------------------------------- rules

  function renderRules() {
    const counts = new Map();
    for (const r of state.analysis.records) {
      for (const key of attrsInView()) {
        for (const f of flagsInView(r, key)) {
          if (!counts.has(f.rule)) counts.set(f.rule, new Set());
          counts.get(f.rule).add(r.id);
        }
      }
    }
    const relevant = TAXONOMY.rules.filter((rule) => rule.fields.some((f) => attrsInView().includes(f)) &&
      (state.dimension === 'all' || rule.dimension === state.dimension) &&
      (state.type === 'all' || rule.type === state.type || counts.has(rule.id)) &&
      state.origins.has(rule.subCategory || 'Empty field'));
    $('#rules').replaceChildren(...relevant.map((rule) => {
      const n = counts.has(rule.id) ? counts.get(rule.id).size : 0;
      return el('li', { class: n ? '' : 'none' },
        el('code', { class: 'code' }, rule.code),
        el('span', { class: 'rule-issue' }, rule.issue),
        el('span', { class: 'rule-meta' }, `${rule.scope} · ${rule.fields.filter((f) => ATTR_KEYS.includes(f)).join(', ')}`),
        el('span', { class: 'rule-n', title: 'records flagged' }, n));
    }));
  }

  // ------------------------------------------------------------- record panel

  function select(id, field) {
    state.selectedId = id;
    state.selectedField = field;
    for (const tr of document.querySelectorAll('#matrix tbody tr')) tr.classList.remove('selected');
    renderMatrix(rows());
    renderRecord();
    if (field) {
      const row = document.querySelector(`.fieldrow[data-key="${field}"]`);
      if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    if (window.matchMedia('(max-width: 1000px)').matches) $('#record').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  const strongest = (flags) => TYPE_PRIORITY.find((t) => flags.some((f) => f.type === t));

  function renderValue(record, field, value, valueIndex) {
    const flags = record.flags.filter((f) => f.field === field && f.valueIndex === valueIndex);
    const spans = [];
    for (const f of flags.filter((x) => x.start != null)) spans.push({ start: f.start, end: f.end, flags: [f], groupId: f.groupId, variant: f.variant });
    for (const t of record.terms.filter((x) => x.field === field && x.valueIndex === valueIndex)) {
      spans.push({ start: t.start, end: t.end, flags: [], groupId: t.groupId, variant: t.variant });
    }
    const merged = [];
    for (const s of spans.sort((a, b) => b.end - b.start - (a.end - a.start))) {
      const same = merged.find((m) => m.start === s.start && m.end === s.end);
      if (same) {
        same.flags.push(...s.flags);
        same.groupId = same.groupId || s.groupId;
        same.variant = same.variant || s.variant;
      } else if (!merged.some((m) => s.start < m.end && m.start < s.end)) merged.push({ ...s, flags: [...s.flags] });
    }
    merged.sort((a, b) => a.start - b.start);
    // a span covering the whole value is shown as a value-level highlight
    const wholeSpan = merged.length === 1 && merged[0].start === 0 && merged[0].end === value.length;

    const parts = [];
    let cursor = 0;
    for (const s of wholeSpan ? [] : merged) {
      parts.push(value.slice(cursor, s.start));
      const type = strongest(s.flags);
      const linked = Boolean(s.groupId && state.analysis.groups[s.groupId]);
      const open = () => openSimilar(s.groupId, s.variant);
      parts.push(el('mark', {
        class: `term${type ? ` t-${type}` : ' ref'}${linked ? ' linked' : ''}`,
        tabindex: linked ? '0' : null, role: linked ? 'button' : null,
        title: [...s.flags.map((f) => `${f.code}: ${f.reason}`), linked ? 'Click to see records with similar terms' : null].filter(Boolean).join('\n'),
        onclick: linked ? open : null,
        onkeydown: linked ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } } : null,
      }, value.slice(s.start, s.end)));
      cursor = s.end;
    }
    parts.push(value.slice(cursor));
    const whole = flags.filter((f) => f.start == null || wholeSpan);
    const type = strongest(whole);
    const node = el('span', { class: `value${type ? ` hl-${type}` : ''}${A.isPlaceholder(value) ? ' hl-missing' : ''}` }, ...parts);
    const group = wholeSpan ? merged[0] : whole.find((f) => f.groupId);
    if (group && group.groupId && state.analysis.groups[group.groupId]) {
      node.classList.add('linked');
      node.tabIndex = 0;
      node.setAttribute('role', 'button');
      node.title = 'Click to see records with similar terms';
      node.addEventListener('click', () => openSimilar(group.groupId, group.variant));
      node.addEventListener('keydown', (e) => { if (e.key === 'Enter') openSimilar(group.groupId, group.variant); });
    }
    return node;
  }

  function renderRecord() {
    const record = state.analysis.records.find((r) => r.id === state.selectedId);
    if (!record) {
      $('#record').replaceChildren(el('p', { class: 'empty' }, 'Load a collection to see its records.'));
      return;
    }
    const level = levelOf(record);
    const states = ATTR_KEYS.map((k) => A.completenessOf(record, k));
    const missing = states.filter((s) => s === 'missing').length;
    const incomplete = states.filter((s) => s === 'incomplete').length;

    const head = el('div', { class: 'rec-head' },
      el('p', { class: 'eyebrow' }, 'Selected record'),
      el('h2', {}, recordTitle(record)),
      el('div', { class: 'rec-meta' },
        el('span', { class: 'mono' }, record.id),
        record.provider ? el('span', {}, record.provider) : null,
        record.link ? el('a', { href: record.link, target: '_blank', rel: 'noopener' }, 'View on Europeana ↗') : null),
      el('div', { class: 'level' },
        el('span', { class: 'lvl-bar' }, el('i', { style: `--w:${Math.round(level * 100)}%` }), `Incompleteness level ${Math.round(level * 100)}%`),
        el('span', { class: 'sub' }, `${missing} missing · ${incomplete} incomplete · ${7 - missing - incomplete} complete, of 7 attributes`)),
      record.sameObject && record.sameObject.length ? el('p', { class: 'same-object' }, 'Same object also described in ',
        ...record.sameObject.map((id, i) => [i ? ', ' : '', el('button', { type: 'button', class: 'linkish', onclick: () => select(id, null) }, id)])) : null);

    const view = attrsInView();
    const fieldRows = ATTRIBUTES.map((a) => {
      const values = record.values[a.key];
      const status = A.completenessOf(record, a.key);
      const all = record.flags.filter((f) => f.field === a.key);
      const shown = new Set(flagsInView(record, a.key));
      const target = record.target && record.target[a.key];
      return el('article', {
        class: `fieldrow${view.includes(a.key) ? ' in-view' : ' out'}${state.selectedField === a.key ? ' focus' : ''}`,
        'data-key': a.key,
      },
      el('div', { class: 'fieldrow-head' },
        el('b', {}, a.name), el('span', { class: 'mono' }, a.field || a.key),
        el('span', { class: `pill ${status}` }, status)),
      el('div', { class: `values${a.key === 'dcDescription' ? ' long' : ''}` },
        values.length ? values.map((v, i) => renderValue(record, a.key, v, i)) : el('span', { class: 'value none' }, 'no value')),
      record.derived && record.derived[a.key] ? el('p', { class: 'derived' }, 'dctermsCreated is empty; value taken from Europeana\'s normalised year') : null,
      target && (target.length || values.length) && a.key !== 'edmCountry'
        ? el('p', { class: 'target' }, el('span', {}, 'Europeana proxy: '), target.length ? target.join(' · ') : el('em', {}, 'nothing')) : null,
      all.length ? el('ul', { class: 'reasons' }, ...all
        .sort((x, y) => shown.has(y) - shown.has(x))
        .map((f) => el('li', { class: shown.has(f) ? '' : 'dim' }, dot(f.type), el('span', {},
          el('code', { class: 'code', title: (RULES[f.rule] || {}).issue || '' }, f.code), ' ',
          el('b', {}, TYPE_LABEL[f.type].toLowerCase()), ' ', f.reason,
          el('span', {}, ` · ${f.scope} · ${ORIGIN_LABEL[f.origin]}`))))) : null);
    });

    const context = CONTEXT_FIELDS.filter((k) => record.values[k].length);
    const other = context.length ? el('details', { class: 'other' },
      el('summary', {}, 'Other fields in the record'),
      el('dl', {}, ...context.map((k) => [el('dt', {}, k), el('dd', {}, record.values[k].join(' · '))]))) : null;

    $('#record').replaceChildren(...[head, el('div', { class: 'fieldrows' }, ...fieldRows), other].filter(Boolean));
  }

  // -------------------------------------------------- similar-terms pop-up

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
    $('#similar-note').replaceChildren(rule ? el('code', { class: 'code' }, rule.code) : '', rule ? ' ' : '', group.note || '');

    const chip = (key, label, count, preferred) => el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(state.popup.variant === key),
      onclick: () => { state.popup.variant = key; renderSimilar(); },
    }, label, el('span', { class: 'n' }, count), preferred ? el('span', { class: 'pref' }, 'reference') : null);
    $('#similar-variants').replaceChildren(chip(null, 'All', group.total, false),
      ...group.variants.map((v) => chip(v.key, v.label, v.count, v.preferred)));

    const byId = new Map(state.analysis.records.map((r) => [r.id, r]));
    const occurrences = group.variants
      .filter((v) => !state.popup.variant || v.key === state.popup.variant)
      .flatMap((v) => v.occurrences.map((o) => ({ ...o, preferred: v.preferred })));
    $('#similar-list').replaceChildren(...occurrences.map((o) => {
      const record = byId.get(o.recordId);
      const value = record.values[o.field][o.valueIndex];
      return el('li', {}, el('button', {
        type: 'button', onclick: () => { $('#similar').close(); select(o.recordId, ATTR_KEYS.includes(o.field) ? o.field : null); },
      },
      el('span', { class: 'item' }, el('b', {}, recordTitle(record)), record.id),
      el('span', { class: 'snippet' },
        clip(value.slice(0, o.start), 'start'),
        el('mark', { class: o.preferred ? 'pref' : '' }, value.slice(o.start, o.end)),
        clip(value.slice(o.end), 'end'),
        el('span', { class: 'field-name' }, o.field))));
    }));
  }

  function clip(s, side, n = 60) {
    if (s.length <= n) return s;
    return side === 'start' ? `…${s.slice(-n)}` : `${s.slice(0, n)}…`;
  }

  $('#similar').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.close();
  });

  // ---------------------------------------------------------------- init

  load(window.MAPGAPS_SAMPLE || [], 'Sample collection');
})();
