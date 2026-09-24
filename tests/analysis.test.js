'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/analysis.js');
const IO = require('../js/io.js');
const VOCABULARY = require('../data/vocabulary.js');
const SAMPLE = require('../data/sample-data.js');

const flagsOf = (record, field) => record.flags.filter((f) => f.field === field).map((f) => f.type);

test('missing placeholders are detected', () => {
  for (const v of ['', 'none', 'Unknown', '[unknown]', 'n.d.', 'Unknown photographer', 'anonymous']) {
    assert.ok(A.isMissing(v), v);
  }
  assert.ok(!A.isMissing('1952'));
});

test('temporal incompleteness and contested dates', () => {
  const { records } = A.analyse([
    { id: 'a', date: '20th cent.' }, { id: 'b', date: '1950s' }, { id: 'c', date: 'c. 1935' },
    { id: 'd', date: '1931 or 1934' }, { id: 'e', date: '1920?' }, { id: 'f', date: '1952-06-12' },
  ]);
  assert.deepEqual(records.map((r) => flagsOf(r, 'date')), [
    ['incomplete'], ['incomplete'], ['incomplete'], ['contested'], ['contested'], [],
  ]);
});

test('vocabulary variants flag non-preferred terms (Gypsy / Roma / Romani)', () => {
  const { records, groups } = A.analyse([
    { id: '1', title: 'Roma family' },
    { id: '2', title: 'Gipsy encampment' },
    { id: '3', subject: 'Romani; Gypsies' },
  ], VOCABULARY);
  const group = groups['vocab:roma'];
  assert.ok(group);
  assert.deepEqual(group.variants.map((v) => v.label).sort(), ['Gipsy', 'Gypsies', 'Roma', 'Romani']);
  assert.equal(group.variants.find((v) => v.preferred).label, 'Roma');
  assert.deepEqual(flagsOf(records[0], 'title'), []);
  assert.deepEqual(flagsOf(records[1], 'title'), ['inconsistent']);
  assert.equal(records[1].flags.find((f) => f.field === 'title').term, 'Gipsy');
  assert.deepEqual(flagsOf(records[2], 'subject'), ['inconsistent', 'inconsistent']);
  // the reference term is still linked to the group so it can open the pop-up
  assert.equal(records[0].terms[0].groupId, 'vocab:roma');
});

test('a single consistent term is not flagged', () => {
  const { records, groups } = A.analyse([{ id: '1', title: 'Gypsy wagon' }, { id: '2', title: 'Gypsy fair' }], VOCABULARY);
  assert.equal(groups['vocab:roma'], undefined);
  assert.deepEqual(flagsOf(records[0], 'title'), []);
});

test('longer vocabulary matches win over overlapping shorter ones', () => {
  const hits = A.findVocabularyMatches('Irish Travellers camp', VOCABULARY);
  assert.deepEqual(hits.map((h) => h.text), ['Irish Travellers']);
  assert.equal(A.findVocabularyMatches('Romania', VOCABULARY.filter((g) => g.id === 'roma')).length, 0);
});

test('name forms of the same creator are grouped', () => {
  const { groups } = A.analyse([
    { id: '1', creator: 'Hartley, Edith' }, { id: '2', creator: 'Hartley, Edith' },
    { id: '3', creator: 'Edith Hartley' }, { id: '4', creator: 'E. Hartley' }, { id: '5', creator: 'Hartley' },
  ]);
  const group = Object.values(groups).find((g) => g.id.startsWith('auto:creator:'));
  assert.deepEqual(group.variants.map((v) => v.label), ['Hartley, Edith', 'Edith Hartley', 'E. Hartley', 'Hartley']);
});

test('mixed date formats are inconsistent', () => {
  const { records, groups } = A.analyse([
    { id: '1', date: '1952-06-12' }, { id: '2', date: '1961' }, { id: '3', date: '12/06/1952' },
  ]);
  assert.ok(groups['format:date']);
  assert.deepEqual(flagsOf(records[2], 'date'), ['inconsistent']);
});

test('completeness distinguishes missing, incomplete and complete', () => {
  const { fieldStats } = A.analyse([{ id: '1', date: '' }, { id: '2', date: '1950s' }, { id: '3', date: '1952' }]);
  assert.deepEqual(fieldStats.find((s) => s.key === 'date').completeness, { missing: 1, incomplete: 1, complete: 1 });
});

test('Europeana Search API items are mapped', () => {
  const [r] = A.normaliseRecords([{
    id: '/123/abc', guid: 'https://www.europeana.eu/item/123/abc', dataProvider: ['Museum'],
    title: ['A title'], dcCreatorLangAware: { def: ['Hartley, Edith'] }, year: ['1952'],
    edmPlaceLabel: ['Bucharest'], dcSubjectLangAware: { en: ['Roma', 'Music'] }, dcLanguage: ['en'],
  }]);
  assert.equal(r.id, '/123/abc');
  assert.equal(r.creator, 'Hartley, Edith');
  assert.equal(r.date, '1952');
  assert.equal(r.spatial, 'Bucharest');
  assert.deepEqual(r.subject, ['Roma', 'Music']);
  assert.equal(r.provider, 'Museum');
});

test('CSV with Dublin Core headers is parsed', () => {
  const rows = IO.parseCSV('dc:identifier,dc:title,dc:subject,dcterms:spatial\n1,"Title, with comma",Roma; Gypsy,UK\n');
  const [r] = A.normaliseRecords(rows);
  assert.equal(r.title, 'Title, with comma');
  assert.deepEqual(r.subject, ['Roma', 'Gypsy']);
  assert.equal(r.spatial, 'UK');
});

test('the sample collection exercises every flag type', () => {
  const { records } = A.analyse(SAMPLE, VOCABULARY);
  const types = new Set(records.flatMap((r) => r.flags.map((f) => f.type)));
  assert.deepEqual([...types].sort(), ['contested', 'incomplete', 'inconsistent', 'missing']);
});
