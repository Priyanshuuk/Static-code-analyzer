import { useState, useRef, useCallback, useEffect } from 'react'
import { Plus, Minus, RotateCcw, TreePine } from 'lucide-react'

const NODE_COLORS = {
  Program: '#7c6ff0',
  LetDecl: '#61afef',
  Assignment: '#98c379',
  IfStmt: '#e5c07b',
  WhileStmt: '#d19a66',
  PrintStmt: '#56b6c2',
  Block: '#abb2bf',
  BinaryExpr: '#c678dd',
  UnaryExpr: '#e06c75',
  Literal: '#98c379',
  Identifier: '#61afef',
}

const NODE_H = 32
const H_SPACING = 24
const V_SPACING = 56

function layout(ast, x = 0, y = 0) {
  if (!ast) return { width: 0, height: 0, nodes: [], edges: [] }
  const id = Math.random().toString(36).slice(2, 8)
  const children = Array.isArray(ast.children) ? ast.children : []
  const childLayouts = children.map(c => layout(c))

  const totalCW = childLayouts.reduce((s, c) => s + c.width, 0)
  const childGaps = Math.max(0, children.length - 1) * H_SPACING
  const subtreeW = Math.max(60, totalCW + childGaps)

  const label = (ast.type || ast.kind || 'Node').slice(0, 20)
  const val = ast.value != null ? String(ast.value).slice(0, 15) : ''
  const display = val ? `${label}: ${val}` : label
  const nodeW = Math.max(60, Math.min(180, display.length * 8 + 20))

  let cx = x + (subtreeW - nodeW) / 2

  let childOffX = x + (subtreeW - totalCW - childGaps) / 2
  childLayouts.forEach(cl => {
    const offX = childOffX + (cl.width - Math.max(60, Math.min(180, 0))) / 2
    const offY = y + V_SPACING + NODE_H
    cl.nodes.forEach(n => { n.x += offX; n.y += offY })
    cl.edges.forEach(e => { e.x1 += offX; e.y1 += offY; e.x2 += offX; e.y2 += offY })
    childOffX += cl.width + H_SPACING
  })

  const myNode = {
    id, label: display, value: val,
    x: cx, y, w: nodeW, h: NODE_H,
    origType: ast.type || ast.kind || 'Node',
    color: NODE_COLORS[ast.type] || NODE_COLORS[ast.kind] || '#5c6370',
  }
  const nodes = [myNode, ...childLayouts.flatMap(c => c.nodes)]

  const edges = childLayouts.flatMap(c => {
    if (!c.nodes.length) return []
    const cn = c.nodes[0]
    return [{
      x1: myNode.x + myNode.w / 2, y1: myNode.y + myNode.h,
      x2: cn.x + cn.w / 2, y2: cn.y,
      src: myNode.id, dst: cn.id,
    }, ...c.edges]
  })

  const height = childLayouts.length
    ? Math.max(...childLayouts.map(c => c.height)) + V_SPACING + NODE_H
    : NODE_H

  return { width: Math.max(subtreeW, nodeW), height, nodes, edges }
}

export default function ASTVisualizer({ ast }) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [tooltip, setTooltip] = useState(null)
  const containerRef = useRef(null)
  const svgRef = useRef(null)

  const tree = ast ? layout(ast) : null

  const handleWheel = useCallback(e => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom(z => Math.max(0.3, Math.min(3, z + delta)))
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const handleMouseDown = useCallback(e => {
    if (e.button !== 0) return
    setDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    setPanStart({ ...pan })
  }, [pan])

  const handleMouseMove = useCallback(e => {
    if (!dragging) return
    setPan({ x: panStart.x + e.clientX - dragStart.x, y: panStart.y + e.clientY - dragStart.y })
  }, [dragging, dragStart, panStart])

  const handleMouseUp = useCallback(() => setDragging(false), [])

  useEffect(() => {
    if (!dragging) return
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp) }
  }, [dragging, handleMouseMove, handleMouseUp])

  if (!ast || !tree) {
    return (
      <div className="empty-state">
        <TreePine size={48} style={{ opacity: 0.25 }} />
        <div className="empty-state-title">No AST Available</div>
        <div className="empty-state-desc">Run analysis in the Smart Playground to generate an AST.</div>
      </div>
    )
  }

  const svgW = Math.max(400, tree.width + 80)
  const svgH = Math.max(300, tree.height + 80)

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'var(--bg-0)', borderRadius: 'var(--radius)' }}>
      <div style={{
        position: 'absolute', top: '8px', left: '8px', zIndex: 10,
        display: 'flex', alignItems: 'center', gap: '6px',
        background: 'var(--glass-bg)', backdropFilter: 'blur(8px)',
        border: '1px solid var(--glass-border)', borderRadius: 'var(--radius)',
        padding: '4px 8px'
      }}>
        <button className="icon-btn" onClick={() => setZoom(z => Math.min(3, z + 0.2))} title="Zoom in">
          <Plus size={14} />
        </button>
        <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)', minWidth: '36px', textAlign: 'center', fontWeight: 600 }}>
          {Math.round(zoom * 100)}%
        </span>
        <button className="icon-btn" onClick={() => setZoom(z => Math.max(0.3, z - 0.2))} title="Zoom out">
          <Minus size={14} />
        </button>
        <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 2px' }} />
        <button className="icon-btn" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} title="Reset view">
          <RotateCcw size={14} />
        </button>
        <span className="text-xs" style={{ color: 'var(--text-muted)', marginLeft: '4px', userSelect: 'none' }}>
          Scroll to zoom &middot; Drag to pan
        </span>
      </div>

      <div
        ref={svgRef}
        onMouseDown={handleMouseDown}
        style={{ width: '100%', height: '100%', cursor: dragging ? 'grabbing' : 'grab', overflow: 'hidden' }}
      >
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{
            width: '100%', height: '100%',
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: '0 0'
          }}
        >
          <defs>
            <filter id="ast-glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {tree.edges.map((e, i) => {
            const midX = (e.x1 + e.x2) / 2
            const midY = (e.y1 + e.y2) / 2
            return (
              <path
                key={`e${i}`}
                d={`M ${e.x1} ${e.y1} Q ${midX} ${midY} ${e.x2} ${e.y2}`}
                fill="none" stroke="var(--border-light)" strokeWidth="1.5"
                style={{ transition: 'stroke 0.2s ease' }}
              />
            )
          })}

          {tree.nodes.map(node => (
            <g
              key={node.id}
              onMouseEnter={e => {
                const r = containerRef.current?.getBoundingClientRect()
                setTooltip({ x: e.clientX - (r?.left || 0), y: e.clientY - (r?.top || 0), node })
              }}
              onMouseMove={e => {
                const r = containerRef.current?.getBoundingClientRect()
                setTooltip(t => t ? { ...t, x: e.clientX - (r?.left || 0), y: e.clientY - (r?.top || 0) } : null)
              }}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={node.x} y={node.y} width={node.w} height={node.h}
                rx={6} ry={6}
                fill={node.color + '22'} stroke={node.color} strokeWidth="1.5"
                style={{ transition: 'all 0.2s ease' }}
              />
              <text
                x={node.x + node.w / 2} y={node.y + node.h / 2 + 1}
                textAnchor="middle" dominantBaseline="central"
                fill="#fff" fontSize="11" fontWeight="600" fontFamily="var(--font-mono)"
              >
                {node.label.length > 20 ? node.label.slice(0, 17) + '...' : node.label}
              </text>
              <title>
                {`Type: ${node.origType}${node.value ? `\nValue: ${node.value}` : ''}\nPosition: (${Math.round(node.x)}, ${Math.round(node.y)})`}
              </title>
            </g>
          ))}
        </svg>
      </div>

      {tooltip && (
        <div style={{
          position: 'absolute',
          left: Math.min(tooltip.x + 12, (containerRef.current?.clientWidth || 300) - 220),
          top: Math.max(tooltip.y - 40, 4),
          background: 'var(--bg-3)', border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius)', padding: '8px 12px',
          fontFamily: 'var(--font-mono)', fontSize: '12px',
          color: 'var(--text)', pointerEvents: 'none', zIndex: 100,
          boxShadow: 'var(--shadow)', maxWidth: '250px',
          animation: 'fadeIn 0.15s ease'
        }}>
          <div style={{ color: tooltip.node.color, fontWeight: 700, marginBottom: '2px' }}>
            {tooltip.node.origType}
          </div>
          {tooltip.node.value && (
            <div style={{ color: 'var(--text-secondary)' }}>
              Value: <span style={{ color: 'var(--cyan)' }}>{tooltip.node.value}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
