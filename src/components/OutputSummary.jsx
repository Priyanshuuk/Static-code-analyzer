import { Hash, Clock, XCircle, AlertTriangle, CheckCircle2, List } from 'lucide-react'
import { TOKEN_COLORS } from '../constants.js'

export default function OutputSummary({ tokens, analysisTime, errorCount, warningCount }) {
  const breakdown = {}
  tokens.forEach((t) => {
    breakdown[t.type] = (breakdown[t.type] || 0) + 1
  })

  const maxCount = Math.max(...Object.values(breakdown), 1)

  if (!tokens || tokens.length === 0) {
    return (
      <div className="output-summary">
        <div className="flex-col items-center justify-center gap-8 p-20 text-center">
          <List size={36} className="text-muted opacity-50" />
          <div className="flex-col gap-4">
            <span className="text-secondary font-semibold" style={{ fontSize: '16px' }}>No Analysis Data</span>
            <span className="text-muted text-sm">Run an analysis to see the summary</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="output-summary">
      <div className="summary-grid">
        <div className="summary-item">
          <Hash size={14} className="text-muted" />
          <div className="summary-item-label">Total Tokens</div>
          <div className="summary-item-value">{tokens.length}</div>
        </div>
        <div className="summary-item">
          <Clock size={14} className="text-muted" />
          <div className="summary-item-label">Analysis Time</div>
          <div className="summary-item-value cyan">{analysisTime != null ? `${analysisTime}ms` : '—'}</div>
        </div>
        <div className={`summary-item ${errorCount > 0 ? 'glow-red' : ''}`}>
          <XCircle size={14} className={errorCount > 0 ? 'text-red' : 'text-muted'} />
          <div className="summary-item-label">Errors</div>
          <div className={`summary-item-value ${errorCount > 0 ? 'red' : ''}`}>{errorCount}</div>
        </div>
        <div className={`summary-item ${warningCount > 0 ? 'glow-yellow' : ''}`}>
          <AlertTriangle size={14} className={warningCount > 0 ? 'text-yellow' : 'text-muted'} />
          <div className="summary-item-label">Warnings</div>
          <div className={`summary-item-value ${warningCount > 0 ? 'yellow' : ''}`}>{warningCount}</div>
        </div>
      </div>

      {Object.keys(breakdown).length > 0 && (
        <div className="summary-breakdown">
          <div className="flex-row items-center gap-8 mb-8">
            <List size={13} className="text-muted" />
            <span className="text-secondary font-semibold text-sm">Token Breakdown</span>
          </div>
          <div className="flex-col gap-4">
            {Object.entries(breakdown).map(([type, count]) => {
              const color = TOKEN_COLORS[type] || '#abb2bf'
              const pct = (count / maxCount) * 100
              return (
                <div key={type} className="breakdown-row">
                  <div className="flex-row gap-8 items-center" style={{ flex: 1 }}>
                    <span className="breakdown-type">{type}</span>
                    <div className="flex-1 rounded-sm" style={{ height: '12px', background: 'var(--bg-2)', overflow: 'hidden' }}>
                      <div
                        className="h-full rounded-sm transition"
                        style={{
                          width: `${Math.max(pct, 4)}%`,
                          height: '100%',
                          background: `linear-gradient(90deg, ${color}99, ${color}44)`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="breakdown-count">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex-col gap-8" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
        {errorCount > 0 ? (
          <div className="flex-row items-center gap-8">
            <XCircle size={16} className="text-red" />
            <span className="text-red font-medium">Analysis failed with {errorCount} error{errorCount !== 1 ? 's' : ''}</span>
          </div>
        ) : warningCount > 0 ? (
          <div className="flex-row items-center gap-8">
            <AlertTriangle size={16} className="text-yellow" />
            <span className="text-yellow font-medium">Analyzed with {warningCount} warning{warningCount !== 1 ? 's' : ''}</span>
          </div>
        ) : (
          <div className="flex-row items-center gap-8">
            <CheckCircle2 size={16} className="text-green" />
            <span className="text-green font-medium">Analysis passed successfully</span>
          </div>
        )}
      </div>
    </div>
  )
}
