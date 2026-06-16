# Changelog

All notable changes to TermDash are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/);
versioning follows [Semantic Versioning](https://semver.org/).

## [1.2.0] - 2026-06-15
### Added
- **First-run welcome tour** + a persistent **"?" help button** so a complete
  beginner is guided from the very first screen and can never get stuck.
- **One-click Claude setup** — no copy-pasting terminal commands. The setup bar
  now offers "Get Node.js", "Install Claude for me", and "Sign in to Claude"
  buttons that just do it in a terminal you watch.
- **🎓 Try a demo** — runs the swarm on a safe throwaway project so you can watch
  it work without touching your own files.
- **Live agent status badges** — working / paused / stopped at a glance.
- **🛑 Stop all agents** — one click kills every running agent.
- **🔒 Ask-before-editing mode** — agents ask before each change (safer first runs).
- **📤 Export findings** — save the swarm's SWARM.md as a shareable report.
- Remembers your lead-engine choice (Claude/Codex) across restarts.

## [1.1.1] - 2026-06-15
### Added
- **GPU/renderer crash self-heal.** Repeated GPU-process crashes (bad drivers,
  VMs, low-end hardware) now auto-relaunch in software-rendering mode, and a
  renderer crash auto-reloads — so the app keeps working instead of black-screening.
- **Per-user Screenshots shortcut** that resolves to each user's own
  `Pictures\Screenshots`; folder shortcuts auto-create the folder on open.
### Fixed
- **Pre-launch security audit fixes:** eliminated all hardcoded personal paths
  (a downloaded copy never opens the author's folders); added a swarm-target
  guardrail that blocks system/drive roots and confirms on home/non-git folders
  before deploy; added a Content-Security-Policy + navigation guards; hardened
  boot reliability (corrupt-config recovery, off-screen-window guard, safe cwd
  fallback, readable fatal-load dialog, one-shot trust auto-accept).

## [1.1.0] - 2026-06-15
### Added
- **Automatic updates.** The installed app now checks GitHub Releases on launch,
  downloads a newer version in the background, and offers a one-click restart to
  install it. From this version forward you no longer have to manually
  re-download to get fixes and features.
- Bug-report issue form and a changelog (this file).

## [1.0.1] - 2026-06-15
### Added
- **Lead-engine choice** — pick what powers the swarm lead: **Claude** (default,
  works for everyone with Claude) or **Codex** (shown only when the Codex CLI is
  installed). Specialists always run on Claude.
### Changed
- Removed the misleading hardcoded "Codex (Lead)" name; the lead now shows its
  real engine in the UI, the deploy count, the intro copy, and the agent prompts.

## [1.0.0] - 2026-06-15
### Added
- Initial public release: 🐝 Swarm Deploy (a coordinated team of named Claude
  Code terminals), session tiles, and launcher shortcuts.
- Reliability: single-instance lock, global crash guards, and surfaced PTY spawn
  failures instead of silent blank terminals.
- First-run onboarding that detects whether Claude Code is installed and signed
  in, with a guided fix when it isn't.
- Windows installer (NSIS) with `node-pty` correctly bundled.

[1.1.0]: https://github.com/thaerthebear/termdash/releases/tag/v1.1.0
[1.0.1]: https://github.com/thaerthebear/termdash/releases/tag/v1.0.1
[1.0.0]: https://github.com/thaerthebear/termdash/releases/tag/v1.0.0
