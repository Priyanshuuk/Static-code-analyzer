import { useState, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { DEFAULT_CODE, LANGUAGES } from './constants.js';
import './index.css';

// Map language id to a Lucide icon
const langIconMap = {
  c: Cpu,
  python: FileCode,
  java: Braces,
};

export default function App() {
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(DEFAULT_CODE['python']);
  const [output, setOutput] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [outputHeight, setOutputHeight] = useState(200);
  const editorRef = useRef(null);
  const resizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  // Language change handler
  const handleLanguageChange = useCallback((e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    setCode(DEFAULT_CODE[newLang]);
  }, []);

  // Editor mount handler
  const handleEditorMount = useCallback((editor) => {
    editorRef.current = editor;
    editor.focus();
  }, []);

  // Run button click — calls backend API
  const handleRun = useCallback(async () => {
    setIsRunning(true);
    const langMeta = LANGUAGES.find((l) => l.id === language);
    const timestamp = new Date().toLocaleTimeString();

    setOutput((prev) => [
      ...prev,
      { type: 'info', text: `[${timestamp}] Sending ${langMeta.label} code to server...` },
    ]);

    try {
      const response = await fetch('http://localhost:5000/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code, input: '' }),
      });

      const data = await response.json();
      const finishTime = new Date().toLocaleTimeString();

      if (data.error && !data.output) {
        // Error only
        setOutput((prev) => [
          ...prev,
          { type: 'error', text: data.error },
          { type: 'info', text: `[${finishTime}] Execution time: ${data.executionTime}ms` },
        ]);
      } else {
        // Success (possibly with warnings in error)
        const lines = [];
        if (data.output) {
          lines.push({ type: 'success', text: `[${finishTime}] Execution successful ✓` });
          lines.push({ type: 'default', text: '' });
          data.output.split('\n').forEach((line) => {
            lines.push({ type: 'default', text: line });
          });
        }
        if (data.error) {
          lines.push({ type: 'error', text: data.error });
        }
        lines.push({ type: 'default', text: '' });
        lines.push({ type: 'info', text: `[${finishTime}] Process finished (${data.executionTime}ms)` });
        setOutput((prev) => [...prev, ...lines]);
      }
    } catch (err) {
      const errorTime = new Date().toLocaleTimeString();
      setOutput((prev) => [
        ...prev,
        { type: 'error', text: `[${errorTime}] Connection error: ${err.message}` },
        { type: 'error', text: 'Make sure the backend server is running on port 5000.' },
      ]);
    } finally {
      setIsRunning(false);
    }
  }, [language, code]);

  // Clear output
  const handleClear = useCallback(() => {
    setOutput([]);
  }, []);

  // Resize handlers
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    resizingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = outputHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e) => {
      if (!resizingRef.current) return;
      const delta = startYRef.current - e.clientY;
      const newHeight = Math.max(100, Math.min(500, startHeightRef.current + delta));
      setOutputHeight(newHeight);
    };

    const handleMouseUp = () => {
      resizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [outputHeight]);

  const currentLang = LANGUAGES.find((l) => l.id === language);
  const LangIcon = langIconMap[language] || Code2;

  return (
    <div className="app-container">
      {/* ─── Header / Toolbar ─── */}
      <header className="header" id="main-header">
        <div className="header-left">
          <div className="logo">
            <div className="logo-icon">
              <Code2 size={18} color="#fff" />
            </div>
            <span className="logo-text">Codeezy</span>
          </div>

          <div className="header-divider" />

          {/* Language Selector */}
          <div className="language-selector" id="language-selector">
            <select
              className="language-select"
              value={language}
              onChange={handleLanguageChange}
              id="language-dropdown"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.icon}  {lang.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="select-chevron" />
          </div>
        </div>

        <div className="header-right">
          {/* Status */}
          <div className="status-indicator" id="status-indicator">
            <span className="status-dot" />
            <span>Ready</span>
          </div>

          {/* Run Button */}
          <button
            className="run-btn"
            onClick={handleRun}
            disabled={isRunning}
            id="run-button"
          >
            <span className="btn-icon">
              <Play size={14} fill="currentColor" />
            </span>
            <span>{isRunning ? 'Running…' : 'Run Code'}</span>
          </button>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="main-content">
        {/* Monaco Editor */}
        <div className="editor-container" id="code-editor">
          <Editor
            height="100%"
            language={currentLang.monacoId}
            value={code}
            onChange={(value) => setCode(value || '')}
            onMount={handleEditorMount}
            theme="vs-dark"
            loading={
              <div className="editor-loading">
                <div className="loading-spinner" />
                <span>Loading editor…</span>
              </div>
            }
            options={{
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontLigatures: true,
              minimap: { enabled: true, scale: 1 },
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
              suggest: { showMethods: true, showFunctions: true },
            }}
          />
        </div>

        {/* ─── Output Panel ─── */}
        <div
          className="resize-handle"
          onMouseDown={handleResizeStart}
          id="resize-handle"
        />
        <div
          className="output-panel"
          style={{ height: outputHeight }}
          id="output-panel"
        >
          <div className="output-header">
            <div className="output-header-left">
              <span className="output-icon">
                <Terminal size={14} />
              </span>
              <span className="output-title">Output</span>
            </div>
            <button className="clear-btn" onClick={handleClear} id="clear-output-btn">
              <Trash2 size={12} />
              <span>Clear</span>
            </button>
          </div>

          <div className="output-body" id="output-body">
            {output.length === 0 ? (
              <div className="output-empty">
                <Terminal size={24} className="output-empty-icon" />
                <span>Click "Run Code" to see output here</span>
              </div>
            ) : (
              output.map((line, i) => (
                <div key={i} className={`output-line ${line.type}`}>
                  {line.text}
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="footer" id="footer">
        <div className="footer-left">
          <span className="footer-item">
            <LangIcon size={12} />
            <span>{currentLang.label}</span>
          </span>
          <span className="footer-divider" />
          <span className="footer-item">UTF-8</span>
          <span className="footer-divider" />
          <span className="footer-item">Spaces: 4</span>
        </div>
        <div className="footer-right">
          <span className="footer-item">Codeezy v1.0</span>
        </div>
      </footer>
    </div>
  );
}
