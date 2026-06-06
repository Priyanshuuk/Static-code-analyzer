import { useEffect, useRef, useState, useCallback } from 'react'
import { Bot, Lightbulb, Sparkles, MessageSquare } from 'lucide-react'

const explanationRules = [
  { pattern: /#include/, explanation: '📌 **Preprocessor Directive** — includes the standard I/O library (`<stdio.h>`) for input/output functions like `printf()` and `scanf()`.' },
  { pattern: /int\s+main\s*\(/, explanation: '🚀 **Main Function** — the program entry point. Execution always starts from `main()`. Returns an integer status code (0 = success).' },
  { pattern: /printf\s*\(/, explanation: '🖨️ **Print Function** — formats and outputs text to the standard output (console). Supports format specifiers like `%d`, `%s`, `%f`.' },
  { pattern: /scanf\s*\(/, explanation: '⌨️ **Input Function** — reads formatted input from the standard input (keyboard). Requires memory addresses via `&` operator.' },
  { pattern: /\bif\s*\(/, explanation: '🔀 **Conditional Statement** — executes the code block only if the parenthesized condition evaluates to true (non-zero).' },
  { pattern: /\belse\s/, explanation: '🔀 **Else Branch** — provides an alternative code block that executes when the preceding `if` condition is false.' },
  { pattern: /\bwhile\s*\(/, explanation: '🔄 **While Loop** — repeatedly executes the code block as long as the condition remains true. Check before each iteration.' },
  { pattern: /\bfor\s*\(/, explanation: '🔄 **For Loop** — compact loop with initialization, condition check, and increment in one line. Most common for counted iterations.' },
  { pattern: /\breturn\b/, explanation: '↩️ **Return Statement** — exits the current function and optionally returns a value to the caller. `return 0;` signals successful execution.' },
  { pattern: /\/\//, explanation: '📝 **Single-Line Comment** — completely ignored by the compiler. Used to document code for human readers.' },
  { pattern: /\/\*/, explanation: '📝 **Multi-Line Comment** — ignored by the compiler. Spans multiple lines until `*/`. Great for documentation blocks.' },
  { pattern: /\bint\b/, explanation: '📦 **Integer Declaration** — allocates memory for an integer variable (typically 4 bytes, range -2³¹ to 2³¹-1).' },
  { pattern: /\bfloat\b/, explanation: '📦 **Float Declaration** — allocates memory for a single-precision floating-point variable (typically 4 bytes).' },
  { pattern: /\bdouble\b/, explanation: '📦 **Double Declaration** — allocates memory for a double-precision floating-point variable (typically 8 bytes, more precision than float).' },
  { pattern: /\bchar\b/, explanation: '📦 **Character Declaration** — allocates memory for a single character (typically 1 byte, stores ASCII values).' },
  { pattern: /\bstruct\b/, explanation: '🏗️ **Structure Definition** — defines a composite data type grouping multiple variables of different types under one name.' },
  { pattern: /\btypedef\b/, explanation: '🏷️ **Type Definition** — creates an alias for an existing data type, improving code readability and maintainability.' },
  { pattern: /\b#include/, explanation: '📦 **Include Directive** — tells the preprocessor to insert the contents of a header file. Used for library functions and macros.' },
  { pattern: /\b#define\b/, explanation: '🏷️ **Macro Definition** — defines a preprocessor macro. The identifier is replaced with the replacement text before compilation.' },
  { pattern: /\bswitch\s*\(/, explanation: '🔀 **Switch Statement** — selects one of many code blocks to execute based on the value of an expression. More efficient than chained if-else.' },
]

function getExplanation(line) {
  for (const rule of explanationRules) {
    if (rule.pattern.test(line)) {
      return rule.explanation
    }
  }
  return '💡 **Executable Statement** — performs an operation or computation. This line is executed at runtime and may involve arithmetic, assignments, or function calls.'
}

export default function AIExplanationBot({ lines, currentLine }) {
  const [messages, setMessages] = useState([])
  const [typingText, setTypingText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef(null)
  const typingTimerRef = useRef(null)
  const prevLineRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, typingText, scrollToBottom])

  useEffect(() => {
    if (currentLine != null && currentLine !== prevLineRef.current && lines && lines[currentLine] !== undefined) {
      const lineText = lines[currentLine]
      const explanation = getExplanation(lineText)
      const newMessage = {
        lineNumber: currentLine,
        code: lineText.trim(),
        explanation,
        id: Date.now(),
      }
      setMessages((prev) => [...prev, newMessage])
      setIsTyping(true)
      setTypingText('')
      let charIndex = 0
      const chars = explanation.split('')
      if (typingTimerRef.current) clearInterval(typingTimerRef.current)
      typingTimerRef.current = setInterval(() => {
        if (charIndex < chars.length) {
          setTypingText(chars.slice(0, charIndex + 1).join(''))
          charIndex++
        } else {
          clearInterval(typingTimerRef.current)
          typingTimerRef.current = null
          setIsTyping(false)
          setTypingText('')
        }
      }, 15)
      prevLineRef.current = currentLine
    }
  }, [currentLine, lines])

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current)
    }
  }, [])

  const handleClear = () => {
    setMessages([])
    setTypingText('')
    setIsTyping(false)
    if (typingTimerRef.current) clearInterval(typingTimerRef.current)
  }

  return (
    <div className="ai-bot">
      <div className="ai-bot-header">
        <div className="ai-bot-icon">
          <Bot size={16} />
        </div>
        <span className="ai-bot-title">AI Code Assistant</span>
        <span className="badge badge-accent" style={{ marginLeft: 'auto', fontSize: '9px' }}>
          <Sparkles size={10} />
          Rule Engine
        </span>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="transition"
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>

      <div className="ai-bot-messages" ref={scrollRef}>
        {messages.length === 0 && !isTyping ? (
          <div className="ai-bot-empty">
            <MessageSquare size={32} className="opacity-50" />
            <span>💡 Click any line number in the editor to get an instant explanation of that code line.</span>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const isLatest = i === messages.length - 1
              return (
                <div
                  key={msg.id}
                  className={`ai-bot-message animate-fade-in`}
                >
                  <div className="ai-bot-line-ref">
                    <span className="font-mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>Line {msg.lineNumber}</span>
                    <span className="font-mono text-muted" style={{ fontSize: '11px', marginLeft: '8px' }}>{msg.code}</span>
                  </div>
                  <div className="ai-bot-text">
                    {isLatest && isTyping ? typingText : msg.explanation}
                    {isLatest && isTyping && (
                      <span className="animate-pulse" style={{ display: 'inline-block', width: '6px', height: '14px', background: 'var(--accent)', marginLeft: '2px', verticalAlign: 'middle' }} />
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
