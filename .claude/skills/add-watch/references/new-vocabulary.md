# When the watch is the first of its kind

Read this only if the new row introduces something the list has never held. Each section lists
**every** place that must change and how to argue the number. `selfCheck()` catches most of these,
but it catches them as failures after the fact — the point of this file is to get them right first,
and it does not catch the two marked ⚠.

## New `caseCategory`

Three maps plus the filter order, all near each other:

| Where | What |
|---|---|
| `CASE_ORDER` | filter order, commonest-first. `selfCheck()` fails both directions |
| `CASE_SCORE` | 0–1 material **performance** — hardness, corrosion, weight |
| `DENSITY` | g/cm³, used by `predictedWeightG()` |

`CASE_SCORE` rates performance, **not desirability or cost**. Bronze (pass 17) is the precedent and
the comment above `CASE_SCORE` argues it in full: it lands at 0.45, just *below* steel's 0.5,
because CuSn8 is softer (120–150 HV against 150–200 HV) and oxidises on purpose. It is the more
expensive material and it is chosen deliberately — scoring it above steel would be scoring the
fashion for it. Make the equivalent argument in the comment, in those terms.

Where the category label misleads, override per row with `EXTRAS[id].caseScore` rather than bending
the category: Swatch "Bioceramic" filters as Ceramic but is a ceramic-bioplastic composite, so those
rows carry `caseScore: 0.35` against Ceramic's 1.0.

## New `glassCategory`

`GLASS_ORDER` (best-first on the `GLASS_SCORE` axis) and `GLASS_SCORE`. Same rule: scratch
resistance and optics, not cost.

## New `movementType`

`MOVEMENT_ORDER` only — and check `movementTierFor()`'s by-type fallback map, which has an entry per
type. A type missing there falls through to `?? 0.3`.

## New watch type

`TYPE_ORDER` only. Types are filter-only and never scored; the comment above `WATCH_TYPES` explains
why (it correlates hard with depth rating, bezel and lume, all already scored). Where the maker
states the intent, the maker wins.

## New complication tag

⚠ **Two places, and `selfCheck()` only catches one.**

1. `COMPLICATION_VALUES` — the points. `selfCheck()` fails on an unknown tag.
2. `COMP_LABELS` inside `valueTooltip()` — the human label. **Falls back silently to the raw key**,
   so a missing entry shows `power_reserve` in the tooltip and nothing reports it.

The comment above `COMPLICATION_VALUES` documents what each existing tag means and how the values
were calibrated (pass 8, regressing ln(price) on the other groups with a dummy per complication).
Two things it establishes that constrain a new value:

- Values are summed per watch then **capped at 1.0**, so no single complication reaches the ceiling.
- Market prices sanity-check the **order** of the values, never set them. The comment is explicit
  that fitting weights to price would shrink the residual the Value column exists to measure toward
  zero by construction. Move a fraction of the distance the market implies, and say why.

The `gmt` / `gmt_true` split is the worked example: a jumping local hour takes 0.5 plus +0.05 on the
movement tier; a caller GMT takes 0.25 and no tier bonus. A hand merely geared to the main time is
an AM/PM indicator and scores nothing.

## New `MOVEMENT_TIER` entry

Only when the exact `movementDisplay` string is new. Bands from the comment above the table:

```
1.00       full manufacture: own escapement and hairspring, hand-assembled
0.70-0.75  in-house from a major, decorated, high-spec (Citizen 0950/9051, Seiko 6R)
0.55-0.60  Swiss base or heavily reworked ebauche (LJP, Sellita, ETA 7001, Powermatic)
0.40-0.50  commodity mechanical, in-house-but-basic, or genuinely novel low-cost (SISTEM51)
0.30-0.35  ageing workhorse mechanical, meca-quartz
0.20-0.28  quartz: Swiss or complicated at the top, plain three-hand at the bottom
```

Hacking, hand-winding and regulation grade are folded **into** the value, never added as bonuses —
a bonus keyed on the text would reward the wording, not the watch. Add a trailing `//` comment
arguing the number against a named neighbour. Three precedents worth copying:

- **Do not pay twice for something already scored.** The Sellita SW200-2 Power+ sits at 0.60, level
  with the SW200-1 it replaces: it is a barrel redesign taking 38 h to 60–65 h, the escapement is
  untouched, and power reserve is already its own sub-score at 40% of the timekeeping group.
- **A tier is architecture, not marque.** The SW330-2 takes 0.60 for being 2892 lineage — the same
  reason Mido's A31.111 does — but gets none of the +0.05 a traveller GMT earns.
- **Different merits can rank level.** The SW300-1 COSC and the Longines L888.5 both sit at 0.65:
  per-unit third-party certification and a silicon hairspring are different kinds of evidence, and
  this column has no way to rank one above the other, so it does not pretend to.

## New brand → the Munich section

⚠ Nothing checks any of this. `<section class="stores">` is hand-researched prose.

1. **Research it.** The maker's own dealer directory first — that is the standard the green-marked
   sources in the section are held to; a shop's own brand list is second-best and is marked as such.
   The question is *authorised dealer in Munich*, not stock.
2. **File the brand.** Either into the store tables above (with the shop, address and source) or
   into the `<h3>Not available to handle in Munich</h3>` list with a one-line reason of the kind
   already there — "direct-to-consumer, no German stockist found", "showroom is in Stuttgart".
3. **A near miss is recorded, not dropped.** Poljot24 is an official Seagull dealer registered in
   Munich but is an online shop with no shop floor, so the Seagull rows count as unavailable *and*
   the reason is written down with a phone number.
4. **Fix the arithmetic.** The opening paragraph reads `<b>44 of the {{rowCount}} rows</b> … 42 of
   the remaining 46`. `{{rowCount}}` updates itself; the other three literals do not. The `<h3>`
   heading carries its own row count, and each `<li>` carries a per-brand count.
5. **An existing brand gaining a second row** still needs its `<li>` moved out of the "1 row each"
   grouping. Pass 20 missed exactly this and left MAEN in it.

The Munich counts are the one set of literals CLAUDE.md sanctions, because they are research and
cannot be computed. That is why they need a human sweep every time.
