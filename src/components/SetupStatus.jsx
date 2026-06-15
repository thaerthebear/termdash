const { useState, useEffect } = React

// First-run / ongoing setup health. TermDash runs the swarm on the user's OWN
// Claude, so this surfaces whether the `claude` CLI is installed and signed in.
// When everything's good it collapses to a slim green "ready" bar; when something
// is missing it expands into a guided fix. Always live (re-checkable) rather than
// a one-time flag, so a later logout/uninstall is caught too.
window.SetupStatus = function SetupStatus () {
  const [env,      setEnv]      = useState(null)
  const [checking, setChecking] = useState(true)
  const [copied,   setCopied]   = useState(false)

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

      {!env.claudeInstalled && (
        <div className="setup-fix">
          <p>TermDash runs your swarm on your own Claude. Install the Claude CLI once:</p>
          <div className="setup-cmd">
            <code>npm install -g @anthropic-ai/claude-code</code>
            <button onClick={() => copy('npm install -g @anthropic-ai/claude-code')}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="setup-hint">Then click <strong>Re-check</strong>. (Needs Node.js — grab it free at nodejs.org if the command isn't found.)</p>
        </div>
      )}

      {env.claudeInstalled && !env.claudeLoggedIn && (
        <div className="setup-fix">
          <p>Claude is installed but not signed in yet. Open any terminal, run <code>claude</code> once, log in with your Claude account, then <strong>Re-check</strong>.</p>
        </div>
      )}
    </div>
  )
}
