/**
 * Phase 4: XML Variant Generator
 *
 * Roadmap mapping (PHASE 4: XML Parser):
 * - Test transformXML() with 2 XML structures:
 *   1) Flat XML where tags match sourceKey (records.record)
 *   2) Nested XML with attributes + nested elements (Employees.Employee)
 *
 * Methodological goal:
 * - Keep semantic content identical to medium.json while varying XML structure,
 *   so we can evaluate mapping robustness without changing the dataset itself.
 *
 * Usage:
 *   node research/scripts/generateXmlVariants.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function xmlEscape(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function indent(n) {
  return ' '.repeat(n);
}

function tag(name, content, ind) {
  return `${indent(ind)}<${name}>${xmlEscape(content)}</${name}>`;
}

function buildFlatXml(records) {
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<records>');

  for (const r of records) {
    lines.push('  <record>');
    lines.push(tag('emp_id', r.emp_id, 4));
    lines.push(tag('name', r.name, 4));
    lines.push(tag('dept', r.dept, 4));
    lines.push(tag('hire_date', r.hire_date, 4));
    lines.push(tag('salary', r.salary, 4));
    lines.push(tag('phone', r.phone, 4));
    lines.push(tag('email', r.email, 4));
    lines.push(tag('state', r.state, 4));
    lines.push(tag('bonus', r.bonus, 4));
    lines.push(tag('active', r.active, 4));
    lines.push('  </record>');
  }

  lines.push('</records>');
  return lines.join('\n') + '\n';
}

function buildNestedXml(records) {
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<Employees>');

  for (const r of records) {
    // attributes: id + active
    lines.push(
      `  <Employee id="${xmlEscape(r.emp_id)}" active="${xmlEscape(r.active)}">`
    );

    // nested elements
    lines.push(tag('Name', r.name, 4));

    // Dept as empty element with attribute
    lines.push(`    <Dept code="${xmlEscape(r.dept)}" />`);

    lines.push('    <Hire>');
    lines.push(tag('Date', r.hire_date, 6));
    lines.push('    </Hire>');

    lines.push('    <Comp>');
    lines.push(tag('Salary', r.salary, 6));
    lines.push(tag('Bonus', r.bonus, 6));
    lines.push('    </Comp>');

    lines.push('    <Contact>');
    lines.push(tag('Phone', r.phone, 6));
    lines.push(tag('Email', r.email, 6));
    lines.push(tag('State', r.state, 6));
    lines.push('    </Contact>');

    lines.push('  </Employee>');
  }

  lines.push('</Employees>');
  return lines.join('\n') + '\n';
}

function run() {
  const projectRoot = path.resolve(__dirname, '../..');
  const dataDir = path.join(projectRoot, 'research', 'datasets', 'data');

  const records = readJson(path.join(dataDir, 'medium.json'));

  const flatXml = buildFlatXml(records);
  const nestedXml = buildNestedXml(records);

  fs.writeFileSync(path.join(dataDir, 'medium_flat.xml'), flatXml, 'utf-8');
  fs.writeFileSync(path.join(dataDir, 'medium_nested.xml'), nestedXml, 'utf-8');

  console.log('✓ Wrote XML variants:');
  console.log('- research/datasets/data/medium_flat.xml');
  console.log('- research/datasets/data/medium_nested.xml');
}

run();
