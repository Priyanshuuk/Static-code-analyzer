import { useEffect, useRef } from 'react'
import { ArrowRight, CheckCircle2, XCircle, GitBranch } from 'lucide-react'

export default function ExecutionTrace({ trace, currentStep, accepted }) {
  const listRef = useRef(null)
  const stepRefs = useRef([])

  useEffect(() => {
    if (stepRefs.current[currentStep]) {
      stepRefs.current[currentStep].scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [currentStep])

  if (!trace || trace.length === 0) {
    return (
      <div className="execution-trace">
        <div className="flex-col items-center justify-center gap-8 p-20 text-center">
          <GitBranch size={36} className="text-muted opacity-50" />
          <div className="flex-col gap-4">
            <span className="text-secondary font-semibold" style={{ fontSize: '14px' }}>No Trace Available</span>
            <span className="text-muted text-sm">Run a DFA simulation to see execution trace</span>
          </div>
        </div>
      </div>
    )
  }

  const isComplete = currentStep >= trace.length - 1
  const isAccepted = isComplete && accepted

  return (
    <div className="execution-trace">
      <div className="flex-row items-center justify-between mb-8">
        <span className="execution-trace-title">DFA Execution Trace</span>
        <span className="badge">{trace.length} step{trace.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex-col gap-4" ref={listRef}>
        {trace.map((step, i) => {
          const isCurrent = currentStep === i
          return (
            <div
              key={i}
              ref={(el) => (stepRefs.current[i] = el)}
              className={`trace-step ${isCurrent ? 'current' : ''}`}
            >
              <div
                className="flex-shrink-0 flex-row items-center justify-center"
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: isCurrent ? 'var(--accent)' : 'var(--bg-3)',
                  color: isCurrent ? '#fff' : 'var(--text-muted)',
                  fontSize: '10px',
                  fontWeight: 700,
                }}
              >
                {i + 1}
              </div>
              <div className="flex-row items-center gap-4" style={{ flex: 1, minWidth: 0 }}>
                <code className="font-mono" style={{ fontSize: '12px' }}>
                  <span className="trace-state">{step.state}</span>
                </code>
                <ArrowRight size={12} className="trace-arrow" />
                <code className="font-mono" style={{ fontSize: '12px' }}>
                  <span className="trace-symbol">'{step.symbol}'</span>
                </code>
                <ArrowRight size={12} className="trace-arrow" />
                <code className="font-mono" style={{ fontSize: '12px' }}>
                  <span className="trace-state">{step.nextState}</span>
                </code>
              </div>
              {isCurrent && (
                <span className="badge badge-accent animate-fade-in" style={{ flexShrink: 0 }}>current</span>
              )}
            </div>
          )
        })}
      </div>
      {isComplete && (
        <div className="flex-row items-center gap-8 mt-16" style={{ padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          {isAccepted ? (
            <>
              <CheckCircle2 size={18} className="text-green" />
              <span className="text-green font-semibold">Accepted</span>
              <span className="text-muted text-sm">({trace.length} steps)</span>
            </>
          ) : (
            <>
              <XCircle size={18} className="text-red" />
              <span className="text-red font-semibold">Rejected</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
