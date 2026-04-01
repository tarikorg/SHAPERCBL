/**
 * Transformer Service (Phase 2)
 *
 * Purpose:
 * Transform an array of modern records (JSON objects) into COBOL fixed-width lines
 * using a schema (fdSchema) with field definitions (length/type/sourceKey/etc).
 *
 * Roadmap mapping (Phase 2):
 * - transform(sourceData, fdSchema, inputFormat)
 * - Collect metrics: recordsProcessed, errorsDetected, warningsDetected, truncations
 * - Measure duration and perf marks using performance.now()
 *
 * Notes:
 * - Records that fail validation (errors) are NOT transformed into output lines.
 * - Records with warnings are transformed, but warnings are reported in metrics.
 */

'use strict';

const { performance } = require('perf_hooks');
const { validateRecord } = require('./validator');
const { formatField } = require('./formatter');

/**
 * Initialize metrics object for one transformation run.
 * Keeping this in a helper keeps transform() readable.
 */
function initMetrics(inputFormat, fdSchema) {
  return {
    inputFormat,
    fieldCount: Array.isArray(fdSchema?.fields) ? fdSchema.fields.length : 0,

    recordsProcessed: 0,
    recordsSuccessful: 0,

    truncations: 0,

    errorsDetected: [],   // [{ record: idx, errors: [...] }]
    warningsDetected: [], // [{ record: idx, warnings: [...] }]

    durationMs: 0,
    recordsPerSec: 0,

    perfMark: {
      parseTime: 0,
      validateTime: 0,
      formatTime: 0,
      totalTime: 0
    }
  };
}

/**
 * Transform a single record into one fixed-width line.
 *
 * @param {Object} record
 * @param {Object} fdSchema
 * @param {number} recordIndex
 * @param {Object} metrics - metrics object we update (truncations)
 * @param {Object} perfMark - perf marks we update
 *
 * @returns {{ line: string, errors: string[], warnings: string[] }}
 */
function transformRecord(record, fdSchema, recordIndex, metrics, perfMark) {
  const errors = [];
  const warnings = [];

  // ========== VALIDATION STAGE ==========
  const validateStart = performance.now();
  const validation = validateRecord(record, fdSchema, recordIndex);
  perfMark.validateTime += performance.now() - validateStart;

  if (!validation.isValid) {
    // Hard stop: record is invalid; return errors, no line
    return { line: '', errors: validation.errors, warnings: validation.warnings || [] };
  }

  // Validation warnings still matter
  if (Array.isArray(validation.warnings) && validation.warnings.length > 0) {
    warnings.push(...validation.warnings);
  }

  // ========== FORMATTING STAGE ==========
  const formatStart = performance.now();

  const pieces = [];
  for (const fieldDef of fdSchema.fields) {
    const fieldName = fieldDef.name || 'UNKNOWN_FIELD';
    const key = fieldDef.sourceKey || fieldName.toLowerCase();
    const rawValue = record[key];

    const formatted = formatField(rawValue, fieldDef);

    // Collect formatter errors/warnings
    if (formatted.errors && formatted.errors.length > 0) {
      // Treat formatting errors as record-level errors
      for (const e of formatted.errors) {
        errors.push(`Record ${recordIndex}: Field "${fieldName}": ${e}`);
      }
    }

    if (formatted.warnings && formatted.warnings.length > 0) {
      for (const w of formatted.warnings) {
        warnings.push(`Record ${recordIndex}: Field "${fieldName}": ${w}`);

        // Track truncations explicitly (roadmap requires truncations metric)
        if (String(w).toLowerCase().includes('truncation')) {
          metrics.truncations += 1;
        }
      }
    }

    // Always push value to keep record width stable; if errors exist, transformer will drop the record anyway.
    pieces.push(formatted.value);
  }

  perfMark.formatTime += performance.now() - formatStart;

  // If formatting produced errors, do not output the line.
  if (errors.length > 0) {
    return { line: '', errors, warnings };
  }

  const line = pieces.join('');

  return { line, errors, warnings };
}

/**
 * Transform an array of records into fixed-width output.
 *
 * @param {Object[]|string} sourceData - JSON array of records (or a string in later phases)
 * @param {Object} fdSchema - schema with fields[]
 * @param {string} inputFormat - "json" (Phase 2), later "csv" and "xml"
 *
 * @returns {{ output: string, metrics: Object }}
 */
function transform(sourceData, fdSchema, inputFormat = 'json') {
  const totalStart = performance.now();

  // Parse stage: in Phase 2 JSON should already be parsed into an array,
  // but we keep parseTime instrumentation for roadmap compliance and Phase 4 reuse.
  const parseStart = performance.now();

  let records = sourceData;

  if (typeof sourceData === 'string') {
    // If a JSON string is passed in, parse it.
    // (This also supports curl testing where body could be stringified.)
    try {
      records = JSON.parse(sourceData);
    } catch (err) {
      const metrics = initMetrics(inputFormat, fdSchema);
      metrics.perfMark.parseTime = performance.now() - parseStart;
      metrics.perfMark.totalTime = performance.now() - totalStart;
      metrics.durationMs = metrics.perfMark.totalTime;

      metrics.errorsDetected.push({ record: -1, errors: [`Invalid JSON input: ${err.message}`] });
      return { output: '', metrics };
    }
  }

  const parseTime = performance.now() - parseStart;

  const metrics = initMetrics(inputFormat, fdSchema);
  metrics.perfMark.parseTime = parseTime;

  // Validate schema shape
  if (!fdSchema || !Array.isArray(fdSchema.fields) || fdSchema.fields.length === 0) {
    metrics.errorsDetected.push({ record: -1, errors: ['Invalid schema: missing fields[]'] });
    metrics.perfMark.totalTime = performance.now() - totalStart;
    metrics.durationMs = metrics.perfMark.totalTime;
    return { output: '', metrics };
  }

  // Validate input shape
  if (!Array.isArray(records)) {
    metrics.errorsDetected.push({ record: -1, errors: ['Input data must be an array of records'] });
    metrics.perfMark.totalTime = performance.now() - totalStart;
    metrics.durationMs = metrics.perfMark.totalTime;
    return { output: '', metrics };
  }

  // ========== MAIN TRANSFORMATION LOOP ==========
  const lines = [];

  for (let i = 0; i < records.length; i++) {
    metrics.recordsProcessed += 1;

    const { line, errors, warnings } = transformRecord(records[i], fdSchema, i, metrics, metrics.perfMark);

    if (errors && errors.length > 0) {
      metrics.errorsDetected.push({ record: i, errors });
      // Skip invalid record (do not output a line)
      continue;
    }

    if (warnings && warnings.length > 0) {
      metrics.warningsDetected.push({ record: i, warnings });
    }

    lines.push(line);
    metrics.recordsSuccessful += 1;
  }

  // ========== FINAL METRICS ==========
  const totalTime = performance.now() - totalStart;

  metrics.perfMark.totalTime = totalTime;
  metrics.durationMs = totalTime;

  // Records per second based on successful outputs (not attempted records)
  metrics.recordsPerSec =
    metrics.durationMs > 0 ? (metrics.recordsSuccessful / metrics.durationMs) * 1000 : 0;

  return {
    output: lines.join('\n'),
    metrics
  };
}

module.exports = {
  transform,
  transformRecord
};
