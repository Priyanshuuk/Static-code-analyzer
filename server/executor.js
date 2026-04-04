const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');


const EXECUTION_TIMEOUT = 10000;


async function executeCode(language, code, input = '') {
  const handlers = {
    python: executePython,
    c: executeC,
    java: executeJava,
  };

  const handler = handlers[language];
  if (!handler) {
    return { output: '', error: `No executor for language: ${language}` };
  }

  return handler(code, input);
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
    cleanupTempFile(tmpFile);
  }
}

// ─── C Executor ─────────────────────────────────────────────
async function executeC(code, input) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'SCA-c-'));
  const srcFile = path.join(tmpDir, 'code.c');
  const outFile = path.join(tmpDir, os.platform() === 'win32' ? 'code.exe' : 'code');

  fs.writeFileSync(srcFile, code, 'utf-8');

  try {
    // Compile
    const compileResult = await runCommand('gcc', [srcFile, '-o', outFile, '-lm'], '');
    if (compileResult.error) {
      return { output: '', error: `Compilation Error:\n${compileResult.error}` };
    }

    // Run
    return await runCommand(outFile, [], input);
  } catch (err) {
    return {
      output: '',
      error: 'GCC is not installed or not in PATH. ' + err.message,
    };
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
    // Compile
    const compileResult = await runCommand('javac', [srcFile], '');
    if (compileResult.error) {
      return { output: '', error: `Compilation Error:\n${compileResult.error}` };
    }

    // Run
    return await runCommand('java', ['-cp', tmpDir, className], input);
  } catch (err) {
    return {
      output: '',
      error: 'Java (JDK) is not installed or not in PATH. ' + err.message,
    };
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

function cleanupTempFile(filePath) {
  try {
    fs.unlinkSync(filePath);
    fs.rmdirSync(path.dirname(filePath));
  } catch { /* ignore */ }
}

function cleanupDir(dirPath) {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch { /* ignore */ }
}

function runCommand(cmd, args, input) {

  const extraPaths = ['C:\\MinGW\\bin', 'C:\\mingw64\\bin', 'C:\\msys64\\mingw64\\bin'];
  const extendedPath = extraPaths.join(';') + ';' + process.env.PATH;

  return new Promise((resolve) => {
    const proc = execFile(cmd, args, {
      timeout: EXECUTION_TIMEOUT,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, PATH: extendedPath, PYTHONIOENCODING: 'utf-8', LANG: 'en_US.UTF-8' },
    }, (error, stdout, stderr) => {
      if (error) {

        if (error.killed) {
          return resolve({
            output: stdout || '',
            error: `Execution timed out (${EXECUTION_TIMEOUT / 1000}s limit).`,
          });
        }
        // Runtime error
        return resolve({
          output: stdout || '',
          error: stderr || error.message,
        });
      }
      resolve({
        output: stdout || '',
        error: stderr || '',
      });
    });

    // Send stdin input if provided
    if (input && proc.stdin) {
      proc.stdin.write(input);
      proc.stdin.end();
    }
  });
}

module.exports = { executeCode };
