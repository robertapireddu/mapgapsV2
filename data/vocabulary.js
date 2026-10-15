/*
 * Word lists the taxonomy rules use. Everything here comes from the
 * uncertainty-flagging taxonomy (data/taxonomy.js) itself; nothing is added
 * from outside it. Extend these lists only from the taxonomy.
 *
 * variantGroups   names for the same entity or community. Without a
 *                 `preferred` term no form is treated as the reference: when a
 *                 collection uses several forms, every form is flagged.
 * genericTerms    generic / aggregated labels (INT-LING-INCOMP): none given yet.
 * contestedWords  contested terms (EXT-UI-LING-CONT) beyond the taxonomy's
 *                 "Contested words" sheet: none.
 * regionalLabels  over-broad regional labels (EXT-UI-SPA-INCOM): none given yet.
 * countries       country names for "only geographical indication related to
 *                 country: France, UK, Belgium, England, Germany and similar"
 *                 (INT-SP-INCOMP); each entry is [canonical name, ...other forms].
 * placeCountries  places whose country can be inferred: none given.
 */
(function (root, vocabulary) {
  if (typeof module === 'object' && module.exports) module.exports = vocabulary;
  else root.MAPGAPS_VOCABULARY = vocabulary;
})(typeof self !== 'undefined' ? self : this, {
  variantGroups: [
    {
      id: 'roma-gypsy-grt',
      label: 'Roma / Gypsy / GRT names',
      source: 'Taxonomy rule EXT - UI - LING - INCONS, example: "Roma," "Gypsy," "Gypsies", "Romani," "Romany," "Gipsy," and "GRT"',
      variants: ['Roma', 'Gypsy', 'Gypsies', 'Romani', 'Romany', 'Gipsy', 'GRT'],
    },
  ],

  genericTerms: [],

  contestedWords: [],

  regionalLabels: [],

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

  placeCountries: {},
});
