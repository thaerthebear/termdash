window.GitSkillsPanel = function GitSkillsPanel () {
  const skills = [
    {
      id: 'money-printer-turbo',
      name: 'MoneyPrinterTurbo',
      repo: 'https://github.com/harry0703/MoneyPrinterTurbo',
      description: 'Automated AI short video generator — provide a keyword, get a finished video with script, Pexels footage, TTS voiceover, subtitles, and background music.',
      tags: ['AI Video', 'Content Creation', 'Automation', 'Python', 'FFmpeg'],
      stars: '80.7k',
      license: 'MIT',
      skillCount: null,
      color: '#d4a017',
      status: 'safe',
      note: null
    },
    {
      id: 'taste-skill',
      name: 'taste-skill',
      repo: 'https://github.com/Leonxlnx/taste-skill',
      description: 'Portable SKILL.md instruction files for Claude Code, Cursor, and Codex. Enforces strong layout, typography, motion, and spacing so AI-generated UIs don\'t look like boilerplate.',
      tags: ['Frontend', 'Design', 'Claude Code', 'Cursor', 'Agent Skills', 'GSAP'],
      stars: '35.6k',
      license: 'MIT',
      skillCount: '12+ skills',
      color: '#7c3aed',
      status: 'safe',
      note: 'Fork — check tasteskill.dev for original upstream'
    },
    {
      id: 'cybersecurity-skills',
      name: 'Anthropic Cybersecurity Skills',
      repo: 'https://github.com/mukul975/Anthropic-Cybersecurity-Skills',
      description: '754 structured cybersecurity skills across 26 domains — threat hunting, malware analysis, cloud security, red teaming, digital forensics, incident response — mapped to MITRE ATT&CK, NIST CSF 2.0, D3FEND, and ATLAS.',
      tags: ['Security', 'Claude Code', 'MITRE ATT&CK', 'NIST', 'Threat Hunting', 'Red Team', 'Forensics'],
      stars: '14.7k',
      license: 'Apache 2.0',
      skillCount: '754 skills · 26 domains',
      color: '#dc2626',
      status: 'active',
      note: 'Active on all projects via global CLAUDE.md'
    }
  ]

  const statusLabel = { safe: 'Pulled', active: 'Active' }
  const statusColor = { safe: '#4ec9b0', active: '#dc2626' }

  function openRepo (url) {
    window.termAPI.openLauncher({ url, path: null })
  }

  return (
    <div className="skills-panel">
      <div className="skills-header">
        <div>
          <span className="skills-title">Git Skills</span>
          <span className="skills-subtitle">Pulled repositories &amp; agent skill packs</span>
        </div>
        <span className="skills-badge">{skills.length} repos</span>
      </div>

      <div className="skills-list">
        {skills.map(s => (
          <div key={s.id} className="skill-card" style={{ '--skill-color': s.color }}>
            <div className="skill-card-accent" />
            <div className="skill-card-body">

              <div className="skill-card-top">
                <div className="skill-card-name-row">
                  <span className="skill-card-name">{s.name}</span>
                  <span
                    className="skill-status-pill"
                    style={{ color: statusColor[s.status], borderColor: statusColor[s.status] }}
                  >
                    {statusLabel[s.status]}
                  </span>
                </div>
                <div className="skill-meta-row">
                  {s.stars    && <span className="skill-meta-chip">★ {s.stars}</span>}
                  {s.license  && <span className="skill-meta-chip">{s.license}</span>}
                  {s.skillCount && <span className="skill-meta-chip skill-meta-highlight">{s.skillCount}</span>}
                </div>
              </div>

              <p className="skill-card-desc">{s.description}</p>

              <div className="skill-tags">
                {s.tags.map(t => <span key={t} className="skill-tag">{t}</span>)}
              </div>

              {s.note && (
                <div className="skill-note">⚠ {s.note}</div>
              )}

              <div className="skill-card-footer">
                <button className="skill-open-btn" onClick={() => openRepo(s.repo)}>
                  ↗ GitHub
                </button>
                <span className="skill-repo-path">
                  {s.repo.replace('https://github.com/', '')}
                </span>
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
