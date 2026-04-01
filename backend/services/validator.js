/**
 * Record Validator (Phase 2)
 *
 * Purpose:
 * Validate a single input record against an FD schema BEFORE transformation.
 *
 * Roadmap mapping (Phase 2: Validation Layer):
 * - Type checking (string vs number)
 * - Length checking (pre-truncation detection)
 * - Required field checking
 * - Return error array (plus warnings)
 *
 * This module is pure logic (no Express / no MongoDB) so it is easy to unit test.
 */

'use strict';

/**
 * Standard validation result.
 * @param {boolean} isValid
 * @param {string[]} errors
 * @param {string[]} warnings
 */
function makeValidationResult(isValid, errors = [], warnings = []) {
  return { isValid, errors, warnings };
}

/**
 * Define "missing" for our input records.
 * Empty string counts as missing because it can't represent a numeric value reliably.
 */
function isMissing(value) {
  return value === undefined || value === null || value === '';
}

/**
 * Detect numeric strings (supports integers and decimals).
 * Examples:
 * - "123"     → true
 * - "00123"   → true
 * - "12.50"   �� true
 * - "  -7  "  → true (but we may reject negatives later depending on type)
 * - "ABC"     → false
 */
function isNumericString(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  return /^-?\d+(\.\d+)?$/.test(t);
}

/**
 * Validate a single record against the schema.
 *
 * @param {Object} record - One input record (e.g., one JSON object from array)
 * @param {Object} fdSchema - Schema document containing `fields[]`
 * @param {number|null} recordIndex - Optional index for better error messages
 *
 * @returns {{ isValid: boolean, errors: string[], warnings: string[] }}
 */
function validateRecord(record, fdSchema, recordIndex = null) {
  const errors = [];
  const warnings = [];

  // ========== BASIC INPUT VALIDATION ==========
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return makeValidationResult(false, ['Record must be an object'], []);
  }

  if (!fdSchema || typeof fdSchema !== 'object') {
    return makeValidationResult(false, ['Schema is missing or invalid'], []);
  }

  if (!Array.isArray(fdSchema.fields) || fdSchema.fields.length === 0) {
    return makeValidationResult(false, ['Schema has no fields'], []);
  }

  const prefix = recordIndex === null ? 'Record' : `Record ${recordIndex}`;

  // ========== FIELD-BY-FIELD VALIDATION ==========
  for (const field of fdSchema.fields) {
    const fieldName = field.name || 'UNKNOWN_FIELD';
    const key = field.sourceKey || fieldName.toLowerCase();
    const value = record[key];

    // 1) REQUIRED FIELD CHECK
    if (field.required === true && isMissing(value)) {
      errors.push(`${prefix}: Field "${fieldName}" (key "${key}") is required but missing`);
      // If required is missing, no need to do further checks for this field.
      continue;
    }

    // If not required and missing, skip type/overflow checks.
    if (isMissing(value)) {
      continue;
    }

    // 2) TYPE CHECKING + OVERFLOW CHECKING
    const type = field.type;
    const length = field.length;
    const decimals = field.decimals || 0;

    // Defensive: length should exist by Phase 2 (from Phase 1 PIC parser/hook)
    if (!Number.isInteger(length) || length <= 0) {
      errors.push(`${prefix}: Field "${fieldName}" has invalid schema length "${length}"`);
      continue;
    }

    if (type === 'numeric' || type === 'signed') {
      // Accept numbers or numeric strings
      const numStr = typeof value === 'number' ? String(Math.trunc(value)) : String(value).trim();

      if (typeof value !== 'number' && !isNumericString(String(value))) {
        errors.push(`${prefix}: Field "${fieldName}" expected numeric, got "${value}"`);
        continue;
      }

      // Phase 2: reject negatives (signed support later)
      if (String(value).trim().startsWith('-')) {
        errors.push(`${prefix}: Field "${fieldName}" negative numbers not supported in Phase 2 ("${value}")`);
        continue;
      }

      // Overflow check by digit count (ignore leading zeros)
      const normalized = numStr.replace(/^0+(?=\d)/, '');
      if (normalized.length > length) {
        errors.push(`${prefix}: Field "${fieldName}" overflow: "${value}" exceeds ${length} digits`);
      }
      continue;
    }

    if (type === 'decimal') {
      // Decimal must be number or numeric string
      if (typeof value !== 'number' && !isNumericString(String(value))) {
        errors.push(`${prefix}: Field "${fieldName}" expected decimal number, got "${value}"`);
        continue;
      }

      // Phase 2: reject negatives
      if (String(value).trim().startsWith('-')) {
        errors.push(`${prefix}: Field "${fieldName}" negative decimals not supported in Phase 2 ("${value}")`);
        continue;
      }

      if (!Number.isInteger(decimals) || decimals < 0) {
        errors.push(`${prefix}: Field "${fieldName}" has invalid schema decimals "${decimals}"`);
        continue;
      }

      // Overflow check AFTER scaling by decimals
      const n = typeof value === 'number' ? value : Number(String(value).trim());
      const factor = Math.pow(10, decimals);
      const scaled = Math.round(n * factor);

      const digits = String(scaled);
      if (digits.length > length) {
        errors.push(
          `${prefix}: Field "${fieldName}" overflow: "${value}" scaled to ${scaled} requires ${digits.length} digits but length is ${length}`
        );
      }

      // Warning if rounding occurred (helps "real-time error detection" and metrics)
      if (Math.abs(scaled - (n * factor)) > 0) {
        warnings.push(`${prefix}: Field "${fieldName}" rounding will occur for value "${value}" with decimals=${decimals}`);
      }

      continue;
    }

    if (type === 'alphanumeric' || type === 'alphabetic') {
      // Convertable-to-string values are fine; we mainly care about truncation warnings.
      const s = String(value);

      if (s.length > length) {
        warnings.push(
          `${prefix}: Field "${fieldName}" will be truncated from ${s.length} to ${length} characters`
        );
      }

      // Optional strict alphabetic check for PIC A(n)
      if (type === 'alphabetic') {
        if (!/^[A-Za-z ]*$/.test(s)) {
          warnings.push(`${prefix}: Field "${fieldName}" is alphabetic but contains non-letter characters`);
        }
      }

      continue;
    }

    // Unknown type = schema issue; treat as error
    errors.push(`${prefix}: Field "${fieldName}" has unsupported type "${type}"`);
  }

  return makeValidationResult(errors.length === 0, errors, warnings);
}

module.exports = {
  validateRecord
};
