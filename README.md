# SCA — Static Code Analyzer

A browser-based multi-language code execution and compiler analysis platform. Write, run, and analyze C, Python, and Java code with a full educational compiler pipeline.

## Features

### Code Runner
- Multi-language support (C, Python, Java)
- Monaco Editor with syntax highlighting, bracket matching, and IDE shortcuts
- Stdin simulation with expected-output comparison
- Verdict system: AC, WA, CE, RE, TLE
- Resizable terminal output panel
- Keyboard shortcut: `Ctrl+Enter` to run

### Compiler Lab
- **Tokens** — C lexical analyzer tokenizer (34 keywords, operators, literals, comments, preprocessor directives)
- **DFA** — Deterministic Finite Automaton simulator with 4 automata (identifier, number, operator, keyword) and step-through visualization
- **TAC & Optimization** — Three-Address Code generation with 6 optimization passes (constant folding, propagation, algebraic simplification, CSE, dead code elimination, control flow simplification)
- **AST** — Interactive AST visualization with pan/zoom (via Smart Playground mini-language)
- **AI Assistant** — Rule-based code line explanation engine with typewriter effect
- **Smart Playground** — Complete mini-language compiler with lexer, recursive-descent parser, tree-walking interpreter, and static analyzer

### Architecture
- **Frontend**: React 19, Monaco Editor, Vite 8, Lucide icons
- **Backend**: Express 5, child process execution with sandboxed temp files
- All compiler logic runs **client-side** in the browser
- Backend handles code execution only

## Getting Started

### Prerequisites
- Node.js 18+
- For code execution: GCC, Python 3, or JDK (optional — frontend works without backend)

### Install & Run

```bash
# Install frontend dependencies
npm install

# Start dev server (frontend only)
npm run dev

# In another terminal — start backend
cd server && npm install && npm start
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:5000`.

### Production Build

```bash
npm run build
npm run preview
```

## Project Structure

```
├── src/
│   ├── App.jsx                 # Main application (runner + lab modes)
│   ├── compiler/
│   │   ├── lexer.js            # C tokenizer
│   │   ├── dfa.js              # DFA definitions + simulation
│   │   ├── tac.js              # Three-Address Code generator
│   │   ├── optimizer.js        # TAC optimizer (6 passes)
│   │   └── smartCompiler.js    # Mini-language compiler suite
│   ├── components/
│   │   ├── TokenTable.jsx
│   │   ├── OutputSummary.jsx
│   │   ├── DFAVisualizer.jsx
│   │   ├── DFASelector.jsx
│   │   ├── ExecutionTrace.jsx
│   │   ├── OptimizationFlow.jsx
│   │   ├── ASTVisualizer.jsx
│   │   ├── AIExplanationBot.jsx
│   │   └── CompilerPlayground.jsx
│   └── index.css               # Full dark-themed design system
├── server/
│   ├── index.js                # Express API + rate limiting
│   └── executor.js             # Sandboxed code execution
├── resume.tex
└── package.json
```

## Tech Stack

| Layer    | Technologies |
|----------|-------------|
| Frontend | React 19, Monaco Editor, Vite 8, Lucide React |
| Backend  | Express 5, express-rate-limit |
| Compiler | Custom JS: lexer, DFA, TAC, optimizer, parser, interpreter |

## Endpoints

| Method | Path       | Description          | Rate Limit      |
|--------|------------|----------------------|-----------------|
| POST   | `/execute` | Run code             | 30 req/min      |
| POST   | `/parse`   | Syntax check         | 30 req/min      |
| GET    | `/health`  | Health check         | —               |
