---
name: add-watch
description: Add one or more watches to watch-overviewnew.html from maker product links. Use when the user pastes a watch product URL and asks to add it, add a row, add a model, or run a new research pass on the comparison table. Covers the research protocol, the row literal, every side table and vocabulary, the model-effect measurement, the footer write-up and the commit.
user-invocable: true
argument-hint: <product-url> [more-urls…]
---

# Adding a watch

A row is not one edit. It is a row literal plus four mandatory side-table entries, up to six
vocabulary arrays, a set of hand-maintained prose literals, a footer write-up and a CLAUDE.md
baseline. `selfCheck()` catches about half of it and the other half fails silently — the last pass
left four counts stale.

Work through the phases in order, start to finish, **without stopping to ask.** Research, classify,
edit, measure, write up and commit in one pass. Do not present a proposal and wait for approval —
the reasoning belongs in the code comments and the footer, where it is durable, not in a chat
message that scrolls away. Report what you did when it is done.

The judgement calls are still the substance of this file. They are recorded rather than negotiated:
every soft number gets a comment naming the row it was anchored against, and the footer says what
would change it. That is what makes them reviewable after the fact.

Ask only when the work genuinely cannot proceed: a source that contradicts itself on a *scored*
field with no way to choose, or a duplicate SKU. Everything else — a debatable movement tier, a
lume estimate, whether a caseback is researched — is a call you make, comment, and move on from.

## Bundled references — read them when the phase says to, not before

| File | Read when |
|---|---|
| `references/row-and-tables.md` | phase 2, before writing any field. The field list, evidence rules, and every mandatory side table |
| `references/new-vocabulary.md` | phase 3, **only if** the row introduces a new case/glass/movement type, watch type, complication, movement tier, or brand |
| `references/writing-it-up.md` | phase 5. Footer style, the literal sweep, CLAUDE.md, the commit |
| `scripts/page-text.js` | phase 2. Run it; do not read it. Fetches raw source, caches it, probes it for spec fields, summarises Shopify product records |
| `scripts/model-diff.js` | phase 4. Run it; do not read it |

---

## Phase 1 — Orient

```bash
git status --short && git branch --show-current
node check.js
```

- Record the two `check.js` lines verbatim. That is the "before", and it must be green **now** — do
  not start on top of a broken tree.
- If on `main`, branch first.
- Read `CLAUDE.md` if it is not already in context. It governs this repo tightly and its rules
  outrank anything you would otherwise default to. In particular: single file, no build step, no
  dependencies.
- **Reject duplicates before doing any research.** Grep `WATCHES` for the brand and for the
  reference number. Sibling references are legitimate (the list holds nine Seastars) but the same
  SKU twice is not.
- Note the next free `id` and the next pass number. Pass numbers run in sequence; the highest one
  appears in the footer.

## Phase 2 — Research

Read `references/row-and-tables.md` first.

Fetch the maker's own product page for each link. That page is the primary source; reviews and
retailers are only for fields the maker omits, and anything taken from them is labelled as borrowed.

### Start with the raw source, not with a summarising fetch

**A markdown-converting fetch is the wrong first tool for a product page**, and pass 22 proved it on
five brands out of five: every one of them hid at least one *mandatory* field from it. Traska's
dimensions are a line drawing, Sinn's band prices are in a configurator widget, Oris's per-reference
prices are in a sibling page's variation list, Nomadic's water resistance is printed on the dial, and
Abinger's storefront renders client-side and carries no specs in its HTML at all. In each case the
answer was in the raw source or one hop from it, and the summarising fetch that came first was a
wasted round trip. Reverse the order:

```bash
node .claude/skills/add-watch/scripts/page-text.js <url> --probe
node .claude/skills/add-watch/scripts/page-text.js <url> --around "Technische Merkmale"
node .claude/skills/add-watch/scripts/page-text.js <url> --shopify
```

`--probe` greps the raw body for the field names makers actually use, in English and German, with
CSS filtered out and `<script>` blocks deliberately kept — which is where an embedded product record
lives. **No probe hits is a finding**, and a much stronger one than a search that came back empty.
Bodies are cached, so grepping the same page five ways costs one request. Use WebFetch afterwards
for pages that are genuinely prose — a review, a press release, a dealer directory.

`references/row-and-tables.md` carries a table of the site shapes seen so far and the route into
each. Check it before working out a new one.

**Batch the fetches per brand.** The research route is identical across one maker's references and
different across makers, so four Traska URLs in one batch cost barely more than one; four URLs from
four brands cost four discoveries. Do a brand at a time, all of it, before moving on.

Work the field list in the `@typedef {Object} Watch` JSDoc above `const WATCHES` — all 26 mandatory
fields, plus the side-table research: lume, warranty, ISO 6425, antimagnetism, clasp, bezel insert
material, complications, finishing, watch types, caseback, published weight.

The evidence rules in the reference are rules, not preferences. The two that get broken most:

- **An unpublished figure stays `'—'`.** Do not fill an accuracy field with the movement family's
  generic tolerance. Three separate passes rejected exactly that and said so in the footer.
- **The link is a specific SKU.** The row is scored on the band its own price buys — that decides
  `bandDisplay`, `clasp`, and which weight table it lands in.

### When the page will not load, exhaust the routes before calling it unresolved

A failed fetch is a finding and sends the row to `WEIGHT_UNRESOLVED` rather than
`WEIGHT_UNPUBLISHED` — but only once the page is genuinely unreachable, and a single tool timing
out does not establish that. Pass 21 hit this: WebFetch, curl and the browser all failed on
longines.com while the maker's own pages were perfectly reachable another way. Taken at the first
failure it would have filed three rows as unresolved and thrown away 26 fields per row of the
maker's own data. Work down the list and stop at the first that returns the page:

1. **WebFetch**, then again — the first timeout is often transient.
2. **curl with browser headers** (`-A`, `Accept-Language`, `Referer`) and a long `--max-time`.
   Probe the site root separately: a root that answers while every path times out is bot
   protection, not an outage, and means routes 3 and 4 are worth trying.
3. **The browser tools**, if the extension is connected.
4. **A text-extraction proxy**, which renders the page and returns it as text or HTML.

**What counts as still the maker's page:** the test is whose content it is, not how it arrived. A
different transport carrying the maker's own rendered page is a change of route and needs no
caveat. A retailer's spec table, a review, or a search snippet is a change of *source* and is
labelled borrowed. Say in the footer which route was used when it was not the obvious one.

Only after all four fail is the page unreachable. Then `WEIGHT_UNRESOLVED`, and do not substitute a
search result for a page you could not open.

### Before writing `'—'`, look in the page source

**"The maker publishes nothing" is a claim about the maker; "I could not find it" is a claim about
the search.** This file's whole evidence discipline rests on that difference, and its strictest
rule — an unpublished figure stays `'—'` — is what makes confusing the two expensive: a research
miss gets recorded as a permanent-looking finding, and later passes cite it.

Modern product pages hydrate from an embedded JSON payload, so the spec accordion's contents are in
the page source even when the rendered text shows empty headings. Longines were read as publishing
no weight by passes 6 and 13 for exactly this reason; they publish it for every reference, as
`case_weight`, alongside `case_thickness`, `case_lug_to_lug`, `case_case_back` and
`mvt_fct_calibre_name`. Two passes of research were lost to a rendering artefact.

So before recording any field as unpublished, search the **raw HTML** for the value and for plausible
key names — `scripts/page-text.js --probe` does exactly this and is why it exists. Attribute values
may be numeric ids resolved against an options table elsewhere in the same payload. This is not
scraping something the maker hid — it is the same spec table the page renders, read at source.

### One decisive source per field

Pass 22 read four Traska casebacks individually when the maker's own spec graphic said "individual
serial number on case back" for all four and two photographs had already confirmed it, and settled
one Oris bracelet three separate ways. Verification is cheap to add and easy to over-add. **Take one
decisive source per field and stop; reach for a second only when the first is contradicted** — which
does happen, and when it does the contradiction is itself a finding for the row comment (row 105).

## Phase 3 — Classify

Decide, and be able to say why for each:

1. `movementDisplay` — does the exact string already exist in `MOVEMENT_TIER`? Reuse it verbatim if
   so, and the tier needs no argument. If not, the row needs a new tier entry.
2. Which **one** of the four weight tables.
3. Is `caseCategory` / `glassCategory` / `movementType` / every watch type / every complication tag
   already in its order array and score map?
4. Is the brand already in the list, and is it already in the Munich section?

If any answer is "new", read `references/new-vocabulary.md` now. It lists every location each novelty
touches, including two that `selfCheck()` cannot catch.

Then find out whether the rows will be scored at all, **before** editing anything:

```bash
node .claude/skills/add-watch/scripts/model-diff.js --support 2750,2900,2250
```

Give it the EUR prices. It reports how many comparable rows each would have and whether it clears
`SUPPORT.min`. Worth knowing now rather than in phase 4 for two reasons. A row that comes back `n/s`
is not scored, so the footer's job changes from explaining where it landed to explaining why it
cannot land anywhere — and that is a paragraph, not a sentence. And rows added together are each
other's neighbours, so a pass can rescue existing `n/s` rows: pass 21's three rows pulled 67 and 86
back into scoring while two of its own stayed unscored, which was the most interesting thing about
it and would have been easy to report backwards.

## Phase 4 — Edit and measure

Make every edit now — row literals, side tables, vocabulary, the contents banner, the Munich
section. The checklist below is the list; work it.

**Every judgement call gets a comment where the value lives**, naming the existing row it is
anchored against and what evidence would change it. A number with no comparison is not reviewable,
and this is the only place that reasoning survives. The same goes for what is left unresearched,
what is inferred rather than sourced, and anything the sources contradicted each other on — all of
it goes in a comment, and the substantive ones go in the footer too.

### Before setting a soft number, name what else already pays for that property

This is the single most common way to get a score wrong here, and the codebase argues it over and
over — the SW200-2 Power+ is held level with the SW200-1 because power reserve is already its own
sub-score; the ST19 is not promoted for having a chronograph because complications pay for that;
weight is not scored at all because it is a function of four things the score already reads. The
reasoning is everywhere in the file and appears nowhere as a rule for *new* work, which is how it
gets missed. Two live traps:

- **A display back is `fittings.displayBack`**, 38% of that group. Raising `FINISH` because you can
  see the movement pays for the same window twice. Raise it only for decoration that is itself
  unusual — the Christopher Ward rows earned 0.65 on an engraved, Colimaçon-finished rotor, not on
  the fact of a window.
- **Regulation grade is inside `MOVEMENT_TIER`**, by that table's own header. A COSC row also
  carries a tighter `accuracyDisplay`, so the certification is visible in the timekeeping group too.
  That is accepted precedent (rows 85, 86), not a licence to add a third bonus somewhere.

Being unable to answer "what else scores this?" is the signal to leave the number where its anchor
row has it.

Then, in this order:

```bash
node check.js
```

Green, and the row count must have moved by exactly the number of rows added. If it fails, the
message names the table — fix it and re-run rather than reasoning about it.

```bash
node .claude/skills/add-watch/scripts/model-diff.js
```

Compares the working tree against `HEAD`. Prints the new row's spec score, residual, band and
comparable-row count; then, across the existing rows, the largest Value movement, how many changed
side of the curve, every band change by name, any spec drift; then the headline figures before and
after. `--all` lists every moved row. **These numbers go into the footer verbatim — do not estimate
them.**

Two things to read out of it rather than past:

- **Comparable rows.** If the new row shows `n/s`, it has fewer than five rows within ±0.40 in
  `ln(price)` and is deliberately not scored. Say so in the footer; do not treat it as a bug.
- **Spec drift.** Step 1 uses fixed anchors, but `imputeMissingSubs()` fills unresearched sub-scores
  with the list mean, so rows carrying one move slightly as the list grows. Expected, and worth a
  sentence if it changed a displayed number.

Then sweep the hand-maintained literals and update CLAUDE.md's baseline — the table in
`references/writing-it-up.md` lists every site with a grep to find them.

Finally, open the page in a browser and confirm there is no red banner above the table and the new
row renders with its image:

```powershell
Invoke-Item .\watch-overviewnew.html
```

That is the only place the `EMPTY_ROW_COLSPAN` check runs, since it counts real `<th>` elements.

## Phase 5 — Write up and commit

Read `references/writing-it-up.md`.

Write the footer paragraphs, then commit — do not show the message and wait. The message is a bare
subject line; everything worth saying is already in the footer.

Finally, report to the user in a few sentences: where the new rows landed, which existing rows
changed band, and any judgement call you would expect them to push back on. Name the call and where
you recorded it so they can go and read it.

---

## Checklist

Read this before starting phase 4 and again before the commit.

**Always**

- [ ] row literal in `WATCHES`, under a `// --- Brand Model, pass N (row X) ---` banner, before `];`
- [ ] all 26 mandatory fields; a `//` comment above every inferred or borrowed figure naming its source
- [ ] `EXTRAS[id]` with its justification block
- [ ] `FINISH[id]` with a comparison to a named row
- [ ] `WATCH_TYPES[id]`
- [ ] exactly one of `WEIGHT_MEASURED` / `WEIGHT_UNPUBLISHED` / `WEIGHT_UNRESOLVED` / `WEIGHT_HEAD_ONLY`
- [ ] `MOVEMENT_TIER` — reused verbatim, or a new entry with its argument
- [ ] `<script>` contents banner id range
- [ ] Munich section — nothing checks any of it, so walk all five sites (see `writing-it-up.md`):
      the "N of {{rowCount}}" count, **every shop row carrying the brand** (chip number *and* the
      row total beside it), the `<h3>` count and the per-brand `<li>`. Note the intro's second
      relation, "42 of the remaining 46": it stays true only when every added row is a
      dealer-network brand, and silently goes wrong when one is not.
- [ ] footer paragraphs, inserted after the newest pass, no existing paragraph touched
- [ ] CLAUDE.md baseline block + coverage counts + pass number
- [ ] stale in-file comment sweep

**If it applies**

- [ ] `DISPLAY_BACK[id]` — only if researched; strictly `1`/`0`; absent is legitimate
- [ ] `MEASURED_ACCURACY` — only real-world reports, keyed by caliber substring
- [ ] new `caseCategory` → `CASE_ORDER` + `CASE_SCORE` + `DENSITY`
- [ ] new `glassCategory` → `GLASS_ORDER` + `GLASS_SCORE`
- [ ] new `movementType` → `MOVEMENT_ORDER` (+ the fallback map in `movementTierFor()`)
- [ ] new watch type → `TYPE_ORDER`
- [ ] new complication → `COMPLICATION_VALUES` **and** `COMP_LABELS` in `valueTooltip()`
- [ ] non-EUR price handled per currency — never hand-set `priceEUR` on a USD row
- [ ] new brand → Munich dealer research

**Verify**

- [ ] `node check.js` green, row count moved by the expected amount
- [ ] `model-diff.js` run, and its numbers are the ones in the footer
- [ ] page opens with no red banner
- [ ] every `{{token}}` still resolves (`selfCheck()` reports any that do not)

## Things that will bite

- **Row ids are load-bearing.** Renumbering or reordering silently reassigns lume, finishing,
  casebacks and types to the wrong watches. Append; never insert.
- **`movementDisplay` is a primary key**, exact-match into `MOVEMENT_TIER` and substring into
  `MEASURED_ACCURACY`. An em dash changed to a hyphen moves a score.
- **`bandDisplay` wording drives the weight estimate** via a regex on `bracelet|milanese|mesh` and
  `opt\.|optional`.
- **`caseDisplay` wording can silently score the caseback.** `displayBackFor()` falls back to
  `/display back|exhibition/i` on `caseDisplay` when the row is absent from `DISPLAY_BACK` — so
  writing either phrase while deliberately leaving the row unresearched scores it **1**, quietly
  defeating the three-state rule. The fallback is asymmetric: it can only ever produce 1, never 0,
  so "screwed solid back" in `caseDisplay` does *not* record a solid back. If a row is meant to be
  unresearched, keep both phrases out of the string — pass 21's row 91 says "caseback not specified
  by Longines" for exactly this reason.
- **`undefined` and `null` mean different things.** `undefined` = the criterion cannot apply (quartz
  has no power reserve) and its weight is redistributed. `null` = it applies but was not researched,
  and it is imputed at the list mean. Conflating them has broken the model before.
- **Deliberately not scored:** weight, watch type, warranty, service network, movement cost, measured
  accuracy. Each has a reason written above it in the code. Do not fold them in.
- **Adding a row moves every existing Value.** Step 2 is fitted to the list. That is the model
  working, not a regression — but it must be measured and written up.
