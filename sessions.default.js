'use strict'

// Default sessions seeded ONLY on a fresh install (when the store has none).
// Kept generic so any new user gets a sensible starting dashboard rooted at
// THEIR home folder — they add their own projects via "New session" or by
// picking a folder in Swarm Deploy.

const os   = require('os')
const path = require('path')
const HOME = os.homedir()
const PS   = process.platform === 'win32'
  ? 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
  : '/bin/bash'

module.exports = [
  // ── Section 1: Terminals ──────────────────────────────────────────────────
  {
    id: 'ps-1',
    name: 'PowerShell',
    kind: 'terminal',
    type: 'powershell',
    cwd: HOME,
    shell: PS,
    args: [],
    color: '#0078d4',
    icon: 'ps',
    section: 'Terminals'
  },
  {
    id: 'claude-1',
    name: 'Claude Code',
    kind: 'terminal',
    type: 'claude',
    cwd: HOME,
    shell: PS,
    args: ['-NoExit', '-Command', 'claude --dangerously-skip-permissions'],
    color: '#d4a017',
    icon: 'claude',
    section: 'Terminals'
  },
  {
    id: 'prompt-tester',
    name: 'Prompt Tester',
    kind: 'terminal',
    type: 'custom',
    cwd: HOME,
    shell: PS,
    args: [],
    color: '#dc2626',
    icon: 'inject',
    section: 'Inject & Artifacts'
  },

  // ── Section 2: AI Workflow ────────────────────────────────────────────────
  { id: 'higgsfield', name: 'Higgsfield AI', kind: 'launcher', type: 'ai-tool', url: 'https://higgsfield.ai', path: null, color: '#d4a017', icon: 'higgsfield', section: 'AI Workflow' },
  { id: 'claude-ai',  name: 'Claude.ai',     kind: 'launcher', type: 'ai-tool', url: 'https://claude.ai',     path: null, color: '#d97706', icon: 'claude',     section: 'AI Workflow' },
  { id: 'opus-clip',  name: 'OpusClip',      kind: 'launcher', type: 'ai-tool', url: 'https://app.opus.pro',  path: null, color: '#7c3aed', icon: 'video',      section: 'AI Workflow' },

  // ── Section 3: Design Tools ───────────────────────────────────────────────
  { id: 'figma',   name: 'Figma',        kind: 'launcher', type: 'design', url: 'https://figma.com',        path: null, color: '#f24e1e', icon: 'design', section: 'Design Tools' },
  { id: 'canva',   name: 'Canva',        kind: 'launcher', type: 'design', url: 'https://canva.com',        path: null, color: '#00c4cc', icon: 'design', section: 'Design Tools' },
  { id: 'capcut',  name: 'CapCut',       kind: 'launcher', type: 'design', url: 'https://capcut.com',       path: null, color: '#555555', icon: 'video',  section: 'Design Tools' },
  { id: 'coolors', name: 'Coolors',      kind: 'launcher', type: 'design', url: 'https://coolors.co',       path: null, color: '#f06292', icon: 'design', section: 'Design Tools' },
  { id: 'gfonts',  name: 'Google Fonts', kind: 'launcher', type: 'design', url: 'https://fonts.google.com', path: null, color: '#4285f4', icon: 'design', section: 'Design Tools' },

  // ── Section 4: Inject / Artifact Tools ───────────────────────────────────
  { id: 'anthropic-console', name: 'Anthropic Console', kind: 'launcher', type: 'ai-tool',  url: 'https://console.anthropic.com', path: null,                            color: '#dc2626', icon: 'claude', section: 'Inject & Artifacts' },
  { id: 'downloads',         name: 'Downloads',         kind: 'launcher', type: 'artifact', url: null,                            path: path.join(HOME, 'Downloads'),    color: '#6b7280', icon: 'folder', section: 'Inject & Artifacts' }
]
