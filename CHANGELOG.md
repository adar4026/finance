# Changelog

All notable changes to **A-Lex Finance** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [Unreleased] — Version 1.1.0 (in development)

> Version 1.1.0 is the active development milestone, built on top of the
> stable 1.0.0 foundation.

### Added

- **Optional transaction metadata: payee, tags and location**
  (`TASK_015`): a transaction can now carry three optional fields —
  `payee` (the shop or counterparty), `tags` (a list of labels) and
  `location` (free text only; no GPS, no geolocation permission, no maps
  and no external services). The groundwork was already half-present at
  the import/export boundary but missing from the model itself: the CSV
  header in `export_service.js` had always listed `Контрагент`, `Метки`
  and `Место` while exporting them as empty strings, and CSV import
  recognised payee and place columns only to squash them into the note
  field. That gap is what this task closes.

  Storage follows an "empty means no key" rule — a blank value deletes
  the key rather than storing `''`/`[]`, so an old transaction and a new
  one with an empty payee are structurally identical. All normalisation
  rules live in one new pure service, `js/services/tx_meta_service.js`
  (trim, whitespace collapsing, code-point-aware truncation so emoji
  aren't cut in half, case-insensitive tag de-duplication, `#` stripped
  from stored tags and only rendered in the UI, limits of 80 / 10×24 /
  120 characters). The schema version moved 2 → 3, with normalisation
  running inside `AF.Store.migrate()` — the single choke point every data
  path already goes through (app start, `.afb` restore, JSON import, CSV
  import). No backfill is attempted on old notes, and rolling the app
  back does not lose data, since the older code never strips keys it
  doesn't recognise.

  In the form the payee sits as the last row of the main card, with tags
  (as chips, committed by Enter or comma — space stays available for
  multi-word tags) and location in the details card. Payee offers
  autocomplete computed from existing transactions, with no separate
  table or directory: matches are case-insensitive, ranked by frequency
  then recency, and the stored spelling is reused — but only when the
  user explicitly picks a suggestion; typed text is never silently
  rewritten. Payee is hidden for transfers, since a transfer moves money
  between the user's own accounts and the "To account" field already
  fills that role; tags, location and note stay available there. Search
  now covers all three fields (a leading `#` in the query is ignored),
  and the payee appears as a secondary line in transaction lists — tags
  and location deliberately do not, to keep the cards readable.

  Because a temporarily mismatched set of files from GitHub Pages/Fastly
  must never break the app (the lesson from `TASK_014`), `index.html`
  contains no direct `AF.Services.TxMeta` calls at all — everything goes
  through a `txMeta()` helper with fallback normalisation, `migrate()`
  checks the service exists before using it, and `export_service.js`
  doesn't depend on it in the first place. Verified by deleting the
  service at runtime: the form still opens, saves, searches, renders and
  exports, with no console errors.

### Fixed

- **Demo data referenced non-existent category ids** (`TASK_016`):
  `loadDemo()` had drifted out of sync with the category taxonomy —
  `realty`, `income_main`, `products`, `prius`, `flat`, `clothes`,
  `beauty`, `tech` and `subscriptions` were never valid ids, so every
  demo transaction rendered as the fallback "Другое ❓". The taxonomy
  itself was extracted from an inline `index.html` constant into a new
  pure `js/services/category_taxonomy_service.js` (values unchanged,
  same pattern as the earlier `period_service.js`/`tx_form_service.js`
  extractions), and demo-transaction generation moved into a new pure
  `js/services/demo_data_service.js`, so a test
  (`tests/demo_data_service.test.js`, 239 checks) can verify every
  category/subcategory id the generator uses actually exists, that no
  demo transaction ever falls back to "Другое", and that the generated
  data is already schema-v3-normalized and exports cleanly. `state.budgets`
  and the demo `state.reminders` were fixed the same way, on the same ids.

- **Search had no Unicode diacritic normalization** (`TASK_016`):
  `Gijón` would not match a search for `gijon`. A new pure
  `js/services/search_service.js` (`AF.Services.Search.
  normalizeSearchText`) does NFD decomposition + combining-mark removal
  + lowercasing, applied to both the indexed transaction text
  (`txSearchText()`) and the user's search terms (`runSearch()`) — the
  displayed query text and all transaction data are untouched, only the
  comparison is diacritic-insensitive. Deliberately does not transliterate
  (Cyrillic `Овьедо` still won't match `Oviedo`) and does not fold `ß` to
  `ss`. Degrades safely to plain lowercase+trim if the service or
  `String.prototype.normalize` is unavailable — never throws. 37 new
  tests in `tests/search_service.test.js` cover Spanish diacritics,
  composed/decomposed Unicode, Cyrillic, the TASK_015 metadata fields
  (payee/tags/location/note), AND-semantics of multi-term queries, and
  the no-`normalize()` fallback.

- **CSV export wrote the subcategory into the "Контрагент" column**
  (`TASK_015`): the expense/income row in `export_service.js` emitted
  twelve values against twelve headers, so the count matched and nothing
  ever flagged the mismatch — but position 5, labelled `Контрагент`, held
  `_subName()`. The subcategory now joins the category column as
  `Категория / Подкатегория` (the Money Flow hierarchy format that
  `resolveCatSub` already parses back), and position 5 carries the payee.
  A new `tests/export_service.test.js` locks the exact field order and
  contents, including quoting of values containing commas, quotes,
  semicolons and newlines, and a full export → import round trip; the
  test was written against the old behaviour first to prove it actually
  reads field positions. CSV import gained a `Метки` column and a
  `resolveCatPath()` helper for the hierarchy, and it no longer merges
  payee and place into the note — the note now holds only the note
  column. Files without the new columns import exactly as before.

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

- **Navigation drawer — remove the capital card** (`TASK_017A`): a small
  corrective follow-up to `TASK_017`. The dark "total capital" card
  (balance + sparkline) that was deliberately kept during the drawer
  redesign is now removed from the drawer entirely, per a follow-up
  editorial call — its markup, the CSS scoped to `.drawer-cap` (the
  shared `.dc-l`/`.dc-v` classes used by the donut charts elsewhere are
  untouched) and the `renderDrawerCap()` function were deleted. The
  footer now sits directly under the last menu group, pulled up
  automatically by the existing `margin-top:auto` on the flex column —
  no manual spacing changes were needed. Nothing else about the drawer
  changed, and `totalCapital()` itself (still used by the Home screen's
  finance card and the Accounts screen) is untouched. Cache version
  bumped `finance-v159` → `finance-v160`.

- **Navigation drawer — premium redesign (Apple Wallet / Liquid Glass)**
  (`TASK_017`): the side menu opened from the avatar was visually reworked
  end to end — architecture, navigation and business logic are unchanged,
  only the CSS/markup/rendering of this one component. The header is now
  a wallet-style card (a soft lilac-to-blue gradient, 24px corners, a
  light glass effect) showing the avatar, name and "Personal profile"
  caption with a trailing chevron — the whole header is a single button
  that still opens the profile screen, as before. Menu rows are grouped
  into three white cards ("Planning", "Analytics", "App") with uppercase
  section titles instead of one long flat list. Every emoji icon was
  replaced with an SF-Symbols-style inline SVG in its own colour chip
  (11 icons total, reusing the same stroke-based style as the bottom nav
  icons). The notification badge got its own isolated CSS class so the
  shared badge style used by the Profile screen is untouched. Dividers
  are now a hairline `rgba(0,0,0,.06)`. While the drawer is open, the
  main screen and bottom nav behind it dim, blur (`blur(6px)`) and scale
  down slightly (`scale(.98)`) via a `body.drawer-open` class toggled in
  `openDrawer()`/`closeDrawer()` (and the Escape-key handler). Animations
  — drawer slide, header fade-in, staggered card entrance — are short and
  unobtrusive. The total-capital card (balance + sparkline) is kept as an
  existing feature, restyled to match. The footer was trimmed to just the
  app name and version — the "Released …" line is gone. Cache version
  bumped `finance-v158` → `finance-v159`. All 534 existing tests still
  pass unchanged, since no service or business logic was touched.

- **Transaction page — premium iOS redesign** (`TASK_014`): the full-screen
  add/edit transaction page introduced in `TASK_013` was reworked visually.
  Three design concepts were prototyped first (Apple Minimal / Apple Liquid
  Finance / Premium Banking); the chosen direction is a hybrid — the "Liquid
  Finance" frame (the Home screen's grey grouped background plus a barely-there
  cool glow at the top, glass used *locally* on the pinned header and footer
  only, and a sliding glass segment indicator reusing the same technique as the
  tab bar and period switcher) with "Apple Minimal" structure and typography
  (opaque cards, the amount in the normal text colour with only the `−`/`+`
  sign tinted). Structurally the sheet is no longer the scroll container: it is
  a flex column of a pinned header, a single scrolling body, and a pinned
  footer holding the primary button — which now respects the bottom safe area,
  is labelled and coloured per transaction type, and is disabled until an
  amount is entered. The solid red fill behind the active segment is gone. The
  grey bordered amount box is gone too, and the amount now shrinks to fit, so
  `−999 999 999,99 €` no longer gets cut off with an ellipsis. Fields are
  grouped into three cards (main / details / collapsed "Additional"), with
  separators drawn between the rows that are actually visible rather than
  adjacent in the DOM. The native `<select>` and `<input type="date">` controls
  were deliberately kept — they now sit as a transparent layer over each row,
  so the system pickers and every existing handler behave exactly as before,
  while the visible row shows a proper value ("Today"/"Yesterday"/"14 May"
  instead of `27/07/2026`) and the account's colour and balance. Deleting a
  transaction became a secondary text action instead of a full-width red button
  competing with Save. When the calculator keypad slides up, the footer slides
  away with it instead of being half-covered, and the keypad's accents moved
  from the app's purple to the page's own semantics. New screen-scoped `--tx-*`
  tokens were added for both themes; the global `--expense`/`--income`/
  `--accent` tokens and every other screen are untouched. The transaction
  model, `AF.Store`, `saveTx()`/`delTx()`, all money handling and the
  `TASK_013` history behaviour are unchanged. Cache version bumped
  `finance-v154` → `finance-v155`, then `finance-v155` → `finance-v156`
  in the follow-up that colours the whole amount by transaction type —
  `finance-v156` is the published version of this task. Verified by the
  user on a real iPhone and accepted as stable (safe area, opening the
  form, entering an amount, switching types, saving and general
  behaviour); no instrumented performance measurements were taken — see
  the task file.

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
