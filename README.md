# MapGaps V2

A dashboard for spotting gaps and uncertainty in heritage-collection metadata from
[Europeana](https://www.europeana.eu). V2 keeps the yellow encoding of the
completeness overview (complete, incomplete, missing). It adds three filters, a grid of
records ordered by how many flags they carry, and a pop-up that lists the records using
**inconsistent terms**: different words for the same thing across a collection, such as
*Gypsy*, *Gipsy*, *Romani* and *Roma*.

## Running it

It is a static page with no build step and no dependencies.

- Open `index.html` in a browser, or
- serve the folder (`npm start`, which runs `python3 -m http.server 8000`) and go to <http://localhost:8000>.
  GitHub Pages works too.

## Layout

| Area | What it shows |
| --- | --- |
| **Filter 1 · Gap** | *Uncertain* (a value exists but is doubtful) or *Missing* (no value) |
| **Filter 2 · Dimension** | Temporal, Spatial, Linguistic, Attributional, or all of them |
| **Filter 3 · Uncertainty** | Inconsistent, Incomplete or Contested. Only active in *Uncertain* mode |
| **Completeness overview** | For each field, the share of records where it is complete, incomplete (yellow) or missing (dark yellow) |
| **Record grid** | One tile per record, sorted from the most to the least flagged fields for the current filters. Colour intensity shows the number of flags |
| **Record detail** | The Dublin Core fields of the selected record. Cards in the selected dimension have a green frame and come first. Flagged values are highlighted, with the reason written underneath |
| **Records with similar terms** | Opens when you click an inconsistent term (marked ▲). It lists every record that uses any form of the term. You can filter by form; the reference form is labelled |

## How fields are flagged

| Dimension | Fields |
| --- | --- |
| Temporal | `dc:date` (also `dcterms:created`, Europeana `year`), `dcterms:temporal` / `edm:TimeSpan` |
| Spatial | `dcterms:spatial` / `edm:Place` / `dc:coverage` |
| Linguistic | `dc:title`, `dc:subject`, `dc:description`, `dc:language` |
| Attributional | `dc:creator`, `dc:publisher` |

- **Missing**: the value is empty or a placeholder (`none`, `unknown`, `n.d.`, `[unknown]`, `Unknown photographer`, …).
- **Incomplete**: the value is imprecise. Examples: a century or decade (`20th cent.`, `1950s`, `193-`), a circa date, a date range longer than 10 years, a country without a locality (`UK`), a forename given only as initials or a single name (`E. Hartley`, `Hartley`), an `Untitled` title, or a description of fewer than 5 words.
- **Contested**: the value expresses doubt or alternatives, such as `?`, `or`, `possibly`, `attributed to`, `circle of` or `(disputed)`.
- **Inconsistent**: the collection describes the same thing in more than one way. Only the non-reference forms are flagged, but every form opens the pop-up. Three kinds are detected:
  - **Vocabulary variants** from `data/vocabulary.js`, e.g. Roma / Romani / Gypsy / Gipsy / Tzigane, Irish Travellers / Pavee / Tinkers, UK / Great Britain / United Kingdom.
  - **Spelling and name-form variants**, found automatically: `Horse fairs` / `horse-fairs` / `Horse fair`, `Hartley, Edith` / `Edith Hartley` / `E. Hartley`, `Folk Life …` / `The Folk-Life …`.
  - **Format conventions**: ISO dates next to `DD/MM/YYYY` or written dates, and `en` next to `eng` or `English`.

### Adapting the vocabulary

Edit `data/vocabulary.js` to add the variant groups your collection needs. Each group
has a `preferred` (reference) term, an optional `note` shown in the pop-up, and optional
`fields` to limit where it is matched.

## Loading data

Open the data menu (top right). You can load data in three ways:

- **Europeana Search API**: enter your API key ([get one free](https://pro.europeana.eu/page/get-api)) and a query.
  Records are fetched with `profile=rich` and cursor paging, up to the maximum you set.
- **File**:
  - a CSV with Dublin Core headers (`dc:identifier`, `dc:title`, `dc:date`, `dcterms:spatial`, `dc:subject`, …; `;` or `|` separate multiple subjects), or
  - JSON: either an array of records or a saved Europeana API response with an `items` array.
- **Sample collection**: the default. It holds 72 **synthetic** records shaped like Europeana API items and describes no real objects. Regenerate it with `npm run sample`.

## Development

```
npm test          # node --test, no dependencies
npm run sample    # regenerate data/sample-data.js
```

| File | Role |
| --- | --- |
| `js/analysis.js` | Analysis engine; runs in the browser and in Node |
| `js/io.js` | CSV/JSON parsing and the Europeana API client |
| `js/app.js` | User interface |
| `css/style.css` | Styles, with light and dark themes |
| `data/vocabulary.js` | Variant groups for inconsistent terms |
| `data/sample-data.js` | Synthetic sample collection |
