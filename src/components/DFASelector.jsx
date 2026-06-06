import { DFA_TYPES } from '../constants.js'

export default function DFASelector({ selected, onSelect }) {
  return (
    <div className="dfa-selector">
      <div className="flex-row items-center gap-8 mb-8">
        <span className="text-secondary font-semibold text-sm">Select DFA Type</span>
      </div>
      <div className="flex-col gap-8">
        {DFA_TYPES.map((dfa) => {
          const isSelected = selected === dfa.id
          const isRecommended = dfa.id === 'identifier'
          return (
            <div
              key={dfa.id}
              className={`dfa-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(dfa.id)}
            >
              <div className="flex-row items-start gap-8">
                <div
                  className="flex-shrink-0"
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--text-muted)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '2px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isSelected && (
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: 'var(--accent)',
                      }}
                    />
                  )}
                </div>
                <div className="flex-col flex-1" style={{ minWidth: 0 }}>
                  <div className="flex-row items-center gap-8">
                    <span className="dfa-card-label">{dfa.label}</span>
                    {isRecommended && (
                      <span className="badge badge-accent">★ Recommended</span>
                    )}
                  </div>
                  <div className="dfa-card-pattern">{dfa.pattern}</div>
                  <div className="dfa-card-example">{dfa.example}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
