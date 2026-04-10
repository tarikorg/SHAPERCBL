//copy the generated cpy
//read .dat file
// prints selected fieldsW
/**
 * COBOL Test Program Generator (Phase 3)
 *
 * Generates a minimal COBOL program that:
 * - reads a LINE SEQUENTIAL .dat file
 * - uses COPY "<SCHEMA>.cpy"
 * - DISPLAYs selected fields
 *
 * IMPORTANT:
 * We generate FREE FORMAT COBOL to avoid fixed-column continuation issues
 * on Windows/MinGW toolchains.
 */

'use strict';

function sanitizeCobolName(name) {
  const raw = String(name || '').trim();
  if (!raw) return 'UNNAMED';
  let out = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '-');
  if (/^\d/.test(out)) out = `P-${out}`;
  out = out.replace(/-+/g, '-');
  return out;
}

/**
 * @param {Object} fdSchema
 * @param {string} datFileName - should be a short filename (e.g., "input.dat")
 * @param {Object} [options]
 * @param {string[]} [options.displayFields]
 */
function generateTestReader(fdSchema, datFileName, options = {}) {
  if (!fdSchema || typeof fdSchema !== 'object') {
    throw new Error('generateTestReader: fdSchema is required');
  }
  if (!Array.isArray(fdSchema.fields) || fdSchema.fields.length === 0) {
    throw new Error('generateTestReader: fdSchema.fields must be a non-empty array');
  }
  if (!datFileName || typeof datFileName !== 'string') {
    throw new Error('generateTestReader: datFileName must be a string');
  }

  const schemaName = sanitizeCobolName(fdSchema.name || 'RECORD');
  const programId = sanitizeCobolName(`TEST-${schemaName}`);

  const defaultDisplay = fdSchema.fields.slice(0, 2).map(f => sanitizeCobolName(f.name));
  const displayFields = Array.isArray(options.displayFields) && options.displayFields.length > 0
    ? options.displayFields.map(sanitizeCobolName)
    : defaultDisplay;

  const displayParts = [];
  for (let i = 0; i < displayFields.length; i++) {
    if (i > 0) displayParts.push('" | "');
    displayParts.push(displayFields[i]);
  }
  const displayStmt = `DISPLAY ${displayParts.join(' ')}`;

  const lines = [
    '>>SOURCE FORMAT FREE',
    'IDENTIFICATION DIVISION.',
    `PROGRAM-ID. ${programId}.`,
    'ENVIRONMENT DIVISION.',
    'INPUT-OUTPUT SECTION.',
    'FILE-CONTROL.',
    `SELECT DATA-FILE ASSIGN TO "${datFileName}"`,
    '    ORGANIZATION IS LINE SEQUENTIAL.',
    'DATA DIVISION.',
    'FILE SECTION.',
    'FD  DATA-FILE.',
    `COPY "${schemaName}.cpy".`,
    'WORKING-STORAGE SECTION.',
    "01  EOF-FLAG PIC X VALUE 'N'.",
    'PROCEDURE DIVISION.',
    'OPEN INPUT DATA-FILE.',
    "PERFORM UNTIL EOF-FLAG = 'Y'",
    '    READ DATA-FILE',
    "        AT END MOVE 'Y' TO EOF-FLAG",
    `        NOT AT END ${displayStmt}`,
    '    END-READ',
    'END-PERFORM.',
    'CLOSE DATA-FILE.',
    'STOP RUN.',
    ''
  ];

  return lines.join('\n');
}

module.exports = {
  generateTestReader
};
