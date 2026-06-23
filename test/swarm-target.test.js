'use strict'

// Coverage for the swarm-target safety guard (`assessSwarmTarget` in main.js).
// The swarm runs with permissions BYPASSED, so this guard is what stops a
// non-dev from aiming an autonomous, file-deleting team at C:\, a system folder,
// their whole home folder, or a non-git folder they can't undo. It's a safety
// feature, so it gets a regression test.
//
// We pull the function straight from main.js source (not a copy) and run it with
// `path.win32` + stubbed os/fs/process, so the Windows-path logic is exercised
// deterministically even though the test host is Linux.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const nodePath = require('node:path')
const pathWin = nodePath.win32

const MAIN = nodePath.join(__dirname, '..', 'main.js')

// .git paths we want the fs stub to report as existing (drives the isGit check).
const gitDirs = new Set()
const fsStub = { existsSync: p => gitDirs.has(p) }
const osStub = { homedir: () => 'C:\\Users\\dev' }
const processStub = {
  env: {
    SystemRoot: 'C:\\Windows',
    ProgramFiles: 'C:\\Program Files',
    'ProgramFiles(x86)': 'C:\\Program Files (x86)',
    ProgramData: 'C:\\ProgramData',
  },
}

function loadAssessSwarmTarget () {
  const src = fs.readFileSync(MAIN, 'utf8')
  const start = src.indexOf('function assessSwarmTarget')
  assert.ok(start >= 0, 'could not find assessSwarmTarget in main.js')
  const end = src.indexOf('\n}\n', start) // first line that is just a closing brace
  assert.ok(end > start, 'could not find the end of assessSwarmTarget')
  const fnSrc = src.slice(start, end + 2) // include the closing brace
  const factory = new Function('path', 'os', 'fs', 'process', fnSrc + '\n return assessSwarmTarget;')
  return factory(pathWin, osStub, fsStub, processStub)
}

const assess = loadAssessSwarmTarget()
const gitPathFor = folder => pathWin.join(pathWin.resolve(folder), '.git')

test('a drive root (C:\\) is BLOCKED', () => {
  assert.equal(assess('C:\\').level, 'block')
})

test('a system folder is BLOCKED', () => {
  assert.equal(assess('C:\\Windows\\System32').level, 'block')
  assert.equal(assess('C:\\Program Files\\TermDash').level, 'block')
})

test('the entire home folder only WARNS (deploy-anyway)', () => {
  const r = assess('C:\\Users\\dev')
  assert.equal(r.level, 'warn')
  assert.match(r.message, /entire home folder/)
})

test('a normal non-git folder WARNS about no undo', () => {
  const r = assess('C:\\Users\\dev\\newproj') // not in gitDirs
  assert.equal(r.level, 'warn')
  assert.match(r.message, /not a git repository/)
})

test('a normal git-tracked project folder is OK', () => {
  const folder = 'C:\\Users\\dev\\proj'
  gitDirs.add(gitPathFor(folder)) // make the .git check pass
  const r = assess(folder)
  assert.equal(r.level, 'ok')
  assert.equal(r.isGit, true) // confirms we hit the real logic, not the catch-all fallback
})
