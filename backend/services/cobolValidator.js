/**
 * COBOL Validator (Phase 3)
 *
 * Generates copybook + COBOL test reader, compiles with GnuCOBOL, runs it,
 * and returns timings + stdout for correctness checks.
 *
 * IMPORTANT:
 * - Uses FREE FORMAT COBOL to avoid fixed-column continuation errors on Windows.
 * - Copies the dataset .dat into the work directory as "input.dat" so the COBOL
 *   ASSIGN TO line stays short (prevents line wrapping issues).
 *
 * Logging:
 * - By default this service does NOT write research CSVs.
 * - Research harness scripts (Phase 3 suite) own CSV writing for reproducibility.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { performance } = require('perf_hooks');

const { generateCopybook } = require('./copybookGenerator');
const { generateTestReader } = require('./cobolTestGenerator');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function fileExists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function execFilePromise(command, args, options) {
  return new Promise((resolve) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      resolve({
        code: error && typeof error.code === 'number' ? error.code : 0,
        error,
        stdout: stdout || '',
        stderr: stderr || ''
      });
    });
  });
}

function appendCobolValidationRow(row) {
  const projectRoot = path.resolve(__dirname, '../..');
  const csvPath = path.join(projectRoot, 'research', 'data', 'cobol-validation.csv');
  ensureDir(path.dirname(csvPath));

  if (!fileExists(csvPath)) {
    fs.writeFileSync(
      csvPath,
      'dataset,compile_success,compile_time_ms,run_success,run_time_ms,output_correct\n',
      'utf-8'
    );
  }

  fs.appendFileSync(csvPath, row + '\n', 'utf-8');
}

function checkOutputCorrect(stdout, expectedTokens) {
  const out = String(stdout || '');
  return expectedTokens.every(t => out.includes(t));
}

function sanitizeSchemaName(name) {
  return String(name || 'RECORD')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Validate a schema+dat file by generating COBOL code, compiling, running, and checking output.
 *
 * @param {Object} params
 * @param {string} params.datasetName
 * @param {Object} params.fdSchema
 * @param {string} params.datFilePath
 * @param {Object} [params.sampleRecord]
 * @param {boolean} [params.logToCsv=false] - if true, append to research/data/cobol-validation.csv
 */
async function validateWithCOBOL({ datasetName, fdSchema, datFilePath, sampleRecord, logToCsv = false }) {
  if (!datasetName) throw new Error('validateWithCOBOL: datasetName is required');
  if (!fdSchema) throw new Error('validateWithCOBOL: fdSchema is required');
  if (!datFilePath) throw new Error('validateWithCOBOL: datFilePath is required');

  const projectRoot = path.resolve(__dirname, '../..');

  const tempRoot = path.join(projectRoot, 'validation', 'tmp');
  ensureDir(tempRoot);

  const runId = `${datasetName}-${Date.now()}`;
  const workDir = path.join(tempRoot, runId);
  ensureDir(workDir);

  // Resolve .dat path and copy into workDir to keep ASSIGN short.
  const datPathAbs = path.isAbsolute(datFilePath)
    ? datFilePath
    : path.join(projectRoot, datFilePath);

  const inputDatPath = path.join(workDir, 'input.dat');
  fs.copyFileSync(datPathAbs, inputDatPath);

  // Generate copybook + COBOL source
  const cpyContent = generateCopybook(fdSchema);
  const schemaName = sanitizeSchemaName(fdSchema.name);
  const cpyFileName = `${schemaName}.cpy`;

  const cobSource = generateTestReader(fdSchema, 'input.dat');

  const cpyPath = path.join(workDir, cpyFileName);
  const cobPath = path.join(workDir, 'test.cob');
  const exePath = path.join(workDir, process.platform === 'win32' ? 'test.exe' : 'test');

  // Ensure newline at end to avoid -Wmissing-newline warning
  fs.writeFileSync(cpyPath, cpyContent + '\n', 'utf-8');
  fs.writeFileSync(cobPath, cobSource, 'utf-8');

  // Compile (force free format)
  const compileStart = performance.now();
  const compileArgs = ['-free', '-x', '-I', workDir, cobPath, '-o', exePath];
  const compileResult = await execFilePromise('cobc', compileArgs, { cwd: workDir });
  const compileTimeMs = performance.now() - compileStart;

  const compileSuccess = compileResult.code === 0;

  if (!compileSuccess) {
    if (logToCsv) {
      appendCobolValidationRow(
        [datasetName, 'false', compileTimeMs.toFixed(3), 'false', '0.000', 'false'].join(',')
      );
    }

    return {
      compileSuccess: false,
      runSuccess: false,
      outputCorrect: false,
      compileTimeMs,
      runTimeMs: 0,
      stdout: compileResult.stdout,
      stderr: compileResult.stderr,
      workDir
    };
  }

  // Run
  const runStart = performance.now();
  const runResult = await execFilePromise(exePath, [], { cwd: workDir });
  const runTimeMs = performance.now() - runStart;

  const runSuccess = runResult.code === 0;

  const expectedTokens = [];
  if (sampleRecord && typeof sampleRecord === 'object') {
    if (sampleRecord.emp_id !== undefined && sampleRecord.emp_id !== null) {
      expectedTokens.push(String(sampleRecord.emp_id).trim().padStart(5, '0'));
    }
    if (sampleRecord.name) {
      expectedTokens.push(String(sampleRecord.name).trim().slice(0, 10));
    }
  }

  const outputCorrect = expectedTokens.length === 0
    ? true
    : checkOutputCorrect(runResult.stdout, expectedTokens);

  if (logToCsv) {
    appendCobolValidationRow(
      [
        datasetName,
        String(compileSuccess),
        compileTimeMs.toFixed(3),
        String(runSuccess),
        runTimeMs.toFixed(3),
        String(outputCorrect)
      ].join(',')
    );
  }

  return {
    compileSuccess,
    runSuccess,
    outputCorrect,
    compileTimeMs,
    runTimeMs,
    stdout: runResult.stdout,
    stderr: runResult.stderr,
    workDir,
    compile: {
      stdout: compileResult.stdout,
      stderr: compileResult.stderr
    }
  };
}

module.exports = {
  validateWithCOBOL,
  appendCobolValidationRow
};
