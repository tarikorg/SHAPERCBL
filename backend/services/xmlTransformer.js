/**
 * XML Transformer (Phase 4 - Option A)
 *
 * Roadmap mapping (PHASE 4: XML Parser):
 * - Install xml2js
 * - Add transformXML(xmlPath, fdSchema)
 *   - Support nested elements (JSONPath-like mapping)
 *   - Handle attributes vs elements
 * - Designed to reuse Phase 2 transformer after parsing + mapping.
 *
 * Mapping rules:
 * - Records are extracted from options.recordPath (default "records.record")
 * - For each schema field:
 *   - Use field.xmlPath if present, otherwise fall back to field.sourceKey (or field.name)
 * - Supported path tokens:
 *   - "a.b.c" -> object property traversal
 *   - "@id" inside path -> attribute access via node.$.id (xml2js default attrkey = "$")
 *   - "#text" -> node._ text content (xml2js default charkey = "_")
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { parseStringPromise } = require('xml2js');

const { transform } = require('./transformer');

function normalizeXmlValue(v) {
  if (v === null || v === undefined) return v;

  // xml2js may represent text nodes as { _: 'text', $: {...} }
  if (typeof v === 'object') {
    if (typeof v._ === 'string' || typeof v._ === 'number') return v._;
  }

  return v;
}

/**
 * Get a value from an xml2js-parsed object using a minimal dotted path syntax.
 *
 * Supports:
 * - normal properties: "employee.name"
 * - attributes: "@id" resolved from node.$.id
 * - text content: "#text" resolved from node._
 */
function getByPath(obj, pathStr) {
  if (!pathStr) return undefined;

  const tokens = String(pathStr).split('.').filter(Boolean);
  let cur = obj;

  for (const t of tokens) {
    if (cur === null || cur === undefined) return undefined;

    if (t === '#text') {
      cur = cur && typeof cur === 'object' ? cur._ : undefined;
      continue;
    }

    if (t.startsWith('@')) {
      const attr = t.slice(1);
      cur = cur && typeof cur === 'object' && cur.$ ? cur.$[attr] : undefined;
      continue;
    }

    cur = cur[t];
  }

  return normalizeXmlValue(cur);
}

/**
 * Extract records array from parsed XML according to recordPath.
 *
 * @param {Object} parsed
 * @param {string} recordPath - e.g., "records.record" or "Employees.Employee"
 * @returns {Object[]} record nodes
 */
function extractRecords(parsed, recordPath) {
  const node = getByPath(parsed, recordPath);

  if (Array.isArray(node)) return node;
  if (node && typeof node === 'object') return [node];
  return [];
}

/**
 * Transform an XML file into COBOL fixed-width output using fdSchema.
 *
 * @param {string} xmlPath
 * @param {Object} fdSchema
 * @param {Object} [options]
 * @param {string} [options.recordPath="records.record"]
 * @returns {Promise<{ output: string, metrics: Object }>}
 */
async function transformXML(xmlPath, fdSchema, options = {}) {
  if (!xmlPath || typeof xmlPath !== 'string') {
    throw new Error('transformXML: xmlPath must be a string');
  }
  if (!fdSchema || typeof fdSchema !== 'object') {
    throw new Error('transformXML: fdSchema is required');
  }
  if (!Array.isArray(fdSchema.fields) || fdSchema.fields.length === 0) {
    throw new Error('transformXML: fdSchema.fields must be a non-empty array');
  }

  const absolutePath = path.isAbsolute(xmlPath) ? xmlPath : path.resolve(process.cwd(), xmlPath);

  const recordPath = options.recordPath || 'records.record';

  const totalStart = performance.now();

  // --- Parse XML ---
  const parseStart = performance.now();
  const xmlText = fs.readFileSync(absolutePath, 'utf-8');

  const parsed = await parseStringPromise(xmlText, {
    explicitArray: false,
    attrkey: '$',
    charkey: '_',
    trim: true,
    normalize: true
  });

  const parseTime = performance.now() - parseStart;

  // --- Extract records ---
  const recordNodes = extractRecords(parsed, recordPath);
  if (!recordNodes || recordNodes.length === 0) {
    throw new Error(`transformXML: No records found at recordPath="${recordPath}"`);
  }

  // --- Map XML nodes -> flat records for Phase 2 transformer ---
  // IMPORTANT: Phase 2 transform expects keys defined by field.sourceKey.
  // For XML we allow field.xmlPath to specify where to read from.
  const flatRecords = recordNodes.map((node) => {
    const out = {};
    for (const field of fdSchema.fields) {
      const key = field.sourceKey || field.name;
      const xmlFieldPath = field.xmlPath || field.sourceKey || field.name;
      out[key] = getByPath(node, xmlFieldPath);
    }
    return out;
  });

  // --- Transform using shared core ---
  const result = transform(flatRecords, fdSchema, 'xml');

  const totalTime = performance.now() - totalStart;

  // Update metrics to reflect actual XML parse + wrapper total.
  result.metrics.inputFormat = 'xml';
  result.metrics.perfMark.parseTime = parseTime;
  result.metrics.perfMark.totalTime = totalTime;
  result.metrics.durationMs = totalTime;

  result.metrics.recordsPerSec =
    result.metrics.durationMs > 0
      ? (result.metrics.recordsSuccessful / result.metrics.durationMs) * 1000
      : 0;

  result.metrics.xml = { recordPath };

  return result;
}

module.exports = {
  transformXML,
  getByPath,
  extractRecords
};
