'use strict'

// Coverage for SwarmPanel's role-routing logic — the function that decides which
// specialists get deployed from a free-text goal. This is the first thing a
// non-technical user hits, so a wrong default crew = wrong audit.
//
// We load the PURE prefix of SwarmPanel.jsx (everything before the JSX
// component) straight from source via `new Function`, with a React stub — so
// the test exercises the SHIPPING logic without a bundler and without copying it.

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
  const factory = new Function('React', prefix + '\n return { suggestRoles, SPECIALISTS, BROAD_RE };')
  return factory({}) // React stub — the pure helpers never touch it
}

const { suggestRoles, SPECIALISTS } = loadPureLogic()
const ids = g => suggestRoles(g) // returns a Set

test('keyword goals route to the matching specialists', () => {
  const r = ids('Fix the login auth and password encryption vulnerabilities')
  assert.ok(r.has('security'), 'security should be picked from auth/password/vuln')
})

test('a testing goal includes the QA specialist', () => {
  const r = ids('improve unit test coverage and fix the flaky e2e bug')
  assert.ok(r.has('qa'), 'qa should be picked from test/coverage/bug')
})

test('vague goals fall back to the default crew (>=2 specialists)', () => {
  const r = ids('make it nice')
  assert.ok(r.size >= 2, 'a vague goal must still deploy a usable crew')
  for (const id of ['security', 'frontend', 'backend', 'qa']) {
    assert.ok(r.has(id), `default crew should include ${id}`)
  }
})

test('"check it in every way" (broad) deploys the default crew', () => {
  const r = ids('Check this project in every way before launch')
  for (const id of ['security', 'frontend', 'backend', 'qa']) {
    assert.ok(r.has(id), `broad goal should include ${id}`)
  }
})

test('every suggested id is a real specialist', () => {
  const valid = new Set(SPECIALISTS.map(s => s.id))
  const r = ids('deploy a docker backend with a postgres database and react frontend')
  for (const id of r) assert.ok(valid.has(id), `unknown specialist id: ${id}`)
})
