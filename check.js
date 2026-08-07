#!/usr/bin/env node
//
// Runs the page's own self-check and model outside a browser:
//
//   node check.js
//
// Exits 0 if every invariant holds, 1 otherwise, so it can gate a commit. It deliberately does
// NOT restate the invariants — it loads watch-overviewnew.html, stubs enough of the DOM for the
// script to evaluate, and calls the page's selfCheck(). Two copies of an invariant is just a new
// place for them to disagree.
//
// It also prints the validation figures, which are the closest thing here to a regression test:
// if a change was not meant to touch the model and RMSE or skill moves, something is wrong.

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'watch-overviewnew.html');
const html = fs.readFileSync(FILE, 'utf8');
const script = html.slice(html.indexOf('<script>') + '<script>'.length, html.lastIndexOf('</script>'));

// --- Minimal DOM ------------------------------------------------------------------------------
// Enough for the script to evaluate and for captureFigureSlots()/renderSelfCheck() to no-op
// safely. The data and model halves touch none of it.
const noop = () => {};
const stub = new Proxy(function () {}, {
  get: (_, k) => (['textContent', 'innerHTML', 'value', 'title'].includes(k) ? ''
    : k === 'children' || k === 'childNodes' ? []
    : k === 'hidden' ? false : stub),
  set: () => true,
  apply: () => stub,
  has: () => true,
});
global.document = {
  querySelector: () => stub,
  querySelectorAll: () => [],
  getElementById: () => stub,
  createElement: () => stub,
  createTreeWalker: () => ({ nextNode: () => null }),
  addEventListener: noop,
  body: stub,
  title: '',
};
global.NodeFilter = { SHOW_TEXT: 4 };
global.window = { addEventListener: noop };
global.fetch = () => Promise.reject(new Error('offline: check.js never hits the network'));
global.AbortController = class { constructor() { this.signal = null; } abort() {} };
global.setTimeout = () => 0;
global.clearTimeout = noop;

// --- Evaluate the page's script ---------------------------------------------------------------
const page = {};
try {
  new Function('__exports', `${script}\n;Object.assign(__exports, {
    WATCHES, selfCheck, computeValueScores, validateModel, computedFigures, weightEstimatorStats,
  });`)(page);
} catch (err) {
  console.error('FAIL  the page script did not evaluate:\n' + err.stack);
  process.exit(1);
}

const { WATCHES, selfCheck, computeValueScores, validateModel, computedFigures } = page;
computeValueScores(WATCHES);

// --- Report ------------------------------------------------------------------------------------
const problems = selfCheck(WATCHES);
const v = validateModel(WATCHES);
const f = computedFigures(WATCHES);

console.log(`${WATCHES.length} rows · spec ${f.specMin}–${f.specMax} · sigma ${f.sigma} · ` +
            `${f.nsCount} n/s · ${f.weightPublished} published weights`);
if (v) {
  console.log(`model  LOO RMSE ${v.looRmse.toFixed(2)} vs naive ${v.naiveRmse.toFixed(2)} · ` +
              `skill ${(v.skill * 100).toFixed(1)}% · ${v.signFlips} sign flip(s) · ` +
              `resample typical ${v.resampleShift.toFixed(2)} worst ${v.resampleWorst.toFixed(2)}`);
}

if (!problems.length) {
  console.log('OK    all invariants hold');
  process.exit(0);
}
console.error(`FAIL  ${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
problems.forEach(p => console.error('  - ' + p));
process.exit(1);
