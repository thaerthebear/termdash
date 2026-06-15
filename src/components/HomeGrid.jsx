const { useState, useEffect, useRef } = React

window.HomeGrid = function HomeGrid ({ sessions, statuses, onTileClick, onAddClick }) {
  const [previews, setPreviews] = useState({})
  const intervalRef = useRef(null)

  useEffect(() => {
    const terminalIds = sessions.filter(s => s.kind === 'terminal').map(s => s.id)

    async function poll () {
      const updates = {}
      await Promise.all(
        terminalIds.map(async id => {
          try {
            updates[id] = await window.termAPI.getPreview(id)
          } catch (_) {}
        })
      )
      setPreviews(prev => ({ ...prev, ...updates }))
    }

    poll()
    intervalRef.current = setInterval(poll, 2000)
    return () => clearInterval(intervalRef.current)
  }, [sessions])

  // Group tiles by section
  const sections = []
  const seen = new Set()
  sessions.forEach(s => {
    if (!seen.has(s.section)) { seen.add(s.section); sections.push(s.section) }
  })

  return (
    <div className="home-wrap">
      {sections.map(sec => (
        <div key={sec}>
          <div className="section-label">{sec}</div>
          <div className="tile-grid">
            {sessions.filter(s => s.section === sec).map(tile => (
              <window.SessionTile
                key={tile.id}
                tile={tile}
                preview={previews[tile.id] || ''}
                status={statuses[tile.id] || 'stopped'}
                onClick={() => onTileClick(tile)}
              />
            ))}
            {sec === 'Terminals' && (
              <button className="tile-add" onClick={onAddClick}>
                <span className="tile-add-icon">＋</span>
                <span>New Session</span>
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
