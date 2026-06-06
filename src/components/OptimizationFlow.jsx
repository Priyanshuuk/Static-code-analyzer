import { useState } from 'react'
import { Copy, Check, Zap, TrendingDown, BarChart3 } from 'lucide-react'

function instructionKey(inst) {
  if (!inst) return null
  return `${inst.op}|${inst.dest}|${inst.arg1}|${inst.arg2}|${inst.arg3}|${inst.label}`
}

function computeDiff(orig, opt) {
  const o = orig || [], p = opt || []
  const max = Math.max(o.length, p.length)
  const rows = []
  let removed = 0, changed = 0, added = 0, folds = 0, cse = 0, dce = 0, algsimp = 0

  for (let i = 0; i < max; i++) {
    const hasOrig = i < o.length
    const hasOpt = i < p.length
    if (hasOrig && hasOpt) {
      if (instructionKey(o[i]) === instructionKey(p[i])) {
        rows.push({ left: o[i], right: p[i], type: 'same', idx: i })
      } else {
        rows.push({ left: o[i], right: p[i], type: 'changed', idx: i })
        changed++
        if (p[i].comment?.includes('folded')) folds++
        if (p[i].comment?.includes('reuse')) cse++
        if (p[i].comment?.includes('dead')) dce++
        if (p[i].comment?.includes('→ x') || p[i].comment?.includes('→ 0')) algsimp++
      }
    } else if (hasOrig && !hasOpt) {
      rows.push({ left: o[i], right: null, type: 'removed', idx: i })
      removed++
      dce++
    } else {
      rows.push({ left: null, right: p[i], type: 'added', idx: i })
      added++
    }
  }

  return {
    rows, removed, changed, added, folds, cse, dce, algsimp,
    reduction: o.length ? Math.round(((o.length - p.length) / o.length) * 100) : 0
  }
}

export default function OptimizationFlow({ original, optimized }) {
  const [copiedOrig, setCopiedOrig] = useState(false)
  const [copiedOpt, setCopiedOpt] = useState(false)

  const orig = original || []
  const opt = optimized || []
  const diff = computeDiff(orig, opt)

  const handleCopy = (text, setter) => {
    navigator.clipboard.writeText(text).then(() => {
      setter(true)
      setTimeout(() => setter(false), 1500)
    })
  }

  if (!orig.length && !opt.length) {
    return (
      <div className="empty-state">
        <Zap size={48} style={{ opacity: 0.25 }} />
        <div className="empty-state-title">No TAC Generated</div>
        <div className="empty-state-desc">Click &lsquo;Generate TAC&rsquo; in the pipeline to see optimization results.</div>
      </div>
    )
  }

  const Panel = ({ title, lines, side, count }) => (
    <div className="opt-panel">
      <div className="opt-panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 'var(--radius) var(--radius) 0 0', border: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{title}</span>
          <span className={`badge ${side === 'left' ? 'badge-accent' : 'badge-green'}`}>
            {count} inst{count !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          className="icon-btn"
          onClick={() => handleCopy(lines.filter(l => l !== null).join('\n'), side === 'left' ? setCopiedOrig : setCopiedOpt)}
          title="Copy to clipboard"
          style={{ width: '28px', height: '28px' }}
        >
          {side === 'left' ? (copiedOrig ? <Check size={14} /> : <Copy size={14} />) : (copiedOpt ? <Check size={14} /> : <Copy size={14} />)}
        </button>
      </div>
      <div className="opt-panel-body" style={{
        flex: 1, background: 'var(--bg-1)', border: '1px solid var(--border)', borderTop: 'none',
        borderRadius: '0 0 var(--radius) var(--radius)', padding: '8px 0',
        fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: '1.6', overflowY: 'auto'
      }}>
        {lines.map((line, i) => {
          if (line === null) {
            return (
              <div key={`empty-${i}`} style={{ padding: '1px 12px', opacity: 0.3, color: 'var(--text-muted)', fontStyle: 'italic', userSelect: 'none' }}>
                ---
              </div>
            )
          }
          return (
            <div key={`${side}-${i}`} style={{
              padding: '1px 12px', whiteSpace: 'pre',
              display: 'flex', alignItems: 'center', gap: '8px',
              transition: 'background 0.15s ease'
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ color: 'var(--text-muted)', width: '28px', textAlign: 'right', userSelect: 'none', flexShrink: 0 }}>
                {i + 1}
              </span>
              <span style={{ flex: 1 }}>{line}</span>
            </div>
          )
        })}
      </div>
    </div>
  )

  const leftLines = diff.rows.map(r => r.left)
  const rightLines = diff.rows.map(r => r.right)

  const leftColors = {}
  const rightColors = {}
  diff.rows.forEach((r, i) => {
    if (r.type === 'removed') {
      leftColors[i] = 'removed'
    } else if (r.type === 'changed') {
      leftColors[i] = 'changed'
      rightColors[i] = 'changed'
    } else if (r.type === 'added') {
      rightColors[i] = 'added'
    }
  })

  const renderPanel = (title, lines, colors, side, count) => (
    <div className="opt-panel">
      <div className="opt-panel-header" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', background: 'var(--bg-2)',
        borderRadius: 'var(--radius) var(--radius) 0 0',
        border: '1px solid var(--border)', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{title}</span>
          <span className={`badge ${side === 'left' ? 'badge-accent' : 'badge-green'}`}>
            {count} inst{count !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          className="icon-btn"
          onClick={() => handleCopy(lines.filter(l => l !== null).join('\n'), side === 'left' ? setCopiedOrig : setCopiedOpt)}
          title="Copy to clipboard"
        >
          {(side === 'left' ? copiedOrig : copiedOpt) ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <div className="opt-panel-body" style={{
        flex: 1, background: 'var(--bg-1)', border: '1px solid var(--border)', borderTop: 'none',
        borderRadius: '0 0 var(--radius) var(--radius)', padding: '8px 0',
        fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: '1.6', overflowY: 'auto'
      }}>
        {lines.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No instructions
          </div>
        )}
        {lines.map((line, i) => {
          const color = colors[i]
          const baseStyle = {
            padding: '1px 12px', whiteSpace: 'pre',
            display: 'flex', alignItems: 'center', gap: '8px',
            transition: 'all 0.2s ease',
            ...(color === 'removed' ? { textDecoration: 'line-through', color: 'var(--red)', opacity: 0.5 } : {}),
            ...(color === 'changed' ? { background: 'rgba(229,192,123,0.08)', borderLeft: '2px solid var(--yellow)', paddingLeft: '10px' } : {}),
            ...(color === 'added' ? { background: 'rgba(76,175,125,0.08)', borderLeft: '2px solid var(--green)', paddingLeft: '10px', color: 'var(--green)' } : {}),
          }
          return (
            <div key={`${side}-${i}`} style={baseStyle}
              onMouseEnter={e => { if (!color) e.currentTarget.style.background = 'var(--bg-2)' }}
              onMouseLeave={e => { if (!color) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ color: 'var(--text-muted)', width: '28px', textAlign: 'right', userSelect: 'none', flexShrink: 0, textDecoration: 'none', opacity: color === 'removed' ? 0.4 : 1 }}>
                {i + 1}
              </span>
              <span style={{ flex: 1 }}>
                {line !== null ? line : <span style={{ fontStyle: 'italic', opacity: 0.3 }}>---</span>}
              </span>
              {color === 'removed' && <span className="badge badge-red">removed</span>}
              {color === 'changed' && <span className="badge badge-yellow">changed</span>}
              {color === 'added' && <span className="badge badge-green">added</span>}
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="flex-col" style={{ height: '100%', overflow: 'hidden' }}>
      <div className="flex-row gap-16" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '12px' }}>
        {renderPanel('Original TAC', leftLines, leftColors, 'left', orig.length)}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: '32px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'rgba(124,111,240,0.1)', border: '1px solid rgba(124,111,240,0.2)'
          }}>
            <TrendingDown size={16} style={{ color: diff.reduction > 0 ? 'var(--green)' : 'var(--text-muted)' }} />
          </div>
        </div>
        {renderPanel('Optimized TAC', rightLines, rightColors, 'right', opt.length)}
      </div>

      <div className="opt-stats" style={{
        display: 'flex', gap: '16px', padding: '10px 16px', margin: '0 12px 12px',
        background: 'var(--bg-2)', borderRadius: 'var(--radius)', flexShrink: 0,
        border: '1px solid var(--border)'
      }}>
        <div className="opt-stat" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span className="opt-stat-value font-mono" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
            {orig.length}
            <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>&rarr;</span>
            <span style={{ color: 'var(--green)' }}>{opt.length}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '6px' }}>
              ({diff.reduction > 0 ? '-' : ''}{diff.reduction}%)
            </span>
          </span>
          <span className="opt-stat-label" style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', fontWeight: 600 }}>Instructions</span>
        </div>
        <div style={{ width: '1px', background: 'var(--border)' }} />
        <div className="opt-stat" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span className="opt-stat-value font-mono" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--yellow)' }}>{diff.folds}</span>
          <span className="opt-stat-label" style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', fontWeight: 600 }}>Constant Folds</span>
        </div>
        <div style={{ width: '1px', background: 'var(--border)' }} />
        <div className="opt-stat" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span className="opt-stat-value font-mono" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--purple)' }}>{diff.cse}</span>
          <span className="opt-stat-label" style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', fontWeight: 600 }}>CSE</span>
        </div>
        <div style={{ width: '1px', background: 'var(--border)' }} />
        <div className="opt-stat" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span className="opt-stat-value font-mono" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--red)' }}>{diff.dce}</span>
          <span className="opt-stat-label" style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', fontWeight: 600 }}>Dead Code Elim</span>
        </div>
        <div style={{ width: '1px', background: 'var(--border)' }} />
        <div className="opt-stat" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span className="opt-stat-value font-mono" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--cyan)' }}>{diff.algsimp}</span>
          <span className="opt-stat-label" style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', fontWeight: 600 }}>Alg. Simplifications</span>
        </div>
      </div>
    </div>
  )
}
