/**
 * Phase 3 COBOL Validation Suite Runner
 *
 * Roadmap mapping (PHASE 3: Validation Test Suite):
 * For each of the 5 test datasets:
 * - Compile copybook + COBOL test program with GnuCOBOL
 * - Run and verify output
 * - Log results to research/data/cobol-validation.csv:
 *   dataset,compile_success,compile_time_ms,run_success,run_time_ms,output_correct
 *
 * Usage:
 *   node research/scripts/runCobolValidationSuite.js
 *
 * This script rewrites the CSV each run so results are reproducible and contain
 * exactly one row per dataset.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { validateWithCOBOL } = require('../../backend/services/cobolValidator');
const { validateRecord } = require('../../backend/services/validator');

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

  const datasetsDir = path.join(projectRoot, 'research', 'datasets', 'data');
  const schemasDir = path.join(projectRoot, 'research', 'datasets', 'schemas');
  const outputsDir = path.join(projectRoot, 'examples', 'outputs');

  const csvPath = path.join(projectRoot, 'research', 'data', 'cobol-validation.csv');
  ensureDir(path.dirname(csvPath));

  // Always rewrite the CSV so we get exactly 5 rows each run.
  fs.writeFileSync(
    csvPath,
    'dataset,compile_success,compile_time_ms,run_success,run_time_ms,output_correct\n',
    'utf-8'
  );

  const cases = [
    {
      datasetName: 'small',
      schemaPath: path.join(schemasDir, 'employee_5.json'),
      dataPath: path.join(datasetsDir, 'small.json'),
      datFilePath: path.join(outputsDir, 'small.dat')
    },
    {
      datasetName: 'medium',
      schemaPath: path.join(schemasDir, 'employee_10.json'),
      dataPath: path.join(datasetsDir, 'medium.json'),
      datFilePath: path.join(outputsDir, 'medium.dat')
    },
    {
      datasetName: 'large',
      schemaPath: path.join(schemasDir, 'employee_15.json'),
      dataPath: path.join(datasetsDir, 'large.json'),
      datFilePath: path.join(outputsDir, 'large.dat')
    },
    {
      datasetName: 'edge',
      schemaPath: path.join(schemasDir, 'employee_10.json'),
      dataPath: path.join(datasetsDir, 'edge.json'),
      datFilePath: path.join(outputsDir, 'edge.dat')
    },
    {
      datasetName: 'invalid',
      schemaPath: path.join(schemasDir, 'employee_5.json'),
      dataPath: path.join(datasetsDir, 'invalid.json'),
      datFilePath: path.join(outputsDir, 'invalid.dat')
    }
  ];

  for (const c of cases) {
    const schema = readJson(c.schemaPath);
    const data = readJson(c.dataPath);

    // Pick the first record that would actually be transformed (important for invalid dataset)
    let sampleRecord = null;
    if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        const vr = validateRecord(data[i], schema, i);
        if (vr.isValid) {
          sampleRecord = data[i];
          break;
        }
      }
    }

    console.log(`\n=== Validating dataset "${c.datasetName}" ===`);
    console.log(`Schema: ${path.relative(projectRoot, c.schemaPath)}`);
    console.log(`DAT:    ${path.relative(projectRoot, c.datFilePath)}`);

    const result = await validateWithCOBOL({
      datasetName: c.datasetName,
      fdSchema: schema,
      datFilePath: c.datFilePath,
      sampleRecord,
      logToCsv: false
    });

    const row = toCsvRow([
      c.datasetName,
      String(result.compileSuccess),
      Number(result.compileTimeMs).toFixed(3),
      String(result.runSuccess),
      Number(result.runTimeMs).toFixed(3),
      String(result.outputCorrect)
    ]);

    fs.appendFileSync(csvPath, row, 'utf-8');

    console.log(`Compile: ${result.compileSuccess} (${Number(result.compileTimeMs).toFixed(1)} ms)`);
    console.log(`Run:     ${result.runSuccess} (${Number(result.runTimeMs).toFixed(1)} ms)`);
    console.log(`Correct: ${result.outputCorrect}`);
  }

  console.log(`\n✓ Wrote: ${path.relative(projectRoot, csvPath)}`);
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
