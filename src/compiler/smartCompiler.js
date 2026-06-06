const keywords = new Set([
  'let', 'if', 'else', 'while', 'print',
  'true', 'false', 'int', 'float', 'string', 'bool'
]);

const types = new Set(['int', 'float', 'string', 'bool']);

const operators = new Set([
  '+', '-', '*', '/', '%', '=',
  '==', '!=', '<', '>', '<=', '>=', '!'
]);

const delimiters = new Set([';', ',', '.', '(', ')', '{', '}', ':']);

class Token {
  constructor(type, value, line, col) {
    this.type = type;
    this.value = value;
    this.line = line;
    this.col = col;
  }
}

class Lexer {
  constructor(code) {
    this.code = code;
    this.pos = 0;
    this.line = 1;
    this.col = 1;
    this.tokens = [];
  }

  isAtEnd() {
    return this.pos >= this.code.length;
  }

  peek() {
    if (this.isAtEnd()) return '\0';
    return this.code[this.pos];
  }

  peekNext() {
    if (this.pos + 1 >= this.code.length) return '\0';
    return this.code[this.pos + 1];
  }

  advance() {
    const ch = this.code[this.pos];
    this.pos++;
    if (ch === '\n') {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return ch;
  }

  skipWhitespace() {
    while (!this.isAtEnd() && /\s/.test(this.peek())) {
      this.advance();
    }
  }

  skipSingleLineComment() {
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance();
    }
  }

  skipMultiLineComment() {
    while (!this.isAtEnd()) {
      if (this.peek() === '*' && this.peekNext() === '/') {
        this.advance();
        this.advance();
        return;
      }
      this.advance();
    }
  }

  readString() {
    const startLine = this.line;
    const startCol = this.col;
    let value = '';
    this.advance();
    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === '\\') {
        this.advance();
        switch (this.peek()) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case 'r': value += '\r'; break;
          case '\\': value += '\\'; break;
          case '"': value += '"'; break;
          default: value += '\\' + this.peek(); break;
        }
        this.advance();
      } else {
        value += this.advance();
      }
    }
    if (this.isAtEnd()) {
      throw new Error(`Unterminated string at ${startLine}:${startCol}`);
    }
    this.advance();
    return value;
  }

  readNumber() {
    let value = '';
    while (!this.isAtEnd() && /\d/.test(this.peek())) {
      value += this.advance();
    }
    if (this.peek() === '.' && /\d/.test(this.peekNext())) {
      value += this.advance();
      while (!this.isAtEnd() && /\d/.test(this.peek())) {
        value += this.advance();
      }
    }
    return value;
  }

  readIdentifier() {
    let value = '';
    while (!this.isAtEnd() && /[a-zA-Z0-9_]/.test(this.peek())) {
      value += this.advance();
    }
    return value;
  }

  readOperator() {
    const twoCharOps = ['==', '!=', '<=', '>='];
    const twoChar = this.peek() + this.peekNext();
    if (twoCharOps.includes(twoChar)) {
      this.advance();
      this.advance();
      return twoChar;
    }
    return this.advance();
  }

  tokenize() {
    while (!this.isAtEnd()) {
      this.skipWhitespace();
      if (this.isAtEnd()) break;

      const ch = this.peek();

      if (ch === '/' && this.peekNext() === '/') {
        this.skipSingleLineComment();
        continue;
      }
      if (ch === '/' && this.peekNext() === '*') {
        this.advance();
        this.advance();
        this.skipMultiLineComment();
        continue;
      }

      const line = this.line;
      const col = this.col;

      if (ch === '"') {
        const value = this.readString();
        this.tokens.push(new Token('STRING', value, line, col));
        continue;
      }

      if (/\d/.test(ch)) {
        const value = this.readNumber();
        this.tokens.push(new Token('NUMBER', value, line, col));
        continue;
      }

      if (/[a-zA-Z_]/.test(ch)) {
        const value = this.readIdentifier();
        if (keywords.has(value)) {
          this.tokens.push(new Token('KEYWORD', value, line, col));
        } else {
          this.tokens.push(new Token('IDENTIFIER', value, line, col));
        }
        continue;
      }

      if (operators.has(ch) || (ch === '!' && this.peekNext() === '=') ||
          (ch === '=' && this.peekNext() === '=') ||
          (ch === '<' && this.peekNext() === '=') ||
          (ch === '>' && this.peekNext() === '=')) {
        const value = this.readOperator();
        this.tokens.push(new Token('OPERATOR', value, line, col));
        continue;
      }

      if (delimiters.has(ch)) {
        this.advance();
        this.tokens.push(new Token('DELIMITER', ch, line, col));
        continue;
      }

      throw new Error(`Unexpected character '${ch}' at ${line}:${col}`);
    }

    this.tokens.push(new Token('EOF', null, this.line, this.col));
    return this.tokens;
  }
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.errors = [];
    this.syncPoints = new Set([';', '}', 'EOF']);
  }

  peek() {
    return this.tokens[this.pos];
  }

  previous() {
    return this.tokens[this.pos - 1];
  }

  check(type, value) {
    const tok = this.peek();
    if (type === 'KEYWORD' && value !== undefined) {
      return tok.type === 'KEYWORD' && tok.value === value;
    }
    if (type === 'OPERATOR' && value !== undefined) {
      return tok.type === 'OPERATOR' && tok.value === value;
    }
    if (type === 'DELIMITER' && value !== undefined) {
      return tok.type === 'DELIMITER' && tok.value === value;
    }
    return tok.type === type;
  }

  advance() {
    const tok = this.tokens[this.pos];
    this.pos++;
    return tok;
  }

  consume(type, value, message) {
    if (this.check(type, value)) {
      return this.advance();
    }
    const tok = this.peek();
    const got = value
      ? `${tok.value} (${tok.type})`
      : tok.value;
    this.errors.push({
      message: `${message} at ${tok.line}:${tok.col}, got '${got}'`,
      line: tok.line,
      col: tok.col
    });
    return null;
  }

  isAtEnd() {
    return this.peek().type === 'EOF';
  }

  synchronize() {
    while (!this.isAtEnd()) {
      if (this.syncPoints.has(this.peek().value)) {
        if (this.peek().value === ';') {
          this.advance();
        }
        return;
      }
      this.advance();
    }
  }

  parse() {
    const body = [];
    while (!this.isAtEnd()) {
      try {
        const stmt = this.parseStatement();
        if (stmt) {
          body.push(stmt);
        } else {
          this.advance();
        }
      } catch (e) {
        this.errors.push({
          message: e.message,
          line: this.peek().line,
          col: this.peek().col
        });
        this.synchronize();
      }
    }
    return { type: 'Program', body };
  }

  parseStatement() {
    if (this.check('KEYWORD', 'let')) return this.parseDeclaration();
    if (this.check('KEYWORD', 'if')) return this.parseIfStmt();
    if (this.check('KEYWORD', 'while')) return this.parseWhileStmt();
    if (this.check('KEYWORD', 'print')) return this.parsePrintStmt();
    if (this.check('DELIMITER', '{')) return this.parseBlock();
    if (this.check('IDENTIFIER')) return this.parseAssignment();
    if (this.check('KEYWORD', 'else')) {
      const tok = this.peek();
      this.errors.push({
        message: `Unexpected 'else' without matching 'if' at ${tok.line}:${tok.col}`,
        line: tok.line,
        col: tok.col
      });
      this.advance();
      return null;
    }
    const tok = this.peek();
    this.errors.push({
      message: `Unexpected token '${tok.value}' at ${tok.line}:${tok.col}`,
      line: tok.line,
      col: tok.col
    });
    this.advance();
    return null;
  }

  parseDeclaration() {
    const kwd = this.advance();
    const nameTok = this.consume('IDENTIFIER', undefined, 'Expected identifier in declaration');
    this.consume('DELIMITER', ':', 'Expected ":" in declaration');
    const typeTok = this.consume('KEYWORD', undefined, 'Expected type (int|float|string|bool) in declaration');

    if (!nameTok || !typeTok) {
      this.synchronize();
      return null;
    }

    const name = nameTok.value;
    const varType = typeTok.value;
    let initializer = null;

    if (this.check('OPERATOR', '=')) {
      this.advance();
      initializer = this.parseExpression();
    }

    this.consume('DELIMITER', ';', 'Expected ";" after declaration');
    return { type: 'LetDecl', name, varType, initializer };
  }

  parseAssignment() {
    const nameTok = this.advance();
    this.consume('OPERATOR', '=', 'Expected "=" in assignment');
    const value = this.parseExpression();
    this.consume('DELIMITER', ';', 'Expected ";" after assignment');
    return { type: 'Assignment', name: nameTok.value, value };
  }

  parseIfStmt() {
    this.advance();
    this.consume('DELIMITER', '(', 'Expected "(" after "if"');
    const condition = this.parseExpression();
    this.consume('DELIMITER', ')', 'Expected ")" after condition');
    const consequent = this.parseStatement();
    let alternate = null;
    if (this.check('KEYWORD', 'else')) {
      this.advance();
      alternate = this.parseStatement();
    }
    return { type: 'IfStmt', condition, consequent, alternate };
  }

  parseWhileStmt() {
    this.advance();
    this.consume('DELIMITER', '(', 'Expected "(" after "while"');
    const condition = this.parseExpression();
    this.consume('DELIMITER', ')', 'Expected ")" after condition');
    const body = this.parseStatement();
    return { type: 'WhileStmt', condition, body };
  }

  parsePrintStmt() {
    this.advance();
    this.consume('DELIMITER', '(', 'Expected "(" after "print"');
    const argument = this.parseExpression();
    this.consume('DELIMITER', ')', 'Expected ")" after argument');
    this.consume('DELIMITER', ';', 'Expected ";" after print');
    return { type: 'PrintStmt', argument };
  }

  parseBlock() {
    this.advance();
    const body = [];
    while (!this.check('DELIMITER', '}') && !this.isAtEnd()) {
      try {
        const stmt = this.parseStatement();
        if (stmt) body.push(stmt);
      } catch (e) {
        this.errors.push({
          message: e.message,
          line: this.peek().line,
          col: this.peek().col
        });
        this.synchronize();
      }
    }
    this.consume('DELIMITER', '}', 'Expected "}" after block');
    return { type: 'Block', body };
  }

  parseExpression() {
    return this.parseEquality();
  }

  parseEquality() {
    let left = this.parseComparison();
    while (this.check('OPERATOR', '==') || this.check('OPERATOR', '!=')) {
      const op = this.advance().value;
      const right = this.parseComparison();
      left = { type: 'BinaryExpr', operator: op, left, right };
    }
    return left;
  }

  parseComparison() {
    let left = this.parseTerm();
    while (
      this.check('OPERATOR', '<') || this.check('OPERATOR', '>') ||
      this.check('OPERATOR', '<=') || this.check('OPERATOR', '>=')
    ) {
      const op = this.advance().value;
      const right = this.parseTerm();
      left = { type: 'BinaryExpr', operator: op, left, right };
    }
    return left;
  }

  parseTerm() {
    let left = this.parseFactor();
    while (this.check('OPERATOR', '+') || this.check('OPERATOR', '-')) {
      const op = this.advance().value;
      const right = this.parseFactor();
      left = { type: 'BinaryExpr', operator: op, left, right };
    }
    return left;
  }

  parseFactor() {
    let left = this.parseUnary();
    while (
      this.check('OPERATOR', '*') || this.check('OPERATOR', '/') ||
      this.check('OPERATOR', '%')
    ) {
      const op = this.advance().value;
      const right = this.parseUnary();
      left = { type: 'BinaryExpr', operator: op, left, right };
    }
    return left;
  }

  parseUnary() {
    if (this.check('OPERATOR', '-') || this.check('OPERATOR', '!')) {
      const op = this.advance().value;
      const arg = this.parseUnary();
      return { type: 'UnaryExpr', operator: op, argument: arg };
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const tok = this.peek();

    if (tok.type === 'NUMBER') {
      this.advance();
      const isFloat = tok.value.includes('.');
      return {
        type: 'Literal',
        value: isFloat ? parseFloat(tok.value) : parseInt(tok.value, 10),
        literalType: 'number'
      };
    }

    if (tok.type === 'STRING') {
      this.advance();
      return { type: 'Literal', value: tok.value, literalType: 'string' };
    }

    if (tok.type === 'KEYWORD' && (tok.value === 'true' || tok.value === 'false')) {
      this.advance();
      return { type: 'Literal', value: tok.value === 'true', literalType: 'boolean' };
    }

    if (tok.type === 'IDENTIFIER') {
      this.advance();
      return { type: 'Identifier', name: tok.value };
    }

    if (tok.type === 'DELIMITER' && tok.value === '(') {
      this.advance();
      const expr = this.parseExpression();
      this.consume('DELIMITER', ')', 'Expected ")" after expression');
      return expr;
    }

    const errMsg = `Unexpected token '${tok.value}' at ${tok.line}:${tok.col}`;
    this.errors.push({
      message: errMsg,
      line: tok.line,
      col: tok.col
    });
    this.advance();
    return { type: 'Literal', value: null, literalType: 'number' };
  }
}

class Environment {
  constructor(parent = null) {
    this.parent = parent;
    this.variables = new Map();
  }

  define(name, value, varType) {
    this.variables.set(name, { value, type: varType });
  }

  get(name) {
    if (this.variables.has(name)) {
      return this.variables.get(name);
    }
    if (this.parent) {
      return this.parent.get(name);
    }
    return null;
  }

  assign(name, value) {
    if (this.variables.has(name)) {
      const entry = this.variables.get(name);
      entry.value = value;
      return true;
    }
    if (this.parent) {
      return this.parent.assign(name, value);
    }
    return false;
  }

  has(name) {
    if (this.variables.has(name)) return true;
    if (this.parent) return this.parent.has(name);
    return false;
  }

  resolve(name) {
    if (this.variables.has(name)) return this;
    if (this.parent) return this.parent.resolve(name);
    return null;
  }
}

class Interpreter {
  constructor() {
    this.globalEnv = new Environment();
    this.env = this.globalEnv;
    this.output = [];
    this.errors = [];
  }

  pushScope() {
    this.env = new Environment(this.env);
  }

  popScope() {
    if (this.env.parent) {
      this.env = this.env.parent;
    }
  }

  visit(node) {
    if (!node) return null;

    switch (node.type) {
      case 'Program':
        return this.visitProgram(node);
      case 'LetDecl':
        return this.visitLetDecl(node);
      case 'Assignment':
        return this.visitAssignment(node);
      case 'IfStmt':
        return this.visitIfStmt(node);
      case 'WhileStmt':
        return this.visitWhileStmt(node);
      case 'PrintStmt':
        return this.visitPrintStmt(node);
      case 'Block':
        return this.visitBlock(node);
      case 'BinaryExpr':
        return this.visitBinaryExpr(node);
      case 'UnaryExpr':
        return this.visitUnaryExpr(node);
      case 'Literal':
        return this.visitLiteral(node);
      case 'Identifier':
        return this.visitIdentifier(node);
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  visitProgram(node) {
    let result = null;
    for (const stmt of node.body) {
      result = this.visit(stmt);
    }
    return result;
  }

  visitLetDecl(node) {
    let value = null;
    if (node.initializer) {
      value = this.visit(node.initializer);
    }
    this.env.define(node.name, value, node.varType);
    return null;
  }

  visitAssignment(node) {
    const value = this.visit(node.value);
    if (!this.env.assign(node.name, value)) {
      this.errors.push(`Runtime error: undefined variable '${node.name}'`);
    }
    return null;
  }

  visitIfStmt(node) {
    const condition = this.visit(node.condition);
    if (condition) {
      return this.visit(node.consequent);
    } else if (node.alternate) {
      return this.visit(node.alternate);
    }
    return null;
  }

  visitWhileStmt(node) {
    let result = null;
    const maxIter = 10000;
    let iter = 0;
    while (this.visit(node.condition)) {
      result = this.visit(node.body);
      iter++;
      if (iter > maxIter) {
        this.errors.push('Runtime error: infinite loop detected (max 10000 iterations)');
        break;
      }
    }
    return result;
  }

  visitPrintStmt(node) {
    const value = this.visit(node.argument);
    let str;
    if (typeof value === 'number') {
      str = value % 1 === 0 ? value.toString() : value.toFixed(6).replace(/\.?0+$/, '');
    } else if (typeof value === 'boolean') {
      str = value ? 'true' : 'false';
    } else if (value === null) {
      str = 'null';
    } else {
      str = String(value);
    }
    this.output.push(str);
    return null;
  }

  visitBlock(node) {
    this.pushScope();
    let result = null;
    for (const stmt of node.body) {
      result = this.visit(stmt);
    }
    this.popScope();
    return result;
  }

  visitBinaryExpr(node) {
    const left = this.visit(node.left);
    const right = this.visit(node.right);

    switch (node.operator) {
      case '+':
        if (typeof left === 'string' || typeof right === 'string') {
          return String(left) + String(right);
        }
        return left + right;
      case '-':
        return left - right;
      case '*':
        return left * right;
      case '/':
        if (right === 0) {
          this.errors.push('Runtime error: division by zero');
          return 0;
        }
        return left / right;
      case '%':
        if (right === 0) {
          this.errors.push('Runtime error: modulo by zero');
          return 0;
        }
        return left % right;
      case '==':
        return left === right;
      case '!=':
        return left !== right;
      case '<':
        return left < right;
      case '>':
        return left > right;
      case '<=':
        return left <= right;
      case '>=':
        return left >= right;
      default:
        throw new Error(`Unknown operator: ${node.operator}`);
    }
  }

  visitUnaryExpr(node) {
    const arg = this.visit(node.argument);
    switch (node.operator) {
      case '-':
        return -arg;
      case '!':
        return !arg;
      default:
        throw new Error(`Unknown unary operator: ${node.operator}`);
    }
  }

  visitLiteral(node) {
    return node.value;
  }

  visitIdentifier(node) {
    const binding = this.env.get(node.name);
    if (!binding) {
      this.errors.push(`Runtime error: undefined variable '${node.name}'`);
      return null;
    }
    return binding.value;
  }
}

class StaticAnalyzer {
  constructor() {
    this.symbolTable = [];
    this.warnings = [];
    this.errors = [];
    this.scopeStack = ['global'];
    this.scopeIndex = 0;
    this.currentScope = 0;
    this.declaredInScope = new Map();
    this.usedVars = new Set();
    this.initMap = new Map();
    this.passwordPattern = /password|passwd|pwd|secret|key/i;
  }

  pushScope(name) {
    this.scopeStack.push(name);
    this.currentScope++;
    this.declaredInScope.set(this.currentScope, []);
    return this.currentScope;
  }

  popScope() {
    const scope = this.scopeStack.pop();
    this.currentScope--;
    return scope;
  }

  visit(node) {
    if (!node) return;

    switch (node.type) {
      case 'Program':
        this.visitProgram(node);
        break;
      case 'LetDecl':
        this.visitLetDecl(node);
        break;
      case 'Assignment':
        this.visitAssignment(node);
        break;
      case 'IfStmt':
        this.visitIfStmt(node);
        break;
      case 'WhileStmt':
        this.visitWhileStmt(node);
        break;
      case 'PrintStmt':
        this.visitPrintStmt(node);
        break;
      case 'Block':
        this.visitBlock(node);
        break;
      case 'BinaryExpr':
        return this.visitBinaryExpr(node);
      case 'UnaryExpr':
        return this.visitUnaryExpr(node);
      case 'Literal':
        return node.value;
      case 'Identifier':
        return this.visitIdentifier(node);
    }
  }

  visitProgram(node) {
    this.declaredInScope.set(0, []);
    for (const stmt of node.body) {
      this.visit(stmt);
    }
    for (const [scope, decls] of this.declaredInScope) {
      for (const name of decls) {
        if (!this.usedVars.has(name)) {
          this.warnings.push({
            message: `Unused variable '${name}'`,
            scope
          });
        }
      }
    }
  }

  visitLetDecl(node) {
    this.declaredInScope.get(this.currentScope).push(node.name);

    const existing = this.symbolTable.find(
      s => s.name === node.name && s.scope === this.scopeStack[this.scopeStack.length - 1]
    );
    if (existing) {
      this.errors.push({
        message: `Redeclared variable '${node.name}' in same scope`,
        line: node.initializer?.line || 0,
        col: node.initializer?.col || 0
      });
      return;
    }

    let initValue = null;
    if (node.initializer) {
      initValue = this.visit(node.initializer);
      const initType = this.inferType(node.initializer, initValue);
      if (initType && node.varType !== initType) {
        if (!(node.varType === 'float' && initType === 'int') &&
            !(node.varType === 'int' && initType === 'float' && Number.isInteger(initValue))) {
          this.warnings.push({
            message: `Type mismatch: cannot assign ${initType} to variable '${node.name}' of type ${node.varType}`,
            line: node.initializer.line,
            col: node.initializer.col
          });
        }
      }

      if (initValue === 0 && node.initializer.type === 'Literal') {
      }
    }

    if (this.passwordPattern.test(node.name) &&
        node.initializer && this.inferType(node.initializer) === 'string') {
      this.warnings.push({
        message: `Hardcoded password-like value in variable '${node.name}'`,
        line: node.initializer.line || 0,
        col: node.initializer.col || 0
      });
    }

    this.symbolTable.push({
      name: node.name,
      type: node.varType,
      line: node.line || 0,
      value: initValue,
      scope: this.scopeStack[this.scopeStack.length - 1]
    });

    this.initMap.set(node.name, node.initializer !== null);
  }

  visitAssignment(node) {
    const value = this.visit(node.value);

    const declared = this.symbolTable.find(s => s.name === node.name);
    if (!declared) {
      this.errors.push({
        message: `Undefined variable '${node.name}'`,
        line: node.line || 0,
        col: node.col || 0
      });
      return;
    }

    if (!this.usedVars.has(node.name)) {
      this.usedVars.add(node.name);
    }

    const valueType = this.inferType(node.value, value);
    if (valueType && declared.type !== valueType) {
      if (!(declared.type === 'float' && valueType === 'int') &&
          !(declared.type === 'int' && valueType === 'float')) {
        this.warnings.push({
          message: `Type mismatch: assigning ${valueType} to variable '${node.name}' of type ${declared.type}`,
          line: node.line || 0,
          col: node.col || 0
        });
      }
    }

    this.initMap.set(node.name, true);
  }

  visitIdentifier(node) {
    const declared = this.symbolTable.find(s => s.name === node.name);
    if (!declared) {
      this.errors.push({
        message: `Undefined variable '${node.name}'`,
        line: node.line || 0,
        col: node.col || 0
      });
      return null;
    }

    this.usedVars.add(node.name);

    if (!this.initMap.get(node.name)) {
      this.warnings.push({
        message: `Variable '${node.name}' used before initialization`,
        line: node.line || 0,
        col: node.col || 0
      });
    }

    return declared.value;
  }

  visitBinaryExpr(node) {
    const leftVal = this.visit(node.left);
    const rightVal = this.visit(node.right);

    const leftType = this.inferType(node.left, leftVal);
    const rightType = this.inferType(node.right, rightVal);

    if (leftType && rightType && leftType !== rightType) {
      if (!['+', '==', '!='].includes(node.operator)) {
        this.errors.push({
          message: `Type mismatch: cannot apply operator '${node.operator}' to ${leftType} and ${rightType}`,
          line: node.line || 0,
          col: node.col || 0
        });
      }
    }

    if (node.operator === '/' && rightVal === 0) {
      this.warnings.push({
        message: 'Division by zero detected',
        line: node.line || 0,
        col: node.col || 0
      });
    }

    if (node.operator === '%' && rightVal === 0) {
      this.warnings.push({
        message: 'Modulo by zero detected',
        line: node.line || 0,
        col: node.col || 0
      });
    }

    if (leftType && rightType && leftType === 'boolean' && rightType === 'boolean' &&
        ['<', '>', '<=', '>=', '+', '-', '*', '/', '%'].includes(node.operator)) {
      this.errors.push({
        message: `Type mismatch: operator '${node.operator}' cannot be applied to booleans`,
        line: node.line || 0,
        col: node.col || 0
      });
    }

    return this.evalConst(node);
  }

  visitUnaryExpr(node) {
    return this.evalConst(node);
  }

  visitIfStmt(node) {
    this.visit(node.condition);
    if (node.consequent) this.visit(node.consequent);
    if (node.alternate) this.visit(node.alternate);

    const condVal = this.evalConst(node.condition);
    if (condVal === true && node.consequent && node.consequent.type === 'Block' &&
        node.consequent.body.length === 0) {
    }
  }

  visitWhileStmt(node) {
    this.visit(node.condition);
    if (node.body) this.visit(node.body);

    const condVal = this.evalConst(node.condition);
    if (condVal === true) {
      let hasBreak = false;
      this.checkForBreak(node.body, () => { hasBreak = true; });
      if (!hasBreak) {
        this.warnings.push({
          message: 'Infinite loop detected: while(true) with no exit condition',
          line: node.line || 0,
          col: node.col || 0
        });
      }
    }
  }

  checkForBreak(node, callback) {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const n of node) this.checkForBreak(n, callback);
    } else if (node.type === 'Block') {
      for (const stmt of node.body) this.checkForBreak(stmt, callback);
    } else if (node.type === 'IfStmt') {
      this.checkForBreak(node.consequent, callback);
      this.checkForBreak(node.alternate, callback);
    } else if (node.type === 'WhileStmt') {
    }
  }

  visitPrintStmt(node) {
    this.visit(node.argument);
  }

  visitBlock(node) {
    this.pushScope('block');
    for (const stmt of node.body) {
      this.visit(stmt);
    }
    this.popScope();
  }

  evalConst(node) {
    if (!node) return undefined;
    if (node.type === 'Literal') return node.value;
    if (node.type === 'UnaryExpr') {
      const arg = this.evalConst(node.argument);
      if (arg === undefined) return undefined;
      if (node.operator === '-') return -arg;
      if (node.operator === '!') return !arg;
    }
    if (node.type === 'Identifier') {
      const decl = this.symbolTable.find(s => s.name === node.name);
      return decl ? decl.value : undefined;
    }
    if (node.type === 'BinaryExpr') {
      const l = this.evalConst(node.left);
      const r = this.evalConst(node.right);
      if (l === undefined || r === undefined) return undefined;
      switch (node.operator) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return r !== 0 ? l / r : undefined;
        case '%': return r !== 0 ? l % r : undefined;
        case '==': return l === r;
        case '!=': return l !== r;
        case '<': return l < r;
        case '>': return l > r;
        case '<=': return l <= r;
        case '>=': return l >= r;
      }
    }
    return undefined;
  }

  inferType(node, value) {
    if (!node) return null;
    if (node.type === 'Literal') {
      if (node.literalType === 'number') {
        const v = value !== undefined ? value : node.value;
        return Number.isInteger(v) ? 'int' : 'float';
      }
      if (node.literalType === 'string') return 'string';
      if (node.literalType === 'boolean') return 'bool';
    }
    if (node.type === 'Identifier') {
      const decl = this.symbolTable.find(s => s.name === node.name);
      return decl ? decl.type : null;
    }
    if (node.type === 'BinaryExpr') {
      if (node.operator === '+') {
        const lt = this.inferType(node.left);
        const rt = this.inferType(node.right);
        if (lt === 'string' || rt === 'string') return 'string';
        if (lt === 'float' || rt === 'float') return 'float';
        if (lt === 'int' && rt === 'int') return 'int';
      }
      if (['-', '*', '/', '%'].includes(node.operator)) {
        const lt = this.inferType(node.left);
        const rt = this.inferType(node.right);
        if (lt === 'float' || rt === 'float') return 'float';
        if (lt === 'int' && rt === 'int') return 'int';
      }
      if (['==', '!=', '<', '>', '<=', '>='].includes(node.operator)) {
        return 'bool';
      }
    }
    if (node.type === 'UnaryExpr') {
      if (node.operator === '-') return this.inferType(node.argument);
      if (node.operator === '!') return 'bool';
    }
    return null;
  }
}

function analyze(code) {
  const errors = [];
  const warnings = [];

  let tokens;
  try {
    const lexer = new Lexer(code);
    tokens = lexer.tokenize();
  } catch (e) {
    return {
      tokens: [],
      ast: { type: 'Program', body: [] },
      symbolTable: [],
      warnings: [],
      errors: [{ message: `Lexer error: ${e.message}`, line: 0, col: 0 }],
      output: []
    };
  }

  const parser = new Parser(tokens);
  const ast = parser.parse();
  for (const e of parser.errors) {
    errors.push(`${e.message}`);
  }

  const analyzer = new StaticAnalyzer();
  analyzer.visit(ast);
  for (const w of analyzer.warnings) {
    warnings.push(w.message);
  }
  for (const e of analyzer.errors) {
    errors.push(e.message);
  }

  const output = [];
  const interp = new Interpreter();
  try {
    interp.visit(ast);
    for (const e of interp.errors) {
      errors.push(e);
    }
    for (const line of interp.output) {
      output.push(line);
    }
  } catch (e) {
    errors.push(`Runtime error: ${e.message}`);
  }

  const formattedTokens = tokens
    .filter(t => t.type !== 'EOF')
    .map(t => ({
      type: t.type,
      value: t.value,
      line: t.line,
      col: t.col
    }));

  return {
    tokens: formattedTokens,
    ast,
    symbolTable: analyzer.symbolTable,
    warnings,
    errors,
    output
  };
}

export { analyze };
export default analyze;
