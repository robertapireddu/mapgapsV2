#!/usr/bin/env node
/*
 * Generates data/sample-data.js: a SYNTHETIC collection shaped like
 * Europeana Search API items (profile=rich). The records are invented to
 * exercise every MapGaps flag; they do not describe real objects.
 *
 *   node scripts/generate-sample.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

let seed = 20260924;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (weighted) => {
  const total = weighted.reduce((n, [, w]) => n + w, 0);
  let r = rand() * total;
  for (const [value, w] of weighted) if ((r -= w) < 0) return value;
  return weighted[weighted.length - 1][0];
};
const some = (pool, min, max) => {
  const n = min + Math.floor(rand() * (max - min + 1));
  const out = new Set();
  while (out.size < n) out.add(pick(pool));
  return [...out];
};

const community = [['Roma', 34], ['Romani', 14], ['Gypsy', 22], ['Gipsy', 10], ['Romany', 8], ['Tzigane', 3]];
const travellers = [['Irish Travellers', 6], ['Travellers', 5], ['Tinkers', 2], ['Pavee', 1]];
const wagon = [['vardo', 12], ['varda', 4], ['wardo', 2], ['bow-top wagon', 3], ['caravan', 6]];
const fair = [['Appleby Horse Fair', 5], ['Epsom Derby', 3], ['Stow Horse Fair', 3], ['the Sfântul Ilie fair', 2]];

const titles = [
  [() => `${pick(community)} family outside their ${pick(wagon)}`, 8],
  [() => `Horse dealing at ${pick(fair)}`, 5],
  [() => `${pick(community)} women selling clothes pegs`, 4],
  [() => `Portrait of a ${pick(community)} child`, 4],
  [() => `${pick(travellers)} encampment by the roadside`, 3],
  [() => `Fiddler playing at ${pick(fair)}`, 3],
  [() => `${pick(community)} wedding celebration`, 3],
  [() => `Painting the wheels of a ${pick(wagon)}`, 2],
  [() => 'Untitled', 2],
];

const places = [
  ['Appleby-in-Westmorland, Cumbria, England', 9], ['Appleby in Westmorland, Cumbria', 3], ['Appleby', 2],
  ['Epsom Downs, Surrey, England', 4], ['Stow-on-the-Wold, Gloucestershire, England', 4],
  ['Cluj-Napoca, Cluj, Romania', 4], ['Bucharest, Romania', 3], ['București', 2],
  ['UK', 3], ['Great Britain', 2], ['United Kingdom', 1], ['Romania', 2], ['Rumania', 1],
  ['near Epsom?', 1], ['Epsom or Stow-on-the-Wold', 1], ['', 5], ['unknown', 2],
];

const dates = [
  ['1952-06-12', 7], ['1938-07-02', 5], ['1961', 6], ['1947-06', 3], ['1929', 3],
  ['12/06/1952', 4], ['03/08/1936', 2], ['June 1958', 3], ['4 July 1949', 2],
  ['20th century', 3], ['20th cent.', 1], ['1950s', 3], ['193-', 1], ['c. 1935', 3], ['ca. 1910', 1],
  ['1900-1950', 1], ['1920?', 2], ['1931 or 1934', 1], ['', 4], ['undated', 2], ['n.d.', 1],
];

const periods = [['', 20], ['1950-1959', 3], ['Interwar period', 2], ['20th century', 3], ['early 20th century', 1]];

const creators = [
  ['Hartley, Edith', 8], ['Edith Hartley', 3], ['E. Hartley', 2], ['Hartley', 1],
  ['Ionescu, Mihai', 5], ['Mihai Ionescu', 2],
  ['Brooks, Samuel', 4], ['Attributed to Samuel Brooks', 2], ['Brooks, S.?', 1],
  ['Sampson, Rose', 3], ['Unknown photographer', 3], ['anonymous', 2], ['', 5], ['none', 2],
];

const subjects = [
  [() => pick(community), 10], [() => pick(travellers), 2], [() => pick(wagon), 3],
  [() => pick([['Horse fairs', 4], ['Horse fair', 2], ['horse-fairs', 1]]), 3],
  [() => pick([['Music', 3], ['Folk music', 2], ['folk-music', 1]]), 2],
  [() => pick([['Craftwork', 2], ['Crafts', 2], ['Basket weaving', 1]]), 2],
  [() => 'Families', 2], [() => 'Children', 2], [() => 'Weddings', 1], [() => 'Religion (disputed)', 1],
];

const descriptions = [
  [(t) => `Black-and-white photograph, "${t}". Glass-plate negative, part of a documentary survey of fairs and encampments.`, 10],
  [(t) => `Photograph captioned "${t}", taken during the summer season. Handwritten caption on verso.`, 6],
  [() => 'Family group.', 3],
  [() => 'Photograph.', 2],
  [() => '', 4],
];

const languages = [['en', 20], ['eng', 3], ['English', 3], ['ro', 5], ['rom', 2], ['Romanian', 1], ['', 4]];
const publishers = [
  ['Folk Life Photographic Society', 8], ['The Folk Life Photographic Society', 2], ['Folk-Life Photographic Society', 1],
  ['Institutul de Etnografie', 4], ['', 6],
];
const providers = ['Fictional Folk Life Archive', 'Fictional Ethnographic Museum'];

const items = [];
for (let i = 1; i <= 72; i += 1) {
  const title = pick(titles)();
  const subjectFns = some(subjects, rand() < 0.12 ? 0 : 1, 3);
  const subject = [...new Set(subjectFns.map((f) => f()))];
  const desc = pick(descriptions)(title);
  const item = {
    id: `/9200999/MG_${String(i).padStart(4, '0')}`,
    guid: `https://www.europeana.eu/item/9200999/MG_${String(i).padStart(4, '0')}`,
    type: 'IMAGE',
    dataProvider: [providers[i % 2]],
    title: [title],
    dcCreator: [pick(creators)],
    year: [],
    dcDate: [pick(dates)],
    edmTimespanLabel: [pick(periods)],
    edmPlaceLabel: [pick(places)],
    dcSubject: subject,
    dcDescription: [desc],
    dcLanguage: [pick(languages)],
    dcPublisher: [pick(publishers)],
  };
  for (const [k, v] of Object.entries(item)) if (Array.isArray(v)) item[k] = v.filter(Boolean);
  items.push(item);
}

const out = `/*
 * SYNTHETIC sample collection for MapGaps, shaped like Europeana Search API
 * items. Generated by scripts/generate-sample.js; records are invented and
 * describe no real objects.
 */
(function (root, items) {
  if (typeof module === 'object' && module.exports) module.exports = items;
  else root.MAPGAPS_SAMPLE = items;
})(typeof self !== 'undefined' ? self : this, ${JSON.stringify(items, null, 2)});
`;
fs.writeFileSync(path.join(__dirname, '..', 'data', 'sample-data.js'), out);
console.log(`Wrote ${items.length} records to data/sample-data.js`);
