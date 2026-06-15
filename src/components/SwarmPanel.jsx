const { useState, useEffect, useRef } = React

// The roster of specialists the swarm can deploy. Each becomes a named Claude
// Code terminal focused only on its domain.
const SPECIALISTS = [
  { id:'security',    name:'Cyber Security', color:'#f44747', focus:'security vulnerabilities, authentication, secrets exposure, injection, and OWASP Top 10 risks', keywords:['secur','auth','login','password','encrypt','vuln','attack','penetrat','owasp','token','jwt','payment','sensitive','cve','exploit'] },
  { id:'frontend',    name:'Frontend',       color:'#569cd6', focus:'UI components, client-side state, accessibility, responsiveness, and user-facing behavior', keywords:['front','ui','ux','react','vue','svelte','css','html','button','page','component','responsive','layout','mobile'] },
  { id:'backend',     name:'Backend',        color:'#6a9955', focus:'server logic, APIs, business rules, data flow, and error handling', keywords:['back','api','server','endpoint','route','express','fastify','logic','service','controller'] },
  { id:'database',    name:'Database',       color:'#c586c0', focus:'schema design, queries, migrations, indexing, and data integrity', keywords:['data','db','sql','mongo','postgres','mysql','schema','query','migration','table','index','orm','prisma'] },
  { id:'qa',          name:'QA / Testing',   color:'#dcdcaa', focus:'test coverage, edge cases, regressions, and test automation', keywords:['test','qa','bug','coverage','regress','e2e','unit','jest','vitest','cypress','quality'] },
  { id:'devops',      name:'DevOps',         color:'#4ec9b0', focus:'CI/CD, deployment, infrastructure, Docker, and environment configuration', keywords:['deploy','ci','cd','docker','kubernetes','k8s','infra','pipeline','build','aws','gcp','azure','cloud','env','nginx'] },
  { id:'performance', name:'Performance',    color:'#d4a017', focus:'speed, memory usage, bottlenecks, bundle size, and slow queries', keywords:['perf','speed','slow','optim','memory','latency','scale','load','bundle','cache'] },
  { id:'architect',   name:'Architect',      color:'#e0e0e0', focus:'overall structure, design patterns, coupling, maintainability, and tech debt', keywords:['architect','structure','refactor','pattern','maintain','scal','clean','design','tech debt','modular'] },
  { id:'docs',        name:'Docs',           color:'#9e9e9e', focus:'documentation, README, inline comments, API docs, and onboarding clarity', keywords:['doc','readme','comment','guide','onboard','tutorial'] },
]

// The lead coordinator. Always launches first, dictates the plan, and keeps
// every specialist on the same page until the goal is finished.
const LEAD = { id:'codex', name:'Codex (Lead)', color:'#f5b301', focus:'overall coordination — owning the shared plan and keeping the team aligned' }

const BROAD_RE = /\bevery\b|\ball\b|complete|comprehensive|\bfull\b|thorough|check.*(way|field|angle)|audit|production[- ]?ready|every way/i

function suggestRoles (goal) {
  const lc = (goal || '').toLowerCase()
  const matched = new Set()
  for (const s of SPECIALISTS) {
    if (s.keywords.some(k => lc.includes(k))) matched.add(s.id)
  }
  // "check it in every way" / vague goals → deploy a solid default crew
  if (BROAD_RE.test(goal || '') || matched.size < 2) {
    ['security','frontend','backend','qa'].forEach(id => matched.add(id))
  }
  return matched
}

// Per-specialist excellence standard — turns a basic goal into portfolio-grade output.
const CRAFT = {
  security:    'Go beyond finding issues: ship the fixes with tests proving the hole is closed.',
  frontend:    'Make it BEAUTIFUL: coherent design tokens (spacing/type/color), polished hover/focus/loading/empty/error states, smooth micro-animations, fully responsive, accessible. Ship UI you would screenshot for a portfolio — never default-browser-styled.',
  backend:     'Ship clean seams: typed inputs validated at the boundary, consistent error shapes, no silent failures, and a happy-path + failure-path test for every endpoint you touch.',
  database:    'Every schema change gets an index plan and a migration that rolls back; never leave a query that table-scans.',
  qa:          'Do not just report — write the failing test first, then verify the fix turns it green. Cover the edge case nobody listed.',
  devops:      'Everything reproducible: one command to build, one to run, fail-fast env validation, CI green before you call it done.',
  performance: 'Measure before and after — claim no win without numbers.',
  architect:   'Leave every file simpler than you found it; delete dead code you pass.',
  docs:        'Write docs a stranger could follow cold: copy-paste-able commands, no stale paths.',
}

// Shared work discipline — kills idle-looping and token burn, defines DONE.
const DISCIPLINE =
  ' WORK DISCIPLINE: (a) NEVER idle-loop. If you are blocked, re-read PLAN.md at most TWICE; still blocked → log the blocker in SWARM.md and move to your next unblocked task. ' +
  '(b) DONE means: all your checkboxes ticked AND verified by actually running the relevant build/tests. Then write "— DONE" under your SWARM.md heading and STOP. Do not keep polling, do not invent new work. ' +
  '(c) Be token-frugal: short replies, never paste whole files or re-dump PLAN.md into chat, read only what you need, batch small edits into one pass. ' +
  '(d) Exceed the ask where it is cheap: fix obvious adjacent bugs, add the missing error state, leave things better — but never expand scope into another specialist’s lane.'

// Render an instruction pointing agents at attached files (by path — they read them).
function fileRef (files) {
  if (!files || !files.length) return ''
  return ` REFERENCE FILES (read these for full context): ${files.map(f => `"${f}"`).join(', ')}.`
}

// Brief for a specialist — they take orders from the Codex lead via PLAN.md.
function buildPrompt (spec, goal, cwd, files) {
  return (
    `You are the ${spec.name} specialist in a multi-agent swarm working on ONE shared project, coordinated by a lead agent named Codex. ` +
    `PROJECT GOAL: ${goal}.` + fileRef(files) + ` ` +
    `FIRST, read the file PLAN.md in the project root — it is the single source of truth, dictated by Codex (the lead). Find the section assigned to "${spec.name}" and do ONLY the tasks listed there. ` +
    `If PLAN.md has no tasks for you yet, wait a moment and re-read it — Codex is still writing the plan. ` +
    `Your domain is: ${spec.focus}. As you work, RE-READ PLAN.md regularly so you stay on the same plan as everyone else and pick up any updates Codex makes — never drift from the plan. ` +
    `Record your progress and findings in SWARM.md under a heading "## ${spec.name}" (severity, file:line, recommendation), and tick off your tasks in PLAN.md as you finish them. Do NOT edit other specialists' sections. ` +
    `Keep going until every task assigned to you in PLAN.md is complete. ` +
    `QUALITY BAR: ${CRAFT[spec.id] || 'Deliver work you would defend in a code review.'}` +
    DISCIPLINE
  )
}

// Brief for Codex, the lead. It dictates the plan and keeps the team aligned.
function buildLeadPrompt (goal, cwd, teamNames, files) {
  return (
    `You are Codex, the LEAD coordinator of a multi-agent swarm working on ONE shared project. ` +
    `PROJECT GOAL: ${goal}.` + fileRef(files) + ` ` +
    `Your team of specialists (each in their own terminal): ${teamNames.join(', ')}. ` +
    `Your job is to dictate the plan and keep everyone on it until it is finished: ` +
    `(1) Explore the project to understand it. ` +
    `(2) Write a clear, numbered plan to PLAN.md in the project root. Give EACH specialist their own "## <name>" section listing concrete, checkboxed tasks ("- [ ] ...") and a clear definition of done. PLAN.md is the single source of truth and the team's shared memory. ` +
    `(3) Keep PLAN.md authoritative and up to date — the specialists re-read it to know their current task, so whenever priorities change, update PLAN.md so everyone stays on the same plan. ` +
    `(4) Periodically read SWARM.md to see what each specialist has found, reconcile their work, resolve conflicts, and adjust the plan. ` +
    `(5) Drive to completion: keep checking progress and re-tasking until every checkbox in PLAN.md is done and the GOAL is fully met, then write a final "## Summary — DONE" section and STOP — do not restart finished work. ` +
    `TREAT THE GOAL AS THE FLOOR, NOT THE CEILING: when you write PLAN.md, add the polish the user did not think to ask for — for anything user-facing add design-system, empty/error/loading states, and responsiveness tasks; for anything logic-heavy add verification tasks (build passes, tests green) so nothing gets checked off unverified. ` +
    `ANTI-LOOP: if a specialist reports the same blocker twice or is idle-waiting, re-task them immediately with their next unblocked item. If two specialists wait on each other, break the tie yourself in PLAN.md. ` +
    `Be token-frugal: short status notes, never re-dump PLAN.md or whole files into chat.` +
    DISCIPLINE.replace(' WORK DISCIPLINE:', ' Also hold the team to this:') +
    ` Start now by exploring, then write PLAN.md so the team can begin.`
  )
}

window.SwarmPanel = function SwarmPanel ({ onCreateSession, onDeployed }) {
  // Prefilled sample so a first-timer can pick a folder and Deploy in one click.
  // It also auto-suggests the right specialists. Users just edit or clear it.
  const [goal,     setGoal]     = useState('Check this project in every way before launch — security, bugs, performance, and UX.')
  const [folder,   setFolder]   = useState('')
  const [checked,  setChecked]  = useState(new Set())
  const [touched,  setTouched]  = useState(false) // has user manually toggled roles?
  const [lead,     setLead]     = useState(true)  // Codex coordinates the swarm
  const [files,    setFiles]    = useState([])    // attached file paths (passed by path)
  const [deploying,setDeploying]= useState(false)
  const goalRef = useRef(null)

  async function attachFiles () {
    const picked = await window.termAPI.pickFiles()
    if (picked && picked.length) {
      setFiles(prev => Array.from(new Set([...prev, ...picked])))
    }
  }
  function dropFiles (e) {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files || []).map(f => f.path).filter(Boolean)
    if (dropped.length) setFiles(prev => Array.from(new Set([...prev, ...dropped])))
  }
  const baseName = p => p.split(/[\\/]/).pop()

  // Pre-fill last-used folder
  useEffect(() => {
    window.termAPI.lastFolder().then(f => { if (f) setFolder(f) })
    setTimeout(() => goalRef.current?.focus(), 50)
  }, [])

  // Auto-suggest roles from the goal text, until the user manually edits the picks
  useEffect(() => {
    if (touched) return
    setChecked(suggestRoles(goal))
  }, [goal, touched])

  function toggle (id) {
    setTouched(true)
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function pick () {
    const f = await window.termAPI.pickFolder()
    if (f) setFolder(f)
  }

  async function deploy () {
    if (deploying) return
    const chosen = SPECIALISTS.filter(s => checked.has(s.id))
    if (!goal.trim() || !folder || !chosen.length) return
    setDeploying(true)
    try {
      const g = goal.trim()
      const teamNames = chosen.map(s => s.name)
      // Keep the goal stored on each session SMALL — the full goal goes into the
      // prompt only, and large context should be an attached file (passed by path).
      const storedGoal = g.slice(0, 300)
      const items = []

      // Codex (the lead) launches first so it can write PLAN.md before the
      // specialists start reading it.
      if (lead) {
        const ls = await onCreateSession({
          kind: 'terminal', name: LEAD.name, color: LEAD.color,
          cwd: folder, swarm: true, lead: true, goal: storedGoal,
        })
        items.push({ session: ls, prompt: buildLeadPrompt(g, folder, teamNames, files), lead: true })
      }

      for (const spec of chosen) {
        const s = await onCreateSession({
          kind: 'terminal', name: spec.name, color: spec.color,
          cwd: folder, swarm: true, goal: storedGoal,
        })
        items.push({ session: s, prompt: buildPrompt(spec, g, folder, files) })
      }

      await window.termAPI.swarmLaunch({ items, cwd: folder })
      onDeployed(items.map(it => it.session.id))
    } finally {
      setDeploying(false)
    }
  }

  const canDeploy = goal.trim() && folder && checked.size && !deploying
  const folderName = folder ? folder.split(/[\\/]/).pop() : ''

  return (
    <div className="swarm-panel">
      <div className="swarm-head">
        <h2>🐝 Swarm Deploy</h2>
        <p>State a goal, confirm the specialists, and a named Claude team launches on your project. <strong>Codex</strong> leads — it dictates the plan in <code>PLAN.md</code>, keeps everyone on the same page, and drives to the finish. Findings land in <code>SWARM.md</code>.</p>
      </div>

      <label className="swarm-label">1 · What's the goal?</label>
      <textarea
        ref={goalRef}
        className="swarm-goal"
        rows={3}
        placeholder="e.g. Check this app in every way before launch — security, bugs, performance, and UX.  (Tip: drag a file here to attach it instead of pasting long text.)"
        value={goal}
        onChange={e => setGoal(e.target.value)}
        onDrop={dropFiles}
        onDragOver={e => e.preventDefault()}
      />
      <div className="swarm-attach-row">
        <button className="swarm-attach-btn" onClick={attachFiles}>📎 Attach file</button>
        <span className="swarm-attach-hint">
          {files.length
            ? `${files.length} file${files.length > 1 ? 's' : ''} attached — agents will read ${files.length > 1 ? 'them' : 'it'} for context`
            : 'optional — attach a brief, spec, or codebase doc instead of pasting it'}
        </span>
      </div>
      {files.length > 0 && (
        <div className="swarm-files">
          {files.map((p, i) => (
            <span key={i} className="swarm-file-chip" title={p}>
              📄 {baseName(p)}
              <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}>×</button>
            </span>
          ))}
        </div>
      )}

      <label className="swarm-label">2 · Project folder</label>
      <div className="swarm-folder-row">
        <button className="swarm-folder-btn" onClick={pick}>📁 {folder ? 'Change folder' : 'Pick folder'}</button>
        <span className="swarm-folder-path" title={folder}>
          {folder ? folderName : <em>no folder selected</em>}
        </span>
      </div>

      <button
        className={'swarm-lead' + (lead ? ' on' : '')}
        onClick={() => setLead(v => !v)}
        title="Codex coordinates the swarm — writes PLAN.md, assigns tasks, keeps everyone in sync, and drives to completion"
      >
        <span className="swarm-lead-check">{lead ? '✓' : ''}</span>
        <span className="swarm-lead-icon">🧠</span>
        <span className="swarm-lead-text">
          <strong>Codex (Lead)</strong>
          <em>dictates the plan, keeps the team remembering & on the same plan, finishes it</em>
        </span>
      </button>

      <label className="swarm-label">
        3 · Specialists to deploy
        <span className="swarm-auto-hint">{touched ? '' : '(auto-suggested from your goal — tweak as you like)'}</span>
      </label>
      <div className="swarm-roster">
        {SPECIALISTS.map(s => (
          <button
            key={s.id}
            className={'swarm-spec' + (checked.has(s.id) ? ' on' : '')}
            style={{ '--spec-color': s.color }}
            onClick={() => toggle(s.id)}
            title={s.focus}
          >
            <span className="swarm-spec-check">{checked.has(s.id) ? '✓' : ''}</span>
            <span className="swarm-spec-dot" />
            <span className="swarm-spec-name">{s.name}</span>
          </button>
        ))}
      </div>

      <div
        className="swarm-caution"
        style={{
          display: 'flex', gap: '8px', alignItems: 'flex-start',
          margin: '14px 0 6px', padding: '9px 12px',
          background: 'rgba(212,160,23,0.08)', border: '1px solid rgba(212,160,23,0.35)',
          borderRadius: '8px', fontSize: '12px', lineHeight: 1.45, color: '#d4d4d4'
        }}
      >
        <span style={{ fontSize: '14px', lineHeight: 1.2 }}>⚠️</span>
        <span>
          The swarm runs autonomously and <strong>edits files in this folder without asking</strong>.
          Point it at a <strong>git-tracked</strong> project so you can review and undo its work.
        </span>
      </div>

      <div className="swarm-deploy-row">
        <span className="swarm-count">
          {checked.size
            ? `${lead ? 'Codex + ' : ''}${checked.size} specialist${checked.size > 1 ? 's' : ''} ready`
            : 'pick at least one specialist'}
        </span>
        <button className="swarm-deploy-btn" onClick={deploy} disabled={!canDeploy}>
          {deploying ? 'Deploying…' : `🚀 Deploy swarm`}
        </button>
      </div>
    </div>
  )
}
