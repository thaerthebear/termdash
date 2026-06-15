const { useState, useEffect, useRef } = React

const PHASES = [
  { id: 'plan',    label: 'PLAN',    color: '#569cd6', icon: '◈',
    prompt: '/make-plan — analyze this project thoroughly, create a full implementation plan with phases, tasks, and priorities' },
  { id: 'build',   label: 'BUILD',   color: '#4ec9b0', icon: '⚙',
    prompt: '/do — execute the plan, implement all features, write clean production-ready code' },
  { id: 'review',  label: 'REVIEW',  color: '#dcdcaa', icon: '◎',
    prompt: '/code-review high --fix — review all code for bugs, simplification opportunities, and efficiency, then apply fixes' },
  { id: 'secure',  label: 'SECURE',  color: '#f44747', icon: '⛨',
    prompt: '/security-review — audit the full codebase for OWASP top 10, secrets exposure, missing auth, injection risks, insecure dependencies' },
  { id: 'test',    label: 'TEST',    color: '#c586c0', icon: '✔',
    prompt: 'Write comprehensive unit, integration, and E2E tests for all features. Run them. Fix every failure until all tests pass.' },
  { id: 'ship',    label: 'SHIP',    color: '#d4a017', icon: '⬆',
    prompt: 'Prepare this project for production: check env vars, build scripts, CI/CD config, create a pull request, and give a deploy checklist' },
]

const PHASE_IDX = Object.fromEntries(PHASES.map((p, i) => [p.id, i]))

window.CommanderPanel = function CommanderPanel ({ sessions, onSwitchSession }) {
  const [lifecycle,    setLifecycle]    = useState({})
  const [message,     setMessage]      = useState('')
  const [targetId,    setTargetId]     = useState('')
  const [dispatching, setDispatching]  = useState(false)
  const [log,         setLog]          = useState([])
  const textRef = useRef(null)

  const terminals = (sessions || []).filter(s => s.kind === 'terminal')

  useEffect(() => {
    window.termAPI.getLifecycle().then(setLifecycle)
    if (terminals.length > 0 && !targetId) setTargetId(terminals[0].id)
  }, [sessions])

  async function dispatch (msg, sessionId) {
    if (!msg.trim()) return
    const sid = sessionId || targetId
    setDispatching(true)
    const result = await window.termAPI.dispatchCommander({ message: msg, sessionId: sid })
    const sess   = terminals.find(s => s.id === sid)
    setLog(prev => [{
      time: new Date().toLocaleTimeString(),
      msg: msg.length > 60 ? msg.slice(0, 60) + '…' : msg,
      project: sess?.name || sid,
      ok: result.ok
    }, ...prev.slice(0, 19)])
    if (result.ok && onSwitchSession) onSwitchSession(result.sessionId)
    setDispatching(false)
    setMessage('')
  }

  async function handlePhase (session, phase) {
    const ph = PHASES.find(p => p.id === phase)
    if (!ph) return
    const lc = await window.termAPI.setLifecycle(session.id, phase)
    setLifecycle(lc)
    await dispatch(ph.prompt, session.id)
  }

  async function setPhaseOnly (sessionId, phase) {
    const lc = await window.termAPI.setLifecycle(sessionId, phase)
    setLifecycle(lc)
  }

  function currentPhaseIdx (sessionId) {
    const p = lifecycle[sessionId]?.phase
    return p ? (PHASE_IDX[p] ?? -1) : -1
  }

  return (
    <div className="cmd-root">

      {/* ── Dispatch Bar ── */}
      <div className="cmd-dispatch-bar">
        <div className="cmd-dispatch-header">
          <span className="cmd-section-title">⚡ Commander</span>
          <span className="cmd-section-sub">One message → right project → Claude handles it</span>
        </div>
        <div className="cmd-input-row">
          <select
            className="cmd-project-pick"
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
          >
            {terminals.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <textarea
            ref={textRef}
            className="cmd-textarea"
            placeholder="Tell Claude what needs doing… e.g. 'fix the login bug', 'add dark mode', 'write tests for checkout'"
            value={message}
            rows={2}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) dispatch(message) }}
          />
          <button
            className={`cmd-send-btn${dispatching ? ' busy' : ''}`}
            onClick={() => dispatch(message)}
            disabled={dispatching || !message.trim()}
          >
            {dispatching ? '…' : '▶ Send'}
          </button>
        </div>
        <div className="cmd-hint">Ctrl+Enter to send · Claude runs in the selected project terminal</div>
      </div>

      <div className="cmd-body">
        {/* ── Project Lifecycle Grid ── */}
        <div className="cmd-lifecycle-section">
          <div className="cmd-section-label">PROJECT LIFECYCLE</div>
          <div className="cmd-projects-grid">
            {terminals.map(session => {
              const phIdx = currentPhaseIdx(session.id)
              return (
                <div key={session.id} className="cmd-project-card" style={{ '--pc': session.color || '#0078d4' }}>
                  <div className="cmd-project-bar" />
                  <div className="cmd-project-name">{session.name}</div>
                  <div className="cmd-phases">
                    {PHASES.map((ph, i) => {
                      const done    = i < phIdx
                      const current = i === phIdx
                      return (
                        <div
                          key={ph.id}
                          className={`cmd-phase${done ? ' done' : ''}${current ? ' current' : ''}`}
                          style={{ '--ph-color': ph.color }}
                          title={ph.prompt}
                        >
                          <button
                            className="cmd-phase-btn"
                            onClick={() => handlePhase(session, ph.id)}
                            title={`Run ${ph.label} for ${session.name}`}
                          >
                            <span className="cmd-phase-icon">{ph.icon}</span>
                          </button>
                          <span className="cmd-phase-label">{ph.label}</span>
                          {current && <span className="cmd-phase-pulse" />}
                        </div>
                      )
                    })}
                  </div>
                  <div className="cmd-project-actions">
                    <button className="cmd-proj-act" onClick={() => { if (onSwitchSession) onSwitchSession(session.id) }}>Open ↗</button>
                    <button className="cmd-proj-act" onClick={() => dispatch(`/learn-codebase — read and understand this entire project`, session.id)}>Learn</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Dispatch Log ── */}
        {log.length > 0 && (
          <div className="cmd-log-section">
            <div className="cmd-section-label">RECENT DISPATCHES</div>
            <div className="cmd-log">
              {log.map((entry, i) => (
                <div key={i} className={`cmd-log-entry${entry.ok ? '' : ' cmd-log-err'}`}>
                  <span className="cmd-log-time">{entry.time}</span>
                  <span className="cmd-log-project">{entry.project}</span>
                  <span className="cmd-log-msg">{entry.msg}</span>
                  <span className={`cmd-log-status${entry.ok ? ' ok' : ''}`}>{entry.ok ? '✓' : '✗'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
