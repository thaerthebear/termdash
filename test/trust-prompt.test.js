'use strict'

// QA-2 regression test — the auto-accept "trust this folder" guard.
//
// main.js watches every chunk of PTY output and, on a match, injects `1\r`
// into the user's live shell to auto-accept Claude Code's folder-trust prompt.
// The guard MUST fire on Claude's real prompt and MUST NOT fire on ordinary
// terminal output, or it types a stray `1` into whatever the user is doing.
//
// We extract the regex(es) straight from main.js source (not a copy) so this
// test always exercises the SHIPPING guard and goes green only when the real
// code is fixed.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const MAIN = path.join(__dirname, '..', 'main.js')

// Pull out every `/.../i.test(data)` guard literal used for auto-accept.
function extractTrustRegexes (src) {
  const out = []
  const re = /\/([^/\n]+)\/i\.test\(data\)/g
  let m
  while ((m = re.exec(src)) !== null) out.push(new RegExp(m[1], 'i'))
  return out
}

// Output that MUST trigger auto-accept (Claude Code's real folder-trust prompt).
const SHOULD_FIRE = [
  'Do you trust the files in this folder?',
  '? Do you trust the files in this folder? (uses arrow keys)',
]

// Ordinary terminal output that MUST NOT trigger a stray `1` keystroke.
const SHOULD_NOT_FIRE = [
  '  1) Yes, stash and apply',           // git / interactive menu
  '1. Yes  2. No',                       // npm / installer choice
  '1. Yes — proceed with the refactor',  // Claude's own numbered output
  'Proceed? 1) Yes',                     // generic yes/no prompt
  'Build succeeded in 1.2s',             // plain log line
  '1 passing, 0 failing',                // test runner summary
]

const src = fs.readFileSync(MAIN, 'utf8')
const regexes = extractTrustRegexes(src)

test('main.js still contains an auto-accept trust guard', () => {
  assert.ok(regexes.length > 0, 'no `/.../i.test(data)` guard found in main.js')
})

for (const [i, re] of regexes.entries()) {
  test(`guard #${i + 1} fires on Claude's real trust prompt`, () => {
    for (const s of SHOULD_FIRE) {
      assert.ok(re.test(s), `expected auto-accept to fire on: ${JSON.stringify(s)}`)
    }
  })

  test(`guard #${i + 1} does NOT fire on ordinary output (QA-2)`, () => {
    for (const s of SHOULD_NOT_FIRE) {
      assert.ok(
        !re.test(s),
        `auto-accept would inject a stray "1" into the user's shell on: ${JSON.stringify(s)}`
      )
    }
  })
}
