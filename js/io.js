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

  /** Parse the text of a .csv or .json file. JSON may be an array, or a Europeana response with "items". */
  function parseFile(name, content) {
    if (/\.json$/i.test(name) || /^\s*[[{]/.test(content)) {
      const data = JSON.parse(content);
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.items)) return data.items;
      if (Array.isArray(data.records)) return data.records;
      throw new Error('JSON must be an array of records or an object with an "items" array.');
    }
    return parseCSV(content);
  }

  /**
   * Fetch up to `max` items from the Europeana Search API (cursor paging).
   * Get a free API key at https://pro.europeana.eu/page/get-api
   */
  async function fetchEuropeana({ apiKey, query, max = 200, onProgress = () => {} }) {
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

  return { parseCSV, parseFile, fetchEuropeana };
});
