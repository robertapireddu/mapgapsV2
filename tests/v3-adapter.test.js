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
  assert.ok(gypsy.dcTitle.flags.some((f) => f.type === 'contested'));
  assert.ok(gypsy.dcTitle.flags.some((f) => f.type === 'inconsistent'));
  assert.equal(gypsy.dcTitle.termCluster, 'vocab:roma');
  assert.match(gypsy.dcTitle.value, /<span class="contested-word"[^>]*>Gypsy<\/span>/);
  const cluster = clusters['vocab:roma'];
  assert.deepEqual(cluster.records.sort(), ['1', '2', '3']);
  assert.equal(cluster.terms.find((t) => t.value === 'Gypsy').type, 'contested');
  assert.equal(cluster.terms.find((t) => t.value === 'Roma').preferred, true);
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
  assert.ok(clusters['vocab:roma'].terms.length >= 4);
  assert.ok(!records.some((r) => r.fields.dcType.flags.some((f) => /Vague/.test(f.note))), 'dcType is not checked for vague text');
});
