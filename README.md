# MapGaps V2

MapGaps is a dashboard for spotting gaps and uncertainty in heritage-collection metadata from
[Europeana](https://www.europeana.eu). The flags follow the **uncertainty-flagging taxonomy**
(`uncertainty_flagging_taxonomy_v8.xlsx`). Each flag names the rule that raised it, for example
`INT - TEMP - INCOMP`. That code gives:

- the **issue type**: missing, incomplete, inconsistent or contested
- the **dimension**: temporal, spatial, linguistic or attributional
- the **origin**: intrinsic/epistemic, extrinsic/user input, or extrinsic/data conversion
- the **scope**: record or collection

The completeness overview keeps the yellow encoding (complete / incomplete / missing). A pop-up,
**Records with similar terms**, gathers the words a collection uses inconsistently, such as
*Gypsy*, *Gipsy*, *Romani* and *Roma*.

## Running it

It is a static page with no build step and no dependencies. Open `index.html`, or run
`npm start` and go to <http://localhost:8000>.

## Layout (from the sketch)

| Area | What it shows |
| --- | --- |
| **Filter 1 · Gap** | *Uncertain* or *Missing* |
| **Filter 2 · Dimension** | Temporal, Spatial, Linguistic, Attributional (or all) |
| **Filter 3 · Uncertainty** | Inconsistent, Incomplete or Contested. Only active in *Uncertain* mode |
| **Origin** | Intrinsic · epistemic, Extrinsic · user input, Extrinsic · data conversion (or Empty field in *Missing* mode) |
| **Completeness overview** | For each field, the share of records where it is complete, incomplete (yellow) or missing (dark yellow) |
| **Record grid** | One tile per record, sorted from the most to the least flagged fields for the current filters |
| **Taxonomy rules in view** | The rules that apply to the current filters, with the number of records each one flags |
| **Record detail** | The Europeana fields of the selected record. Cards in the selected dimension have a green frame and come first. Flagged words are highlighted. Each reason shows its rule code, scope and origin. When the record has both proxies, the Europeana-proxy value is shown under the provider value |
| **Records with similar terms** | Opens when you click a ▲ term. It lists every record that uses any form of the term, and records that describe the same object |

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

## Loading data

Open the data menu (top right). You can load data in three ways:

- **Europeana API**: enter your API key ([free](https://pro.europeana.eu/page/get-api)) and a query.
  - With *Full records* ticked (the default), each result is fetched from the Record API, so both proxies can be compared.
  - Untick it for a faster, search-only load, which skips the proxy comparisons.
- **File**:
  - a CSV with Europeana or Dublin Core headers (`dcTitle` or `dc:title`, `dcDate`, `dctermsCreated`, `dcCoverage` / `dcterms:spatial`, `dctermsProvenance`, `edmCountry`, `dcSubject`, `dcType`, `dcDescription`, `dcCreator`, `dcContributor`, `dcIdentifier`). Prefix a column with `europeana:` to give Europeana-proxy values.
  - a saved Search API response (`items`) or Record API response (`object`).
- **Sample collection**: 72 **synthetic** records shaped like Record API responses. They describe no real objects. Regenerate them with `npm run sample`.

## Development

```
npm test          # node --test, no dependencies
npm run sample    # regenerate data/sample-data.js
```

| File | Role |
| --- | --- |
| `js/analysis.js` | Taxonomy engine; runs in the browser and in Node |
| `js/io.js` | CSV/JSON parsing; Europeana Search and Record API client |
| `js/app.js` | User interface |
| `css/style.css` | Styles, with light and dark themes |
| `data/taxonomy.js` | Generated from the taxonomy spreadsheet |
| `data/vocabulary.js` | Collection word lists |
| `data/sample-data.js` | Synthetic sample collection |
| `scripts/import-taxonomy.py` | Spreadsheet → `data/taxonomy.js` |
