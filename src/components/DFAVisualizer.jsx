import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, StepForward, RotateCcw } from 'lucide-react'

const STATE_RADIUS = 28
const SVG_W = 700
const SVG_H = 280
const STATE_Y = 140
const SPACING = 85

function computePositions(states) {
  const count = Math.min(states.length, 7)
  const totalW = (count - 1) * SPACING
  const startX = (SVG_W - totalW) / 2
  return states.slice(0, 7).map((s, i) => ({ state: s, x: startX + i * SPACING, y: STATE_Y }))
}

function getArrow(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (!dist) return null
  const ux = dx / dist, uy = dy / dist
  const r = STATE_RADIUS + 5
  return {
    fromX: x1 + ux * r, fromY: y1 + uy * r,
    toX: x2 - ux * r, toY: y2 - uy * r,
    cpx: (x1 + x2) / 2, cpy: (y1 + y2) / 2 - 28
  }
}

export default function DFAVisualizer({ dfa, trace, currentStep, onComplete, accepted, onPlay, onPause, onStep, onReset, onSpeedChange }) {
  const [playing, setPlaying] = useState(false)
  const [localStep, setLocalStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [showVerdict, setShowVerdict] = useState(false)

  const activeStep = currentStep ?? localStep
  const totalSteps = trace?.length ?? 0
  const dfaStates = dfa?.states ?? []
  const positions = dfaStates.length ? computePositions(dfaStates) : []
  const stateMap = {}
  positions.forEach(p => { stateMap[p.state] = p })
  const currentTraceState = trace?.[activeStep]?.nextState ?? null
  const isLastStep = totalSteps > 0 && activeStep >= totalSteps - 1

  useEffect(() => {
    setLocalStep(0)
    setProgress(0)
    setPlaying(false)
    setShowVerdict(false)
  }, [trace])

  useEffect(() => {
    if (!playing || totalSteps === 0) return
    const interval = Math.max(120, 800 / speed)
    const id = setInterval(() => {
      setLocalStep(prev => {
        const next = prev + 1
        if (next >= totalSteps) {
          setPlaying(false)
          setProgress(100)
          setShowVerdict(true)
          onComplete?.()
          return prev
        }
        setProgress((next / totalSteps) * 100)
        return next
      })
    }, interval)
    return () => clearInterval(id)
  }, [playing, totalSteps, speed, trace, onComplete])

  const handlePlayPause = useCallback(() => {
    if (!trace?.length) return
    if (isLastStep) {
      setLocalStep(0); setProgress(0); setShowVerdict(false)
    }
    setPlaying(p => !p)
  }, [trace, isLastStep])

  const handleStep = useCallback(() => {
    setPlaying(false)
    setLocalStep(prev => {
      const next = prev + 1
      if (next >= totalSteps) {
        setProgress(100)
        setShowVerdict(true)
        onComplete?.()
        return prev
      }
      setProgress((next / totalSteps) * 100)
      return next
    })
  }, [totalSteps, trace, onComplete])

  const handleReset = useCallback(() => {
    setPlaying(false); setLocalStep(0); setProgress(0); setShowVerdict(false)
  }, [])

  const handleSpeed = useCallback(e => setSpeed(parseFloat(e.target.value)), [])

  const handleTimelineClick = useCallback(e => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const step = Math.round(pct * (totalSteps - 1))
    setLocalStep(Math.max(0, Math.min(step, totalSteps - 1)))
    setProgress(pct * 100)
    setPlaying(false)
    setShowVerdict(false)
  }, [totalSteps])

  const buildTransitions = () => {
    const els = []
    const tr = dfa?.transitions
    if (!tr) return els
    Object.entries(tr).forEach(([from, edges]) => {
      if (typeof edges !== 'object') return
      Object.entries(edges).forEach(([symbol, to]) => {
        const fp = stateMap[from], tp = stateMap[to]
        if (!fp || !tp) return
        const isActive = currentTraceState === to
        const stroke = isActive ? 'var(--accent)' : 'var(--border-light)'
        const sw = isActive ? 2.5 : 1.8

        if (from === to) {
          els.push(
            <g key={`sl-${from}-${symbol}`}>
              <path
                d={`M ${fp.x} ${fp.y - STATE_RADIUS - 5} C ${fp.x - 38} ${fp.y - STATE_RADIUS - 48}, ${fp.x + 38} ${fp.y - STATE_RADIUS - 48}, ${fp.x} ${fp.y - STATE_RADIUS - 5}`}
                fill="none" stroke={stroke} strokeWidth={sw} markerEnd="url(#arrowhead)"
                style={{ transition: 'stroke 0.25s ease, stroke-width 0.25s ease' }}
              />
              <text x={fp.x} y={fp.y - STATE_RADIUS - 38} textAnchor="middle" fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font-mono)">
                {symbol}
              </text>
            </g>
          )
        } else {
          const p = getArrow(fp.x, fp.y, tp.x, tp.y)
          if (!p) return
          els.push(
            <g key={`tr-${from}-${to}-${symbol}`}>
              <path
                d={`M ${p.fromX} ${p.fromY} Q ${p.cpx} ${p.cpy} ${p.toX} ${p.toY}`}
                fill="none" stroke={stroke} strokeWidth={sw} markerEnd="url(#arrowhead)"
                style={{ transition: 'stroke 0.25s ease, stroke-width 0.25s ease' }}
              />
              <text x={p.cpx} y={p.cpy - 6} textAnchor="middle" fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font-mono)">
                {symbol}
              </text>
            </g>
          )
        }
      })
    })
    return els
  }

  return (
    <div className="flex-col flex-1 overflow-hidden" style={{ position: 'relative', background: 'var(--bg-0)' }}>
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', height: '100%', display: 'block' }}>
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--border-light)" />
          </marker>
          <marker id="arrowhead-accent" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--accent)" />
          </marker>
          <filter id="dfa-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern id="grid-dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="0.8" fill="var(--bg-4)" opacity="0.5" />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid-dots)" />

        {buildTransitions()}

        {dfa?.start && stateMap[dfa.start] && (
          <g>
            <line
              x1={stateMap[dfa.start].x - STATE_RADIUS - 35}
              y1={stateMap[dfa.start].y}
              x2={stateMap[dfa.start].x - STATE_RADIUS - 5}
              y2={stateMap[dfa.start].y}
              stroke="var(--accent)" strokeWidth="2.5" markerEnd="url(#arrowhead-accent)"
            />
            <text
              x={stateMap[dfa.start].x - STATE_RADIUS - 22}
              y={stateMap[dfa.start].y - 10}
              textAnchor="middle" fill="var(--accent)" fontSize="10" fontFamily="var(--font-mono)" fontWeight="600"
            >
              start
            </text>
          </g>
        )}

        {positions.map(({ state, x, y }) => {
          const isAccept = dfa?.accept?.includes(state)
          const isCur = currentTraceState === state
          const fill = isCur ? 'rgba(124,111,240,0.18)' : 'var(--bg-2)'
          const stroke = isCur ? 'var(--accent)' : 'var(--border-light)'
          const labelFill = isCur ? 'var(--accent)' : 'var(--text)'
          const sw = isCur ? 2.5 : 1.8

          return (
            <g key={state}>
              {isAccept && (
                <circle cx={x} cy={y} r={STATE_RADIUS + 6} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray="4 3" opacity={0.7} style={{ transition: 'all 0.3s ease' }} />
              )}
              <circle
                cx={x} cy={y} r={STATE_RADIUS}
                fill={fill} stroke={stroke} strokeWidth={sw}
                style={{ transition: 'fill 0.3s ease, stroke 0.3s ease, stroke-width 0.3s ease' }}
                filter={isCur ? 'url(#dfa-glow)' : undefined}
              />
              <text
                x={x} y={y + 1} textAnchor="middle" dominantBaseline="central"
                fill={labelFill} fontSize="13" fontWeight="700" fontFamily="var(--font-mono)"
                style={{ transition: 'fill 0.3s ease' }}
              >
                {state}
              </text>
            </g>
          )
        })}
      </svg>

      {showVerdict && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 20,
          animation: 'fadeIn 0.3s ease'
        }}>
          <div className="glass-panel" style={{ padding: '24px 48px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>
              {accepted ? '✅' : '❌'}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: accepted ? 'var(--green)' : 'var(--red)' }}>
              {accepted ? 'Accepted' : 'Rejected'}
            </div>
          </div>
        </div>
      )}

      <div className="dfa-controls" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button className="dfa-btn" onClick={handlePlayPause} title={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button className="dfa-btn" onClick={handleStep} title="Step Forward" disabled={isLastStep}>
            <StepForward size={16} />
          </button>
          <button className="dfa-btn" onClick={handleReset} title="Reset">
            <RotateCcw size={16} />
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '400px', margin: '0 16px' }}>
          <div className="dfa-timeline" onClick={handleTimelineClick} style={{ flex: 1, cursor: 'pointer', position: 'relative' }}>
            <div style={{ height: '100%', background: 'var(--bg-3)', borderRadius: '2px', width: '100%', height: '5px' }}>
              <div className="dfa-timeline-progress" style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.1s ease' }} />
            </div>
          </div>
          <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)', minWidth: '50px', textAlign: 'center' }}>
            {activeStep + 1}/{totalSteps}
          </span>
        </div>

        <div className="dfa-speed" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="text-xs font-mono" style={{ color: 'var(--accent)', fontWeight: 600, minWidth: '32px' }}>{speed}x</span>
          <input type="range" min="0.25" max="3" step="0.25" value={speed} onChange={handleSpeed}
            style={{ width: '80px', accentColor: 'var(--accent)', cursor: 'pointer' }} />
        </div>
      </div>
    </div>
  )
}
