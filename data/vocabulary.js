/*
 * MapGaps word lists: the collection-specific knowledge that the taxonomy
 * rules (data/taxonomy.js) rely on. Edit freely to fit your collection.
 *
 * variantGroups   different words for the SAME thing (INT-LING-INCONS across
 *                 the collection, EXT-UI-LING-INCONS inside one record).
 *                 `preferred` is the reference term; `fields` limits where the
 *                 group is matched (default: linguistic fields).
 * genericTerms    broad / aggregated labels (INT-LING-INCOMP). When `specific`
 *                 self-designated terms are known and the record carries none
 *                 of them, the flag is treated as Contested, as the taxonomy says.
 * contestedWords  outdated or biased terms introduced by the recorder
 *                 (EXT-UI-LING-CONT). Added to the words in the taxonomy's
 *                 "Contested words" sheet.
 * regionalLabels  over-broad regional place labels (EXT-UI-SPA-INCOM).
 * countries       country names (INT-SP-INCOMP, INT-SP-INCONS, INT-SP-CONT);
 *                 each entry is [canonical name, ...other forms].
 * placeCountries  places whose country can be inferred (for spatial checks).
 */
(function (root, vocabulary) {
  if (typeof module === 'object' && module.exports) module.exports = vocabulary;
  else root.MAPGAPS_VOCABULARY = vocabulary;
})(typeof self !== 'undefined' ? self : this, {
  variantGroups: [
    {
      id: 'roma',
      label: 'Names for the Roma community',
      preferred: 'Roma',
      note:
        '"Gypsy" / "Gipsy" and "Tzigane" / "Zigeuner" are exonyms that many Roma consider derogatory. ' +
        'They often survive in historical catalogue records and should be reviewed alongside the ' +
        'community\'s own terms (Roma, Romani).',
      variants: [
        'Roma', 'Romani', 'Romany', 'Romanies', 'Rromani',
        'Gypsy', 'Gypsies', 'Gipsy', 'Gipsies', 'Gypsey',
        'Tsigane', 'Tzigane', 'Zigeuner', 'Gitano', 'Gitanos',
      ],
    },
    {
      id: 'travellers',
      label: 'Names for Irish Traveller communities',
      preferred: 'Irish Travellers',
      note: '"Tinker" is considered derogatory by many Irish Travellers (Mincéirí / Pavee).',
      variants: ['Irish Travellers', 'Irish Traveller', 'Mincéirí', 'Minceiri', 'Pavee', 'Tinkers', 'Tinker'],
    },
    {
      id: 'vardo',
      label: 'Horse-drawn living wagon',
      preferred: 'Vardo',
      variants: ['Vardo', 'Vardos', 'Varda', 'Wardo', 'Living wagon', 'Bow-top wagon', 'Bow top'],
    },
    {
      id: 'uk',
      label: 'United Kingdom',
      preferred: 'United Kingdom',
      fields: ['dcCoverage', 'dctermsProvenance', 'edmCountry', 'dcSubject'],
      variants: ['United Kingdom', 'UK', 'U.K.', 'Great Britain', 'Britain', 'GB'],
    },
    {
      id: 'romania',
      label: 'Romania',
      preferred: 'Romania',
      fields: ['dcCoverage', 'dctermsProvenance', 'edmCountry', 'dcSubject'],
      variants: ['Romania', 'Rumania', 'Roumania', 'România'],
    },
    {
      id: 'bucharest',
      label: 'Bucharest',
      preferred: 'Bucharest',
      fields: ['dcCoverage', 'dctermsProvenance', 'dcSubject'],
      variants: ['Bucharest', 'București', 'Bucuresti', 'Bucureşti'],
    },
    {
      id: 'appleby',
      label: 'Appleby-in-Westmorland',
      preferred: 'Appleby-in-Westmorland',
      fields: ['dcCoverage', 'dctermsProvenance', 'dcSubject'],
      variants: ['Appleby-in-Westmorland', 'Appleby in Westmorland', 'Appleby'],
    },
  ],

  genericTerms: [
    {
      term: 'Travellers',
      variants: ['Travellers', 'Traveller', 'Travelers', 'Traveler', 'travelling people'],
      specific: ['Roma', 'Romani', 'Irish Travellers', 'Pavee', 'Mincéirí', 'Scottish Travellers', 'Showmen', 'Boat people'],
      note: 'Aggregates several distinct communities (Roma, Irish Travellers, Scottish Travellers, Showmen…).',
    },
    {
      term: 'GRT',
      variants: ['GRT', 'Gypsy, Roma and Traveller', 'Gypsies, Roma and Travellers'],
      specific: ['Roma', 'Romani', 'Irish Travellers', 'Pavee', 'Scottish Travellers', 'Showmen'],
      note: 'Policy acronym that groups several communities together.',
    },
    { term: 'nomads', variants: ['nomads', 'nomadic people', 'itinerants'] },
    { term: 'ethnic minority', variants: ['ethnic minority', 'ethnic minorities', 'minority group'] },
    { term: 'Eastern European', variants: ['Eastern European', 'Eastern Europeans', 'Balkan people'] },
    { term: 'folk music', variants: ['folk music', 'traditional music'] },
    { term: 'folk dance', variants: ['folk dance', 'traditional dance'] },
    { term: 'traditional costume', variants: ['traditional costume', 'national costume', 'folk costume'] },
    { term: 'craft', variants: ['craft', 'crafts', 'craftwork', 'handicraft', 'handicrafts'] },
  ],

  contestedWords: [
    'Gypsy', 'Gypsies', 'Gipsy', 'Gipsies', 'Tzigane', 'Zigeuner', 'Tinker', 'Tinkers',
    'primitive', 'savage', 'savages', 'exotic', 'native', 'natives', 'tribe', 'tribal', 'uncivilised',
    'oriental', 'half-caste', 'coloured', 'Eskimo', 'vagrant', 'vagrants', 'vagabond', 'vagabonds',
  ],

  regionalLabels: [
    'Balkans', 'the Balkans', 'Eastern Europe', 'Central Europe', 'Western Europe', 'Southern Europe',
    'Northern Europe', 'Scandinavia', 'the Orient', 'Orient', 'Levant', 'Middle East', 'Near East',
    'Far East', 'Europe', 'Asia', 'Africa', 'the Continent',
  ],

  countries: [
    ['United Kingdom', 'UK', 'U.K.', 'Great Britain', 'Britain', 'GB', 'England', 'Scotland', 'Wales', 'Northern Ireland'],
    ['Ireland', 'Éire', 'Republic of Ireland'],
    ['France'], ['Belgium'], ['Netherlands', 'The Netherlands', 'Holland'], ['Luxembourg'],
    ['Germany', 'Deutschland'], ['Austria'], ['Switzerland'], ['Italy', 'Italia'], ['Spain', 'España'],
    ['Portugal'], ['Greece'], ['Denmark'], ['Sweden'], ['Norway'], ['Finland'], ['Iceland'],
    ['Poland'], ['Czech Republic', 'Czechia'], ['Slovakia'], ['Hungary'], ['Romania', 'Rumania', 'Roumania', 'România'],
    ['Bulgaria'], ['Serbia'], ['Croatia'], ['Slovenia'], ['Bosnia and Herzegovina'], ['Montenegro'],
    ['North Macedonia', 'Macedonia'], ['Albania'], ['Kosovo'], ['Moldova'], ['Ukraine'], ['Belarus'],
    ['Lithuania'], ['Latvia'], ['Estonia'], ['Russia'], ['Turkey', 'Türkiye'], ['Cyprus'], ['Malta'],
    ['United States', 'USA', 'U.S.A.', 'United States of America'], ['Canada'], ['India'], ['Egypt'],
  ],

  placeCountries: {
    'Appleby-in-Westmorland': 'United Kingdom', 'Appleby in Westmorland': 'United Kingdom', Appleby: 'United Kingdom',
    Cumbria: 'United Kingdom', Epsom: 'United Kingdom', Surrey: 'United Kingdom', 'Stow-on-the-Wold': 'United Kingdom',
    Gloucestershire: 'United Kingdom', London: 'United Kingdom', Dublin: 'Ireland', Galway: 'Ireland',
    Bucharest: 'Romania', București: 'Romania', Bucuresti: 'Romania', 'Cluj-Napoca': 'Romania', Cluj: 'Romania',
    Transylvania: 'Romania', Budapest: 'Hungary', Paris: 'France', 'Saintes-Maries-de-la-Mer': 'France',
    Granada: 'Spain', Seville: 'Spain',
  },
});
