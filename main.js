'use strict'

const fs = require('fs')

// Ensure Windows system paths and user tool paths are reachable from Electron's process
if (process.platform === 'win32') {
  const userHome  = require('os').homedir()
  const appData   = process.env.APPDATA   || `${userHome}\\AppData\\Roaming`
  const localData = process.env.LOCALAPPDATA || `${userHome}\\AppData\\Local`
  const sysPaths = [
    'C:\\Windows\\System32',
    'C:\\Windows',
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0',
    `${appData}\\npm`,                              // npm global bin (claude, etc.)
    `${localData}\\Programs\\nodejs`,               // standalone node install
    `${localData}\\nvm\\nodejs`,                    // nvm installs
  ]
  const cur = process.env.PATH || ''
  const missing = sysPaths.filter(p => !cur.toLowerCase().includes(p.toLowerCase()))
  if (missing.length) {
    process.env.PATH = missing.join(';') + (cur ? ';' + cur : '')
  }
}

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const crypto = require('crypto')
const os = require('os')

let Store, nodePty
try {
  Store = require('electron-store')
} catch (e) {
  console.error('electron-store not found, run npm install')
  process.exit(1)
}
try {
  nodePty = require('node-pty')
} catch (e) {
  console.error('node-pty not found or not rebuilt:', e.message)
  process.exit(1)
}

const store = new Store()
let mainWindow = null

// sessionId → { pty, outputBuffer: string[] }
const ptyProcesses = new Map()

// ── Reliability guards ──────────────────────────────────────────────────────
// A community runs this on every kind of Windows box, so a stray throw must
// never take the whole app down silently.
//  - uncaughtException: log and keep running instead of the default hard exit.
//  - child-process-gone: node-pty forks a helper (conpty_console_list_agent)
//    that can throw "AttachConsole failed"; that child dying is non-fatal — log it.
process.on('uncaughtException', (err) => {
  console.error('[termdash] uncaughtException (kept alive):', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[termdash] unhandledRejection (kept alive):', reason)
})
app.on('child-process-gone', (_e, details) => {
  console.error('[termdash] child-process-gone:', details.type, details.reason)
})
app.on('render-process-gone', (_e, _wc, details) => {
  console.error('[termdash] render-process-gone:', details.reason)
})

// ── Single-instance lock ────────────────────────────────────────────────────
// Every `claude` startup and electron-store write touches shared files. Two
// instances racing them corrupts the store (the real cause of the early
// exit-code-4 crash). If a second copy launches, focus the existing window.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

function createWindow () {
  const bounds = store.get('windowBounds', { width: 1400, height: 900 })
  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1e1e1e',
    title: 'TermDash',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'))

  mainWindow.on('close', () => {
    const b = mainWindow.getBounds()
    store.set('windowBounds', b)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    // Kill all PTYs on window close
    for (const [, { pty }] of ptyProcesses) {
      try { pty.kill() } catch (_) {}
    }
    ptyProcesses.clear()
  })
}

app.whenReady().then(() => {
  if (!store.has('sessions')) {
    store.set('sessions', require('./sessions.default.js'))
  }
  createWindow()
  app.on('activate', () => { if (!mainWindow) createWindow() })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Ctrl+R / Cmd+R reloads renderer without killing PTYs
app.whenReady().then(() => {
  const { globalShortcut } = require('electron')
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    if (mainWindow) mainWindow.webContents.reload()
  })
})

// IPC reload — lets renderer trigger a hot reload without restarting Electron
ipcMain.handle('app:reload', () => {
  if (mainWindow) mainWindow.webContents.reload()
})

// ── Session CRUD ─────────────────────────────────────────────────────────────

ipcMain.handle('session:list', () => store.get('sessions', []))

ipcMain.handle('session:create', (_, cfg) => {
  const session = { ...cfg, id: crypto.randomUUID() }
  const sessions = store.get('sessions', [])
  sessions.push(session)
  store.set('sessions', sessions)
  return session
})

ipcMain.handle('session:update', (_, id, patch) => {
  const sessions = store.get('sessions', [])
  const idx = sessions.findIndex(s => s.id === id)
  if (idx !== -1) sessions[idx] = { ...sessions[idx], ...patch }
  store.set('sessions', sessions)
  return sessions[idx] || null
})

ipcMain.handle('session:delete', (_, id) => {
  killPty(id)
  const sessions = store.get('sessions', []).filter(s => s.id !== id)
  store.set('sessions', sessions)
})

// ── PTY Management ────────────────────────────────────────────────────────────

function killPty (id) {
  const entry = ptyProcesses.get(id)
  if (entry) {
    try { entry.pty.kill() } catch (_) {}
    ptyProcesses.delete(id)
    if (mainWindow) {
      mainWindow.webContents.send('pty-status', { id, status: 'stopped' })
    }
  }
}

ipcMain.handle('pty:start', (_, session) => {
  if (ptyProcesses.has(session.id)) return { ok: true }

  const shell = session.shell || (process.platform === 'win32'
    ? 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
    : 'bash')
  const args  = session.args  || []
  const cwd   = session.cwd   || os.homedir()

  // Ensure Windows system dirs are in PATH so shells can find their own utilities
  const npmBin = path.join(process.env.APPDATA || (os.homedir() + '\\AppData\\Roaming'), 'npm')
  const sysPath = `C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\Wbem;C:\\Windows\\System32\\WindowsPowerShell\\v1.0;${npmBin}`
  const envPath = process.env.PATH ? `${sysPath};${process.env.PATH}` : sysPath
  const env   = { ...process.env, PATH: envPath, TERM: 'xterm-256color' }

  let pty
  try {
    pty = nodePty.spawn(shell, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env
    })
  } catch (err) {
    console.error('Failed to spawn PTY:', err)
    return { ok: false, error: err.message }
  }

  const outputBuffer = []

  pty.onData(data => {
    outputBuffer.push(data)
    if (outputBuffer.length > 500) outputBuffer.shift()
    // Auto-accept Claude Code folder trust prompt
    if (/trust.*folder|Do you trust|1[\.\)]\s*(Yes|Proceed|Trust)/i.test(data)) {
      setTimeout(() => { try { pty.write('1\r') } catch (_) {} }, 120)
    }
    if (mainWindow) {
      mainWindow.webContents.send('pty-output', { id: session.id, data })
    }
  })

  pty.onExit(({ exitCode }) => {
    ptyProcesses.delete(session.id)
    if (mainWindow) {
      mainWindow.webContents.send('pty-status', { id: session.id, status: 'stopped' })
    }
  })

  ptyProcesses.set(session.id, { pty, outputBuffer })
  if (mainWindow) {
    mainWindow.webContents.send('pty-status', { id: session.id, status: 'active' })
  }

  // Opening a project auto-deploys Claude Code in bypass mode, right in its
  // folder. Plain terminals (PowerShell etc.) are left alone.
  const wantsClaude = session.autoClaude === true ||
    (session.autoClaude !== false && session.type === 'project')
  if (wantsClaude) {
    const rm = findRoadmap(cwd)
    setTimeout(() => {
      try { pty.write('claude --dangerously-skip-permissions\r') } catch (_) {}
    }, 700)
    if (rm) {
      // Dock the roadmap on the side for the user to see
      if (mainWindow) mainWindow.webContents.send('roadmap-found', { id: session.id, name: rm.name, path: rm.path, content: rm.content })
      // Once Claude has booted, tell it to treat the roadmap as the source of
      // truth and keep it in sync — so Claude's memory and the roadmap match.
      setTimeout(() => {
        try {
          pty.write(`Our roadmap is "${rm.name}". Read it now and treat it as the single source of truth for this project. Keep it in sync as we work — update it whenever we complete or change items. Begin by telling me where we are on the roadmap and what's next.\r`)
        } catch (_) {}
      }, 5500)
    }
  }

  return { ok: true }
})

// ── Roadmap discovery ──────────────────────────────────────────────────────────
// Look for a roadmap-style file in a project so it can be docked on the side and
// kept in sync with Claude.
function findRoadmap (cwd) {
  if (!cwd) return null
  const MAX = 120000
  const clip = c => (c.length > MAX ? c.slice(0, MAX) + '\n\n…(truncated)' : c)
  const names = ['ROADMAP.md','Roadmap.md','roadmap.md','ROADMAP.txt','roadmap.txt','Roadmap.txt']
  const dirs  = ['', 'docs', '.github', 'doc']
  for (const d of dirs) {
    for (const n of names) {
      const p = path.join(cwd, d, n)
      try {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          return { path: p, name: path.relative(cwd, p).replace(/\\/g, '/'), content: clip(fs.readFileSync(p, 'utf8')) }
        }
      } catch (_) {}
    }
  }
  // Fallback: any top-level file whose name starts with "roadmap"
  try {
    const m = fs.readdirSync(cwd).find(f => /^road[ _-]?map.*\.(md|markdown|txt)$/i.test(f))
    if (m) {
      const p = path.join(cwd, m)
      return { path: p, name: m, content: clip(fs.readFileSync(p, 'utf8')) }
    }
  } catch (_) {}
  return null
}

// On-demand roadmap fetch (used when opening a project from the Explorer)
ipcMain.handle('project:roadmap', (_, cwd) => findRoadmap(cwd))

ipcMain.handle('pty:stop', (_, id) => {
  killPty(id)
})

ipcMain.handle('pty:write', (_, id, data) => {
  const entry = ptyProcesses.get(id)
  if (entry) {
    try { entry.pty.write(data) } catch (_) {}
  }
})

ipcMain.handle('pty:resize', (_, id, cols, rows) => {
  const entry = ptyProcesses.get(id)
  if (entry) {
    try { entry.pty.resize(cols, rows) } catch (_) {}
  }
})

ipcMain.handle('pty:preview', (_, id) => {
  const entry = ptyProcesses.get(id)
  if (!entry) return null
  // Return last few chunks as a plain-text preview (strip ANSI codes)
  const raw = entry.outputBuffer.slice(-10).join('')
  const clean = raw.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').trim()
  const lines = clean.split('\n').filter(l => l.trim()).slice(-2)
  return lines.join(' | ')
})

// ── Skills ───────────────────────────────────────────────────────────────────

ipcMain.handle('skills:list', () => {
  const lockPath  = path.join(os.homedir(), 'skills-lock.json')
  const claudeMdPath = path.join(os.homedir(), '.claude', 'CLAUDE.md')
  let claudeMd = ''
  let lockData = { skills: {} }
  try { claudeMd  = fs.readFileSync(claudeMdPath, 'utf8') } catch (_) {}
  try { lockData  = JSON.parse(fs.readFileSync(lockPath, 'utf8')) } catch (_) {}

  const result = []
  for (const [name, meta] of Object.entries(lockData.skills || {})) {
    const mdPath = path.join(os.homedir(), '.claude', 'skills', name, 'SKILL.md')
    let description = '', tags = [], version = '', author = ''
    try {
      const md = fs.readFileSync(mdPath, 'utf8')
      const blockDesc = md.match(/^description:\s*[>|]\s*\n((?:[ \t]+[^\n]*\n?)+)/m)
      if (blockDesc) {
        description = blockDesc[1].split('\n').map(l => l.trim()).filter(Boolean).join(' ')
      } else {
        const inline = md.match(/^description:\s*(.+)$/m)
        if (inline) description = inline[1].trim()
      }
      const t = md.match(/tags:\s*\[([^\]]+)\]/)
      if (t) tags = t[1].split(',').map(s => s.trim().replace(/['"]/g, ''))
      const v = md.match(/version:\s*([^\n]+)/)
      if (v) version = v[1].trim()
      const a = md.match(/author:\s*([^\n]+)/)
      if (a) author = a[1].trim()
    } catch (_) {}
    result.push({ name, source: meta.source, description, tags, version, author, active: claudeMd.toLowerCase().includes(name), kind: 'skill' })
  }

  // Plugin skills from claude-mem
  const pluginSkills = [
    { name: 'claude-mem:babysit',       description: 'Watch a PR until ready to merge — monitors reviews, comments, and CI.',          tags: ['github','pr','automation'],        active: true, kind: 'plugin', source: 'thedotmack/claude-mem', version: '13.4.1' },
    { name: 'claude-mem:make-plan',     description: 'Create a detailed multi-phase implementation plan with tasks and milestones.',    tags: ['planning','architecture'],         active: true, kind: 'plugin', source: 'thedotmack/claude-mem', version: '13.4.1' },
    { name: 'claude-mem:do',            description: 'Execute a phased plan using subagents. Use after /make-plan.',                    tags: ['execution','agents'],              active: true, kind: 'plugin', source: 'thedotmack/claude-mem', version: '13.4.1' },
    { name: 'claude-mem:learn-codebase',description: 'Prime a codebase by reading every source file. Use when starting a new project.',tags: ['codebase','exploration'],          active: true, kind: 'plugin', source: 'thedotmack/claude-mem', version: '13.4.1' },
    { name: 'claude-mem:knowledge-agent',description:'Build and query a project knowledge base with semantic search.',                  tags: ['knowledge','memory'],              active: true, kind: 'plugin', source: 'thedotmack/claude-mem', version: '13.4.1' },
    { name: 'claude-mem:smart-explore', description: 'Smart codebase exploration — finds relevant files and explains architecture.',    tags: ['exploration','analysis'],          active: true, kind: 'plugin', source: 'thedotmack/claude-mem', version: '13.4.1' },
    { name: 'claude-mem:oh-my-issues',  description: 'Create, triage, and manage GitHub issues from natural language.',                tags: ['github','issues'],                 active: true, kind: 'plugin', source: 'thedotmack/claude-mem', version: '13.4.1' },
    { name: 'claude-mem:version-bump',  description: 'Bump version, update changelog, tag, and prepare a release.',                    tags: ['release','versioning','git'],      active: true, kind: 'plugin', source: 'thedotmack/claude-mem', version: '13.4.1' },
    { name: 'code-review',              description: 'Review current diff for correctness bugs, simplification, efficiency. --fix applies.',tags: ['review','quality'],            active: true, kind: 'built-in', source: 'Anthropic built-in', version: 'built-in' },
    { name: 'security-review',          description: 'Security audit: OWASP top 10, secrets exposure, auth gaps, injection risks.',    tags: ['security','audit','OWASP'],        active: true, kind: 'built-in', source: 'Anthropic built-in', version: 'built-in' },
    { name: 'simplify',                 description: 'Review changed code for reuse, simplification, efficiency — then apply fixes.',  tags: ['refactor','cleanup'],              active: true, kind: 'built-in', source: 'Anthropic built-in', version: 'built-in' },
  ]
  return [...result, ...pluginSkills]
})

// ── Commander ─────────────────────────────────────────────────────────────────

function spawnForCommander (session) {
  if (ptyProcesses.has(session.id)) return true
  const npmBin = path.join(process.env.APPDATA || (os.homedir() + '\\AppData\\Roaming'), 'npm')
  const sp = `C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\WindowsPowerShell\\v1.0;${npmBin}`
  const ep = process.env.PATH ? `${sp};${process.env.PATH}` : sp
  const env = { ...process.env, PATH: ep, TERM: 'xterm-256color' }
  try {
    const pty = nodePty.spawn(
      session.shell || 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      session.args || [],
      { name: 'xterm-256color', cols: 120, rows: 30, cwd: session.cwd || os.homedir(), env }
    )
    const buf = []
    pty.onData(d => { buf.push(d); if (buf.length > 500) buf.shift(); if (mainWindow) mainWindow.webContents.send('pty-output', { id: session.id, data: d }) })
    pty.onExit(() => { ptyProcesses.delete(session.id); if (mainWindow) mainWindow.webContents.send('pty-status', { id: session.id, status: 'stopped' }) })
    ptyProcesses.set(session.id, { pty, outputBuffer: buf })
    if (mainWindow) mainWindow.webContents.send('pty-status', { id: session.id, status: 'active' })
    return true
  } catch (_) { return false }
}

ipcMain.handle('commander:dispatch', (_, { message, sessionId }) => {
  const sessions = store.get('sessions', []).filter(s => s.kind === 'terminal')
  let target = sessions.find(s => s.id === sessionId)
  if (!target) target = sessions.find(s => s.id === 'claude-1') || sessions[0]
  if (!target) return { ok: false, error: 'No terminal sessions' }

  if (!spawnForCommander(target)) return { ok: false, error: 'Failed to start PTY' }

  const entry = ptyProcesses.get(target.id)
  // Write directly to the running Claude interactive session
  entry.pty.write(message + '\r')
  return { ok: true, sessionId: target.id, sessionName: target.name }
})

// AI tool sessions — start Claude with context, switch to terminal
ipcMain.handle('ai:session', (_, { toolId, goal }) => {
  const AI_CONTEXTS = {
    'higgsfield':        `You are my Higgsfield AI creative partner. You have the /higgsfield skill. Help me craft the perfect MCSLA prompt (Model · Camera · Subject · Look · Action). My goal: ${goal}`,
    'higgsfield-generate': `Generate content on Higgsfield using /higgsfield-generate. My goal: ${goal}`,
    'opus-clip':         `You are my video repurposing strategist for OpusClip. Help me find the best clips, viral hooks, and captions for short-form. My goal: ${goal}`,
    'claude-ai':         goal,
    'figma':             `You are my UI/UX design assistant. Help me design in Figma — components, layouts, design systems. My goal: ${goal}`,
    'canva':             `You are my Canva visual content strategist. Help me with design, color, typography, and templates. My goal: ${goal}`,
    'capcut':            `You are my CapCut video editor assistant. Help me with cuts, effects, transitions, and captions. My goal: ${goal}`,
    'anthropic-console': `You are helping me with the Anthropic API Console. Help me with prompts, model selection, and API usage. My goal: ${goal}`,
  }
  const prompt = AI_CONTEXTS[toolId] || goal
  const sessions = store.get('sessions', []).filter(s => s.kind === 'terminal')
  // Use prompt-tester or claude-1 as the AI session terminal
  const target = sessions.find(s => s.id === 'prompt-tester') || sessions.find(s => s.id === 'claude-1') || sessions[0]
  if (!target) return { ok: false, error: 'No terminal' }

  if (!spawnForCommander(target)) return { ok: false, error: 'Failed to start PTY' }

  const entry = ptyProcesses.get(target.id)
  // Small delay to let Claude finish loading, then send context
  setTimeout(() => {
    try { entry.pty.write(prompt + '\r') } catch (_) {}
  }, 2500)

  return { ok: true, sessionId: target.id, sessionName: target.name }
})

// ── Lifecycle ─────────────────────────────────────────────────────────────────

ipcMain.handle('lifecycle:get', () => store.get('lifecycle', {}))
ipcMain.handle('lifecycle:set', (_, id, phase) => {
  const lc = store.get('lifecycle', {})
  lc[id] = { phase, updatedAt: Date.now() }
  store.set('lifecycle', lc)
  return lc
})

// ── Environment / onboarding check ──────────────────────────────────────────
// The whole pitch is "runs on your OWN Claude", so first-run onboarding needs to
// know whether the `claude` CLI is installed and signed in. We return booleans
// plus the account email (so we can show "runs on your Claude — you@x.com") —
// no token or secret ever leaves the main process.
ipcMain.handle('env:check', () => {
  const out = { node: process.versions.node, claudeInstalled: false, claudePath: null, claudeLoggedIn: false, account: null }

  // Claude CLI present? Check the npm global bin first, then fall back to PATH.
  const npmBin = path.join(process.env.APPDATA || (os.homedir() + '\\AppData\\Roaming'), 'npm')
  const candidates = ['claude.cmd', 'claude.ps1', 'claude.exe', 'claude'].map(n => path.join(npmBin, n))
  for (const c of candidates) {
    try { if (fs.existsSync(c)) { out.claudeInstalled = true; out.claudePath = c; break } } catch (_) {}
  }
  if (!out.claudeInstalled) {
    try {
      const { execSync } = require('child_process')
      const found = execSync('where claude', { windowsHide: true }).toString().trim().split(/\r?\n/)[0]
      if (found) { out.claudeInstalled = true; out.claudePath = found }
    } catch (_) {}
  }

  // Signed in? ~/.claude.json carries the oauth account once the user logs in.
  try {
    const p = path.join(os.homedir(), '.claude.json')
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'))
      const acct = j && j.oauthAccount
      if (acct && acct.accountUuid) {
        out.claudeLoggedIn = true
        out.account = acct.emailAddress || acct.displayName || 'signed in'
      }
    }
  } catch (_) {}

  return out
})

// ── Swarm ─────────────────────────────────────────────────────────────────────

ipcMain.handle('pty:swarm', (_, cmd) => {
  const sessions  = store.get('sessions', []).filter(s => s.kind === 'terminal')
  const results   = []

  for (const session of sessions) {
    // Ensure PTY is running — start it if not already
    if (!ptyProcesses.has(session.id)) {
      const sh  = session.shell || 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
      const cwd = session.cwd   || os.homedir()
      const npmBin2 = path.join(process.env.APPDATA || (os.homedir() + '\\AppData\\Roaming'), 'npm')
      const sysPath = `C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\Wbem;C:\\Windows\\System32\\WindowsPowerShell\\v1.0;${npmBin2}`
      const envPath = process.env.PATH ? `${sysPath};${process.env.PATH}` : sysPath
      const env = { ...process.env, PATH: envPath, TERM: 'xterm-256color' }
      try {
        const pty = nodePty.spawn(sh, session.args || [], { name: 'xterm-256color', cols: 80, rows: 24, cwd, env })
        const outputBuffer = []
        pty.onData(data => {
          outputBuffer.push(data)
          if (outputBuffer.length > 500) outputBuffer.shift()
          if (mainWindow) mainWindow.webContents.send('pty-output', { id: session.id, data })
        })
        pty.onExit(() => {
          ptyProcesses.delete(session.id)
          if (mainWindow) mainWindow.webContents.send('pty-status', { id: session.id, status: 'stopped' })
        })
        ptyProcesses.set(session.id, { pty, outputBuffer })
        if (mainWindow) mainWindow.webContents.send('pty-status', { id: session.id, status: 'active' })
      } catch (err) {
        results.push({ id: session.id, ok: false, error: err.message })
        continue
      }
    }

    const entry = ptyProcesses.get(session.id)
    try {
      const claudeCmd = cmd || `& "${path.join(process.env.APPDATA || (os.homedir() + '\\AppData\\Roaming'), 'npm', 'claude.cmd')}"`
      entry.pty.write(claudeCmd + '\r')
      results.push({ id: session.id, ok: true })
    } catch (err) {
      results.push({ id: session.id, ok: false, error: err.message })
    }
  }

  return results
})

// ── Launcher ─────────────────────────────────────────────────────────────────

ipcMain.handle('launcher:open', (_, { url, filePath }) => {
  if (url)      return shell.openExternal(url)
  if (filePath) return shell.openPath(filePath)
})

// ── Swarm Deploy ───────────────────────────────────────────────────────────────
// Pick the project folder the swarm will work on
ipcMain.handle('dialog:pickFolder', async () => {
  const last = store.get('swarmLastFolder')
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Pick the project folder for the swarm',
    defaultPath: last || os.homedir(),
    properties: ['openDirectory']
  })
  if (res.canceled || !res.filePaths.length) return null
  store.set('swarmLastFolder', res.filePaths[0])
  return res.filePaths[0]
})

ipcMain.handle('dialog:lastFolder', () => store.get('swarmLastFolder') || null)

// Pick one or more files to attach to a swarm goal (we pass their paths to the
// agents, not their contents — keeps the goal small and lets agents read them).
ipcMain.handle('dialog:pickFiles', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Attach file(s) to the goal',
    properties: ['openFile', 'multiSelections']
  })
  if (res.canceled || !res.filePaths.length) return []
  return res.filePaths
})

// Ensure a PTY exists for a given session config, spawning it if needed
function ensurePtyFor (session) {
  if (ptyProcesses.has(session.id)) return true
  const sh  = session.shell || 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
  const cwd = session.cwd   || os.homedir()
  const npmBin = path.join(process.env.APPDATA || (os.homedir() + '\\AppData\\Roaming'), 'npm')
  const sysPath = `C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\Wbem;C:\\Windows\\System32\\WindowsPowerShell\\v1.0;${npmBin}`
  const envPath = process.env.PATH ? `${sysPath};${process.env.PATH}` : sysPath
  const env = { ...process.env, PATH: envPath, TERM: 'xterm-256color' }
  try {
    const pty = nodePty.spawn(sh, session.args || [], { name: 'xterm-256color', cols: 80, rows: 24, cwd, env })
    const outputBuffer = []
    pty.onData(data => {
      outputBuffer.push(data)
      if (outputBuffer.length > 500) outputBuffer.shift()
      if (/trust.*folder|Do you trust|1[\.\)]\s*(Yes|Proceed|Trust)/i.test(data)) {
        setTimeout(() => { try { pty.write('1\r') } catch (_) {} }, 120)
      }
      if (mainWindow) mainWindow.webContents.send('pty-output', { id: session.id, data })
    })
    pty.onExit(() => {
      ptyProcesses.delete(session.id)
      if (mainWindow) mainWindow.webContents.send('pty-status', { id: session.id, status: 'stopped' })
    })
    ptyProcesses.set(session.id, { pty, outputBuffer })
    if (mainWindow) mainWindow.webContents.send('pty-status', { id: session.id, status: 'active' })
    return true
  } catch (_) { return false }
}

// Launch the swarm: for each item {session, prompt}, start Claude Code and
// inject the role prompt once it has loaded. Staggered so we don't spawn all at once.
ipcMain.handle('swarm:launch', (_, { items, cwd }) => {
  // Scaffold the shared files the team coordinates through:
  //  - PLAN.md  : the single source of truth, owned/dictated by Codex (the lead)
  //  - SWARM.md : where each specialist records findings
  try {
    if (cwd && fs.existsSync(cwd)) {
      const planPath = path.join(cwd, 'PLAN.md')
      if (!fs.existsSync(planPath)) {
        fs.writeFileSync(planPath,
          `# Swarm Plan\n\nProject: ${cwd}\n\n` +
          `> Codex (the lead) owns this file. It is the single source of truth and the team's shared memory.\n` +
          `> Specialists: read your "## <role>" section for your tasks and re-read regularly to stay on the same plan.\n\n` +
          `_Codex is writing the plan — check back in a moment._\n`, 'utf8')
      }
      const swarmPath = path.join(cwd, 'SWARM.md')
      if (!fs.existsSync(swarmPath)) {
        fs.writeFileSync(swarmPath, `# Swarm Report\n\nProject: ${cwd}\n\nEach specialist appends findings under their own heading below.\n`, 'utf8')
      }
    }
  } catch (_) {}

  // IMPORTANT: every `claude` process writes the SHARED global ~/.claude.json on
  // startup. Launching several at the same instant races that write and corrupts
  // the file (wiping login/onboarding). So we space launches well apart — each
  // Claude finishes its startup write before the next one begins.
  const SPACING  = 7000   // ms between specialist launches
  const HEADSTART = items.some(it => it.lead) ? 9000 : 0  // let Codex write PLAN.md first

  let specIndex = 0
  items.forEach((item) => {
    const startAt = item.lead ? 0 : HEADSTART + (specIndex++) * SPACING
    setTimeout(() => {
      if (!ensurePtyFor(item.session)) return
      const entry = ptyProcesses.get(item.session.id)
      if (!entry) return
      // Launch Claude Code in bypass mode — swarm agents run autonomously and
      // must never stall on a permission prompt.
      try { entry.pty.write('claude --dangerously-skip-permissions\r') } catch (_) {}
      // After it loads (and the folder-trust prompt is auto-accepted), send the role brief
      setTimeout(() => {
        try { entry.pty.write(item.prompt + '\r') } catch (_) {}
        // Claude's TUI sometimes swallows the trailing \r as part of the paste,
        // leaving the brief sitting unsubmitted. Nudge Enter again — harmless
        // if the first one landed (empty input + Enter is a no-op).
        setTimeout(() => { try { entry.pty.write('\r') } catch (_) {} }, 1500)
        setTimeout(() => { try { entry.pty.write('\r') } catch (_) {} }, 3500)
      }, 4000)
    }, startAt)
  })

  // Dock the project roadmap on every swarm session so progress is visible
  // immediately (the per-session auto-detect only fires for project sessions).
  try {
    const rm = findRoadmap(cwd)
    if (rm && mainWindow) {
      items.forEach((item) => {
        mainWindow.webContents.send('roadmap-found', { id: item.session.id, name: rm.name, path: rm.path, content: rm.content })
      })
    }
  } catch (_) {}

  return { ok: true, count: items.length }
})
