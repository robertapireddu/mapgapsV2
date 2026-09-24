#!/usr/bin/env node
/*
 * Generates data/sample-data.js: a SYNTHETIC collection shaped like Europeana
 * Record API objects (provider proxy + Europeana proxy + contextual entities).
 * The records are invented to exercise every rule of the taxonomy; they do not
 * describe real objects.
 *
 *   node scripts/generate-sample.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

let seed = 20260924;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const chance = (p) => rand() < p;
const pick = (weighted) => {
  const total = weighted.reduce((n, [, w]) => n + w, 0);
  let r = rand() * total;
  for (const [value, w] of weighted) if ((r -= w) < 0) return value;
  return weighted[weighted.length - 1][0];
};
const some = (pool, min, max) => {
  const n = min + Math.floor(rand() * (max - min + 1));
  const out = new Set();
  for (let guard = 0; out.size < n && guard < 50; guard += 1) out.add(pick(pool)());
  return [...out];
};

const community = [['Roma', 30], ['Romani', 12], ['Gypsy', 20], ['Gipsy', 8], ['Romany', 6], ['Tzigane', 3]];
const wagon = [['vardo', 10], ['varda', 4], ['wardo', 2], ['bow-top wagon', 3], ['caravan', 6]];
const fair = [['Appleby Horse Fair', 5], ['Epsom Derby', 3], ['Stow Horse Fair', 3], ['the Sfântul Ilie fair', 2], ['the Sfantul Ilie fair', 1]];

const titles = [
  [() => `${pick(community)} family outside their ${pick(wagon)}`, 8],
  [() => `Horse dealing at ${pick(fair)}`, 5],
  [() => `${pick(community)} women selling clothes pegs`, 4],
  [() => `Portrait of a ${pick(community)} child`, 4],
  [() => 'Travellers encampment by the roadside', 3],
  [() => `Fiddler playing at ${pick(fair)}`, 3],
  [() => `${pick(community)} wedding celebration`, 3],
  [() => `Painting the wheels of a ${pick(wagon)}`, 2],
  [() => 'Nomads resting near the river (Mincéirí', 1],
  [() => 'Family group outside a wagon at the horse fa...', 1],
];

// provider-proxy values, Europeana-proxy label, country of the object
const places = [
  [['Appleby-in-Westmorland, Cumbria, England'], 'Appleby-in-Westmorland', 'UK', 9],
  [['Appleby in Westmorland, Cumbria'], 'Appleby-in-Westmorland', 'UK', 3],
  [['Appleby'], 'Appleby-in-Westmorland', 'UK', 3],
  [['Epsom Downs, Surrey, England'], 'United Kingdom', 'UK', 4],
  [['Stow-on-the-Wold, Gloucestershire, England'], 'Stow-on-the-Wold', 'UK', 4],
  [['Cluj-Napoca, Cluj, Romania'], 'Romania', 'RO', 5],
  [['Bucharest'], 'Bucharest', 'RO', 3],
  [['București'], 'Bucharest', 'RO', 2],
  [['UK'], 'United Kingdom', 'UK', 3],
  [['UK', 'United Kingdom'], 'United Kingdom', 'UK', 2],
  [['Great Britain'], 'United Kingdom', 'UK', 2],
  [['Romania'], 'Romania', 'RO', 2],
  [['the Balkans'], null, 'RO', 2],
  [['Eastern Europe'], null, 'RO', 1],
  [['near Epsom?'], null, 'UK', 1],
  [['Appleby', 'Epsom Downs'], null, 'UK', 1],
  [[], null, 'UK', 5],
];

const dates = [
  ['1952-06-12', 7], ['1938-07-02', 5], ['1961', 6], ['1947-06', 3], ['1929', 3],
  ['12/06/1952', 3], ['June 1958', 2],
  ['20th century', 3], ['20th cent.', 1], ['1950s', 3], ['c. 1935', 3], ['ca. 1935', 2], ['circa 1910', 2], ['~1920', 1],
  ['1875-1885', 2], ['between the wars', 1], ['post-war', 1],
  ['193-', 1], ['1920?', 1], ['[1934]', 1], ["'52", 1], ['19522', 1],
  ['', 4], ['undated', 2], ['none', 1],
];

const creators = [
  ['Hartley, Edith', 8], ['Edith Hartley', 3], ['Ionescu, Mihai', 5], ['Sampson, Rose', 3],
  ['https://www.wikidata.org', 2], ['http://viaf.org/viaf/000000001', 2],
  ['Unknown photographer', 3], ['', 5],
];

const subjects = [
  [() => pick(community), 10], [() => pick(wagon), 3],
  [() => pick([['Travellers', 3], ['GRT', 1], ['nomads', 1]]), 3],
  [() => pick([['Horse fairs', 4], ['Horse fair', 2], ['horse-fairs', 1]]), 3],
  [() => pick([['Folk music', 3], ['folk-music', 1]]), 2],
  [() => pick([['Crafts', 2], ['Basket weaving', 2]]), 2],
  [() => pick([['1930s', 1], ['Interwar', 1], ['thirties', 1]]), 2],
  [() => 'Families', 2], [() => 'Children', 2], [() => 'Weddings', 1],
  [() => pick([['Mincéirí', 1], ['Minceiri', 1]]), 1],
];

const types = [['photograph', 10], ['Photograph', 2], ['photographs', 2], ['glass plate negative', 3], ['Photo.', 1], ['', 3]];

const descriptions = [
  [(t) => `Black-and-white photograph, "${t}". Glass-plate negative from a documentary survey of fairs and encampments.`, 8],
  [(t) => `Photograph captioned "${t}", taken between the wars. Handwritten caption on verso.`, 4],
  [(t) => `"${t}". Victorian-style painted wagon; the caption describes the family as a primitive and exotic people.`, 2],
  [(t) => `"${t}". Taken somewhere in the Balkans, probably in 1938.`, 2],
  [(t) => `"${t}". Printed in 1972 from the original negative.`, 2],
  [() => 'Family group.', 2],
  [() => '', 5],
];

const providers = {
  UK: { name: 'Fictional Folk Life Archive', country: 'United Kingdom' },
  RO: { name: 'Fictional Ethnographic Museum', country: 'Romania' },
};

const entities = { timespans: new Map(), places: new Map(), agents: new Map(), concepts: new Map() };
const entity = (kind, label) => {
  const about = `http://data.europeana.eu/${kind.slice(0, -1)}/${encodeURIComponent(label.toLowerCase().replace(/\s+/g, '-'))}`;
  entities[kind].set(about, label);
  return about;
};
const lang = (values, l = 'def') => (values.length ? { [l]: values } : undefined);

function targetDate(date) {
  if (!date) return [];
  let m = date.match(/^(\d{4})-(\d{4})$/);
  if (m) return [entity('timespans', String(Math.round((+m[1] + +m[2]) / 2)))];
  m = date.match(/^(c\.|ca\.|circa|~)\s*(\d{4})$/);
  if (m) return [entity('timespans', chance(0.7) ? m[2] : `circa ${m[2]}`)];
  m = date.match(/^(\d{4})/);
  if (m) return [entity('timespans', m[1])];
  if (/20th/.test(date)) return [entity('timespans', '20th century')];
  return [];
}

function makeRecord(n, base = {}) {
  const id = `MG_${String(n).padStart(4, '0')}`;
  const [placeValues, placeLabel, countryCode] = base.place || pick(places.map(([v, l, c, w]) => [[v, l, c], w]));
  const provider = base.provider || providers[chance(0.8) ? countryCode : countryCode === 'UK' ? 'RO' : 'UK'];
  const title = base.title || pick(titles)();
  const creator = base.creator !== undefined ? base.creator : pick(creators);
  const date = base.date !== undefined ? base.date : pick(dates);
  const subject = some(subjects, chance(0.1) ? 0 : 1, 3);
  const type = pick(types);
  const description = pick(descriptions)(title);
  const identifier = base.identifier || `FLA-${String(n).padStart(4, '0')}`;

  const providerProxy = {
    about: `/proxy/provider/9200999/${id}`,
    europeanaProxy: false,
    dcIdentifier: lang([identifier]),
    dcTitle: lang([title], 'en'),
    dcDate: lang(date ? (chance(0.05) ? [date, '1950'] : [date]) : []),
    dctermsCreated: lang(chance(0.08) ? ['1938'] : []),
    dcCreator: lang(creator ? [creator] : []),
    dcContributor: lang(chance(0.35) ? [pick([['Folk Life Photographic Society', 2], ['Sampson, Rose', 1]])] : []),
    dcCoverage: lang(placeValues),
    dctermsProvenance: lang(chance(0.1) ? ['https://collections.example.org/donor/4411'] : chance(0.1) ? ["Donated by the photographer's family, London"] : []),
    dcSubject: lang(subject, 'en'),
    dcType: lang(type ? [type] : [], 'en'),
    dcDescription: lang(description ? [description] : [], 'en'),
  };
  const europeanaProxy = {
    about: `/proxy/europeana/9200999/${id}`,
    europeanaProxy: true,
    dcTitle: chance(0.5) ? lang([title], 'en') : undefined,
    dcDate: lang(targetDate(date)),
    dcCreator: lang(/Hartley/.test(creator) ? [entity('agents', 'Edith Hartley')] : []),
    dcCoverage: lang(placeLabel ? [entity('places', placeLabel)] : []),
    dcSubject: lang(subject.length > 1 && chance(0.4) ? [entity('concepts', subject[0])] : []),
  };
  for (const proxy of [providerProxy, europeanaProxy]) {
    for (const k of Object.keys(proxy)) if (proxy[k] === undefined) delete proxy[k];
  }

  return {
    record: {
      about: `/9200999/${id}`,
      proxies: [providerProxy, europeanaProxy],
      aggregations: [{ edmDataProvider: { def: [provider.name] } }],
      europeanaAggregation: { edmCountry: { def: [provider.country] }, edmLandingPage: `https://www.europeana.eu/item/9200999/${id}` },
    },
    base: { place: [placeValues, placeLabel, countryCode], provider, title, creator, date, identifier },
  };
}

const made = [];
for (let n = 1; n <= 68; n += 1) made.push(makeRecord(n));
// the same object catalogued twice (shared identifier): with another place, or another date
const elsewhere = (base) => (base.place[2] === 'UK'
  ? [['Cluj-Napoca, Cluj, Romania'], 'Romania', 'RO']
  : [['Stow-on-the-Wold, Gloucestershire, England'], 'Stow-on-the-Wold', 'UK']);
made.push(makeRecord(69, { ...made[2].base, place: elsewhere(made[2].base) }));
made.push(makeRecord(70, { ...made[9].base, place: elsewhere(made[9].base) }));
made.push(makeRecord(71, { ...made[14].base, date: '1912' }));
made.push(makeRecord(72, { ...made[20].base, date: '1975' }));

const out = made.map(({ record }) => {
  const used = JSON.stringify(record.proxies[1]);
  const own = {};
  for (const [kind, map] of Object.entries(entities)) {
    const mine = [...map].filter(([about]) => used.includes(`"${about}"`)).map(([about, label]) => ({ about, prefLabel: { en: [label] } }));
    if (mine.length) own[kind] = mine;
  }
  return { ...record, ...own };
});

const file = `/*
 * SYNTHETIC sample collection for MapGaps, shaped like Europeana Record API
 * objects (provider proxy + Europeana proxy). Generated by
 * scripts/generate-sample.js; the records are invented and describe no real objects.
 */
(function (root, items) {
  if (typeof module === 'object' && module.exports) module.exports = items;
  else root.MAPGAPS_SAMPLE = items;
})(typeof self !== 'undefined' ? self : this, ${JSON.stringify(out)});
`;
fs.writeFileSync(path.join(__dirname, '..', 'data', 'sample-data.js'), file);
console.log(`Wrote ${out.length} records to data/sample-data.js`);
