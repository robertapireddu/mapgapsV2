# MapGaps Version 3

MapGaps shows where heritage-collection metadata from [Europeana](https://www.europeana.eu) is
uncertain or absent.

## The dashboard (`index.html`)

Version 3 is a single self-contained page. It has no build step and no dependencies: open
`index.html` in a browser, or run `npm start` and go to <http://localhost:8000>.

It works on an embedded sample of 10 records (*Romani & Traveller Communities in Britain*) and
seven attributes:

| Dimension | Attributes |
| --- | --- |
| Temporal | `dctermsCreated` (Date Created) |
| Spatial | `edmCountry` (Country) |
| Textual | `dcTitle`, `dcDescription`, `dcSubject` |
| Attributional | `dcCreator`, `dcType` |

- **Filters**: multi-select Dimension, Attribute and Issue type (incomplete, inconsistent,
  contested, absent), plus a search box.
- **Bar chart**: one bar per attribute.
  - With no issue filter, it shows the % of records with any flag, split into uncertain and absent.
  - With an issue filter, the bar is stacked by issue type.
  - Clicking a bar highlights it.
- **Record list**: the records that match the filters, most flagged first, with issue pills.
- **Field cards**: the selected record's fields, grouped by dimension. A field that belongs to a
  term cluster opens a pop-up listing the term variants and the records that share them.

The sample records, flags and term clusters are written by hand in the `RECORDS` and
`TERM_CLUSTERS` constants at the top of the page.

## Taxonomy engine (not yet connected to the page)

`js/analysis.js`, `js/io.js` and `data/` hold the engine built for earlier versions. It can:

- read Europeana data (Search API items, Record API objects with the provider and Europeana
  proxies, or CSV/JSON files)
- flag it with the rules of the uncertainty-flagging taxonomy
- find term clusters automatically (Gypsy / Gipsy / Romani / Roma, …)

`npm test` runs its tests. Hooking it up would let the Version 3 page run on real collections
instead of the embedded sample.

## How the taxonomy is applied

`data/taxonomy.js` is generated from the spreadsheet (see below). The engine is `js/analysis.js`.
Each rule checks **only the fields listed for it in the spreadsheet's *Fields* column**, so
editing that column changes what is checked.

| Rule | What MapGaps detects |
| --- | --- |
| `MISS - TEMP` / `SP` / `LING` / `ATTR` | Empty field, or a placeholder such as `none`, `unknown` or `n/a` |
| `INT - TEMP - INCOMP` | Every keyword in the *Temporal Keywords* sheet (circa + year/century, `~`, `between … and`, centuries, decades, `interwar`, `Victorian`, `modern`, …), plus the rule's own examples (`30's`, `1930's`, `twentieth century`) |
| `INT - TEMP - INCONS` | Dates in different fields that do not overlap (dcDate vs dctermsCreated / dcSubject / years in dcDescription), or records of the same object with different dates |
| `INT - SP - INCOMP` | The only place information is a country (`UK`, `France`, …) |
| `INT - SP - INCONS` | The record's fields point to different countries |
| `INT - SP - CONT` | Records of the same object assert different places. Records match on a shared identifier, a sameAs link, or equal title + creator + institution |
| `INT - LING - INCOMP` | A generic or aggregated label (`folk music`, `nomads`, …). When a more specific self-designation is known (`Travellers`, `GRT` → Roma, Irish Travellers, …) and the record has none, the flag is Contested, as the rule says |
| `INT - LING - INCONS` | Different names for the same community or thing across the collection (Gypsy / Gipsy / Romani / Roma), and spelling variants (`Horse fairs` / `horse-fairs`) |
| `EXT - UI - LING - CONT` | Outdated or biased terms (the *Contested words* sheet plus `contestedWords` in `data/vocabulary.js`). The sheet's false positives (`stone-age`) are ignored |
| `EXT - UI - SPA - INCOM` | Approximate or guessed places (`near`, `probably`, `?`) and over-broad regional labels (`the Balkans`, `Eastern Europe`) |
| `EXT - UI - TEMP - INCOM` | Guessed, abbreviated or mistyped dates (`193-`, `19??`, `1920?`, `[1934]`, `'52`, `19522`, future years) |
| `EXT - UI - LING - INCOM` | Truncated or abbreviated entries (`…`, unclosed brackets, 1–2 letters, `Photo.`) |
| `EXT - UI - SPA - INCONS` | One place entered in several forms in the same record (`UK` + `United Kingdom`), or several places at once |
| `EXT - UI - TEMP - INCONS` | Several time indications in one field (`1930s`, `Interwar`, `thirties`) |
| `EXT - UI - LING - INCONS` | Several names for the same community on one record (`Roma`, `Gypsy`, `Romani`) |
| `EXT - DATAC - TEMP - INCOM` | Range or qualifier lost: `circa 1880` or `1875–1885` in the provider proxy becomes `1880` in the Europeana proxy |
| `EXT - DATAC - TEMP - INCONS` | Approximation notation (`circa` / `ca.` / `c.`) or date format (ISO / numeric / written) varies across records |
| `EXT - DATAC - SPA - INCOM` | Place hierarchy lost: `Cluj-Napoca, Cluj, Romania` becomes `Romania` in the Europeana proxy |
| `EXT - DATAC - SPA - INCONS` | A country-only value next to a locality-only value, with no full hierarchy |
| `EXT - DATAC - LING - INCOM` | Several source values collapsed to fewer in the Europeana proxy |
| `EXT - DATAC - LING - INCONS` | The same term with diacritics in some records and without in others (`Sfântul` / `Sfantul`) |
| `EXT - UI - ATTR - INC` | A bare `www.wikidata.org` address with no `/wiki/Q…` item |
| `EXT - DATAC - LINK - INCOMP` | Only a URL where a name should be |
| `MISS - DATAC - ATTR` / `LING` | A field filled for at least 20% of records at the provider proxy but never carried to the Europeana proxy |

Five of the data-conversion rules compare the **provider proxy** with the **Europeana proxy**:
`EXT - DATAC - SPA - INCOM`, `EXT - DATAC - LING - INCOM`, both `MISS - DATAC` rules, and the proxy
check of `EXT - DATAC - TEMP - INCOM`. They need full records from the Europeana Record API. Without
them, `EXT - DATAC - TEMP - INCOM` falls back to comparing dcDate with the other date fields of the
same record.

### Updating the taxonomy

```
pip install openpyxl
python3 scripts/import-taxonomy.py path/to/uncertainty_flagging_taxonomy.xlsx
```

The script reads three sheets and regenerates `data/taxonomy.js`:

- **Rules**: code, issue type, dimension, sub-category, category, issue, fields and scope
- **Temporal Keywords**: each keyword is turned into a pattern, e.g. `circa + "year" OR "century"`, `early [century]`, `between … and`, `20s / 30s / 40s`
- **Contested words**: a note containing *false positive* marks a word to ignore

A new rule code in the spreadsheet also needs detection logic in `js/analysis.js`.

### Collection word lists

`data/vocabulary.js` holds the collection-specific knowledge the rules rely on:

- variant groups for inconsistent terms, each with a reference term
- generic terms, with their known self-designations
- contested words
- regional labels
- countries
- places whose country is known

## Data the engine reads

- **Europeana API**: `MapGapsIO.fetchEuropeana({ apiKey, query, max, full })` in `js/io.js`.
  - `full: true` also fetches each record from the Record API, so the provider and Europeana proxies can be compared.
  - Get an API key [free](https://pro.europeana.eu/page/get-api).
- **Files**:
  - a CSV with Europeana or Dublin Core headers (`dcTitle` or `dc:title`, `dcDate`, `dctermsCreated` or `year`, `dcCoverage` / `dcterms:spatial`, `dctermsProvenance`, `edmCountry`, `dcSubject`, `dcType`, `dcDescription`, `dcCreator`, `dcContributor`, `dcIdentifier`). Prefix a column with `europeana:` to give Europeana-proxy values.
  - a saved Search API response (`items`) or Record API response (`object`).
- **Synthetic test collection**: `data/sample-data.js`, 72 invented records shaped like Record API responses. Regenerate it with `npm run sample`.

## Development

```
npm test          # node --test, no dependencies
npm run sample    # regenerate data/sample-data.js
```

| File | Role |
| --- | --- |
| `js/analysis.js` | Taxonomy engine; runs in the browser and in Node |
| `js/io.js` | CSV/JSON parsing; Europeana Search and Record API client |
| `index.html` | The Version 3 dashboard (self-contained) |
| `data/taxonomy.js` | Generated from the taxonomy spreadsheet |
| `data/vocabulary.js` | Collection word lists |
| `data/sample-data.js` | Synthetic sample collection |
| `scripts/import-taxonomy.py` | Spreadsheet → `data/taxonomy.js` |
