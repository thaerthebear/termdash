const { useState, useEffect } = React

// First-run / ongoing setup health. TermDash runs the swarm on the user's OWN
// Claude, so this surfaces whether the `claude` CLI is installed and signed in.
// When everything's good it collapses to a slim green "ready" bar; when something
// is missing it expands into a guided fix. Always live (re-checkable) rather than
// a one-time flag, so a later logout/uninstall is caught too.
window.SetupStatus = function SetupStatus ({ onRunSetup }) {
  const [env,      setEnv]      = useState(null)
  const [checking, setChecking] = useState(true)
  const [copied,   setCopied]   = useState(false)
  const [started,  setStarted]  = useState('') // which one-click action was kicked off

  const actionBtn = {
    background: '#0078d4', color: '#fff', border: 'none', borderRadius: '6px',
    padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '12px',
  }
  function runSetup (label, cmd, note) {
    if (onRunSetup) onRunSetup(label, cmd)
    setStarted(note)
  }

  function check () {
    setChecking(true)
    window.termAPI.checkEnv()
      .then(e => { setEnv(e); setChecking(false) })
      .catch(() => setChecking(false))
  }
  useEffect(() => { check() }, [])

  function copy (text) {
    window.termAPI.writeClipboard(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  if (!env) {
    return <div className="setup-status checking">Checking your Claude setup…</div>
  }

  const ready = env.claudeInstalled && env.claudeLoggedIn

  if (ready) {
    return (
      <div className="setup-status ready">
        <span className="setup-pill ok">✓ Claude ready</span>
        <span className="setup-account">Runs on your Claude — {env.account}</span>
        <button className="setup-recheck" onClick={check} title="Re-check setup">
          {checking ? '…' : '⟳'}
        </button>
      </div>
    )
  }

  return (
    <div className="setup-status needs">
      <div className="setup-row">
        <span className={'setup-pill ' + (env.claudeInstalled ? 'ok' : 'bad')}>
          {env.claudeInstalled ? '✓ Claude CLI installed' : '✗ Claude CLI missing'}
        </span>
        <span className={'setup-pill ' + (env.claudeLoggedIn ? 'ok' : 'bad')}>
          {env.claudeLoggedIn ? ('✓ Signed in — ' + env.account) : '✗ Not signed in'}
        </span>
        <button className="setup-recheck" onClick={check} title="Re-check setup">
          {checking ? 'Checking…' : '⟳ Re-check'}
        </button>
      </div>

      {/* Case 1: no npm → they need Node.js first. One click opens the download. */}
      {!env.claudeInstalled && !env.npmInstalled && (
        <div className="setup-fix">
          <p>First you need <strong>Node.js</strong> (a free one-time install that Claude runs on).</p>
          <button style={actionBtn} onClick={() => window.termAPI.openLauncher({ url: 'https://nodejs.org/en/download' })}>
            ⬇ Get Node.js (free)
          </button>
          <p className="setup-hint">Install it, restart TermDash, then we'll set up Claude for you with one click.</p>
        </div>
      )}

      {/* Case 2: npm present, Claude missing → install it for them in one click. */}
      {!env.claudeInstalled && env.npmInstalled && (
        <div className="setup-fix">
          <p>TermDash runs on your own Claude. Let me install it for you:</p>
          <button style={actionBtn} onClick={() => runSetup('Install Claude', 'npm install -g @anthropic-ai/claude-code', 'Installing Claude in a terminal — watch it finish, then click ⟳ Re-check.')}>
            ⚡ Install Claude for me
          </button>
          {started
            ? <p className="setup-hint" style={{ color: '#dcdcaa' }}>{started}</p>
            : <p className="setup-hint">Opens a terminal and runs the install — just watch it finish, then <strong>Re-check</strong>. <button onClick={() => copy('npm install -g @anthropic-ai/claude-code')} style={{ background:'none', border:'none', color:'#569cd6', cursor:'pointer', textDecoration:'underline', padding:0, fontSize:'11px' }}>{copied ? 'copied!' : 'or copy the command'}</button></p>}
        </div>
      )}

      {/* Case 3: Claude installed but not signed in → sign in for them in one click. */}
      {env.claudeInstalled && !env.claudeLoggedIn && (
        <div className="setup-fix">
          <p>Claude is installed — you just need to sign in once:</p>
          <button style={actionBtn} onClick={() => runSetup('Sign in to Claude', 'claude', 'A terminal opened and started Claude — log in in the browser, then click ⟳ Re-check.')}>
            🔑 Sign in to Claude
          </button>
          {started && <p className="setup-hint" style={{ color: '#dcdcaa' }}>{started}</p>}
        </div>
      )}
    </div>
  )
}
