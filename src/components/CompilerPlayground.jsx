import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Play, Loader2, CheckCircle2, XCircle, AlertTriangle, Terminal, Braces, ListTree, Table2, Bug } from 'lucide-react'
import { SMART_LANG_DEFAULT } from '../constants.js'
import ASTVisualizer from './ASTVisualizer.jsx'

const TABS = [
  { id: 'tokens', label: 'Tokens', icon: Braces },
  { id: 'ast', label: 'AST', icon: ListTree },
  { id: 'symbols', label: 'Symbol Table', icon: Table2 },
  { id: 'errors', label: 'Errors/Warnings', icon: Bug },
]

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-col flex-center" style={{ padding: '24px', gap: '12px', textAlign: 'center' }}>
          <XCircle size={32} style={{ color: 'var(--red)' }} />
          <h4 style={{ color: 'var(--text)' }}>Component Error</h4>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', maxWidth: '300px' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button className="btn btn-accent btn-sm" onClick={() => this.setState({ hasError: false, error: null })}>
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

let _analyze

async function ensureAnalyze() {
  if (typeof _analyze === 'function') return
  try {
    const mod = await import('../compiler/smartCompiler.js')
    _analyze = mod.analyze
  } catch {
    _analyze = null
  }
}

function runAnalyze(code) {
  if (typeof _analyze !== 'function') {
    return {
      tokens: [], ast: null, symbolTable: [],
      errors: ['Smart compiler not available. Import the analyze function correctly.'],
      warnings: [], output: []
    }
  }
  return _analyze(code)
}

export default function CompilerPlayground() {
  const [code, setCode] = useState(SMART_LANG_DEFAULT)
  const [activeTab, setActiveTab] = useState('tokens')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [timing, setTiming] = useState(null)
  const textareaRef = useRef(null)
  const lineNumRef = useRef(null)

  useEffect(() => { ensureAnalyze() }, [])

  const lineCount = useMemo(() => code.split('\n').length, [code])

  useEffect(() => {
    if (lineNumRef.current) {
      const ta = textareaRef.current
      if (ta) {
        const scrollRatio = ta.scrollTop / (ta.scrollHeight - ta.clientHeight)
        lineNumRef.current.scrollTop = scrollRatio * (lineNumRef.current.scrollHeight - lineNumRef.current.clientHeight)
      }
    }
  }, [code])

  const syncScroll = useCallback(() => {
    const ta = textareaRef.current
    const gutter = lineNumRef.current
    if (ta && gutter) {
      gutter.scrollTop = ta.scrollTop
    }
  }, [])

  const handleAnalyze = useCallback(async () => {
    setLoading(true)
    setTiming(null)
    await ensureAnalyze()
    const start = performance.now()
    const res = runAnalyze(code)
    const elapsed = (performance.now() - start).toFixed(1)
    setResult(res)
    setTiming(elapsed)
    setLoading(false)
  }, [code])

  const handleKeyDown = useCallback(e => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart, end = ta.selectionEnd
      const newVal = code.slice(0, start) + '  ' + code.slice(end)
      setCode(newVal)
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 2 })
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (!loading) handleAnalyze()
    }
  }, [code, loading, handleAnalyze])

  const errCount = result?.errors?.length || 0
  const warnCount = result?.warnings?.length || 0

  const renderTokens = () => {
    const tokens = result?.tokens
    if (!tokens?.length) {
      return <div className="empty-state" style={{ padding: '24px' }}><span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No tokens found</span></div>
    }
    const typeCounts = {}
    tokens.forEach(t => { typeCounts[t.type] = (typeCounts[t.type] || 0) + 1 })
    return (
      <div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {tokens.length} tokens
          </span>
          {Object.entries(typeCounts).map(([type, count]) => (
            <span key={type} className={`badge badge-accent`} style={{ fontSize: '10px' }}>
              {type}: {count}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {tokens.map((token, i) => {
            const badgeClass = {
              KEYWORD: 'badge-purple', IDENTIFIER: 'badge-blue',
              NUMBER: 'badge-orange', STRING: 'badge-green',
              OPERATOR: 'badge-cyan', DELIMITER: 'badge',
            }[token.type] || 'badge'
            return (
              <div key={i} className="flex-row items-center gap-8" style={{
                padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                transition: 'background 0.15s ease',
                borderBottom: '1px solid var(--border)'
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span className={badgeClass} style={{ minWidth: '70px', textAlign: 'center' }}>
                  {token.type}
                </span>
                <code className="font-mono flex-1" style={{
                  color: 'var(--text)', fontSize: '12px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  {token.type === 'STRING' ? `"${token.value}"` : String(token.value)}
                </code>
                <span className="text-xs" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  L{token.line}:C{token.col}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderSymbolTable = () => {
    const symbols = result?.symbolTable
    if (!symbols?.length) {
      return <div className="empty-state" style={{ padding: '24px' }}><span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No symbol table entries</span></div>
    }
    return (
      <div className="table-container">
        <table className="symbol-table" style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 2 }}>Name</th>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 2 }}>Type</th>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 2 }}>Line</th>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 2 }}>Value</th>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 2 }}>Scope</th>
            </tr>
          </thead>
          <tbody>
            {symbols.map((sym, i) => {
              const typeClass = sym.type === 'int' || sym.type === 'float' ? 'badge-orange' :
                sym.type === 'string' ? 'badge-green' :
                sym.type === 'bool' ? 'badge-purple' : 'badge-blue'
              return (
                <tr key={i} style={{ transition: 'background 0.15s ease' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', color: 'var(--blue)', fontWeight: 600 }}>{sym.name}</td>
                  <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)' }}>
                    <span className={typeClass} style={{ padding: '1px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: 600 }}>{sym.type}</span>
                  </td>
                  <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>{sym.line}</td>
                  <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', color: sym.value != null ? 'var(--cyan)' : 'var(--text-muted)' }}>
                    {sym.value != null ? String(sym.value) : '-'}
                  </td>
                  <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                    <span className="badge badge-accent" style={{ fontSize: '10px' }}>{sym.scope || 'global'}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const renderErrors = () => {
    const errors = result?.errors || []
    const warnings = result?.warnings || []

    if (!errors.length && !warnings.length) {
      return (
        <div className="flex-col flex-center" style={{ padding: '32px', gap: '8px' }}>
          <CheckCircle2 size={32} style={{ color: 'var(--green)' }} />
          <span style={{ color: 'var(--green)', fontWeight: 600, fontSize: '14px' }}>No errors or warnings</span>
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {errors.length > 0 && (
          <div>
            <div className="flex-row items-center gap-8" style={{ padding: '6px 0', marginBottom: '4px', borderBottom: '1px solid var(--border)' }}>
              <XCircle size={14} style={{ color: 'var(--red)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Errors ({errors.length})
              </span>
            </div>
            {errors.map((err, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                background: 'rgba(224,108,117,0.06)', border: '1px solid rgba(224,108,117,0.12)',
                marginBottom: '4px', fontSize: '12px', color: 'var(--red)'
              }}>
                <XCircle size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{typeof err === 'string' ? err : err.message || String(err)}</span>
              </div>
            ))}
          </div>
        )}
        {warnings.length > 0 && (
          <div>
            <div className="flex-row items-center gap-8" style={{ padding: '6px 0', marginBottom: '4px', borderBottom: '1px solid var(--border)' }}>
              <AlertTriangle size={14} style={{ color: 'var(--yellow)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Warnings ({warnings.length})
              </span>
            </div>
            {warnings.map((warn, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                background: 'rgba(229,192,123,0.06)', border: '1px solid rgba(229,192,123,0.12)',
                marginBottom: '4px', fontSize: '12px', color: 'var(--yellow)'
              }}>
                <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{typeof warn === 'string' ? warn : warn.message || String(warn)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderOutput = () => {
    const output = result?.output
    if (!output?.length) return null
    return (
      <div style={{
        flexShrink: 0, borderTop: '1px solid var(--border)',
        background: 'var(--bg-0)', maxHeight: '160px', overflowY: 'auto'
      }}>
        <div className="flex-row items-center justify-between" style={{
          padding: '5px 12px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-2)', fontSize: '11px', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)'
        }}>
          <div className="flex-row items-center gap-6">
            <Terminal size={12} />
            <span>Interpreter Output</span>
          </div>
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            {output.length} line{output.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: '1.5' }}>
          {output.map((line, i) => (
            <div key={i} className="output-line default" style={{ padding: '1px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              <span style={{ color: 'var(--text-muted)', marginRight: '8px', userSelect: 'none' }}>&gt;</span>
              {line}
            </div>
          ))}
          <div className="output-line success" style={{ padding: '4px 0 0', fontSize: '12px', color: 'var(--green)', borderTop: '1px solid var(--border)', marginTop: '4px' }}>
            Program executed successfully ({output.length} step{output.length !== 1 ? 's' : ''})
          </div>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex-col" style={{ height: '100%', overflow: 'hidden' }}>
        <div className="flex-row items-center justify-between" style={{
          padding: '6px 12px', background: 'var(--bg-1)',
          borderBottom: '1px solid var(--border)', flexShrink: 0, minHeight: '40px'
        }}>
          <div className="flex-row items-center gap-8">
            <Terminal size={14} style={{ color: 'var(--accent)' }} />
            <span className="font-semibold" style={{ fontSize: '13px', color: 'var(--text)' }}>Smart Playground</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Mini-Language Compiler</span>
          </div>
          <div className="flex-row items-center gap-8">
            {timing && (
              <span className="badge badge-accent font-mono" style={{ fontSize: '10px' }}>
                &#9202; {timing}ms
              </span>
            )}
            <button
              className="btn btn-accent btn-sm"
              onClick={handleAnalyze}
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={14} fill="currentColor" />
              )}
              <span>{loading ? 'Analyzing...' : 'Analyze'}</span>
            </button>
          </div>
        </div>

        <div className="flex-row" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div className="flex-col" style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            <div className="flex-row items-center gap-8" style={{
              padding: '4px 12px', background: 'var(--bg-2)',
              borderBottom: '1px solid var(--border)', flexShrink: 0, fontSize: '11px',
              color: 'var(--text-muted)'
            }}>
              <Bug size={11} />
              <span>Source Code</span>
              <span style={{ marginLeft: 'auto' }}>
                <kbd style={{ padding: '1px 4px', fontSize: '10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--text-muted)' }}>Tab</kbd> inserts 2 spaces
                &nbsp;&middot;&nbsp;
                <kbd style={{ padding: '1px 4px', fontSize: '10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--text-muted)' }}>Ctrl+Enter</kbd> to run
              </span>
            </div>
            <div className="smart-editor" style={{
              flex: 1, display: 'flex', overflow: 'hidden', position: 'relative',
              background: 'var(--bg-0)'
            }}>
              <div ref={lineNumRef} style={{
                width: '44px', flexShrink: 0, overflow: 'hidden',
                background: 'var(--bg-1)', borderRight: '1px solid var(--border)',
                padding: '10px 0', textAlign: 'right', userSelect: 'none',
                fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: '1.5'
              }}>
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i} style={{
                    padding: '0 8px', color: 'var(--text-muted)', fontSize: '12px'
                  }}>
                    {i + 1}
                  </div>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                value={code}
                onChange={e => setCode(e.target.value)}
                onKeyDown={handleKeyDown}
                onScroll={syncScroll}
                spellCheck={false}
                style={{
                  flex: 1, border: 'none', outline: 'none', resize: 'none',
                  background: 'transparent', color: 'var(--text)',
                  fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: '1.5',
                  padding: '10px 12px', overflowY: 'auto',
                }}
              />
            </div>
          </div>

          <div className="flex-col" style={{
            width: '400px', flexShrink: 0,
            borderLeft: '1px solid var(--border)', overflow: 'hidden',
            background: 'var(--bg-1)'
          }}>
            <div className="smart-tabs" style={{
              display: 'flex', borderBottom: '1px solid var(--border)',
              flexShrink: 0, background: 'var(--bg-2)'
            }}>
              {TABS.map(tab => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    className={`smart-tab ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      flex: 1, padding: '8px', background: 'transparent', border: 'none',
                      color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                      fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500,
                      cursor: 'pointer', borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                      transition: 'all 0.2s ease', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: '4px'
                    }}
                    onMouseEnter={e => { if (activeTab !== tab.id) e.currentTarget.style.background = 'var(--bg-3)' }}
                    onMouseLeave={e => { if (activeTab !== tab.id) e.currentTarget.style.background = 'transparent' }}
                  >
                    <Icon size={12} />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="smart-tab-content" style={{
              flex: 1, padding: '12px', overflowY: 'auto'
            }}>
              {!result && !loading && (
                <div className="empty-state" style={{ padding: '24px' }}>
                  <Terminal size={32} style={{ opacity: 0.25 }} />
                  <div className="empty-state-title" style={{ fontSize: '14px' }}>No Results Yet</div>
                  <div className="empty-state-desc" style={{ fontSize: '12px' }}>
                    Write code and click <strong style={{ color: 'var(--accent)' }}>Analyze</strong> to see results
                  </div>
                </div>
              )}

              {loading && (
                <div className="flex-col flex-center" style={{ padding: '32px', gap: '12px' }}>
                  <div className="loading-spinner" />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Analyzing code...</span>
                </div>
              )}

              {result && !loading && activeTab === 'tokens' && renderTokens()}
              {result && !loading && activeTab === 'ast' && (
                <ErrorBoundary key={JSON.stringify(result.ast)}>
                  <div style={{ width: '100%', height: 'calc(100% - 8px)', minHeight: '250px' }}>
                    {result.ast ? (
                      <ASTVisualizer ast={result.ast} />
                    ) : (
                      <div className="empty-state" style={{ padding: '24px' }}>
                        <ListTree size={32} style={{ opacity: 0.25 }} />
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No AST generated</span>
                      </div>
                    )}
                  </div>
                </ErrorBoundary>
              )}
              {result && !loading && activeTab === 'symbols' && renderSymbolTable()}
              {result && !loading && activeTab === 'errors' && renderErrors()}
            </div>
          </div>
        </div>

        {renderOutput()}
      </div>
    </ErrorBoundary>
  )
}
