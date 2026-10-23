'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/analysis.js');
const { toV3, esc } = require('../js/v3-adapter.js');
const taxonomy = require('../data/taxonomy.js');
const vocabulary = require('../data/vocabulary.js');
const COLLECTION = require('../data/collection-2024904.js');

const run = (rows) => toV3(A.analyse(rows, { taxonomy, vocabulary }), A);

test('Record API: every non-Europeana proxy is read and linked entities show their label', () => {
  const [r] = A.normaliseRecords([{
    about: '/1/a',
    proxies: [
      { europeanaProxy: false, edmType: 'IMAGE' }, // aggregator proxy without descriptive fields
      { europeanaProxy: false, dcTitle: { en: ['Roma caravan'] }, dcCreator: { def: ['http://www.wikidata.org/entity/Q1'] } },
      { europeanaProxy: true },
    ],
    agents: [{ about: 'http://www.wikidata.org/entity/Q1', prefLabel: { en: ['John Topham'] } }],
  }]);
  assert.deepEqual(r.values.dcTitle, ['Roma caravan']);
  assert.deepEqual(r.values.dcCreator, ['John Topham']);
  assert.deepEqual(r.links.dcCreator, [{ label: 'John Topham', uri: 'http://www.wikidata.org/entity/Q1' }]);
});

test('absent fields, uncertainty flags and term clusters reach the Version 3 shape', () => {
  const { records, clusters } = run([
    { id: '1', dcTitle: 'Gypsy camp', dcType: 'photograph', edmCountry: 'United Kingdom' },
    { id: '2', dcTitle: 'Roma family', dcType: 'photograph', edmCountry: 'United Kingdom' },
    { id: '3', dcTitle: 'Roma wedding', dcType: 'photograph', edmCountry: 'United Kingdom' },
  ]);
  const gypsy = records[0].fields;
  assert.equal(gypsy.dcCreator.missing, true);
  assert.equal(gypsy.dcCreator.flags[0].type, 'missing');
  assert.equal(gypsy.dcTitle.termCluster, 'vocab:roma-gypsy-grt');
  assert.match(gypsy.dcTitle.value, /<span class="inconsistent-word"[^>]*>Gypsy<\/span>/);
  const cluster = clusters['vocab:roma-gypsy-grt'];
  assert.deepEqual(cluster.records.sort(), ['1', '2', '3']);
  // the taxonomy names no reference term: every form is flagged, none is starred
  assert.ok(cluster.terms.every((t) => !t.preferred));
  assert.ok(records[1].fields.dcTitle.flags.some((f) => f.type === 'inconsistent'), 'Roma is flagged too');
  // the taxonomy's Contested words sheet lists no contested terms yet
  assert.ok(!gypsy.dcTitle.flags.some((f) => f.type === 'contested'));
});

test('the dashboard word lists come only from the taxonomy', () => {
  assert.deepEqual(vocabulary.variantGroups.map((g) => g.variants), [['Roma', 'Gypsy', 'Gypsies', 'Romani', 'Romany', 'Gipsy', 'GRT']]);
  assert.ok(vocabulary.variantGroups.every((g) => !g.preferred));
  assert.deepEqual([vocabulary.contestedWords, vocabulary.genericTerms, vocabulary.regionalLabels], [[], [], []]);
  const example = taxonomy.rules.find((r) => r.id === 'EXT-UI-LING-INCONS').issue;
  for (const v of vocabulary.variantGroups[0].variants) assert.ok(example.includes(`"${v}`), v);
});

test('contested words come only from the DE-BIAS vocabulary', () => {
  const DEBIAS = require('../data/debias-vocabulary.js');
  const withDebias = { ...vocabulary, contestedTerms: DEBIAS.terms };
  const out = toV3(A.analyse([
    { id: '1', dcTitle: 'Gypsy camp', dcDescription: 'Portrait of two natives in exotic dress at the fair.' },
  ], { taxonomy, vocabulary: withDebias }), A);
  const f = out.records[0].fields;
  const gypsy = f.dcTitle.flags.find((x) => x.type === 'contested');
  assert.ok(gypsy, 'Gypsy is contested');
  assert.match(gypsy.note, /DE-BIAS vocabulary \(debias:t_99_en\)/);
  assert.match(gypsy.note, /Roma, Sinti/);
  const desc = f.dcDescription.flags.filter((x) => x.type === 'contested').map((x) => x.note).join('\n');
  assert.match(desc, /"exotic".*context-dependent/);
  // labels are matched exactly as written (apart from capitals): no plural forms are added
  assert.doesNotMatch(desc, /"natives"/);
  // only entries active in the DE-BIAS Knowledge Graph are used
  assert.ok(DEBIAS.terms.length > 150);
  assert.ok(!DEBIAS.terms.some((t) => t.label === '(((echo)))'), 'excluded from detection by DE-BIAS');
  assert.ok(!JSON.stringify(DEBIAS).includes('Contentious issue'));
});

test('reviewed false positives are not flagged as contested', () => {
  const DEBIAS = require('../data/debias-vocabulary.js');
  const out = toV3(A.analyse([
    { id: '1', dcDescription: 'Fortune teller - coloured engraving after a painting by Teniers.', dcSubject: 'costume (mode of fashion)' },
    { id: '2', dcDescription: 'Romani family camped on Epsom downs during the race meeting on Epsom racecourse.' },
    { id: '3', dcDescription: 'A study of race and identity in the photographs.' },
  ], { taxonomy, vocabulary: { ...vocabulary, contestedTerms: DEBIAS.terms } }), A);
  const contested = (r, k) => (r.fields[k].flags || []).some((f) => f.type === 'contested');
  assert.ok(!contested(out.records[0], 'dcDescription'), 'coloured engraving');
  assert.ok(!contested(out.records[0], 'dcSubject'), 'costume (mode of fashion)');
  assert.ok(!contested(out.records[1], 'dcDescription'), 'race meeting');
  assert.ok(contested(out.records[2], 'dcDescription'), '"race" elsewhere is still flagged');
});

test('uploaded text is escaped', () => {
  const [r] = run([{ id: 'x', dcTitle: '<img src=x onerror=alert(1)>', dcDescription: 'A <b>bold</b> claim about the photograph taken here.' }]).records;
  assert.ok(!/<img|<b>/.test(r.fields.dcTitle.value + r.fields.dcDescription.value));
  assert.equal(esc('<a href="x">'), '&lt;a href=&quot;x&quot;&gt;');
});

test('the bundled collection sample loads without an API key', () => {
  assert.equal(COLLECTION.length, 100);
  assert.ok(!JSON.stringify(COLLECTION).includes('apikey'));
  const { records, clusters, provider } = run(COLLECTION);
  assert.equal(provider, 'TopFoto');
  assert.equal(records.filter((r) => !r.fields.dcTitle.missing).length, 100, 'every record has a title');
  assert.ok(clusters['vocab:roma-gypsy-grt'].terms.length >= 4);
  assert.ok(!records.some((r) => r.fields.dcType.flags.some((f) => /Vague/.test(f.note))), 'dcType is not checked for vague text');
});
