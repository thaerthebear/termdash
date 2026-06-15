const { useEffect, useRef } = React

const THEME = {
  background:  '#1e1e1e',
  foreground:  '#cccccc',
  cursor:      '#aeafad',
  black:       '#1e1e1e', red:         '#f44747',
  green:       '#6a9955', yellow:      '#dcdcaa',
  blue:        '#569cd6', magenta:     '#c586c0',
  cyan:        '#4ec9b0', white:       '#d4d4d4',
  brightBlack: '#808080', brightWhite: '#ffffff',
}

window.TerminalView = function TerminalView ({ session, isActive, status, onClick, onClose }) {
  const wrapRef    = useRef(null)
  const termRef    = useRef(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!wrapRef.current) return

    const XTerm    = window.Terminal
    const FitAddon = window.FitAddon?.FitAddon || window.FitAddon

    const term = new XTerm({
      cursorBlink:      true,
      fontSize:         12,
      fontFamily:       'Consolas, "Courier New", monospace',
      theme:            THEME,
      allowProposedApi: true,
      scrollback:       2000,
      copyOnSelect:     true,
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(wrapRef.current)
    termRef.current = term

    let fitTimer = null
    const doFit = () => {
      clearTimeout(fitTimer)
      fitTimer = setTimeout(() => {
        try {
          fitAddon.fit()
          window.termAPI.resizePty(session.id, term.cols, term.rows)
        } catch (_) {}
      }, 50)
    }
    setTimeout(doFit, 80)

    const ro = new ResizeObserver(doFit)
    ro.observe(wrapRef.current)

    // Ctrl+C copies if text selected, otherwise sends interrupt
    term.attachCustomKeyEventHandler(e => {
      if (e.ctrlKey && e.key === 'c' && e.type === 'keydown') {
        const sel = term.getSelection()
        if (sel) {
          window.termAPI.writeClipboard(sel)
          term.clearSelection()
          return false // swallow — don't send ^C to shell
        }
      }
      // Ctrl+V paste from clipboard
      if (e.ctrlKey && e.key === 'v' && e.type === 'keydown') {
        const text = window.termAPI.readClipboard()
        if (text) window.termAPI.writePty(session.id, text)
        return false
      }
      return true
    })

    term.onData(data => window.termAPI.writePty(session.id, data))

    // Subscribe with individual unsubscribe capability
    const offOutput = window.termAPI.onPtyOutput(({ id, data }) => {
      if (id === session.id) term.write(data)
    })

    if (!startedRef.current) {
      startedRef.current = true
      // Surface a failed spawn (bad shell path, missing exe) instead of leaving
      // a silent blank terminal — the user gets a clear, recoverable message.
      Promise.resolve(window.termAPI.startPty(session)).then(res => {
        if (res && res.ok === false) {
          term.write(`\r\n\x1b[31m✗ Could not start this terminal.\x1b[0m ${res.error || ''}\r\n`)
          term.write(`\x1b[90m  Check the shell/folder exists, then close and reopen this tile.\x1b[0m\r\n`)
        }
      }).catch(() => {})
    }

    return () => {
      ro.disconnect()
      offOutput()
      term.dispose()
    }
  }, [session.id])

  useEffect(() => {
    if (isActive && termRef.current) {
      termRef.current.focus()
    }
  }, [isActive])

  const color = session.color || '#0078d4'

  return (
    <div
      className={'term-tile' + (isActive ? ' active' : '')}
      style={{ '--tile-color': color }}
      onClick={onClick}
    >
      <div className="term-tile-bar" />
      <div className="term-tile-header">
        <span className="term-tile-icon">{'>_'}</span>
        <span className="term-tile-name">{session.name}</span>
        <span className={'term-status-dot ' + (status || 'stopped')} />
        <button
          className="term-tile-close"
          onClick={e => { e.stopPropagation(); onClose() }}
          title="Close"
        >×</button>
      </div>
      <div
        className="term-tile-body"
        ref={wrapRef}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault()
          const files = Array.from(e.dataTransfer.files)
          if (files.length) {
            const paths = files.map(f => `"${f.path}"`).join(' ')
            window.termAPI.writePty(session.id, paths)
          }
        }}
      />
    </div>
  )
}
