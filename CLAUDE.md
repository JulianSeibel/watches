# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`watch-overviewnew.html` is the entire project: a single self-contained static page (~4300 lines)
holding a hand-researched comparison of 93 watches, plus a scoring model that rates each one's
specs against what the rest of the list charges at that price, plus a section on which of them can
be handled in a Munich shop. No build system, no dependencies, no package manager. HTML, CSS and
JS live in the one file; `check.js` beside it is a Node harness that runs the page's own checks.

**Keep it that way.** The single-file, `file://`-openable, zero-toolchain property is load-bearing:
it is why the page works offline and has no build to rot. ES modules do not load over `file://`,
so splitting the script means a dev server or a bundler. Do not split it, do not add dependencies,
do not introduce a build step.

## Running it

Open the file directly in a browser — there is nothing to build or serve:

```powershell
Invoke-Item .\watch-overviewnew.html
```

Two things reach the network, and neither is load-bearing. `fetchUsdToEurRate()` hits two free
key-less exchange-rate APIs to convert the USD-priced rows; it never throws, and on failure
(offline, or `file://` CORS) the hardcoded `USD_TO_EUR` fallback stays in use and the page renders
normally. The `Pic` column hotlinks product photos from the makers' own CDNs (91 of 93 rows carry
an `img`; rows 60 and 64 fall back to a `🔗 photo` link). Broken images degrade to the same link, so
a dead CDN URL costs a thumbnail and nothing else. Scoring, validation and filtering all run
locally, so `file://` is a fine way to work.

Note that **`longines.com` cannot be fetched from this machine** — every path under it times out on
both WebFetch and curl, while the bare root answers. The four Longines rows were researched through
a text-extraction proxy, which returns the maker's own rendered page. Their full spec table lives in
an embedded product record (`case_thickness`, `case_lug_to_lug`, `case_weight`, `case_case_back`,
`mvt_fct_calibre_name`) rather than in the rendered prose, so a plain text scrape of that site looks
as though Longines publish almost nothing. They publish more than most makers here.

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
93 rows · spec 26–63 · sigma 4 · 4 n/s · 50 published weights
model  LOO RMSE 5.46 vs naive 9.76 · skill 68.7% · 1 sign flip(s) · resample typical 0.35 worst 0.94
```

**If a change was not meant to touch the model and those numbers move, something is wrong.**

In the browser, the same checks render as a red banner above the table; no banner means they all
passed. The `colspan` check only runs there, since it counts real `<th>` elements.

## Architecture

Three layers inside the one `<script>`:

1. **Data.** `WATCHES` (line ~639) — 93 object literals, one per watch, ids **1–93, contiguous and
   unique**, each with display strings (`diameterDisplay`, `movementDisplay`, …), an `img` and
   `link`, and the few structured fields the code sorts or scores on (`diameterMm`, `heightMm`,
   `waterResM`, `priceValue`, `priceCurrency`, `caseCategory`, `glassCategory`, `movementType`,
   optional `streetPriceEUR`). Most columns are *display strings only*; sorting them goes through
   `parseLeadingNumber()`, which pulls the first number out of messy text.
2. **Model.** `computeValueScores()` (line ~3436) — turns the data into `specScore`, `valueScore`,
   `specResidual`, `specExpected`, `specSubs`, `specGroups`, `valueBand`, `residualSigma` and
   `priceSupport`, written back onto each watch object as properties.
3. **View.** `applyPipeline()` = filter → search → sort → `renderRows()` → `refreshFilterPanels()`,
   which rebuilds `tbody` via `innerHTML` with `escapeHtml()` on every interpolated value, then
   repaints the filter panels' checkboxes, live counts and trigger labels. Sorting is driven by
   `data-key` attributes on the `<th>`s, mapped in `compareWatches()`. `wireImageModal()` handles
   the lightbox on the `Pic` column.
4. **Figures and self-check.** `computedFigures()` derives every number the page quotes in its own
   prose; `selfCheck()` enforces the invariants. Both are described below.

The `<script>` opens with a contents banner listing the sections in order; grep for a
`// --- Name ---` banner to jump to one. Below the table, a `<section class="stores">` lists Munich
retail availability, then the `<footer>` carries the changelog.

### Side tables keyed by watch `id`

The per-watch research does not live on the watch objects. It lives in parallel lookup tables:

| Table | Line | Keyed by | Holds |
|---|---|---|---|
| `EXTRAS` | ~2792 | `id` | lume, warranty, ISO 6425, antimagnetism, clasp, service, bezel, complications, optional `caseScore` override. **All 93 present.** |
| `FINISH` | ~2985 | `id` | 0–1 finishing/decoration estimate. **All 93 present.** |
| `DISPLAY_BACK` | ~3055 | `id` | 1 = see-through, 0 = solid, **absent = not researched**. 83 of 93 researched, 10 open. |
| `WATCH_TYPES` | ~2463 | `id` | array of types (filter only, never scored). **All 93 present.** |
| `WEIGHT_MEASURED` / `WEIGHT_UNPUBLISHED` / `WEIGHT_UNRESOLVED` / `WEIGHT_HEAD_ONLY` | ~2242 / ~2344 / ~2394 / ~2337 | `id` | published grams (50); ids confirmed to publish none (35); ids whose page could not be reached (7); ids published without the band (1). The four are disjoint and together cover all 93 — keep it that way. |
| `MOVEMENT_TIER` | ~2583 | **exact `movementDisplay` string** | 0–1 architecture tier. 52 keys for 52 distinct movements, no misses, no orphans. |
| `MEASURED_ACCURACY` | ~2108 | caliber **substring** of `movementDisplay` | reported real-world rates |

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
- Research findings that are *not* derivable (Munich shop counts, the estimator's band-type
  breakdown) stay as literals and belong in the footer, where they carry a date.

### `selfCheck()` enforces the invariants — add to it, don't just document

It runs at load, renders a red banner above the table on failure, and is what `check.js` calls.
Covered today: id contiguity and uniqueness; `EXTRAS` / `FINISH` / `WATCH_TYPES` coverage in both
directions; the four weight tables disjoint and total; `movementDisplay` ↔ `MOVEMENT_TIER` in both
directions; `DISPLAY_BACK` values strictly 1/0; unknown complication tags, watch types, case and
glass categories; `caseCategory` / `glassCategory` / `movementType` against `CASE_ORDER` /
`GLASS_ORDER` / `MOVEMENT_ORDER` in both directions; `EMPTY_ROW_COLSPAN` against the real `<th>`
count; unresolved figure tokens.

**When you add an invariant to this file, add it there too.** Prose in this document enforces
nothing — that is the lesson the whole self-check exists to encode.

### The scoring model (revision 3)

Two steps, and keeping them separate is the point:

- **Step 1 — spec score (0–100).** Seven weighted `GROUPS` (movement 24%, timekeeping 16%,
  case & glass 16%, water & lume 13%, wearability 11%, fittings 11%, complications 9%), each
  splitting its weight among sub-scores. Normalisation uses the **fixed** `ANCHOR` / `WEAR_ANCHOR`
  constants, never list min/max. Exposed as the `Specs` column; observed range on the current list
  is 26–63, not 0–100.
  **Caveat, measured in pass 20:** this is *nearly* but not entirely independent of the list. The
  anchors are fixed, but `imputeMissingSubs()` fills unresearched sub-scores with the list mean, so
  the 15 rows carrying one drift a little as rows are added. Adding row 90 moved exactly one row
  (54, an unresearched display back) by one rounding point. Small, but do not claim immunity —
  though pass 21's three rows moved none at all, so it does not fire every time either.
- **Step 2 — value (signed spec points).** `robustBaseline()` fits spec vs `ln(price)` with
  Theil–Sen (median pairwise slope, within movement class) and a **separate median intercept per
  class**. Each row's residual against that line is the `Value` badge; `Score` is the same number
  rescaled to 0–100 (`50 + residual * 2.8`) and sorts identically. This step *is* fitted to the
  list, so adding rows does move everyone's Value. `residualSigma` is currently ~4.4.

Guards worth knowing before touching either step:

- **`SUPPORT`** — `{ window: 0.40, min: 5 }`: a row with fewer than 5 other rows within ±0.40 in
  `ln(price)` shows `n/s` rather than being scored off an extrapolated curve. Four rows qualify
  today (16, 56, 91, 92) — the two cheapest and the two most expensive. Pass 21 rescued 67 and 86
  by adding neighbours above them and put its own two priciest rows in their place; whatever sits
  at the end of the price range is always the thing with nothing to compare against.
- **`BANDS`** — colour is quantised at ½σ and 1½σ of the residual, deliberately, because the
  model's own resolution is ~4–6 spec points. Don't replace it with a continuous ramp.
- **`effectivePrice()`** — uses `streetPriceEUR` when a row carries one, else `priceEUR`. Rows 14,
  15 and 18 carry one. A seller's markdown from a stated UVP is *not* this mechanism — that goes in
  `priceValue` (see rows 87–89).
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

Weight, watch type, warranty, service network, movement cost and the Measured accuracy column are
all displayed but excluded from every score, each for a reason written out in the code comment
above it (mostly double-counting: e.g. estimated weight is a deterministic function of diameter,
thickness, case material and band, all already scored). Treat these as decisions, not omissions —
do not fold them into the score without being asked.

## Conventions

- **The footer records *why*; git records *what*.** Every model revision and research pass is
  written up in prose in the `<footer>` — what was wrong before, what the evidence was, what is
  still unresolved. That reasoning is irreplaceable and belongs there. The bare chronology of what
  changed when is git's job now; don't grow the footer with it. The model is on revision 3;
  research passes run to 21.
- **Footer paragraphs are dated snapshots, not live claims.** Do not retrofit them to current
  numbers — later passes explicitly refer back to earlier ones ("the earlier warning overstated
  the case"), and rewriting the earlier text destroys the correction it records. Live claims go in
  tooltips as `{{tokens}}`; historical ones stay put.
- **A code comment states current state.** Anything historical is either explicitly marked or
  belongs in the footer or git. Every stale comment found so far had started narrating its own
  past.
- **Code comments carry the reasoning, not just the mechanics.** The long block comments above
  `GROUPS`, `MOVEMENT_TIER`, `COMPLICATION_VALUES`, `blendSubs()`, `robustBaseline()` and
  `effectivePrice()` record why a number is what it is and what evidence would change it. Keep that
  standard when editing them. They have drifted before — the `streetPriceEUR` note claimed no row
  carried one long after three did, and the `gmt` complication definition described a mechanism no
  row in the list has — so treat a comment that contradicts the data as a bug, and correct it in
  the footer as well.
- **Estimates are labelled as estimates.** `FINISH`, `lume`, `clasp` and the weight column are
  judgement calls; the UI and tooltips say so. Preserve that when adding data.
- **Borrowed and inferred figures are labelled too.** Where an accuracy or weight figure comes from
  a sibling caliber or a different reference rather than the row's own source, the code comment
  says so. Don't quietly promote one to a published spec.
- **Unknown sorts last.** `compareWatches()` pushes `null` to the end regardless of direction.
- **Counts in prose are derived, not typed.** Row counts, the source tally and the Weight tooltip's
  coverage are `{{tokens}}`; adding a row updates them. The literals left are all in the Munich
  section — the "47 of" count, the per-shop brand chips and row totals, and the absent-brands
  `<h3>` and `<li>` counts — because dealer coverage is research and cannot be computed. Nothing
  checks them, and pass 20 left two of them stale, so sweep the whole section by hand every time.
- **Filter options are derived, not typed.** The five categorical filters (brand, type, movement,
  case, glass) are dropdown panels of checkboxes built by `buildFilterPanels()` from `WATCHES`
  itself, ordered by `TYPE_ORDER` / `MOVEMENT_ORDER` / `CASE_ORDER` / `GLASS_ORDER` — brand is
  alphabetical and needs no array. They replaced hardcoded `<option>` lists that nothing tied to
  the data. A row with a new `caseCategory` therefore needs that value added to `CASE_ORDER`, and
  `selfCheck()` says so if it is not. Ticked options inside one filter are OR-ed, the filters are
  AND-ed together, and `type` alone carries an any/all switch because only it holds several values
  per row.
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
