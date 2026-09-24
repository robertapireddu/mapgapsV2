'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/analysis.js');
const IO = require('../js/io.js');
const taxonomy = require('../data/taxonomy.js');
const vocabulary = require('../data/vocabulary.js');
const SAMPLE = require('../data/sample-data.js');

const run = (rows) => A.analyse(rows, { taxonomy, vocabulary });
const rulesOf = (record, field) => [...new Set(record.flags.filter((f) => !field || f.field === field).map((f) => f.rule))].sort();
const has = (record, rule, field) => record.flags.some((f) => f.rule === rule && (!field || f.field === field));

test('the taxonomy has every rule the engine implements', () => {
  const ids = taxonomy.rules.map((r) => r.id);
  for (const id of ['MISS-TEMP', 'INT-TEMP-INCOMP', 'INT-SP-CONT', 'INT-LING-INCONS', 'EXT-UI-LING-CONT', 'MISS-DATAC-ATTR', 'EXT-UI-ATTR-INC']) {
    assert.ok(ids.includes(id), id);
  }
});

test('MISS-*: empty fields are flagged per dimension listed in the taxonomy', () => {
  const [r] = run([{ dcTitle: 'A title', dcDate: 'none' }]).records;
  assert.ok(has(r, 'MISS-TEMP', 'dcDate'));
  assert.ok(has(r, 'MISS-TEMP', 'dcDescription'));
  assert.ok(has(r, 'MISS-SP', 'dcDescription'));
  assert.ok(has(r, 'MISS-LING', 'dcDescription'));
  assert.ok(has(r, 'MISS-ATTR', 'dcCreator'));
  assert.ok(!has(r, 'MISS-LING', 'dcTitle'), 'dcTitle is not listed under MISS-LING');
});

test('INT-TEMP-INCOMP: every keyword of the Temporal Keywords sheet', () => {
  const values = ['ca. 1950', 'c.1935', '~1880', 'approximately 1900', 'possibly 1931', 'undated', 'no date',
    'between 1920 and 1930', '20th century', 'twentieth century', 'early 20th century', 'mid-19th century',
    '1930s', "1930's", "30's", 'thirties', 'pre-war', 'interwar', 'between the wars', 'Victorian',
    'Belle Epoque', 'fin de siècle', 'medieval', 'early modern'];
  const { records } = run(values.map((d) => ({ dcDate: d })));
  records.forEach((r, i) => assert.ok(has(r, 'INT-TEMP-INCOMP', 'dcDate'), values[i]));
  const [precise] = run([{ dcDate: '1952-06-12' }]).records;
  assert.ok(!has(precise, 'INT-TEMP-INCOMP'));
});

test('false positives from the Contested words sheet are ignored', () => {
  assert.ok(taxonomy.falsePositives.includes('stone-age'));
});

test('EXT-UI-TEMP-INCOM: guessed, abbreviated and mistyped dates', () => {
  const values = ['193-', '19??', '1920?', '[1934]', "'52", '19522', '2099'];
  const { records } = run(values.map((d) => ({ dcDate: d })));
  records.forEach((r, i) => assert.ok(has(r, 'EXT-UI-TEMP-INCOM', 'dcDate'), values[i]));
});

test('INT-SP-INCOMP: a country is the only place information', () => {
  const [countryOnly, withPlace] = run([
    { dcCoverage: 'UK', edmCountry: 'United Kingdom' },
    { dcCoverage: 'Epsom Downs, Surrey, England', edmCountry: 'United Kingdom' },
  ]).records;
  assert.ok(has(countryOnly, 'INT-SP-INCOMP', 'dcCoverage'));
  assert.ok(!has(withPlace, 'INT-SP-INCOMP'));
});

test('INT-SP-INCONS and EXT-UI-SPA-INCONS: conflicting countries, variant forms of one place', () => {
  const [r] = run([{ dcCoverage: ['Cluj-Napoca, Cluj, Romania', 'UK', 'United Kingdom'], edmCountry: 'United Kingdom' }]).records;
  assert.ok(has(r, 'INT-SP-INCONS'));
  assert.ok(has(r, 'EXT-UI-SPA-INCONS', 'dcCoverage'));
});

test('INT-SP-CONT and INT-TEMP-INCONS: records of the same object disagree', () => {
  const { records, groups } = run([
    { id: 'a', dcIdentifier: 'OBJ-1', dcTitle: 'Wagon', dcCoverage: 'Appleby-in-Westmorland, Cumbria, England', dcDate: '1952' },
    { id: 'b', dcIdentifier: 'OBJ-1', dcTitle: 'Wagon', dcCoverage: 'Cluj-Napoca, Cluj, Romania', dcDate: '1912' },
  ]);
  for (const r of records) {
    assert.ok(has(r, 'INT-SP-CONT'), r.id);
    assert.ok(has(r, 'INT-TEMP-INCONS', 'dcDate'), r.id);
  }
  assert.ok(Object.keys(groups).some((k) => k.startsWith('object:')));
});

test('INT-LING-INCONS: Gypsy / Gipsy / Romani / Roma across the collection', () => {
  const { records, groups } = run([
    { id: '1', dcTitle: 'Roma family' },
    { id: '2', dcTitle: 'Gipsy encampment' },
    { id: '3', dcSubject: 'Romani; Horse fairs' },
  ]);
  const group = groups['vocab:roma'];
  assert.deepEqual(group.variants.map((v) => v.label).sort(), ['Gipsy', 'Roma', 'Romani']);
  assert.equal(group.variants.find((v) => v.preferred).label, 'Roma');
  assert.ok(!has(records[0], 'INT-LING-INCONS'));
  assert.ok(has(records[1], 'INT-LING-INCONS', 'dcTitle'));
  assert.ok(has(records[1], 'EXT-UI-LING-CONT', 'dcTitle'), '"Gipsy" is also a contested term');
  assert.equal(records[0].terms[0].groupId, 'vocab:roma', 'the reference term still opens the pop-up');
});

test('EXT-UI-LING-INCONS: several names for the same community inside one record', () => {
  const [r] = run([{ dcSubject: ['Roma', 'Gypsy', 'Romani'] }]).records;
  assert.equal(r.flags.filter((f) => f.rule === 'EXT-UI-LING-INCONS').length, 3);
});

test('INT-LING-INCOMP: generic labels; Contested when self-designations are known', () => {
  const [generic, aggregated, specific] = run([
    { dcSubject: 'folk music' },
    { dcSubject: 'Travellers' },
    { dcSubject: ['Travellers', 'Irish Travellers'] },
  ]).records;
  assert.equal(generic.flags.find((f) => f.rule === 'INT-LING-INCOMP').type, 'incomplete');
  assert.equal(aggregated.flags.find((f) => f.rule === 'INT-LING-INCOMP').type, 'contested');
  assert.ok(!specific.flags.some((f) => f.rule === 'INT-LING-INCOMP' && f.term === 'Travellers'));
});

test('EXT-DATAC-LING-INCONS: diacritics kept in some records, stripped in others', () => {
  const { records } = run([{ dcSubject: 'Sfântul Ilie' }, { dcSubject: 'Sfântul Ilie' }, { dcSubject: 'Sfantul Ilie' }]);
  assert.ok(has(records[2], 'EXT-DATAC-LING-INCONS', 'dcSubject'));
});

test('EXT-DATAC-TEMP-INCONS: approximation notation varies across records', () => {
  const { records } = run([{ dcDate: 'ca. 1880' }, { dcDate: 'ca. 1890' }, { dcDate: 'circa 1880' }]);
  assert.ok(has(records[2], 'EXT-DATAC-TEMP-INCONS', 'dcDate'));
});

test('attributional rules: bare Wikidata address, URL instead of a name', () => {
  const [wikidata, url] = run([{ dcCreator: 'https://www.wikidata.org' }, { dcCreator: 'http://viaf.org/viaf/123' }]).records;
  assert.ok(has(wikidata, 'EXT-UI-ATTR-INC', 'dcCreator'));
  assert.ok(has(url, 'EXT-DATAC-LINK-INCOMP', 'dcCreator'));
});

test('data-conversion rules compare the provider and Europeana proxies', () => {
  const recordApi = (n, provider, europeana) => ({
    about: `/1/${n}`,
    proxies: [{ europeanaProxy: false, ...provider }, { europeanaProxy: true, ...europeana }],
    timespans: [{ about: 'http://data.europeana.eu/timespan/1880', prefLabel: { en: ['1880'] } }],
    places: [{ about: 'http://data.europeana.eu/place/ro', prefLabel: { en: ['Romania'] } }],
  });
  const { records } = run([
    recordApi(1, { dcDate: { def: ['circa 1880'] }, dcCoverage: { def: ['Cluj-Napoca, Cluj, Romania'] }, dcTitle: { en: ['A'] }, dcContributor: { def: ['X'] }, dcSubject: { en: ['a', 'b', 'c'] } },
      { dcDate: { def: ['http://data.europeana.eu/timespan/1880'] }, dcCoverage: { def: ['http://data.europeana.eu/place/ro'] }, dcSubject: { def: ['a'] } }),
    recordApi(2, { dcTitle: { en: ['B'] }, dcContributor: { def: ['Y'] } }, {}),
  ]);
  const [r] = records;
  assert.equal(r.target.dcDate[0], '1880', 'Europeana-proxy entity is resolved to its label');
  assert.ok(has(r, 'EXT-DATAC-TEMP-INCOM', 'dcDate'));
  assert.ok(has(r, 'EXT-DATAC-SPA-INCOM', 'dcCoverage'));
  assert.ok(has(r, 'EXT-DATAC-LING-INCOM', 'dcSubject'));
  assert.ok(has(r, 'MISS-DATAC-ATTR', 'dcContributor'));
  assert.ok(has(r, 'MISS-DATAC-LING', 'dcTitle'));
});

test('completeness distinguishes missing, incomplete and complete', () => {
  const { fieldStats } = run([{ dcDate: '' }, { dcDate: '1950s' }, { dcDate: '1952' }]);
  const date = fieldStats.find((s) => s.key === 'dcDate');
  assert.deepEqual([date.missing, date.incomplete, date.complete], [1, 1, 1]);
});

test('Europeana Search API items and CSV rows are mapped onto Europeana fields', () => {
  const [item] = A.normaliseRecords([{
    id: '/123/abc', dataProvider: ['Museum'], title: ['A title'], dcCreatorLangAware: { def: ['Hartley, Edith'] },
    year: ['1952'], edmPlaceLabel: ['Bucharest'], country: ['romania'], dcSubjectLangAware: { en: ['Roma', 'Music'] },
  }]);
  assert.deepEqual([item.values.dcCreator[0], item.values.dcDate[0], item.values.dcCoverage[0], item.values.edmCountry[0]], ['Hartley, Edith', '1952', 'Bucharest', 'romania']);
  assert.deepEqual(item.values.dcSubject, ['Roma', 'Music']);

  const [row] = A.normaliseRecords(IO.parseCSV('dc:identifier,dc:title,dc:subject,dcterms:spatial,europeana:dcDate\n1,"Title, with comma",Roma; Gypsy,UK,1880\n'));
  assert.deepEqual(row.values.dcTitle, ['Title, with comma']);
  assert.deepEqual(row.values.dcSubject, ['Roma', 'Gypsy']);
  assert.deepEqual(row.values.dcCoverage, ['UK']);
  assert.deepEqual(row.target.dcDate, ['1880']);
});

test('the sample collection exercises the taxonomy', () => {
  const { records } = run(SAMPLE);
  const fired = new Set(records.flatMap((r) => r.flags.map((f) => f.rule)));
  const silent = taxonomy.rules.map((r) => r.id).filter((id) => !fired.has(id));
  assert.deepEqual(silent, ['MISS-DATAC-LING'], 'titles do reach the Europeana proxy in the sample');
});
