/**
 * Phase 4: Format Comparison Dataset Generator (1000 records, 10 fields)
 *
 * Roadmap mapping (PHASE 4: Format Performance Comparison):
 * - Create identical dataset in 3 formats (JSON, CSV, XML) with 1000 records
 * - Dataset is deterministic and valid-by-construction to avoid benchmark corruption.
 *
 * Outputs:
 * - research/datasets/data/format1000.json
 * - research/datasets/data/format1000.csv
 * - research/datasets/data/format1000.xml   (flat: records.record)
 *
 * Usage:
 *   node research/scripts/generateFormatComparisonDatasets.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

function xmlEscape(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeCsvField(value, delimiter = ',') {
  if (value === null || value === undefined) return '';
  const s = String(value);
  const mustQuote =
    s.includes(delimiter) || s.includes('"') || s.includes('\n') || s.includes('\r');
  if (!mustQuote) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

function writeCsv(records, outPath, headerOrder) {
  const lines = [];
  lines.push(headerOrder.join(','));
  for (const r of records) {
    lines.push(headerOrder.map(k => escapeCsvField(r[k], ',')).join(','));
  }
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf-8');
}

function writeFlatXml(records, outPath) {
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<records>');

  for (const r of records) {
    lines.push('  <record>');
    for (const [k, v] of Object.entries(r)) {
      lines.push(`    <${k}>${xmlEscape(v)}</${k}>`);
    }
    lines.push('  </record>');
  }

  lines.push('</records>');
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf-8');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Deterministic generator for 1000 employee-like records (10 fields).
 * Values are kept within PIC constraints for employee_10 schema:
 * - emp_id fits 9(5)
 * - dept fits X(10)
 * - hire_date fits 9(8)
 * - salary fits 9(7)V99
 * - bonus fits 9(5)V99
 * - active fits X(1)
 */
function generateRecords(count) {
  const firstNames = ['Alice', 'Bob', 'Carol', 'David', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'];
  const lastNames = ['Johnson', 'Smith', 'White', 'Lee', 'Black', 'Green', 'Kim', 'Zhou', 'Patel', 'Brown'];

  const depts = ['HR', 'FIN', 'IT', 'OPS', 'SALES', 'LEGAL', 'MKT', 'RISK'];
  const states = ['CA', 'NY', 'TX', 'FL', 'WA', 'IL', 'MA', 'NJ'];

  const records = [];
  for (let i = 1; i <= count; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[i % lastNames.length];
    const name = `${fn} ${ln}`; // <= 20 for these names

    const dept = depts[i % depts.length]; // short, <= 10
    const state = states[i % states.length];

    // Deterministic hire date in 2024, cycles months/days safely
    const month = (i % 12) + 1;
    const day = (i % 28) + 1;
    const hire_date = `2024${pad2(month)}${pad2(day)}`; // 8 digits

    // salary within 0..9,999,999.99 ; use bounded range ~ 45k..145k with cents
    const salary = (45000 + (i % 1000) * 100 + (i % 97) / 100).toFixed(2);

    // bonus within 0..99,999.99 ; bounded ~ 0..9,999.99
    const bonus = ((i % 10000) / 100).toFixed(2);

    const phone = `555${String(i).padStart(7, '0')}`; // 10 digits
    const email = `user${i}@example.com`; // fits X(25) for i up to 1000
    const active = i % 2 === 0 ? 'Y' : 'N';

    records.push({
      emp_id: i,
      name,
      dept,
      hire_date,
      salary,
      phone,
      email,
      state,
      bonus,
      active
    });
  }

  return records;
}

function run() {
  const projectRoot = path.resolve(__dirname, '../..');
  const outDir = path.join(projectRoot, 'research', 'datasets', 'data');

  const records = generateRecords(1000);

  const jsonPath = path.join(outDir, 'format1000.json');
  const csvPath = path.join(outDir, 'format1000.csv');
  const xmlPath = path.join(outDir, 'format1000.xml');

  fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2) + '\n', 'utf-8');

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
  writeCsv(records, csvPath, headerOrder);
  writeFlatXml(records, xmlPath);

  console.log('✓ Wrote format comparison datasets:');
  console.log('- research/datasets/data/format1000.json');
  console.log('- research/datasets/data/format1000.csv');
  console.log('- research/datasets/data/format1000.xml');
}

run();
