# Changelog

All notable changes to **A-Lex Finance** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [Unreleased] — Version 1.1.0 (in development)

> Version 1.1.0 is the active development milestone, built on top of the
> stable 1.0.0 foundation.

### Added

- **Main finance card redesign** (`TASK_003`) on the Home screen: a white
  card (no more purple gradient), with total capital + eye button, a
  month-over-month change line, a two-line Chart.js graph (solid green
  cumulative income, dashed red cumulative expense, right-side money scale,
  soft grid, end-of-line markers/labels, tap/click tooltip with date/income/
  expense/difference), and the three existing income/expense/flow stats.
  A compact independent month switcher (`‹ Июль 2026 г. ›`) sits directly
  above the card, with its own state, local calendar month boundaries,
  44×44px hit areas, `aria-label`s, disabled future-month navigation, and a
  light direction-aware label animation that respects
  `prefers-reduced-motion`. The Home screen background is now a light
  grouped `#F2F2F7` (`--home-bg` token, dark theme reuses `--bg2`). New pure
  calculation module `js/services/finance_card_service.js` (month bounds,
  totals, capital-at-month-end, cumulative series) with a Node unit test
  suite (`tests/finance_card_service.test.js`). The existing privacy toggle
  (`state.hideAmounts`) now also masks the card's chart labels, money scale
  and tooltip via a new `#fcEye` button kept in sync with the existing
  `#capEye2` (Accounts screen). The existing period switcher, transaction
  list, Analytics and Budgets screens are unchanged.
- **Collapsing sticky header** on the Home screen. The top row (avatar,
  search, analytics) stays pinned; the period switcher and the month/year
  navigation live in a new `.subhead` block in normal flow, so they scroll
  away naturally without any scroll-driven animation. A hairline divider and
  a light translucent material appear on the pinned bar once scrolling starts
  (`--bg-blur` token, `.topbar.scrolled`).
- New header row: **Avatar → Search → Analytics**. The search capsule fills
  all free space, all three controls have a 44×44 pt minimum hit area.
- **Liquid Glass tab indicator** (`TASK_002`) in the bottom navigation: a
  single translucent glass capsule now glides behind the active tab's icon
  and label instead of a flat per-button fill. Position/size are computed
  from the active button's live geometry (not fixed coordinates), so it
  stays correct at 320–430px widths, after resize/orientation change and
  across themes. Movement uses the Web Animations API with a soft spring
  easing and a subtle direction-aware stretch; respects
  `prefers-reduced-motion` (instant, no animation). The central "Добавить"
  button is not a tab and never receives the indicator.

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
- **Bottom navigation, follow-up pass** against the Ministry reference layout:
  taller capsule (`--navh` 64→76px, single token drives nav height, content
  padding and the accounts FAB together), wider side margins (12→16px), a
  visibly tinted active-tab pill (new `--nav-active-bg` token, ~15% purple
  instead of the near-invisible `--accent-soft`), and a larger central "+"
  button (54→60px) with a softer, larger shadow. Tab label sizing tightened
  (min font, letter-spacing, tab margins) so all five labels stay on one line
  without truncation from 320px up.
- **Bottom navigation, blue accent pass** matching the Ministry reference
  exactly: the central "+" button and the active-tab state (icon, label,
  pill) now use a dedicated blue (`--nav-blue`/`--nav-blue2`/`--nav-blue-soft`
  tokens, scoped to the bottom nav only — the rest of the app keeps the
  purple `--accent` brand color). The "+" glyph changed from a text character
  to a symmetric SVG cross so it sits perfectly centered in the circle at any
  size. Inactive tab icons/labels switched from light grey (`--muted2`) to
  `var(--text)` at font-weight 700 for a bolder, darker look in both themes.
- **Bottom navigation, "+" vertical position**: lowered the central button
  toward the "Добавить" caption to match the tighter cluster look of the
  Ministry reference (overhang above the capsule 29→15px, gap to the caption
  21→11px). The button still clears both neighboring tabs by 5px on every
  tested width.
- **Bottom navigation, capsule position**: lowered the whole floating panel
  closer to the bottom edge (offset above `env(safe-area-inset-bottom)`
  12→6px) — it was sitting too high above the screen edge on devices without
  a home-indicator safe area. Still fully respects the safe-area inset on
  notched iPhones; content clearance above the panel is unaffected (~50px on
  the longest scrolled list).
- **Bottom navigation, real-device fix**: the previous pass only reduced the
  *additional* offset (12→6px) but still added it on top of
  `env(safe-area-inset-bottom)`, which is ~34pt on notched iPhones — so on an
  actual device (as opposed to a desktop browser, where that inset is always
  0) the panel still floated ~40pt above the edge and looked too high, which
  is what testing on a real phone caught. Changed to
  `bottom:max(6px, env(safe-area-inset-bottom))` — the panel now sits flush
  with the safe-area boundary on notched phones (no extra stacked padding),
  while still keeping a 6px minimum breathing gap on devices/browsers that
  report no safe area at all.

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
