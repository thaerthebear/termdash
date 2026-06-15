'use strict'

const { contextBridge, ipcRenderer, clipboard } = require('electron')

// Global event dispatchers — single ipcRenderer listener, fan out to subscribers
const outputSubs  = new Set()
const statusSubs  = new Set()
const roadmapSubs = new Set()

ipcRenderer.on('pty-output', (_, msg) => { for (const cb of outputSubs) cb(msg) })
ipcRenderer.on('pty-status',  (_, msg) => { for (const cb of statusSubs)  cb(msg) })
ipcRenderer.on('roadmap-found', (_, msg) => { for (const cb of roadmapSubs) cb(msg) })

contextBridge.exposeInMainWorld('termAPI', {
  // Sessions
  listSessions:   ()          => ipcRenderer.invoke('session:list'),
  createSession:  (cfg)       => ipcRenderer.invoke('session:create', cfg),
  updateSession:  (id, patch) => ipcRenderer.invoke('session:update', id, patch),
  deleteSession:  (id)        => ipcRenderer.invoke('session:delete', id),

  // PTY control
  startPty:  (session)         => ipcRenderer.invoke('pty:start', session),
  stopPty:   (id)              => ipcRenderer.invoke('pty:stop', id),
  writePty:  (id, data)        => ipcRenderer.invoke('pty:write', id, data),
  resizePty: (id, cols, rows)  => ipcRenderer.invoke('pty:resize', id, cols, rows),
  getPreview:(id)              => ipcRenderer.invoke('pty:preview', id),

  // PTY event subscriptions — return unsubscribe function
  onPtyOutput: (cb) => { outputSubs.add(cb);  return () => outputSubs.delete(cb) },
  onPtyStatus: (cb) => { statusSubs.add(cb);  return () => statusSubs.delete(cb) },

  // Roadmap — auto-detected on project open, kept on the side & synced with Claude
  onRoadmap:  (cb)   => { roadmapSubs.add(cb); return () => roadmapSubs.delete(cb) },
  getRoadmap: (cwd)  => ipcRenderer.invoke('project:roadmap', cwd),

  // Swarm — fire a command into all terminal PTYs at once
  swarmAll: (cmd) => ipcRenderer.invoke('pty:swarm', cmd),

  // Swarm Deploy — pick a project folder, then launch named specialist agents
  pickFolder:    ()       => ipcRenderer.invoke('dialog:pickFolder'),
  lastFolder:    ()       => ipcRenderer.invoke('dialog:lastFolder'),
  pickFiles:     ()       => ipcRenderer.invoke('dialog:pickFiles'),
  swarmLaunch:   (opts)   => ipcRenderer.invoke('swarm:launch', opts),

  // Environment / onboarding — is the `claude` CLI installed & signed in?
  checkEnv: () => ipcRenderer.invoke('env:check'),

  // Skills
  listSkills: () => ipcRenderer.invoke('skills:list'),

  // Commander — autonomous AI dispatch
  dispatchCommander: (opts) => ipcRenderer.invoke('commander:dispatch', opts),

  // AI tool sessions
  startAISession: (opts) => ipcRenderer.invoke('ai:session', opts),

  // Lifecycle
  getLifecycle: ()          => ipcRenderer.invoke('lifecycle:get'),
  setLifecycle: (id, phase) => ipcRenderer.invoke('lifecycle:set', id, phase),

  // Native clipboard (works on file:// pages where navigator.clipboard is blocked)
  readClipboard:  ()     => clipboard.readText(),
  writeClipboard: (text) => clipboard.writeText(text),

  // Launcher shortcuts
  openLauncher: ({ url, path }) => ipcRenderer.invoke('launcher:open', { url, filePath: path })
})
