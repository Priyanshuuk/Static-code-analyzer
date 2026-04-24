const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EXECUTION_TIMEOUT = 10000;
const PARSE_TIMEOUT = 5000;

// ─── Execute Dispatch ────────────────────────────────────────
async function executeCode(language, code, input = '') {
  const handlers = {
    c:          executeC,
    cpp:        executeCpp,
    python:     executePython,
    java:       executeJava,
    javascript: executeJavaScript,
    typescript: executeTypeScript,
    go:         executeGo,
    rust:       executeRust,
  };

  const handler = handlers[language];
  if (!handler) {
    return { output: '', error: `No executor for language: ${language}` };
  }
  return handler(code, input);
}

// ─── Parse / Syntax Check Dispatch ───────────────────────────
async function parseCode(language, code) {
  const handlers = {
    c:          parseC,
    cpp:        parseCpp,
    python:     parsePython,
    java:       parseJava,
    javascript: parseJavaScript,
    typescript: parseTypeScript,
    go:         parseGo,
    rust:       parseRust,
  };

  const handler = handlers[language];
  if (!handler) {
    return { success: false, errors: [], warnings: [], message: `No parser for language: ${language}` };
  }
  return handler(code);
}

// ═══════════════════════════════════════════════════════════════
//  PARSERS — Syntax-only checking (no execution)
// ═══════════════════════════════════════════════════════════════

async function parseC(code) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'SCA-parse-'));
  const srcFile = path.join(tmpDir, 'code.c');
  fs.writeFileSync(srcFile, code, 'utf-8');
  try {
    const res = await runCommand('gcc', ['-fsyntax-only', '-Wall', '-Wextra', srcFile], '', PARSE_TIMEOUT);
    return formatParseResult(res);
  } finally {
    cleanupDir(tmpDir);
  }
}

async function parseCpp(code) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'SCA-parse-'));
  const srcFile = path.join(tmpDir, 'code.cpp');
  fs.writeFileSync(srcFile, code, 'utf-8');
  try {
    const res = await runCommand('g++', ['-fsyntax-only', '-std=c++17', '-Wall', '-Wextra', srcFile], '', PARSE_TIMEOUT);
    return formatParseResult(res);
  } finally {
    cleanupDir(tmpDir);
  }
}

async function parsePython(code) {
  const tmpFile = createTempFile('code.py', code);
  try {
    const res = await runCommand('python', ['-m', 'py_compile', tmpFile], '', PARSE_TIMEOUT);
    if (res.error && res.error.includes('ENOENT')) {
      const res2 = await runCommand('python3', ['-m', 'py_compile', tmpFile], '', PARSE_TIMEOUT);
      return formatParseResult(res2);
    }
    return formatParseResult(res);
  } finally {
    cleanupTempFileDir(tmpFile);
  }
}

async function parseJava(code) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'SCA-parse-'));
  const classMatch = code.match(/public\s+class\s+(\w+)/);
  const className = classMatch ? classMatch[1] : 'Main';
  const srcFile = path.join(tmpDir, `${className}.java`);
  fs.writeFileSync(srcFile, code, 'utf-8');
  try {
    const res = await runCommand('javac', ['-Xlint:all', srcFile], '', PARSE_TIMEOUT);
    return formatParseResult(res);
  } finally {
    cleanupDir(tmpDir);
  }
}

async function parseJavaScript(code) {
  const tmpFile = createTempFile('code.js', code);
  try {
    const res = await runCommand('node', ['--check', tmpFile], '', PARSE_TIMEOUT);
    return formatParseResult(res);
  } finally {
    cleanupTempFileDir(tmpFile);
  }
}

async function parseTypeScript(code) {
  const tmpFile = createTempFile('code.ts', code);
  try {
    let res = await runCommand('npx', ['--yes', 'tsc', '--noEmit', '--strict', tmpFile], '', PARSE_TIMEOUT);
    return formatParseResult(res);
  } finally {
    cleanupTempFileDir(tmpFile);
  }
}

async function parseGo(code) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'SCA-parse-'));
  const srcFile = path.join(tmpDir, 'main.go');
  fs.writeFileSync(srcFile, code, 'utf-8');
  try {
    // go vet does parsing + basic analysis
    const res = await runCommand('go', ['vet', srcFile], '', PARSE_TIMEOUT);
    return formatParseResult(res);
  } finally {
    cleanupDir(tmpDir);
  }
}

async function parseRust(code) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'SCA-parse-'));
  const srcFile = path.join(tmpDir, 'main.rs');
  const outFile = path.join(tmpDir, os.platform() === 'win32' ? 'main.exe' : 'main');
  fs.writeFileSync(srcFile, code, 'utf-8');
  try {
    // rustc with deny warnings for strict checking
    const res = await runCommand('rustc', ['--edition', '2021', srcFile, '-o', outFile], '', PARSE_TIMEOUT);
    return formatParseResult(res);
  } finally {
    cleanupDir(tmpDir);
  }
}

function formatParseResult(res) {
  const errors = [];
  const warnings = [];
  const output = (res.error || '').trim();

  if (!output) {
    return { success: true, errors: [], warnings: [], message: 'Syntax OK — no errors found.' };
  }

  // Split lines and categorize
  const lines = output.split('\n');
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('warning')) {
      warnings.push(line.trim());
    } else if (lower.includes('error') || lower.includes('syntaxerror') || lower.includes('invalid')) {
      errors.push(line.trim());
    } else if (line.trim()) {
      errors.push(line.trim());
    }
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
    message: errors.length > 0
      ? `Found ${errors.length} error(s) and ${warnings.length} warning(s).`
      : `No errors. ${warnings.length} warning(s).`,
  };
}

// ═══════════════════════════════════════════════════════════════
//  EXECUTORS
// ═══════════════════════════════════════════════════════════════

async function executePython(code, input) {
  const tmpFile = createTempFile('code.py', code);
  try {
    let res = await runCommand('python', [tmpFile], input);
    if (res.error && res.error.includes('ENOENT')) {
      res = await runCommand('python3', [tmpFile], input);
    }
    if (res.error && res.error.includes('ENOENT')) {
      res = await runCommand('py', [tmpFile], input);
    }
    if (res.error && res.error.includes('ENOENT')) {
      res.error = 'Python is not installed or not in PATH.';
    }
    return res;
  } finally {
    cleanupTempFileDir(tmpFile);
  }
}

async function executeC(code, input) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'SCA-c-'));
  const srcFile = path.join(tmpDir, 'code.c');
  const outFile = path.join(tmpDir, os.platform() === 'win32' ? 'code.exe' : 'code');
  fs.writeFileSync(srcFile, code, 'utf-8');
  try {
    const compileResult = await runCommand('gcc', [srcFile, '-o', outFile, '-lm'], '');
    if (compileResult.error) {
      return { output: '', error: `Compilation Error:\n${compileResult.error}` };
    }
    return await runCommand(outFile, [], input);
  } catch (err) {
    return { output: '', error: 'GCC is not installed or not in PATH. ' + err.message };
  } finally {
    cleanupDir(tmpDir);
  }
}

async function executeCpp(code, input) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'SCA-cpp-'));
  const srcFile = path.join(tmpDir, 'code.cpp');
  const outFile = path.join(tmpDir, os.platform() === 'win32' ? 'code.exe' : 'code');
  fs.writeFileSync(srcFile, code, 'utf-8');
  try {
    const compileResult = await runCommand('g++', [srcFile, '-o', outFile, '-std=c++17', '-O2', '-lm'], '');
    if (compileResult.error) {
      return { output: '', error: `Compilation Error:\n${compileResult.error}` };
    }
    return await runCommand(outFile, [], input);
  } catch (err) {
    return { output: '', error: 'G++ is not installed or not in PATH. ' + err.message };
  } finally {
    cleanupDir(tmpDir);
  }
}

async function executeJava(code, input) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'SCA-java-'));
  const classMatch = code.match(/public\s+class\s+(\w+)/);
  const className = classMatch ? classMatch[1] : 'Main';
  const srcFile = path.join(tmpDir, `${className}.java`);
  fs.writeFileSync(srcFile, code, 'utf-8');
  try {
    const compileResult = await runCommand('javac', [srcFile], '');
    if (compileResult.error) {
      return { output: '', error: `Compilation Error:\n${compileResult.error}` };
    }
    return await runCommand('java', ['-cp', tmpDir, className], input);
  } catch (err) {
    return { output: '', error: 'Java (JDK) is not installed or not in PATH. ' + err.message };
  } finally {
    cleanupDir(tmpDir);
  }
}

async function executeJavaScript(code, input) {
  const tmpFile = createTempFile('code.js', code);
  try {
    let res = await runCommand('node', [tmpFile], input);
    if (res.error && res.error.includes('ENOENT')) {
      res.error = 'Node.js is not installed or not in PATH.';
    }
    return res;
  } finally {
    cleanupTempFileDir(tmpFile);
  }
}

async function executeTypeScript(code, input) {
  const tmpFile = createTempFile('code.ts', code);
  try {
    let res = await runCommand('ts-node', ['--skip-project', tmpFile], input);
    if (res.error && res.error.includes('ENOENT')) {
      res = await runCommand('npx', ['--yes', 'ts-node', '--skip-project', tmpFile], input);
    }
    if (res.error && res.error.includes('ENOENT')) {
      res.error = 'ts-node / Node.js is not installed or not in PATH.';
    }
    return res;
  } finally {
    cleanupTempFileDir(tmpFile);
  }
}

async function executeGo(code, input) {
  const tmpFile = createTempFile('main.go', code);
  try {
    let res = await runCommand('go', ['run', tmpFile], input);
    if (res.error && res.error.includes('ENOENT')) {
      res.error = 'Go is not installed or not in PATH.';
    }
    return res;
  } finally {
    cleanupTempFileDir(tmpFile);
  }
}

async function executeRust(code, input) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'SCA-rust-'));
  const srcFile = path.join(tmpDir, 'main.rs');
  const outFile = path.join(tmpDir, os.platform() === 'win32' ? 'main.exe' : 'main');
  fs.writeFileSync(srcFile, code, 'utf-8');
  try {
    const compileResult = await runCommand('rustc', [srcFile, '-o', outFile], '');
    if (compileResult.error) {
      return { output: '', error: `Compilation Error:\n${compileResult.error}` };
    }
    return await runCommand(outFile, [], input);
  } catch (err) {
    return { output: '', error: 'Rust (rustc) is not installed or not in PATH. ' + err.message };
  } finally {
    cleanupDir(tmpDir);
  }
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

function createTempFile(filename, content) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'SCA-'));
  const filePath = path.join(tmpDir, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

function cleanupTempFileDir(filePath) {
  try { fs.rmSync(path.dirname(filePath), { recursive: true, force: true }); } catch {}
}

function cleanupDir(dirPath) {
  try { fs.rmSync(dirPath, { recursive: true, force: true }); } catch {}
}

function runCommand(cmd, args, input, timeout = EXECUTION_TIMEOUT) {
  const extraPaths = [
    'C:\\MinGW\\bin', 'C:\\mingw64\\bin', 'C:\\msys64\\mingw64\\bin', 'C:\\msys64\\usr\\bin',
    'C:\\Program Files\\Go\\bin', 'C:\\Program Files (x86)\\Go\\bin',
    `${os.homedir()}\\.cargo\\bin`,
  ];
  const extendedPath = extraPaths.join(';') + ';' + process.env.PATH;

  return new Promise((resolve) => {
    const proc = execFile(cmd, args, {
      timeout,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        PATH: extendedPath,
        PYTHONIOENCODING: 'utf-8',
        LANG: 'en_US.UTF-8',
        GOPATH: process.env.GOPATH || path.join(os.homedir(), 'go'),
      },
    }, (error, stdout, stderr) => {
      if (error) {
        if (error.killed) {
          return resolve({ output: stdout || '', error: `Time Limit Exceeded (${timeout / 1000}s limit).` });
        }
        return resolve({ output: stdout || '', error: stderr || error.message });
      }
      resolve({ output: stdout || '', error: stderr || '' });
    });

    if (input && proc.stdin) {
      proc.stdin.write(input);
      proc.stdin.end();
    }
  });
}

module.exports = { executeCode, parseCode };
