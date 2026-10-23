# MapGaps Version 3

MapGaps shows where heritage-collection metadata from [Europeana](https://www.europeana.eu) is
uncertain or absent.

## The dashboard (`index.html`)

The page has no build step and no dependencies. Open `index.html` in a browser, or run
`npm start` and go to <http://localhost:8000>.

It opens on a sample of **100 real Europeana records** (TopFoto, dataset 2024904, from the Record
API). **Upload collection** (top right) loads your own file, which is processed in the browser:

- a JSON export of Europeana **Record API** responses (an array of `/record/v2/{id}.json`
  responses), or a saved **Search API** response
- a **CSV** with Dublin Core columns: `dcTitle`, `dcDescription`, `dcSubject`, `dcCreator`,
  `dctermsCreated` (or `year`), `edmCountry`, `dcType`; `dc:title` style headers work too

Every record is flagged by the taxonomy engine (`js/analysis.js`, rules from
`data/taxonomy.js`). `js/v3-adapter.js` turns the result into what the page shows.

| Dimension | Attributes |
| --- | --- |
| Temporal | `dctermsCreated` (Date Created; Europeana's normalised `year` is used when it is empty) |
| Spatial | `edmCountry` (Country) |
| Textual | `dcTitle`, `dcDescription`, `dcSubject` |
| Attributional | `dcCreator`, `dcType` |

- **Chart selection**: clicking an attribute in the chart (or one part of its bar) shows, below
  the chart, only that attribute for the records flagged in it; "open record" shows a whole record.
- **View all records**: the full record list (narrowed by the filters and the search box) opens in
  a panel on the right only from this button, so it is never confused with a chart selection.
- **Dimension filter**: all attributes stay in the chart. Each bar counts only the chosen
  dimension's flags, wherever that dimension applies, e.g. temporal keywords in Subject or
  Description. A dimension applies to an attribute when one of the taxonomy's rules for that
  dimension lists the attribute among its fields; the other attributes are marked "not
  applicable". An absent field counts under the dimensions of the missing-field rules that cover
  it, e.g. an empty description under Temporal, Spatial and Textual.
- **Colour code** (same in the chart, filter, tags, pills and highlighted words): **ambiguous**
  amber with a dotted underline, **inconsistent** blue with a dashed underline, **contested** red
  with a solid underline. A ring in a second colour marks a word that carries two types (e.g.
  "Gypsy": contested, ringed blue as inconsistent). The colours were checked for colour-vision
  deficiency; the underline styles give a second cue.
- **Absent**: the field is empty, or holds only a placeholder such as "none" or "unknown".
- **Uncertainty types**: incomplete, inconsistent and contested flags from the taxonomy rules. A
  field can carry more than one. Hover over a tag to see the rule codes and reasons.
- **Term clusters**: collection-wide variant groups (Gypsy / Gipsy / Romani / Roma, United
  Kingdom / Great Britain / UK, …). The pop-up lists the variants with their counts (★ marks the
  reference term) and the records that use them; click a record to open it.
- **Linked entities**: values given as Wikidata or Getty AAT links show the name stored in the
  record, and link to the entity.
- **Fields missing from the Europeana proxy** (`MISS - DATAC - ATTR`, `MISS - DATAC - LING`):
  the Europeana proxy holds only what Europeana adds (vocabulary links, normalised dates), not
  a copy of the record. These rules therefore count only values Europeana could enrich. Titles,
  descriptions, and creators the provider already gave as a link are not flagged; a title that
  is absent from the Europeana proxy still shows on the Europeana page.
- **Proxy notes**: findings that come from comparing the provider and Europeana proxies, such as a
  field that never reaches the Europeana proxy, appear as notes under the field.

The "Align inconsistent terms" and "Flag for community review" buttons in the pop-up do not do
anything yet.

### Updating the bundled sample

```
python3 -I scripts/slim-europeana.py export.json data/collection-2024904.js
```

The script removes the API key and request metadata that Record API exports contain, and keeps
only the parts of each record the dashboard reads (7.4 MB → 340 KB for the sample).

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

### Contested words: DE-BIAS vocabulary

Contested terms (`EXT - UI - LING - CONT`) come from the **DE-BIAS vocabulary** (English sheet).

- Only entries active in the DE-BIAS Knowledge Graph are used. Entries DE-BIAS excluded from
  detection, deprecated, or still marks as work in progress are left out.
- Contested terms come **only** from this vocabulary. Labels are matched exactly as written,
  ignoring only capital letters and accents: no plurals or other variants are added ("Minority"
  does not match "minorities").
- False positives: terms DE-BIAS marks as needing disambiguation are shown as **"contested ·
  check context"**. Phrases on the false-positive list are not flagged at all: the taxonomy's
  own entries (*Contested words* sheet, notes containing "false positive", e.g. "stone-age") and
  those reviewed in collection 2024904 (`falsePositives` in `data/vocabulary.js`: "coloured
  engraving", "race meeting", "costume (mode of fashion)").
- The flag's reason gives the DE-BIAS ID, its suggestion and its suggested alternatives.
- Only short fields are stored (ID, label, suggestion, alternatives, bias areas, link); DE-BIAS's
  full explanations are reached through the link.

To update the list:

```
python3 -I scripts/import-debias.py path/to/DE-BIAS_Vocabulary.xlsx
```

### Word lists

`data/vocabulary.js` holds only what the taxonomy itself states:

- **One term group.** Roma, Gypsy, Gypsies, Romani, Romany, Gipsy and GRT, taken from the example
  in rule `EXT - UI - LING - INCONS`. The taxonomy names no reference term, so when a collection
  uses several of these forms, every form is flagged.
- **Country names.** These come from rule `INT - SP - INCOMP`: "France, UK, Belgium, England,
  Germany and similar".

There are no generic terms and no regional labels; contested words come from the DE-BIAS
vocabulary (above). The rules that use those lists flag nothing
until the taxonomy provides them. Spelling and date-format variants are found automatically, and
no form is treated as the reference because it is the most common.

`tests/fixtures/example-vocabulary.js` contains example lists used only by the tests to exercise
the engine. The dashboard never loads them.

In the dashboard, the taxonomy's *incomplete* type is shown as **ambiguous**. Rule codes such as
`INT - TEMP - INCOMP` are unchanged.

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
| `index.html` | The Version 3 dashboard |
| `js/v3-adapter.js` | Engine output → the dashboard's records and term clusters |
| `data/collection-2024904.js` | Bundled sample collection (slimmed Record API export) |
| `scripts/slim-europeana.py` | Record API export → bundled sample, without the API key |
| `data/taxonomy.js` | Generated from the taxonomy spreadsheet |
| `data/vocabulary.js` | Word lists taken from the taxonomy |
| `data/debias-vocabulary.js` | Contested terms from the DE-BIAS vocabulary |
| `scripts/import-debias.py` | DE-BIAS spreadsheet → `data/debias-vocabulary.js` |
| `tests/fixtures/example-vocabulary.js` | Example word lists for the tests only |
| `data/sample-data.js` | Synthetic sample collection |
| `scripts/import-taxonomy.py` | Spreadsheet → `data/taxonomy.js` |
