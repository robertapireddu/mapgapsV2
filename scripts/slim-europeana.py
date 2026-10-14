#!/usr/bin/env python3
"""
Turn a saved Europeana Record API export (a JSON array of /record/v2 responses)
into a compact data file the dashboard loads by default.

    python3 -I scripts/slim-europeana.py export.json data/collection.js

Removes the API key and request metadata, keeps only the parts of each record
the dashboard reads (proxies, contextual-entity labels, aggregations), and
keeps one label per entity (English, else the default, else the first).
"""
import json
import sys
from pathlib import Path

PROXY_DROP = {"proxyIn", "proxyFor", "lineage", "about"}
ENTITY_KINDS = ("agents", "places", "timespans", "concepts", "organizations")


def one_label(pref):
    if not isinstance(pref, dict):
        return pref
    for lang in ("en", "def"):
        if pref.get(lang):
            return {lang: pref[lang][:1]}
    for lang, values in pref.items():
        return {lang: values[:1]}
    return {}


def slim(item):
    obj = item.get("object", item)
    out = {"about": obj.get("about")}
    for key in ("edmDatasetName", "europeanaCollectionName", "year"):
        if key in obj:
            out[key] = obj[key]
    out["proxies"] = [{k: v for k, v in p.items() if k not in PROXY_DROP} for p in obj.get("proxies", [])]
    for kind in ENTITY_KINDS:
        if obj.get(kind):
            out[kind] = [{"about": e["about"], "prefLabel": one_label(e.get("prefLabel", {}))} for e in obj[kind]]
    out["aggregations"] = [
        {k: a[k] for k in ("edmDataProvider", "edmIsShownAt") if k in a} for a in obj.get("aggregations", [])
    ]
    ea = obj.get("europeanaAggregation", {})
    out["europeanaAggregation"] = {k: ea[k] for k in ("edmCountry", "edmLandingPage") if k in ea}
    same = [c["owlSameAs"] for c in obj.get("providedCHOs", []) if c.get("owlSameAs")]
    if same:
        out["providedCHOs"] = [{"owlSameAs": s} for s in same]
    return out


def main(src, dest):
    data = json.loads(Path(src).read_text(encoding="utf-8"))
    items = data if isinstance(data, list) else data.get("items") or [data]
    records = [slim(i) for i in items]
    body = json.dumps(records, ensure_ascii=False, separators=(",", ":"))
    if "apikey" in body or "wskey" in body:
        sys.exit("refusing to write: an API key is still present")
    Path(dest).write_text(
        "/* Europeana collection sample for MapGaps (Record API, slimmed by scripts/slim-europeana.py). */\n"
        "(function (root, records) {\n"
        "  if (typeof module === 'object' && module.exports) module.exports = records;\n"
        "  else root.MAPGAPS_COLLECTION = records;\n"
        "})(typeof self !== 'undefined' ? self : this, " + body + ");\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(records)} records to {dest} ({Path(dest).stat().st_size // 1024} KB)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
