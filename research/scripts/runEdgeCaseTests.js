/**
 * Phase 4: Edge Case Testing Runner
 *
 * Roadmap mapping (PHASE 4: Edge Case Testing):
 * - Run targeted edge-case records through the validator/transformer
 * - Produce an auditable "works vs warn vs fail" matrix for the paper
 * - Output artifacts:
 *   - research/data/edge-case-results.csv
 *   - research/data/edge-case-results.json
 *   - examples/outputs/edgecases.dat (only successfully transformed records)
 *
 * Usage:
 *   node research/scripts/runEdgeCaseTests.js
 */

'use strict';


const fs = require('fs');
const path = require('path');

const { validateRecord } = require('../../backend/services/validator');
const { transform } = require('../../backend/services/transformer');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Escape a value for safe CSV output.
 * (We need this because warnings/errors may contain commas and quotes.)
 */
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (!/[,"\r\n]/.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

function run() {
  const projectRoot = path.resolve(__dirname, '../..');

  const schemaPath = path.join(projectRoot, 'research', 'datasets', 'schemas', 'employee_10.json');
  const dataPath = path.join(projectRoot, 'research', 'datasets', 'data', 'edgecases.json');

  const outCsvPath = path.join(projectRoot, 'research', 'data', 'edge-case-results.csv');
  const outJsonPath = path.join(projectRoot, 'research', 'data', 'edge-case-results.json');
  const outDatPath = path.join(projectRoot, 'examples', 'outputs', 'edgecases.dat');

  ensureDir(path.dirname(outCsvPath));
  ensureDir(path.dirname(outDatPath));

  const schema = readJson(schemaPath);
  const records = readJson(dataPath);

  // Write CSV header (reproducible rewrite)
  fs.writeFileSync(
    outCsvPath,
    [
      'index',
      'case',
      'status',
      'errors_count',
      'warnings_count',
      'errors',
      'warnings',
      'transformed',
      'output_line_len'
    ].join(',') + '\n',
    'utf-8'
  );

  const results = [];
  const datLines = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const caseName = record._case || `case_${i}`;

    // 1) Validate single record
    const vr = validateRecord(record, schema, i);
    const errors = vr.errors || [];
    const warnings = vr.warnings || [];

    let status = 'OK';
    if (errors.length > 0) status = 'ERROR';
    else if (warnings.length > 0) status = 'WARN';

    // 2) Transform only if no errors
    let transformed = false;
    let outputLineLen = '';

    if (status !== 'ERROR') {
      const tr = transform([record], schema, 'json');
      const line = (tr.output || '').split('\n')[0] || '';
      transformed = true;
      outputLineLen = line.length;
      datLines.push(line);
    }

    const row = [
      i,
      csvEscape(caseName),
      status,
      errors.length,
      warnings.length,
      csvEscape(errors.join(' | ')),
      csvEscape(warnings.join(' | ')),
      transformed ? 'true' : 'false',
      outputLineLen
    ].join(',') + '\n';

    fs.appendFileSync(outCsvPath, row, 'utf-8');

    results.push({
      index: i,
      case: caseName,
      status,
      errors,
      warnings,
      transformed,
      outputLineLen: outputLineLen === '' ? null : outputLineLen
    });
  }

  fs.writeFileSync(outJsonPath, JSON.stringify(results, null, 2) + '\n', 'utf-8');
  fs.writeFileSync(outDatPath, datLines.join('\n') + '\n', 'utf-8');

  console.log('✓ Wrote: ' + path.relative(projectRoot, outCsvPath));
  console.log('✓ Wrote: ' + path.relative(projectRoot, outJsonPath));
  console.log('✓ Wrote: ' + path.relative(projectRoot, outDatPath));
  console.log(`Records: ${records.length} (transformed: ${datLines.length})`);
}

run();
