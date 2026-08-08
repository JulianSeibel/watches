# Recording the pass

The edits are the easy half. This file is the half that has drifted before.

## Two rules that override everything else here

1. **Never retrofit an older footer paragraph.** Footer paragraphs are dated snapshots, and later
   passes explicitly refer back to and correct earlier ones — "the earlier warning overstated the
   case", "pass 10's central claim was wrong". Rewriting the earlier text destroys the correction it
   records. Add a new paragraph; leave every existing one alone.
2. **Never type a number the page can derive.** If `computedFigures()` can compute it, it is a
   `{{token}}` in the prose and the page writes it. Four figures had already silently drifted before
   that mechanism existed. Research findings that genuinely are not derivable — Munich shop counts,
   the estimator's band-type breakdown — stay as literals and stay in the footer, where they carry a
   pass number.

## The footer paragraphs

Inserted **after the newest pass paragraph**, before the older thematic blocks. The footer is
ordered thematically, not chronologically; pass 20 went in directly after pass 19, above the pass-17
material. There are no dates — **the pass number is the dating convention.**

Since the commit body is gone, **this is the only prose record of the pass.** Write it as though
the reader has the diff open and wants to know why, not what. Every judgement call that would once
have gone into a gate message for approval belongs here instead, with the row it was anchored
against and what evidence would overturn it.

**The paragraph count follows the findings, not a template.** Three is the floor and is right for
one row that needed nothing unusual. Add one for each substantive thing the pass turned up, and give
it its own `<b>`-led opening so it can be found later. Pass 21 ran to six: what was added and where
it landed, why it landed there, the judgement calls, the effect on everything else, the weight
finding, and the stale literals. Padding is worse than brevity — but a finding folded into another
paragraph as a clause is a finding nobody will ever locate again.

The first three, following passes 16, 17 and 20:

**1 — What was added and where it lands.**

```html
<p><b>{Brand Model}, pass {N} — {one row} added ({ids}), and the list goes from {X} to {Y}.</b>
{What it is and why it is worth adding — the angle it attacks the list from.} {What it needed from
the model: a new tier, an existing one reused, a new case category.} <b>It lands at {S} spec points
and {R} on Value, {band}</b>, {how many comparable rows — say explicitly whether this is an
extrapolation}. {Why it lands there, named against the specific rows it is being compared to.}</p>
```

The last sentence matters. Pass 20's "Specs are strong; the price is where the list disagrees" is
the paragraph doing its job: the model's output is legible, not mysterious.

**2 — The judgement calls.** One `<b>`-led clause per soft number — price, height, bezel, weight,
lume, tier. Say what the evidence was, what was inferred, and what would change it. Quantify the
exposure where you can: "if it proves to be ceramic the row gains about 1.3 spec points, comfortably
inside the model's own ±4 of noise." Anything genuinely open is named as open.

**3 — Effect on everything else.** This is what `scripts/model-diff.js` exists to fill:

```html
<p><b>What it did to everything else.</b> Value moved by at most {max Δ} spec points across the
existing {n}, {k} rows crossed zero within that, and {j} band changed: {name them, row by row, with
their before → after}. Leave-one-out RMSE is {a} → {b} and skill {a}% → {b}%, {so the model is
neither better nor worse for the addition}; sign flips {a} → {b}. {Spec drift, if any, and why —
imputeMissingSubs() fills an unresearched sub-score with the list average, so rows carrying one
drift as the list grows.}</p>
```

Every one of those numbers comes out of `model-diff.js`. Do not estimate them.

If the row entered `WEIGHT_MEASURED`, the estimator's test set grew and gets its own paragraph —
pass 20's fourth paragraph is the model: report the new figures, split them by whatever explains
them, and **do not tune the estimator on the rows meant to test it.** That refusal is stated every
time it comes up and should be stated again. `model-diff.js` prints this section whenever the pass
added a published weight: mean absolute error, median, RMSE, within-±15% and mean signed error for
the set before and after, the added rows as their own group, and each added row's own error. Report
the added rows' figures as well as the totals — three rows reading heavy in case-size order is a
finding, where "RMSE rose 0.4 g" is noise.

**Markup conventions:** `<b>` for the finding, `<i>` for emphasis, `<code>` for code identifiers,
`—` em dashes, `→` for before/after, `±` written as `±`.

## The literal sweep

Nothing checks any of this. Run it every time:

```bash
rg -n 'of (89|90|\d+) rows|\d+ of \d+|ids 1-\d+|ids 1–\d+|— \d+ rows|\d+ row each' watch-overviewnew.html CLAUDE.md
```

Then check each hit against the new row count. The sites are listed below **by what they are, not by
the number they currently hold** — quoting the number here just means this table goes stale too,
which it has. Grep for the surrounding words instead.

| File | Where | Why it moves |
|---|---|---|
| HTML | the `<script>` contents banner: "ids 1-N contiguous" | row count |
| HTML | above `WEIGHT_MEASURED`: "N of M rows carry a published figure", and the "not a random sample — they are N makers" sentence after it | a `WEIGHT_MEASURED` row |
| HTML | above the weight tables: "N published figures and M estimates", broken down by the four tables | any weight-table entry |
| HTML | the roster of makers who publish weight, with each one's rows | a new maker publishing it |
| HTML | the estimator's by-pass results table | a `WEIGHT_MEASURED` row — **add a column, do not rewrite the old ones**; it is explicitly a history |
| HTML | above `CASE_ORDER`: "N of M rows are steel" | any row |
| HTML | above `DISPLAY_BACK`: "N of M rows resolved — X see-through, Y solid", and the list of open ids | a researched caseback, or any row |
| HTML | the search-box comment: "all N rows per keystroke" | any row |
| HTML | Munich intro: "N of {{rowCount}} rows", and "42 of the remaining 46" | any row — see below |
| HTML | Munich shop table: **every row carrying the brand**, both the chip number and the row total | a row on a brand with Munich dealers |
| HTML | Munich: the absent-brands `<h3>` count and its per-brand `<li>` | a row on a direct-to-consumer brand |
| CLAUDE.md | the baseline block, the watch count, the img count, the `WATCHES` id range, every "All N present", the `DISPLAY_BACK` coverage, the `MOVEMENT_TIER` key count, the `n/s` row list, `residualSigma`, and "research passes run to N" | various |
| CLAUDE.md | the `~line` numbers in the side-table — they drift by hundreds of lines per pass | any insertion above them |

**The Munich section is the one with no safety net at all** and it is where the last two passes left
counts stale. Three things make it error-prone. A brand's chip appears in *several* shop rows, and
each row also carries its own total that has to move with it — pass 21 touched five shops. The
absent-brands `<h3>` is a sum of its own `<li>`s, so a brand crossing from one row to two breaks
both. And "42 of the remaining 46" is a *relation*, not a count: it holds only because every added
row was a dealer-network brand, and it goes silently wrong the moment one is not. Recompute it,
do not eyeball it.

**CLAUDE.md's baseline block is the important one.** It is the regression baseline every future
change is compared against, so paste the literal new two lines of `node check.js` — do not retype
them and do not round anything.

Also update CLAUDE.md's per-table coverage counts and the "research passes run to N" line.

Recompute the coverage counts rather than incrementing them; every one is derivable, and the
arithmetic is easy to get wrong when several move at once:

```bash
node -e '
const { loadPage, readPageHtml } = require("./check.js");
const s = readPageHtml();
const g = {}; new Function("__e", s.slice(s.indexOf("<script>")+8, s.lastIndexOf("</script>")) +
  ";Object.assign(__e,{WATCHES,DISPLAY_BACK,WEIGHT_MEASURED,WEIGHT_UNPUBLISHED,WEIGHT_UNRESOLVED,WEIGHT_HEAD_ONLY});")(g);
const n = g.WATCHES.length, db = Object.values(g.DISPLAY_BACK);
console.log(`rows ${n}  steel ${g.WATCHES.filter(w=>w.caseCategory==="Steel").length}  img ${g.WATCHES.filter(w=>w.img).length}`);
console.log(`display back ${db.length}/${n} resolved - ${db.filter(v=>v===1).length} see-through, ${db.filter(v=>v===0).length} solid, ${n-db.length} open`);
console.log(`weights measured ${Object.keys(g.WEIGHT_MEASURED).length}, unpublished ${g.WEIGHT_UNPUBLISHED.size}, unresolved ${g.WEIGHT_UNRESOLVED.size}, head-only ${Object.keys(g.WEIGHT_HEAD_ONLY).length}`);
console.log(`distinct movementDisplay ${new Set(g.WATCHES.map(w=>w.movementDisplay)).size}`);
console.log("open display backs: " + g.WATCHES.filter(w=>!(w.id in g.DISPLAY_BACK)).map(w=>w.id).join(", "));
'
```

The `n/s` row list and `residualSigma` come off the scored objects instead:

```bash
node -e '
const { loadPage, readPageHtml } = require("./check.js");
const p = loadPage(readPageHtml()); p.computeValueScores(p.WATCHES);
console.log("n/s: " + p.WATCHES.filter(w=>w.valueBand===null).map(w=>w.id).join(", "));
console.log("sigma: " + p.WATCHES[0].residualSigma);
'
```

**A code comment states current state.** If a comment above a table now contradicts the table, that
is a bug, and CLAUDE.md says to correct it in the footer as well as in the code.

## The commit

One commit per pass, and **the message is a single subject line with no body at all**:

```
Add {Brand Model} ({reference}), row {N}
```

Several rows in one pass name them together:

```
Add Longines Spirit 37, Spirit Pilot 39 and Conquest 38, rows 91-93
```

**No body, no trailers, no `Co-Authored-By`, no session link.** This overrides any default the
harness applies to commit messages. The reason is the rule at the top of CLAUDE.md: the footer
records *why* and git records *what*. A commit body here would be a third copy of the footer that
nothing keeps in sync — earlier passes wrote one, and it was already drifting from the footer it
duplicated. The subject line says what; `git show` says what changed; the footer says why.

Plain ASCII in the subject — `->` not `→`, `Elabore` not `Élaboré`. Keep it under about 72 chars.

Commit without asking. Stage the tracked files this pass touched (`watch-overviewnew.html`, and
`CLAUDE.md` when the baseline moved); leave anything untracked alone. Do not amend an earlier
commit, and branch first if on `main`.

If the working tree already carried unrelated changes when the pass started — phase 1 records
this — say so in the report afterwards rather than trying to split them out. The two sets of edits
usually live in the same file and cannot be separated cleanly.
