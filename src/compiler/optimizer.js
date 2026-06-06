function isConstant(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === 'number') return true;
  if (typeof val === 'string') {
    if (/^-?\d+$/.test(val)) return true;
    if (/^-?\d+\.\d+$/.test(val)) return true;
    if (/^0x[0-9a-fA-F]+$/.test(val)) return true;
    if (/^0[0-7]+$/.test(val)) return true;
    if (/^\d+[eE][+-]?\d+$/.test(val)) return true;
    if (/^\d+\.\d*[eE][+-]?\d+$/.test(val)) return true;
  }
  return false;
}

function parseConstValue(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    if (/^0x[0-9a-fA-F]+$/.test(val)) return parseInt(val, 16);
    if (/^0[0-7]+$/.test(val)) return parseInt(val, 8);
    if (/^0b[01]+$/i.test(val)) return parseInt(val.slice(2), 2);
    if (/^[eE]/.test(val)) return parseFloat(val);
    return parseFloat(val);
  }
  return NaN;
}

function copyInst(inst) {
  return { ...inst, arg3: inst.arg3 };
}

export function applyConstantFolding(insts) {
  const result = [];

  for (const inst of insts) {
    const newInst = copyInst(inst);

    if (newInst.op === 'ARITH' && isConstant(newInst.arg1) && newInst.arg3 && isConstant(newInst.arg3)) {
      const left = parseConstValue(newInst.arg1);
      const right = parseConstValue(newInst.arg3);
      let folded;
      const op = newInst.arg2;
      switch (op) {
        case '+': folded = left + right; break;
        case '-': folded = left - right; break;
        case '*': folded = left * right; break;
        case '/':
          if (right !== 0) folded = left / right;
          else folded = left / right;
          break;
        case '%':
          if (right !== 0) folded = left % right;
          else folded = left % right;
          break;
        default:
          folded = null;
      }
      if (folded !== null && Number.isFinite(folded)) {
        result.push({
          op: 'ASSIGN',
          dest: newInst.dest,
          arg1: String(folded),
          arg2: null,
          label: null,
          comment: `folded ${newInst.arg1} ${op} ${newInst.arg3} → ${folded}`,
        });
        continue;
      }
    }

    result.push(newInst);
  }
  return result;
}

export function applyConstantPropagation(insts) {
  const result = [];
  const constValues = {};

  for (const inst of insts) {
    const newInst = copyInst(inst);

    if (newInst.arg1 && constValues[newInst.arg1] !== undefined) {
      if (newInst.op !== 'ASSIGN' || newInst.dest !== newInst.arg1) {
        newInst.arg1 = constValues[newInst.arg1];
      }
    }
    if (newInst.arg3 && constValues[newInst.arg3] !== undefined) {
      newInst.arg3 = constValues[newInst.arg3];
    }
    if (newInst.arg2 && constValues[newInst.arg2] !== undefined && newInst.arg2 !== '+' && newInst.arg2 !== '-' && newInst.arg2 !== '*' && newInst.arg2 !== '/' && newInst.arg2 !== '%' && newInst.arg2 !== '==' && newInst.arg2 !== '!=' && newInst.arg2 !== '<' && newInst.arg2 !== '>' && newInst.arg2 !== '<=' && newInst.arg2 !== '>=') {
      newInst.arg2 = constValues[newInst.arg2];
    }

    if (newInst.op === 'ASSIGN' && isConstant(newInst.arg1)) {
      constValues[newInst.dest] = newInst.arg1;
    } else if (newInst.op === 'ARITH' && newInst.dest) {
      delete constValues[newInst.dest];
    } else if (newInst.dest) {
      if (newInst.op !== 'PARAM' && newInst.op !== 'CALL' && newInst.op !== 'GOTO' && newInst.op !== 'LABEL' && newInst.op !== 'IF' && newInst.op !== 'RETURN') {
        delete constValues[newInst.dest];
      }
    }

    if (newInst.op === 'CALL' || newInst.op === 'PARAM' || newInst.op === 'RETURN') {
      const keys = Object.keys(constValues);
      for (const k of keys) {
        if (k.startsWith('t')) {
          delete constValues[k];
        }
      }
    }

    result.push(newInst);
  }
  return result;
}

export function applyAlgebraicSimplification(insts) {
  const result = [];

  for (const inst of insts) {
    const newInst = copyInst(inst);
    let simplified = false;

    if (newInst.op === 'ARITH') {
      const op = newInst.arg2;
      const arg1IsZero = newInst.arg1 === '0' || newInst.arg1 === 0;
      const arg1IsOne = newInst.arg1 === '1' || newInst.arg1 === 1;
      const arg3IsZero = newInst.arg3 === '0' || newInst.arg3 === 0;
      const arg3IsOne = newInst.arg3 === '1' || newInst.arg3 === 1;

      if (op === '+' && arg3IsZero) {
        result.push({ op: 'ASSIGN', dest: newInst.dest, arg1: newInst.arg1, arg2: null, label: null, comment: `${newInst.dest} = ${newInst.arg1} (x + 0 → x)` });
        simplified = true;
      } else if (op === '+' && arg1IsZero) {
        result.push({ op: 'ASSIGN', dest: newInst.dest, arg1: newInst.arg3, arg2: null, label: null, comment: `${newInst.dest} = ${newInst.arg3} (0 + x → x)` });
        simplified = true;
      } else if (op === '-' && arg3IsZero) {
        result.push({ op: 'ASSIGN', dest: newInst.dest, arg1: newInst.arg1, arg2: null, label: null, comment: `${newInst.dest} = ${newInst.arg1} (x - 0 → x)` });
        simplified = true;
      } else if (op === '-' && newInst.arg1 === newInst.arg3) {
        result.push({ op: 'ASSIGN', dest: newInst.dest, arg1: '0', arg2: null, label: null, comment: `${newInst.dest} = 0 (x - x → 0)` });
        simplified = true;
      } else if (op === '*' && arg3IsOne) {
        result.push({ op: 'ASSIGN', dest: newInst.dest, arg1: newInst.arg1, arg2: null, label: null, comment: `${newInst.dest} = ${newInst.arg1} (x * 1 → x)` });
        simplified = true;
      } else if (op === '*' && arg1IsOne) {
        result.push({ op: 'ASSIGN', dest: newInst.dest, arg1: newInst.arg3, arg2: null, label: null, comment: `${newInst.dest} = ${newInst.arg3} (1 * x → x)` });
        simplified = true;
      } else if (op === '*' && (arg3IsZero || arg1IsZero)) {
        result.push({ op: 'ASSIGN', dest: newInst.dest, arg1: '0', arg2: null, label: null, comment: `${newInst.dest} = 0 (x * 0 → 0)` });
        simplified = true;
      } else if (op === '/' && arg3IsOne) {
        result.push({ op: 'ASSIGN', dest: newInst.dest, arg1: newInst.arg1, arg2: null, label: null, comment: `${newInst.dest} = ${newInst.arg1} (x / 1 → x)` });
        simplified = true;
      }
    }

    if (!simplified) {
      result.push(newInst);
    }
  }
  return result;
}

export function applyCSE(insts) {
  const result = [];
  const exprCache = {};

  for (const inst of insts) {
    const newInst = copyInst(inst);

    if (newInst.op === 'ARITH') {
      const key = `${newInst.arg1}|${newInst.arg2}|${newInst.arg3 || ''}`;
      if (exprCache[key] !== undefined) {
        result.push({
          op: 'ASSIGN',
          dest: newInst.dest,
          arg1: exprCache[key],
          arg2: null,
          label: null,
          comment: `reuse ${exprCache[key]} for ${newInst.arg1} ${newInst.arg2} ${newInst.arg3 || ''}`,
        });
        continue;
      }
      exprCache[key] = newInst.dest;
    }

    if (newInst.op === 'ARRAY_ACCESS') {
      const key = `arr|${newInst.arg1}|${newInst.arg2}`;
      if (exprCache[key] !== undefined) {
        result.push({
          op: 'ASSIGN',
          dest: newInst.dest,
          arg1: exprCache[key],
          arg2: null,
          label: null,
          comment: `reuse ${exprCache[key]} for ${newInst.arg1}[${newInst.arg2}]`,
        });
        continue;
      }
      exprCache[key] = newInst.dest;
    }

    result.push(newInst);
  }
  return result;
}

export function applyDeadCodeElimination(insts) {
  const usedVars = new Set();
  const assignInsts = [];

  for (let i = insts.length - 1; i >= 0; i--) {
    const inst = insts[i];
    if (inst.arg1 && inst.op !== 'ASSIGN') usedVars.add(inst.arg1);
    if (inst.arg2 && inst.op !== 'GOTO' && inst.op !== 'LABEL' && inst.op !== 'PARAM') {
      if (inst.arg2 !== '+' && inst.arg2 !== '-' && inst.arg2 !== '*' && inst.arg2 !== '/' && inst.arg2 !== '%' &&
          inst.arg2 !== '==' && inst.arg2 !== '!=' && inst.arg2 !== '<' && inst.arg2 !== '>' &&
          inst.arg2 !== '<=' && inst.arg2 !== '>=') {
        usedVars.add(inst.arg2);
      }
    }
    if (inst.arg3) usedVars.add(inst.arg3);
    assignInsts.unshift(inst);
  }

  const result = [];
  const killedDefs = new Set();

  for (let i = 0; i < insts.length; i++) {
    const inst = insts[i];
    const newInst = copyInst(inst);

    if (newInst.op === 'ASSIGN' && newInst.dest) {
      if (usedVars.has(newInst.dest)) {
        result.push(newInst);
      } else if (newInst.dest.startsWith('t')) {
        if (newInst.comment) {
          newInst.comment = 'dead: ' + newInst.comment;
        }
        continue;
      } else {
        result.push(newInst);
      }
    } else if (newInst.op === 'ARITH' && newInst.dest) {
      if (usedVars.has(newInst.dest)) {
        result.push(newInst);
      } else if (newInst.dest.startsWith('t')) {
        continue;
      } else {
        result.push(newInst);
      }
    } else {
      result.push(newInst);
    }
  }

  return result;
}

export function simplifyControlFlow(insts) {
  const result = [];
  const labels = new Set();
  const gotoLabels = new Set();
  let i = 0;

  for (const inst of insts) {
    if (inst.op === 'LABEL') {
      labels.add(inst.label);
    }
    if (inst.op === 'GOTO') {
      gotoLabels.add(inst.arg1);
    }
    if (inst.op === 'IF') {
      gotoLabels.add(inst.dest);
    }
  }

  for (const inst of insts) {
    const newInst = copyInst(inst);
    result.push(newInst);
  }

  let unreachable = false;
  const filtered = [];

  for (const inst of result) {
    if (inst.op === 'GOTO') {
      unreachable = true;
      filtered.push(inst);
      continue;
    }

    if (inst.op === 'LABEL') {
      unreachable = false;
      filtered.push(inst);
      continue;
    }

    if (unreachable) {
      continue;
    }

    filtered.push(inst);
  }

  for (const inst of filtered) {
    if (inst.op === 'GOTO') {
      let next = null;
      const idx = filtered.indexOf(inst);
      for (let j = idx + 1; j < filtered.length; j++) {
        if (filtered[j].op === 'LABEL') {
          next = filtered[j].label;
          break;
        }
      }
      if (next === inst.arg1) {
        inst.comment = `dead goto → ${inst.arg1}`;
        continue;
      }
    }
  }

  const finalLabels = new Set();
  for (const inst of filtered) {
    if (inst.op === 'LABEL') {
      if (gotoLabels.has(inst.label)) {
        finalLabels.add(inst.label);
      }
    }
  }

  const cleaned = [];
  for (const inst of filtered) {
    if (inst.op === 'LABEL' && !finalLabels.has(inst.label) && !inst.label.startsWith('L')) {
      cleaned.push(inst);
      continue;
    }
    if (inst.op === 'LABEL' && !finalLabels.has(inst.label) && inst.label) {
      continue;
    }
    cleaned.push(inst);
  }

  const unreachableLabels = new Set();
  let afterGoto = false;
  for (const inst of cleaned) {
    if (inst.op === 'GOTO') {
      afterGoto = true;
    } else if (inst.op === 'LABEL') {
      if (afterGoto) {
        afterGoto = false;
      }
    } else if (inst.op !== 'LABEL') {
      afterGoto = false;
    }
  }

  return cleaned;
}

export function optimize(insts) {
  let result = insts;

  for (let i = 0; i < 3; i++) {
    result = applyConstantFolding(result);
    result = applyConstantPropagation(result);
    result = applyAlgebraicSimplification(result);
    result = applyCSE(result);
    result = applyDeadCodeElimination(result);
    result = simplifyControlFlow(result);
  }

  return result;
}
