'use strict'

// Coverage for SwarmPanel's lead-engine logic — the part that decides what each
// agent actually launches with. This is the "do I need Codex/ChatGPT?" question:
// Claude must be the only hard requirement, Codex purely optional, and a user
// WITHOUT Codex must always end up on Claude rather than a broken launch.
//
// Same approach as suggest-roles.test.js: load the PURE prefix of SwarmPanel.jsx
// (everything before the JSX component) straight from source via `new Function`
// with a React stub, so we exercise the SHIPPING helpers without a bundler.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const SRC = path.join(__dirname, '..', 'src', 'components', 'SwarmPanel.jsx')

function loadPureLogic () {
  const src = fs.readFileSync(SRC, 'utf8')
  const cut = src.indexOf('window.SwarmPanel')
  assert.ok(cut > 0, 'could not locate the SwarmPanel component boundary')
  const prefix = src.slice(0, cut) // pure JS: constants + helper functions, no JSX
  const factory = new Function('React', prefix +
    '\n return { LEAD_ENGINES, launchCmd, resolveLeadEngine, fileRef, buildPrompt, buildLeadPrompt };')
  return factory({}) // React stub — the pure helpers never touch it
}

const { LEAD_ENGINES, launchCmd, resolveLeadEngine, fileRef, buildPrompt, buildLeadPrompt } = loadPureLogic()

// ── Claude is the universal default; Codex is the optional add-on ──────────────

test('Claude is always a valid lead engine (the one hard requirement)', () => {
  assert.ok(LEAD_ENGINES.claude, 'claude engine must exist')
  assert.equal(LEAD_ENGINES.claude.cmd, 'claude')
})

test('Codex exists only as an optional alternative engine', () => {
  assert.ok(LEAD_ENGINES.codex, 'codex engine should be defined as an option')
  assert.equal(LEAD_ENGINES.codex.cmd, 'codex')
})

// ── resolveLeadEngine: the "do they have Codex?" decision ──────────────────────

test('no Codex installed → lead falls back to Claude even if Codex was picked', () => {
  assert.equal(resolveLeadEngine({ lead: true, leadEngine: 'codex', codexAvailable: false }), 'claude')
})

test('Codex is used only when picked AND actually installed', () => {
  assert.equal(resolveLeadEngine({ lead: true, leadEngine: 'codex', codexAvailable: true }), 'codex')
})

test('default pick (Claude) always resolves to Claude', () => {
  assert.equal(resolveLeadEngine({ lead: true, leadEngine: 'claude', codexAvailable: true }), 'claude')
  assert.equal(resolveLeadEngine({ lead: true, leadEngine: 'claude', codexAvailable: false }), 'claude')
})

test('with no lead coordinator, the engine is Claude regardless of Codex', () => {
  assert.equal(resolveLeadEngine({ lead: false, leadEngine: 'codex', codexAvailable: true }), 'claude')
})

// ── launchCmd: bypass vs "ask before editing" (safe) mode ─────────────────────

test('default (autonomous) mode appends the engine bypass flag', () => {
  assert.equal(launchCmd('claude', false), 'claude --dangerously-skip-permissions')
  assert.equal(launchCmd('codex', false), 'codex --dangerously-bypass-approvals-and-sandbox')
})

test('safe mode drops the bypass flag so the agent asks before editing', () => {
  assert.equal(launchCmd('claude', true), 'claude')
  assert.equal(launchCmd('codex', true), 'codex')
})

test('an unknown/missing engine falls back to the Claude launch command', () => {
  assert.equal(launchCmd(undefined, false), 'claude --dangerously-skip-permissions')
  assert.equal(launchCmd('nope', true), 'claude')
})

// ── Prompt briefs name the lead correctly (Claude or Codex) ───────────────────

test('specialist brief names the chosen lead engine', () => {
  const p = buildPrompt({ id: 'qa', name: 'QA / Testing', focus: 'tests' }, 'fix bugs', '/proj', [], 'Claude')
  assert.match(p, /coordinated by a lead agent named Claude/)
  assert.match(p, /QA \/ Testing/)
})

test('lead brief is written in the voice of the chosen engine', () => {
  assert.match(buildLeadPrompt('fix bugs', '/proj', ['QA'], [], 'Codex'), /^You are Codex, the LEAD/)
})

test('attached files are referenced by path, and omitted when there are none', () => {
  assert.equal(fileRef([]), '')
  assert.match(fileRef(['/a/b.txt']), /REFERENCE FILES.*"\/a\/b\.txt"/)
})
