export const dfas = {
  identifier: {
    states: ['q0', 'q1', 'q_err'],
    alphabet: 'letters, digits, underscore',
    transitions: {
      q0: { letter: 'q1', underscore: 'q1' },
      q1: { letter: 'q1', digit: 'q1', underscore: 'q1' },
    },
    start: 'q0',
    accept: ['q1'],
    classify(char) {
      if (/[a-zA-Z]/.test(char)) return 'letter';
      if (char === '_') return 'underscore';
      if (/[0-9]/.test(char)) return 'digit';
      return null;
    },
  },
  number: {
    states: ['q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q_err'],
    alphabet: 'digits, ., E, +, -',
    transitions: {
      q0: { digit: 'q1' },
      q1: { digit: 'q1', dot: 'q2', E: 'q4' },
      q2: { digit: 'q3' },
      q3: { digit: 'q3', E: 'q4' },
      q4: { digit: 'q5', plus: 'q5', minus: 'q5' },
      q5: { digit: 'q5' },
    },
    start: 'q0',
    accept: ['q1', 'q3', 'q5'],
    classify(char) {
      if (/[0-9]/.test(char)) return 'digit';
      if (char === '.') return 'dot';
      if (char === 'E') return 'E';
      if (char === '+') return 'plus';
      if (char === '-') return 'minus';
      return null;
    },
  },
  operator: {
    states: ['q0', 'q1', 'q_err'],
    alphabet: '+ - * / = < > ! & |',
    transitions: {
      q0: { plus: 'q1', minus: 'q1', star: 'q1', slash: 'q1', equal: 'q1', lt: 'q1', gt: 'q1', bang: 'q1', amp: 'q1', pipe: 'q1' },
      q1: { equal: 'q1' },
    },
    start: 'q0',
    accept: ['q1'],
    classify(char) {
      const map = {
        '+': 'plus', '-': 'minus', '*': 'star', '/': 'slash',
        '=': 'equal', '<': 'lt', '>': 'gt', '!': 'bang',
        '&': 'amp', '|': 'pipe',
      };
      return map[char] || null;
    },
  },
  keyword: {
    states: ['q0', 'q1', 'q2', 'q_err'],
    alphabet: 'letters',
    transitions: {},
    start: 'q0',
    accept: ['q2'],
    keywords: [
      'int', 'float', 'char', 'double', 'void', 'if', 'else', 'for', 'while',
      'do', 'switch', 'case', 'default', 'break', 'continue', 'return',
      'struct', 'typedef', 'sizeof', 'enum', 'const', 'unsigned', 'signed',
      'static', 'extern', 'auto', 'register', 'volatile', 'goto', 'union',
      'long', 'short', 'inline', 'restrict',
    ],
    classify(char) {
      if (/[a-zA-Z]/.test(char)) return char;
      return null;
    },
  },
};

function buildKeywordTransitions(dfa) {
  const trans = {};
  const letters = new Set();
  for (const kw of dfa.keywords) {
    for (const ch of kw) {
      letters.add(ch);
    }
  }
  let stateId = 1;
  const prefixMap = {};

  for (const kw of dfa.keywords) {
    let current = '';
    for (let i = 0; i < kw.length; i++) {
      const prefix = kw.substring(0, i + 1);
      if (!prefixMap[prefix]) {
        prefixMap[prefix] = 'q' + (stateId++);
      }
      current = prefix;
    }
  }

  for (const prefix of Object.keys(prefixMap)) {
    const state = prefixMap[prefix];
    if (!trans[state]) {
      trans[state] = {};
    }
  }

  trans.q0 = {};
  for (const kw of dfa.keywords) {
    const firstChar = kw[0];
    const prefix = kw[0];
    if (!trans.q0[firstChar]) {
      const target = prefixMap[prefix] || 'q2';
      trans.q0[firstChar] = target;
    }
  }

  for (const prefix of Object.keys(prefixMap)) {
    const state = prefixMap[prefix];
    if (!trans[state]) trans[state] = {};
    for (const kw of dfa.keywords) {
      if (kw.startsWith(prefix) && kw.length > prefix.length) {
        const nextChar = kw[prefix.length];
        const nextPrefix = kw.substring(0, prefix.length + 1);
        const target = prefixMap[nextPrefix] || 'q2';
        trans[state][nextChar] = target;
      }
    }
  }

  const newAccept = [];
  for (const kw of dfa.keywords) {
    if (prefixMap[kw]) {
      newAccept.push(prefixMap[kw]);
    }
  }
  dfa.accept = [...new Set([...dfa.accept, ...newAccept])];
  dfa.transitions = trans;
}

export function simulateDFA(input, dfaType) {
  const dfa = dfas[dfaType];
  if (!dfa) {
    throw new Error(`Unknown DFA type: ${dfaType}`);
  }

  if (dfaType === 'keyword') {
    buildKeywordTransitions(dfa);
  }

  const steps = [];
  let currentState = dfa.start;
  const errorState = 'q_err';

  for (const char of input) {
    const symbol = dfa.classify(char);
    const transitions = dfa.transitions[currentState] || {};
    const nextState = transitions[symbol];

    if (nextState !== undefined) {
      steps.push({
        state: currentState,
        input: char,
        symbol,
        nextState,
      });
      currentState = nextState;
    } else {
      steps.push({
        state: currentState,
        input: char,
        symbol,
        nextState: errorState,
      });
      currentState = errorState;
      break;
    }
  }

  const accepted = dfa.accept.includes(currentState);

  return {
    accepted,
    steps,
    currentState,
  };
}

export function classifyToken(tokenValue) {
  if (tokenValue.length === 0) return null;

  const identifierResult = simulateDFA(tokenValue, 'identifier');
  if (identifierResult.accepted) {
    const keywordResult = simulateDFA(tokenValue, 'keyword');
    if (keywordResult.accepted) return 'keyword';
    return 'identifier';
  }

  const numberResult = simulateDFA(tokenValue, 'number');
  if (numberResult.accepted) return 'number';

  const operatorResult = simulateDFA(tokenValue, 'operator');
  if (operatorResult.accepted) return 'operator';

  return null;
}
