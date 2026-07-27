# Changelog

All notable changes to **A-Lex Finance** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [Unreleased] — Version 1.1.0 (in development)

> Version 1.1.0 is the active development milestone, built on top of the
> stable 1.0.0 foundation.

### Fixed

- **White/dark strip below the entire app in standalone PWA — the real
  root cause, finally** (`TASK_011`): five previous attempts
  (`TASK_006`–`TASK_010`) tried fixing this by adjusting `html`/`body`/
  `.app` sizing and positioning, none of which worked because they were
  all fixing the wrong layer. Built a temporary debug build (contrasting
  background colors per root layer, plus a live on-screen panel reading
  `innerHeight`, `document.documentElement.clientHeight`,
  `visualViewport`, real `env(safe-area-inset-*)`, and
  `getBoundingClientRect()` for every root element) and measured it on the
  user's real iPhone in standalone mode. The data was conclusive:
  `html`/`body`/`.app`/`#scrollArea` all covered their viewport perfectly
  (bottom = 759 on every one of them, no discrepancy) — but the device's
  physical screen was 812px tall. The 53px gap matched
  `env(safe-area-inset-top)` exactly. Cause:
  `<meta name="apple-mobile-web-app-status-bar-style"
  content="black-translucent">` — in standalone mode this makes the
  WebView's own viewport *shorter* than the physical screen by exactly the
  status-bar height (content draws under a translucent status bar at the
  top, but the viewport itself doesn't extend to the true bottom edge), so
  no amount of CSS inside the page could ever paint that region — it's
  physically outside the page's viewport, and iOS was filling it with the
  document's background color (which is why it changed with the theme).
  Fixed by changing the status bar style to `default`, which makes the
  WebView occupy the full physical screen. The temporary debug build
  (`debug-safearea.js` and its include line) was fully removed afterward.
  Re-adding the PWA icon to the home screen is required to see the fix,
  since iOS caches this meta tag's effect at install time.
- **White strip below the entire app, down to the true screen edge —
  actual root cause** (`TASK_010`): `TASK_009` fixed the background
  inside `#scrollArea` (under the Home screen specifically), but the user
  reported the real gap sits *outside* the whole `.app`, extending to the
  iPhone's true bottom edge — a safe-area coverage problem, not a Home-
  screen background problem. Confirmed the `<meta viewport>`
  `viewport-fit=cover` was present and unmodified the whole time (not the
  cause). The actual cause: `TASK_006`/`TASK_007` set `body` to
  `position:fixed;inset:0` while *also* giving it an explicit `height`
  (`100%`/`100vh`/`100dvh`) — an explicit height conflicts with (and wins
  over) the implicit sizing `inset:0` alone would produce from anchoring
  to all four true viewport edges, and on some iOS states that explicit
  height computed shorter than the real safe-area-covered screen, clipping
  `body` short of the true bottom edge (explaining why `TASK_007` made the
  gap *worse*, not better). `TASK_008` removed `position:fixed` entirely
  instead, which also doesn't reliably guarantee coverage under
  `env(safe-area-inset-bottom)`. Fixed by keeping `position:fixed;inset:0`
  but dropping the conflicting explicit `width`/`height` — the box is now
  sized purely by its anchor to the four true viewport edges, which
  `viewport-fit=cover` guarantees includes the safe area. `.app` inherits
  the now-correct full height. `TASK_006`'s fixed header and `TASK_009`'s
  Home-screen background fix are both unaffected.
- **White gap under the bottom nav on the Home screen — actual root
  cause** (`TASK_009`): `TASK_007`/`TASK_008` fixed the wrong layer (the
  `html`/`body` viewport height/positioning) — they didn't touch the real
  cause, which is why the user still saw the gap on a real iPhone after
  both. The actual issue: the space reserved for the floating bottom nav
  is `padding-bottom` on `#scrollArea` (added in `TASK_006`), which sits
  outside `#scrRecords`'s own box — and `#scrRecords{background:
  var(--home-bg)}` (`TASK_003`) only paints its own box, not that
  padding. `#scrollArea` itself never had a background, so that reserved
  strip (including the safe-area zone under the nav) fell through to
  `body`'s plain background instead of continuing the Home screen's own
  light-gray tint. Fixed with one pure-CSS rule —
  `.scroll-area:has(>#scrRecords.active){background:var(--home-bg)}` —
  which paints `#scrollArea`'s background (padding included) to match the
  Home screen whenever it's active, and leaves it transparent (unchanged
  behavior) on every other screen. No JS or screen logic touched; reacts
  to the existing `.active` class already toggled by `showScreen()`.
- **Bottom nav pushed up with a wider white gap below it** (`TASK_008`):
  `TASK_007`'s `position:fixed` + `100dvh` fix for the white line (below)
  turned out to make things worse on a real iPhone — the fixed `body`'s
  computed height came out shorter than the actual visible area, so the
  bottom nav (unchanged since `TASK_004`, confirmed via `git diff`)
  visually sat higher than usual, with a wider blank gap below it down to
  the true screen edge. Since all real overflow was already isolated
  inside `#scrollArea` (`TASK_006`), `body` never actually has content
  taller than itself — so plain `overflow:hidden` (no `position:fixed`, no
  `dvh` sizing trick) is enough to prevent any scroll/rubber-band on it.
  Reverted `body`/`html` to normal in-flow `height:100%` — the bottom nav
  (`position:fixed`, anchored via `env(safe-area-inset-bottom)`) once
  again sits flush with the true bottom edge as it did originally. The
  `TASK_006` fixed-header behavior is unaffected.
- **White line at the bottom of the screen on iPhone/PWA** (`TASK_007`):
  a side effect of `TASK_006`'s fixed `html`/`body` — their height was set
  to `100%` with no background color on `html`. On iOS Safari the layout
  viewport height (`100%`/`100vh`) doesn't always match the actual visible
  area when the Safari toolbar shows/hides, so the fixed `body` could fall
  short of the true bottom edge, exposing `html`'s default white
  background as a thin line. Fixed by switching `html`/`body` height to
  `100dvh` (with a `100vh` fallback) — `dvh` tracks the real visible area
  live — and giving `html` a `background:var(--bg)` as a safety net so any
  residual gap blends into the theme instead of showing white. The
  `TASK_006` fixed-header behavior itself is unaffected.
- **Header no longer moves during iOS rubber-band overscroll** (`TASK_006`):
  the top bar (avatar/search/analytics) used to visibly slide down along
  with the content during pull-down/elastic overscroll on iOS/PWA, even
  though it used `position:sticky`. Root cause: the whole document
  (`html`/`body`) was the scrolling element, and WebKit shifts
  sticky/fixed elements along with the rest of the layout viewport during
  elastic bounce of the document itself. Fixed by making `html`/`body`
  non-scrollable (`position:fixed`, full viewport) and introducing a
  single dedicated scroll container (`#scrollArea`, wrapping the period/
  month sub-header and all screens) below the header — the header is now
  physically outside the scrolling region, so it cannot move regardless
  of rubber-band inside it. Updated the collapsing-header "scrolled"
  material-background listener and the account/category drag-and-drop
  auto-scroll-at-edge logic to target `#scrollArea` instead of
  `window`/`document.scrollingElement`, since that's now the real
  scrolling element. Bottom nav, safe-area insets, light/dark theme, and
  all overlays/sheets (already independent, fixed-position elements)
  are unaffected.
- **Month switch — plain chevron arrows** (`TASK_005`): the Home screen's
  finance-card month switcher (`#fcMonthPrev`/`#fcMonthNext`) now uses a
  vector chevron icon instead of a plain, borderless `‹`/`›` glyph —
  matching the user's reference (a standard iOS-style back chevron). An
  initial iteration added a round thin-outline button around the chevron;
  a follow-up simplified it further by request — no circle, background, or
  outline, just the chevron itself, same tap target. The active arrow uses
  the existing `var(--nav-blue)` "system blue" token (same one used for
  the bottom nav's active tab); the disabled arrow uses `var(--muted2)`
  with reduced opacity — both reused tokens, no new colors. Purely a
  restyle of the two buttons: click handlers, the disabled/hidden state
  for the current/custom period, and aria-labels are unchanged.
- **Home transaction list — iOS light redesign** (`TASK_004`): the recent-
  transactions block on the Home screen (`#recentList`) is now a light,
  minimalist iOS-style list — neutral gray screen background (already
  `var(--home-bg)`), each day grouped into its own pure-white rounded card,
  rows separated by a thin hairline that starts after the left avatar
  rather than running under it. Per row: the existing category/account
  avatar stays on the left untouched; the operation title (category +
  subcategory) is bold and dark in the center, with any extra detail (note,
  receipt icon) in smaller gray text below it; the account name with its
  own avatar sits in small gray text above the amount on the right; the
  amount is calm red for expenses, calm green for income, neutral gray for
  transfers. The previous full-row category-tinted background wash is
  removed — no bright gradients, heavy shadows, full-row color fills, or
  thick borders. Purely visual: implemented via new, isolated
  `homeGroupedTxHtml()`/`homeTxRow()` functions and `.home-*` CSS classes
  that reuse the same underlying data and helpers (`catById`, `subcatById`,
  `fmtCur`, `signed`, `dayLabelFull`, …) as before — the shared
  `groupedTxHtml()`/`txRow()` and `.tx`/`.daycard` styles used by "All
  transactions", category, account, and budget screens are untouched, so
  those screens look exactly as before. Sorting, grouping-by-day, period
  filtering, calculations, and the row tap-to-edit handler (`openSheet`)
  are all unchanged. The main finance card (`TASK_003`/`TASK_003A`) was not
  touched.
- **Home period sync & glass segment** (`TASK_003A`): the Day/Week/Month/
  Year/Period tabs above the Home screen now drive the same finance card
  introduced in `TASK_003` — switching tabs recalculates capital, change,
  and income/expense/flow for the selected range. Root cause: the card
  previously used its own isolated `cardMonth` state, never connected to
  the shared tab switcher. Fixed by removing `cardMonth` and routing the
  card through the same shared `period`/`anchor` used by the transaction
  list, Analytics and Budgets; the range math itself was extracted from
  inline code into a new pure module `js/services/period_service.js`
  (`AF.Services.Period`) so Day/Week/Month/Year/Period boundaries are
  unit-tested (local time, Monday-start week, midnight-safe). The arrows
  above the card now move the shared anchor and disable the "next" arrow
  once the range would be fully in the future. The active segment capsule
  (`День/Неделя/Месяц/Год/Период`) no longer uses a solid purple fill — it
  now reuses the bottom tab bar's Liquid Glass tokens (`TASK_002`) with a
  geometry-driven sliding indicator, in both themes. The card stays compact
  (no chart — tried again per this task's spec, dropped again after review,
  same call as `TASK_003`); its label is now "Общий баланс" (was "Общий
  капитал"), and the balance figure is smaller than the original design and
  colored with the app's existing blue accent (`--nav-blue`, reused from
  the bottom tab bar / active segment text) instead of the default text
  color. Analytics and Budgets are unaffected (unchanged `navrow`/purple
  capital card).
- **Main finance card redesign** (`TASK_003`) on the Home screen: a compact
  white card (no more purple gradient) with total capital + eye button, a
  month-over-month change line (amount + %, colored by sign), and the three
  income/expense/flow stats (now colored green/red/neutral by sign, with
  thin dividers between them). A compact independent month switcher
  (`‹ Июль 2026 г. ›`) sits directly above the card — its own state, local
  calendar month boundaries, 44×44px hit areas, `aria-label`s, disabled
  future-month navigation, and a light direction-aware label animation that
  respects `prefers-reduced-motion`. The day/week/month/year/period tabs
  above the Home screen stay as before (they still filter the transaction
  list); only their own duplicate "‹ Month Year ›" row is hidden on Home now
  (unchanged on Analytics/Budgets), so it doesn't repeat the new card
  switcher. The Home screen background is now a light
  grouped `#F2F2F7` (`--home-bg` token, dark theme reuses `--bg2`). New pure
  calculation module `js/services/finance_card_service.js` (month bounds,
  totals, capital-at-month-end) with a Node unit test suite
  (`tests/finance_card_service.test.js`). The existing privacy toggle
  (`state.hideAmounts`) masks all of the card's money values via a new
  `#fcEye` button kept in sync with the existing `#capEye2` (Accounts
  screen). The existing period switcher, transaction
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

- **Add transaction — fullscreen page instead of a two-step sheet**
  (`TASK_013`): tapping the central "+" button used to open a small bottom
  sheet asking you to pick Expense/Income/Transfer/Receipt before showing
  the actual form. That intermediate sheet is gone — "+" now opens the
  transaction form directly, full-screen, with Expense pre-selected.
  Switching between Income/Expense/Transfer happens inside the page via
  the existing segmented control, with no extra sheet and no page
  reload. The form itself (shared between adding and editing
  transactions) was restyled from a bottom sheet into the same
  full-screen page pattern already used elsewhere in the app (All
  Transactions, category manager, etc.) — opaque background, full
  height, safe-area padding, a proper header with a title and close
  button instead of a drag handle and a floating "×". The receipt-photo
  feature wasn't removed: it was already part of the expense/income
  form and stays there — only its separate entry in the old picker sheet
  is gone. The app had no browser-history handling at all before this;
  opening the page now pushes a history entry so the system back button,
  edge-swipe-back, and the in-app close button all close it the same
  way, through a single `popstate` handler, instead of the close button
  being the only thing that worked. Default type, per-type field
  visibility and the page title were extracted into a new pure module
  (`js/services/tx_form_service.js`, unit-tested) instead of being
  duplicated inline. Save/delete/category/account/currency logic is
  unchanged.
- **App icon** (`TASK_012`) regenerated in production quality from the
  approved design reference: JPEG source color-managed (Display P3 →
  sRGB), padded to a true square without cropping, and re-rendered at
  512×512, 192×192, 180×180 (`apple-touch-icon`) and 32×32 (`favicon`).
  Same composition/design as before — glossy white rounded-square card
  with the green upward-trend glyph — only sharpness, proportions and
  edge quality improved. `manifest.json` needed no changes (paths/sizes
  already matched); the service-worker cache version was bumped so
  installed PWAs pick up the new icon bytes.
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
