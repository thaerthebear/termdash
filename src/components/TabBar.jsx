window.TabBar = function TabBar ({ tabs, sessions, activeId, onHome, onSwitch, onClose, onNew, onSkills, skillsActive, onSwarm, swarming, onCommander, commanderActive, onSkillsPanel, skillsPanelActive, onSwarmTab, swarmTabActive }) {
  function findSession (id) {
    return sessions.find(s => s.id === id) || {}
  }

  return (
    <div className="tab-bar">
      <button className="tab-home" onClick={onHome} title="Home">⊞ TermDash</button>
      <button
        className={`tab-skills${commanderActive ? ' active' : ''}`}
        style={commanderActive ? { color: '#d4a017', borderBottom: '2px solid #d4a017' } : {}}
        onClick={onCommander}
        title="Commander — autonomous AI dispatch"
      >
        ⚡ Commander
      </button>
      <button
        className={`tab-skills${swarmTabActive ? ' active' : ''}`}
        style={swarmTabActive ? { color: '#f5b301', borderBottom: '2px solid #f5b301' } : {}}
        onClick={onSwarmTab}
        title="Swarm — deploy a team of specialist Claude agents on a goal"
      >
        🐝 Swarm
      </button>
      <button
        className={`tab-skills${skillsPanelActive ? ' active' : ''}`}
        style={skillsPanelActive ? { color: '#c586c0', borderBottom: '2px solid #c586c0' } : {}}
        onClick={onSkillsPanel}
        title="Skills & Plugins"
      >
        ⊙ Skills
      </button>
      <button
        className={`tab-skills${skillsActive ? ' active' : ''}`}
        onClick={onSkills}
        title="Git Skill Repos"
      >
        ⬡ Git Repos
      </button>
      <button
        className={`tab-swarm${swarming ? ' swarming' : ''}`}
        onClick={onSwarm}
        title="Run Claude in all terminals"
      >
        {swarming ? '▶ Running Claude…' : '▶ Run Claude'}
      </button>

      {tabs.map(id => {
        const s = findSession(id)
        return (
          <div
            key={id}
            className={`tab${activeId === id ? ' active' : ''}`}
            style={{ '--tile-color': s.color || '#0078d4' }}
            onClick={() => onSwitch(id)}
          >
            <span className="tab-dot" />
            <span className="tab-name">{s.name || id}</span>
            <button
              className="tab-close"
              onClick={e => { e.stopPropagation(); onClose(id) }}
              title="Close"
            >×</button>
          </div>
        )
      })}

      <button className="tab-new" onClick={onNew} title="New terminal">＋</button>
    </div>
  )
}
