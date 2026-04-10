/**
 * Phase 2 Diagnostics Dumper
 *
 * Purpose:
 * The transform-metrics.csv gives aggregate counts (errors/warnings),
 * but for research (RQ3: error detection) we need an auditable artifact
 * explaining WHAT the errors/warnings were.
 *
 * Output:
 * - research/data/phase2-diagnostics.json
 *
 * Usage:
 *   node research/scripts/dumpPhase2Diagnostics.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { transform } = require('../../backend/services/transformer');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Categorize a message into a rough bucket so we can explain warning spikes.
 * This is heuristic but good enough for research reporting.
 */
function categorizeMessage(msg) {
  const m = String(msg).toLowerCase();
  if (m.includes('overflow')) return 'overflow';
  if (m.includes('truncation') || m.includes('truncated')) return 'truncation';
  if (m.includes('rounding')) return 'rounding';
  if (m.includes('newline')) return 'newline';
  if (m.includes('missing') && m.includes('defaulting')) return 'missing_default';
  if (m.includes('required') && m.includes('missing')) return 'missing_required';
  if (m.includes('expected') && m.includes('got')) return 'type_mismatch';
  return 'other';
}

function flattenDetected(detectedArray) {
  // detectedArray shape: [{ record: idx, errors|warnings: [...] }, ...]
  const flat = [];
  for (const entry of detectedArray || []) {
    const record = entry.record;
    const list = entry.errors || entry.warnings || [];
    for (const msg of list) {
      flat.push({ record, msg });
    }
  }
  return flat;
}

function summarizeDetected(flatList, maxSamples) {
  const countsByCategory = {};
  for (const item of flatList) {
    const cat = categorizeMessage(item.msg);
    countsByCategory[cat] = (countsByCategory[cat] || 0) + 1;
  }

  return {
    total: flatList.length,
    countsByCategory,
    samples: flatList.slice(0, maxSamples)
  };
}

function run() {
  const projectRoot = path.resolve(__dirname, '../..');

  const datasetsDir = path.join(projectRoot, 'research', 'datasets', 'data');
  const schemasDir = path.join(projectRoot, 'research', 'datasets', 'schemas');
  const outPath = path.join(projectRoot, 'research', 'data', 'phase2-diagnostics.json');

  ensureDir(path.dirname(outPath));

  const cases = [
    {
      dataset: 'small',
      dataPath: path.join(datasetsDir, 'small.json'),
      schemaPath: path.join(schemasDir, 'employee_5.json')
    },
    {
      dataset: 'medium',
      dataPath: path.join(datasetsDir, 'medium.json'),
      schemaPath: path.join(schemasDir, 'employee_10.json')
    },
    {
      dataset: 'large',
      dataPath: path.join(datasetsDir, 'large.json'),
      schemaPath: path.join(schemasDir, 'employee_15.json')
    },
    {
      dataset: 'edge',
      dataPath: path.join(datasetsDir, 'edge.json'),
      schemaPath: path.join(schemasDir, 'employee_10.json')
    },
    {
      dataset: 'invalid',
      dataPath: path.join(datasetsDir, 'invalid.json'),
      schemaPath: path.join(schemasDir, 'employee_5.json')
    }
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    phase: 'PHASE 2',
    cases: []
  };

  for (const c of cases) {
    const data = readJson(c.dataPath);
    const schema = readJson(c.schemaPath);

    const result = transform(data, schema, 'json');
    const m = result.metrics;

    const flatErrors = flattenDetected(m.errorsDetected);
    const flatWarnings = flattenDetected(m.warningsDetected);

    report.cases.push({
      dataset: c.dataset,
      recordsProcessed: m.recordsProcessed,
      recordsSuccessful: m.recordsSuccessful,
      fieldCount: m.fieldCount,
      durationMs: m.durationMs,
      recordsPerSec: m.recordsPerSec,
      truncations: m.truncations,
      perfMark: m.perfMark,

      errorsSummary: summarizeDetected(flatErrors, 25),
      warningsSummary: summarizeDetected(flatWarnings, 25)
    });
  }

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`✓ Wrote diagnostics: ${path.relative(projectRoot, outPath)}`);
}

run();
