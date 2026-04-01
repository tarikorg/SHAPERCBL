/**
 * Manual smoke test for Phase 2 transformer (run locally, not Jest).
 * Usage:
 *   node backend/tests/manualTransformSmokeTest.js
 */

const { transform } = require('../services/transformer');

const schema = {
  fields: [
    { name: 'EMP_ID', sourceKey: 'emp_id', type: 'numeric', length: 5 },
    { name: 'NAME', sourceKey: 'name', type: 'alphanumeric', length: 10 },
    { name: 'SALARY', sourceKey: 'salary', type: 'decimal', length: 7, decimals: 2 }
  ]
};

const data = [
  { emp_id: 12, name: 'Bob', salary: 1.5 },
  { emp_id: 999999, name: 'TooBigId', salary: 2.0 } // should fail overflow
];

const result = transform(data, schema, 'json');

console.log('OUTPUT:\n' + result.output);
console.log('\nMETRICS:\n' + JSON.stringify(result.metrics, null, 2));
