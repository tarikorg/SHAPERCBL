/**
 * Phase 4: XML Variant Transformation Test Runner
 *
 * Roadmap mapping (PHASE 4: XML Parser):
 * - Test transformXML() with 2 XML structures:
 *   1) Flat: <records><record>...</record></records> (recordPath "records.record")
 *   2) Nested: <Employees><Employee ...>...</Employee></Employees> (recordPath "Employees.Employee")
 *      - Uses schema field.xmlPath for nested mapping and attribute extraction.
 *
 * This runner:
 * - Executes transformXML for each variant
 * - Writes fixed-width output (.dat) into examples/outputs/
 * - Logs parse/validate/format timing
 * - Writes a reproducible metrics artifact:
 *   research/data/xml-variant-results.csv
 *
 * Usage:
 *   node research/scripts/testXmlTransform.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const { transformXML } = require('../../backend/services/xmlTransformer');

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

  const dataDir = path.join(projectRoot, 'research', 'datasets', 'data');
  const schemaDir = path.join(projectRoot, 'research', 'datasets', 'schemas');
  const outDir = path.join(projectRoot, 'examples', 'outputs');

  const flatSchema = readJson(path.join(schemaDir, 'employee_10.json'));
  const nestedSchema = readJson(path.join(schemaDir, 'employee_10_xml_nested.json'));

  const resultsCsvPath = path.join(projectRoot, 'research', 'data', 'xml-variant-results.csv');

  ensureDir(outDir);
  ensureDir(path.dirname(resultsCsvPath));

  // Reproducible output
  fs.writeFileSync(
    resultsCsvPath,
    'variant,record_path,records,fields,parse_ms,validate_ms,format_ms,total_ms,errors,warnings,records_per_sec\n',
    'utf-8'
  );

  const cases = [
    {
      variant: 'medium_flat_xml',
      xmlPath: path.join(dataDir, 'medium_flat.xml'),
      schema: flatSchema,
      recordPath: 'records.record',
      outputPath: path.join(outDir, 'medium_flat_xml.dat')
    },
    {
      variant: 'medium_nested_xml',
      xmlPath: path.join(dataDir, 'medium_nested.xml'),
      schema: nestedSchema,
      recordPath: 'Employees.Employee',
      outputPath: path.join(outDir, 'medium_nested_xml.dat')
    }
  ];

  for (const c of cases) {
    console.log(`\n=== XML variant: ${c.variant} ===`);
    console.log(`Input: ${path.relative(projectRoot, c.xmlPath)}`);
    console.log(`RecordPath: ${c.recordPath}`);

    const start = performance.now();
    const result = await transformXML(c.xmlPath, c.schema, { recordPath: c.recordPath });
    const wallTotal = performance.now() - start;

    fs.writeFileSync(c.outputPath, result.output ? result.output + '\n' : '', 'utf-8');

    const m = result.metrics;

    console.log(`Records: processed=${m.recordsProcessed}, successful=${m.recordsSuccessful}`);
    console.log(`Errors: ${m.errorsDetected.length}, Warnings: ${m.warningsDetected.length}`);
    console.log(
      `Timing(ms): parse=${m.perfMark.parseTime.toFixed(3)}, validate=${m.perfMark.validateTime.toFixed(3)}, format=${m.perfMark.formatTime.toFixed(3)}, total=${m.perfMark.totalTime.toFixed(3)} (wall=${wallTotal.toFixed(3)})`
    );
    console.log(`Output: ${path.relative(projectRoot, c.outputPath)}`);

    const row = toCsvRow([
      c.variant,
      JSON.stringify(c.recordPath),
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
  }

  console.log(`\n✓ Wrote results: ${path.relative(projectRoot, resultsCsvPath)}`);
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
