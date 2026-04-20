/**
 * Dataset Preflight Validator (Phase 4)
 *
 * Purpose:
 * - Prevent corrupted or incompatible datasets from silently contaminating benchmarks.
 * - Uses the same validateRecord() logic as the transformation engine.
 *
 * Modes:
 * - lenient (default): fail only if errors exist
 * - strict: fail if errors OR warnings exist
 *
 * Usage examples:
 *   node research/scripts/validateDataset.js
 *   node research/scripts/validateDataset.js --mode strict
 *   node research/scripts/validateDataset.js --dataset research/datasets/data/format1000.json --schema research/datasets/schemas/employee_10.json
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { validateRecord } = require('../../backend/services/validator');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function parseArgs(argv) {
  const args = {
    dataset: null,
    schema: null,
    mode: 'lenient',
    report: null,
    sampleLimit: 25
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];

    if (a === '--dataset') args.dataset = argv[++i];
    else if (a === '--schema') args.schema = argv[++i];
    else if (a === '--mode') args.mode = argv[++i];
    else if (a === '--report') args.report = argv[++i];
    else if (a === '--sampleLimit') args.sampleLimit = Number(argv[++i]);
  }

  if (args.mode !== 'lenient' && args.mode !== 'strict') {
    throw new Error(`Invalid --mode "${args.mode}". Use "lenient" or "strict".`);
  }

  return args;
}

function validateAll(records, schema, sampleLimit = 25) {
  let errorCount = 0;
  let warningCount = 0;

  const samples = [];

  for (let i = 0; i < records.length; i++) {
    const vr = validateRecord(records[i], schema, i);

    const eCount = Array.isArray(vr.errors) ? vr.errors.length : 0;
    const wCount = Array.isArray(vr.warnings) ? vr.warnings.length : 0;

    errorCount += eCount;
    warningCount += wCount;

    if ((eCount > 0 || wCount > 0) && samples.length < sampleLimit) {
      samples.push({
        index: i,
        errors: vr.errors || [],
        warnings: vr.warnings || [],
        record: records[i]
      });
    }
  }

  return { errorCount, warningCount, samples };
}

function run() {
  const projectRoot = path.resolve(__dirname, '../..');
  const args = parseArgs(process.argv);

  const datasetPath = path.resolve(
    projectRoot,
    args.dataset || path.join('research', 'datasets', 'data', 'format1000.json')
  );

  const schemaPath = path.resolve(
    projectRoot,
    args.schema || path.join('research', 'datasets', 'schemas', 'employee_10.json')
  );

  const reportPath = path.resolve(
    projectRoot,
    args.report || path.join('research', 'data', 'format1000-preflight.json')
  );

  const records = readJson(datasetPath);
  const schema = readJson(schemaPath);

  if (!Array.isArray(records)) {
    throw new Error(`Dataset must be a JSON array. Got: ${typeof records}`);
  }

  const { errorCount, warningCount, samples } = validateAll(records, schema, args.sampleLimit);

  const report = {
    dataset: path.relative(projectRoot, datasetPath),
    schema: path.relative(projectRoot, schemaPath),
    mode: args.mode,
    recordCount: records.length,
    errorCount,
    warningCount,
    sampleLimit: args.sampleLimit,
    samples
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf-8');

  console.log('Preflight validation report written:');
  console.log('-', path.relative(projectRoot, reportPath));
  console.log(`Records: ${records.length}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Warnings: ${warningCount}`);

  const shouldFail =
    args.mode === 'strict'
      ? (errorCount > 0 || warningCount > 0)
      : (errorCount > 0);

  if (shouldFail) {
    console.error(`FAIL (${args.mode}): dataset not clean.`);
    process.exitCode = 1;
    return;
  }

  console.log(`PASS (${args.mode}): dataset is acceptable.`);
}

run();
