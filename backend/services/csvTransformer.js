/*
read file stream
auto-detect delimiter
parse into records with headers
call the transform(records, fdschema, 'csv')
return {output, metrics} 
*/

/**
 * CSV Transformer (Phase 4 - Option A)
 *
 * Roadmap mapping (PHASE 4: CSV Parser):
 * - Install csv-parser
 * - transformCSV(csvPath, fdSchema)
 *   - Auto-detect delimiter (comma vs tab vs pipe)
 *   - Handle quoted fields via csv-parser
 *   - Map CSV header columns to schema.sourceKey (csv-parser outputs objects by header)
 *
 * This module converts CSV -> records[] and then reuses the Phase 2 transformer:
 *   transform(records, fdSchema, 'csv')
 *
 * Performance:
 * - Measures parse_time_ms separately so Phase 4 format comparison is valid.
 */

'use strict'

const fs = require('fs')
const path = require('path')
const {performance} = require('perf_hooks')
const csvParser = require('csv-parser')
const {transform} = require('./transformer')


/**
 * Detect delimiter by inspecting the first non-empty line (usually the header).
 * Candidate delimiters: comma, tab, pipe.
 *
 * @param {string} filePath
 * @returns {string} delimiter
 */

function detectDelimiter(filePath){
    const fd = fs.openSync(filePath,'r');

    try{
        const buffer = Buffer.alloc(8192);
        const bytesRead = fs.readSync(fd, buffer, 0, buffer.length,0);
        const chunk = buffer.slice(0,bytesRead).toString('utf-8');

     const lines = chunk.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const header = lines.length > 0 ? lines[0] : '';

    const candidates = [',', '\t', '|'];
    const counts = candidates.map(d => ({
      d,
      count: header.split(d).length - 1
    }));

    counts.sort((a, b) => b.count - a.count);

    // If no delimiter is found, default to comma (standard CSV)
    if (counts[0].count === 0) return ',';
    return counts[0].d;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Parse CSV into an array of records using streaming.
 *
 * @param {string} filePath
 * @param {string} delimiter
 * @returns {Promise<Object[]>}
 */
function parseCsvToRecords(filePath, delimiter) {
  return new Promise((resolve, reject) => {
    const records = [];

    fs.createReadStream(filePath)
      .pipe(csvParser({ separator: delimiter }))
      .on('data', (row) => {
        records.push(row);
      })
      .on('end', () => resolve(records))
      .on('error', (err) => reject(err));
  });
}

/**
 * Transform a CSV file into COBOL fixed-width output using fdSchema.
 *
 * @param {string} csvPath
 * @param {Object} fdSchema
 * @returns {Promise<{ output: string, metrics: Object }>}
 */
async function transformCSV(csvPath, fdSchema) {
  if (!csvPath || typeof csvPath !== 'string') {
    throw new Error('transformCSV: csvPath must be a string');
  }
  if (!fdSchema || typeof fdSchema !== 'object') {
    throw new Error('transformCSV: fdSchema is required');
  }

  const absolutePath = path.isAbsolute(csvPath) ? csvPath : path.resolve(process.cwd(), csvPath);

  const totalStart = performance.now();

  const parseStart = performance.now();
  const delimiter = detectDelimiter(absolutePath);
  const records = await parseCsvToRecords(absolutePath, delimiter);
  const parseTime = performance.now() - parseStart;

  // Reuse Phase 2 transformer
  const result = transform(records, fdSchema, 'csv');

  // Adjust perf marks to reflect actual CSV parsing time + wrapper total time
  const totalTime = performance.now() - totalStart;

  result.metrics.inputFormat = 'csv';
  result.metrics.perfMark.parseTime = parseTime;
  result.metrics.perfMark.totalTime = totalTime;
  result.metrics.durationMs = totalTime;

  // Recompute records/sec based on updated duration
  result.metrics.recordsPerSec =
    result.metrics.durationMs > 0
      ? (result.metrics.recordsSuccessful / result.metrics.durationMs) * 1000
      : 0;

  // Include delimiter used (useful for debugging + edge-case documentation)
  result.metrics.csv = { delimiter };

  return result;
}

module.exports = {
  transformCSV,
  detectDelimiter,
  parseCsvToRecords
};
