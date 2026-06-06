import { Code2, Check, X, Minus } from 'lucide-react'
import { TOKEN_COLORS } from '../constants.js'

export default function TokenTable({ tokens, dfaStatus, onTokenClick, selectedIndex }) {
  const handleClick = (index) => {
    onTokenClick?.(tokens[index], index)
  }

  const renderDfaIcon = (status) => {
    if (status === true) return <Check size={14} className="text-green" />
    if (status === false) return <X size={14} className="text-red" />
    return <Minus size={14} className="text-muted" />
  }

  if (!tokens || tokens.length === 0) {
    return (
      <div className="flex-col flex-1 items-center justify-center gap-12 p-20 text-center">
        <Code2 size={48} className="text-muted opacity-50" />
        <div className="flex-col gap-4">
          <span className="text-secondary font-semibold" style={{ fontSize: '16px' }}>No tokens to display</span>
          <span className="text-muted text-sm">Run a lexical analysis to generate tokens</span>
        </div>
      </div>
    )
  }

  return (
    <div className="token-table-container overflow-y-auto">
      <table className="token-table">
        <thead>
          <tr>
            <th className="text-center">#</th>
            <th>Type</th>
            <th>Value</th>
            <th className="text-center">Line</th>
            <th className="text-center">Col</th>
            <th className="text-center">DFA</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token, i) => {
            const isSelected = selectedIndex === i
            const color = TOKEN_COLORS[token.type] || '#abb2bf'
            return (
              <tr
                key={i}
                className={`${isSelected ? 'selected' : ''}`}
                onClick={() => handleClick(i)}
              >
                <td className="token-cell-num">{i}</td>
                <td>
                  <span
                    className="token-type-badge"
                    style={{ backgroundColor: `${color}33`, color }}
                  >
                    {token.type}
                  </span>
                </td>
                <td>
                  <div className="token-value-cell" title={token.value}>
                    <span className="font-mono">{token.value}</span>
                  </div>
                </td>
                <td className="token-cell-num">{token.line}</td>
                <td className="token-cell-num">{token.col}</td>
                <td className="text-center">{renderDfaIcon(dfaStatus?.[i])}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
