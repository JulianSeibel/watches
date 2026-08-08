# The row literal and the side tables

Everything a row needs, in the order you write it. Line numbers drift — grep the `// --- Name ---`
banner or the `const NAME = ` declaration instead.

## The row literal

Appended inside `WATCHES` immediately before the closing `];`, under a banner comment:

```js
// --- Brand Model, pass N (row X) -------------------------------------------------------------
{ id:X, brand:'Brand', name:'Brand Model (reference)', desc:'short descriptor · what distinguishes it',
  link:'https://maker.example/products/…',
  img:'https://maker.example/cdn/…jpg',
  diameterDisplay:'38 mm', diameterMm:38, l2lDisplay:'47 mm',
  heightDisplay:'13 mm', heightMm:13,
  caseDisplay:'316L stainless steel (unidirectional bezel, ceramic insert)', caseCategory:'Steel',
  bandDisplay:'Steel bracelet',
  glassDisplay:'Box-domed sapphire + AR', glassCategory:'Sapphire',
  movementDisplay:'Automatic — Sellita SW200-1 (Élaboré)', movementType:'Automatic',
  movementCostDisplay:'~$200 (Sellita, new)',
  powerReserveDisplay:'~38 h', accuracyDisplay:'±7 s/day',
  waterResDisplay:'200 m (20 ATM)', waterResM:200,
  priceDisplay:'€1,000', priceValue:1000, priceCurrency:'EUR' },
```

The authoritative field list is the `@typedef {Object} Watch` JSDoc directly above `const WATCHES`.
Read it — it documents each field's meaning and which are optional. 26 fields are mandatory.

### Field notes that are not obvious from the typedef

| Field | Rule |
|---|---|
| `id` | next integer. Contiguous 1..n, no gaps, never reordered — ids are the key into every side table |
| `desc` | the differentiator, not marketing. Name sibling references it could be confused with, as row 90 does with the M1.3.3 |
| `img` | direct image URL, hotlinked from the maker's CDN. `null` if none usable → renders the `🔗 photo` cell |
| `link` | the **exact SKU** being priced, not the model page. CW sell one reference across seven band options at a €200 spread; the row is scored on the band its own price buys |
| `diameterMm` / `heightMm` / `waterResM` | structured, used by the model. `heightMm` may be `null` if genuinely unpublished |
| `l2lDisplay` | display string only. `'—'` if unpublished; `'~44 mm*'` with the footnote if inferred |
| `heightDisplay` | if the maker gives only "excluding crystal", say both: `'13 mm (11 mm excl. crystal)'` |
| `caseDisplay` | put the bezel insert material here — it is the evidence for the `bezel` score |
| `movementCostDisplay` | loose parts-market price of the movement, or `'not sold separately (…)'`. Display only, not scored |
| `accuracyDisplay` | `'—'` when the maker publishes nothing. See the evidence rules below |

### `bandDisplay` is load-bearing, not prose

`predictedWeightG()` reads it with `/bracelet|milanese|mesh/.test(band) && !/opt\.|optional/.test(band)`.
A bracelet row gets a 62 g band allowance (38 g on titanium); anything else gets 12 g. So
`'Lizard-pattern TPU rubber (bracelet opt.)'` is a strap row and `'Steel bracelet'` is not, and
rewording it silently changes the weight estimate. Match the band the row's **price** buys.

### `movementDisplay` is a primary key

- **Exact** match into `MOVEMENT_TIER`. One character off — an em dash for a hyphen — and the row
  silently drops to `movementTierFor()`'s by-type fallback. `selfCheck()` catches this now, so run
  `node check.js` rather than reasoning about it.
- **Substring** match into `MEASURED_ACCURACY`, keyed on the caliber name. Keep the caliber name
  intact and spelled as the existing keys spell it.
- Say `caller GMT` or `true GMT` in the string when it is one — pass 18 made that split visible in
  the Movement column deliberately.

### Price

Three separate mechanisms; do not confuse them.

| Situation | What to do |
|---|---|
| Priced in EUR | `priceValue` = the number, `priceCurrency:'EUR'` |
| Priced in USD | `priceValue` in dollars, `priceCurrency:'USD'`. **Do not set `priceEUR`** — `recomputePriceEUR()` overwrites it from the live rate |
| Priced in HKD/INR | set `priceEUR` by hand with the conversion in an inline `/* */` comment (row 12 is the model) |
| Maker sells below its own stated UVP | selling price in `priceValue`, both in `priceDisplay`: `'€1079.20 (UVP €1349)'`. Rows 87–90 |
| A *retailer* discounts a maker's list price | `streetPriceEUR` alongside `priceValue`, with a `//` comment naming the shop. Rows 14, 15, 18 |

The difference: `priceValue` is what this row costs from the source it links to. `streetPriceEUR`
is the evidence that the market charges less than the linked list price. `effectivePrice()` prefers
`streetPriceEUR` when present.

## Evidence rules

These are rules the file has been bitten by, not preferences.

1. **The maker's own product page first.** Reviews and retailers only where the maker omits a field.
2. **An unpublished figure stays `'—'`.** Do not fill it with a movement family's generic tolerance.
   Passes 6, 13 and 15 each rejected exactly that: −5/+15 s/day is ETA's generic A31 tolerance and
   is not what Longines states for the L888.5; "milliseconds per day" is Timex marketing about
   quartz as a technology. An imputed blank is honest; a borrowed number that looks published is not.
3. **A borrowed or inferred figure is labelled in a `//` comment naming what it was borrowed from.**
   Row 90's accuracy is Sellita's Élaboré spec, not MAEN's, and the comment says so.
4. **The maker's statement about the watch in front of it beats the family figure.** Pass 14, row 52:
   Citizen give one rate for cal. 8210 on two references and a different one on a third; the row
   follows its own reference.
5. **One number cannot describe several different cases.** Vaer's "70.6 grams" appears verbatim on
   four different cases, so no Vaer row uses it. Same test rejected Seagull's 61 g for rows 87/88.
6. **A figure that cannot be reproduced from any source is removed, not kept.** Row 43's 183 g went
   because two sources disagreed by 26 g and the maker publishes neither.

## `EXTRAS` — required, every row

The long comment block above `const EXTRAS` defines every sub-field and its scale. Read it. Summary:

| Field | Scale |
|---|---|
| `lume` | 0–1. 1.0 = SLN X1; 0.8–0.9 = BGW9/C3 thick or multi-layer; 0.5 = unspecified SLN; 0.1–0.3 = minimal |
| `war` | warranty years. **Data only, not scored** |
| `iso` | 1 = ISO 6425 certified, else 0. Absence of the claim is a finding of 0, not a gap |
| `antimag` | 0 standard · 0.3 rated 4,800 A/m · 0.5 Nivachron · 1.0 rated 16,000 A/m |
| `clasp` | 0–1. 0.9 on-the-fly butterfly · 0.7–0.8 push-button w/ micro-adj or diver ext. · 0.5–0.6 basic foldover · 0.3–0.4 pin buckle |
| `service` | 0–1 parts/service network. **Data only, not scored** |
| `bezel` | 0–1 of the *rotating* bezel's material: 1.0 ceramic · 0.85 Duratect · 0.7–0.8 steel/sapphire · 0.5 lumed acrylic · 0.4 aluminium. **`null` = no functional bezel** — excluded, not penalised |
| `comp` | array of `COMPLICATION_VALUES` keys. Omit if none |
| `caseScore` | optional override where the category misleads (Swatch Bioceramic → 0.35) |

`clasp` follows the price: if the row is priced on the strap, it scores the strap's buckle even
where a bracelet exists. That rule cost the MAEN and Baltic rows 0.6–0.7 → 0.3 in pass 3.

The house comment style is a dense justification block above the entry. Row 90 is the standard:

```js
  // Row 90, MAEN Hudson 38 GMT MKII. lume 1.0: Super-LumiNova X1 on markers, hands, GMT tip and
  // a bezel pip, level with the MK5 on row 1. clasp 0.3: priced on the TPU strap with a pin
  // buckle; the deployant with on-the-fly adjustment belongs to the bracelet upgrade.
  // bezel 0.4 is the one soft number here and it is an inference from absence, not a source.
  // …
  // Listed as open in the footer.
  90:{lume:1.0,war:2,iso:0,antimag:0,clasp:0.3,service:0.5,bezel:0.4,comp:['gmt']},
```

Name the row you anchored each judgement against. A number with no comparison is not reviewable.

## `FINISH` — required, every row

One 0–1 estimate. Bands are in the comment above `const FINISH`:

```
1.00       hand-assembled manufacture finishing
0.65-0.75  premium industrial (Citizen Series 8, Seiko Presage Zaratsu-grade)
0.50-0.60  solid mainstream (Sinn, Certina, Tissot, Baltic)
0.35-0.45  competent microbrand
0.15-0.30  basic printed dial, moulded case
```

Comment it with a comparison to a named existing row, as row 90 does against row 1.

## `WATCH_TYPES` — required, every row

Array. Every value must already be in `TYPE_ORDER` or `selfCheck()` fails. A watch carries **every**
type that applies — the Seastar chronographs are Diver *and* Chronograph. Filter only, never scored.

## The four weight tables — exactly one, every row

Disjoint and total; `selfCheck()` enforces both. Pick by what you found:

| Table | Meaning | Shape |
|---|---|---|
| `WEIGHT_MEASURED` | maker (or a reproducible source) publishes a **with-band** figure for **this** reference on **this** band | `id: grams,  // caliber, band` |
| `WEIGHT_UNPUBLISHED` | you opened the page and it states no mass. **A finding, not a gap** | bare `id,` under a comment |
| `WEIGHT_UNRESOLVED` | the page could not be reached — 403, 404, timeout. A different claim from the above | id in the flat `new Set([…])` |
| `WEIGHT_HEAD_ONLY` | published without the band. Recorded, deliberately not used | `id: grams` |

The near-misses are the interesting part and the comment should record them: row 90 sits in
`WEIGHT_UNPUBLISHED` even though MAEN publish 129 g, because that is the bracelet figure and the row
is priced on the strap. Christopher Ward publish two figures per reference and this column takes
"Weight inc. Strap", never "Case Weight".

Adding to `WEIGHT_MEASURED` enlarges the estimator's held-out test set, which moves
`weightRmse`/`weightWithin15`/`weightMedianErr` in the Weight tooltip. That is expected — those are
`{{tokens}}`, so they update themselves; the footer should say the test set grew and by how much.

## `DISPLAY_BACK` — optional, three-state

`1` = see-through, `0` = confirmed solid, **absent = not researched**. `selfCheck()` requires any
value present to be exactly 1 or 0. Absent is legitimate and is the only side table a row may omit —
`imputeMissingSubs()` fills it with the list mean, so leaving it out costs nothing and guessing does.

## `MEASURED_ACCURACY` — optional

Keyed by a **caliber substring** of `movementDisplay`, so it applies to every row on that caliber.
Only add real-world reports, never a spec:

```js
'Miyota 90S5': { typ: 8, range: '5–11', conf: 'fair', note: 'No data specific to the 90S5; taken from the 9039, which shares the architecture' },
```

`conf` is `good` | `fair` | `weak`. En dashes are written as `–`. The `note` says where the
data came from and why the confidence is what it is. This column is displayed and **not scored**.

## `MOVEMENT_TIER`

Add a key **only if the exact `movementDisplay` string is new**. If the caliber is already in the
list, reuse the existing string verbatim and add nothing — row 90 needed no new tier because it
shares the SW330-2 string with the two Christopher Wards.

If it is new, see `new-vocabulary.md`.
