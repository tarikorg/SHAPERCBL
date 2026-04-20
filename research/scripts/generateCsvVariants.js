/**
 * Phase 4: CSV Variant Generator
 *
 * Roadmap mapping (PHASE 4: CSV Parser testing):
 * - Create 3 CSV variants (comma, tab, pipe) from the same underlying records
 *   to test delimiter autodetection + quoted field handling.
 *
 * Methodological goal:
 * - Keep data constant while varying serialization format, enabling fair
 *   performance comparisons (parse time) across formats.
 *
 * Usage:
 *   node research/scripts/generateCsvVariants.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Escape a single field for delimited output.
 *
 * CSV-style quoting rules:
 * - If field contains delimiter, quote, CR, or LF -> wrap in double quotes
 * - Escape internal quotes by doubling them
 */
function escapeField(value, delimiter) {
  if (value === null || value === undefined) return '';

  const s = String(value);
  const mustQuote =
    s.includes(delimiter) || s.includes('"') || s.includes('\n') || s.includes('\r');

  if (!mustQuote) return s;

  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

function writeDelimited(records, delimiter, outPath, headerOrder) {
  const lines = [];
  lines.push(headerOrder.join(delimiter));

  for (const r of records) {
    const row = headerOrder.map((key) => escapeField(r[key], delimiter)).join(delimiter);
    lines.push(row);
  }

  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf-8');
}

/**
 * Produce comma/tab/pipe variants from medium.json (100 records, 10 fields).
 */
function run() {
  const projectRoot = path.resolve(__dirname, '../..');

  const dataDir = path.join(projectRoot, 'research', 'datasets', 'data');
  const inputJsonPath = path.join(dataDir, 'medium.json');

  const records = readJson(inputJsonPath);

  // Must match schema sourceKeys (employee_10.json)
  const headerOrder = [
    'emp_id',
    'name',
    'dept',
    'hire_date',
    'salary',
    'phone',
    'email',
    'state',
    'bonus',
    'active'
  ];

  writeDelimited(records, ',', path.join(dataDir, 'medium_comma.csv'), headerOrder);
  writeDelimited(records, '\t', path.join(dataDir, 'medium_tab.tsv'), headerOrder);
  writeDelimited(records, '|', path.join(dataDir, 'medium_pipe.psv'), headerOrder);

  console.log('✓ Wrote CSV variants:');
  console.log('- research/datasets/data/medium_comma.csv');
  console.log('- research/datasets/data/medium_tab.tsv');
  console.log('- research/datasets/data/medium_pipe.psv');
}

run();
