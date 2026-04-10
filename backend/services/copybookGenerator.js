/*
GOAL HEADER EXPLAINING PHASE3 COPYBOOK GENERATOR
PREVENT SILENT JS MISTAKES IN CODE GEN
HELPER FUNCTIONS: UTILITY ALIGHNMENT , SANITIZECOBOL NAME
VALIDATE INPUT, BUILD LINES ARRAY, RETURN JOINED STRING
*/
/**
 * Copybook Generator (Phase 3)
 *
 * Roadmap mapping (PHASE 3: Copybook Generator):
 * - Auto-generate COBOL copybooks from fdSchema
 * - Output should be usable by GnuCOBOL via COPY "NAME.cpy".
 *
 * Output format example:
 *        01  EMPLOYEE.
 *            05  EMP-ID              PIC 9(5).
 *            05  NAME                PIC X(20).
 */

'use strict';

/**
 * COBOL identifiers commonly allow A-Z, 0-9, and hyphen.
 * They should not start with a digit.
 * For safety, we:
 * - trim
 * - uppercase
 * - replace invalid chars with hyphen
 * - prefix with 'F-' if it starts with a digit
 */
function sanitizeCobolName(name) {
  const raw = String(name || '').trim();
  if (!raw) return 'UNNAMED';

  let out = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '-');
  if (/^\d/.test(out)) out = `F-${out}`;
  // Collapse multiple hyphens
  out = out.replace(/-+/g, '-');
  return out;
}

/**
 * Pad a string to a fixed width for readable copybooks.
 */
function padTo(s, width) {
  return String(s).padEnd(width, ' ');
}

/**
 * Generate COBOL copybook text from an fdSchema.
 *
 * @param {Object} fdSchema - schema with { name, fields[] }
 * @param {Object} [options]
 * @param {number} [options.level01Indent=7] - spaces before "01"
 * @param {number} [options.level05Indent=11] - spaces before "05"
 * @param {number} [options.nameColumnWidth=20] - width used for aligned field names
 * @param {boolean} [options.includeComments=true] - include field description as comment lines
 *
 * @returns {string} Copybook content
 */
function generateCopybook(fdSchema, options = {}) {
  const {
    level01Indent = 7,
    level05Indent = 11,
    nameColumnWidth = 20,
    includeComments = true
  } = options;

  if (!fdSchema || typeof fdSchema !== 'object') {
    throw new Error('generateCopybook: fdSchema is required');
  }

  if (!Array.isArray(fdSchema.fields) || fdSchema.fields.length === 0) {
    throw new Error('generateCopybook: fdSchema.fields must be a non-empty array');
  }

  const groupName = sanitizeCobolName(fdSchema.name || 'RECORD');

  const lines = [];

  // 01-level record group
  lines.push(`${' '.repeat(level01Indent)}01  ${groupName}.`);

  // 05-level fields
  for (const field of fdSchema.fields) {
    const fieldName = sanitizeCobolName(field.name);
    const pic = String(field.picClause || '').trim();

    if (!pic) {
      throw new Error(`generateCopybook: field "${fieldName}" missing picClause`);
    }

    if (includeComments && field.description) {
      // COBOL comment line: "*" in column 7 is common style; keep it simple here.
      lines.push(`${' '.repeat(level01Indent)}* ${String(field.description).trim()}`);
    }

    lines.push(
      `${' '.repeat(level05Indent)}05  ${padTo(fieldName, nameColumnWidth)} PIC ${pic}.`
    );
  }

  return lines.join('\n');
}

module.exports = {
  generateCopybook
};
