/**
 * Phase 4: CSV Variant Transformation Test Runner
 *
 * Roadmap mapping (PHASE 4: CSV Parser):
 * - Test transformCSV() with 3 delimiter variants:
 *   - comma CSV
 *   - tab TSV
 *   - pipe PSV
 *
 * This runner:
 * - Executes transformCSV for each file
 * - Writes resulting fixed-width output (.dat) into examples/outputs/
 * - Logs parse/validate/format timing and delimiter detection
 * - Writes a reproducible metrics artifact:
 *   research/data/csv-variant-results.csv
 *
 * Usage:
 *   node research/scripts/testCsvTransform.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const { transformCSV } = require('../../backend/services/csvTransformer');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function toCsvRow(values) {
  return values.join(',') + '\n';
}

async function run() {
  const projectRoot = path.resolve(__dirname, '../..');

  const schemaPath = path.join(projectRoot, 'research', 'datasets', 'schemas', 'employee_10.json');
  const schema = readJson(schemaPath);

  const dataDir = path.join(projectRoot, 'research', 'datasets', 'data');
  const outDir = path.join(projectRoot, 'examples', 'outputs');
  const resultsCsvPath = path.join(projectRoot, 'research', 'data', 'csv-variant-results.csv');

  ensureDir(outDir);
  ensureDir(path.dirname(resultsCsvPath));

  // Reproducible output: rewrite each run
  fs.writeFileSync(
    resultsCsvPath,
    'variant,detected_delimiter,records,fields,parse_ms,validate_ms,format_ms,total_ms,errors,warnings,records_per_sec\n',
    'utf-8'
  );

  const cases = [
    {
      variant: 'medium_comma',
      inputPath: path.join(dataDir, 'medium_comma.csv'),
      outputPath: path.join(outDir, 'medium_comma.dat')
    },
    {
      variant: 'medium_tab',
      inputPath: path.join(dataDir, 'medium_tab.tsv'),
      outputPath: path.join(outDir, 'medium_tab.dat')
    },
    {
      variant: 'medium_pipe',
      inputPath: path.join(dataDir, 'medium_pipe.psv'),
      outputPath: path.join(outDir, 'medium_pipe.dat')
    }
  ];

  for (const c of cases) {
    console.log(`\n=== CSV variant: ${c.variant} ===`);
    console.log(`Input:  ${path.relative(projectRoot, c.inputPath)}`);

    const start = performance.now();
    const result = await transformCSV(c.inputPath, schema);
    const wallTotal = performance.now() - start;

    // Write .dat output for inspection / later COBOL validation if desired
    fs.writeFileSync(c.outputPath, result.output ? result.output + '\n' : '', 'utf-8');

    const m = result.metrics;

    // Print a concise but useful summary
    console.log(`Detected delimiter: ${JSON.stringify(m.csv?.delimiter)}`);
    console.log(`Records: processed=${m.recordsProcessed}, successful=${m.recordsSuccessful}`);
    console.log(`Errors: ${m.errorsDetected.length}, Warnings: ${m.warningsDetected.length}`);
    console.log(
      `Timing(ms): parse=${m.perfMark.parseTime.toFixed(3)}, validate=${m.perfMark.validateTime.toFixed(3)}, format=${m.perfMark.formatTime.toFixed(3)}, total=${m.perfMark.totalTime.toFixed(3)} (wall=${wallTotal.toFixed(3)})`
    );

    const row = toCsvRow([
      c.variant,
      JSON.stringify(m.csv?.delimiter || ''),
      String(m.recordsProcessed),
      String(m.fieldCount),
      Number(m.perfMark.parseTime).toFixed(3),
      Number(m.perfMark.validateTime).toFixed(3),
      Number(m.perfMark.formatTime).toFixed(3),
      Number(m.perfMark.totalTime).toFixed(3),
      String(m.errorsDetected.length),
      String(m.warningsDetected.length),
      Number(m.recordsPerSec).toFixed(2)
    ]);

    fs.appendFileSync(resultsCsvPath, row, 'utf-8');

    console.log(`Output: ${path.relative(projectRoot, c.outputPath)}`);
  }

  console.log(`\n✓ Wrote results: ${path.relative(projectRoot, resultsCsvPath)}`);
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
