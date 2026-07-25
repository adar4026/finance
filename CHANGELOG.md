# Changelog

All notable changes to **A-Lex Finance** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [Unreleased] — Version 1.1.0 (in development)

> Version 1.1.0 is the active development milestone, built on top of the
> stable 1.0.0 foundation.

### Added

- **Collapsing sticky header** on the Home screen. The top row (avatar,
  search, analytics) stays pinned; the period switcher and the month/year
  navigation live in a new `.subhead` block in normal flow, so they scroll
  away naturally without any scroll-driven animation. A hairline divider and
  a light translucent material appear on the pinned bar once scrolling starts
  (`--bg-blur` token, `.topbar.scrolled`).
- New header row: **Avatar → Search → Analytics**. The search capsule fills
  all free space, all three controls have a 44×44 pt minimum hit area.

### Changed

- The three-line menu button was removed from the header. The avatar is now
  the single entry point to the side drawer (which still opens the profile
  from its header row). The JSON-export icon left the header — it stays
  available in the drawer and in Settings.
- The screen title and the "updated N min ago" subtitle were removed from the
  header (they were part of the old brand block).
- **Bottom navigation** redesigned as a light floating capsule: four tabs
  (Home · Analytics — Accounts · Budgets), monochrome stroke icons instead of
  emoji, muted grey when inactive, accent purple on a soft purple pill when
  active. The central add button is now a circle that overhangs the capsule by
  about half its height, with an "Добавить" caption inside the panel. Tab
  labels scale down on narrow screens so they never collide.
- Bottom safe-area handling for the floating navigation: content padding and
  the accounts FAB were raised accordingly.

### Planned / candidate items

- Unify the close-button component across sheets, modals and dialogs.
- Bottom navigation safe-area handling on notched iPhones (`min-height` +
  `height: calc(navh + safe-area-inset-bottom)`), verified on device.
- "What's New" screen (the `releaseNotes` / `openWhatsNew` hook is already reserved).
- Unused-CSS audit using coverage tooling.
- Extract the remaining single hardcoded color (`.dc-chg.neg`) into a design token.

---

## [1.0.0] — 2026-06 — Production Release

**A-Lex Finance 1.0.0 — Initial Public Release.**

This version represents the first stable public release of A-Lex Finance.

### Highlights

- Accounts
- Transactions
- Analytics
- Budgets
- Calendar
- Goals
- Financial Health
- Search
- Import & Export
- Backup & Restore
- Light & Dark Mode
- Offline PWA Support
- Apple-inspired User Interface

### Release information

- **Release name:** A-Lex Finance 1.0.0
- **Release date:** June 2026
- **Status:** Production Release

[Unreleased]: https://github.com/adar4026/finance/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/adar4026/finance/releases/tag/v1.0.0
