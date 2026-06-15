const { useState, useEffect, useCallback } = React

window.App = function App () {
  const { sessions, addSession, removeSession } = window.useSessions()
  const [statuses,     setStatuses]     = useState({})
  const [activeId,     setActiveId]     = useState(null)
  const [openIds,      setOpenIds]      = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('td-open') || '[]') } catch (_) { return [] }
  })
  const [sidebarOpen,  setSidebarOpen]  = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [view,         setView]         = useState(() => sessionStorage.getItem('td-view') || 'home')
  const [swarming,     setSwarming]     = useState(false)
  const [aiTool,       setAiTool]       = useState(null) // toolId for AIGoalModal
  const [roadmaps,     setRoadmaps]     = useState({})   // sessionId → {name, path, content}
  const [roadmapHidden,setRoadmapHidden]= useState({})   // sessionId → true if user hid it

  // Listen for PTY status updates
  useEffect(() => {
    const off = window.termAPI.onPtyStatus(({ id, status }) => {
      setStatuses(prev => ({ ...prev, [id]: status }))
    })
    return off
  }, [])

  // Listen for roadmaps auto-detected when a project opens
  useEffect(() => {
    const off = window.termAPI.onRoadmap(({ id, name, path, content }) => {
      setRoadmaps(prev => ({ ...prev, [id]: { name, path, content } }))
      setRoadmapHidden(prev => ({ ...prev, [id]: false }))
    })
    return off
  }, [])

  const terminalSessions = sessions.filter(s => s.kind === 'terminal')
  const launcherSections = buildLauncherSections(sessions.filter(s => s.kind === 'launcher'))
  // Only sessions the user has explicitly opened render in the main area.
  const openSessions = openIds.map(id => terminalSessions.find(s => s.id === id)).filter(Boolean)

  function setViewPersist (v) {
    sessionStorage.setItem('td-view', v)
    setView(v)
  }
  function persistOpen (ids) {
    sessionStorage.setItem('td-open', JSON.stringify(ids))
  }

  // ── Open / close (VS Code-style: projects open on demand, dash is clear otherwise)
  function openSession (id) {
    setOpenIds(prev => {
      const next = prev.includes(id) ? prev : [...prev, id]
      persistOpen(next)
      return next
    })
    setActiveId(id)
    setViewPersist(id)
    // Proactively look for a roadmap so it docks on the side right away
    const sess = sessions.find(s => s.id === id)
    if (sess && sess.kind === 'terminal' && sess.cwd && !roadmaps[id]) {
      window.termAPI.getRoadmap(sess.cwd).then(rm => {
        if (rm) {
          setRoadmaps(prev => ({ ...prev, [id]: rm }))
          setRoadmapHidden(prev => ({ ...prev, [id]: false }))
        }
      })
    }
  }

  function openMany (ids) {
    if (!ids || !ids.length) return
    setOpenIds(prev => {
      const next = [...prev]
      ids.forEach(id => { if (!next.includes(id)) next.push(id) })
      persistOpen(next)
      return next
    })
    setActiveId(ids[0])
    setViewPersist(ids[0])
  }

  function closeTab (id) {
    window.termAPI.stopPty(id)
    // Swarm agents are one-shot work units — closing one removes it entirely so
    // they never pile up in the project list (or bloat the store).
    const sess = terminalSessions.find(s => s.id === id)
    if (sess && sess.swarm) removeSession(id)
    const next = openIds.filter(x => x !== id)
    persistOpen(next)
    setOpenIds(next)
    if (activeId === id || view === id) {
      const fallback = next[next.length - 1]
      if (fallback) { setActiveId(fallback); setViewPersist(fallback) }
      else { setActiveId(null); setViewPersist('home') }
    }
  }

  function deleteProject (id) {
    window.termAPI.stopPty(id)
    removeSession(id)
    const next = openIds.filter(x => x !== id)
    persistOpen(next)
    setOpenIds(next)
    if (activeId === id || view === id) { setActiveId(null); setViewPersist('home') }
  }

  function handleTileClick (session) {
    if (session.kind === 'launcher') {
      window.termAPI.openLauncher({ url: session.url, path: session.path })
      return
    }
    openSession(session.id)
  }

  function handleHome ()        { setActiveId(null); setViewPersist('home') }
  function handleSkills ()      { setActiveId(null); setViewPersist('skills') }
  function handleSkillsPanel () { setActiveId(null); setViewPersist('skills-panel') }
  function handleCommander ()   { setActiveId(null); setViewPersist('commander') }
  function handleSwarmTab ()    { setActiveId(null); setViewPersist('swarm') }

  function handleSwitch (id) { openSession(id) }

  async function handleSwarm () {
    if (swarming) return
    setSwarming(true)
    // Only fire Claude into terminals that are actually open
    await window.termAPI.swarmAll('claude')
    setTimeout(() => setSwarming(false), 2000)
  }

  async function handleAITool (tile) {
    const AI_IDS = ['higgsfield','higgsfield-generate','opus-clip','claude-ai','figma','canva','capcut','anthropic-console','prompt-lib']
    if (AI_IDS.includes(tile.id)) {
      setAiTool(tile.id)
    } else {
      window.termAPI.openLauncher({ url: tile.url, path: tile.path })
    }
  }

  async function handleAIDispatch (toolId, goal) {
    const result = await window.termAPI.startAISession({ toolId, goal })
    if (result.ok) openSession(result.sessionId)
  }

  async function handleAddSession (cfg) {
    return await addSession(cfg)
  }

  // Group the left explorer: Swarm agents, Projects, then plain Terminals
  const explorerGroups = buildExplorerGroups(terminalSessions)

  return (
    <div className="app-root">
      {/* Header */}
      <header className="app-header">
        <span className="app-logo">TermDash</span>
        <span className="app-subtitle">Command Center</span>
        <div style={{ flex: 1 }} />
        <button className="sidebar-toggle" onClick={() => setSidebarOpen(p => !p)}>
          {sidebarOpen ? '◀ Tools' : '▶ Tools'}
        </button>
        <button className="add-btn" onClick={() => setShowModal(true)} title="New session">+</button>
      </header>

      {/* Tab bar — only open terminals appear as tabs */}
      <window.TabBar
        tabs={openIds}
        sessions={sessions}
        activeId={['skills','skills-panel','commander','swarm','home'].includes(view) ? null : activeId}
        skillsActive={view === 'skills'}
        skillsPanelActive={view === 'skills-panel'}
        commanderActive={view === 'commander'}
        swarmTabActive={view === 'swarm'}
        onHome={handleHome}
        onSkills={handleSkills}
        onSkillsPanel={handleSkillsPanel}
        onCommander={handleCommander}
        onSwarmTab={handleSwarmTab}
        onSwitch={handleSwitch}
        onClose={closeTab}
        onNew={() => setShowModal(true)}
        onSwarm={handleSwarm}
        swarming={swarming}
      />

      {/* Main layout: [left explorer] [terminal area] [right tools] */}
      <div className="main-layout">
        {/* Left explorer — projects & terminals, open on click (VS Code style) */}
        <aside className="proj-sidebar">
          <div className="proj-side-head">Explorer</div>
          {explorerGroups.map(({ label, items }) => (
            <div key={label} className="proj-group">
              <div className="proj-group-label">{label}</div>
              {items.map(s => (
                <div
                  key={s.id}
                  className={'proj-row' +
                    (activeId === s.id ? ' active' : '') +
                    (openIds.includes(s.id) ? ' open' : '')}
                  style={{ '--tile-color': s.color || '#0078d4' }}
                  onClick={() => openSession(s.id)}
                  title={s.cwd || s.name}
                >
                  <span className="proj-dot" />
                  <span className="proj-name">{s.name}</span>
                  <span className={'proj-status ' + (statuses[s.id] || 'stopped')} />
                  <button
                    className="proj-remove"
                    title="Remove from list"
                    onClick={e => { e.stopPropagation(); deleteProject(s.id) }}
                  >×</button>
                </div>
              ))}
            </div>
          ))}
          <button className="proj-add" onClick={() => setShowModal(true)}>＋ New session</button>
        </aside>

        <div className="terminal-grid-area">
          {view === 'commander' ? (
            <window.CommanderPanel
              sessions={sessions}
              onSwitchSession={openSession}
            />
          ) : view === 'swarm' ? (
            <window.SwarmPanel
              onCreateSession={handleAddSession}
              onDeployed={openMany}
            />
          ) : view === 'skills-panel' ? (
            <window.SkillsPanel />
          ) : view === 'skills' ? (
            <window.GitSkillsPanel />
          ) : view === 'home' || openSessions.length === 0 ? (
            <Welcome
              projectCount={terminalSessions.length}
              onSwarm={handleSwarmTab}
              onNew={() => setShowModal(true)}
            />
          ) : (
            <div className="terminal-with-roadmap">
              <div className="terminal-grid" style={{ '--cols': Math.min(3, openSessions.length) }}>
                {openSessions.map(session => (
                  <window.TerminalView
                    key={session.id}
                    session={session}
                    isActive={activeId === session.id}
                    status={statuses[session.id] || 'stopped'}
                    onClick={() => setActiveId(session.id)}
                    onClose={() => closeTab(session.id)}
                  />
                ))}
              </div>
              {activeId && roadmaps[activeId] && !roadmapHidden[activeId] && (
                <window.RoadmapPanel
                  roadmap={roadmaps[activeId]}
                  onClose={() => setRoadmapHidden(prev => ({ ...prev, [activeId]: true }))}
                  onRefresh={() => {
                    const s = sessions.find(x => x.id === activeId)
                    if (s && s.cwd) window.termAPI.getRoadmap(s.cwd).then(rm => {
                      if (rm) setRoadmaps(prev => ({ ...prev, [activeId]: rm }))
                    })
                  }}
                />
              )}
              {activeId && roadmaps[activeId] && roadmapHidden[activeId] && (
                <button
                  className="roadmap-reopen"
                  title="Show roadmap"
                  onClick={() => setRoadmapHidden(prev => ({ ...prev, [activeId]: false }))}
                >🗺️</button>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar — launcher tools */}
        {sidebarOpen && (
          <aside className="tools-sidebar">
            {launcherSections.map(({ section, items }) => (
              <div key={section} className="sidebar-section">
                <div className="sidebar-section-label">{section}</div>
                {items.map(tile => (
                  <button
                    key={tile.id}
                    className="sidebar-btn"
                    style={{ '--tile-color': tile.color || '#0078d4' }}
                    onClick={() => handleAITool(tile)}
                    title={tile.url || tile.path || tile.name}
                  >
                    <span className="sidebar-btn-dot" />
                    <span className="sidebar-btn-name">{tile.name}</span>
                  </button>
                ))}
              </div>
            ))}
          </aside>
        )}
      </div>

      {showModal && (
        <window.NewSessionModal
          onClose={() => setShowModal(false)}
          onAdd={handleAddSession}
        />
      )}

      {aiTool && (
        <window.AIGoalModal
          toolId={aiTool}
          onClose={() => setAiTool(null)}
          onDispatch={handleAIDispatch}
        />
      )}
    </div>
  )
}

// Clear landing screen — shown on startup and when nothing is open
function Welcome ({ projectCount, onSwarm, onNew }) {
  return (
    <div className="welcome">
      <window.SetupStatus />
      <div className="welcome-logo">⊞</div>
      <h1>TermDash</h1>
      <p>Your dashboard is clear. Pick a project from the <strong>Explorer</strong> on the left to open it.</p>
      <div className="welcome-actions">
        <button className="welcome-btn primary" onClick={onSwarm}>🐝 Deploy a Swarm</button>
        <button className="welcome-btn" onClick={onNew}>＋ New session</button>
      </div>
      <div className="welcome-foot">{projectCount} project{projectCount === 1 ? '' : 's'} in your Explorer</div>
    </div>
  )
}

function buildExplorerGroups (terminals) {
  const swarm    = terminals.filter(s => s.swarm)
  const projects = terminals.filter(s => !s.swarm && s.type === 'project')
  const others   = terminals.filter(s => !s.swarm && s.type !== 'project')
  const groups = []
  if (swarm.length)    groups.push({ label: 'Swarm', items: swarm })
  if (projects.length) groups.push({ label: 'Projects', items: projects })
  if (others.length)   groups.push({ label: 'Terminals', items: others })
  return groups
}

function buildLauncherSections (launchers) {
  const map = new Map()
  for (const t of launchers) {
    const sec = t.section || 'Tools'
    if (!map.has(sec)) map.set(sec, [])
    map.get(sec).push(t)
  }
  return Array.from(map, ([section, items]) => ({ section, items }))
}
