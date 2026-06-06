const KEYWORDS = new Set([
  'int', 'float', 'char', 'double', 'void', 'if', 'else', 'for', 'while',
  'do', 'switch', 'case', 'default', 'break', 'continue', 'return',
  'struct', 'typedef', 'sizeof', 'enum', 'const', 'unsigned', 'signed',
  'static', 'extern', 'auto', 'register', 'volatile', 'goto', 'union',
  'long', 'short', 'inline', 'restrict',
]);

const OPERATORS = [
  '->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||',
  '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=',
  '+', '-', '*', '/', '%', '=', '<', '>', '!', '&', '|', '^', '~', '.',
];

const DELIMITERS = new Set([';', ',', '{', '}', '(', ')', '[', ']', '#']);

function isWhitespace(ch) {
  return ch === ' ' || ch === '\t' || ch === '\r';
}

function isLetter(ch) {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
}

function isDigit(ch) {
  return ch >= '0' && ch <= '9';
}

function isOctalDigit(ch) {
  return ch >= '0' && ch <= '7';
}

function isHexDigit(ch) {
  return isDigit(ch) || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F');
}

function isBinaryDigit(ch) {
  return ch === '0' || ch === '1';
}

function isIdentifierStart(ch) {
  return isLetter(ch) || ch === '_';
}

function isIdentifierPart(ch) {
  return isLetter(ch) || isDigit(ch) || ch === '_';
}

export function tokenize(code) {
  const tokens = [];
  let pos = 0;
  let line = 1;
  let col = 1;
  const len = code.length;

  while (pos < len) {
    const ch = code[pos];

    if (ch === '\n') {
      line++;
      col = 1;
      pos++;
      continue;
    }

    if (isWhitespace(ch)) {
      col++;
      pos++;
      continue;
    }

    const startLine = line;
    const startCol = col;

    if (ch === '#') {
      let value = '#';
      pos++;
      col++;
      while (pos < len && code[pos] !== '\n') {
        value += code[pos];
        pos++;
        col++;
      }
      tokens.push({ type: 'PREPROCESSOR', value, line: startLine, col: startCol });
      continue;
    }

    if (ch === '/' && pos + 1 < len) {
      if (code[pos + 1] === '/') {
        let value = '//';
        pos += 2;
        col += 2;
        while (pos < len && code[pos] !== '\n') {
          value += code[pos];
          pos++;
          col++;
        }
        tokens.push({ type: 'COMMENT', value, line: startLine, col: startCol });
        continue;
      }
      if (code[pos + 1] === '*') {
        let value = '/*';
        pos += 2;
        col += 2;
        while (pos + 1 < len && !(code[pos] === '*' && code[pos + 1] === '/')) {
          if (code[pos] === '\n') {
            line++;
            col = 1;
          } else {
            col++;
          }
          value += code[pos];
          pos++;
        }
        if (pos + 1 < len) {
          value += '*/';
          pos += 2;
          col += 2;
        }
        tokens.push({ type: 'COMMENT', value, line: startLine, col: startCol });
        continue;
      }
    }

    if (ch === "'") {
      let value = "'";
      pos++;
      col++;
      if (pos < len && code[pos] === '\\') {
        value += '\\';
        pos++;
        col++;
        if (pos < len) {
          value += code[pos];
          pos++;
          col++;
        }
      } else if (pos < len && code[pos] !== "'" && code[pos] !== '\n') {
        value += code[pos];
        pos++;
        col++;
      } else if (pos < len && code[pos] === "'") {
        value += "'";
        pos++;
        col++;
        tokens.push({ type: 'CONSTANT', value: "'", line: startLine, col: startCol });
        continue;
      }
      if (pos < len && code[pos] === "'") {
        value += "'";
        pos++;
        col++;
      } else {
        tokens.push({ type: 'ERROR', value, line: startLine, col: startCol });
        continue;
      }
      tokens.push({ type: 'CONSTANT', value, line: startLine, col: startCol });
      continue;
    }

    if (ch === '"') {
      let value = '"';
      pos++;
      col++;
      while (pos < len && code[pos] !== '"') {
        if (code[pos] === '\\' && pos + 1 < len) {
          value += code[pos];
          pos++;
          col++;
          value += code[pos];
          pos++;
          col++;
        } else if (code[pos] === '\n') {
          break;
        } else {
          value += code[pos];
          pos++;
          col++;
        }
      }
      if (pos < len && code[pos] === '"') {
        value += '"';
        pos++;
        col++;
      }
      tokens.push({ type: 'STRING_LITERAL', value, line: startLine, col: startCol });
      continue;
    }

    if (isIdentifierStart(ch)) {
      let value = '';
      while (pos < len && isIdentifierPart(code[pos])) {
        value += code[pos];
        pos++;
        col++;
      }
      const type = KEYWORDS.has(value) ? 'KEYWORD' : 'IDENTIFIER';
      tokens.push({ type, value, line: startLine, col: startCol });
      continue;
    }

    if (isDigit(ch) || (ch === '.' && pos + 1 < len && isDigit(code[pos + 1]))) {
      let value = '';
      let isFloat = false;

      if (ch === '0' && pos + 1 < len) {
        const next = code[pos + 1];
        if (next === 'x' || next === 'X') {
          value = '0x';
          pos += 2;
          col += 2;
          while (pos < len && isHexDigit(code[pos])) {
            value += code[pos];
            pos++;
            col++;
          }
          tokens.push({ type: 'CONSTANT', value, line: startLine, col: startCol });
          continue;
        }
        if (next === 'b' || next === 'B') {
          value = '0b';
          pos += 2;
          col += 2;
          while (pos < len && isBinaryDigit(code[pos])) {
            value += code[pos];
            pos++;
            col++;
          }
          tokens.push({ type: 'CONSTANT', value, line: startLine, col: startCol });
          continue;
        }
        if (isOctalDigit(next)) {
          value = '0';
          pos++;
          col++;
          while (pos < len && isOctalDigit(code[pos])) {
            value += code[pos];
            pos++;
            col++;
          }
          if (pos < len && (code[pos] === 'e' || code[pos] === 'E' || code[pos] === '.' || code[pos] === 'p' || code[pos] === 'P')) {
            isFloat = true;
          } else {
            tokens.push({ type: 'CONSTANT', value, line: startLine, col: startCol });
            continue;
          }
        }
      }

      if (!isFloat) {
        value = '';

        if (ch === '.') {
          isFloat = true;
          value = '.';
          pos++;
          col++;
          while (pos < len && isDigit(code[pos])) {
            value += code[pos];
            pos++;
            col++;
          }
        } else {
          value = ch;
          pos++;
          col++;
          while (pos < len && isDigit(code[pos])) {
            value += code[pos];
            pos++;
            col++;
          }

          if (pos < len && code[pos] === '.') {
            isFloat = true;
            value += '.';
            pos++;
            col++;
            while (pos < len && isDigit(code[pos])) {
              value += code[pos];
              pos++;
              col++;
            }
          }
        }

        if (pos < len && (code[pos] === 'e' || code[pos] === 'E')) {
          isFloat = true;
          value += code[pos];
          pos++;
          col++;
          if (pos < len && (code[pos] === '+' || code[pos] === '-')) {
            value += code[pos];
            pos++;
            col++;
          }
          while (pos < len && isDigit(code[pos])) {
            value += code[pos];
            pos++;
            col++;
          }
        }
      }

      tokens.push({ type: 'CONSTANT', value, line: startLine, col: startCol });
      continue;
    }

    let matched = false;
    for (const op of OPERATORS) {
      if (code.slice(pos, pos + op.length) === op) {
        tokens.push({ type: 'OPERATOR', value: op, line: startLine, col: startCol });
        pos += op.length;
        col += op.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    if (DELIMITERS.has(ch)) {
      tokens.push({ type: 'DELIMITER', value: ch, line: startLine, col: startCol });
      pos++;
      col++;
      continue;
    }

    tokens.push({ type: 'ERROR', value: ch, line: startLine, col: startCol });
    pos++;
    col++;
  }

  return tokens;
}
