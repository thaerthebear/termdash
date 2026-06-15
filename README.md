# 🐝 TermDash

**Deploy a team of Claude agents on your project — in one click.**

TermDash is a desktop command center that launches a coordinated *swarm* of named
Claude Code terminals on any folder. A lead agent writes the plan, specialists
(Frontend, Backend, Security, QA, DevOps…) each take their lane, and they keep
each other in sync through shared `PLAN.md` / `SWARM.md` files — while you watch
the checkboxes turn green.

> **It runs on your own Claude.** No API keys, no extra subscription. If you're
> signed into Claude Code, TermDash uses it. Free.

---

## Why it's different

- **One goal → a whole team.** Type what you want, pick a folder, hit Deploy.
  TermDash spins up a lead coordinator + the right specialists for the job.
- **They stay on the same page.** The lead owns a single `PLAN.md`; specialists
  re-read it so nobody drifts. Findings land in `SWARM.md`.
- **Built-in work discipline.** Agents are told to verify before calling things
  done, never idle-loop, and stay in their lane — so you get finished work, not
  busy-work.
- **Your terminals, organized.** Session tiles, project launchers, and AI-tool
  shortcuts in one dark, fast dashboard.

## Requirements

1. **Claude Code** — the CLI the swarm runs on:
   ```
   npm install -g @anthropic-ai/claude-code
   ```
   Then run `claude` once and sign in with your Claude account.
2. **Windows 10/11** (Mac/Linux builds coming later).

TermDash checks both for you on first launch and walks you through anything
missing.

## Install

Download the latest **`TermDash-Setup.exe`** from
[Releases](https://github.com/thaerthebear/termdash/releases), run it, done.

> First launch may show a Windows SmartScreen notice (the app isn't code-signed
> yet). Click **More info → Run anyway**.

**Updates install themselves.** From v1.1.0 on, TermDash checks for new versions
on launch, downloads them in the background, and offers a one-click restart — no
manual re-downloading. See the [changelog](CHANGELOG.md) for what's new.

## Use it

1. Open TermDash → **🐝 Swarm Deploy** tab.
2. **Goal:** what you want built or checked.
3. **Folder:** the project the team works in.
4. Leave **Lead coordinator** on (it runs on your Claude by default — pick Codex
   under *Lead powered by* only if you have the Codex CLI), confirm the
   specialists, and hit **🚀 Deploy swarm**.
5. Watch them work. Progress lives in `PLAN.md`; findings in `SWARM.md`.

## Run from source (devs)

```
npm install
npm start
```

Build an installer:

```
npm run dist     # → release/TermDash-Setup-<version>.exe
```

### Contributing

PRs welcome. The stack is deliberately simple: **vanilla React loaded in the
browser** (no bundler) — components live in `src/components/*.jsx` and attach to
`window.*`; `main.js` is the Electron main process (PTYs, IPC, swarm launch);
`preload.js` bridges them. Edit, `npm start`, and use **Ctrl+Shift+R** to reload
the renderer without killing your terminals. Licensed MIT.

## How the swarm stays safe & in-sync

Every `claude` process writes a shared config on startup, so TermDash **staggers
launches** (the lead gets a head start, specialists follow spaced apart) to avoid
corrupting your login. Agents run in bypass mode so they don't stall on prompts —
so before launch TermDash **checks the folder you picked**: it refuses drive roots
and system folders (e.g. `C:\`, `C:\Windows`) outright, and asks you to confirm if
you aim it at your whole home folder or a folder that isn't a git repo. Point the
swarm at a **git-tracked project** so you can always review and undo its work.

---

Built with Electron + node-pty + xterm.js. Runs on your Claude. 🟩
