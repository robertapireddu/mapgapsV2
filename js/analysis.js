/*
 * MapGaps analysis engine.
 *
 * Turns a list of Dublin Core-like records into flags that describe the gaps
 * in each field value:
 *
 *   missing       the value is absent or a placeholder ("none", "unknown", ...)
 *   incomplete    the value is present but imprecise ("20th century", "UK", "J. Smith")
 *   contested     the value carries doubt ("1931 or 1934", "attributed to ...", "?")
 *   inconsistent  the collection describes the same thing in different ways
 *                 (Gypsy / Roma / Romani, "Hartley, Edith" / "E. Hartley",
 *                 ISO dates next to DD/MM/YYYY dates, ...)
 *
 * Every field belongs to one of four uncertainty dimensions: temporal,
 * spatial, linguistic and attributional.
 *
 * Works in the browser (window.MapGapsAnalysis) and in Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MapGapsAnalysis = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DIMENSIONS = [
    { id: 'temporal', label: 'Temporal' },
    { id: 'spatial', label: 'Spatial' },
    { id: 'linguistic', label: 'Linguistic' },
    { id: 'attributional', label: 'Attributional' },
  ];

  const FLAG_TYPES = [
    { id: 'inconsistent', label: 'Inconsistent' },
    { id: 'incomplete', label: 'Incomplete' },
    { id: 'contested', label: 'Contested' },
    { id: 'missing', label: 'Missing' },
  ];

  const FIELDS = [
    { key: 'title', label: 'DC Title', dimension: 'linguistic' },
    { key: 'date', label: 'DC Date', dimension: 'temporal' },
    { key: 'temporal', label: 'DCTerms Temporal', dimension: 'temporal' },
    { key: 'creator', label: 'DC Creator', dimension: 'attributional' },
    { key: 'spatial', label: 'DC Place', dimension: 'spatial' },
    { key: 'subject', label: 'DC Subject', dimension: 'linguistic', multi: true },
    { key: 'description', label: 'DC Description', dimension: 'linguistic' },
    { key: 'language', label: 'DC Language', dimension: 'linguistic' },
    { key: 'publisher', label: 'DC Publisher', dimension: 'attributional' },
  ];
  const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f]));
  const DEFAULT_VOCAB_FIELDS = ['title', 'subject', 'description'];

  // ---------------------------------------------------------------- helpers

  const text = (v) => (v == null ? '' : String(v)).trim();
  const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const PLACEHOLDERS = new Set([
    '', 'none', 'null', 'nil', 'n/a', 'na', 'unknown', 'not known', 'not recorded',
    'undated', 'no date', 'n.d', 'nd', 's.d', 'sd', 'anonymous', 'anon', '-', '--', '?', 'tbc',
  ]);

  function isMissing(value) {
    const v = fold(text(value)).replace(/^[[(]+|[\])]+$/g, '').replace(/\.$/, '').trim();
    return PLACEHOLDERS.has(v) || /^(unknown|unidentified|anonymous)\b/.test(v);
  }

  const DOUBT_RE = /\?|\b(possibly|probably|perhaps|disputed|uncertain|attrib(uted|\.)?)\b/i;
  const OR_RE = /\bor\b/i;

  // ------------------------------------------------------ per-value rules

  const MONTHS = 'jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?';
  const WRITTEN_DATE_RE = new RegExp(`^(\\d{1,2}(st|nd|rd|th)?\\s+)?(${MONTHS})\\.?\\s+(\\d{1,2}(st|nd|rd|th)?,?\\s+)?\\d{4}$`, 'i');

  function temporalRules(v) {
    const flags = [];
    if (DOUBT_RE.test(v) || OR_RE.test(v) || /\b\d{4}\s*[/;]\s*\d{4}\b/.test(v)) {
      flags.push({ type: 'contested', reason: 'The date is uncertain or offers alternatives' });
    }
    const range = v.match(/\b(\d{4})\s*[-–]\s*(\d{4})\b/);
    if (/\b(century|cent\.?)\b|\bc\s?\d{2}\b/i.test(v)) {
      flags.push({ type: 'incomplete', reason: 'Only the century is recorded' });
    } else if (/\b\d{3}0s\b|\b\d{3}[-?ux_]$/i.test(v)) {
      flags.push({ type: 'incomplete', reason: 'Only the decade is recorded' });
    } else if (/\b(c\.|ca\.?|circa|approx\.?|about)\s*\d/i.test(v)) {
      flags.push({ type: 'incomplete', reason: 'The date is approximate (circa)' });
    } else if (/\b(early|mid|late)\b/i.test(v)) {
      flags.push({ type: 'incomplete', reason: 'The date is approximate' });
    } else if (range && Math.abs(Number(range[2]) - Number(range[1])) > 10) {
      flags.push({ type: 'incomplete', reason: `The date spans ${Math.abs(range[2] - range[1])} years` });
    }
    return flags;
  }

  function dateFormat(v) {
    if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(v)) return 'ISO 8601 (YYYY-MM-DD)';
    if (/^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}$/.test(v)) return 'Numeric (DD/MM/YYYY)';
    if (WRITTEN_DATE_RE.test(v)) return 'Written (12 June 1952)';
    return null;
  }

  const COUNTRY_LEVEL = new Set([
    'uk', 'u.k.', 'united kingdom', 'great britain', 'britain', 'gb', 'england', 'scotland', 'wales',
    'ireland', 'northern ireland', 'france', 'spain', 'italy', 'germany', 'romania', 'rumania',
    'roumania', 'hungary', 'bulgaria', 'serbia', 'slovakia', 'czechia', 'poland', 'europe', 'usa',
  ]);

  function spatialRules(v) {
    const flags = [];
    if (DOUBT_RE.test(v) || OR_RE.test(v) || /\bnear\b/i.test(v)) {
      flags.push({ type: 'contested', reason: 'The place is uncertain or offers alternatives' });
    }
    if (COUNTRY_LEVEL.has(fold(v).replace(/\s+/g, ' '))) {
      flags.push({ type: 'incomplete', reason: 'Only the country or region is recorded' });
    }
    return flags;
  }

  const QUALIFIER_RE = /^(attributed to|attrib\.|circle of|studio of|workshop of|after|possibly|probably)\s+/i;

  function creatorRules(v, field) {
    const flags = [];
    if (DOUBT_RE.test(v) || OR_RE.test(v) || QUALIFIER_RE.test(v)) {
      flags.push({ type: 'contested', reason: 'The attribution is uncertain or disputed' });
      return flags;
    }
    if (field === 'creator') {
      const initialsOnly = /^([A-Z]\.\s?)+\s*[\p{L}'-]+$/u.test(v) || /,\s*([A-Z]\.\s?)+$/.test(v);
      if (initialsOnly) flags.push({ type: 'incomplete', reason: 'Only initials are recorded for the forename' });
      else if (!/[\s,]/.test(v)) flags.push({ type: 'incomplete', reason: 'Only a single name is recorded' });
    }
    return flags;
  }

  function linguisticRules(v, field) {
    const flags = [];
    if (field === 'title' && /^untitled\b/i.test(v)) {
      flags.push({ type: 'incomplete', reason: 'The title is a placeholder' });
    }
    if (field === 'subject' && (DOUBT_RE.test(v) || /\(disputed\)/i.test(v))) {
      flags.push({ type: 'contested', reason: 'The subject term is marked as uncertain' });
    }
    if (field === 'description' && v.split(/\s+/).filter(Boolean).length < 5) {
      flags.push({ type: 'incomplete', reason: 'The description is very short' });
    }
    return flags;
  }

  function languageFormat(v) {
    if (/^[a-z]{2}(-[A-Za-z]{2})?$/.test(v)) return 'ISO 639-1 code (en)';
    if (/^[a-z]{3}$/.test(v)) return 'ISO 639-2/3 code (eng)';
    if (/^[\p{L} ]+$/u.test(v)) return 'Language name (English)';
    return null;
  }

  function valueRules(field, v) {
    switch (FIELD_BY_KEY[field].dimension) {
      case 'temporal': return temporalRules(v);
      case 'spatial': return spatialRules(v);
      case 'attributional': return creatorRules(v, field);
      default: return linguisticRules(v, field);
    }
  }

  // ------------------------------------------------------ normalisation

  const HEADER_ALIASES = {
    identifier: 'id', coverage: 'spatial', place: 'spatial', location: 'spatial',
    subjects: 'subject', keywords: 'subject', term: 'subject', terms: 'subject',
    lang: 'language', author: 'creator', photographer: 'creator', created: 'date', year: 'date',
  };

  /*
   * Europeana Search API items (and "rich"-profile fields) mapped onto
   * MapGaps fields. Earlier keys win; values may be arrays or language maps
   * ({ def: [...], en: [...] }).
   */
  const EUROPEANA_KEYS = {
    title: ['dcTitleLangAware', 'title'],
    date: ['dcDate', 'dctermsCreated', 'year'],
    temporal: ['edmTimespanLabelLangAware', 'edmTimespanLabel', 'dctermsTemporal'],
    creator: ['dcCreatorLangAware', 'dcCreator'],
    spatial: ['edmPlaceLabelLangAware', 'edmPlaceLabel', 'dctermsSpatial', 'dcCoverage'],
    subject: ['dcSubjectLangAware', 'dcSubject', 'edmConceptPrefLabelLangAware', 'edmConceptLabel'],
    description: ['dcDescriptionLangAware', 'dcDescription'],
    language: ['dcLanguage', 'language'],
    publisher: ['dcPublisherLangAware', 'dcPublisher'],
  };

  function europeanaValues(v) {
    if (v == null) return [];
    if (Array.isArray(v)) return v.flatMap(europeanaValues);
    if (typeof v === 'object') {
      if ('def' in v || 'en' in v) return europeanaValues(v.en || v.def);
      if ('value' in v) return europeanaValues(v.value);
      return europeanaValues(Object.values(v)[0]);
    }
    return [text(v)].filter(Boolean);
  }

  const isEuropeanaItem = (row) =>
    Object.keys(row).some((k) => /^(dc|dcterms|edm)[A-Z]/.test(k)) || Array.isArray(row.title);

  function fromEuropeanaItem(item) {
    const record = { id: text(item.id || item.guid), provider: text(europeanaValues(item.dataProvider)[0]) };
    record.link = text(item.guid || item.edmIsShownAt?.[0] || '');
    for (const [field, keys] of Object.entries(EUROPEANA_KEYS)) {
      const key = keys.find((k) => europeanaValues(item[k]).length);
      const values = key ? [...new Set(europeanaValues(item[key]))] : [];
      record[field] = FIELD_BY_KEY[field].multi ? values : field === 'description' ? values.join(' ') : values[0] || '';
    }
    return record;
  }

  function fieldKeyFor(header) {
    const key = text(header).toLowerCase().replace(/^(dc|dcterms)[:._ ]/, '').trim();
    return HEADER_ALIASES[key] || key;
  }

  /** Map arbitrary objects (CSV rows, JSON) onto MapGaps records. */
  function normaliseRecords(rows) {
    return rows.map((row, i) => {
      let record = { id: '' };
      if (isEuropeanaItem(row)) {
        record = fromEuropeanaItem(row);
      } else {
        for (const [header, value] of Object.entries(row)) {
          const key = fieldKeyFor(header);
          if (['id', 'link', 'provider'].includes(key) || FIELD_BY_KEY[key]) {
            record[key] = Array.isArray(value) && !FIELD_BY_KEY[key]?.multi ? value.join(' ; ') : value;
          }
        }
      }
      record.id = text(record.id) || `record-${i + 1}`;
      for (const f of FIELDS) {
        if (f.multi) {
          const raw = record[f.key];
          const list = Array.isArray(raw) ? raw : text(raw).split(/\s*[;|]\s*/);
          record[f.key] = list.map(text).filter(Boolean);
        } else {
          record[f.key] = text(record[f.key]);
        }
      }
      return record;
    });
  }

  // ---------------------------------------------------- collection rules

  /** Find whole-word vocabulary matches in a string; longer matches win. */
  function findVocabularyMatches(value, groups) {
    const hits = [];
    for (const g of groups) {
      for (const variant of g.variants) {
        const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(variant)}(?![\\p{L}\\p{N}])`, 'giu');
        let m;
        while ((m = re.exec(value))) {
          hits.push({ group: g, variant, start: m.index, end: m.index + m[0].length, text: m[0] });
        }
      }
    }
    hits.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
    const kept = [];
    for (const h of hits) {
      if (!kept.some((k) => h.start < k.end && k.start < h.end)) kept.push(h);
    }
    return kept;
  }

  function depluralise(s) {
    return s.replace(/ies$/, 'y').replace(/(s|x|ch|sh)es$/, '$1').replace(/([^s])s$/, '$1');
  }
  const looseKey = (v) => depluralise(fold(v).replace(/^the\s+/, '').replace(/[^a-z0-9]/g, ''));

  function nameKey(v) {
    const name = fold(v).replace(/[^a-z,.' -]/g, '').trim();
    let surname;
    let forenames;
    if (name.includes(',')) {
      [surname, forenames] = name.split(',').map((s) => s.trim());
    } else {
      const parts = name.split(/\s+/);
      surname = parts.pop();
      forenames = parts.join(' ');
    }
    return `${surname.replace(/[^a-z'-]/g, '')}|${(forenames || '').replace(/[^a-z]/g, '').charAt(0)}`;
  }

  class GroupBuilder {
    constructor(id, props) {
      this.group = { id, ...props, variants: new Map() };
    }
    add(variantLabel, occurrence, variantKey = variantLabel.toLowerCase()) {
      const variants = this.group.variants;
      if (!variants.has(variantKey)) variants.set(variantKey, { key: variantKey, label: variantLabel, occurrences: [] });
      variants.get(variantKey).occurrences.push(occurrence);
    }
    /** Finalise; returns null when only one variant is used (nothing inconsistent). */
    build() {
      const variants = [...this.group.variants.values()]
        .map((v) => ({ ...v, count: v.occurrences.length }))
        .sort((a, b) => b.count - a.count);
      if (variants.length < 2) return null;
      const preferredKey = this.group.preferred ? this.group.preferred.toLowerCase() : variants[0].key;
      for (const v of variants) v.preferred = v.key === preferredKey;
      return { ...this.group, preferredKey, variants, total: variants.reduce((n, v) => n + v.count, 0) };
    }
  }

  // ------------------------------------------------------------ analyse

  function analyse(inputRecords, vocabulary = []) {
    const records = normaliseRecords(inputRecords).map((r) => ({ ...r, flags: [], terms: [] }));

    const valuesOf = (record, field) =>
      FIELD_BY_KEY[field].multi ? record[field] : [record[field]];

    // 1. per-value rules (missing, incomplete, contested)
    for (const record of records) {
      for (const f of FIELDS) {
        const values = valuesOf(record, f.key);
        if (f.multi && values.length === 0) {
          record.flags.push({ field: f.key, valueIndex: -1, type: 'missing', reason: 'No value recorded' });
          continue;
        }
        values.forEach((v, valueIndex) => {
          if (isMissing(v)) {
            record.flags.push({ field: f.key, valueIndex, type: 'missing', reason: 'No value recorded' });
            return;
          }
          for (const flag of valueRules(f.key, v)) record.flags.push({ field: f.key, valueIndex, ...flag });
        });
      }
    }

    const hasFlag = (record, field, valueIndex, type) =>
      record.flags.some((fl) => fl.field === field && fl.valueIndex === valueIndex && fl.type === type);

    const builders = new Map();
    const builder = (id, props) => {
      if (!builders.has(id)) builders.set(id, new GroupBuilder(id, props));
      return builders.get(id);
    };

    // 2a. controlled-vocabulary variants (Gypsy / Roma / Romani ...)
    const vocab = vocabulary.map((g) => ({ ...g, fields: g.fields || DEFAULT_VOCAB_FIELDS }));
    const vocabCovered = new Set();
    for (const record of records) {
      for (const f of FIELDS) {
        const groups = vocab.filter((g) => g.fields.includes(f.key));
        if (!groups.length) continue;
        valuesOf(record, f.key).forEach((v, valueIndex) => {
          if (isMissing(v)) return;
          for (const hit of findVocabularyMatches(v, groups)) {
            vocabCovered.add(`${record.id}|${f.key}|${valueIndex}`);
            const canonical = hit.group.variants.find((x) => x.toLowerCase() === hit.variant.toLowerCase());
            builder(`vocab:${hit.group.id}`, {
              kind: 'vocabulary', label: hit.group.label, note: hit.group.note, preferred: hit.group.preferred,
            }).add(canonical, { recordId: record.id, field: f.key, valueIndex, start: hit.start, end: hit.end, text: hit.text });
          }
        });
      }
    }

    // 2b. format conventions (dates, language codes)
    const FORMAT_RULES = [
      { field: 'date', classify: dateFormat, label: 'Date formats' },
      { field: 'language', classify: languageFormat, label: 'Language notation' },
    ];
    for (const rule of FORMAT_RULES) {
      for (const record of records) {
        const v = record[rule.field];
        if (isMissing(v) || record.flags.some((fl) => fl.field === rule.field)) continue;
        const format = rule.classify(v);
        if (!format) continue;
        builder(`format:${rule.field}`, {
          kind: 'format', label: rule.label,
          note: 'Values below are precise, but written following different conventions.',
        }).add(format, { recordId: record.id, field: rule.field, valueIndex: 0, start: 0, end: v.length, text: v });
      }
    }

    // 2c. spelling / name-form variants detected automatically
    const AUTO_RULES = [
      { field: 'subject', key: looseKey, label: (v) => `Subject term "${v}"` },
      { field: 'creator', key: nameKey, label: (v) => `Name forms of "${v}"` },
      { field: 'publisher', key: looseKey, label: (v) => `Publisher "${v}"` },
    ];
    for (const rule of AUTO_RULES) {
      const byKey = new Map();
      for (const record of records) {
        valuesOf(record, rule.field).forEach((v, valueIndex) => {
          if (isMissing(v) || hasFlag(record, rule.field, valueIndex, 'contested')) return;
          if (vocabCovered.has(`${record.id}|${rule.field}|${valueIndex}`)) return;
          const key = rule.key(v);
          if (!key) return;
          if (!byKey.has(key)) byKey.set(key, []);
          byKey.get(key).push({ recordId: record.id, field: rule.field, valueIndex, start: 0, end: v.length, text: v });
        });
      }
      // a bare surname ("Hartley|") joins the only group sharing that surname
      if (rule.field === 'creator') {
        for (const [key, occ] of [...byKey]) {
          if (!key.endsWith('|')) continue;
          const siblings = [...byKey.keys()].filter((k) => k !== key && k.startsWith(key));
          if (siblings.length === 1) {
            byKey.get(siblings[0]).push(...occ);
            byKey.delete(key);
          }
        }
      }
      for (const [key, occurrences] of byKey) {
        const surfaces = new Set(occurrences.map((o) => o.text));
        if (surfaces.size < 2) continue;
        const b = builder(`auto:${rule.field}:${key}`, { kind: 'variant' });
        for (const o of occurrences) b.add(o.text, o, o.text);
        const top = b.build();
        b.group.label = rule.label(top.variants[0].label);
      }
    }

    // 3. finalise groups and flag every non-preferred occurrence
    const groups = {};
    const recordById = new Map(records.map((r) => [r.id, r]));
    for (const [id, b] of builders) {
      const group = b.build();
      if (!group) continue;
      groups[id] = group;
      const preferred = group.variants.find((v) => v.preferred);
      const others = group.variants.filter((v) => !v.preferred).map((v) => `${v.label} (${v.count})`);
      for (const variant of group.variants) {
        for (const o of variant.occurrences) {
          recordById.get(o.recordId).terms.push({
            field: o.field, valueIndex: o.valueIndex, start: o.start, end: o.end,
            groupId: id, variant: variant.key, preferred: variant.preferred,
          });
        }
        if (variant.preferred) continue;
        for (const o of variant.occurrences) {
          recordById.get(o.recordId).flags.push({
            field: o.field, valueIndex: o.valueIndex, type: 'inconsistent',
            groupId: id, variant: variant.key, start: o.start, end: o.end, term: o.text,
            reason: preferred
              ? `"${variant.label}" is used where the collection's reference term is "${preferred.label}"`
              : `Other forms in the collection: ${others.join(', ')}`,
          });
        }
      }
    }

    // 4. per-field statistics for the incompleteness overview
    const fieldStats = FIELDS.map((f) => {
      const stats = { key: f.key, label: f.label, dimension: f.dimension, total: records.length };
      for (const t of FLAG_TYPES) {
        stats[t.id] = records.filter((r) => r.flags.some((fl) => fl.field === f.key && fl.type === t.id)).length;
      }
      // the three states of the overview: missing > incomplete > complete
      stats.completeness = { missing: 0, incomplete: 0, complete: 0 };
      for (const r of records) stats.completeness[completenessOf(r, f.key)] += 1;
      return stats;
    });

    return { records, groups, fieldStats };
  }

  /** missing / incomplete / complete state of one field of an analysed record. */
  function completenessOf(record, field) {
    const flags = record.flags.filter((fl) => fl.field === field);
    const multi = FIELD_BY_KEY[field].multi;
    const count = multi ? record[field].length : 1;
    const missing = flags.filter((fl) => fl.type === 'missing');
    if (missing.length && (!multi || missing.some((fl) => fl.valueIndex === -1) || missing.length >= count)) return 'missing';
    return flags.some((fl) => fl.type === 'incomplete') ? 'incomplete' : 'complete';
  }

  /** Flags of a record that match the current filter selection. */
  function matchingFlags(record, { mode, dimension, type }) {
    const wanted = mode === 'missing' ? 'missing' : type;
    return record.flags.filter(
      (fl) => fl.type === wanted && (dimension === 'all' || FIELD_BY_KEY[fl.field].dimension === dimension),
    );
  }

  return {
    DIMENSIONS, FLAG_TYPES, FIELDS, FIELD_BY_KEY,
    analyse, matchingFlags, completenessOf, normaliseRecords, fromEuropeanaItem, isMissing, findVocabularyMatches, nameKey, looseKey,
  };
});
