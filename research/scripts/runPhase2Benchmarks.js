/**
 * Phase 2 Benchmark Runner
 *
 * Roadmap mapping (Phase 2: Test Datasets + Metrics):
 * - Transform each dataset
 * - Save metrics to research/data/transform-metrics.csv
 *
 * Output CSV columns (required by roadmap):
 * dataset,records,fields,duration_ms,records_per_sec,errors,warnings,accuracy
 *
 * Usage:
 *   node research/scripts/runPhase2Benchmarks.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { transform } = require('../../backend/services/transformer');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function fileExists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function toCsvRow(values) {
  // Simple CSV: values contain no commas in our metrics. Keep it minimal.
  return values.join(',') + '\n';
}

function run() {
  const projectRoot = path.resolve(__dirname, '../..');

  const datasetsDir = path.join(projectRoot, 'research', 'datasets', 'data');
  const schemasDir = path.join(projectRoot, 'research', 'datasets', 'schemas');
  const outputDir = path.join(projectRoot, 'examples', 'outputs');
  const metricsCsvPath = path.join(projectRoot, 'research', 'data', 'transform-metrics.csv');

  ensureDir(outputDir);
  ensureDir(path.dirname(metricsCsvPath));

  const cases = [
    {
      dataset: 'small',
      dataPath: path.join(datasetsDir, 'small.json'),
      schemaPath: path.join(schemasDir, 'employee_5.json'),
      outputPath: path.join(outputDir, 'small.dat')
    }
    // We will add: medium, large, edge, invalid after we create them
  ];

  // Write header if CSV does not exist
  if (!fileExists(metricsCsvPath)) {
    fs.writeFileSync(
      metricsCsvPath,
      'dataset,records,fields,duration_ms,records_per_sec,errors,warnings,accuracy\n',
      'utf-8'
    );
  }

  for (const c of cases) {
    const data = readJson(c.dataPath);
    const schema = readJson(c.schemaPath);

    const result = transform(data, schema, 'json');
    fs.writeFileSync(c.outputPath, result.output + '\n', 'utf-8');

    const m = result.metrics;

    const records = m.recordsProcessed;
    const fields = m.fieldCount;
    const durationMs = m.durationMs;
    const recPerSec = m.recordsPerSec;

    const errors = m.errorsDetected.length;
    const warnings = m.warningsDetected.length;

    const accuracy =
      records > 0 ? ((m.recordsSuccessful / records) * 100).toFixed(2) + '%' : '0.00%';

    const row = toCsvRow([
      c.dataset,
      String(records),
      String(fields),
      durationMs.toFixed(3),
      recPerSec.toFixed(2),
      String(errors),
      String(warnings),
      accuracy
    ]);

    fs.appendFileSync(metricsCsvPath, row, 'utf-8');

    console.log(`✓ Completed dataset "${c.dataset}"`);
    console.log(`  Output: ${path.relative(projectRoot, c.outputPath)}`);
    console.log(`  Metrics row appended to: ${path.relative(projectRoot, metricsCsvPath)}`);
  }
}

run();
