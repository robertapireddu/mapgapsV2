/*
 * MapGaps analysis engine.
 *
 * Applies the uncertainty-flagging taxonomy (data/taxonomy.js, generated from
 * the taxonomy spreadsheet) to Europeana metadata records. Every flag carries
 * the taxonomy rule that raised it: its code, issue type (missing /
 * incomplete / inconsistent / contested), dimension (temporal / spatial /
 * linguistic / attributional), origin (epistemic, user input, data
 * conversion) and scope (record / collection).
 *
 * Each rule only looks at the fields listed for it in the taxonomy, so
 * editing the spreadsheet's "Fields" column changes what is checked.
 * Word lists specific to a collection live in data/vocabulary.js.
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

  const TYPES = [
    { id: 'inconsistent', label: 'Inconsistent' },
    { id: 'incomplete', label: 'Incomplete' },
    { id: 'contested', label: 'Contested' },
    { id: 'missing', label: 'Missing' },
  ];

  const ORIGINS = [
    { id: 'Epistemic', label: 'Intrinsic · epistemic' },
    { id: 'User input', label: 'Extrinsic · user input' },
    { id: 'Data conversion', label: 'Extrinsic · data conversion' },
    { id: 'Empty field', label: 'Empty field' },
  ];

  const FIELDS = [
    { key: 'dcTitle', label: 'DC Title' },
    { key: 'dcDate', label: 'DC Date' },
    { key: 'dctermsCreated', label: 'DCTerms Created' },
    { key: 'dcCreator', label: 'DC Creator' },
    { key: 'dcContributor', label: 'DC Contributor' },
    { key: 'dcCoverage', label: 'DC Coverage' },
    { key: 'dctermsProvenance', label: 'DCTerms Provenance' },
    { key: 'edmCountry', label: 'EDM Country' },
    { key: 'dcSubject', label: 'DC Subject' },
    { key: 'dcType', label: 'DC Type' },
    { key: 'dcDescription', label: 'DC Description' },
  ];
  const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

  // ================================================================ helpers

  const text = (v) => (v == null ? '' : String(v)).trim();
  const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  /** fold() that keeps string length, so match positions map back onto the original text. */
  const foldKeep = (s) => [...s].map((c) => {
    const f = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return f.length === c.length ? f : c;
  }).join('');
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const uniq = (list) => [...new Set(list)];
  const isUrl = (v) => /^(https?:\/\/|www\.)\S+$/i.test(v);
  const CURRENT_YEAR = new Date().getFullYear();

  const PLACEHOLDERS = new Set([
    '', 'none', 'null', 'nil', 'n/a', 'na', '-', '--', '?', 'unknown', 'not known', 'not recorded',
    'anonymous', 'anon', 'unidentified', 'tbc', 'tbd', '[]', 'empty',
  ]);
  const isPlaceholder = (v) =>
    PLACEHOLDERS.has(fold(text(v)).replace(/^[[(]+|[\])]+$/g, '').replace(/\.$/, '').trim());

  /** Whole-word, case- and accent-insensitive matcher for a list of phrases. */
  function phraseMatcher(phrases) {
    const list = uniq(phrases.map(text).filter(Boolean)).sort((a, b) => b.length - a.length);
    if (!list.length) return null;
    const alternatives = list.map((p) => escapeRe(foldKeep(p)).replace(/\\-|\s+/g, '[\\s-]+'));
    return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}])`, 'gu');
  }

  function findAll(re, value) {
    if (!re) return [];
    const hits = [];
    const hay = foldKeep(value);
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(hay))) {
      if (!m[0]) { re.lastIndex += 1; continue; }
      hits.push({ start: m.index, end: m.index + m[0].length, text: value.slice(m.index, m.index + m[0].length) });
    }
    return hits;
  }

  /** Keep the longest of overlapping matches. */
  function nonOverlapping(hits) {
    const sorted = [...hits].sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
    const kept = [];
    for (const h of sorted) if (!kept.some((k) => h.start < k.end && k.start < h.end)) kept.push(h);
    return kept.sort((a, b) => a.start - b.start);
  }

  function clip(s, n = 50) {
    return s.length > n ? `${s.slice(0, n)}…` : s;
  }

  // =========================================================== temporal keywords

  const ORDINALS = 'first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|twenty[\\s-]first';
  const CENTURY = `(?:(?:\\d{1,2}(?:st|nd|rd|th)|${ORDINALS})[\\s-]+(?:century|centuries|cent\\.?|c\\.)|c\\d{2}\\b)`;
  const YEAR = "(?:\\d{3,4}(?:['’]?s)?)";

  /**
   * Turn one entry of the "Temporal Keywords" sheet into a regular expression.
   *   circa + "year" OR "century"   ->  circa followed by a year or a century
   *   early [century]               ->  early 19th century
   *   between … and                 ->  between 1920 and 1930
   *   20s / 30s / 40s               ->  alternatives
   */
  function keywordPattern(keyword) {
    const k = foldKeep(text(keyword));
    const plus = k.match(/^(.*?)\s*\+\s*"year"\s*or\s*"century"$/);
    if (plus) {
      const prefix = plus[1].trim();
      const head = /^[\p{L}]/u.test(prefix) ? `(?<![\\p{L}])${escapeRe(prefix)}` : escapeRe(prefix);
      return `${head}\\s*(?:${CENTURY}|${YEAR})`;
    }
    if (k === '~') return `~\\s*(?:${CENTURY}|${YEAR})`;
    if (k.includes('[century]')) {
      const [before] = k.split('[century]');
      return `(?<![\\p{L}])${escapeRe(before.replace(/-$/, '').trim())}[\\s-]*${CENTURY}`;
    }
    if (k === 'century') return `(?:${CENTURY}|(?<![\\p{L}])centur(?:y|ies)(?![\\p{L}]))`;
    if (k.includes('…') || k.includes('...')) {
      const [a, b] = k.split(/…|\.\.\./).map((s) => s.trim());
      return `(?<![\\p{L}])${escapeRe(a)}\\s+\\S+(?:\\s+\\S+)?\\s+${escapeRe(b)}\\s+\\S+`;
    }
    if (k.includes(' / ')) return k.split(' / ').map((part) => keywordPattern(part)).join('|');
    const literal = escapeRe(k).replace(/\\-|\s+/g, '[\\s-]*').replace(/(\d)s$/, "$1['’]?s");
    return `(?<![\\p{L}\\p{N}])${literal}(?![\\p{L}\\p{N}])`;
  }

  // examples given in the INT-TEMP-INCOMP rule itself ("30's", "1930's", any decade)
  const EXTRA_TEMPORAL = [
    { keyword: 'decade (e.g. 1930s)', pattern: "(?<![\\p{N}])\\d{3}0['’]?s(?![\\p{L}])" },
    { keyword: "short decade (e.g. 30's)", pattern: "(?<![\\p{L}\\p{N}])['’]?\\d0['’]?s(?![\\p{L}])" },
  ];

  // ================================================================ compile

  function compile(taxonomy, vocabulary) {
    const rules = Object.fromEntries(taxonomy.rules.map((r) => [r.id, r]));
    const intKeywords = taxonomy.temporalKeywords.filter((k) => k.rule === 'INT-TEMP-INCOMP');
    const temporal = [
      ...intKeywords.map((k) => ({ keyword: k.keyword, pattern: keywordPattern(k.keyword) })),
      ...EXTRA_TEMPORAL,
    ].map((k) => ({ ...k, re: new RegExp(k.pattern, 'giu') }));

    const countryOf = new Map();
    for (const [canonical, ...forms] of vocabulary.countries || []) {
      for (const f of [canonical, ...forms]) countryOf.set(fold(f), canonical);
    }
    const placeCountry = new Map(Object.entries(vocabulary.placeCountries || {}).map(([p, c]) => [fold(p), c]));

    return {
      rules,
      temporal,
      falsePositives: phraseMatcher(taxonomy.falsePositives || []),
      contested: phraseMatcher([...(taxonomy.contestedWords || []), ...(vocabulary.contestedWords || [])]),
      regional: phraseMatcher(vocabulary.regionalLabels || []),
      regionalNoContinents: phraseMatcher((vocabulary.regionalLabels || []).filter((l) => !/^(europe|asia|africa)$/i.test(l))),
      countryMatcher: phraseMatcher((vocabulary.countries || []).flat()),
      placeMatcher: phraseMatcher(Object.keys(vocabulary.placeCountries || {})),
      countryOf,
      placeCountry,
      variantGroups: (vocabulary.variantGroups || []).map((g) => ({
        ...g,
        spatial: Boolean(g.fields),
        matcher: phraseMatcher(g.variants),
        canonical: new Map([...g.variants].reverse().map((v) => [v.toLowerCase(), v])),
      })),
      genericTerms: (vocabulary.genericTerms || []).map((g) => ({
        ...g, matcher: phraseMatcher(g.variants || [g.term]), specificMatcher: phraseMatcher(g.specific || []),
      })),
    };
  }

  const canonicalCountry = (ctx, v) => ctx.countryOf.get(fold(text(v)).replace(/\s+/g, ' ').replace(/\.$/, ''));
  const isCountryOnly = (ctx, v) => Boolean(canonicalCountry(ctx, v));

  /** Countries named or implied in a value, with the text span that names them. */
  function countriesIn(ctx, value) {
    const out = [];
    for (const h of findAll(ctx.countryMatcher, value)) out.push({ ...h, country: canonicalCountry(ctx, h.text) });
    for (const h of findAll(ctx.placeMatcher, value)) {
      if (!out.some((o) => h.start < o.end && o.start < h.end)) out.push({ ...h, country: ctx.placeCountry.get(fold(h.text)) });
    }
    return out.filter((o) => o.country);
  }

  // ============================================================ normalisation

  const HEADER_ALIASES = {
    dctitle: 'dcTitle', title: 'dcTitle',
    dcdate: 'dcDate', date: 'dcDate', year: 'dcDate',
    dctermscreated: 'dctermsCreated', created: 'dctermsCreated',
    dccreator: 'dcCreator', creator: 'dcCreator', author: 'dcCreator', photographer: 'dcCreator',
    dccontributor: 'dcContributor', contributor: 'dcContributor',
    dccoverage: 'dcCoverage', coverage: 'dcCoverage', dctermsspatial: 'dcCoverage', spatial: 'dcCoverage', place: 'dcCoverage',
    dctermsprovenance: 'dctermsProvenance', provenance: 'dctermsProvenance',
    edmcountry: 'edmCountry', country: 'edmCountry',
    dcsubject: 'dcSubject', subject: 'dcSubject', subjects: 'dcSubject', keywords: 'dcSubject',
    dctype: 'dcType',
    dcdescription: 'dcDescription', description: 'dcDescription',
    dcidentifier: 'identifier', identifier: 'identifier',
    id: 'id', europeanaid: 'id', about: 'id', recordid: 'id',
    dataprovider: 'provider', edmdataprovider: 'provider', provider: 'provider', institution: 'provider',
    link: 'link', url: 'link', guid: 'link', edmisshownat: 'link', edmlandingpage: 'link',
    owlsameas: 'sameAs', sameas: 'sameAs', exactmatch: 'sameAs',
  };

  /** Values of an EDM/Europeana field: arrays, language maps ({ def: [...], en: [...] }) or scalars. */
  function langValues(v) {
    if (v == null) return [];
    if (Array.isArray(v)) return v.flatMap(langValues);
    if (typeof v === 'object') {
      if ('value' in v) return langValues(v.value);
      return Object.values(v).flatMap(langValues);
    }
    const t = text(v);
    return t ? [t] : [];
  }

  function splitCell(field, value) {
    if (Array.isArray(value)) return value.flatMap((v) => splitCell(field, v));
    const sep = ['dcSubject', 'dcType'].includes(field) ? /\s*[|;]\s*/ : /\s+\|\s+/;
    return text(value).split(sep).map(text).filter(Boolean);
  }

  function emptyRecord() {
    return {
      id: '', provider: '', link: '', identifier: [], sameAs: [],
      values: Object.fromEntries(FIELDS.map((f) => [f.key, []])), target: null,
    };
  }

  /** Europeana Record API object (`object` of /record/v2/{id}.json): provider vs Europeana proxy. */
  function fromRecordApi(input) {
    const o = input.object || input;
    const record = emptyRecord();
    const providerProxy = o.proxies.find((p) => !p.europeanaProxy) || o.proxies[0];
    const europeanaProxy = o.proxies.find((p) => p.europeanaProxy);
    const labels = new Map();
    for (const kind of ['agents', 'places', 'timespans', 'concepts', 'organizations']) {
      for (const entity of o[kind] || []) {
        const pref = entity.prefLabel || {};
        const label = langValues(pref.en || pref.def || pref)[0];
        if (label) labels.set(entity.about, label);
      }
    }
    const proxyKeys = { dcCoverage: ['dcCoverage', 'dctermsSpatial'] };
    const read = (proxy, field, resolve) => {
      if (!proxy) return [];
      const values = uniq((proxyKeys[field] || [field]).flatMap((k) => langValues(proxy[k])));
      return resolve ? uniq(values.map((v) => labels.get(v) || v)) : values;
    };
    record.target = {};
    for (const f of FIELDS) {
      if (f.key === 'edmCountry') continue;
      record.values[f.key] = read(providerProxy, f.key, false);
      record.target[f.key] = read(europeanaProxy, f.key, true);
    }
    const country = langValues(o.europeanaAggregation && o.europeanaAggregation.edmCountry);
    record.values.edmCountry = country;
    record.target.edmCountry = country;
    record.id = text(o.about);
    record.identifier = langValues(providerProxy.dcIdentifier);
    record.sameAs = langValues((o.providedCHOs || []).map((c) => c.owlSameAs));
    record.provider = text(langValues((o.aggregations || []).map((a) => a.edmDataProvider))[0]);
    record.link = text((o.europeanaAggregation && o.europeanaAggregation.edmLandingPage) || '');
    return record;
  }

  /** Europeana Search API item (profile=rich). Earlier keys win. */
  const SEARCH_KEYS = {
    dcTitle: ['dcTitleLangAware', 'title'],
    dcDate: ['dcDateLangAware', 'dcDate', 'year'],
    dctermsCreated: ['dctermsCreatedLangAware', 'dctermsCreated'],
    dcCreator: ['dcCreatorLangAware', 'dcCreator'],
    dcContributor: ['dcContributorLangAware', 'dcContributor'],
    dcCoverage: ['dcCoverageLangAware', 'dcCoverage', 'dctermsSpatialLangAware', 'dctermsSpatial', 'edmPlaceLabelLangAware', 'edmPlaceLabel'],
    dctermsProvenance: ['dctermsProvenanceLangAware', 'dctermsProvenance'],
    edmCountry: ['country', 'edmCountry'],
    dcSubject: ['dcSubjectLangAware', 'dcSubject', 'edmConceptPrefLabelLangAware', 'edmConceptLabel'],
    dcType: ['dcTypeLangAware', 'dcType'],
    dcDescription: ['dcDescriptionLangAware', 'dcDescription'],
  };

  function fromSearchItem(item) {
    const record = emptyRecord();
    for (const [field, keys] of Object.entries(SEARCH_KEYS)) {
      const key = keys.find((k) => langValues(item[k]).length);
      record.values[field] = key ? uniq(langValues(item[key])) : [];
    }
    record.id = text(item.id);
    record.identifier = langValues(item.dcIdentifier);
    record.provider = text(langValues(item.dataProvider)[0]);
    record.link = text(item.guid || langValues(item.edmIsShownAt)[0]);
    return record;
  }

  /** Flat row (CSV / simple JSON). Columns prefixed "europeana:" fill the Europeana proxy. */
  function fromRow(row) {
    const record = emptyRecord();
    for (const [header, value] of Object.entries(row)) {
      const h = text(header);
      const isTarget = /^europeana(proxy)?[:._ ]/i.test(h);
      const key = HEADER_ALIASES[h.replace(/^(europeana(proxy)?|provider(proxy)?)[:._ ]/i, '').toLowerCase().replace(/[^a-z]/g, '')];
      if (!key) continue;
      if (FIELD_BY_KEY[key]) {
        const values = splitCell(key, value);
        if (isTarget) (record.target = record.target || {})[key] = values;
        else record.values[key] = values;
      } else if (key === 'identifier' || key === 'sameAs') {
        record[key] = splitCell(key, value);
      } else {
        record[key] = text(Array.isArray(value) ? value[0] : value);
      }
    }
    if (record.target) for (const f of FIELDS) record.target[f.key] = record.target[f.key] || [];
    return record;
  }

  function normaliseRecords(rows) {
    return rows.map((row) => {
      if (row && (row.proxies || (row.object && row.object.proxies))) return fromRecordApi(row);
      if (row && (Object.keys(row).some((k) => /LangAware$|^edm[A-Z]/.test(k)) || Array.isArray(row.title))) return fromSearchItem(row);
      return fromRow(row);
    }).map((r, i) => ({ ...r, id: r.id || `record-${i + 1}` }));
  }

  // ================================================================= groups

  class GroupBuilder {
    constructor(id, props) {
      this.group = { id, ...props, variants: new Map() };
    }
    add(label, occurrence, key = label.toLowerCase()) {
      const variants = this.group.variants;
      if (!variants.has(key)) variants.set(key, { key, label, occurrences: [] });
      variants.get(key).occurrences.push(occurrence);
    }
    build() {
      const variants = [...this.group.variants.values()]
        .map((v) => ({ ...v, count: v.occurrences.length }))
        .sort((a, b) => b.count - a.count);
      if (variants.length < 2) return null;
      // the reference term, or the most frequent form when the reference term is not used at all
      const wanted = this.group.preferred && this.group.preferred.toLowerCase();
      const preferredKey = variants.some((v) => v.key === wanted) ? wanted : variants[0].key;
      for (const v of variants) v.preferred = !this.group.noPreferred && v.key === preferredKey;
      return { ...this.group, variants, total: variants.reduce((n, v) => n + v.count, 0) };
    }
  }

  function depluralise(s) {
    return s.replace(/ies$/, 'y').replace(/(s|x|ch|sh)es$/, '$1').replace(/([^s])s$/, '$1');
  }
  const looseKey = (v) => depluralise(fold(v).replace(/^the\s+/, '').replace(/[^a-z0-9]/g, ''));

  // ============================================================== time spans

  /** Approximate [start, end] year span of a temporal expression, or null. */
  function spanOf(v) {
    const s = fold(text(v));
    let m = s.match(/\b(\d{4})\s*(?:-|–|to|and|\/)\s*(\d{4})\b/);
    if (m) return [Math.min(+m[1], +m[2]), Math.max(+m[1], +m[2])];
    m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)[\s-]+(?:century|cent)/);
    if (m) {
      const c = +m[1];
      if (/\bearly\b/.test(s)) return [(c - 1) * 100 + 1, (c - 1) * 100 + 35];
      if (/\bmid\b/.test(s)) return [(c - 1) * 100 + 35, (c - 1) * 100 + 70];
      if (/\blate\b/.test(s)) return [(c - 1) * 100 + 65, c * 100];
      return [(c - 1) * 100 + 1, c * 100];
    }
    m = s.match(/\b(\d{3})0['’]?s\b/);
    if (m) return [+m[1] * 10, +m[1] * 10 + 9];
    m = s.match(/\b(\d{4})\b/);
    if (m) {
      const y = +m[1];
      return /\b(c\.|ca\.?|circa|approx|about|around)|~/.test(s) ? [y - 5, y + 5] : [y, y];
    }
    if (/\b(interwar|between the wars)\b/.test(s)) return [1918, 1939];
    return null;
  }
  const overlaps = (a, b) => a[0] <= b[1] && b[0] <= a[1];

  const QUALIFIER_RE = /\b(c\.|ca\.?|circa|approx\.?|approximately|about|around|possibly|probably|perhaps|uncertain|attributed)|~|\?/i;
  const APPROX_NOTATION_RE = /(?<![\p{L}])(circa|ca\.|c\.|approx\.|approximately|about|around|~)\s*(?=\d)/giu;

  // ================================================================ analyse

  function analyse(inputRecords, { taxonomy, vocabulary = {} } = {}) {
    if (!taxonomy) throw new Error('analyse() needs the taxonomy (data/taxonomy.js)');
    const ctx = compile(taxonomy, vocabulary);
    const records = normaliseRecords(inputRecords).map((r) => ({ ...r, flags: [], terms: [] }));
    const byId = new Map(records.map((r) => [r.id, r]));

    const fieldsOf = (ruleId) => (ctx.rules[ruleId] ? ctx.rules[ruleId].fields.filter((f) => FIELD_BY_KEY[f]) : []);
    const liveValues = (record, field) =>
      record.values[field].map((v, i) => ({ v, i })).filter(({ v }) => !isPlaceholder(v));

    function flag(record, ruleId, field, valueIndex, extra = {}) {
      const rule = ctx.rules[ruleId];
      if (!rule || !rule.fields.includes(field)) return;
      const type = extra.type || rule.type;
      const duplicate = record.flags.some((f) => f.rule === ruleId && f.field === field &&
        f.valueIndex === valueIndex && f.start === extra.start && f.type === type);
      if (duplicate) return;
      record.flags.push({
        rule: ruleId, code: rule.code, dimension: rule.dimension,
        origin: rule.subCategory || 'Empty field', scope: rule.scope, field, valueIndex, ...extra, type,
      });
    }

    const notFalsePositive = (value) => {
      const fps = findAll(ctx.falsePositives, value);
      return (h) => !fps.some((fp) => h.start < fp.end && fp.start < h.end);
    };

    // ---------------------------------------------------- record-level rules
    for (const record of records) {
      // MISS-TEMP / MISS-SP / MISS-LING / MISS-ATTR: empty field (placeholders such as "none" count as empty)
      for (const rule of taxonomy.rules) {
        if (rule.type !== 'missing' || rule.subCategory) continue;
        for (const field of fieldsOf(rule.id)) {
          if (!liveValues(record, field).length) {
            flag(record, rule.id, field, -1, {
              reason: record.values[field].length ? `Only a placeholder is recorded ("${record.values[field][0]}")` : 'Empty field',
            });
          }
        }
      }

      // INT-TEMP-INCOMP: temporal keywords
      for (const field of fieldsOf('INT-TEMP-INCOMP')) {
        for (const { v, i } of liveValues(record, field)) {
          const hits = [];
          for (const k of ctx.temporal) for (const h of findAll(k.re, v)) hits.push({ ...h, keyword: k.keyword });
          for (const h of nonOverlapping(hits.filter(notFalsePositive(v)))) {
            flag(record, 'INT-TEMP-INCOMP', field, i, { start: h.start, end: h.end, term: h.text, reason: `Imprecise date (keyword: ${h.keyword})` });
          }
        }
      }

      // EXT-UI-TEMP-INCOM: guessed, abbreviated or mistyped dates
      for (const field of fieldsOf('EXT-UI-TEMP-INCOM')) {
        const dateField = field === 'dcDate' || field === 'dctermsCreated';
        for (const { v, i } of liveValues(record, field)) {
          const checks = [
            [/(?<![\p{N}])1\d{2}[?xXu_-](?![\p{N}])|(?<![\p{N}])1\d[?xXu_]{2}(?![\p{L}\p{N}])/gu, 'Digits of the year left out or guessed'],
            [/(?<![\p{N}])\d{4}\s*\?|\[\s*\d{4}\s*\??\s*\]/gu, 'Year marked as a cataloguer\'s guess'],
            [/(?<![\p{L}\p{N}])['’]\d{2}(?![\p{N}s'’])/gu, 'Year abbreviated to two digits'],
          ];
          if (dateField) {
            checks.push([/\b\d{5,}\b/g, 'Too many digits for a year (typo?)']);
            checks.push([/\b\d{4}-(1[3-9]|[2-9]\d)\b/g, 'Month out of range (typo?)']);
            checks.push([/\b\d{4}\b/g, null]);
          }
          const hits = [];
          for (const [re, reason] of checks) {
            for (const h of findAll(re, v)) {
              if (reason) hits.push({ ...h, reason });
              else if (+h.text > CURRENT_YEAR) hits.push({ ...h, reason: 'Year lies in the future (typo?)' });
            }
          }
          for (const h of nonOverlapping(hits)) flag(record, 'EXT-UI-TEMP-INCOM', field, i, { start: h.start, end: h.end, term: h.text, reason: h.reason });
        }
      }

      // EXT-UI-TEMP-INCONS: one field holds several time indications / tag variants
      for (const field of fieldsOf('EXT-UI-TEMP-INCONS')) {
        if (field === 'dcDescription') continue;
        const temporalValues = liveValues(record, field).filter(({ v }) =>
          field !== 'dcSubject' || spanOf(v) || ctx.temporal.some((k) => findAll(k.re, v).length));
        const distinct = uniq(temporalValues.map(({ v }) => fold(v)));
        if (distinct.length < 2) continue;
        for (const { i } of temporalValues) {
          flag(record, 'EXT-UI-TEMP-INCONS', field, i, {
            reason: `${FIELD_BY_KEY[field].label} holds ${distinct.length} different time indications: ${temporalValues.map((x) => `"${x.v}"`).join(', ')}`,
          });
        }
      }

      // INT-TEMP-INCONS (inside the record): fields give dates that do not overlap
      {
        const spans = [];
        for (const field of fieldsOf('INT-TEMP-INCONS')) {
          for (const { v, i } of liveValues(record, field)) {
            if (field === 'dcDescription') {
              for (const h of findAll(/(?<![\p{N}])(1[0-9]\d{2}|20[0-2]\d)(?:['’]?s)?(?![\p{N}])/gu, v)) {
                spans.push({ field, i, span: spanOf(h.text), text: h.text, start: h.start, end: h.end });
              }
            } else {
              const span = spanOf(v);
              if (span && (field !== 'dcSubject' || /\d/.test(v))) spans.push({ field, i, span, text: v });
            }
          }
        }
        const anchors = spans.filter((s) => s.field === 'dcDate' || s.field === 'dctermsCreated');
        const descriptionAgrees = spans.some((o) => o.field === 'dcDescription' && anchors.some((a) => overlaps(a.span, o.span)));
        for (const s of spans) {
          const conflicts = anchors.filter((a) => a.field !== s.field && !overlaps(a.span, s.span));
          if (!conflicts.length || (s.field === 'dcDescription' && descriptionAgrees)) continue;
          const span = s.start != null ? { start: s.start, end: s.end, term: s.text } : {};
          flag(record, 'INT-TEMP-INCONS', s.field, s.i, {
            ...span, reason: `"${s.text}" contradicts ${conflicts.map((c) => `${FIELD_BY_KEY[c.field].label} "${c.text}"`).join(', ')}`,
          });
        }
      }

      // INT-SP-INCOMP: the only geographical indication is a country
      {
        const fields = fieldsOf('INT-SP-INCOMP');
        const finer = ['dcCoverage', 'dctermsProvenance'].filter((f) => fields.includes(f))
          .some((f) => liveValues(record, f).some(({ v }) => !isCountryOnly(ctx, v)))
          || liveValues(record, 'dcSubject').some(({ v }) => ctx.placeCountry.has(fold(v)));
        if (!finer) {
          for (const field of fields.filter((f) => f !== 'dcDescription')) {
            for (const { v, i } of liveValues(record, field)) {
              if (isCountryOnly(ctx, v)) flag(record, 'INT-SP-INCOMP', field, i, { reason: `Only the country is given ("${v}"); no finer place anywhere in the record` });
            }
          }
        }
      }

      // EXT-UI-SPA-INCOM: approximate, guessed or over-broad place names
      for (const field of fieldsOf('EXT-UI-SPA-INCOM').filter((f) => f !== 'edmCountry')) {
        for (const { v, i } of liveValues(record, field)) {
          const hits = [];
          const regional = field === 'dcDescription' ? ctx.regionalNoContinents : ctx.regional;
          for (const h of findAll(regional, v)) hits.push({ ...h, reason: `Over-broad regional label "${h.text}"` });
          if (field !== 'dcDescription') {
            for (const h of findAll(/(?<![\p{L}])(near|nr\.|around|probably|possibly|perhaps|somewhere in|region of)(?![\p{L}])|\?/giu, v)) {
              hits.push({ ...h, reason: 'Place is approximate or guessed' });
            }
          }
          for (const h of nonOverlapping(hits.filter(notFalsePositive(v)))) {
            flag(record, 'EXT-UI-SPA-INCOM', field, i, { start: h.start, end: h.end, term: h.text, reason: h.reason });
          }
        }
      }

      // INT-SP-INCONS: fields of the record point to different countries
      {
        const found = [];
        for (const field of fieldsOf('INT-SP-INCONS')) {
          for (const { v, i } of liveValues(record, field)) for (const c of countriesIn(ctx, v)) found.push({ field, i, ...c });
        }
        const countries = uniq(found.map((f) => f.country));
        if (countries.length > 1) {
          const summary = countries.map((c) => `${c} (${uniq(found.filter((f) => f.country === c).map((f) => FIELD_BY_KEY[f.field].label)).join(', ')})`).join(' vs ');
          for (const f of found) flag(record, 'INT-SP-INCONS', f.field, f.i, { start: f.start, end: f.end, term: f.text, reason: `Fields disagree on the country: ${summary}` });
        }
      }

      // EXT-UI-SPA-INCONS: the same place in several variant forms, or several places at once
      {
        const fields = fieldsOf('EXT-UI-SPA-INCONS').filter((f) => f !== 'dcDescription');
        const values = fields.flatMap((field) => liveValues(record, field).map(({ v, i }) => ({ field, v, i })));
        const byPlace = new Map();
        for (const x of values) {
          const g = ctx.variantGroups.find((grp) => grp.spatial && findAll(grp.matcher, x.v).some((h) => h.end - h.start === x.v.length));
          const country = canonicalCountry(ctx, x.v);
          const key = g ? `vocab:${g.id}` : country ? `country:${country}` : null;
          if (!key) continue;
          if (!byPlace.has(key)) byPlace.set(key, []);
          byPlace.get(key).push(x);
        }
        for (const [key, xs] of byPlace) {
          const forms = uniq(xs.map((x) => x.v));
          if (forms.length < 2) continue;
          const groupId = key.startsWith('vocab:') ? key : undefined;
          for (const x of xs) flag(record, 'EXT-UI-SPA-INCONS', x.field, x.i, { groupId, reason: `The same place is entered in ${forms.length} forms: ${forms.map((f) => `"${f}"`).join(', ')}` });
        }
        if (fields.includes('dcCoverage')) {
          const places = liveValues(record, 'dcCoverage').filter(({ v }) => !isCountryOnly(ctx, v));
          const distinct = places.filter(({ v }) => !places.some((o) => o.v !== v && fold(o.v).includes(fold(v))));
          const placeKey = ({ v }) => {
            const g = ctx.variantGroups.find((grp) => grp.spatial && findAll(grp.matcher, v).length);
            return g ? `vocab:${g.id}` : looseKey(v);
          };
          if (uniq(distinct.map(placeKey)).length > 1) {
            for (const { i } of distinct) flag(record, 'EXT-UI-SPA-INCONS', 'dcCoverage', i, { reason: `Several places are indicated: ${distinct.map((d) => `"${d.v}"`).join(', ')}` });
          }
        }
      }

      // EXT-DATAC-SPA-INCONS: country-only values next to locality-only values, no full hierarchy
      {
        const fields = fieldsOf('EXT-DATAC-SPA-INCONS').filter((f) => f !== 'dcDescription');
        const values = fields.flatMap((field) => liveValues(record, field).map(({ v, i }) => ({ field, v, i })));
        const countryOnly = values.filter((x) => isCountryOnly(ctx, x.v));
        const localityOnly = values.filter((x) => x.field !== 'edmCountry' && !isCountryOnly(ctx, x.v) && !x.v.includes(','));
        const hierarchical = values.some((x) => x.v.split(',').filter((p) => p.trim()).length > 1);
        if (countryOnly.length && localityOnly.length && !hierarchical) {
          const reason = `Place hierarchy split across values: ${localityOnly.map((c) => `"${c.v}"`).join(', ')} without region or country, ${uniq(countryOnly.map((c) => `"${c.v}"`)).join(', ')} without locality`;
          for (const x of [...localityOnly, ...countryOnly]) flag(record, 'EXT-DATAC-SPA-INCONS', x.field, x.i, { reason });
        }
      }

      // INT-LING-INCOMP: generic / aggregated labels (Contested when a self-designated term is known)
      {
        const fields = fieldsOf('INT-LING-INCOMP');
        const recordText = fields.flatMap((f) => liveValues(record, f).map(({ v }) => v)).join(' \n ');
        for (const field of fields) {
          for (const { v, i } of liveValues(record, field)) {
            for (const g of ctx.genericTerms) {
              for (const h of findAll(g.matcher, v).filter(notFalsePositive(v))) {
                if (findAll(g.specificMatcher, recordText).some((s) => fold(s.text) !== fold(h.text))) continue;
                const contested = (g.specific || []).length > 0;
                flag(record, 'INT-LING-INCOMP', field, i, {
                  start: h.start, end: h.end, term: h.text, type: contested ? 'contested' : 'incomplete',
                  reason: contested
                    ? `Generic label "${h.text}" while self-designated terms are known (${g.specific.slice(0, 4).join(', ')}…): treated as Contested. ${g.note || ''}`.trim()
                    : `Generic or aggregated label "${h.text}": the specific community or practice cannot be recovered from the record`,
                });
              }
            }
          }
        }
      }

      // EXT-UI-LING-CONT: outdated or biased terms
      for (const field of fieldsOf('EXT-UI-LING-CONT')) {
        for (const { v, i } of liveValues(record, field)) {
          for (const h of findAll(ctx.contested, v).filter(notFalsePositive(v))) {
            flag(record, 'EXT-UI-LING-CONT', field, i, { start: h.start, end: h.end, term: h.text, reason: `"${h.text}" is an outdated or biased term introduced by the recorder` });
          }
        }
      }

      // EXT-UI-LING-INCOM: truncated, abbreviated or underspecified entries
      for (const field of fieldsOf('EXT-UI-LING-INCOM')) {
        for (const { v, i } of liveValues(record, field)) {
          let reason = null;
          if (/(\.\.\.|…)$/.test(v)) reason = 'Entry is cut off ("…")';
          else if (/[-–/(,&]$/.test(v)) reason = 'Entry ends mid-phrase';
          else if ((v.match(/\(/g) || []).length > (v.match(/\)/g) || []).length || (v.match(/"/g) || []).length % 2) reason = 'Unclosed bracket or quote: the entry looks truncated';
          else if (v.replace(/[^\p{L}]/gu, '').length <= 2) reason = 'Entry is only one or two letters';
          else if (v.length === 255 || v.length === 256) reason = 'Entry stops exactly at a field-length limit';
          else if (/^\p{L}{1,5}\.$/u.test(v)) reason = 'Entry is an abbreviation';
          if (reason) flag(record, 'EXT-UI-LING-INCOM', field, i, { reason });
        }
      }

      // EXT-UI-ATTR-INC: bare Wikidata address
      for (const field of fieldsOf('EXT-UI-ATTR-INC')) {
        for (const { v, i } of liveValues(record, field)) {
          if (/^(https?:\/\/)?(www\.|m\.)?wikidata\.org\/?(wiki\/?|entity\/?)?$/i.test(v)) {
            flag(record, 'EXT-UI-ATTR-INC', field, i, { reason: 'Wikidata address without an item (/wiki/Q…)' });
          }
        }
      }

      // EXT-DATAC-LINK-INCOMP: a URL stands where a name should be
      for (const field of fieldsOf('EXT-DATAC-LINK-INCOMP')) {
        const live = liveValues(record, field);
        if (!live.length || live.some(({ v }) => !isUrl(v))) continue;
        for (const { v, i } of live) {
          if (/wikidata\.org\/?(wiki\/?|entity\/?)?$/i.test(v)) continue;
          flag(record, 'EXT-DATAC-LINK-INCOMP', field, i, { reason: 'Only a URL is recorded; no descriptive value (name) survives' });
        }
      }

      // EXT-DATAC-TEMP-INCOM: precision or qualifier lost in conversion
      for (const field of fieldsOf('EXT-DATAC-TEMP-INCOM').filter((f) => f !== 'dcDescription')) {
        const source = liveValues(record, field);
        const target = record.target ? (record.target[field] || []).filter((v) => !isPlaceholder(v)) : [];
        if (target.length) {
          for (const { v, i } of source) {
            const range = /\b\d{4}\s*[-–]\s*\d{4}\b/.test(v);
            const flattened = target.filter((t) => /^\d{4}$/.test(t) && v.includes(t.slice(0, 3)));
            if ((range || QUALIFIER_RE.test(v)) && flattened.length) {
              flag(record, 'EXT-DATAC-TEMP-INCOM', field, i, {
                reason: `${range ? 'Single year where range expected' : 'Qualifier stripped'}: source "${v}" → Europeana proxy "${flattened[0]}"`,
              });
            }
          }
        } else if (!record.target && field === 'dcDate') {
          const others = ['dctermsCreated', 'dcDescription'].flatMap((f) => liveValues(record, f).map(({ v }) => v));
          for (const { v, i } of source) {
            if (!/^\d{4}$/.test(v)) continue;
            const richer = others.find((o) => new RegExp(`\\d{4}\\s*[-–]\\s*${v}|${v}\\s*[-–]\\s*\\d{4}`).test(o) ||
              new RegExp(`(c\\.|ca\\.?|circa|approx\\.?|~)\\s*${v}|${v}\\s*(\\?|,?\\s*uncertain)`, 'i').test(o));
            if (richer) flag(record, 'EXT-DATAC-TEMP-INCOM', field, i, { reason: `"${v}" is flatter than elsewhere in the record ("${clip(richer)}"): range or qualifier lost` });
          }
        }
      }

      // EXT-DATAC-SPA-INCOM: place hierarchy lost in conversion (needs both proxies)
      if (record.target) {
        for (const field of fieldsOf('EXT-DATAC-SPA-INCOM')) {
          const target = (record.target[field] || []).filter((v) => !isPlaceholder(v));
          if (!target.length || !target.every((t) => isCountryOnly(ctx, t))) continue;
          for (const { v, i } of liveValues(record, field)) {
            if (!isCountryOnly(ctx, v)) flag(record, 'EXT-DATAC-SPA-INCOM', field, i, { reason: `Source "${v}" reduced to "${target.join(', ')}" in the Europeana proxy` });
          }
        }
      }

      // EXT-DATAC-LING-INCOM: multi-value / multilingual content collapsed (needs both proxies)
      if (record.target) {
        for (const field of fieldsOf('EXT-DATAC-LING-INCOM')) {
          const source = liveValues(record, field);
          const target = (record.target[field] || []).filter((v) => !isPlaceholder(v));
          if (target.length && source.length > target.length) {
            flag(record, 'EXT-DATAC-LING-INCOM', field, -1, {
              reason: `${source.length} source values collapsed to ${target.length} in the Europeana proxy (${target.map((t) => `"${t}"`).join(', ')})`,
            });
          }
        }
      }
    }

    // ----------------------------------------------------- collection rules
    const builders = new Map();
    const builder = (id, props) => {
      if (!builders.has(id)) builders.set(id, new GroupBuilder(id, props));
      return builders.get(id);
    };

    // vocabulary variants: INT-LING-INCONS across the collection, EXT-UI-LING-INCONS inside one record
    const lingFields = uniq([...fieldsOf('INT-LING-INCONS'), ...fieldsOf('EXT-UI-LING-INCONS')]);
    const vocabCovered = new Set();
    for (const record of records) {
      const perGroup = new Map();
      for (const g of ctx.variantGroups) {
        for (const field of (g.fields || lingFields).filter((f) => FIELD_BY_KEY[f])) {
          for (const { v, i } of liveValues(record, field)) {
            for (const h of nonOverlapping(findAll(g.matcher, v))) {
              const canonical = g.canonical.get(h.text.toLowerCase()) || h.text;
              const occ = { recordId: record.id, field, valueIndex: i, start: h.start, end: h.end, text: h.text };
              builder(`vocab:${g.id}`, { kind: 'vocabulary', label: g.label, note: g.note, preferred: g.preferred, spatial: g.spatial }).add(canonical, occ, canonical.toLowerCase());
              for (let k = h.start; k < h.end; k += 1) vocabCovered.add(`${record.id}|${field}|${i}|${k}`);
              if (!g.spatial) {
                if (!perGroup.has(g.id)) perGroup.set(g.id, []);
                perGroup.get(g.id).push({ ...occ, canonical });
              }
            }
          }
        }
      }
      for (const [gid, occs] of perGroup) {
        const forms = uniq(occs.map((o) => o.canonical));
        if (forms.length < 2) continue;
        for (const o of occs) {
          flag(record, 'EXT-UI-LING-INCONS', o.field, o.valueIndex, {
            start: o.start, end: o.end, term: o.text, groupId: `vocab:${gid}`, variant: o.canonical.toLowerCase(),
            reason: `This record names the same community or entity in ${forms.length} ways: ${forms.join(', ')}`,
          });
        }
      }
    }

    // spelling variants of subject / type values (INT-LING-INCONS), or diacritics only (EXT-DATAC-LING-INCONS)
    const variantFields = uniq([...fieldsOf('INT-LING-INCONS'), ...fieldsOf('EXT-DATAC-LING-INCONS')]).filter((f) => f === 'dcSubject' || f === 'dcType');
    for (const field of variantFields) {
      const byKey = new Map();
      for (const record of records) {
        for (const { v, i } of liveValues(record, field)) {
          if (vocabCovered.has(`${record.id}|${field}|${i}|0`)) continue;
          const key = looseKey(v);
          if (!key) continue;
          if (!byKey.has(key)) byKey.set(key, []);
          byKey.get(key).push({ recordId: record.id, field, valueIndex: i, start: 0, end: v.length, text: v });
        }
      }
      for (const [key, occs] of byKey) {
        const forms = uniq(occs.map((o) => o.text));
        if (forms.length < 2) continue;
        const accentsOnly = uniq(forms.map(fold)).length === 1 && forms.some((f) => f.toLowerCase() !== fold(f));
        const b = builder(`${accentsOnly ? 'accents' : 'spelling'}:${field}:${key}`, {
          kind: accentsOnly ? 'accents' : 'spelling', rule: accentsOnly ? 'EXT-DATAC-LING-INCONS' : 'INT-LING-INCONS',
          label: `${FIELD_BY_KEY[field].label} "${forms[0]}"`,
          note: accentsOnly
            ? 'The same term with and without diacritics: converted differently across records.'
            : 'The same term written in different ways across the collection.',
        });
        for (const o of occs) b.add(o.text, o, o.text);
      }
    }

    // diacritics kept in some records and stripped in others, inside titles and descriptions
    for (const field of fieldsOf('EXT-DATAC-LING-INCONS').filter((f) => f === 'dcTitle' || f === 'dcDescription')) {
      const byFold = new Map();
      for (const record of records) {
        for (const { v, i } of liveValues(record, field)) {
          for (const h of findAll(/[\p{L}]{4,}/gu, v)) {
            if (vocabCovered.has(`${record.id}|${field}|${i}|${h.start}`)) continue;
            const key = fold(h.text);
            if (!byFold.has(key)) byFold.set(key, []);
            byFold.get(key).push({ recordId: record.id, field, valueIndex: i, ...h });
          }
        }
      }
      for (const [key, occs] of byFold) {
        const forms = uniq(occs.map((o) => o.text.toLowerCase()));
        if (forms.length < 2 || !forms.some((f) => f !== fold(f))) continue;
        const b = builder(`accents:text:${key}`, {
          kind: 'accents', rule: 'EXT-DATAC-LING-INCONS',
          label: `"${occs.find((o) => o.text.toLowerCase() !== fold(o.text)).text}" with and without diacritics`,
          note: 'The same word with and without diacritics: converted differently across records.',
        });
        for (const o of occs) b.add(o.text, o, o.text.toLowerCase());
      }
    }

    // date conventions and approximation notation (EXT-DATAC-TEMP-INCONS)
    for (const record of records) {
      for (const field of fieldsOf('EXT-DATAC-TEMP-INCONS')) {
        for (const { v, i } of liveValues(record, field)) {
          if (field !== 'dcDescription') {
            const format = /^\d{4}(-\d{2}(-\d{2})?)?$/.test(v) ? 'ISO 8601 (1952-06-12)'
              : /^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}$/.test(v) ? 'Numeric (12/06/1952)'
                : /^(\d{1,2}\s+)?[\p{L}]{3,9}\.?\s+\d{4}$/u.test(v) ? 'Written (12 June 1952)' : null;
            if (format) {
              builder('format:date', { kind: 'format', rule: 'EXT-DATAC-TEMP-INCONS', label: 'Date formats', note: 'Precise dates written following different conventions across records.' })
                .add(format, { recordId: record.id, field, valueIndex: i, start: 0, end: v.length, text: v });
            }
          }
          for (const h of findAll(APPROX_NOTATION_RE, v)) {
            builder('format:approx', { kind: 'format', rule: 'EXT-DATAC-TEMP-INCONS', label: 'Notation for approximate dates', note: 'The same approximation ("circa 1880") appears in different notations across records.' })
              .add(fold(h.text).trim(), { recordId: record.id, field, valueIndex: i, start: h.start, end: h.start + h.text.trimEnd().length, text: h.text.trim() });
          }
        }
      }
    }

    // records describing the same object: shared identifier, sameAs link, or title + creator + institution
    const parent = new Map(records.map((r) => [r.id, r.id]));
    const find = (x) => {
      while (parent.get(x) !== x) x = parent.get(x);
      return x;
    };
    const keyOwner = new Map();
    for (const r of records) {
      const keys = [...r.identifier.map((x) => `id:${fold(x)}`), ...r.sameAs.map((x) => `same:${fold(x)}`)];
      const title = liveValues(r, 'dcTitle')[0];
      const creator = liveValues(r, 'dcCreator')[0];
      if (title && creator && r.provider) keys.push(`tci:${looseKey(title.v)}|${looseKey(creator.v)}|${looseKey(r.provider)}`);
      for (const k of keys) {
        if (keyOwner.has(k)) parent.set(find(r.id), find(keyOwner.get(k)));
        else keyOwner.set(k, r.id);
      }
    }
    const objects = new Map();
    for (const r of records) {
      const root = find(r.id);
      if (!objects.has(root)) objects.set(root, []);
      objects.get(root).push(r);
    }
    for (const [root, members] of objects) {
      if (members.length < 2) continue;
      for (const r of members) r.sameObject = members.filter((m) => m !== r).map((m) => m.id);

      // INT-SP-CONT: the records assert different places
      const placeSets = members.map((r) => {
        const found = [];
        for (const field of fieldsOf('INT-SP-CONT')) {
          for (const { v, i } of liveValues(r, field)) for (const c of countriesIn(ctx, v)) found.push({ field, i, ...c });
        }
        // edmCountry is the provider's country: use it only when the record names no other place
        const own = found.filter((f) => f.field !== 'edmCountry');
        const used = own.length ? own : found;
        return { r, found: used, countries: uniq(used.map((f) => f.country)) };
      }).filter((p) => p.countries.length);
      const disagree = placeSets.some((p) => placeSets.some((q) => !p.countries.some((c) => q.countries.includes(c))));
      if (disagree) {
        const gid = `object:${root}:place`;
        const all = uniq(placeSets.flatMap((p) => p.countries));
        const b = builder(gid, { kind: 'object', noPreferred: true, label: 'Same object, different places', note: 'Records matched by a shared identifier, a sameAs link, or equal title + creator + institution assert different places.' });
        for (const p of placeSets) {
          for (const f of p.found) {
            b.add(f.country, { recordId: p.r.id, field: f.field, valueIndex: f.i, start: f.start, end: f.end, text: f.text });
            flag(p.r, 'INT-SP-CONT', f.field, f.i, { start: f.start, end: f.end, term: f.text, groupId: gid, variant: f.country.toLowerCase(), reason: `Other records of the same object place it elsewhere (${all.join(' / ')})` });
          }
        }
      }

      // INT-TEMP-INCONS: the records give dates that do not overlap
      const dated = members.map((r) => ({ r, values: liveValues(r, 'dcDate').map(({ v, i }) => ({ v, i, span: spanOf(v) })).filter((x) => x.span) }))
        .filter((d) => d.values.length);
      const clash = dated.some((a) => dated.some((b) => a !== b && !a.values.some((x) => b.values.some((y) => overlaps(x.span, y.span)))));
      if (clash) {
        const gid = `object:${root}:date`;
        const all = dated.flatMap((d) => d.values.map((x) => x.v));
        const b = builder(gid, { kind: 'object', noPreferred: true, label: 'Same object, different dates', note: 'Records matched by a shared identifier, a sameAs link, or equal title + creator + institution give dates that do not overlap.' });
        for (const d of dated) {
          for (const x of d.values) {
            b.add(x.v, { recordId: d.r.id, field: 'dcDate', valueIndex: x.i, start: 0, end: x.v.length, text: x.v });
            flag(d.r, 'INT-TEMP-INCONS', 'dcDate', x.i, { groupId: gid, variant: x.v.toLowerCase(), reason: `Other records of the same object give other dates (${uniq(all).join(' / ')})` });
          }
        }
      }
    }

    // MISS-DATAC-*: a field present at the provider proxy is never carried to the Europeana proxy
    const withTarget = records.filter((r) => r.target);
    if (withTarget.length) {
      for (const ruleId of ['MISS-DATAC-ATTR', 'MISS-DATAC-LING']) {
        for (const field of fieldsOf(ruleId)) {
          const present = withTarget.filter((r) => liveValues(r, field).length);
          const carried = withTarget.some((r) => (r.target[field] || []).length);
          if (carried || present.length / withTarget.length < 0.2) continue;
          for (const r of present) {
            flag(r, ruleId, field, -1, { reason: `Filled for ${present.length} of ${withTarget.length} records at the provider proxy, but never carried to the Europeana proxy` });
          }
        }
      }
    }

    // finalise groups; flag the non-reference forms of collection-wide variants
    const groups = {};
    for (const [id, b] of builders) {
      const group = b.build();
      if (!group) continue;
      groups[id] = group;
      for (const variant of group.variants) {
        for (const o of variant.occurrences) {
          byId.get(o.recordId).terms.push({ field: o.field, valueIndex: o.valueIndex, start: o.start, end: o.end, groupId: id, variant: variant.key, preferred: variant.preferred });
        }
      }
      const ruleId = group.kind === 'vocabulary' ? (group.spatial ? null : 'INT-LING-INCONS') : group.rule;
      if (!ruleId) continue;
      const preferred = group.variants.find((v) => v.preferred);
      for (const variant of group.variants.filter((v) => !v.preferred)) {
        for (const o of variant.occurrences) {
          flag(byId.get(o.recordId), ruleId, o.field, o.valueIndex, {
            start: o.start, end: o.end, term: o.text, groupId: id, variant: variant.key,
            reason: `"${o.text}" is used where the collection's reference form is "${preferred.label}" (${group.variants.length} forms in use)`,
          });
        }
      }
    }

    const fieldStats = FIELDS.map((f) => {
      const stats = { key: f.key, label: f.label, dimensions: dimensionsOf(taxonomy, f.key), total: records.length, missing: 0, incomplete: 0, complete: 0 };
      for (const r of records) stats[completenessOf(r, f.key)] += 1;
      return stats;
    });

    return { records, groups, fieldStats, hasProxies: withTarget.length > 0 };
  }

  /** Dimensions a field belongs to, according to the taxonomy's "Fields" column. */
  function dimensionsOf(taxonomy, field) {
    return uniq(taxonomy.rules.filter((r) => r.fields.includes(field)).map((r) => r.dimension));
  }

  /** missing / incomplete / complete state of one field of an analysed record. */
  function completenessOf(record, field) {
    if (!record.values[field].some((v) => !isPlaceholder(v))) return 'missing';
    return record.flags.some((f) => f.field === field && f.type === 'incomplete') ? 'incomplete' : 'complete';
  }

  /** Flags of a record that match the filters. */
  function matchingFlags(record, { mode, dimension, type, origins }) {
    const wanted = mode === 'missing' ? 'missing' : type;
    return record.flags.filter((f) => f.type === wanted &&
      (dimension === 'all' || f.dimension === dimension) &&
      (!origins || origins.has(f.origin)));
  }

  /** Number of distinct fields flagged for the filters: the grid's sort key. */
  function flaggedFieldCount(record, filter) {
    return new Set(matchingFlags(record, filter).map((f) => f.field)).size;
  }

  return {
    DIMENSIONS, TYPES, ORIGINS, FIELDS, FIELD_BY_KEY,
    analyse, matchingFlags, flaggedFieldCount, completenessOf, dimensionsOf, normaliseRecords,
    keywordPattern, isPlaceholder, spanOf, looseKey,
  };
});
