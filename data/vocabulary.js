/*
 * MapGaps controlled-vocabulary variant groups.
 *
 * Each group lists the different words a collection may use for the SAME
 * concept. When a collection uses more than one variant of a group, every
 * occurrence of a non-preferred variant is flagged as "inconsistent" and the
 * group becomes browsable in the "Records with similar terms" window.
 *
 *   id         unique identifier
 *   label      name shown in the pop-up window
 *   preferred  the variant treated as the reference term (optional; when
 *              omitted the most frequent variant in the collection is used)
 *   fields     record fields to scan (defaults to title, subject, description)
 *   note       optional context shown in the pop-up window
 *   variants   the surface forms to look for (matched case-insensitively,
 *              as whole words; longer variants win over shorter overlapping ones)
 *
 * Edit or extend this file to fit your own collection.
 */
(function (root, vocabulary) {
  if (typeof module === 'object' && module.exports) module.exports = vocabulary;
  else root.MAPGAPS_VOCABULARY = vocabulary;
})(typeof self !== 'undefined' ? self : this, [
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
    label: 'Names for Traveller communities',
    preferred: 'Irish Travellers',
    note: '"Tinker" is considered derogatory by many Irish Travellers (Mincéirí / Pavee).',
    variants: [
      'Irish Travellers', 'Irish Traveller', 'Travellers', 'Traveller', 'Travelers', 'Traveler',
      'Mincéirí', 'Minceiri', 'Pavee', 'Tinkers', 'Tinker',
    ],
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
    fields: ['spatial'],
    variants: ['United Kingdom', 'UK', 'U.K.', 'Great Britain', 'Britain', 'GB'],
  },
  {
    id: 'romania',
    label: 'Romania',
    preferred: 'Romania',
    fields: ['spatial'],
    variants: ['Romania', 'Rumania', 'Roumania', 'România'],
  },
  {
    id: 'bucharest',
    label: 'Bucharest',
    preferred: 'Bucharest',
    fields: ['spatial'],
    variants: ['Bucharest', 'București', 'Bucuresti', 'Bucureşti'],
  },
  {
    id: 'appleby',
    label: 'Appleby-in-Westmorland',
    preferred: 'Appleby-in-Westmorland',
    fields: ['spatial'],
    variants: ['Appleby-in-Westmorland', 'Appleby in Westmorland', 'Appleby'],
  },
]);
