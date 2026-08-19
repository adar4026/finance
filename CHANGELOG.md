# Changelog

All notable changes to **A-Lex Finance** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [Unreleased] — Version 1.1.0 (in development)

> Version 1.1.0 is the active development milestone, built on top of the
> stable 1.0.0 foundation.

### Changed

- **Main screens background tinted mint-gray-green** (`TASK_039`, small
  point fix, not part of the `TASK_025` plan). The background behind Home,
  Analytics, Accounts and Budgets was almost white (`#f2f2f7`) and gave
  white cards little separation. Replaced with a soft vertical gradient —
  a more saturated cool mint (`#D1E4DB`) at the top fading smoothly into a
  light gray-green (`#EBF0ED`) — scoped to a new token so the shared
  `--home-bg` token (used by Profile, Security, Categories, the drawer,
  and the transaction page) is untouched. Dark theme is pixel-identical to
  before.

### Added

- **"Создать резервную копию" can now save through the OS-native "Save
  As" dialog** (`TASK_038B`, small follow-up to `TASK_038`), via the File
  System Access API when the browser and platform support it — letting the
  user pick iCloud Drive, a local folder, or any other system location
  through the OS's own picker. The app never hardcodes an iCloud path and
  never calls iCloud APIs directly; the choice is entirely the user's, made
  in the system dialog. Where the API is unavailable, the existing browser
  download to Downloads keeps working unchanged. Cancelling the system
  dialog is treated as a no-op, not an error — no toast, no state change.

### Changed

- **Export screen copy tweaked** (`TASK_038A`, small follow-up to
  `TASK_038` — no logic changed). The CSV import card no longer names
  Money Flow specifically; it now reads "Из приложений и банков,
  поддерживающих CSV" (from apps and banks that support CSV). The backup
  card copy was tightened to "Создать резервную копию / Все данные
  приложения · .afb".

### Added

- **Export, import and restore are now three separate things** (`TASK_038`,
  absorbs the reserved `TASK_034`/M-9). The "Экспорт и копии" screen used to
  mix them: export shared a screen with backup, and CSV import was hidden in
  Settings. Now the screen reads top to bottom as Экспорт → Импорт данных →
  Резервные копии, with restore visually marked as destructive, and each
  path has an explicit contract — **export never writes**, **import merges**,
  **restore replaces**.
- **A real CSV import wizard** with four steps — file analysis → column,
  account and category mapping → preview → result. Nothing is written to the
  database until the button on the preview step; every earlier step works on
  a plan held in memory. The wizard reports what it found (rows, period,
  currencies, accounts, categories, detected source, encoding and delimiter),
  auto-maps what it recognises, and lets you correct anything it got wrong.
- **Duplicate detection.** Re-importing the same file now adds nothing. The
  fingerprint combines date, type, amount, currency, account, category and
  payee — and, for a transfer, both accounts — and is held as a multiset, so
  two genuinely identical coffees on the same day still import as two
  operations while a repeated file imports as zero.
- **Undo import.** Entities created by an import carry an `importBatchId` and
  are listed in a new `importBatches` journal, so the result screen can
  remove exactly what that import added. An account or category is kept if
  one of your own transactions has since started referring to it.
- **Excel export is now a real `.xlsx`** instead of an HTML table served with
  an `.xls` extension. Dates are dates and amounts are numbers, so sorting,
  filtering and summing work in the file itself. Written without any
  dependency: a minimal OOXML package inside a hand-built ZIP.
- **Export periods**: current month, previous month, current year, previous
  year, all history, and a custom range.
- **Backup files carry an envelope**: format identifier, backup version,
  schema version, app version, creation time, entity counts and an FNV-1a
  checksum over a canonical serialisation. Restore shows all of it in a
  preview before anything is replaced. Old backups (`{app,data}`) and bare
  state files still restore exactly as before.

### Changed

- **Restoring a backup is now a checked sequence, not a `confirm()`**: read
  and validate the file → show a preview → automatically save a safety copy
  of the current data → migrate → write → **re-read from storage and verify
  the counts** → only then report success. If the verification does not
  match, the previous database is put back from the last successfully saved
  snapshot. A corrupted, truncated, foreign or newer-than-the-app file is
  refused with a plain-language reason and leaves the database untouched.
- **CSV files are decoded properly.** Reading used to be UTF-8 only, so a
  bank or Money Flow export saved in windows-1251 silently turned into
  mojibake that ended up in category names. Encoding is now detected
  (UTF-8 → windows-1251 → UTF-16, BOM handled), the delimiter is chosen by
  actually parsing candidate rows rather than counting characters in the
  first line, and quoted values keep their commas and line breaks.
- **Import no longer creates entities while parsing.** Accounts and
  categories used to be pushed into the state inside the parse loop, before
  the user had seen a single number. The import is now built as a plan
  against a clone and committed in one write, so a parse failure, a
  validation failure or a storage failure all leave the database exactly as
  it was.
- **Account and category matching is normalised** (case, spaces, punctuation,
  diacritics) and understands a short bilingual synonym list, so `Groceries`
  maps onto your existing «Продукты» instead of becoming its twenty-first
  near-duplicate. Every mapping decision is shown and can be overridden.
- **No `confirm()` on the import and restore paths** — both now have real
  screens, and errors use the app's existing toast mechanism.

### Fixed

- **Saving is now atomic and never reports success it did not achieve**
  (`TASK_026`, closes the Critical finding C-1 of the `TASK_025` audit):
  the UI wrapper `save()` used to discard the `Result` returned by
  `AF.Store.save()`, so a failed write — most realistically a full
  `localStorage`, since receipt photos live as data URLs inside the same
  `finance_app` record — still produced the ordinary "Расход добавлен ✓"
  toast while the transaction existed only in memory and disappeared on the
  next reload. `save()` now returns the same `Result`, and every CRUD path
  (transactions, transfers, accounts, account groups, categories,
  subcategories, budgets, goals, reminders, auto-posted operations,
  settings, passcode and biometrics, demo data, full reset, CSV and JSON
  import, backup restore) stops before its success toast, before closing
  its form and before the success haptic. On failure the in-memory state is
  rolled back to the last successfully saved snapshot (`AF.Store.snapshot`
  / `AF.Store.rollback`, restoring in place so closure references stay
  valid), so an unsaved entry never reaches the capital, analytics or
  budgets, an unsaved edit leaves no partially modified object, and an
  unsaved deletion does not make the record vanish. The form stays open
  with everything the user typed — amount, note, payee, attached receipt —
  and a retry saves exactly once: the id of a new transaction is issued
  once per form (`aTxId`), and a `txCommitted` latch closes the window in
  which a double tap could slip through (`closeSheet()` goes through
  `history.back()`, which is asynchronous).
- **Storage failures are told apart and explained in plain language**
  (`TASK_026`): `AF.Store.save()` now returns typed errors —
  `QUOTA_EXCEEDED` (recognised across `QuotaExceededError`,
  `NS_ERROR_DOM_QUOTA_REACHED` and the legacy codes 22 / 1014),
  `SERIALIZATION_FAILED` (a throwing `JSON.stringify`) and
  `STORAGE_FAILED` (storage unavailable, e.g. private mode). A full
  storage reads "Не удалось сохранить данные: хранилище приложения
  заполнено. Удалите ненужные фотографии чеков или создайте резервную
  копию." — no exception names, no stack traces and no invented byte
  limit. The message reuses the existing toast component in a deliberately
  more visible variant (`.toast.err`): white on red in both themes,
  multiline, kept clear of the safe area, and dismissed by tap instead of
  vanishing on a timer.
- **Import and backup restore can no longer destroy the existing database**
  (`TASK_026`): both used to replace `state` before writing, so a failed
  write left memory and storage disagreeing while the user was told the
  data had been loaded. The candidate database is now assembled separately
  and adopted only after a successful write; CSV import rolls back both the
  added transactions and any categories or accounts created along the way.
  Duplicate ids inside an imported file are re-issued (`dedupeIds`) so an
  imported record cannot silently overwrite an existing one.
- **Collision-safe identifiers** (`TASK_026`, closes M-8): the three
  competing generators (`Date.now()`, `Date.now()+Math.random()+k`,
  `'c'+Date.now().toString(36)`) are replaced by a single `AF.Ids`
  (`js/core/ids.js`) — timestamp plus a process counter plus a random tail,
  so entities created within the same millisecond can no longer share an
  id, with `unique()` additionally guaranteeing no collision inside the
  target collection. `crypto.randomUUID()` is used when available and has a
  full fallback (it only exists in secure contexts and not in every Safari
  version). Entity prefixes are now distinct — goals and account groups
  both used to start with `g`. Existing user ids are deliberately left
  untouched; no data migration is part of this task.
- **`Math.min(...array)` over unbounded transaction lists replaced with an
  iterative form** (`TASK_026`, closes M-10): argument spreading is limited
  by the stack size, so a long history could throw `RangeError` and take
  down the screen. NaN semantics are reproduced exactly — the related H-6
  fix belongs to `TASK_027` and is intentionally not mixed in here.

### Added

- **Security screen rebuilt as a standalone Apple-style screen, with its
  settings made real** (`TASK_023`): the security screen moved out of the
  old modal `.detail-sheet` (a "🔐 Безопасность" header and two coarse
  toggle rows) into a full-screen page in the same visual language as
  Profile, Accounts and Budgets — `var(--home-bg)` background, white
  cards with `var(--fincard-shadow)` and a large radius, hairline inset
  separators, a large circular back button with a thin outline and an SVG
  chevron, a centred title and the calm "Ограничение входа в приложение"
  subtitle. No emoji, no gradients, no stray colour.

  The larger half of the task was behaviour, not looks: the brief
  explicitly ruled out fake security, so every row is either genuinely
  wired up or honestly marked unavailable. The passcode reuses the
  existing machinery untouched (`state.pinHash` is a salted SHA-256, with
  the same `pinStart`/`pinKey`/`pinComplete` state machine), and gains a
  separate "Изменить защитный код" row. Face ID is new — the app had no
  biometric code at all — and is built on a real WebAuthn platform
  authenticator (`authenticatorAttachment:'platform'`,
  `userVerification:'required'`), which on iOS is the system Face ID /
  Touch ID prompt; availability comes from
  `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()`,
  and when there is no platform authenticator the row reads "Недоступно
  на этом устройстве" with a disabled switch rather than pretending. The
  unlock screen gains a "Разблокировать Face ID" button, with the keypad
  still a full fallback. A footnote on the screen states plainly what the
  protection is: a local entry lock on this device, with the code stored
  only as a hash and the app's data not encrypted by either mechanism.

  "Запрашивать" (Сразу / 1 / 5 / 15 минут / 1 час) is new and actually
  changes when the app locks. Until now the app only locked on a cold
  start, so a delay setting would have been decorative — the exact thing
  the brief forbids. Backgrounding now records a timestamp on
  `visibilitychange`/`pagehide`, and the decision is made by a pure
  `AF.Services.Security.shouldLock()`. Widget data access is rendered as
  an honest disabled state with an explanation: the PWA has no widgets
  (`manifest.json` has no `widgets` field and nothing exchanges data with
  one), so the setting is not stored at all — persisting a flag that
  influences nothing would advertise protection that does not exist. The
  pre-existing "Скрывать суммы" setting was not dropped; it moved into
  its own "Приватность" card.

  The dependency rules live in a new pure service,
  `js/services/security_service.js`, rather than in click handlers:
  biometrics cannot be on without a passcode (re-checked on every
  normalisation, so an enabled state survives neither an `.afb` restore,
  nor a JSON import, nor hand-editing `localStorage`), enabling Face ID
  without a code leads to creating one, turning the code off clears
  biometrics and the stored credential id, and an unknown delay, a
  missing or malformed timestamp, or a clock moved backwards all fail
  secure. Normalisation runs from `AF.Store.migrate()` behind a
  service-presence check — the same compatibility invariant as `TxMeta`
  (`TASK_015` §0). `SCHEMA_VERSION` stays at 3: the new keys are
  optional, their absence means safe defaults, and normalisation is
  idempotent, so no user data migrates.

  Switches are native `<button role="switch">` elements with
  `aria-label`, `aria-checked`, a visible focus ring, smooth animation
  and focus preserved across re-renders; the on state uses the calm teal
  `#30b0c7` already used for the security icon chip in Profile. Security
  did **not** return to the "Ещё" drawer — Profile remains its only entry
  point. Service worker cache `finance-v165` → `finance-v166`. Tests: 885
  passing across 12 files (up from 709 across 10).

  Not verified instrumentally: the actual Face ID system prompt and
  biometric unlock — the headless preview browser cannot display it and
  `navigator.credentials.create()` hangs there — so that needs confirming
  on a real iPhone.

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

- **Budgets hero card: "Потрачено/Лимит" text was grey instead of white**
  (`TASK_024`): the hero card gets `class="capital bud-hero"`, and
  `.capital{color:#fff}` colours its text white by inheritance — but a
  second, unrelated rule, `.bh-foot{color:var(--muted2)}` (originally
  written for an unused `.bh-head`/`.bh-title`/`.bh-sub` trio), set
  `color` directly on the "Потрачено €… / Лимит €…" row. A color set
  directly on an element always wins over one inherited from an
  ancestor, regardless of the ancestor rule's specificity, so the row
  rendered muted grey on the purple-to-teal gradient instead of white.
  Fixed with an explicit `color:#fff` on `.bud-hero .bh-foot`, which
  overrides the generic rule outright. Service worker cache
  `finance-v166` → `finance-v167`.

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

- **Budgets screen — Apple-style redesign** (`TASK_022`): the whole
  "Бюджеты" screen (`#scrBudgets`) was reworked to match Home's,
  Analytics', Categories' and — most directly — Accounts' visual
  language (`TASK_020`), with the underlying calculation logic (month
  range, limit, spent, remaining, overspend, categories, create/edit/
  delete) left completely untouched. The "Осталось в бюджете" hero card
  now shares the exact same gradient and shadow as the "Общий капитал"
  card on the Accounts screen — literally, not a newly picked similar
  purple — via the same reusable `.capital` component plus a scoped
  `#scrBudgets .capital{...}` override identical in value to
  `#scrAccounts .capital{...}`; the card's own rules were trimmed down to
  just its internal structure (badge, big value, progress bar, spent/limit
  footer), all of which keep working exactly as before.

  Category cards (`.bud-card`) were restyled into plain white cards with
  `var(--fincard-shadow)` and no border, in the same language as
  `.acc-cat`/`.fincard`. The previous `.bud-card.over{border:2px solid
  rgba(239,68,68,.42)}` rule — a heavy red border wrapping the whole card
  on overspend — is gone entirely; the status stays legible through the
  already-existing red text (`.bc-rl.over`/`.bc-rv.over`) and the
  dynamically-colored progress fill (`.bc-fill`, driven by the unchanged
  `budgetColor()`), not through decorating the card itself. The empty
  state ("Бюджетов пока нет...") picked up the same white card treatment
  instead of sitting as bare text on the screen background — same emoji,
  same copy, no invented data. The "Добавить бюджет" button needed no
  change at all: it already shared the exact `.add-dashed` class used by
  "+ Счёт"/"+ Группа" on Accounts. The budget editor sheet, the shared
  period switcher and the month navigation row are outside this task's
  scope, same as the account editor was left alone in `TASK_020`. Service
  worker cache: `finance-v164` → `finance-v165`.

- **Profile is now its own screen; "Безопасность" moved there from the
  drawer** (`TASK_021`): the personal profile used to be a bottom modal
  sheet (`#profOverlay` → `.modal`) carrying ten rows that duplicated the
  navigation drawer almost item for item — notifications, goals, calendar,
  financial health, statistics, security, theme, export and "all
  settings". It is now a separate full-height screen in the same visual
  language as Home: light-gray `var(--home-bg)` background, an Apple-style
  back button (SVG chevron plus "Назад" in the system blue
  `var(--nav-blue)`) on the left of the navigation bar and a centered
  "Профиль" title.

  The screen holds only what belongs to the person using the app. A white
  rounded card (`var(--fincard-shadow)`, 22px radius) carries a large 96px
  round photo with a small camera button pinned to its corner, the
  editable name below it (placeholder "A-Lex") and, under a hairline inset
  divider, a "Сменить фото" row with a camera icon and a chevron. Both the
  camera button and the row open the same existing `#photoInput`, so the
  photo pipeline — `FileReader` → 256×256 center-cropped canvas → JPEG
  q=0.85 → `state.avatar` → `save()` + `renderHeader()` — is reused
  verbatim and not touched. Name handling (`state.profileName`, its live
  sync into the header avatar initial and the drawer card) is likewise
  unchanged.

  Below that sits a single "Защита" section with one item, "Безопасность",
  carrying the shield icon reused literally from the drawer entry and
  leading to the existing security screen (PIN, hide-amounts). That entry
  was *moved*, not duplicated: `#drSecurity` and its separator are gone
  from the drawer's "Приложение" group, and `openSecurity()` no longer
  closes the profile behind it — so closing the security screen returns
  the user exactly to the profile they came from. Everything else stays in
  the drawer and remains reachable there; the profile screen deliberately
  has no categories, goals, export, notifications, calendar, statistics,
  health, theme or "all settings". The corresponding handlers and the now
  unused `#profNotifBadge` branch in `renderHeader()` were removed with
  them, and a new `tests/profile_screen.test.js` (80 checks) asserts, among
  other things, that no reference to a removed element survives anywhere in
  `index.html` — a stale `$('#profGoals').onclick` would throw at startup
  and take the whole app down. Service worker cache: `finance-v163` →
  `finance-v164`.

- **Accounts screen — Apple-style redesign** (`TASK_020`): the whole
  "Счета" screen (`#scrAccounts`) was reworked to match Home's, Analytics'
  and Categories' visual language, with the underlying data model and
  business logic left untouched. The "Общий капитал" (total capital) card
  now uses the exact same gradient as the "Личный профиль A-Lex" card in
  the navigation drawer (`.drawer-head`, `TASK_017`:
  `linear-gradient(135deg,#a79cf7 0%,#8fb0f6 55%,#8fdde3 100%)`) through a
  scoped override (`#scrAccounts .capital{...}`) — the global `.capital`
  rule the Statistics screen's hero card also relies on was left
  untouched; the balance-visibility eye, sum and currency kept their
  existing behavior. The screen background is now the same light-gray
  `var(--home-bg)` as Home, and the capital-distribution panel picked up
  the same shadow/corner-radius as Home's `.fincard` plus roomier padding,
  through a scoped `#scrAccounts .panel{...}` override.

  Each account group ("Наличные"/"Карты"/"Крипто" and any custom group)
  is now its own white card — icon, name and account count on the left,
  total sum, a chevron and a "⋯" menu on the right — styled after Apple
  Wallet/iOS Settings grouped lists. Expanding a card reveals its accounts
  as list rows with inset dividers that start after the icon column
  (rather than full-bleed), instead of the previous nested card-in-card
  look, with a smooth CSS `max-height` expand/collapse transition (new
  `toggleAccGroup()`) instead of the previous full-list re-render on every
  toggle. The large "↕ Изменить порядок" button was replaced with a
  compact "Изменить" link next to the "Счета" section title, reusing the
  existing `.sec-head` component already used elsewhere on Home. The drag
  reordering itself (`setupAccountSort()`/`liftAccCard()`/
  `commitAccountOrder()`) was not touched algorithmically — only its CSS
  hooks were renamed (`.acc3` → `.acc-cat-row`); the functional
  `.grp-body` class the reorder commit logic depends on was intentionally
  kept as-is. While writing the new collapse toggle, the exact bug class
  found in `TASK_018` (calling `.find()` on a `NodeList` returned by the
  project's `$$()` helper, which doesn't wrap it in an array) was
  proactively avoided by using an attribute selector instead.

  The capital-distribution donut chart is unchanged; the list underneath
  it gained modern inset separators, right-aligned amounts/percentages,
  and a thin per-row progress bar (reusing the existing `.progress`/
  `.fill` component already used for goals/budgets) filled with the
  account's color to the width of its share of total capital. Category
  card icons are picked at render time by group name (for the three
  built-in groups) or from a small fixed color palette by index (for
  custom groups) — purely presentational, not persisted to
  `state.accountGroups`. The account editor, account detail graph,
  archive/restore flow, and account/group creation were not redesigned
  and their logic is unchanged.

- **Analytics screen — Apple-style redesign** (`TASK_019`): the whole
  composition of the Analytics screen (`#scrCharts`) was reworked to
  match Home's visual language, while every calculation, real data
  point, period selector and interaction stayed exactly as they were.
  The screen background is now the same light-gray `var(--home-bg)` as
  Home, and its cards picked up the same shadow/corner-radius as Home's
  `.fincard` through a scoped override (`#scrCharts .panel{...}`) — the
  global `.panel` rule other screens rely on (Budgets, Accounts, Health
  Score) was left untouched. The large purple "result" hero card at the
  top (month name, total, % vs. previous period, income/expense chips)
  is gone from the render entirely, not just hidden. The Expense/Income
  toggle was rebuilt on the same sliding "Liquid Glass" component Home's
  period switcher and the Categories screen use
  (`.periods`/`.periods-indicator`, new `moveAnaCatSegIndicator()`)
  instead of its own solid-fill segmented control. The donut chart with
  its category list, and the "Сравнение с прошлым периодом" (comparison
  to previous period) card, both moved up in the DOM to sit right under
  the toggle; the "Доходы и расходы" bar chart and the "Динамика
  капитала" capital chart keep their existing calculations and their
  order relative to each other, at the bottom. None of the rendering
  functions that do the actual math
  (`renderAnaBar`/`renderAnaPie`/`renderAnaCompare`/`renderCapChart`/
  `rangeBack`/`catChangeBadge`) changed — only where their containers
  sit in the page and how the cards are styled. The comparison card's
  existing zero-previous-period guard was left as-is (already safe,
  no `NaN`/`Infinity`); `AF.Services.Analytics.compare()`, a pure
  function with the same guard that had never been wired into the UI,
  was left untouched too and gained unit test coverage instead of
  replacing the proven inline logic.

- **Categories screen — Apple-style redesign** (`TASK_018`): the category
  manager (opened via drawer → "Категории" → "Управлять") now matches the
  Home screen's visual language end to end. The container background is
  now the same light-gray `var(--home-bg)` as Home, and category cards
  gained the same minimal shadow (`var(--fincard-shadow)`) and a larger
  corner radius used elsewhere for card lists. The Expense/Income toggle
  was rebuilt on the same sliding "Liquid Glass" component the Home
  period switcher uses (`.periods`/`.periods-indicator`, blue glass
  capsule) instead of its own solid-fill segmented control, so the app no
  longer has two visually different toggle styles for this kind of
  control. The drag handle icon changed from three plain bars to an SVG
  grip (2×3 dots) that scales up and darkens while held. Drag-to-reorder
  gained a short spring pop on pickup, a FLIP animation so sibling cards
  slide smoothly out of the way instead of jumping, and a second light
  haptic pulse on a successful drop (only when the order actually
  changed); the lifted card's shadow/scale treatment was softened (no
  more colored border). The close button already used the same shared
  component as every other overlay screen, so it needed no changes.
  Category data, ordering logic and subcategories are unchanged.

  While wiring up the smoother reorder, a pre-existing bug surfaced:
  `commitCatOrder()` called `.map()` on the result of the app's `$$()`
  helper, which returns a plain `NodeList` (no `.map()`) — so releasing a
  dragged card always threw, and category reordering had never actually
  worked. Fixed alongside the animation work, since a working drag is
  what this task asked for.

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
