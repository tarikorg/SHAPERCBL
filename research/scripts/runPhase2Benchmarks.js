/**
 * Phase 2 Benchmark Runner
 *
 * Roadmap mapping (PHASE 2: Test Datasets + Metrics):
 * - Transform each dataset
 * - Save metrics to research/data/transform-metrics.csv with columns:
 *   dataset,records,fields,duration_ms,records_per_sec,errors,warnings,accuracy
 *
 * Usage:
 *   node research/scripts/runPhase2Benchmarks.js
 *
 * Outputs:
 * - Writes fixed-width outputs to examples/outputs/*.dat (for Phase 3 COBOL validation)
 * - Rewrites benchmark metrics to research/data/transform-metrics.csv (reproducible)
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

function toCsvRow(values) {
  return values.join(',') + '\n';
}

function formatPct(n) {
  return n.toFixed(2) + '%';
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
    },
    {
      dataset: 'medium',
      dataPath: path.join(datasetsDir, 'medium.json'),
      schemaPath: path.join(schemasDir, 'employee_10.json'),
      outputPath: path.join(outputDir, 'medium.dat')
    },
    {
      dataset: 'large',
      dataPath: path.join(datasetsDir, 'large.json'),
      schemaPath: path.join(schemasDir, 'employee_15.json'),
      outputPath: path.join(outputDir, 'large.dat')
    },
    {
      dataset: 'edge',
      dataPath: path.join(datasetsDir, 'edge.json'),
      schemaPath: path.join(schemasDir, 'employee_10.json'),
      outputPath: path.join(outputDir, 'edge.dat')
    },
    {
      dataset: 'invalid',
      dataPath: path.join(datasetsDir, 'invalid.json'),
      schemaPath: path.join(schemasDir, 'employee_5.json'),
      outputPath: path.join(outputDir, 'invalid.dat')
    }
  ];

  // ========== REPRODUCIBLE OUTPUT ==========
  // Always rewrite CSV each run so you always get exactly 5 rows for Phase 2.
  fs.writeFileSync(
    metricsCsvPath,
    'dataset,records,fields,duration_ms,records_per_sec,errors,warnings,accuracy\n',
    'utf-8'
  );

  const csvRows = [];

  for (const c of cases) {
    const data = readJson(c.dataPath);
    const schema = readJson(c.schemaPath);

    const result = transform(data, schema, 'json');

    // Always rewrite output files for Phase 3 validation
    fs.writeFileSync(c.outputPath, result.output ? result.output + '\n' : '', 'utf-8');

    const m = result.metrics;

    const records = m.recordsProcessed;
    const fields = m.fieldCount;
    const durationMs = m.durationMs;
    const recPerSec = m.recordsPerSec;

    const errors = m.errorsDetected.length;
    const warnings = m.warningsDetected.length;

    const accuracyValue = records > 0 ? (m.recordsSuccessful / records) * 100 : 0;
    const accuracy = formatPct(accuracyValue);

    const row = toCsvRow([
      c.dataset,
      String(records),
      String(fields),
      Number(durationMs).toFixed(3),
      Number(recPerSec).toFixed(2),
      String(errors),
      String(warnings),
      accuracy
    ]);

    csvRows.push(row);

    console.log(`✓ Completed dataset "${c.dataset}"`);
    console.log(`  Output: ${path.relative(projectRoot, c.outputPath)}`);
    console.log(`  Successful: ${m.recordsSuccessful}/${records} | Errors: ${errors} | Warnings: ${warnings}\n`);
  }

  fs.appendFileSync(metricsCsvPath, csvRows.join(''), 'utf-8');

  console.log(`✓ Metrics written: ${path.relative(projectRoot, metricsCsvPath)}`);
}

run();
