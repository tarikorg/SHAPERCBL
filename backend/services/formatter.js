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
 * Convert a raw decimal input into a base-10 "scaled digits" string representing
 * an implied-decimal COBOL value (PIC ...V...).
 *
 * Example: raw="131200.86", decimals=2 => { digits: "13120086", rounding: false }
 * Example: raw="58000.1234", decimals=2 => { digits: "5800012", rounding: true }  (extra digits discarded)
 *
 * This is intentionally string-based to avoid IEEE-754 floating point artifacts.
 */
function scaleDecimalString(rawValue, decimals) {
  const errors = [];
  const warnings = [];

  if (rawValue === null || rawValue === undefined || rawValue === '') {
    warnings.push('Decimal field missing; defaulting to 0');
    rawValue = '0';
  }

  const s = String(rawValue).trim();

  // Scientific notation is not supported (e.g., "1.23e5").
  // This keeps behavior aligned with validator expectations and avoids ambiguity.
  if (/[eE]/.test(s)) {
    errors.push(`Expected decimal number, got "${rawValue}"`);
    return { digits: '0', errors, warnings, rounding: false };
  }

  // Only digits with optional single decimal point; optional leading "+" allowed.
  // (We still reject negatives in Phase 2 below.)
  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) {
    errors.push(`Expected decimal number, got "${rawValue}"`);
    return { digits: '0', errors, warnings, rounding: false };
  }

  if (s.startsWith('-')) {
    errors.push(`Negative decimals not supported yet: "${s}"`);
    return { digits: '0', errors, warnings, rounding: false };
  }

  const unsigned = s.startsWith('+') ? s.slice(1) : s;
  const [intPartRaw, fracPartRaw = ''] = unsigned.split('.');

  const intPart = intPartRaw.replace(/^0+(?=\d)/, '') || '0';
  let fracPart = fracPartRaw;

  // Determine whether we are discarding any non-zero fractional digits beyond schema precision.
  let rounding = false;
  if (fracPart.length > decimals) {
    const extra = fracPart.slice(decimals);
    rounding = /[1-9]/.test(extra);
    fracPart = fracPart.slice(0, decimals);
  }

  // Right-pad fractional part to the required implied decimals.
  if (fracPart.length < decimals) {
    fracPart = fracPart.padEnd(decimals, '0');
  }

  const digits = (intPart + fracPart).replace(/^0+(?=\d)/, '') || '0';
  return { digits, errors, warnings, rounding };
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

  const scaled = scaleDecimalString(rawValue, decimals);
  errors.push(...scaled.errors);
  warnings.push(...scaled.warnings);

  if (scaled.errors.length > 0) {
    return makeResult('0'.repeat(length), errors, warnings);
  }

  // Warn only when rounding is REAL (extra fractional digits beyond schema had non-zero values).
  if (scaled.rounding) {
    warnings.push(
      `Rounding applied: "${String(rawValue).trim()}" truncated to ${decimals} decimals for PIC implied-decimal formatting`
    );
  }

  if (scaled.digits.startsWith('-')) {
    // Defensive: should never happen because scaleDecimalString rejects negatives.
    errors.push(`Negative decimals not supported yet: "${scaled.digits}"`);
    return makeResult('0'.repeat(length), errors, warnings);
  }

  if (scaled.digits.length > length) {
    errors.push(
      `Overflow: "${String(rawValue).trim()}" requires ${scaled.digits.length} digits but field length is ${length}`
    );
    return makeResult('9'.repeat(length), errors, warnings);
  }

  const padded = leftPad(scaled.digits, length, '0');
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
