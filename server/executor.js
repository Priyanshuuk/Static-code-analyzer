const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EXECUTION_TIMEOUT = parseInt(process.env.EXECUTION_TIMEOUT, 10) || 10000;
const PARSE_TIMEOUT = parseInt(process.env.PARSE_TIMEOUT, 10) || 5000;

async function executeCode(language, code, input = '') {
  const handlers = {
    c:      executeC,
    python: executePython,
    java:   executeJava,
  };
  const handler = handlers[language];
  if (!handler) return { output: '', error: `No executor for language: ${language}` };
  return handler(code, input);
}

async function parseCode(language, code) {
  const handlers = {
    c:      parseC,
    python: parsePython,
    java:   parseJava,
  };
  const handler = handlers[language];
  if (!handler) return { success: false, errors: [], warnings: [], message: `No parser for language: ${language}` };
  return handler(code);
}

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

async function parsePython(code) {
  const tmpFile = createTempFile('code.py', code);
  try {
    let res = await runCommand('python', ['-m', 'py_compile', tmpFile], '', PARSE_TIMEOUT);
    if (res.error && res.error.includes('ENOENT')) {
      res = await runCommand('python3', ['-m', 'py_compile', tmpFile], '', PARSE_TIMEOUT);
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

function formatParseResult(res) {
  const errors = [];
  const warnings = [];
  const output = (res.error || '').trim();
  if (!output) {
    return { success: true, errors: [], warnings: [], message: 'Syntax OK — no errors found.' };
  }
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

function getExtendedPath() {
  const pathSep = os.platform() === 'win32' ? ';' : ':';
  const extraPaths = os.platform() === 'win32' ? [
    'C:\\MinGW\\bin', 'C:\\mingw64\\bin', 'C:\\msys64\\mingw64\\bin', 'C:\\msys64\\usr\\bin',
    'C:\\Program Files\\Go\\bin', 'C:\\Program Files (x86)\\Go\\bin',
    `${os.homedir()}\\.cargo\\bin`,
  ] : [];
  return [...extraPaths, process.env.PATH].join(pathSep);
}

function runCommand(cmd, args, input, timeout = EXECUTION_TIMEOUT) {
  return new Promise((resolve) => {
    const proc = execFile(cmd, args, {
      timeout,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        PATH: getExtendedPath(),
        PYTHONIOENCODING: 'utf-8',
        LANG: 'en_US.UTF-8',
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
