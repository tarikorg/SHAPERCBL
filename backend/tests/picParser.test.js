/**
 * PIC Parser Test Suite
 * 
 * Tests the picParser.parsePIC() function with 50 test cases:
 * - 15 valid basic cases
 * - 5 case insensitivity tests
 * - 5 whitespace handling tests
 * - 10 edge case value tests
 * - 10 invalid syntax error tests
 * - 10 invalid value error tests
 * 
 * Run with: npm test
 * Run specific suite: npm test -- picParser.test.js
 * 
 * Target: 100% pass rate on all 50 cases
 * This proves the parser works correctly before Phase 2 uses it
 */

const { parsePIC } = require('../utils/picParser');

describe('PIC Parser - picParser.parsePIC()', () => {

  // ========== CATEGORY 1: VALID BASIC CASES (15 cases) ==========
  describe('Valid Basic Cases', () => {

    test('1: parses 9(5) as numeric', () => {
      const result = parsePIC('9(5)');
      expect(result).toEqual({
        type: 'numeric',
        length: 5,
        decimals: 0,
        signed: false
      });
    });

    test('2: parses 9(1) as numeric', () => {
      const result = parsePIC('9(1)');
      expect(result.type).toBe('numeric');
      expect(result.length).toBe(1);
      expect(result.signed).toBe(false);
    });

    test('3: parses 9(10) as numeric', () => {
      const result = parsePIC('9(10)');
      expect(result.type).toBe('numeric');
      expect(result.length).toBe(10);
    });

    test('4: parses X(1) as alphanumeric', () => {
      const result = parsePIC('X(1)');
      expect(result.type).toBe('alphanumeric');
      expect(result.length).toBe(1);
    });

    test('5: parses X(20) as alphanumeric', () => {
      const result = parsePIC('X(20)');
      expect(result.type).toBe('alphanumeric');
      expect(result.length).toBe(20);
    });

    test('6: parses A(10) as alphabetic', () => {
      const result = parsePIC('A(10)');
      expect(result.type).toBe('alphabetic');
      expect(result.length).toBe(10);
    });

    test('7: parses 9(7)V99 as decimal with 2 decimal places', () => {
      const result = parsePIC('9(7)V99');
      expect(result.type).toBe('decimal');
      expect(result.length).toBe(9);  // 7 + 2
      expect(result.decimals).toBe(2);
      expect(result.signed).toBe(false);
    });

    test('8: parses 9(1)V9 as decimal with 1 decimal place', () => {
      const result = parsePIC('9(1)V9');
      expect(result.type).toBe('decimal');
      expect(result.length).toBe(2);  // 1 + 1
      expect(result.decimals).toBe(1);
    });

    test('9: parses S9(5) as signed numeric', () => {
      const result = parsePIC('S9(5)');
      expect(result.type).toBe('signed');
      expect(result.length).toBe(5);
      expect(result.signed).toBe(true);
    });

    test('10: parses S9(7)V99 as signed decimal', () => {
      const result = parsePIC('S9(7)V99');
      expect(result.type).toBe('decimal');
      expect(result.length).toBe(9);  // 7 + 2 (sign doesn't add byte here)
      expect(result.decimals).toBe(2);
      expect(result.signed).toBe(true);
    });

    test('11: parses 9(15) as numeric', () => {
      const result = parsePIC('9(15)');
      expect(result.length).toBe(15);
      expect(result.type).toBe('numeric');
    });

    test('12: parses X(100) as alphanumeric', () => {
      const result = parsePIC('X(100)');
      expect(result.length).toBe(100);
      expect(result.type).toBe('alphanumeric');
    });

    test('13: parses A(50) as alphabetic', () => {
      const result = parsePIC('A(50)');
      expect(result.length).toBe(50);
      expect(result.type).toBe('alphabetic');
    });

    test('14: parses 9(9)V9(9) as decimal with 9 decimal places', () => {
      const result = parsePIC('9(9)V9(9)');
      expect(result.type).toBe('decimal');
      expect(result.length).toBe(18);  // 9 + 9
      expect(result.decimals).toBe(9);
    });

    test('15: parses S9(1)V9(1) as signed decimal', () => {
      const result = parsePIC('S9(1)V9(1)');
      expect(result.type).toBe('decimal');
      expect(result.length).toBe(2);  // 1 + 1
      expect(result.decimals).toBe(1);
      expect(result.signed).toBe(true);
    });

  }); // END Category 1

  // ========== CATEGORY 2: CASE INSENSITIVITY (5 cases) ==========
  describe('Case Insensitivity', () => {

    test('16: parses lowercase s9(5) same as S9(5)', () => {
      const result = parsePIC('s9(5)');
      expect(result.signed).toBe(true);
      expect(result.length).toBe(5);
    });

    test('17: parses lowercase x(10) same as X(10)', () => {
      const result = parsePIC('x(10)');
      expect(result.type).toBe('alphanumeric');
      expect(result.length).toBe(10);
    });

    test('18: parses lowercase a(10) same as A(10)', () => {
      const result = parsePIC('a(10)');
      expect(result.type).toBe('alphabetic');
      expect(result.length).toBe(10);
    });

    test('19: parses 9(5)v99 with lowercase v', () => {
      const result = parsePIC('9(5)v99');
      expect(result.type).toBe('decimal');
      expect(result.decimals).toBe(2);
    });

    test('20: parses s9(5)v99 fully lowercase', () => {
      const result = parsePIC('s9(5)v99');
      expect(result.signed).toBe(true);
      expect(result.type).toBe('decimal');
    });

  }); // END Category 2

  // ========== CATEGORY 3: WHITESPACE HANDLING (5 cases) ==========
  describe('Whitespace Handling', () => {

    test('21: parses 9(5) with leading/trailing spaces', () => {
      const result = parsePIC('  9(5)  ');
      expect(result.length).toBe(5);
      expect(result.type).toBe('numeric');
    });

    test('22: parses X(20) with spaces', () => {
      const result = parsePIC(' X(20) ');
      expect(result.length).toBe(20);
      expect(result.type).toBe('alphanumeric');
    });

    test('23: parses 9(5) with leading tab', () => {
      const result = parsePIC('\t9(5)');
      expect(result.length).toBe(5);
    });

    test('24: parses S9(5) with trailing spaces', () => {
      const result = parsePIC('S9(5)   ');
      expect(result.signed).toBe(true);
    });

    test('25: parses 9(7)V99 with spaces throughout', () => {
      const result = parsePIC('   9(7)V99   ');
      expect(result.type).toBe('decimal');
      expect(result.length).toBe(9);
    });

  }); // END Category 3

  // ========== CATEGORY 4: EDGE CASE VALUES (10 cases) ==========
  describe('Edge Case Values', () => {

    test('26: parses 9(1) minimum numeric length', () => {
      const result = parsePIC('9(1)');
      expect(result.length).toBe(1);
    });

    test('27: parses 9(9999) maximum length', () => {
      const result = parsePIC('9(9999)');
      expect(result.length).toBe(9999);
    });

    test('28: parses X(1) minimum alphanumeric', () => {
      const result = parsePIC('X(1)');
      expect(result.length).toBe(1);
    });

    test('29: parses X(9999) maximum alphanumeric', () => {
      const result = parsePIC('X(9999)');
      expect(result.length).toBe(9999);
    });

    test('30: parses 9(1)V9(1) minimum decimal', () => {
      const result = parsePIC('9(1)V9(1)');
      expect(result.length).toBe(2);
      expect(result.decimals).toBe(1);
    });

    test('31: parses 9(9999)V9(9999) large decimal', () => {
      const result = parsePIC('9(9999)V9(9999)');
      expect(result.length).toBe(19998);
      expect(result.decimals).toBe(9999);
    });

    test('32: parses A(1) minimum alphabetic', () => {
      const result = parsePIC('A(1)');
      expect(result.length).toBe(1);
    });

    test('33: parses S9(1) minimum signed', () => {
      const result = parsePIC('S9(1)');
      expect(result.signed).toBe(true);
      expect(result.length).toBe(1);
    });

    test('34: parses S9(1)V9(1) minimum signed decimal', () => {
      const result = parsePIC('S9(1)V9(1)');
      expect(result.signed).toBe(true);
      expect(result.length).toBe(2);
    });

    test('35: parses 9(5)V9(8) asymmetric decimal', () => {
      const result = parsePIC('9(5)V9(8)');
      expect(result.length).toBe(13);
      expect(result.decimals).toBe(8);
    });

  }); // END Category 4

  // ========== CATEGORY 5: INVALID SYNTAX ERRORS (10 cases) ==========
  describe('Invalid Syntax - Should Throw Error', () => {

    test('36: rejects empty string', () => {
      expect(() => parsePIC('')).toThrow();
    });

    test('37: rejects just 9 without parentheses', () => {
      expect(() => parsePIC('9')).toThrow();
    });

    test('38: rejects 9() with empty parentheses', () => {
      expect(() => parsePIC('9()')).toThrow();
    });

    test('39: rejects 9(abc) with non-numeric length', () => {
      expect(() => parsePIC('9(abc)')).toThrow();
    });

    test('40: rejects 9(5 missing closing paren', () => {
      expect(() => parsePIC('9(5')).toThrow();
    });

    test('41: rejects malformed 9)5(', () => {
      expect(() => parsePIC('9)5(')).toThrow();
    });

    test('42: rejects unsupported type Z(5)', () => {
      expect(() => parsePIC('Z(5)')).toThrow();
    });

    test('43: rejects invalid format 5(9)', () => {
      expect(() => parsePIC('5(9)')).toThrow();
    });

    test('44: rejects just X without parentheses', () => {
      expect(() => parsePIC('X')).toThrow();
    });

    test('45: rejects incomplete decimal 9(7)V', () => {
      expect(() => parsePIC('9(7)V')).toThrow();
    });

  }); // END Category 5

  // ========== CATEGORY 6: INVALID VALUES - SHOULD THROW (10 cases) ==========
  describe('Invalid Values - Should Throw Error', () => {

    test('46: rejects 9(0) zero length', () => {
      expect(() => parsePIC('9(0)')).toThrow();
    });

    test('47: rejects 9(-5) negative length', () => {
      expect(() => parsePIC('9(-5)')).toThrow();
    });

    test('48: rejects 9(10000) exceeds maximum', () => {
      expect(() => parsePIC('9(10000)')).toThrow();
    });

    test('49: rejects S9(5)V incomplete decimal', () => {
      expect(() => parsePIC('S9(5)V')).toThrow();
    });

    test('50: rejects 9(5)VX(20) wrong type after V', () => {
      expect(() => parsePIC('9(5)VX(20)')).toThrow();
    });

    test('51: rejects 9(5)V9(0) zero decimal places', () => {
      expect(() => parsePIC('9(5)V9(0)')).toThrow();
    });

    test('52: rejects 9(5)V9(-2) negative decimal places', () => {
      expect(() => parsePIC('9(5)V9(-2)')).toThrow();
    });

    test('53: rejects 9(5)V9(10000) decimal exceeds maximum', () => {
      expect(() => parsePIC('9(5)V9(10000)')).toThrow();
    });

    test('54: rejects S9 incomplete', () => {
      expect(() => parsePIC('S9')).toThrow();
    });

    test('55: rejects non-string input', () => {
      expect(() => parsePIC(null)).toThrow();
      expect(() => parsePIC(123)).toThrow();
      expect(() => parsePIC(undefined)).toThrow();
    });

  }); // END Category 6

}); // END describe

// ========== TEST REPORTING ==========
/**
 * Jest automatically reports:
 * - Total tests run: 55
 * - Pass/Fail count
 * - Time to run
 * - Coverage (if --coverage flag used)
 * 
 * Expected output:
 * PASS  backend/tests/picParser.test.js
 *   PIC Parser - picParser.parsePIC()
 *     Valid Basic Cases (15 tests)
 *       ✓ 1: parses 9(5) as numeric
 *       ✓ 2: parses 9(1) as numeric
 *       ... (all 55 pass)
 * 
 * Test Suites: 1 passed, 1 total
 * Tests:       55 passed, 55 total
 * Time:        0.123s
 */
