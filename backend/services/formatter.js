/**
 * Field Formatter (Phase 2)
 *
 * Purpose:
 * Convert individual field values into COBOL "DISPLAY" fixed-width strings
 * that exactly match the length derived from the PIC clause.
 *
 * Roadmap mapping:
 * - Implements formatField(value, fieldDef)
 * - Numeric: left-pad with '0', detect overflow
 * - Alphanumeric: right-pad with space, detect truncation
 * - Decimal: multiply by 10^decimals, remove decimal point, pad
 *
 * Design:
 * Each formatter returns:
 *  - value: string (fixed-width)
 *  - errors: string[] (hard failures)
 *  - warnings: string[] (soft issues)
 *
 * This module is pure logic (no Express / no MongoDB) so it is easy to unit test.
 */

'use strict';

function makeResult(value, errors = [], warnings = []) {
  return { value, errors, warnings };
}

function leftPad(s, length, padChar) {
  return s.padStart(length, padChar);
}

function rightPad(s, length, padChar) {
  return s.padEnd(length, padChar);
}

/**
 * Format numeric PIC 9(n) as fixed-width digits.
 * - Left pad with '0'
 * - Reject negatives (unsigned for now)
 */
function formatNumeric(rawValue, length) {
  const errors = [];
  const warnings = [];

  if (rawValue === null || rawValue === undefined || rawValue === '') {
    warnings.push('Numeric field missing; defaulting to 0');
    rawValue = 0;
  }

  const asString = String(rawValue).trim();

  if (!/^-?\d+$/.test(asString)) {
    errors.push(`Expected numeric digits, got "${asString}"`);
    return makeResult('0'.repeat(length), errors, warnings);
  }

  if (asString.startsWith('-')) {
    errors.push(`Negative numbers not supported for unsigned PIC 9(n): "${asString}"`);
    return makeResult('0'.repeat(length), errors, warnings);
  }

  const normalized = asString.replace(/^0+(?=\d)/, '');

  if (normalized.length > length) {
    errors.push(`Overflow: "${asString}" exceeds max digits for length ${length}`);
    return makeResult('9'.repeat(length), errors, warnings);
  }

  const padded = leftPad(normalized, length, '0');
  return makeResult(padded, errors, warnings);
}

/**
 * Format alphanumeric PIC X(n) / alphabetic PIC A(n) as fixed-width text.
 * - Right pad with spaces
 * - Truncate if too long (warning)
 */
function formatAlphanumeric(rawValue, length) {
  const errors = [];
  const warnings = [];

  if (rawValue === null || rawValue === undefined) {
    rawValue = '';
  }

  let s = String(rawValue);

  if (s.includes('\n') || s.includes('\r')) {
    warnings.push('Newline characters removed from text field');
    s = s.replace(/[\r\n]+/g, ' ');
  }

  if (s.length > length) {
    warnings.push(`Truncation: text length ${s.length} exceeds ${length}; truncating`);
    s = s.slice(0, length);
  }

  const padded = rightPad(s, length, ' ');
  return makeResult(padded, errors, warnings);
}

/**
 * Format decimal PIC 9(n)V.. as fixed-width digits with implied decimal point.
 * Strategy:
 * - Multiply by 10^decimals
 * - Round to nearest integer
 * - Left pad with '0'
 * - Overflow if digit count exceeds total length
 */
function formatDecimal(rawValue, length, decimals) {
  const errors = [];
  const warnings = [];

  if (decimals === null || decimals === undefined) {
    decimals = 0;
  }

  if (!Number.isInteger(decimals) || decimals < 0) {
    errors.push(`Invalid decimals value "${decimals}" (must be integer >= 0)`);
    return makeResult('0'.repeat(length), errors, warnings);
  }

  if (rawValue === null || rawValue === undefined || rawValue === '') {
    warnings.push('Decimal field missing; defaulting to 0');
    rawValue = 0;
  }

  const n = typeof rawValue === 'number' ? rawValue : Number(String(rawValue).trim());
  if (!Number.isFinite(n)) {
    errors.push(`Expected decimal number, got "${rawValue}"`);
    return makeResult('0'.repeat(length), errors, warnings);
  }

  const factor = Math.pow(10, decimals);
  const scaled = n * factor;

  const rounded = Math.round(scaled);
  if (Math.abs(rounded - scaled) > 0) {
    warnings.push(`Rounding applied: ${n} scaled to ${scaled} rounded to ${rounded}`);
  }

  if (rounded < 0) {
    errors.push(`Negative decimals not supported yet: "${n}"`);
    return makeResult('0'.repeat(length), errors, warnings);
  }

  const digits = String(rounded);

  if (digits.length > length) {
    errors.push(`Overflow: "${n}" requires ${digits.length} digits but field length is ${length}`);
    return makeResult('9'.repeat(length), errors, warnings);
  }

  const padded = leftPad(digits, length, '0');
  return makeResult(padded, errors, warnings);
}

/**
 * Dispatcher: format a value based on the schema field definition.
 */
function formatField(rawValue, fieldDef) {
  if (!fieldDef || typeof fieldDef !== 'object') {
    return makeResult('', ['Invalid field definition'], []);
  }

  const length = fieldDef.length;
  if (!Number.isInteger(length) || length <= 0) {
    return makeResult('', [`Invalid field length "${length}" for ${fieldDef.name || 'unknown field'}`], []);
  }

  const type = fieldDef.type;

  if (type === 'numeric' || type === 'signed') {
    return formatNumeric(rawValue, length);
  }

  if (type === 'decimal') {
    return formatDecimal(rawValue, length, fieldDef.decimals || 0);
  }

  if (type === 'alphanumeric' || type === 'alphabetic') {
    return formatAlphanumeric(rawValue, length);
  }

  return makeResult(
    ' '.repeat(length),
    [`Unsupported field type "${type}" for ${fieldDef.name || 'unknown field'}`],
    []
  );
}

module.exports = {
  formatNumeric,
  formatAlphanumeric,
  formatDecimal,
  formatField
};
