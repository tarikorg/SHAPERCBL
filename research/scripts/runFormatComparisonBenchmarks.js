/**
 * Phase 4: Format Performance Comparison Benchmark Runner
 *
 * Roadmap mapping (PHASE 4: Format Performance Comparison):
 * - Create identical dataset in 3 formats (JSON, CSV, XML) with 1000 records
 * - Measure for each:
 *   - Parse time
 *   - Transform time
 *   - Memory usage (process.memoryUsage)
 * - Save to research/data/format-comparison.csv:
 *   format,parse_time_ms,transform_time_ms,memory_mb,total_time_ms
 *
 * Notes on rigor:
 * - Memory/time are noisy due to OS caching + Node GC. This script supports trials.
 * - For reduced variance, run with:
 *     node --expose-gc research/scripts/runFormatComparisonBenchmarks.js --trials 5
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const { transform } = require('../../backend/services/transformer');
const { transformCSV } = require('../../backend/services/csvTransformer');
const { transformXML } = require('../../backend/services/xmlTransformer');
const { validateRecord } = require('../../backend/services/validator');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function parseArgs(argv) {
  const args = {
    trials: 3,
    preflight: true,
    outCsv: null,
    outJson: null
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--trials') args.trials = Number(argv[++i]);
    else if (a === '--no-preflight') args.preflight = false;
    else if (a === '--out') args.outCsv = argv[++i];
    else if (a === '--outJson') args.outJson = argv[++i];
  }

  if (!Number.isInteger(args.trials) || args.trials <= 0) {
    throw new Error(`Invalid --trials "${args.trials}" (must be integer > 0)`);
  }

  return args;
}

function memSnapshot() {
  const m = process.memoryUsage();
  return {
    rss: m.rss,
    heapUsed: m.heapUsed
  };
}

function bytesToMB(b) {
  return b / (1024 * 1024);
}

function memDeltaMB(before, after) {
  return {
    rssMB: bytesToMB(after.rss - before.rss),
    heapUsedMB: bytesToMB(after.heapUsed - before.heapUsed)
  };
}

function maybeGC() {
  if (typeof global.gc === 'function') {
    global.gc();
    return true;
  }
  return false;
}

function preflightValidate(records, schema) {
  let errors = 0;
  let warnings = 0;

  for (let i = 0; i < records.length; i++) {
    const vr = validateRecord(records[i], schema, i);
    errors += (vr.errors || []).length;
    warnings += (vr.warnings || []).length;
  }

  return { errors, warnings };
}

async function runOne(format, paths, schema) {
  maybeGC();
  const memBefore = memSnapshot();
  const start = performance.now();

  let result;
  if (format === 'json') {
    // Parse (JSON.parse time is counted in wrapper total; Phase 2 transformer parseTime may be 0)
    const records = readJson(paths.json);
    result = transform(records, schema, 'json');
    // normalize total time to wrapper time for comparability
    result.metrics.perfMark.totalTime = performance.now() - start;
    result.metrics.durationMs = result.metrics.perfMark.totalTime;
    result.metrics.perfMark.parseTime = result.metrics.perfMark.parseTime || 0;
  } else if (format === 'csv') {
    result = await transformCSV(paths.csv, schema);
  } else if (format === 'xml') {
    result = await transformXML(paths.xml, schema, { recordPath: 'records.record' });
  } else {
    throw new Error(`Unknown format "${format}"`);
  }

  const totalTime = performance.now() - start;
  const memAfter = memSnapshot();
  const memDelta = memDeltaMB(memBefore, memAfter);

  const parseMs = Number(result.metrics.perfMark.parseTime || 0);
  const validateMs = Number(result.metrics.perfMark.validateTime || 0);
  const formatMs = Number(result.metrics.perfMark.formatTime || 0);

  return {
    format,
    parse_time_ms: parseMs,
    transform_time_ms: validateMs + formatMs,
    memory_mb: memDelta.rssMB,
    total_time_ms: Number(result.metrics.perfMark.totalTime || totalTime),
    aux: {
      rss_delta_mb: memDelta.rssMB,
      heap_used_delta_mb: memDelta.heapUsedMB,
      records: result.metrics.recordsProcessed,
      records_success: result.metrics.recordsSuccessful,
      errors: result.metrics.errorsDetected.length,
      warnings: result.metrics.warningsDetected.length
    }
  };
}

function toCsvRow(values) {
  return values.join(',') + '\n';
}

async function run() {
  const projectRoot = path.resolve(__dirname, '../..');
  const args = parseArgs(process.argv);

  const schemaPath = path.join(projectRoot, 'research', 'datasets', 'schemas', 'employee_10.json');
  const schema = readJson(schemaPath);

  const paths = {
    json: path.join(projectRoot, 'research', 'datasets', 'data', 'format1000.json'),
    csv: path.join(projectRoot, 'research', 'datasets', 'data', 'format1000.csv'),
    xml: path.join(projectRoot, 'research', 'datasets', 'data', 'format1000.xml')
  };

  const outCsv = path.join(
    projectRoot,
    args.outCsv || path.join('research', 'data', 'format-comparison.csv')
  );

  const outJson = path.join(
    projectRoot,
    args.outJson || path.join('research', 'data', 'format-comparison-runs.json')
  );

  ensureDir(path.dirname(outCsv));
  ensureDir(path.dirname(outJson));

  if (args.preflight) {
    const records = readJson(paths.json);
    const pf = preflightValidate(records, schema);
    if (pf.errors > 0 || pf.warnings > 0) {
      throw new Error(`Preflight failed: errors=${pf.errors}, warnings=${pf.warnings}. Fix dataset or run with --no-preflight.`);
    }
  }

  // Reproducible rewrite
  fs.writeFileSync(outCsv, 'format,parse_time_ms,transform_time_ms,memory_mb,total_time_ms\n', 'utf-8');

  const runs = [];
  const formats = ['json', 'csv', 'xml'];

  for (let t = 1; t <= args.trials; t++) {
    console.log(`\n=== Trial ${t}/${args.trials} ===`);
    for (const f of formats) {
      const r = await runOne(f, paths, schema);
      runs.push({ trial: t, ...r });

      console.log(
        `${f.toUpperCase()}: parse=${r.parse_time_ms.toFixed(3)}ms transform=${r.transform_time_ms.toFixed(3)}ms total=${r.total_time_ms.toFixed(3)}ms mem(rssΔ)=${r.memory_mb.toFixed(3)}MB`
      );

      fs.appendFileSync(
        outCsv,
        toCsvRow([
          r.format,
          r.parse_time_ms.toFixed(3),
          r.transform_time_ms.toFixed(3),
          r.memory_mb.toFixed(3),
          r.total_time_ms.toFixed(3)
        ]),
        'utf-8'
      );
    }
  }

  fs.writeFileSync(outJson, JSON.stringify(runs, null, 2) + '\n', 'utf-8');

  console.log(`\n✓ Wrote: ${path.relative(projectRoot, outCsv)}`);
  console.log(`��� Wrote: ${path.relative(projectRoot, outJson)}`);
  if (typeof global.gc !== 'function') {
    console.log('Note: run with node --expose-gc for more stable memory measurements.');
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
