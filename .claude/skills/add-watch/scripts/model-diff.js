#!/usr/bin/env node
//
// What adding a row did to every other row:
//
//   node .claude/skills/add-watch/scripts/model-diff.js [--base <rev>] [--all]
//   node .claude/skills/add-watch/scripts/model-diff.js --support 2750,2900,2250
//
// The --support form is the odd one out and runs BEFORE any edit: it takes the EUR prices you are
// about to add and says how many comparable rows each would have, i.e. whether it would be scored
// or shown as n/s. Nothing else here answers that until the row is already in the file, and the
// answer changes what the footer has to say, so it is worth knowing in phase 3 rather than 4.
//
// Step 2 of the model is fitted to the list, so a new row moves every existing row's Value. The
// footer is expected to say by how much - "Value moved by at most 0.20 spec points, four rows
// crossed zero, one band changed" - and check.js only prints headline figures. This prints the
// per-row half.
//
// It loads watch-overview.html twice, once from a git revision (default HEAD, i.e. before the
// edits in the working tree) and once from the working tree, runs the page's own
// computeValueScores() on each, and diffs. It borrows check.js's loader rather than re-stubbing
// the DOM, and it restates no invariant and no model constant - every number below comes out of
// the page.
//
// Exit code is 0 whenever the comparison ran. A moved number is a finding to write up, not a
// failure; `node check.js` is the thing that gates a commit.

const { execFileSync } = require('child_process');
const path = require('path');
const { loadPage, readPageHtml, FILE } = require('../../../../check.js');

const REPO = path.dirname(FILE);
const REL = path.basename(FILE);

const argv = process.argv.slice(2);
const showAll = argv.includes('--all');
const baseIdx = argv.indexOf('--base');
const BASE = baseIdx !== -1 ? argv[baseIdx + 1] : 'HEAD';
if (baseIdx !== -1 && !BASE) {
  console.error('--base needs a revision, e.g. --base HEAD~1');
  process.exit(2);
}

// --- Support preview (--support) ---------------------------------------------------------------
// Runs against the working tree alone; no git, no diff. SUPPORT and effectivePrice come out of the
// page rather than being restated here, so this cannot drift from what the model actually does.
// Each proposed price is tested against the existing rows AND against the other proposed prices,
// because rows added in one pass are each other's neighbours - which is exactly how three Longines
// rows in pass 21 rescued two existing n/s rows while leaving two of their own unscored.
const supIdx = argv.indexOf('--support');
if (supIdx !== -1) {
  const prices = String(argv[supIdx + 1] ?? '').split(',').map(s => Number(s.trim())).filter(n => n > 0);
  if (!prices.length) {
    console.error('--support needs one or more EUR prices, e.g. --support 2750,2900,2250');
    process.exit(2);
  }
  const page = loadPage(readPageHtml());
  const { WATCHES, computeValueScores, SUPPORT, effectivePrice } = page;
  computeValueScores(WATCHES);
  const existing = WATCHES.map(effectivePrice).filter(p => typeof p === 'number' && p > 0);

  console.log(`support window ±${SUPPORT.window} in ln(price), minimum ${SUPPORT.min} other rows`);
  console.log(`${existing.length} priced rows in the tree`);
  console.log('run this BEFORE adding the rows - afterwards each one counts itself as a neighbour\n');
  for (const p of prices) {
    const others = existing.filter(q => Math.abs(Math.log(q) - Math.log(p)) <= SUPPORT.window).length;
    const siblings = prices.filter(q => q !== p && Math.abs(Math.log(q) - Math.log(p)) <= SUPPORT.window).length;
    const total = others + siblings;
    const lo = Math.round(p / Math.exp(SUPPORT.window));
    const hi = Math.round(p * Math.exp(SUPPORT.window));
    console.log(`  €${String(p).padEnd(7)} window €${lo}–€${hi}  ` +
                `${String(others).padStart(3)} existing + ${siblings} sibling = ${String(total).padStart(3)}  ` +
                `→ ${total >= SUPPORT.min ? 'scored' : 'n/s'}`);
  }
  console.log('\nA row shown n/s is the guard working, not a bug. Say so in the footer.');
  console.log('Rows this pass adds also become neighbours for EXISTING rows - check whether any');
  console.log('current n/s row is rescued, since that is a finding the footer should carry.');
  process.exit(0);
}

// --- Load both sides ---------------------------------------------------------------------------

function scoreOf(html, label) {
  let page;
  try {
    page = loadPage(html);
  } catch (err) {
    console.error(`the page script from ${label} did not evaluate:\n${err.stack}`);
    process.exit(2);
  }
  const { WATCHES, computeValueScores, validateModel, computedFigures,
          WEIGHT_MEASURED, predictedWeightG } = page;
  computeValueScores(WATCHES);
  // The estimator's held-out test set is exactly WEIGHT_MEASURED, so adding a published weight
  // enlarges it. computedFigures() carries the three numbers the Weight tooltip renders; the
  // footer template also asks for mean absolute error and for the new rows' own errors, which is
  // why the per-row records are rebuilt here from the page's own predictedWeightG().
  const weights = Object.entries(WEIGHT_MEASURED ?? {}).flatMap(([id, published]) => {
    const w = WATCHES.find(x => x.id === Number(id));
    const estimated = w ? predictedWeightG(w) : null;
    if (!Number.isFinite(estimated) || !(published > 0)) return [];
    return [{ id: Number(id), published, estimated, pct: (estimated - published) / published * 100 }];
  });
  // Snapshot into plain records: computeValueScores() writes back onto the watch objects, and the
  // second load must not be able to disturb the first.
  const rows = new Map(WATCHES.map(w => [w.id, {
    id: w.id,
    name: `${w.name}`,
    spec: w.specScore,
    residual: w.specResidual,
    band: w.valueBand ? w.valueBand.label : null,
    support: w.priceSupport,
  }]));
  return { rows, weights, v: validateModel(WATCHES), f: computedFigures(WATCHES) };
}

let baseHtml;
try {
  baseHtml = execFileSync('git', ['-C', REPO, 'show', `${BASE}:${REL}`], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
} catch (err) {
  console.error(`could not read ${REL} at ${BASE}: ${err.message.trim()}`);
  process.exit(2);
}

const before = scoreOf(baseHtml, BASE);
const after = scoreOf(readPageHtml(), 'the working tree');

// --- Compare -----------------------------------------------------------------------------------

const added = [...after.rows.values()].filter(r => !before.rows.has(r.id));
const removed = [...before.rows.values()].filter(r => !after.rows.has(r.id));
const common = [...after.rows.values()].filter(r => before.rows.has(r.id))
  .map(r => ({ now: r, was: before.rows.get(r.id) }));

const num = v => (typeof v === 'number' ? v : null);
const dResidual = ({ was, now }) => {
  const a = num(was.residual), b = num(now.residual);
  return a == null || b == null ? null : b - a;
};

const moved = common
  .map(c => ({ ...c, d: dResidual(c) }))
  .filter(c => c.d != null && Math.abs(c.d) > 1e-9)
  .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));

// Which side of the curve a row sits on, at the resolution the page actually shows: specResidual
// is rounded to 0.1, so a row landing on 0.0 is displayed as sitting ON the curve and that counts
// as a change of side. This is the definition pass 20's "four rows crossed zero" was counted under
// - all four of those went to or from an exact 0.0 rather than straight through it.
const crossed = common.filter(c => {
  const a = num(c.was.residual), b = num(c.now.residual);
  return a != null && b != null && Math.sign(a) !== Math.sign(b);
});

const bandChanged = common.filter(c => c.was.band !== c.now.band);
const specMoved = common
  .map(c => ({ ...c, d: num(c.now.spec) - num(c.was.spec) }))
  .filter(c => Number.isFinite(c.d) && c.d !== 0)
  .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));

// --- Report ------------------------------------------------------------------------------------

const f2 = n => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(2);
const ids = a => a.map(c => (c.now ?? c).id).join(', ');
const nameOf = c => `${String((c.now ?? c).id).padStart(3)}  ${(c.now ?? c).name}`;
const arrow = (a, b) => (String(a) === String(b) ? `${a} (unchanged)` : `${a} → ${b}`);

console.log(`base   ${BASE}  ${before.rows.size} rows`);
console.log(`tree   ${REL}  ${after.rows.size} rows`);

if (added.length) {
  console.log(`\nnew rows (${added.length})`);
  for (const r of added) {
    console.log(`  ${nameOf(r)}`);
    const band = r.band ?? 'n/s — too few comparable prices to score';
    console.log(`       spec ${r.spec} · residual ${r.residual == null ? '—' : f2(r.residual)} ` +
                `· ${band} · ${r.support} comparable rows`);
  }
}
if (removed.length) {
  console.log(`\nrows no longer present (${removed.length})`);
  removed.forEach(r => console.log(`  ${nameOf(r)}`));
}

console.log(`\nexisting rows (${common.length})`);
if (!moved.length) {
  console.log('  no Value moved');
} else {
  const worst = moved[0];
  console.log(`  max |Δ residual|   ${Math.abs(worst.d).toFixed(2)}   row ${worst.now.id}  ${worst.now.name}`);
  console.log(`  rows that moved   ${moved.length} of ${common.length}`);
  console.log(`  changed side      ${crossed.length}   (0.0 = on the curve counts as a side)`);
  crossed.forEach(c => console.log(`      ${nameOf(c)}   ${c.was.residual} → ${c.now.residual}`));
}
console.log(`  band changes      ${bandChanged.length}`);
for (const c of bandChanged) {
  console.log(`      ${nameOf(c)}`);
  console.log(`           ${arrow(c.was.band ?? 'n/s', c.now.band ?? 'n/s')}`);
}
if (specMoved.length) {
  console.log(`  spec drift        ${specMoved.length} row(s), max ${f2(specMoved[0].d)}   ` +
              `— imputeMissingSubs() fills unresearched sub-scores with the list mean`);
  specMoved.forEach(c => console.log(`      ${nameOf(c)}   ${c.was.spec} → ${c.now.spec}`));
} else {
  console.log('  spec drift        none');
}

if (showAll && moved.length) {
  console.log('\nevery moved row, largest first');
  moved.forEach(c => console.log(`  ${nameOf(c)}   ${f2(c.was.residual)} → ${f2(c.now.residual)}   ` +
                                 `(${f2(c.d)})`));
}

console.log('\nheadline');
const row = (label, a, b) => console.log(`  ${label.padEnd(14)}${arrow(a, b)}`);
row('sigma', before.f.sigma, after.f.sigma);
row('spec range', `${before.f.specMin}–${before.f.specMax}`, `${after.f.specMin}–${after.f.specMax}`);
row('spec/price r', before.f.specPriceCorr, after.f.specPriceCorr);
row('n/s rows', before.f.nsCount, after.f.nsCount);
if (before.v && after.v) {
  row('LOO RMSE', before.v.looRmse.toFixed(2), after.v.looRmse.toFixed(2));
  row('naive RMSE', before.v.naiveRmse.toFixed(2), after.v.naiveRmse.toFixed(2));
  row('skill', `${(before.v.skill * 100).toFixed(1)}%`, `${(after.v.skill * 100).toFixed(1)}%`);
  row('sign flips', before.v.signFlips, after.v.signFlips);
  row('resample', `${before.v.resampleShift.toFixed(2)}/${before.v.resampleWorst.toFixed(2)}`,
                  `${after.v.resampleShift.toFixed(2)}/${after.v.resampleWorst.toFixed(2)}`);
}
if (before.f.weightPublished != null || after.f.weightPublished != null) {
  row('pub. weights', before.f.weightPublished, after.f.weightPublished);
  row('weight RMSE', `${before.f.weightRmse} g`, `${after.f.weightRmse} g`);
  row('weight med.', `${before.f.weightMedianErr}%`, `${after.f.weightMedianErr}%`);
  row('within 15%', `${before.f.weightWithin15}/${before.f.weightPublished}`,
                    `${after.f.weightWithin15}/${after.f.weightPublished}`);
}

// --- Weight estimator, in the terms the footer asks for ----------------------------------------
// Only when the pass actually put a row into WEIGHT_MEASURED. The estimator getting WORSE on a
// bigger test set is the normal outcome and is a finding to write up, never a reason to retune -
// fitting it on the rows meant to test it would leave no way to know whether the other estimates
// are any good. That refusal is stated in the page and should be restated in the footer.
const newWeights = after.weights.filter(w => !before.weights.some(b => b.id === w.id));
if (newWeights.length) {
  const mae = a => a.reduce((t, r) => t + Math.abs(r.pct), 0) / a.length;
  const signed = a => a.reduce((t, r) => t + r.pct, 0) / a.length;
  const rmseG = a => Math.sqrt(a.reduce((t, r) => t + (r.estimated - r.published) ** 2, 0) / a.length);
  const median = a => [...a].map(r => Math.abs(r.pct)).sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const within = a => a.filter(r => Math.abs(r.pct) <= 15).length;
  const line = (label, a) => console.log(
    `  ${label.padEnd(14)}n ${String(a.length).padStart(3)}   MAE ${mae(a).toFixed(1)}%   ` +
    `median ${median(a).toFixed(1)}%   RMSE ${rmseG(a).toFixed(1)} g   ` +
    `within15 ${within(a)}/${a.length}   signed ${signed(a) >= 0 ? '+' : ''}${signed(a).toFixed(1)}%`);

  console.log('\nweight estimator (test set = WEIGHT_MEASURED; + signed = reads heavy)');
  if (before.weights.length) line('before', before.weights);
  line('after', after.weights);
  line('added rows', newWeights);
  console.log('\n  the added rows individually');
  for (const w of newWeights.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))) {
    const name = after.rows.get(w.id)?.name ?? '';
    console.log(`      ${String(w.id).padStart(3)}  published ${w.published} g   ` +
                `estimated ${w.estimated.toFixed(0)} g   ` +
                `${w.pct >= 0 ? '+' : ''}${w.pct.toFixed(1)}%   ${name}`);
  }
}
