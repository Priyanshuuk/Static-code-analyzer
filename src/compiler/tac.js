let tempCounter = 0;
let labelCounter = 0;

function resetCounters() {
  tempCounter = 0;
  labelCounter = 0;
}

function newTemp() {
  return 't' + (++tempCounter);
}

function newLabel() {
  return 'L' + (++labelCounter);
}

export const TAC_OPCODES = [
  'ASSIGN', 'ARITH', 'PARAM', 'CALL', 'RETURN',
  'LABEL', 'GOTO', 'IF', 'ARRAY_ACCESS', 'ARRAY_ASSIGN',
];

function makeInst(op, dest, arg1, arg2, label, comment, arg3) {
  return { op, dest: dest || null, arg1: arg1 || null, arg2: arg2 || null, label: label || null, comment: comment || '', arg3: arg3 || null };
}

function isRelop(token) {
  return ['==', '!=', '<', '>', '<=', '>='].includes(token);
}

function negateRelop(op) {
  const map = {
    '==': '!=', '!=': '==', '<': '>=', '>': '<=', '<=': '>', '>=': '<',
  };
  return map[op] || '==';
}

export function generateTAC(tokens) {
  resetCounters();
  const insts = [];
  let pos = 0;

  function peek(offset) {
    const idx = pos + (offset || 0);
    return idx < tokens.length ? tokens[idx] : null;
  }

  function consume() {
    const tok = tokens[pos];
    pos++;
    return tok;
  }

  function expect(type, value) {
    const tok = peek();
    if (!tok) throw new Error(`Unexpected end of input, expected ${type}${value !== undefined ? ' ' + value : ''}`);
    if (tok.type !== type || (value !== undefined && tok.value !== value)) {
      throw new Error(`Expected ${type} ${value || ''} at line ${tok.line}, got ${tok.type} ${tok.value}`);
    }
    return consume();
  }

  function parseArgs() {
    const args = [];
    while (peek() && peek().type !== 'DELIMITER' && peek().value !== ')') {
      args.push(parseExpression());
      if (peek() && peek().type === 'DELIMITER' && peek().value === ',') {
        consume();
      }
    }
    return args;
  }

  function parsePrimary() {
    const tok = peek();
    if (!tok) throw new Error('Unexpected end of input in expression');

    if (tok.type === 'CONSTANT') {
      consume();
      return { kind: 'const', value: tok.value, result: tok.value, token: tok };
    }

    if (tok.type === 'IDENTIFIER') {
      consume();
      if (peek() && peek().type === 'DELIMITER' && peek().value === '(') {
        consume();
        const args = parseArgs();
        expect('DELIMITER', ')');
        const paramCounter = { count: 0 };
        for (const arg of args) {
          paramCounter.count++;
          insts.push(makeInst('PARAM', null, arg.result, null, null, `param ${arg.result}`));
        }
        const temp = newTemp();
        insts.push(makeInst('CALL', temp, tok.value, String(paramCounter.count), null, `call ${tok.value}`));
        return { kind: 'call', result: temp, token: tok };
      }
      if (peek() && peek().type === 'DELIMITER' && peek().value === '[') {
        consume();
        const indexExpr = parseExpression();
        expect('DELIMITER', ']');
        const temp = newTemp();
        insts.push(makeInst('ARRAY_ACCESS', temp, tok.value, indexExpr.result, null, `${tok.value}[${indexExpr.result}]`));
        return { kind: 'array_access', result: temp, token: tok };
      }
      return { kind: 'id', result: tok.value, token: tok };
    }

    if (tok.type === 'DELIMITER' && tok.value === '(') {
      consume();
      const expr = parseExpression();
      expect('DELIMITER', ')');
      return expr;
    }

    throw new Error(`Unexpected token in expression: ${tok.type} ${tok.value} at line ${tok.line}`);
  }

  function parseMultiplicative() {
    let left = parsePrimary();
    while (peek() && peek().type === 'OPERATOR' && ['*', '/', '%'].includes(peek().value)) {
      const opTok = consume();
      const right = parsePrimary();
      const temp = newTemp();
      insts.push(makeInst('ARITH', temp, left.result, opTok.value, null, `${temp} = ${left.result} ${opTok.value} ${right.result}`, right.result));
      left = { kind: 'arith', result: temp, token: opTok };
    }
    return left;
  }

  function parseAdditive() {
    let left = parseMultiplicative();
    while (peek() && peek().type === 'OPERATOR' && ['+', '-'].includes(peek().value)) {
      const opTok = consume();
      const right = parseMultiplicative();
      const temp = newTemp();
      insts.push(makeInst('ARITH', temp, left.result, opTok.value, null, `${temp} = ${left.result} ${opTok.value} ${right.result}`, right.result));
      left = { kind: 'arith', result: temp, token: opTok };
    }
    return left;
  }

  function parseRelational() {
    let left = parseAdditive();
    while (peek() && peek().type === 'OPERATOR' && isRelop(peek().value)) {
      const opTok = consume();
      const right = parseAdditive();
      left = { kind: 'rel', result: left.result + ' ' + opTok.value + ' ' + right.result, op: opTok.value, leftOperand: left.result, rightOperand: right.result, token: opTok };
    }
    return left;
  }

  function parseExpression() {
    return parseRelational();
  }

  function parseBlock() {
    if (peek() && peek().type === 'DELIMITER' && peek().value === '{') {
      consume();
      while (peek() && !(peek().type === 'DELIMITER' && peek().value === '}')) {
        parseStatement();
      }
      expect('DELIMITER', '}');
    } else {
      parseStatement();
    }
  }

  function parseStatement() {
    if (!peek()) return;

    const tok = peek();

    if (tok.type === 'DELIMITER' && tok.value === '{') {
      consume();
      while (peek() && !(peek().type === 'DELIMITER' && peek().value === '}')) {
        parseStatement();
      }
      expect('DELIMITER', '}');
      return;
    }

    if (tok.type === 'KEYWORD') {
      switch (tok.value) {
        case 'if': {
          consume();
          expect('DELIMITER', '(');
          const cond = parseExpression();
          expect('DELIMITER', ')');
          const elseLabel = newLabel();
          const endLabel = newLabel();

          const ifExpr = cond.leftOperand || cond.result;
          const ifOp = cond.op || '!=';
          const ifRight = cond.rightOperand || '0';

          const negOp = negateRelop(ifOp);
          insts.push(makeInst('IF', elseLabel, ifExpr, negOp, null, `if ${ifExpr} ${negOp} ${ifRight} goto ${elseLabel}`, ifRight));

          parseBlock();

          if (peek() && peek().type === 'KEYWORD' && peek().value === 'else') {
            consume();
            insts.push(makeInst('GOTO', null, endLabel, null, null, `goto ${endLabel}`));
            insts.push(makeInst('LABEL', null, null, null, elseLabel, `label ${elseLabel}`));
            parseBlock();
            insts.push(makeInst('LABEL', null, null, null, endLabel, `label ${endLabel}`));
          } else {
            insts.push(makeInst('LABEL', null, null, null, elseLabel, `label ${elseLabel}`));
          }
          break;
        }

        case 'while': {
          consume();
          const loopLabel = newLabel();
          const bodyLabel = newLabel();
          const endLabel = newLabel();

          insts.push(makeInst('LABEL', null, null, null, loopLabel, `label ${loopLabel}`));
          expect('DELIMITER', '(');
          const cond = parseExpression();
          expect('DELIMITER', ')');

          const whileCond = cond.leftOperand || cond.result;
          const whileOp = cond.op || '!=';
          const whileRight = cond.rightOperand || '0';
          const negOp = negateRelop(whileOp);

          insts.push(makeInst('IF', endLabel, whileCond, negOp, null, `if ${whileCond} ${negOp} ${whileRight} goto ${endLabel}`, whileRight));
          insts.push(makeInst('LABEL', null, null, null, bodyLabel, `label ${bodyLabel}`));

          parseBlock();

          insts.push(makeInst('GOTO', null, loopLabel, null, null, `goto ${loopLabel}`));
          insts.push(makeInst('LABEL', null, null, null, endLabel, `label ${endLabel}`));
          break;
        }

        case 'for': {
          consume();
          expect('DELIMITER', '(');
          const initExpr = parseExpression();
          if (initExpr.kind === 'id' && peek() && peek().type === 'OPERATOR' && peek().value === '=') {
            consume();
            const valExpr = parseExpression();
            insts.push(makeInst('ASSIGN', initExpr.result, valExpr.result, null, null, `${initExpr.result} = ${valExpr.result}`));
          }
          expect('DELIMITER', ';');
          const loopLabel = newLabel();
          const endLabel = newLabel();

          const cond = parseExpression();
          expect('DELIMITER', ';');

          const incrInsts = [];
          const savedPos = pos;
          while (peek() && !(peek().type === 'DELIMITER' && peek().value === ')')) {
            const e = parseExpression();
            if (e.kind === 'id' && peek() && peek().type === 'OPERATOR' && peek().value === '=') {
              consume();
              const v = parseExpression();
              incrInsts.push(makeInst('ASSIGN', e.result, v.result, null, null, `${e.result} = ${v.result}`));
            }
            if (peek() && peek().type === 'DELIMITER' && peek().value === ',') {
              consume();
            }
          }
          expect('DELIMITER', ')');

          const forCond = cond.leftOperand || cond.result;
          const forOp = cond.op || '!=';
          const forRight = cond.rightOperand || '0';
          const forNegOp = negateRelop(forOp);

          insts.push(makeInst('LABEL', null, null, null, loopLabel, `label ${loopLabel}`));
          insts.push(makeInst('IF', endLabel, forCond, forNegOp, null, `if ${forCond} ${forNegOp} ${forRight} goto ${endLabel}`, forRight));

          parseBlock();

          for (const incr of incrInsts) {
            insts.push(incr);
          }
          insts.push(makeInst('GOTO', null, loopLabel, null, null, `goto ${loopLabel}`));
          insts.push(makeInst('LABEL', null, null, null, endLabel, `label ${endLabel}`));
          break;
        }

        case 'do': {
          consume();
          const bodyLabel = newLabel();
          const loopLabel = newLabel();

          insts.push(makeInst('LABEL', null, null, null, bodyLabel, `label ${bodyLabel}`));
          parseBlock();
          expect('KEYWORD', 'while');
          expect('DELIMITER', '(');

          insts.push(makeInst('LABEL', null, null, null, loopLabel, `label ${loopLabel}`));
          const cond = parseExpression();
          expect('DELIMITER', ')');
          expect('DELIMITER', ';');

          const doCond = cond.leftOperand || cond.result;
          const doOp = cond.op || '!=';
          const doRight = cond.rightOperand || '0';

          insts.push(makeInst('IF', bodyLabel, doCond, doOp, null, `if ${doCond} ${doOp} ${doRight} goto ${bodyLabel}`, doRight));
          break;
        }

        case 'return': {
          consume();
          const retExpr = parseExpression();
          insts.push(makeInst('RETURN', null, retExpr.result, null, null, `return ${retExpr.result}`));
          expect('DELIMITER', ';');
          break;
        }

        default:
          consume();
          break;
      }
      return;
    }

    if (tok.type === 'DELIMITER' && tok.value === ';') {
      consume();
      return;
    }

    let expr = parseExpression();

    if (peek() && peek().type === 'OPERATOR' && peek().value === '=') {
      consume();
      const val = parseExpression();
      if (peek() && peek().type === 'DELIMITER' && peek().value === '=') {
        return;
      }
      const destId = expr.result;
      insts.push(makeInst('ASSIGN', destId, val.result, null, null, `${destId} = ${val.result}`));
    } else if (peek() && peek().type === 'OPERATOR' && ['+=', '-=', '*=', '/=', '%='].includes(peek().value)) {
      const opTok = consume();
      const val = parseExpression();
      const destId = expr.result;
      const op = opTok.value[0];
      const temp = newTemp();
      insts.push(makeInst('ARITH', temp, destId, op, null, `${temp} = ${destId} ${op} ${val.result}`, val.result));
      insts.push(makeInst('ASSIGN', destId, temp, null, null, `${destId} = ${temp}`));
    }

    if (peek() && peek().type === 'DELIMITER' && peek().value === ';') {
      consume();
    }
  }

  while (pos < tokens.length) {
    const tok = peek();
    if (!tok) break;

    if (tok.type === 'COMMENT' || tok.type === 'PREPROCESSOR') {
      consume();
      continue;
    }

    if (tok.type === 'KEYWORD') {
      parseStatement();
      continue;
    }

    if (tok.type === 'DELIMITER' && tok.value === ';') {
      consume();
      continue;
    }

    if (tok.type === 'DELIMITER' && tok.value === '}') {
      consume();
      continue;
    }

    parseStatement();
  }

  return insts;
}

export function instructionToString(inst) {
  const { op, dest, arg1, arg2, arg3, label, comment } = inst;
  let result = '';

  switch (op) {
    case 'ASSIGN':
      result = `${dest} = ${arg1}`;
      break;
    case 'ARITH':
      result = `${dest} = ${arg1} ${arg2} ${arg3 || ''}`;
      break;
    case 'PARAM':
      result = `param ${arg1}`;
      break;
    case 'CALL':
      result = `${dest} = call ${arg1}, ${arg2}`;
      break;
    case 'RETURN':
      result = `return ${arg1}`;
      break;
    case 'LABEL':
      result = `${label}:`;
      break;
    case 'GOTO':
      result = `goto ${arg1}`;
      break;
    case 'IF':
      result = `if ${arg1} ${arg2} ${arg3 || ''} goto ${dest}`;
      break;
    case 'ARRAY_ACCESS':
      result = `${dest} = ${arg1}[${arg2}]`;
      break;
    case 'ARRAY_ASSIGN':
      result = `${arg1}[${arg2}] = ${dest}`;
      break;
    default:
      result = `${op} ${dest ? dest + ' ' : ''}${arg1 || ''} ${arg2 || ''}`;
  }

  if (comment) {
    result += '  // ' + comment;
  }

  return result;
}

export function tacToString(insts) {
  if (Array.isArray(insts)) {
    return insts.map(instructionToString).join('\n');
  }
  return instructionToString(insts);
}
