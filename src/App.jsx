import { useState, useRef, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import {
  Play, ChevronDown, Terminal, Trash2, Code2, Cpu, FileCode, Braces,
  CheckCircle, XCircle, AlertTriangle, Clock, Copy, Check,
  PanelRightClose, PanelRightOpen, Download, FlaskConical, TestTube,
  Binary, GitBranch, Brain, Zap, ArrowLeftRight, ListTree, Loader2,
} from 'lucide-react';
import { DEFAULT_CODE, LANGUAGES, C_DEFAULT_SAMPLE } from './constants.js';
import { tokenize } from './compiler/lexer.js';
import { simulateDFA, classifyToken, dfas } from './compiler/dfa.js';
import { generateTAC } from './compiler/tac.js';
import { optimize } from './compiler/optimizer.js';
import TokenTable from './components/TokenTable.jsx';
import OutputSummary from './components/OutputSummary.jsx';
import DFAVisualizer from './components/DFAVisualizer.jsx';
import DFASelector from './components/DFASelector.jsx';
import ExecutionTrace from './components/ExecutionTrace.jsx';
import OptimizationFlow from './components/OptimizationFlow.jsx';
import ASTVisualizer from './components/ASTVisualizer.jsx';
import AIExplanationBot from './components/AIExplanationBot.jsx';
import CompilerPlayground from './components/CompilerPlayground.jsx';
import './index.css';

const langIconMap = {
  c: Cpu, python: FileCode, java: Braces,
};

const VERDICT = {
  NONE: { label: '', cls: '' },
  AC: { label: 'Accepted', cls: 'verdict-ac' },
  WA: { label: 'Wrong Answer', cls: 'verdict-wa' },
  CE: { label: 'Compilation Error', cls: 'verdict-ce' },
  RE: { label: 'Runtime Error', cls: 'verdict-re' },
  TLE: { label: 'Time Limit Exceeded', cls: 'verdict-tle' },
};

const PIPELINE_TABS = [
  { id: 'tokens', label: 'Tokens', icon: ListTree },
  { id: 'dfa', label: 'DFA', icon: GitBranch },
  { id: 'tac', label: 'TAC & Opt.', icon: Zap },
  { id: 'ast', label: 'AST', icon: Binary },
  { id: 'ai', label: 'AI Assistant', icon: Brain },
  { id: 'smart', label: 'Smart Playground', icon: FlaskConical },
];

export default function App() {
  const [mode, setMode] = useState('runner');

  const [language, setLanguage] = useState('c');
  const [code, setCode] = useState(DEFAULT_CODE['c']);
  const [stdinInput, setStdinInput] = useState('3\n4\n5\n6');
  const [expectedOutput, setExpectedOutput] = useState('16\n25\n36');
  const [rightTab, setRightTab] = useState('input');
  const [showRight, setShowRight] = useState(true);
  const [output, setOutput] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [execTime, setExecTime] = useState(null);
  const [verdict, setVerdict] = useState(VERDICT.NONE);
  const [outputHeight, setOutputHeight] = useState(220);
  const [copied, setCopied] = useState(false);

  const [labCode, setLabCode] = useState(C_DEFAULT_SAMPLE);
  const [tokens, setTokens] = useState([]);
  const [dfaStatus, setDfaStatus] = useState({});
  const [selectedToken, setSelectedToken] = useState(null);
  const [selectedDFA, setSelectedDFA] = useState('identifier');
  const [dfaTrace, setDfaTrace] = useState([]);
  const [dfaCurrentStep, setDfaCurrentStep] = useState(0);
  const [dfaIsRunning, setIsDfaRunning] = useState(false);
  const [dfaSpeed, setDfaSpeed] = useState(1);
  const [tacInstructions, setTacInstructions] = useState([]);
  const [optimizedInstructions, setOptimizedInstructions] = useState([]);
  const [analysisTime, setAnalysisTime] = useState(null);
  const [errorCount, setErrorCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [labTab, setLabTab] = useState('tokens');
  const [editorLines, setEditorLines] = useState([]);
  const [aiCurrentLine, setAiCurrentLine] = useState(null);
  const [dfaAnalyzing, setDfaAnalyzing] = useState(false);

  const editorRef = useRef(null);
  const labEditorRef = useRef(null);
  const outputEndRef = useRef(null);
  const resizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const dfaTimerRef = useRef(null);

  useEffect(() => {
    if (outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (mode === 'runner') handleRun();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, handleRun]);

  useEffect(() => {
    return () => {
      if (dfaTimerRef.current) clearInterval(dfaTimerRef.current);
    };
  }, []);

  const handleLanguageChange = useCallback((e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    setCode(DEFAULT_CODE[newLang]);
    setVerdict(VERDICT.NONE);
    setExecTime(null);
    setStdinInput('');
    setExpectedOutput('');
    setOutput([]);
  }, []);

  const handleEditorMount = useCallback((editor) => {
    editorRef.current = editor;
    if (mode === 'runner') editor.focus();
  }, [mode]);

  const handleLabEditorMount = useCallback((editor) => {
    const lines = [];
    const model = editor.getModel();
    if (model) {
      const count = model.getLineCount();
      for (let i = 1; i <= count; i++) lines.push(i);
    }
    setEditorLines(lines);
    editor.onMouseDown((e) => {
      if (e.target.position) {
        setAiCurrentLine(e.target.position.lineNumber - 1);
      }
    });
  }, []);

  const handleLabCodeChange = useCallback((v) => {
    setLabCode(v || '');
  }, []);

  const compareOutput = (actual) => {
    if (!expectedOutput.trim()) return VERDICT.NONE;
    const cleanActual = actual.trim().replace(/\r\n/g, '\n').split('\n').map(l => l.trimEnd()).join('\n');
    const cleanExpected = expectedOutput.trim().replace(/\r\n/g, '\n').split('\n').map(l => l.trimEnd()).join('\n');
    return cleanActual === cleanExpected ? VERDICT.AC : VERDICT.WA;
  };

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setVerdict(VERDICT.NONE);
    setExecTime(null);
    const langMeta = LANGUAGES.find((l) => l.id === language);
    const ts = new Date().toLocaleTimeString();
    setOutput((prev) => [...prev, { type: 'info', text: `[${ts}] Running ${langMeta.label}...` }]);

    try {
      const response = await fetch('http://localhost:5000/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code, input: stdinInput }),
      });
      const data = await response.json();
      const ft = new Date().toLocaleTimeString();
      setExecTime(data.executionTime);

      if (data.error && !data.output) {
        const isTLE = data.error.includes('Time Limit');
        const isCE = data.error.includes('Compilation Error');
        setVerdict(isTLE ? VERDICT.TLE : isCE ? VERDICT.CE : VERDICT.RE);
        setOutput((prev) => [
          ...prev,
          { type: 'error', text: data.error },
          { type: 'info', text: `[${ft}] ${data.executionTime}ms` },
        ]);
      } else {
        const lines = [];
        if (data.output) {
          lines.push({ type: 'success', text: `[${ft}] Execution successful` });
          lines.push({ type: 'default', text: '' });
          data.output.split('\n').forEach((line) => lines.push({ type: 'default', text: line }));
        }
        if (data.error) lines.push({ type: 'error', text: data.error });
        lines.push({ type: 'default', text: '' });
        lines.push({ type: 'info', text: `[${ft}] Finished in ${data.executionTime}ms` });
        setOutput((prev) => [...prev, ...lines]);
        const v = compareOutput(data.output || '');
        setVerdict(v);
      }
    } catch (err) {
      const et = new Date().toLocaleTimeString();
      setVerdict(VERDICT.RE);
      setOutput((prev) => [
        ...prev,
        { type: 'error', text: `[${et}] Connection error: ${err.message}` },
        { type: 'error', text: 'Backend server not running on port 5000.' },
      ]);
    } finally {
      setIsRunning(false);
    }
  }, [language, code, stdinInput, expectedOutput]);

  const handleClear = useCallback(() => {
    setOutput([]);
    setVerdict(VERDICT.NONE);
    setExecTime(null);
  }, []);

  const handleCopyOutput = useCallback(() => {
    const text = output.map((l) => l.text).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [output]);

  const handleDownloadCode = useCallback(() => {
    const currentCode = mode === 'runner' ? code : labCode;
    const ext = { c: 'c', python: 'py', java: 'java' };
    const blob = new Blob([currentCode], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `code.${ext[language] || 'txt'}`;
    a.click();
  }, [mode, code, labCode, language]);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    resizingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = outputHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    const move = (e) => {
      if (!resizingRef.current) return;
      const delta = startYRef.current - e.clientY;
      setOutputHeight(Math.max(80, Math.min(500, startHeightRef.current + delta)));
    };
    const up = () => {
      resizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }, [outputHeight]);

  const handleAnalyze = useCallback(() => {
    if (!labCode.trim()) return;
    setDfaAnalyzing(true);
    setTacInstructions([]);
    setOptimizedInstructions([]);
    setDfaTrace([]);
    setSelectedToken(null);
    const start = performance.now();
    try {
      const result = tokenize(labCode);
      setTokens(result);
      const statusMap = {};
      let errors = 0;
      let warnings = 0;
      for (let idx = 0; idx < result.length; idx++) {
        const tok = result[idx];
        const dfaType = classifyToken(tok.value);
        if (dfaType) {
          const dfaResult = simulateDFA(tok.value, dfaType);
          statusMap[idx] = dfaResult.accepted;
        } else {
          statusMap[idx] = false;
        }
        if (tok.type === 'ERROR') errors++;
      }
      setDfaStatus(statusMap);
      setErrorCount(errors);
      setWarningCount(warnings);
    } catch (e) {
      console.error('Analysis error:', e);
      setTokens([]);
      setDfaStatus({});
      setErrorCount(1);
      setWarningCount(0);
    }
    setAnalysisTime(performance.now() - start);
    setDfaCurrentStep(0);
    setDfaAnalyzing(false);
  }, [labCode]);

  const handleTokenClick = useCallback((token, index) => {
    setSelectedToken({ token, index });
    const dfaType = classifyToken(token.value);
    setSelectedDFA(dfaType);
    const result = simulateDFA(token.value, dfaType);
    setDfaTrace(result.steps || []);
    setDfaCurrentStep(0);
    setIsDfaRunning(false);
    if (dfaTimerRef.current) {
      clearInterval(dfaTimerRef.current);
      dfaTimerRef.current = null;
    }
  }, []);

  const handleDFASelect = useCallback((dfaType) => {
    setSelectedDFA(dfaType);
    if (selectedToken) {
      const result = simulateDFA(selectedToken.token.value, dfaType);
      setDfaTrace(result.steps || []);
      setDfaCurrentStep(0);
      setIsDfaRunning(false);
    }
  }, [selectedToken]);

  const handleDFAStep = useCallback(() => {
    setDfaCurrentStep((prev) => Math.min(prev + 1, dfaTrace.length - 1));
  }, [dfaTrace]);

  const handleDFAReset = useCallback(() => {
    setDfaCurrentStep(0);
    setIsDfaRunning(false);
    if (dfaTimerRef.current) {
      clearInterval(dfaTimerRef.current);
      dfaTimerRef.current = null;
    }
  }, []);

  const handleDFAPlay = useCallback(() => {
    if (dfaTrace.length === 0) return;
    setIsDfaRunning(true);
    setDfaCurrentStep(0);
    const delay = 1000 / dfaSpeed;
    dfaTimerRef.current = setInterval(() => {
      setDfaCurrentStep((prev) => {
        const next = prev + 1;
        if (next >= dfaTrace.length - 1) {
          setIsDfaRunning(false);
          if (dfaTimerRef.current) {
            clearInterval(dfaTimerRef.current);
            dfaTimerRef.current = null;
          }
          return dfaTrace.length - 1;
        }
        return next;
      });
    }, delay);
  }, [dfaTrace, dfaSpeed]);

  const handleSpeedChange = useCallback((e) => {
    const val = parseFloat(e.target.value);
    setDfaSpeed(val);
    if (dfaIsRunning) {
      if (dfaTimerRef.current) clearInterval(dfaTimerRef.current);
      const delay = 1000 / val;
      dfaTimerRef.current = setInterval(() => {
        setDfaCurrentStep((prev) => {
          const next = prev + 1;
          if (next >= dfaTrace.length - 1) {
            setIsDfaRunning(false);
            if (dfaTimerRef.current) {
              clearInterval(dfaTimerRef.current);
              dfaTimerRef.current = null;
            }
            return dfaTrace.length - 1;
          }
          return next;
        });
      }, delay);
    }
  }, [dfaIsRunning, dfaTrace]);

  const handleDFAComplete = useCallback(() => {
    setIsDfaRunning(false);
    setDfaAnalyzing(false);
  }, []);

  const handleDFASpeedChange = useCallback((speed) => {
    setDfaSpeed(speed);
  }, []);

  const handleGenerateTAC = useCallback(() => {
    const sourceTokens = tokens.length > 0 ? tokens : (() => {
      try {
        const result = tokenize(labCode);
        setTokens(result);
        const statusMap = {};
        let errors = 0;
        for (let idx = 0; idx < result.length; idx++) {
          const tok = result[idx];
          const dfaType = classifyToken(tok.value);
          if (dfaType) statusMap[idx] = simulateDFA(tok.value, dfaType).accepted;
          else statusMap[idx] = false;
          if (tok.type === 'ERROR') errors++;
        }
        setDfaStatus(statusMap);
        setErrorCount(errors);
        return result;
      } catch { return []; }
    })();

    if (sourceTokens.length > 0) {
      try {
        const instructions = generateTAC(sourceTokens);
        setTacInstructions(instructions);
        const optResult = optimize(instructions);
        setOptimizedInstructions(optResult);
      } catch (e) {
        console.error('TAC generation error:', e);
      }
    }
  }, [tokens, labCode]);

  const handleModeChange = useCallback((newMode) => {
    setMode(newMode);
    setVerdict(VERDICT.NONE);
    setExecTime(null);
    if (newMode === 'lab') {
      setLabTab('tokens');
    }
    if (newMode === 'runner') {
      setOutput([]);
    }
  }, []);

  const currentLang = LANGUAGES.find((l) => l.id === language);
  const LangIcon = langIconMap[language] || Code2;
  const selectedIndex = selectedToken ? selectedToken.index : null;

  const isStepCompleted = (tabId) => {
    switch (tabId) {
      case 'tokens': return tokens.length > 0;
      case 'dfa': return dfaTrace.length > 0;
      case 'tac': return tacInstructions.length > 0;
      case 'ast': return tokens.length > 0;
      case 'ai': return true;
      case 'smart': return true;
      default: return false;
    }
  };

  const renderRunnerMode = () => (
    <>
      <div className="editor-row">
        <div className="editor-container" id="code-editor">
          <Editor
            height="100%"
            language={currentLang.monacoId}
            value={code}
            onChange={(v) => setCode(v || '')}
            onMount={handleEditorMount}
            theme="vs-dark"
            loading={<div className="editor-loading"><div className="loading-spinner" /><span>Loading editor...</span></div>}
            options={{
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontLigatures: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              padding: { top: 16, bottom: 16 },
              renderLineHighlight: 'all',
              bracketPairColorization: { enabled: true },
              autoClosingBrackets: 'always',
              tabSize: 4,
              wordWrap: 'on',
            }}
          />
        </div>

        {showRight && (
          <div className="right-panel" id="right-panel">
            <div className="right-panel-tabs">
              <button className={`rp-tab ${rightTab === 'input' ? 'active' : ''}`} onClick={() => setRightTab('input')}>
                <Terminal size={12} /><span>Input</span>
              </button>
              <button className={`rp-tab ${rightTab === 'expected' ? 'active' : ''}`} onClick={() => setRightTab('expected')}>
                <CheckCircle size={12} /><span>Expected</span>
              </button>
            </div>
            {rightTab === 'input' ? (
              <textarea className="rp-textarea" value={stdinInput} onChange={(e) => setStdinInput(e.target.value)} placeholder="Paste test input here..." spellCheck={false} id="stdin-textarea" />
            ) : (
              <textarea className="rp-textarea" value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)} placeholder="Paste expected output to compare..." spellCheck={false} id="expected-textarea" />
            )}
          </div>
        )}
      </div>

      <div className="resize-handle" onMouseDown={handleResizeStart} id="resize-handle" />
      <div className="output-panel" style={{ height: outputHeight }} id="output-panel">
        <div className="output-header">
          <div className="output-header-left">
            <Terminal size={13} className="output-icon-svg" />
            <span className="output-title">Terminal</span>
            {output.length > 0 && <span className="output-count">{output.length}</span>}
          </div>
          <div className="output-header-right">
            <button className="out-tool-btn" onClick={handleCopyOutput} title="Copy output">{copied ? <Check size={12} /> : <Copy size={12} />}</button>
            <button className="out-tool-btn danger" onClick={handleClear} title="Clear terminal"><Trash2 size={12} /></button>
          </div>
        </div>
        <div className="output-body" id="output-body">
          {output.length === 0 ? (
            <div className="output-empty"><Terminal size={24} className="output-empty-icon" /><span>Press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to run</span></div>
          ) : (
            <>{output.map((line, i) => (<div key={i} className={`output-line ${line.type}`}>{line.text}</div>))}<div ref={outputEndRef} /></>
          )}
        </div>
      </div>
    </>
  );

  const renderLabEditor = useCallback((readOnly = false) => {
    return (
      <Editor
        height="100%"
        language="c"
        value={labCode}
        onChange={(v) => setLabCode(v || '')}
        onMount={(editor) => {
          labEditorRef.current = editor;
          editor.onMouseDown((e) => {
            if (e.target.type === 'GUTTER_GLYPH_MARGIN' || e.target.type === 'GUTTER_LINE_NUMBERS') {
              const line = e.target.position.lineNumber - 1;
              setAiCurrentLine(line);
            }
          });
          const updateLines = () => {
            const model = editor.getModel();
            if (model) setEditorLines(model.getLinesContent() || []);
          };
          editor.onDidChangeModelContent(updateLines);
          setTimeout(updateLines, 100);
        }}
        theme="vs-dark"
        loading={<div className="editor-loading"><div className="loading-spinner" /><span>Loading editor...</span></div>}
        options={{
          readOnly,
          fontSize: 13,
          fontFamily: "'JetBrains Mono', monospace",
          minimap: { enabled: true, maxColumn: 60, showSlider: 'mouseover' },
          scrollBeyondLastLine: false,
          lineNumbers: 'on',
          glyphMargin: false,
          folding: true,
          lineDecorationsWidth: 8,
          lineNumbersMinChars: 3,
          padding: { top: 12 },
          renderLineHighlight: readOnly ? 'line' : 'all',
          bracketPairColorization: { enabled: true },
          tabSize: 4,
        }}
      />
    );
  }, [labCode]);

  const renderTokensTab = () => (
    <div className="tokens-view">
      <div className="tokens-editor-panel">
        <div className="lab-editor-header">
          <span className="lab-editor-title">Source Code (C)</span>
        </div>
        <div className="lab-editor-body" style={{ flex: 1, overflow: 'hidden' }}>
          {renderLabEditor(false)}
        </div>
        <div className="lab-actions">
          <button className="analyze-btn" onClick={handleAnalyze} disabled={dfaAnalyzing}>
            {dfaAnalyzing ? <Loader2 size={14} className="spin" /> : <Play size={14} fill="currentColor" />}
            <span>{dfaAnalyzing ? 'Analyzing...' : 'Analyze'}</span>
          </button>
          {analysisTime !== null && (
            <span className="analysis-time">
              <Clock size={12} /> {analysisTime.toFixed(1)}ms
            </span>
          )}
        </div>
      </div>
      <div className="tokens-result-panel">
        {tokens.length > 0 ? (
          <>
            <OutputSummary tokens={tokens} analysisTime={analysisTime} errorCount={errorCount} warningCount={warningCount} />
            <div className="dfa-trace-panel-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ListTree size={13} />
                Token Stream
              </span>
              <span className="badge badge-accent">{tokens.length} tokens</span>
            </div>
            <div className="token-table-container scrollable-y">
              <TokenTable tokens={tokens} dfaStatus={dfaStatus} onTokenClick={handleTokenClick} selectedIndex={selectedIndex} />
            </div>
          </>
        ) : (
          <div className="tac-empty">
            <Binary size={48} className="tac-empty-icon" />
            <h3 style={{ color: 'var(--text-secondary)', margin: 0 }}>No Analysis Yet</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
              Write C code and click <strong style={{ color: 'var(--accent)' }}>Analyze</strong> to tokenize and inspect the lexical structure.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderDFATab = () => (
    <div className="dfa-view">
      <div className="dfa-sidebar">
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <GitBranch size={13} /> Select DFA
          </h4>
          <DFASelector selected={selectedDFA} onSelect={handleDFASelect} />
        </div>
        {tokens.length > 0 && (
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ListTree size={13} /> Tokens
            </h4>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Click a token to simulate its DFA</p>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              <TokenTable tokens={tokens.slice(0, 20)} dfaStatus={dfaStatus} onTokenClick={handleTokenClick} selectedIndex={selectedIndex} compact />
              {tokens.length > 20 && (
                <p style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', padding: 4 }}>
                  +{tokens.length - 20} more
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="dfa-main">
        <div className="dfa-visualizer-container" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="dfa-visualizer glass-panel" style={{ flex: 1, borderRadius: 0, border: 'none' }}>
            <DFAVisualizer
              dfa={dfas[selectedDFA]}
              accepted={dfaTrace.length > 0 ? dfaTrace[dfaTrace.length - 1]?.accepted !== false : false}
              trace={dfaTrace}
              currentStep={dfaCurrentStep}
              onComplete={handleDFAComplete}
            />
          </div>
        </div>
      </div>
      <div className="dfa-trace-panel">
        <div className="dfa-trace-panel-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Terminal size={13} />
            Execution Trace
          </span>
          {dfaTrace.length > 0 && <span className="badge badge-accent">{dfaCurrentStep + 1}/{dfaTrace.length}</span>}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <ExecutionTrace trace={dfaTrace} currentStep={dfaCurrentStep} accepted={dfaTrace.length > 0 ? dfaTrace[dfaTrace.length - 1]?.accepted !== false : false} />
        </div>
      </div>
    </div>
  );

  const renderTACTab = () => (
    <div className="tac-view" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, overflow: 'hidden' }}>
      <div className="tac-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          <Zap size={16} style={{ color: 'var(--accent)' }} />
          Three-Address Code & Optimization
        </h3>
        <button className="tac-generate-btn" onClick={handleGenerateTAC} disabled={!labCode.trim()}>
          <Zap size={14} />
          <span>Generate TAC</span>
        </button>
      </div>
      {tacInstructions.length === 0 ? (
        <div className="tac-empty" style={{ flex: 1 }}>
          <Zap size={48} className="tac-empty-icon" />
          <h3 style={{ color: 'var(--text-secondary)', margin: 0 }}>No TAC Generated</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
            First analyze your code in the <strong style={{ color: 'var(--accent)' }}>Tokens</strong> tab, then generate TAC here.
          </p>
        </div>
      ) : (
        <div className="tac-content" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <OptimizationFlow original={tacInstructions} optimized={optimizedInstructions} />
        </div>
      )}
    </div>
  );

  const renderASTTab = () => (
    <div className="ast-view" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, overflow: 'hidden' }}>
      {tokens.length === 0 ? (
        <div className="tac-empty" style={{ flex: 1 }}>
          <Binary size={48} className="tac-empty-icon" />
          <h3 style={{ color: 'var(--text-secondary)', margin: 0 }}>No AST Available</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
            Analyze code first, then switch to the <strong style={{ color: 'var(--accent)' }}>Smart Playground</strong> tab for full AST visualization.
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, margin: 0, marginBottom: 4 }}>
              <Binary size={16} style={{ color: 'var(--accent)' }} />
              AST Visualization
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Full AST generation is available in the Smart Playground tab using the mini-language compiler.
            </p>
          </div>
          <div className="glass-panel" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="tac-empty">
              <ListTree size={48} className="tac-empty-icon" />
              <h3 style={{ color: 'var(--text-secondary)', margin: 0 }}>Full AST in Smart Playground</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                Switch to the <strong style={{ color: 'var(--accent)' }}>Smart Playground</strong> tab to write mini-language programs and visualize their AST.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderAITab = () => (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div className="ai-editor-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div className="dfa-trace-panel-header" style={{ borderRadius: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Code2 size={13} />
            Source Code
          </span>
          <span className="badge badge-accent">Click line numbers for explanation</span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {renderLabEditor(true)}
        </div>
      </div>
      <div style={{ width: 380, flexShrink: 0, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <AIExplanationBot lines={editorLines} currentLine={aiCurrentLine} />
      </div>
    </div>
  );

  const renderSmartTab = () => (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <CompilerPlayground />
    </div>
  );

  const renderLabMode = () => (
    <div className="lab-container">
      <div className="pipeline-tabs" style={{ flexShrink: 0 }}>
        {PIPELINE_TABS.map((tab) => {
          const TabIcon = tab.icon;
          const completed = isStepCompleted(tab.id);
          return (
            <button
              key={tab.id}
              className={`pipeline-tab ${labTab === tab.id ? 'active' : ''}`}
              onClick={() => setLabTab(tab.id)}
              style={{ position: 'relative' }}
            >
              <TabIcon size={13} />
              <span>{tab.label}</span>
              {completed && labTab !== tab.id && (
                <Check size={10} style={{ color: 'var(--green)', position: 'absolute', top: 2, right: 2 }} />
              )}
            </button>
          );
        })}
      </div>
      <div className="pipeline-content" style={{ flex: 1, overflow: 'hidden' }}>
        {labTab === 'tokens' && renderTokensTab()}
        {labTab === 'dfa' && renderDFATab()}
        {labTab === 'tac' && renderTACTab()}
        {labTab === 'ast' && renderASTTab()}
        {labTab === 'ai' && renderAITab()}
        {labTab === 'smart' && renderSmartTab()}
      </div>
    </div>
  );

  return (
    <div className="app-container">
      <header className="header" id="main-header">
        <div className="header-left">
          <div className="logo">
            <div className="logo-icon"><Code2 size={16} color="#fff" /></div>
            <span className="logo-text">SCA</span>
          </div>
          <div className="header-divider" />
          <div className="mode-toggle">
            <button className={`mode-btn ${mode === 'runner' ? 'active' : ''}`} onClick={() => handleModeChange('runner')}>
              <Play size={12} fill="currentColor" />
              <span>Code Runner</span>
            </button>
            <button className={`mode-btn ${mode === 'lab' ? 'active' : ''}`} onClick={() => handleModeChange('lab')}>
              <FlaskConical size={12} />
              <span>Compiler Lab</span>
            </button>
          </div>
          <div className="header-divider" />
          {mode === 'runner' && (
            <div className="language-selector" id="language-selector">
              <select className="language-select" value={language} onChange={handleLanguageChange} id="language-dropdown">
                {LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>{lang.label}</option>
                ))}
              </select>
              <ChevronDown size={13} className="select-chevron" />
            </div>
          )}
        </div>

        <div className="header-center">
          {verdict.label && (
            <div className={`verdict-badge ${verdict.cls}`}>
              {verdict.cls === 'verdict-ac' ? <CheckCircle size={14} /> :
               verdict.cls === 'verdict-wa' ? <XCircle size={14} /> :
               <AlertTriangle size={14} />}
              <span>{verdict.label}</span>
              {execTime !== null && <span className="verdict-time">{execTime}ms</span>}
            </div>
          )}
        </div>

        <div className="header-right">
          {mode === 'runner' && (
            <>
              <button className="tool-btn" onClick={() => setShowRight(v => !v)} title="Toggle input panel">
                {showRight ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
              </button>
              <button className="tool-btn" onClick={handleDownloadCode} title="Download code">
                <Download size={15} />
              </button>
              <div className="header-divider" />
              <button className={`run-btn ${isRunning ? 'is-running' : ''}`} onClick={handleRun} disabled={isRunning} id="run-button" title="Ctrl+Enter">
                <Play size={13} fill="currentColor" />
                <span>{isRunning ? 'Running...' : 'Run'}</span>
              </button>
            </>
          )}
          {mode === 'lab' && (
            <>
              <button className="tool-btn" onClick={handleDownloadCode} title="Download code">
                <Download size={15} />
              </button>
            </>
          )}
        </div>
      </header>

      <main className="main-content">
        {mode === 'runner' ? renderRunnerMode() : renderLabMode()}
      </main>

      <footer className="footer" id="footer">
        <div className="footer-left">
          {mode === 'runner' ? (
            <>
              <span className="footer-item"><LangIcon size={11} /> {currentLang.label}</span>
              <span className="footer-divider" />
              <span className="footer-item">UTF-8</span>
              <span className="footer-divider" />
              <span className="footer-item">Spaces: 4</span>
              {execTime !== null && (
                <>
                  <span className="footer-divider" />
                  <span className="footer-item footer-time"><Clock size={10} /> {execTime}ms</span>
                </>
              )}
            </>
          ) : (
            <>
              <span className="footer-item"><FlaskConical size={11} /> Compiler Lab</span>
              {tokens.length > 0 && (
                <>
                  <span className="footer-divider" />
                  <span className="footer-item"><ListTree size={10} /> {tokens.length} tokens</span>
                </>
              )}
              {errorCount > 0 && (
                <>
                  <span className="footer-divider" />
                  <span className="footer-item" style={{ color: 'var(--red)' }}><XCircle size={10} /> {errorCount} errors</span>
                </>
              )}
              {analysisTime !== null && (
                <>
                  <span className="footer-divider" />
                  <span className="footer-item footer-time"><Clock size={10} /> {analysisTime.toFixed(1)}ms</span>
                </>
              )}
            </>
          )}
        </div>
        <div className="footer-right">
          {mode === 'runner' ? (
            <>
              <span className="footer-item footer-shortcuts">Ctrl+Enter: Run</span>
              <span className="footer-divider" />
            </>
          ) : (
            <span className="footer-item footer-shortcuts">Click line numbers for AI assistance</span>
          )}
          <span className="footer-divider" />
          <span className="footer-item footer-brand">SCA v3.0</span>
        </div>
      </footer>
    </div>
  );
}
