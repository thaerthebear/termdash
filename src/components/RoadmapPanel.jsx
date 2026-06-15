// Docked side panel that shows a project's roadmap as a live progress dashboard:
// overall completion bar, per-section progress, styled checklists. Lightweight
// markdown parsing — no external deps.

// Parse the markdown into sections, tracking checkbox counts as we go.
function parseRoadmap (md) {
  const lines = (md || '').split('\n')
  const sections = []
  let cur = { title: null, level: 0, blocks: [], done: 0, total: 0 }
  const push = () => { if (cur.title !== null || cur.blocks.length) sections.push(cur) }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+$/, '')
    let m
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      push()
      cur = { title: m[2], level: m[1].length, blocks: [], done: 0, total: 0 }
    } else if ((m = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/))) {
      const done = m[1].toLowerCase() === 'x'
      cur.blocks.push({ kind: 'task', done, text: m[2], key: i })
      cur.total++; if (done) cur.done++
    } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      cur.blocks.push({ kind: 'li', text: m[1], key: i })
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      cur.blocks.push({ kind: 'quote', text: m[1], key: i })
    } else if (line.match(/^#{4,6}\s+/)) {
      cur.blocks.push({ kind: 'subhead', text: line.replace(/^#+\s+/, ''), key: i })
    } else if (line.trim() && !line.match(/^[-=]{3,}$/) && !line.match(/^\|/)) {
      cur.blocks.push({ kind: 'p', text: line, key: i })
    }
  }
  push()
  return sections
}

// **bold** and `code` inline rendering
function inline (text) {
  const parts = []
  let rest = text
  let k = 0
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/
  let m
  while ((m = re.exec(rest))) {
    if (m.index > 0) parts.push(rest.slice(0, m.index))
    if (m[2] != null) parts.push(React.createElement('strong', { key: 'b' + (k++) }, m[2]))
    else parts.push(React.createElement('code', { key: 'c' + (k++) }, m[3]))
    rest = rest.slice(m.index + m[0].length)
  }
  if (rest) parts.push(rest)
  return parts
}

function ProgressBar ({ done, total, big }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className={'rmp-bar' + (big ? ' big' : '')} title={`${done}/${total} done`}>
      <div className={'rmp-fill' + (pct === 100 ? ' complete' : '')} style={{ width: pct + '%' }} />
      <span className="rmp-pct">{pct}%</span>
    </div>
  )
}

window.RoadmapPanel = function RoadmapPanel ({ roadmap, onClose, onRefresh }) {
  if (!roadmap) return null
  const sections = parseRoadmap(roadmap.content)
  const allDone  = sections.reduce((a, s) => a + s.done, 0)
  const allTotal = sections.reduce((a, s) => a + s.total, 0)

  return (
    <div className="roadmap-panel">
      <div className="roadmap-bar">
        <span className="roadmap-icon">🗺️</span>
        <span className="roadmap-title" title={roadmap.path}>{roadmap.name}</span>
        <div style={{ flex: 1 }} />
        {onRefresh && <button className="roadmap-btn" title="Reload from disk" onClick={onRefresh}>⟳</button>}
        <button className="roadmap-btn" title="Hide" onClick={onClose}>×</button>
      </div>

      {allTotal > 0 && (
        <div className="rmp-overall">
          <span className="rmp-overall-label">{allDone}/{allTotal} tasks</span>
          <ProgressBar done={allDone} total={allTotal} big />
        </div>
      )}

      <div className="roadmap-body">
        {sections.map((s, si) => (
          <div key={si} className={'rmp-section lvl' + s.level + (s.total > 0 && s.done === s.total ? ' all-done' : '')}>
            {s.title != null && (
              <div className="rmp-section-head">
                <span className="rmp-section-title">{inline(s.title)}</span>
                {s.total > 0 && (
                  s.done === s.total
                    ? <span className="rmp-section-check">✓ done</span>
                    : <span className="rmp-section-count">{s.done}/{s.total}</span>
                )}
              </div>
            )}
            {s.total > 1 && s.done !== s.total && <ProgressBar done={s.done} total={s.total} />}
            {s.blocks.map(b => {
              if (b.kind === 'task') {
                return (
                  <div key={b.key} className={'rm-task' + (b.done ? ' done' : '')}>
                    <span className={'rm-box' + (b.done ? ' on' : '')}>{b.done ? '✓' : ''}</span>
                    <span className="rm-task-text">{inline(b.text)}</span>
                  </div>
                )
              }
              if (b.kind === 'li')      return <div key={b.key} className="rm-li">• {inline(b.text)}</div>
              if (b.kind === 'quote')   return <div key={b.key} className="rm-quote">{inline(b.text)}</div>
              if (b.kind === 'subhead') return <div key={b.key} className="rm-subhead">{inline(b.text)}</div>
              return <p key={b.key} className="rm-p">{inline(b.text)}</p>
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
