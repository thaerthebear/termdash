const ICONS = {
  ps:        'ᴾˢ',
  claude:    '⬡',
  project:   '📁',
  folder:    '📂',
  design:    '🎨',
  video:     '🎬',
  higgsfield:'✦',
  inject:    '⚡',
  custom:    '⚙',
}

function getStatusClass (status) {
  if (status === 'active') return 'active'
  if (status === 'idle')   return 'idle'
  return 'stopped'
}

window.SessionTile = function SessionTile ({ tile, preview, status, onClick }) {
  const isLauncher = tile.kind === 'launcher'
  const subtitle = isLauncher
    ? (tile.url ? tile.url.replace(/^https?:\/\//, '') : (tile.path || ''))
    : (tile.cwd || '')

  return (
    <div
      className="tile"
      style={{ '--tile-color': tile.color }}
      onClick={onClick}
      title={tile.name}
    >
      <div className="tile-bar" />
      <div className="tile-body">
        <div className="tile-header">
          <span className="tile-icon">{ICONS[tile.icon] || '▪'}</span>
          <span className="tile-name">{tile.name}</span>
          <span className="tile-badge">{isLauncher ? '↗' : '>_'}</span>
        </div>
        <div className="tile-dir">{subtitle}</div>
        {isLauncher ? null : (
          <>
            <div className="tile-preview">{preview || '—'}</div>
            <div className="tile-status">
              <span className={`status-dot ${getStatusClass(status)}`} />
              <span className="status-label">{status || 'stopped'}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
