/*
 * MapGaps Version 3 adapter: turns the taxonomy engine's output (js/analysis.js)
 * into the RECORDS / TERM_CLUSTERS shapes the Version 3 page renders.
 *
 *   absent        a field with no value (the engine's empty-field "missing" flags)
 *   uncertainty   the engine's incomplete / inconsistent / contested flags
 *   term cluster  a collection-wide variant group (Gypsy / Romani / Roma, UK /
 *                 Great Britain, ...) that a field's value belongs to
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MapGapsV3Adapter = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ATTRS = ['dcTitle', 'dcDescription', 'dcSubject', 'dcCreator', 'dctermsCreated', 'edmCountry', 'dcType'];
  const ATTR_DIM = {
    dcTitle: 'Textual', dcDescription: 'Textual', dcSubject: 'Textual',
    dcCreator: 'Attributional', dcType: 'Attributional', dctermsCreated: 'Temporal', edmCountry: 'Spatial',
  };
  const DIM = { temporal: 'Temporal', spatial: 'Spatial', linguistic: 'Textual', attributional: 'Attributional' };
  const UNCERTAIN = ['incomplete', 'inconsistent', 'contested'];
  const TYPE_RANK = { contested: 3, inconsistent: 2, incomplete: 1 };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /** One value as HTML: flagged words wrapped in spans, linked entities as links. */
  function valueHtml(record, field, value, valueIndex, A) {
    const spans = record.flags
      .filter((f) => f.field === field && f.valueIndex === valueIndex && f.start != null && UNCERTAIN.includes(f.type))
      .sort((a, b) => a.start - b.start || TYPE_RANK[b.type] - TYPE_RANK[a.type]);
    let html = '';
    let cursor = 0;
    for (const s of spans) {
      if (s.start < cursor) continue;
      const whole = s.start === 0 && s.end === value.length;
      if (whole) continue; // a flag covering the whole value is shown by the card's tags
      const type = spans.filter((o) => o.start === s.start && o.end === s.end)
        .reduce((t, o) => (TYPE_RANK[o.type] > TYPE_RANK[t] ? o.type : t), s.type);
      const notes = spans.filter((o) => o.start === s.start && o.end === s.end).map((o) => `${o.code}: ${o.reason}`);
      html += esc(value.slice(cursor, s.start));
      html += `<span class="${type === 'contested' ? 'contested-word' : type === 'inconsistent' ? 'inconsistent-word' : 'incomplete-word'}" title="${esc(notes.join('\n'))}">${esc(value.slice(s.start, s.end))}</span>`;
      cursor = s.end;
    }
    html += esc(value.slice(cursor));
    const link = (record.links && record.links[field] || []).find((l) => l.label === value);
    if (link) html = `<a class="entity-link" href="${esc(link.uri)}" target="_blank" rel="noopener" title="${esc(link.uri)}">${html}</a>`;
    if (A.isPlaceholder(value)) html = `<span class="placeholder-value">${html}</span>`;
    return html;
  }

  /**
   * @param analysis  result of MapGapsAnalysis.analyse()
   * @param A         the MapGapsAnalysis module (for isPlaceholder)
   * @returns {{records: object[], clusters: object, collection: string}}
   */
  function toV3(analysis, A) {
    const contestedTerms = new Set();
    for (const r of analysis.records) {
      for (const f of r.flags) if (f.type === 'contested' && f.term) contestedTerms.add(fold(f.term));
    }

    // term clusters: collection-wide variant groups (not the "same object" groups)
    const clusters = {};
    for (const [id, g] of Object.entries(analysis.groups)) {
      if (g.kind === 'object') continue;
      const records = [...new Set(g.variants.flatMap((v) => v.occurrences.map((o) => o.recordId)))];
      clusters[id] = {
        name: g.label,
        note: g.note || '',
        terms: g.variants.map((v) => ({
          value: v.label, count: v.count, preferred: Boolean(v.preferred),
          type: contestedTerms.has(fold(v.label)) ? 'contested' : 'inconsistent',
        })),
        records,
      };
    }

    const records = analysis.records.map((r) => {
      const fields = {};
      for (const key of ATTRS) {
        const live = r.values[key].map((v, i) => ({ v, i })).filter(({ v }) => !A.isPlaceholder(v));
        const all = r.flags.filter((f) => f.field === key);
        const info = all.filter((f) => f.type === 'missing' && f.origin !== 'Empty field').map((f) => `${f.code}: ${f.reason}`);
        if (r.derived && r.derived[key]) info.push('dctermsCreated is empty: value taken from Europeana\'s normalised year');
        if (!live.length) {
          const reason = r.values[key].length ? `Only a placeholder is recorded ("${r.values[key][0]}")` : 'Empty field';
          // dimensions of the taxonomy's missing-field rules that flag this field (MISS-TEMP, MISS-SP, ...)
          const dims = [...new Set(all.filter((f) => f.type === 'missing' && f.origin === 'Empty field').map((f) => DIM[f.dimension]).filter(Boolean))];
          if (!dims.length) dims.push(ATTR_DIM[key]);
          fields[key] = { missing: true, flags: [{ type: 'missing', dim: dims[0], dims, note: reason }], info };
          continue;
        }
        const seen = new Set();
        const flags = [];
        for (const f of all.filter((x) => UNCERTAIN.includes(x.type))) {
          const note = `${f.code}: ${f.reason}`;
          if (seen.has(f.type + note)) continue;
          seen.add(f.type + note);
          flags.push({ type: f.type, dim: DIM[f.dimension] || ATTR_DIM[key], code: f.code, note, contextDependent: Boolean(f.contextDependent) });
        }
        const grouped = all.find((f) => f.groupId && clusters[f.groupId] && f.type === 'inconsistent') ||
          r.terms.map((t) => (t.field === key && clusters[t.groupId] ? { groupId: t.groupId } : null)).find(Boolean);
        fields[key] = {
          value: live.map(({ v, i }) => valueHtml(r, key, v, i, A)).join('<span class="value-sep"> · </span>'),
          flags,
          info,
          ...(grouped ? { termCluster: grouped.groupId } : {}),
        };
      }
      return {
        id: r.id,
        title: r.values.dcTitle.find((v) => !A.isPlaceholder(v)) || r.id,
        link: r.link,
        provider: r.provider,
        fields,
      };
    });

    const collection = (analysis.records.find((r) => r.collection) || {}).collection || '';
    const provider = (analysis.records.find((r) => r.provider) || {}).provider || '';
    return { records, clusters, collection, provider };
  }

  return { toV3, esc, ATTRS };
});
