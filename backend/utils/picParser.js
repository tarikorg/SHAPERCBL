//core algorithm 
// recieve a cobol structured PIC,  => return it in JSON data structure

/*
check if its signed 
check if it starts with 9,X,A (numeric, alphanumeric, alphabetic)
check number after '('
check for 'V' implied decimal point
if decimal parse remaining as decimal digit
calculate total length
*/

/**
 * COBOL PIC Clause Parser
 * 
 * Parses COBOL PIC (Picture) clauses and extracts semantic information:
 * - Data type (numeric, alphanumeric, decimal, etc.)
 * - Field length in bytes
 * - Number of decimal places
 * - Whether signed
 * 
 * PIC Clauses Supported:
 * - 9(n)        → numeric, n digits (e.g., "9(5)" = 5-digit number 00000-99999)
 * - X(n)        → alphanumeric, n chars (e.g., "X(20)" = 20-char text field)
 * - A(n)        → alphabetic, n letters (e.g., "A(10)" = letters only, no numbers)
 * - 9(n)V9(m)   → decimal, n digits + m decimals (e.g., "9(7)V99" = 7 digits + 2 decimals = 9 bytes total)
 * - S9(n)       → signed numeric (e.g., "S9(7)" = 8 bytes: 1 sign + 7 digits)
 * - S9(n)V9(m)  → signed decimal (e.g., "S9(7)V99" = 10 bytes: 1 sign + 9 digits/decimals)
 * 
 * The 'V' character represents an ASSUMED DECIMAL POINT:
 * - It doesn't occupy a byte in the fixed-width file
 * - It affects HOW we format numbers: 1234567.89 → stored as 123456789 (9 bytes)
 * 
 * The 'S' character means SIGNED (allows negative numbers):
 * - In EBCDIC/COMP-3: adds a sign nibble (half-byte)
 * - In ASCII display: adds a character for sign (typically '-' or '+')
 * 
 * Example Usage:
 * 
 * const picParser = require('./picParser');
 * 
 * // Simple 5-digit number
 * const r1 = picParser.parsePIC("9(5)");
 * // { type: "numeric", length: 5, decimals: 0, signed: false }
 * 
 * // 20-character name
 * const r2 = picParser.parsePIC("X(20)");
 * // { type: "alphanumeric", length: 20, decimals: 0, signed: false }
 * 
 * // Signed decimal: -1234567.89 stored in 10 bytes
 * const r3 = picParser.parsePIC("S9(7)V99");
 * // { type: "decimal", length: 10, decimals: 2, signed: true }
 * 
 * Used by:
 * - FDSchema model pre-save hook (to calculate field length and type)
 * - Phase 2 Transformer (to format values correctly)
 * - Test harness (50 test cases for validation)
 */

// ========== MAIN PARSER FUNCTION ==========

/**
 * Parse a COBOL PIC clause and extract its components
 * 
 * @param {string} pic - The PIC clause string
 *                       Examples: "9(5)", "X(20)", "9(7)V99", "S9(10)"
 * 
 * @returns {Object} Parsed result with properties:
 *   - type: string (one of: "numeric", "signed", "decimal", "alphanumeric", "alphabetic", "comp3")
 *   - length: number (total bytes this field occupies in fixed-width record)
 *   - decimals: number (0 for non-decimal fields, or count of decimal places)
 *   - signed: boolean (true if 'S' prefix present, indicating negative numbers allowed)
 * 
 * @throws {Error} If PIC clause is invalid or malformed
 * 
 * Example:
 * parsePIC("9(5)")      → { type: "numeric", length: 5, decimals: 0, signed: false }
 * parsePIC("X(20)")     → { type: "alphanumeric", length: 20, decimals: 0, signed: false }
 * parsePIC("S9(7)V99")  → { type: "decimal", length: 10, decimals: 2, signed: true }
 */
function parsePIC(pic) {
  // ========== INPUT VALIDATION ==========
  if (typeof pic !== 'string') {
    throw new Error(`PIC clause must be a string, got ${typeof pic}`);
  }

  const original = pic; // Save original for error messages
  pic = pic.trim(); // Remove leading/trailing whitespace

  if (pic.length === 0) {
    throw new Error('PIC clause cannot be empty');
  }

  // ========== INITIALIZE RESULT OBJECT ==========
  const result = {
    type: null,      // Will be set based on PIC pattern
    length: null,    // Total bytes occupied by this field
    decimals: 0,     // 0 unless it's a decimal field (has V)
    signed: false    // true if starts with 'S'
  };

  let pos = 0; // Current parsing position in the string

  // ========== STEP 1: CHECK FOR SIGN INDICATOR (S prefix) ==========
  // COBOL convention: 'S' at start means the field can be negative
  // Example: "S9(5)" = signed 5-digit number, "9(5)" = unsigned
  // The 'S' itself doesn't add a byte; sign is embedded in the data

  if (pic[0] === 'S' || pic[0] === 's') {
    result.signed = true;
    pos = 1; // Move past the 'S' to process the type character
  }

  // ========== STEP 2: DETECT PRIMARY TYPE CHARACTER (9, X, A, Z, etc.) ==========
  // This character indicates the fundamental data type

  if (pos >= pic.length) {
    throw new Error(`PIC clause "${original}" is incomplete: has 'S' but no type character after it`);
  }

  const typeChar = pic[pos].toUpperCase();
  let primaryType = null;

  if (typeChar === '9') {
    // '9' = numeric digit
    primaryType = 'numeric';
  } else if (typeChar === 'X') {
    // 'X' = alphanumeric (any character)
    primaryType = 'alphanumeric';
  } else if (typeChar === 'A') {
    // 'A' = alphabetic (letters and spaces only)
    primaryType = 'alphabetic';
  } else if (typeChar === 'Z') {
    // 'Z' = numeric (suppressed zeros) - not currently supported
    throw new Error(`PIC type '${typeChar}' is not currently supported. Use 9(n) instead`);
  } else {
    throw new Error(
      `PIC clause "${original}" has unknown type character '${typeChar}'. ` +
      `Expected one of: 9 (numeric), X (alphanumeric), A (alphabetic)`
    );
  }

  pos++; // Move past the type character

  // ========== STEP 3: EXTRACT LENGTH FROM PARENTHESES ==========
  // Format must be: typeChar followed by (n)
  // Example: "9(5)" → extract 5, "X(20)" → extract 20

  if (pos >= pic.length) {
    throw new Error(
      `PIC clause "${original}" is incomplete: type character '${typeChar}' ` +
      `must be followed by (n) where n is the length`
    );
  }

  if (pic[pos] !== '(') {
    throw new Error(
      `PIC clause "${original}" invalid: character '${pic[pos]}' found, ` +
      `expected '(' after type. Use format: ${typeChar}(n)`
    );
  }

  // Find the closing parenthesis
  const closeParenPos = pic.indexOf(')', pos);
  if (closeParenPos === -1) {
    throw new Error(`PIC clause "${original}" missing closing ')' parenthesis`);
  }

  // Extract the digits between parentheses
  const lengthStr = pic.substring(pos + 1, closeParenPos);
  if (lengthStr.length === 0) {
    throw new Error(`PIC clause "${original}" has empty parentheses. Use ${typeChar}(n) where n is a positive integer`);
  }

  // Convert to integer
  const mainLength = parseInt(lengthStr, 10);

  if (isNaN(mainLength)) {
    throw new Error(
      `PIC clause "${original}" has non-numeric value '${lengthStr}' in parentheses. ` +
      `Use ${typeChar}(n) where n is a number like 5, 20, 999`
    );
  }

  if (mainLength <= 0) {
    throw new Error(
      `PIC clause "${original}" specifies invalid length ${mainLength}. ` +
      `Length must be a positive integer >= 1`
    );
  }

  if (mainLength > 9999) {
    throw new Error(
      `PIC clause "${original}" specifies length ${mainLength}, ` +
      `which exceeds maximum of 9999`
    );
  }

  result.length = mainLength;
  pos = closeParenPos + 1; // Move past the ')'

  // ========== STEP 4: CHECK FOR DECIMAL POINT INDICATOR (V) ==========
  // 'V' = assumed (implied) decimal point
  // Doesn't occupy a byte, but affects number formatting
  // Example: "9(7)V99" represents 7+2=9 bytes total, with decimal after position 7
  //          Value 1234567.89 is stored as 123456789 (9 bytes, no decimal point char)

  let hasDecimal = false;
  let decimalLength = 0;

  if (pos < pic.length && (pic[pos] === 'V' || pic[pos] === 'v')) {
    hasDecimal = true;
    pos++; // Move past the 'V'

    // After 'V', we must see one or more '9' characters
    if (pos >= pic.length) {
      throw new Error(
        `PIC clause "${original}" ends after 'V'. ` +
        `Must specify decimal places: V9(n) or V9...9`
      );
    }

    // Verify next character is '9' (decimal digits must be numeric)
    const decimalTypeChar = pic[pos].toUpperCase();
    if (decimalTypeChar !== '9') {
      throw new Error(
        `PIC clause "${original}" invalid: after 'V' found '${decimalTypeChar}', ` +
        `expected '9' for decimal digit specification`
      );
    }

    pos++; // Move past the first '9'

    // ========== HANDLE TWO FORMATS ==========
    // Format 1: V9(n) with parentheses
    // Format 2: V99 without parentheses (just count the 9s)

    if (pos < pic.length && pic[pos] === '(') {
      // FORMAT 1: V9(n) → parse explicit parentheses
      const decimalClosePos = pic.indexOf(')', pos);
      if (decimalClosePos === -1) {
        throw new Error(`PIC clause "${original}" missing closing parenthesis after decimal digits`);
      }

      const decimalStr = pic.substring(pos + 1, decimalClosePos);
      if (decimalStr.length === 0) {
        throw new Error(
          `PIC clause "${original}" has empty parentheses after 'V9'`
        );
      }

      decimalLength = parseInt(decimalStr, 10);
      if (isNaN(decimalLength)) {
        throw new Error(
          `PIC clause "${original}" invalid decimal count: "${decimalStr}"`
        );
      }

      if (decimalLength <= 0) {
        throw new Error(
          `PIC clause "${original}" decimal places must be >= 1`
        );
      }

      if (decimalLength > 9999) {
        throw new Error(
          `PIC clause "${original}" decimal places too large: ${decimalLength}`
        );
      }

      result.decimals = decimalLength;
      pos = decimalClosePos + 1; // Move past ')'

    } else {
      // FORMAT 2: V99 (or V999, V9999, etc.) → count the 9s
      // Count how many consecutive '9' characters follow the first one we already passed
      decimalLength = 1; // We already consumed the first '9' above

      while (pos < pic.length && (pic[pos] === '9' || pic[pos].toUpperCase() === '9')) {
        decimalLength++;
        pos++;
      }

      result.decimals = decimalLength;
    }
  }

  // ========== STEP 5: CALCULATE TOTAL LENGTH & DETERMINE FINAL TYPE ==========

  if (hasDecimal) {
    // For decimal fields: total length = main digits + decimal digits
    // Example: "9(7)V99" → total 7 + 2 = 9 bytes
    // Regardless of sign: "S9(7)V99" → still 9 bytes (sign doesn't add a byte in this context)
    result.length = mainLength + decimalLength;

    // Type is always "decimal" if 'V' present
    // (whether signed or not, the type is "decimal")
    result.type = 'decimal';

  } else {
    // Non-decimal field: length is just the main length
    result.length = mainLength;

    // Determine type based on primary type and signedness
    if (primaryType === 'numeric') {
      // Numeric without decimal: "numeric" or "signed" if S prefix
      result.type = result.signed ? 'signed' : 'numeric';
    } else if (primaryType === 'alphanumeric') {
      // Text: always "alphanumeric", sign doesn't apply
      result.type = 'alphanumeric';
    } else if (primaryType === 'alphabetic') {
      // Letters only: always "alphabetic", sign doesn't apply
      result.type = 'alphabetic';
    }
  }

  // ========== STEP 6: CHECK FOR UNEXPECTED EXTRA CHARACTERS ==========
  // If parsing didn't consume the entire string, there are unexpected characters
  // This usually indicates a typo or unsupported syntax

  if (pos < pic.length) {
    const remaining = pic.substring(pos);
    // For now, warn instead of error (more lenient parsing)
    console.warn(
      `⚠️  PIC clause "${original}" has unparsed characters at end: "${remaining}". ` +
      `Will ignore them, but may indicate a syntax error.`
    );
    // In strict mode (validation only), could throw here
  }

  // ========== RETURN PARSED RESULT ==========
  return result;
}

// ========== EXPORT ==========
/**
 * Export the parser function
 * 
 * Usage in other files:
 * const { parsePIC } = require('./utils/picParser');
 * const parsed = parsePIC("9(5)");
 */
module.exports = {
  parsePIC
};
