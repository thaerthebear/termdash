# Changelog

All notable changes to TermDash are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/);
versioning follows [Semantic Versioning](https://semver.org/).

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
