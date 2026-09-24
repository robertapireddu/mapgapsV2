/*
 * MapGaps data loading: CSV / JSON files and the Europeana Search API.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MapGapsIO = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** RFC 4180 CSV (quoted fields, "" escapes, CRLF) -> array of row objects. */
  function parseCSV(input) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    const src = input.replace(/^﻿/, '');
    const delimiter = (src.split('\n')[0].match(/;/g) || []).length > (src.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (let i = 0; i < src.length; i += 1) {
      const c = src[i];
      if (quoted) {
        if (c === '"' && src[i + 1] === '"') { field += '"'; i += 1; }
        else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"') quoted = true;
      else if (c === delimiter) { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && src[i + 1] === '\n') i += 1;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    const [header, ...body] = rows.filter((r) => r.some((cell) => cell.trim()));
    if (!header) return [];
    return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
  }

  /** Parse the text of a .csv or .json file: an array, a Europeana search response or a Record API response. */
  function parseFile(name, content) {
    if (/\.json$/i.test(name) || /^\s*[[{]/.test(content)) {
      const data = JSON.parse(content);
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.items)) return data.items;
      if (Array.isArray(data.records)) return data.records;
      if (data.object && data.object.proxies) return [data.object];
      if (data.proxies) return [data];
      throw new Error('JSON must be an array of records, a Europeana search response ("items") or a Record API response ("object").');
    }
    return parseCSV(content);
  }

  /**
   * Fetch up to `max` items from the Europeana Search API (cursor paging).
   * Get a free API key at https://pro.europeana.eu/page/get-api
   */
  async function fetchEuropeana({ apiKey, query, max = 200, full = false, onProgress = () => {} }) {
    const items = await searchEuropeana({ apiKey, query, max, onProgress });
    return full ? fetchRecords({ apiKey, ids: items.map((i) => i.id), onProgress }) : items;
  }

  /**
   * Fetch full records (Record API) so the provider proxy can be compared with
   * the Europeana proxy (needed by the data-conversion rules).
   */
  async function fetchRecords({ apiKey, ids, concurrency = 6, onProgress = () => {} }) {
    const out = new Array(ids.length);
    let next = 0;
    let done = 0;
    async function worker() {
      while (next < ids.length) {
        const i = next;
        next += 1;
        const res = await fetch(`https://api.europeana.eu/record/v2${ids[i]}.json?wskey=${encodeURIComponent(apiKey)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(data.error || `Record API responded with HTTP ${res.status} for ${ids[i]}`);
        out[i] = data.object;
        done += 1;
        onProgress(done, ids.length, 'records');
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
    return out;
  }

  async function searchEuropeana({ apiKey, query, max, onProgress }) {
    const items = [];
    let cursor = '*';
    while (cursor && items.length < max) {
      const params = new URLSearchParams({
        wskey: apiKey, query: query || '*', profile: 'rich', rows: String(Math.min(100, max - items.length)), cursor,
      });
      const res = await fetch(`https://api.europeana.eu/record/v2/search.json?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || `Europeana API responded with HTTP ${res.status}`);
      }
      items.push(...(data.items || []));
      onProgress(items.length, data.totalResults);
      cursor = data.items && data.items.length ? data.nextCursor : null;
    }
    return items.slice(0, max);
  }

  return { parseCSV, parseFile, fetchEuropeana, fetchRecords };
});
