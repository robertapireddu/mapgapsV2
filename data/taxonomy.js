/*
 * Uncertainty-flagging taxonomy, generated from uncertainty_flagging_taxonomy_v8.xlsx
 * by scripts/import-taxonomy.py. Do not edit by hand: update the spreadsheet
 * and re-run the script.
 */
(function (root, taxonomy) {
  if (typeof module === 'object' && module.exports) module.exports = taxonomy;
  else root.MAPGAPS_TAXONOMY = taxonomy;
})(typeof self !== 'undefined' ? self : this, {
  "source": "uncertainty_flagging_taxonomy_v8.xlsx",
  "rules": [
    {
      "id": "MISS-TEMP",
      "code": "MISS - TEMP",
      "type": "missing",
      "dimension": "temporal",
      "subCategory": "",
      "category": "Missing",
      "issue": "empty field",
      "fields": [
        "dcDate",
        "dcDescription",
        "dctermsCreated"
      ],
      "scope": "Record"
    },
    {
      "id": "INT-TEMP-INCOMP",
      "code": "INT - TEMP - INCOMP",
      "type": "incomplete",
      "dimension": "temporal",
      "subCategory": "Epistemic",
      "category": "Intrinsic",
      "issue": "example: ca. 1950, '1950, 20th century, 30s, 30's, 1930s, 1930's, twentieth century, thirties, between the wars",
      "fields": [
        "dcDate",
        "dcDescription",
        "dctermsCreated",
        "dcSubject"
      ],
      "scope": "Record"
    },
    {
      "id": "INT-TEMP-INCONS",
      "code": "INT - TEMP - INCONS",
      "type": "inconsistent",
      "dimension": "temporal",
      "subCategory": "Epistemic",
      "category": "Intrinsic",
      "issue": "same object ID but different dates over several fields",
      "fields": [
        "dcDate",
        "dctermsCreated",
        "dcDescription",
        "dcSubject"
      ],
      "scope": "Collection"
    },
    {
      "id": "MISS-SP",
      "code": "MISS - SP",
      "type": "missing",
      "dimension": "spatial",
      "subCategory": "",
      "category": "Missing",
      "issue": "empty field",
      "fields": [
        "dcCoverage",
        "dctermsProvenance",
        "dcDescription",
        "edmCountry"
      ],
      "scope": "Record"
    },
    {
      "id": "INT-SP-INCOMP",
      "code": "INT - SP - INCOMP",
      "type": "incomplete",
      "dimension": "spatial",
      "subCategory": "Epistemic",
      "category": "Intrinsic",
      "issue": "only geographical indication related to country: \"France\", \"UK\", \"Belgium\", \"England\", \"Germany\" and similar",
      "fields": [
        "dcCoverage",
        "dctermsProvenance",
        "dcDescription",
        "edmCountry",
        "dcSubject"
      ],
      "scope": "Record"
    },
    {
      "id": "INT-SP-INCONS",
      "code": "INT - SP - INCONS",
      "type": "inconsistent",
      "dimension": "spatial",
      "subCategory": "Epistemic",
      "category": "Intrinsic",
      "issue": "same object ID but different/contraddicting spatial information over several fields",
      "fields": [
        "dcCoverage",
        "dctermsProvenance",
        "dcDescription",
        "edmCountry",
        "dcSubject"
      ],
      "scope": "Collection"
    },
    {
      "id": "INT-SP-CONT",
      "code": "INT - SP - CONT",
      "type": "contested",
      "dimension": "spatial",
      "subCategory": "Epistemic",
      "category": "Intrinsic",
      "issue": "Two or more metadata records referring to the same object (matched by shared identifier, a sameAs/exact-match link, or equivalent title + creator + institution) assert different places of origin, provenance, custory e.g. one record names one country or region and another names a different one, and the values cannot be treated as one is more correct then the other",
      "fields": [
        "dcCoverage",
        "dctermsProvenance",
        "dcDescription",
        "edmCountry",
        "dcSubject"
      ],
      "scope": "Collection"
    },
    {
      "id": "MISS-LING",
      "code": "MISS - LING",
      "type": "missing",
      "dimension": "linguistic",
      "subCategory": "",
      "category": "Missing",
      "issue": "empty field",
      "fields": [
        "dcDescription",
        "dcSubject",
        "dcType"
      ],
      "scope": "Record"
    },
    {
      "id": "INT-LING-INCOMP",
      "code": "INT - LING - INCOMP",
      "type": "incomplete",
      "dimension": "linguistic",
      "subCategory": "Epistemic",
      "category": "Intrinsic",
      "issue": "A subject, creator, or description field refers to a person, community, practice, or object using a generic or aggregated term rather than the specific one that would properly identify it (e.g. a broad regional/ethnic category standing in for a named community; a generic activity label standing in for a specific named practice). Flag when the value is broad enough that the specific identity of what's represented cannot be recovered from the record alone. if a more specific, self-designated term for the same community or practice is known or discoverable (via cross-referencing or consultation), and the record still carries only the generic/aggregated label, treat this as Contested rather than Incomplete",
      "fields": [
        "dcDescription",
        "dcTitle",
        "dcSubject",
        "dcType"
      ],
      "scope": "Record"
    },
    {
      "id": "INT-LING-INCONS",
      "code": "INT - LING - INCONS",
      "type": "inconsistent",
      "dimension": "linguistic",
      "subCategory": "Epistemic",
      "category": "Intrinsic",
      "issue": "a similar name is used throughought the whole collection to indicate the same object/community/practice/ but in an inconsistent way with linguistic differences all over the whole collection",
      "fields": [
        "dcDescription",
        "dcTitle",
        "dcSubject",
        "dcType"
      ],
      "scope": "Collection"
    },
    {
      "id": "EXT-UI-LING-CONT",
      "code": "EXT - UI - LING - CONT",
      "type": "contested",
      "dimension": "linguistic",
      "subCategory": "User input",
      "category": "Extrinsic",
      "issue": "Bias/subjective or outdated interpretation introducted by the original recorder",
      "fields": [
        "dcDescription",
        "dcTitle",
        "dcSubject",
        "dcType"
      ],
      "scope": "Record"
    },
    {
      "id": "EXT-UI-SPA-INCOM",
      "code": "EXT - UI - SPA - INCOM",
      "type": "incomplete",
      "dimension": "spatial",
      "subCategory": "User input",
      "category": "Extrinsic",
      "issue": "a cataloguer assigns an incorrect, approximate, or biased place name (e.g. guessing a location from visual clues in an image, or applying a regional label too broadly)",
      "fields": [
        "dcCoverage",
        "dctermsProvenance",
        "dcDescription",
        "edmCountry",
        "dcSubject"
      ],
      "scope": "Record"
    },
    {
      "id": "EXT-UI-TEMP-INCOM",
      "code": "EXT - UI - TEMP - INCOM",
      "type": "incomplete",
      "dimension": "temporal",
      "subCategory": "User input",
      "category": "Extrinsic",
      "issue": "a cataloguer introduces a wrong or imprecise date through guessing, abbreviation, typo, or assumption",
      "fields": [
        "dcDate",
        "dcDescription",
        "dctermsCreated",
        "dcSubject"
      ],
      "scope": "Record"
    },
    {
      "id": "EXT-UI-LING-INCOM",
      "code": "EXT - UI - LING - INCOM",
      "type": "incomplete",
      "dimension": "linguistic",
      "subCategory": "User input",
      "category": "Extrinsic",
      "issue": "A linguistic field (name, title, subject term) was manually entered by a cataloguer but ends up truncated, abbreviated, or underspecified because of how it was typed not because the fuller information was unknown, and not because of a conversion process)",
      "fields": [
        "dcDescription",
        "dcTitle",
        "dcSubject",
        "dcType"
      ],
      "scope": "Record"
    },
    {
      "id": "EXT-UI-SPA-INCONS",
      "code": "EXT - UI - SPA - INCONS",
      "type": "inconsistent",
      "dimension": "spatial",
      "subCategory": "User input",
      "category": "Extrinsic",
      "issue": "Within the same record, the same place is entered as multiple separate variant forms OR several places are indicated",
      "fields": [
        "dcCoverage",
        "dctermsProvenance",
        "dcDescription",
        "edmCountry",
        "dcSubject"
      ],
      "scope": "Record"
    },
    {
      "id": "EXT-UI-TEMP-INCONS",
      "code": "EXT - UI - TEMP - INCONS",
      "type": "inconsistent",
      "dimension": "temporal",
      "subCategory": "User input",
      "category": "Extrinsic",
      "issue": "Within the same record, the same time period is entered as multiple separate keyword/tag variants rather than one value OR different times spans are indicated creating inconstence and vagueness",
      "fields": [
        "dcDate",
        "dcDescription",
        "dctermsCreated",
        "dcSubject"
      ],
      "scope": "Record"
    },
    {
      "id": "EXT-UI-LING-INCONS",
      "code": "EXT - UI - LING - INCONS",
      "type": "inconsistent",
      "dimension": "linguistic",
      "subCategory": "User input",
      "category": "Extrinsic",
      "issue": "Within the same record, the same entity or community is entered as multiple separate name variants rather than one value. Example (same record): \"Roma,\" \"Gypsy,\" \"Gypsies\", \"Romani,\" \"Romany,\" \"Gipsy,\" and \"GRT\" all co-occur as tags on one record.",
      "fields": [
        "dcDescription",
        "dcTitle",
        "dcSubject",
        "dcType"
      ],
      "scope": "Record"
    },
    {
      "id": "EXT-DATAC-TEMP-INCOM",
      "code": "EXT - DATAC - TEMP - INCOM",
      "type": "incomplete",
      "dimension": "temporal",
      "subCategory": "Data conversion",
      "category": "Extrinsic",
      "issue": "Value survives conversion from source schema to target schema but loses precision, structure, or qualifiers along the way. Example: source states \"1875–1885, attribution uncertain\" with a proper range and qualifier field, but the target schema flattens this to a \"1880,\" dropping the range and uncertainty marker.",
      "fields": [
        "dcDate",
        "dcDescription",
        "dctermsCreated"
      ],
      "scope": "Record"
    },
    {
      "id": "EXT-DATAC-TEMP-INCONS",
      "code": "EXT - DATAC - TEMP - INCONS",
      "type": "inconsistent",
      "dimension": "temporal",
      "subCategory": "Data conversion",
      "category": "Extrinsic",
      "issue": "Source value converted differently across records in the same collection, not because the facts differ but because the conversion process was applied unevenly. Example: \"circa 1880\" becomes \"1880\" in one value, \"ca. 1880\" in another.",
      "fields": [
        "dcDate",
        "dcDescription",
        "dctermsCreated"
      ],
      "scope": "Collection"
    },
    {
      "id": "EXT-DATAC-SPA-INCOM",
      "code": "EXT - DATAC - SPA - INCOM",
      "type": "incomplete",
      "dimension": "spatial",
      "subCategory": "Data conversion",
      "category": "Extrinsic",
      "issue": "Place hierarchy or precision lost during conversion. Example: source has city + region + country; target schema keeps only country, or coordinate precision is truncated.",
      "fields": [
        "dcCoverage",
        "dctermsProvenance",
        "dcDescription",
        "edmCountry",
        "dcSubject"
      ],
      "scope": "Record"
    },
    {
      "id": "EXT-DATAC-SPA-INCONS",
      "code": "EXT - DATAC - SPA - INCONS",
      "type": "inconsistent",
      "dimension": "spatial",
      "subCategory": "Data conversion",
      "category": "Extrinsic",
      "issue": "Place hierarchy is vague because of conversion: Example: source has city + region + country; target schema keeps country in one value, and only city in anoter one",
      "fields": [
        "dcCoverage",
        "dctermsProvenance",
        "dcDescription",
        "edmCountry"
      ],
      "scope": "Record"
    },
    {
      "id": "EXT-DATAC-LING-INCOM",
      "code": "EXT - DATAC - LING - INCOM",
      "type": "incomplete",
      "dimension": "linguistic",
      "subCategory": "Data conversion",
      "category": "Extrinsic",
      "issue": "Multi-value or multi-language content collapsed during conversion. Example: source has subject terms in three languages or three named subjects; target schema keeps only one.",
      "fields": [
        "dcDescription",
        "dcTitle",
        "dcSubject",
        "dcType"
      ],
      "scope": "Record"
    },
    {
      "id": "EXT-DATAC-LING-INCONS",
      "code": "EXT - DATAC - LING - INCONS",
      "type": "inconsistent",
      "dimension": "linguistic",
      "subCategory": "Data conversion",
      "category": "Extrinsic",
      "issue": "Same source term/language pattern converts differently across records. Example: diacritics preserved in one batch, stripped in another; same term transliterated two different ways depending on the conversion run.",
      "fields": [
        "dcDescription",
        "dcTitle",
        "dcSubject",
        "dcType"
      ],
      "scope": "Collection"
    },
    {
      "id": "EXT-UI-ATTR-INC",
      "code": "EXT - UI - ATTR - INC",
      "type": "incomplete",
      "dimension": "attributional",
      "subCategory": "User input",
      "category": "Extrinsic",
      "issue": "if the field value is exactly www.wikidata.org or https://www.wikidata.org without any /wiki/Q path following it, the URI is incomplete.",
      "fields": [
        "dcCreator",
        "dcContributor"
      ],
      "scope": "Record"
    },
    {
      "id": "EXT-DATAC-LINK-INCOMP",
      "code": "EXT-DATAC-LINK-INCOMP",
      "type": "incomplete",
      "dimension": "attributional",
      "subCategory": "Data conversion",
      "category": "Extrinsic",
      "issue": "a URL was inserted during data conversion or schema mapping, replacing or displacing descriptive content that existed in the source record.",
      "fields": [
        "dcCreator",
        "dcContributor",
        "dctermsProvenance"
      ],
      "scope": "Collection"
    },
    {
      "id": "MISS-DATAC-ATTR",
      "code": "MISS-DATAC-ATTR",
      "type": "missing",
      "dimension": "attributional",
      "subCategory": "Data conversion",
      "category": "Missing",
      "issue": "Field is present at the provider proxy for a meaningful share of records but is never carried through to the europeana proxy for any record, a systemic drop during aggregation rather than an isolated omission.",
      "fields": [
        "dcCreator",
        "dcContributor"
      ],
      "scope": "Collection"
    },
    {
      "id": "MISS-DATAC-LING",
      "code": "MISS-DATAC-LING",
      "type": "missing",
      "dimension": "linguistic",
      "subCategory": "Data conversion",
      "category": "Missing",
      "issue": "Field is present at the provider proxy for a meaningful share of records but is never carried through to the europeana proxy for any record, a systemic drop during aggregation rather than an isolated omission.",
      "fields": [
        "dcTitle"
      ],
      "scope": "Collection"
    },
    {
      "id": "MISS-ATTR",
      "code": "MISS - ATTR",
      "type": "missing",
      "dimension": "attributional",
      "subCategory": "",
      "category": "Missing",
      "issue": "empty field",
      "fields": [
        "dcCreator",
        "dcContributor"
      ],
      "scope": "Record"
    }
  ],
  "temporalKeywords": [
    {
      "keyword": "circa + \"year\" OR \"century\"",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "ca. + \"year\" OR \"century\"",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "c. + \"year\" OR \"century\"",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "~",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "approx. + \"year\" OR \"century\"",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "approximately + \"year\" OR \"century\"",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "around + \"year\" OR \"century\"",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "about + \"year\" OR \"century\"",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "possibly + \"year\" OR \"century\"",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "probably + \"year\" OR \"century\"",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "perhaps + \"year\" OR \"century\"",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "attributed to + \"year\" OR \"century\"",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "said to be + \"year\" OR \"century\"",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "believed to be + \"year\" OR \"century\"",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "thought to be + \"year\" OR \"century\"",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "undated",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "date unknown",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "no date",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "between … and",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "century",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "early [century]",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "mid-[century]",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "late [century]",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "1700s",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "1800s",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "1900s",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "1920s",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "1930s",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "1940s",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "1950s",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "1960s",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "20s / 30s / 40s",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "twenties / thirties / forties",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "pre-war",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "post-war",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "interwar",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "between the wars",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "Victorian",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "Edwardian",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "Belle Epoque",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "fin de siecle",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "modern",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "contemporary",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "recent",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "antique",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "ancient",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "medieval",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "early modern",
      "example": "",
      "rule": "INT-TEMP-INCOMP"
    },
    {
      "keyword": "Single year where range expected",
      "example": "Source: 1875-1885 -> Target: 1880",
      "rule": "EXT-DATAC-TEMP-INCOM"
    },
    {
      "keyword": "Qualifier stripped",
      "example": "Source: '1880, uncertain' -> Target: '1880'",
      "rule": "EXT-DATAC-TEMP-INCOM"
    },
    {
      "keyword": "circa removed",
      "example": "Source: 'circa 1880' -> Target: '1880'",
      "rule": "EXT-DATAC-TEMP-INCOM"
    },
    {
      "keyword": "Inconsistency across dates",
      "example": "'circa 1880' -> '1880' in one record, 'ca. 1880' in another",
      "rule": "EXT-DATAC-TEMP-INCONS"
    }
  ],
  "contestedWords": [],
  "falsePositives": [
    "stone-age"
  ]
});
