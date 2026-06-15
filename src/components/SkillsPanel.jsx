const { useState, useEffect } = React

const KIND_COLOR  = { skill: '#569cd6', plugin: '#c586c0', 'built-in': '#4ec9b0' }
const KIND_LABEL  = { skill: 'SKILL', plugin: 'PLUGIN', 'built-in': 'BUILT-IN' }

window.SkillsPanel = function SkillsPanel () {
  const [skills,  setSkills]  = useState([])
  const [filter,  setFilter]  = useState('')
  const [kindTab, setKindTab] = useState('all')

  useEffect(() => {
    window.termAPI.listSkills().then(setSkills)
  }, [])

  const kinds    = ['all', 'skill', 'plugin', 'built-in']
  const q        = filter.toLowerCase()
  const visible  = skills.filter(s => {
    const matchKind = kindTab === 'all' || s.kind === kindTab
    const matchQ    = !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) ||
                      s.tags.some(t => t.toLowerCase().includes(q))
    return matchKind && matchQ
  })
  const active   = visible.filter(s => s.active).length

  return (
    <div className="sp-root">
      <div className="sp-header">
        <div>
          <span className="sp-title">Skills & Plugins</span>
          <span className="sp-subtitle">{skills.length} installed · <span style={{ color: '#4ec9b0' }}>{skills.filter(s => s.active).length} active</span></span>
        </div>
        <input
          className="sp-search"
          placeholder="Search skills…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      <div className="sp-kind-tabs">
        {kinds.map(k => (
          <button
            key={k}
            className={`sp-kind-btn${kindTab === k ? ' active' : ''}`}
            style={kindTab === k && k !== 'all' ? { color: KIND_COLOR[k], borderColor: KIND_COLOR[k] } : {}}
            onClick={() => setKindTab(k)}
          >
            {k === 'all' ? `All (${skills.length})` : `${KIND_LABEL[k]} (${skills.filter(s => s.kind === k).length})`}
          </button>
        ))}
      </div>

      <div className="sp-grid">
        {visible.map(s => (
          <div key={s.name} className={`sp-card${s.active ? ' sp-active' : ''}`} style={{ '--kc': KIND_COLOR[s.kind] || '#555' }}>
            <div className="sp-card-bar" />
            <div className="sp-card-body">
              <div className="sp-card-top">
                <div className="sp-name-row">
                  <span className="sp-name">{s.name}</span>
                  {s.active && <span className="sp-active-dot" title="Active" />}
                </div>
                <div className="sp-meta-row">
                  <span className="sp-kind-pill" style={{ color: KIND_COLOR[s.kind], borderColor: KIND_COLOR[s.kind] }}>
                    {KIND_LABEL[s.kind] || s.kind}
                  </span>
                  {s.version && s.version !== 'built-in' && <span className="sp-version">v{s.version}</span>}
                </div>
              </div>
              <p className="sp-desc">{s.description || <em style={{ opacity: 0.4 }}>No description</em>}</p>
              {s.tags.length > 0 && (
                <div className="sp-tags">
                  {s.tags.slice(0, 5).map(t => <span key={t} className="sp-tag">{t}</span>)}
                </div>
              )}
              <div className="sp-source">{s.source}</div>
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <div style={{ color: 'var(--text-dim)', padding: '40px', gridColumn: '1/-1', textAlign: 'center' }}>
            No skills match "{filter}"
          </div>
        )}
      </div>
    </div>
  )
}
