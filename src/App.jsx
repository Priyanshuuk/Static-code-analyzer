import { useState, useRef, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import {
  Play,
  ChevronDown,
  Terminal,
  Trash2,
  Code2,
  Braces,
  FileCode,
  Cpu,
  Zap,
  Globe,
  Cog,
  Bug,
  Type,
  Keyboard,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  PanelRightClose,
  PanelRightOpen,
  Download,
} from 'lucide-react';
import { DEFAULT_CODE, LANGUAGES } from './constants.js';
import './index.css';

const langIconMap = {
  c: Cpu, cpp: Zap, python: FileCode, java: Braces,
  javascript: Globe, typescript: Type, go: Cog, rust: Bug,
};

const VERDICT = {
  NONE: { label: '', cls: '' },
  AC: { label: 'Accepted', cls: 'verdict-ac' },
  WA: { label: 'Wrong Answer', cls: 'verdict-wa' },
  CE: { label: 'Compilation Error', cls: 'verdict-ce' },
  RE: { label: 'Runtime Error', cls: 'verdict-re' },
  TLE: { label: 'Time Limit Exceeded', cls: 'verdict-tle' },
};

export default function App() {
  const [language, setLanguage] = useState('cpp');
  const [code, setCode] = useState(DEFAULT_CODE['cpp']);
  const [stdinInput, setStdinInput] = useState('3\n4\n5\n6');
  const [expectedOutput, setExpectedOutput] = useState('16\n25\n36');
  const [rightTab, setRightTab] = useState('input'); // 'input' | 'expected'
  const [showRight, setShowRight] = useState(true);
  const [output, setOutput] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [verdict, setVerdict] = useState(VERDICT.NONE);
  const [execTime, setExecTime] = useState(null);
  const [outputHeight, setOutputHeight] = useState(220);
  const [copied, setCopied] = useState(false);
  const editorRef = useRef(null);
  const outputEndRef = useRef(null);
  const resizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  // Auto-scroll output
  useEffect(() => {
    if (outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Ctrl+Enter = Run
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isRunning && !isParsing) handleRun();
      }
      // Ctrl+Shift+Enter = Parse
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        if (!isRunning && !isParsing) handleParse();
      }
      // Ctrl+Shift+C = Copy output
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        handleCopyOutput();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const handleLanguageChange = useCallback((e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    setCode(DEFAULT_CODE[newLang]);
    setVerdict(VERDICT.NONE);
    setExecTime(null);
  }, []);

  const handleEditorMount = useCallback((editor) => {
    editorRef.current = editor;
    editor.focus();
  }, []);

  // ─── Compare output with expected ───
  const compareOutput = (actual) => {
    if (!expectedOutput.trim()) return VERDICT.NONE;
    const cleanActual = actual.trim().replace(/\r\n/g, '\n').split('\n').map(l => l.trimEnd()).join('\n');
    const cleanExpected = expectedOutput.trim().replace(/\r\n/g, '\n').split('\n').map(l => l.trimEnd()).join('\n');
    return cleanActual === cleanExpected ? VERDICT.AC : VERDICT.WA;
  };

  // ─── RUN ───
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
          lines.push({ type: 'success', text: `[${ft}] ✓ Execution successful` });
          lines.push({ type: 'default', text: '' });
          data.output.split('\n').forEach((line) => lines.push({ type: 'default', text: line }));
        }
        if (data.error) lines.push({ type: 'error', text: data.error });
        lines.push({ type: 'default', text: '' });
        lines.push({ type: 'info', text: `[${ft}] Finished in ${data.executionTime}ms` });
        setOutput((prev) => [...prev, ...lines]);

        // Verdict
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

  // ─── PARSE ───
  const handleParse = useCallback(async () => {
    setIsParsing(true);
    setVerdict(VERDICT.NONE);
    const langMeta = LANGUAGES.find((l) => l.id === language);
    const ts = new Date().toLocaleTimeString();
    setOutput((prev) => [...prev, { type: 'info', text: `[${ts}] Parsing ${langMeta.label}...` }]);

    try {
      const response = await fetch('http://localhost:5000/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code }),
      });
      const data = await response.json();
      const ft = new Date().toLocaleTimeString();
      const lines = [];

      if (data.success) {
        lines.push({ type: 'success', text: `[${ft}] ✓ ${data.message}` });
      } else {
        lines.push({ type: 'error', text: `[${ft}] ✗ ${data.message}` });
      }

      if (data.errors && data.errors.length > 0) {
        data.errors.forEach((e) => lines.push({ type: 'error', text: `  ✗ ${e}` }));
      }
      if (data.warnings && data.warnings.length > 0) {
        data.warnings.forEach((w) => lines.push({ type: 'warning', text: `  ⚠ ${w}` }));
      }
      lines.push({ type: 'info', text: `[${ft}] Parse completed in ${data.parseTime}ms` });
      setOutput((prev) => [...prev, ...lines]);

      if (!data.success) setVerdict(VERDICT.CE);
    } catch (err) {
      setOutput((prev) => [
        ...prev,
        { type: 'error', text: `Parse error: ${err.message}` },
      ]);
    } finally {
      setIsParsing(false);
    }
  }, [language, code]);

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
    const ext = { c: 'c', cpp: 'cpp', python: 'py', java: 'java', javascript: 'js', typescript: 'ts', go: 'go', rust: 'rs' };
    const blob = new Blob([code], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `solution.${ext[language] || 'txt'}`;
    a.click();
  }, [code, language]);

  // Resize
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

  const currentLang = LANGUAGES.find((l) => l.id === language);
  const LangIcon = langIconMap[language] || Code2;
  const busy = isRunning || isParsing;

  return (
    <div className="app-container">
      {/* ─── Header ─── */}
      <header className="header" id="main-header">
        <div className="header-left">
          <div className="logo">
            <div className="logo-icon"><Code2 size={16} color="#fff" /></div>
            <span className="logo-text">SCA</span>
          </div>
          <div className="header-divider" />
          <div className="language-selector" id="language-selector">
            <select className="language-select" value={language} onChange={handleLanguageChange} id="language-dropdown">
              {LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>{lang.icon}  {lang.label}</option>
              ))}
            </select>
            <ChevronDown size={13} className="select-chevron" />
          </div>
        </div>

        <div className="header-center">
          {/* Verdict badge */}
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
          <button className="tool-btn" onClick={() => setShowRight(v => !v)} title="Toggle input panel">
            {showRight ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </button>
          <button className="tool-btn" onClick={handleDownloadCode} title="Download code">
            <Download size={15} />
          </button>
          <div className="header-divider" />
          <button className="parse-btn" onClick={handleParse} disabled={busy} id="parse-button" title="Ctrl+Shift+Enter">
            <Search size={13} />
            <span>Parse</span>
          </button>
          <button className={`run-btn ${isRunning ? 'is-running' : ''}`} onClick={handleRun} disabled={busy} id="run-button" title="Ctrl+Enter">
            <Play size={13} fill="currentColor" />
            <span>{isRunning ? 'Running…' : 'Run'}</span>
          </button>
        </div>
      </header>

      {/* ─── Workspace ─── */}
      <main className="main-content">
        <div className="editor-row">
          {/* Editor */}
          <div className="editor-container" id="code-editor">
            <Editor
              height="100%"
              language={currentLang.monacoId}
              value={code}
              onChange={(v) => setCode(v || '')}
              onMount={handleEditorMount}
              theme="vs-dark"
              loading={<div className="editor-loading"><div className="loading-spinner" /><span>Loading editor…</span></div>}
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
                renderWhitespace: 'selection',
                bracketPairColorization: { enabled: true },
                autoClosingBrackets: 'always',
                autoClosingQuotes: 'always',
                formatOnPaste: true,
                tabSize: 4,
                wordWrap: 'on',
              }}
            />
          </div>

          {/* Right Panel — Input / Expected Output */}
          {showRight && (
            <div className="right-panel" id="right-panel">
              <div className="right-panel-tabs">
                <button
                  className={`rp-tab ${rightTab === 'input' ? 'active' : ''}`}
                  onClick={() => setRightTab('input')}
                >
                  <Keyboard size={12} />
                  <span>Input</span>
                </button>
                <button
                  className={`rp-tab ${rightTab === 'expected' ? 'active' : ''}`}
                  onClick={() => setRightTab('expected')}
                >
                  <CheckCircle size={12} />
                  <span>Expected</span>
                </button>
              </div>
              {rightTab === 'input' ? (
                <textarea
                  className="rp-textarea"
                  value={stdinInput}
                  onChange={(e) => setStdinInput(e.target.value)}
                  placeholder="Paste test input here..."
                  spellCheck={false}
                  id="stdin-textarea"
                />
              ) : (
                <textarea
                  className="rp-textarea"
                  value={expectedOutput}
                  onChange={(e) => setExpectedOutput(e.target.value)}
                  placeholder="Paste expected output to compare..."
                  spellCheck={false}
                  id="expected-textarea"
                />
              )}
            </div>
          )}
        </div>

        {/* ─── Terminal ─── */}
        <div className="resize-handle" onMouseDown={handleResizeStart} id="resize-handle" />
        <div className="output-panel" style={{ height: outputHeight }} id="output-panel">
          <div className="output-header">
            <div className="output-header-left">
              <Terminal size={13} className="output-icon-svg" />
              <span className="output-title">Terminal</span>
              {output.length > 0 && <span className="output-count">{output.length}</span>}
            </div>
            <div className="output-header-right">
              <button className="out-tool-btn" onClick={handleCopyOutput} title="Copy output">
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
              <button className="out-tool-btn danger" onClick={handleClear} title="Clear terminal">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
          <div className="output-body" id="output-body">
            {output.length === 0 ? (
              <div className="output-empty">
                <Terminal size={24} className="output-empty-icon" />
                <span>Press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to run</span>
              </div>
            ) : (
              <>
                {output.map((line, i) => (
                  <div key={i} className={`output-line ${line.type}`}>{line.text}</div>
                ))}
                <div ref={outputEndRef} />
              </>
            )}
          </div>
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="footer" id="footer">
        <div className="footer-left">
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
        </div>
        <div className="footer-right">
          <span className="footer-item footer-shortcuts">
            Ctrl+Enter: Run &nbsp;│&nbsp; Ctrl+Shift+Enter: Parse
          </span>
          <span className="footer-divider" />
          <span className="footer-item footer-brand">SCA v2.0</span>
        </div>
      </footer>
    </div>
  );
}
