/*
This script will:

    generate:
        medium.json (100 records)
        large.json (1000 records)
        edge.json (special chars/unicode/decimals)
        invalid.json (intentional failures)
    and generate matching schema JSONs:
        employee_10.json (10 fields)
        employee_15.json (15 fields)
        edge/invalid can reuse one of these schemas depending on what we want to test
*/
/**
 * Phase 2 Dataset Generator
 *
 * Roadmap mapping (Phase 2: Test Datasets):
 * - Create 5 datasets in research/datasets/:
 *   1) small: 10 records, 5 fields
 *   2) medium: 100 records, 10 fields
 *   3) large: 1000 records, 15 fields
 *   4) edge: special chars, unicode, decimals
 *   5) invalid: wrong types, missing fields, overflows
 *
 * This script generates the datasets and matching schema JSON fixtures
 * so experiments are reproducible for the research paper.
 *
 * Usage:
 *   node research/scripts/generatePhase2Datasets.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeJsonIfMissing(filePath, obj) {
  if (fs.existsSync(filePath)) {
    console.log(`- Skipping (already exists): ${filePath}`);
    return;
  }
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8');
  console.log(`✓ Wrote: ${filePath}`);
}

function buildEmployeeSchema5() {
  return {
    name: 'EMPLOYEE',
    description: 'Employee dataset schema (5 fields) for Phase 2 benchmarking',
    fields: [
      { name: 'EMP_ID', picClause: '9(5)', type: 'numeric', length: 5, sourceKey: 'emp_id', required: true },
      { name: 'NAME', picClause: 'X(20)', type: 'alphanumeric', length: 20, sourceKey: 'name', required: true },
      { name: 'DEPT', picClause: 'X(10)', type: 'alphanumeric', length: 10, sourceKey: 'dept', required: true },
      { name: 'HIRE_DATE', picClause: '9(8)', type: 'numeric', length: 8, sourceKey: 'hire_date', required: true },
      { name: 'SALARY', picClause: '9(7)V99', type: 'decimal', length: 9, decimals: 2, sourceKey: 'salary', required: true }
    ]
  };
}

function buildEmployeeSchema10() {
  const base = buildEmployeeSchema5();
  return {
    ...base,
    description: 'Employee dataset schema (10 fields) for Phase 2 benchmarking',
    fields: [
      ...base.fields,
      { name: 'PHONE', picClause: '9(10)', type: 'numeric', length: 10, sourceKey: 'phone', required: true },
      { name: 'EMAIL', picClause: 'X(25)', type: 'alphanumeric', length: 25, sourceKey: 'email', required: true },
      { name: 'STATE', picClause: 'X(2)', type: 'alphanumeric', length: 2, sourceKey: 'state', required: true },
      { name: 'BONUS', picClause: '9(5)V99', type: 'decimal', length: 7, decimals: 2, sourceKey: 'bonus', required: true },
      { name: 'ACTIVE', picClause: 'X(1)', type: 'alphanumeric', length: 1, sourceKey: 'active', required: true }
    ]
  };
}

function buildEmployeeSchema15() {
  const base = buildEmployeeSchema10();
  return {
    ...base,
    description: 'Employee dataset schema (15 fields) for Phase 2 benchmarking',
    fields: [
      ...base.fields,
      { name: 'TITLE', picClause: 'X(15)', type: 'alphanumeric', length: 15, sourceKey: 'title', required: true },
      { name: 'MANAGER_ID', picClause: '9(5)', type: 'numeric', length: 5, sourceKey: 'manager_id', required: true },
      { name: 'COST_CENTER', picClause: 'X(6)', type: 'alphanumeric', length: 6, sourceKey: 'cost_center', required: true },
      { name: 'ZIP', picClause: '9(5)', type: 'numeric', length: 5, sourceKey: 'zip', required: true },
      { name: 'LAST_RAISE', picClause: '9(3)V99', type: 'decimal', length: 5, decimals: 2, sourceKey: 'last_raise', required: true }
    ]
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function buildBaseRecord(i) {
  // Deterministic, simple values (good for reproducibility)
  const empId = i + 1; // start at 1
  const hireDay = (i % 28) + 1; // 1..28
  const hireDate = Number(`202401${pad2(hireDay)}`);

  const depts = ['HR', 'IT', 'FIN', 'OPS', 'SALES'];
  const dept = depts[i % depts.length];

  const names = [
    'Alice Johnson',
    'Bob Smith',
    'Carol White',
    'David Lee',
    'Eve Black',
    'Frank Green',
    'Grace Kim',
    'Henry Zhou',
    'Ivy Patel',
    'Jack Brown'
  ];

  const name = names[i % names.length];

  const salary = 50000 + (i % 500) * 10 + ((i % 4) * 0.25); // includes decimals

  return {
    emp_id: empId,
    name,
    dept,
    hire_date: hireDate,
    salary: Number(salary.toFixed(2))
  };
}

function extendTo10Fields(rec, i) {
  const phone = Number(`555000${String(i).padStart(4, '0')}`); // 10 digits-ish
  const email = `user${i}@example.com`;
  const states = ['CA', 'NY', 'TX', 'FL', 'WA'];
  const state = states[i % states.length];
  const bonus = Number(((i % 200) * 1.25).toFixed(2));
  const active = i % 5 === 0 ? 'N' : 'Y';

  return {
    ...rec,
    phone,
    email,
    state,
    bonus,
    active
  };
}

function extendTo15Fields(rec, i) {
  const titles = ['ANALYST', 'ENGINEER', 'MANAGER', 'CLERK', 'DIRECTOR'];
  const title = titles[i % titles.length];
  const managerId = (i % 50) + 1;
  const costCenter = `CC${String(i % 9999).padStart(4, '0')}`; // length 6 max like "CC0123"
  const zip = 90000 + (i % 9999);
  const lastRaise = Number(((i % 100) * 0.15).toFixed(2));

  return {
    ...rec,
    title,
    manager_id: managerId,
    cost_center: costCenter,
    zip,
    last_raise: lastRaise
  };
}

function makeDataset(count, variant) {
  const out = [];
  for (let i = 0; i < count; i++) {
    let r = buildBaseRecord(i);
    if (variant === 10 || variant === 15) r = extendTo10Fields(r, i);
    if (variant === 15) r = extendTo15Fields(r, i);
    out.push(r);
  }
  return out;
}

function makeEdgeDataset() {
  // Reuse 10-field shape but inject edge cases intentionally
  const data = makeDataset(50, 10);

  data[0].name = "O'Connor";                 // apostrophe
  data[1].name = 'José Alvarez';             // accent
  data[2].name = '王小明';                    // CJK
  data[3].name = 'مرحبا';                    // Arabic
  data[4].name = 'Alice\nJohnson';           // newline injection (formatter should warn + replace)
  data[5].email = 'veryveryveryveryveryverylongemailaddress@example.com'; // truncation
  data[6].bonus = 12.3456;                   // rounding warning (decimals=2)
  data[7].salary = 9999999.99;               // edge max for 9(7)V99
  data[8].salary = 10000000.00;              // overflow for 9(7)V99 (invalid-ish)
  data[9].dept = 'THIS_DEPT_NAME_IS_TOO_LONG'; // truncation

  return data;
}

function makeInvalidDataset() {
  // 50 records, based on 5-field schema, with injected errors
  const data = makeDataset(50, 5);

  // Wrong type
  data[0].emp_id = 'ABC';

  // Overflow (emp_id length 5)
  data[1].emp_id = 999999;

  // Missing required
  delete data[2].dept;

  // Invalid decimal
  data[3].salary = 'not-a-number';

  // Negative decimal (unsupported in Phase 2)
  data[4].salary = -5.0;

  // Hire date overflow (8 digits ok, but here we add 9 digits)
  data[5].hire_date = 202401011;

  // Name null but required
  data[6].name = null;

  return data;
}

function run() {
  const projectRoot = path.resolve(__dirname, '../..');

  const schemasDir = path.join(projectRoot, 'research', 'datasets', 'schemas');
  const dataDir = path.join(projectRoot, 'research', 'datasets', 'data');

  ensureDir(schemasDir);
  ensureDir(dataDir);

  // Schemas
  writeJsonIfMissing(path.join(schemasDir, 'employee_5.json'), buildEmployeeSchema5());
  writeJsonIfMissing(path.join(schemasDir, 'employee_10.json'), buildEmployeeSchema10());
  writeJsonIfMissing(path.join(schemasDir, 'employee_15.json'), buildEmployeeSchema15());

  // Datasets
  // small.json likely already exists; we skip if present
  writeJsonIfMissing(path.join(dataDir, 'small.json'), makeDataset(10, 5));
  writeJsonIfMissing(path.join(dataDir, 'medium.json'), makeDataset(100, 10));
  writeJsonIfMissing(path.join(dataDir, 'large.json'), makeDataset(1000, 15));
  writeJsonIfMissing(path.join(dataDir, 'edge.json'), makeEdgeDataset());
  writeJsonIfMissing(path.join(dataDir, 'invalid.json'), makeInvalidDataset());

  console.log('\n✓ Phase 2 datasets generation completed.');
}

run();
