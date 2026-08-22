# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`watch-overview.html` is the entire project: a single self-contained static page (~5400 lines)
holding a hand-researched comparison of 149 watches, plus a scoring model that rates each one's
specs against what the rest of the list charges at that price. No build system, no dependencies,
no package manager. HTML, CSS and JS live in the one file; `check.js` beside it is a Node harness
that runs the page's own checks.

**Keep it that way.** The single-file, `file://`-openable, zero-toolchain property is load-bearing:
it is why the page works offline and has no build to rot. ES modules do not load over `file://`,
so splitting the script means a dev server or a bundler. Do not split it, do not add dependencies,
do not introduce a build step.

## Running it

Open the file directly in a browser — there is nothing to build or serve:

```powershell
Invoke-Item .\watch-overview.html
```

Two things reach the network, and neither is load-bearing. `fetchUsdToEurRate()` hits two free
key-less exchange-rate APIs to convert the USD-priced rows — USD is the only live rate, and GBP,
HKD, INR and AUD rows carry a hand-set `priceEUR` with the rate in an inline comment instead. It never
throws, and on failure (offline, or `file://` CORS) the hardcoded `USD_TO_EUR` fallback stays in
use and the page renders normally. The `Pic` column hotlinks product photos from the makers' own
CDNs (all 149 rows carry
an `img`; a row without one renders a `🔗 photo` link to the maker instead, and that branch has no
rows in it today). A dead CDN URL costs a thumbnail and nothing else — the name cell links out too. Scoring, validation and filtering all run
locally, so `file://` is a fine way to work.

Four per-maker traps are worth knowing before you touch those rows. Each is written up in full in
the code, under the `// --- <Brand>, pass N ---` banner named here — read the banner rather than
working from this summary, and do not copy the reasoning back up here:

- **`longines.com` times out on this machine** — every path, on both WebFetch and curl, while the
  bare root answers. Those four rows were researched through a text-extraction proxy returning the
  maker's own rendered page. Their spec table lives in an embedded product record rather than the
  rendered prose, so a plain scrape makes Longines look near-silent when they publish more than most
  makers here. See `Longines Spirit / Conquest, pass 21`.
- **Tissot's `Länge (mm)` is not a lug-to-lug** — it is the case body excluding lugs, and it sits
  beside `Breite (mm)` in the same units looking exactly like one. Tissot publish no usable L2L;
  those rows carry `'—'`. See `Tissot PRX, pass 25`.
- **The four Laco rows (117–120) are priced as configured, not as listed** — `priceValue` is Laco's
  base price plus named surcharges, itemised above each row, and the spec columns describe the
  configured watch. Do not "correct" one against Laco's headline price. The Top-grade movement
  upgrade is ordered separately and appears nowhere in the page source, so `--probe` cannot settle
  it either way. See `Laco, pass 26`.
- **YEMA's spec tables are copy-pasted between references, and one of them is wrong** — the Superman
  Dato (row 131) has a date window YEMA's own photograph shows and its spec table's function list
  denies, listing "Hours, minutes, seconds". Its caliber name is contested on the same page too. Do
  not "correct" that row's date or its `movementDisplay` from the spec block alone; the resolution
  and its evidence are in the row's own comment. See `YEMA, pass 29`.

## Checking a change

```powershell
node check.js
```

Runs the page's own `selfCheck()` outside a browser and exits non-zero if any invariant broke. It
loads the HTML, stubs a minimal DOM, evaluates the `<script>`, and calls into it — it deliberately
does **not** restate the invariants, because two copies of an invariant is just a new place for
them to disagree. Add checks in `selfCheck()`, never in `check.js`.

It also prints the validation figures, which are the closest thing here to a regression test.
Current baseline:

```
149 rows · spec 26–66 · sigma 5 · 2 n/s · 2 o/s · 62 published weights
model  LOO RMSE 5.85 vs naive 9.15 · skill 59.1% · 1 sign flip(s) · resample typical 0.29 worst 0.61
```

**If a change was not meant to touch the model and those numbers move, something is wrong.**

In the browser, the same checks render as a red banner above the table; no banner means they all
passed. The `colspan` check only runs there, since it counts real `<th>` elements.

## Committing a change

These rules hold for **every** change here, whatever produced it — a research pass through the
`add-watch` skill, a model revision, a one-line typo fix. **They override the harness defaults**,
which otherwise branch away from the default branch, append a `Co-Authored-By` trailer to commit
messages and add a generated-with line to PR bodies. Drop all three.

- **Commit straight to `main`. No feature branches.** This is a solo, single-file project with no
  review flow, so a branch per change is pure overhead and strands the work off `main` — the branch
  cut for pass 25 was already nothing but a pointer at `main`. That makes a pull request rare rather
  than routine; the rule below stands for the occasions one is genuinely wanted.
- **A commit message is one short subject line.** No body, no trailers, no session link. Plain
  ASCII, under about 72 characters — `->` not `→`, `Elabore` not `Élaboré`. See `git log` for the
  house style. The reason is the rule under Conventions: the footer records *why* and `git show`
  records *what*, so a body is a third copy of one of them that nothing keeps in sync. Earlier
  passes wrote one and it was already drifting from the footer it duplicated.
- **A pull request is a title and nothing else.** The title reads like the commit subject; the
  description stays empty. No summary, no test plan, no checklist.
- **Never credit yourself, anywhere.** No `Co-Authored-By: Claude`, no 🤖 attribution in a PR body,
  no "generated with" note in a code comment, the page footer or an issue.

## Architecture

Three layers inside the one `<script>`:

1. **Data.** `WATCHES` — 149 object literals, one per watch, ids **1–149, contiguous and
   unique**, each with display strings (`diameterDisplay`, `movementDisplay`, …), an `img` and
   `link`, and the few structured fields the code sorts or scores on (`diameterMm`, `heightMm`,
   `waterResM`, `priceValue`, `priceCurrency`, `caseCategory`, `glassCategory`, `movementType`,
   optional `marketPrice`). Most columns are *display strings only*; sorting them goes through
   `parseLeadingNumber()`, which pulls the first number out of messy text.
2. **Model.** `computeValueScores()` — turns the data into `specScore`, `valueScore`,
   `specResidual`, `specExpected`, `specSubs`, `specGroups`, `valueBand`, `residualSigma`,
   `priceSupport` and (only on rows with a `marketPrice`) `listValue`, written back onto each
   watch object as properties.
3. **View.** `applyPipeline()` = filter → search → sort → `renderRows()` → `refreshFilterPanels()`,
   which rebuilds `tbody` via `innerHTML` with `escapeHtml()` on every interpolated value, then
   repaints the filter panels' checkboxes, live counts and trigger labels. Sorting is driven by
   `data-key` attributes on the `<th>`s, mapped in `compareWatches()`. `wireImageModal()` handles
   the lightbox on the `Pic` column.
4. **Figures and self-check.** `computedFigures()` derives every number the page quotes in its own
   prose; `selfCheck()` enforces the invariants. Both are described below.

The `<script>` opens with a contents banner listing the sections in order; grep for a
`// --- Name ---` banner to jump to one. Below the table, the `<footer>` carries the changelog.

### Side tables keyed by watch `id`

The per-watch research does not live on the watch objects. It lives in parallel lookup tables:

| Table | Keyed by | Holds |
|---|---|---|
| `EXTRAS` | `id` | lume, warranty, ISO 6425, antimagnetism, clasp, service, bezel, complications, optional `caseScore` override. **All 149 present.** |
| `FINISH` | `id` | 0–1 finishing/decoration estimate. **All 149 present.** |
| `DISPLAY_BACK` | `id` | 1 = see-through, 0 = solid, **absent = not researched**. 135 of 149 researched, 14 open. |
| `WATCH_TYPES` | `id` | array of types (filter only, never scored). **All 149 present.** |
| `STATUS` | `id` | buying decision — `'bought'`, `'likely'`, `'sceptical'` or `'avoid'`; **absent = `'consider'`**, the default. Drives a filter, a name-cell chip and a bar on the row's left edge; never scored. The one id-keyed table with no coverage requirement, so adding a watch needs no entry — and the only one where a count would just drift, so none is stated here. |
| `WEIGHT_MEASURED` / `WEIGHT_UNPUBLISHED` / `WEIGHT_UNRESOLVED` / `WEIGHT_HEAD_ONLY` | `id` | published grams (62); ids confirmed to publish none (74); ids whose page could not be reached (8); ids published without the band (5). The four are disjoint and together cover all 149 — keep it that way. |
| `PLAIN_TWIN` | `id` | the row id of the reference identical in every scored field but without the decorative content, plus what the decoration is. Drives the scope guard, never the score. **Absent = no twin exists**, which is every row but three. Listing a row is not the same as marking it: 105 is listed and does not trigger. |
| `MOVEMENT_TIER` | **exact `movementDisplay` string** | 0–1 architecture tier. 77 keys for 77 distinct movements, no misses, no orphans. |
| `MEASURED_ACCURACY` | caliber **substring** of `movementDisplay` | reported real-world rates |

Grep the `const <NAME>` declaration to find one; line numbers are not quoted here because they moved
by 15–30 lines every pass and were wrong for all nine of these before they were dropped.

**Row `id`s are load-bearing.** Renumbering or reordering rows silently reassigns lume, finishing,
casebacks and types to the wrong watches. Adding a watch means adding an entry to `EXTRAS`,
`FINISH`, `WATCH_TYPES` and (if researched) `DISPLAY_BACK`, putting it in exactly one of the four
weight tables, and adding its caliber to `MOVEMENT_TIER`.

**`movementDisplay` is a primary key, not just a label.** It is the exact-match key into
`MOVEMENT_TIER`, so editing the string — even cosmetically, an em dash to a hyphen — without
editing the key drops that row to `movementTierFor()`'s generic by-type fallback and moves its
score. `MEASURED_ACCURACY` matches the same string by substring, so keep the caliber name intact.
`selfCheck()` now catches this in both directions (a row with no key, a key matching no row), so
run `node check.js` after touching one rather than reasoning about it.

### Derived figures belong in `computedFigures()`, not in the prose

Every number the page quotes about itself — the spec range, the spec/price correlation, the row
counts, the weight estimator's own error statistics — is a `{{token}}` in the HTML, filled at
render from `computedFigures()`. **If the page can compute it, the page writes it.** Four figures
had already drifted before this was introduced, silently, because prose cannot be wrong out loud.

- To add a figure: add a key to `computedFigures()`, then write `{{thatKey}}` in the HTML.
- A `{{token}}` with no matching key is reported by `selfCheck()`, not left visible.
- `captureFigureSlots()` snapshots the templates once at startup, so the second render after the
  live FX rate lands substitutes against the original text rather than against filled output.
- Research findings that are *not* derivable (the estimator's band-type breakdown, for one) stay
  as literals and belong in the footer, where they carry a date.

### `selfCheck()` enforces the invariants — add to it, don't just document

It runs at load, renders a red banner above the table on failure, and is what `check.js` calls.
Covered today: id contiguity and uniqueness; `EXTRAS` / `FINISH` / `WATCH_TYPES` coverage in both
directions; the four weight tables disjoint and total; `movementDisplay` ↔ `MOVEMENT_TIER` in both
directions; `DISPLAY_BACK` values strictly 1/0; unknown complication tags, watch types, case and
glass categories; `caseCategory` / `glassCategory` / `movementType` against `CASE_ORDER` /
`GLASS_ORDER` / `MOVEMENT_ORDER` in both directions; `STATUS` keys against real rows and its values
against `STATUS_ORDER`; `PLAIN_TWIN` keys and twins against real rows, neither self-paired, chained nor
reversed by price, and the twin itself scored; `marketPrice` shape — a usable `eur` strictly below
the row's list price, a `kind` in `MARKET_PRICE_KINDS`, a non-empty `note`, a `listValue` computed
— plus the removed `streetPriceEUR` not reappearing on any row; `EMPTY_ROW_COLSPAN` against the
real `<th>` count; unresolved figure tokens.

**When you add an invariant to this file, add it there too.** Prose in this document enforces
nothing — that is the lesson the whole self-check exists to encode.

### The scoring model (revision 3)

Two steps, and keeping them separate is the point:

- **Step 1 — spec score (0–100).** Seven weighted `GROUPS` (movement 24%, timekeeping 16%,
  case & glass 16%, water & lume 13%, wearability 11%, fittings 11%, complications 9%), each
  splitting its weight among sub-scores. Normalisation uses the **fixed** `ANCHOR` / `WEAR_ANCHOR`
  constants, never list min/max. Exposed as the `Specs` column; observed range on the current list
  is 26–66, not 0–100.
  **Caveat, measured across passes 20–26:** this is *nearly* but not entirely independent of the
  list. The anchors are fixed, but `imputeMissingSubs()` fills unresearched sub-scores with the list
  mean, so the rows carrying one drift a little as rows are added. Every pass since 20 has moved at
  most three rows by one rounding point each, and the effect tracks **how far the list mean shifts,
  not how many rows are added** — pass 24 re-specified six rows and added none, and moved nothing
  incidentally at all. Small, but do not claim immunity. Each pass's actual figures are in its
  footer paragraph.
- **Step 2 — value (signed spec points).** `robustBaseline()` fits spec vs `ln(price)` with
  Theil–Sen (median pairwise slope, within movement class) and a **separate median intercept per
  class**. Each row's residual against that line is the `Value` badge; `Score` is the same number
  rescaled to 0–100 (`50 + residual * 2.8`) and sorts identically. This step *is* fitted to the
  list, so adding rows does move everyone's Value. `residualSigma` is currently ~5.3.

Guards worth knowing before touching either step:

- **`SUPPORT`** — `{ window: 0.40, min: 5 }`: a row with fewer than 5 other rows within ±0.40 in
  `ln(price)` shows `n/s` rather than being scored off an extrapolated curve. Two rows qualify
  today (16 and 56) — the two cheapest. Membership moves as the list grows: rows added together are
  each other's neighbours, so a pass can rescue an existing `n/s` row and strand its own priciest
  ones in their place, which is what pass 21 did and pass 22 then undid. Whatever sits at the end of
  the price range is always the thing with nothing to compare against, and the list is thin at
  **both** ends — the €400–900 stretch is its thickest part, while above €3,000 it holds almost
  nothing. Pass 32 is the worked example in both directions: it could not score two of the three
  rows it added at their list prices, and recording a grey price for each rescued both.
  **The guard applies to `effectivePrice()`**, so a second price moves a row's membership — and
  `listValue`'s second reading is support-tested separately, which is why rows 143 and 144 today
  carry a scored grey badge beside an `n/s` list badge. Each pass's figures are in its footer
  paragraph.
- **`PLAIN_TWIN` / `OUT_OF_SCOPE`** — the second refusal, and the sibling of `SUPPORT` above: where
  a row's plain twin scores more than ½σ above it, the price is buying something no criterion here
  measures and the badge reads `o/s` instead of a verdict. Two rows qualify today (134 and 135);
  105 is listed and falls short of the cut, which is the rule declining rather than firing. **It
  does not touch the fit** — those rows stay in the baseline and every validation figure is
  unchanged, so this is a display guard, not a model revision. Widening it into "any row that looks
  overpriced for reasons I like" is exactly what anchoring it on a maker-sold twin prevents; keep
  the trigger falsifiable.
- **`BANDS`** — colour is quantised at ½σ and 1½σ of the residual, deliberately, because the
  model's own resolution is ~4–6 spec points. Don't replace it with a continuous ramp.
- **`effectivePrice()` / `marketPrice`** — a row may carry a second, lower EUR price it can
  actually be bought at from someone other than the maker: `{ eur, kind, note }`, where `kind` is
  `'street'` (authorised dealer, full warranty) or `'grey'` (grey dealer, warranty usually not
  honoured). Seven rows carry one today — 13, 91, 92, 93, 142, 143 and 144 — and all seven are
  `'grey'`; no row carries a `'street'` price, and an unused `kind` is normal rather than a bug. A marketplace
  listing is grey even when it includes the papers: a warranty card only carries a warranty where
  an authorised dealer stamped it at first sale. **That price is the primary**
  — `effectivePrice()` returns it, and the Value/Score columns, the price sort and the price-range
  filter all read it. **The list price is not discarded:** `computeValueScores()` step 2b reads the
  *same fitted line* a second time at the list price and writes `w.listValue`, which renders as a
  second badge marked `list` and a second number in the Score cell. It is deliberately **not** a
  second row in the fit — one watch at two prices would let a row vote twice on the line measuring
  it — so recording a second price moves nothing but that row. A seller's markdown from its own
  stated UVP is *not* this mechanism — that goes in `priceValue` (see rows 87–89).
- **`validateModel()`** — leave-one-out plus 80% resampling, rendered into the footer. It is the
  closest thing here to a test suite.

### Missing data has two distinct meanings

This is the invariant the model is built around, and conflating the two has broken it before:

- `undefined` = the criterion **cannot apply** (quartz has no power reserve; a pocket watch has no
  lug-to-lug). Its weight is redistributed across the rest of the group by `blendSubs()`; a group
  with nothing applicable returns `null` and has its own weight redistributed across groups.
- `null` = the criterion **applies but hasn't been researched**. `imputeMissingSubs()` fills it
  with the mean of the rows where the answer is known, so researching a row has zero expected
  effect on its score — it moves on what is found, not on being looked at.

### Deliberately not scored

Weight, watch type, buying status, warranty, service network, movement cost and the Measured
accuracy column are all displayed but excluded from every score, each for a reason written out in
the code comment above it (mostly double-counting: e.g. estimated weight is a deterministic
function of diameter, thickness, case material and band, all already scored). Treat these as
decisions, not omissions — do not fold them into the score without being asked.

`STATUS` is excluded for a different and stronger reason than the rest: the Specs and Value columns
exist to say what a watch is worth *independently of whether it is wanted*, so a status feeding
either would turn the model into an echo of the shortlist. Say so before wiring it in, even if asked.

## Conventions

- **The footer records *why*; git records *what*.** Every model revision and research pass is
  written up in prose in the `<footer>` — what was wrong before, what the evidence was, what is
  still unresolved. That reasoning is irreplaceable and belongs there. The bare chronology of what
  changed when is git's job now; don't grow the footer with it. The model is on revision 3;
  research passes run to 34.
- **Footer paragraphs are dated snapshots, not live claims.** Do not retrofit them to current
  numbers — later passes explicitly refer back to earlier ones ("the earlier warning overstated
  the case"), and rewriting the earlier text destroys the correction it records. Live claims go in
  tooltips as `{{tokens}}`; historical ones stay put. Moving a paragraph verbatim is not retrofitting
  it, and is how the ordering below is repaired.
- **The footer is a head, a chronological spine, and a thematic tail.** Model revisions and early
  criterion research first, then the per-pass write-ups ascending by pass number, then the
  criterion-level research, ending with `Sources`. A new pass block goes at the end of the spine, and
  **a pass's paragraphs stay contiguous** — continuation paragraphs carry no pass number, so one left
  behind cannot be found again. `references/writing-it-up.md` has the detail and the two prose chains
  that make the order checkable.
- **A code comment states current state.** Anything historical is either explicitly marked or
  belongs in the footer or git. Every stale comment found so far had started narrating its own
  past.
- **Code comments carry the reasoning, not just the mechanics.** The long block comments above
  `GROUPS`, `MOVEMENT_TIER`, `COMPLICATION_VALUES`, `blendSubs()`, `robustBaseline()` and
  `effectivePrice()` record why a number is what it is and what evidence would change it. Keep that
  standard when editing them. They have drifted before — the `effectivePrice()` note claimed no row
  carried a second price long after three did, and the `gmt` complication definition described a mechanism no
  row in the list has — so treat a comment that contradicts the data as a bug, and correct it in
  the footer as well.
- **Estimates are labelled as estimates.** `FINISH`, `lume`, `clasp` and the weight column are
  judgement calls; the UI and tooltips say so. Preserve that when adding data.
- **Borrowed and inferred figures are labelled too.** Where an accuracy or weight figure comes from
  a sibling caliber or a different reference rather than the row's own source, the code comment
  says so. Don't quietly promote one to a published spec.
- **Unknown sorts last.** `compareWatches()` pushes `null` to the end regardless of direction.
- **Counts in prose are derived, not typed.** Row counts, the source tally and the Weight tooltip's
  coverage are `{{tokens}}`; adding a row updates them. The literals that remain are all dated
  figures inside footer paragraphs, which are snapshots and stay put. If you find yourself typing
  a number a later row would falsify, make it a `{{token}}` instead.
- **Filter options are derived, not typed.** The six categorical filters (status, brand, type,
  movement, case, glass) are dropdown panels of checkboxes built by `buildFilterPanels()` from
  `WATCHES` itself, ordered by `STATUS_LABELS` / `TYPE_ORDER` / `MOVEMENT_ORDER` / `CASE_ORDER` /
  `GLASS_ORDER` — brand is alphabetical and needs no array. They replaced hardcoded `<option>`
  lists that nothing tied to the data. A row with a new `caseCategory` therefore needs that value
  added to `CASE_ORDER`, and `selfCheck()` says so if it is not. Ticked options inside one filter
  are OR-ed, the filters are AND-ed together, and `type` alone carries an any/all switch because
  only it holds several values per row.
  `status` is the one dimension whose order array is a **fixed vocabulary rather than a derived
  set**: an unused status is normal, not a bug, so it is deliberately left out of `selfCheck()`'s
  orphan check and simply does not appear in the panel until a row carries it.
- **`EMPTY_ROW_COLSPAN`** is the single source for the empty-results `colspan`; `selfCheck()`
  compares it against the real `<th>` count in the browser.

## After changing prices or the model

Everything renders through **`renderAll()`**, which is called once at startup and once when the
live FX rate resolves. The order inside it is load-bearing and now lives in one place rather than
being written out twice:

```js
computeValueScores(WATCHES) → renderValidationNote() → renderBandLegend()
  → applyPipeline() → updateRateInfoDisplay() → renderSelfCheck(…, fillComputedFigures(…))
```

`renderBandLegend()`, `renderValidationNote()` and the `{{sigma}}` token all read `residualSigma`
off the watch objects, which only exists after `computeValueScores()` has run. `recomputePriceEUR()`
runs at module level and again before the second `renderAll()`; `captureFigureSlots()` must run
before the first one, while the `{{tokens}}` are still in the DOM.

Add a render step by editing `renderAll()` — never by duplicating the sequence.
