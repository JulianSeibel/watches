#!/usr/bin/env node
//
// Fetch a maker's page and read what is ACTUALLY in it:
//
//   node .claude/skills/add-watch/scripts/page-text.js <url> [<url>...] [options]
//
//   --probe [words]   grep the RAW body for spec field names and print every hit with context.
//                     This is the phase-2 rule made runnable: "the maker publishes nothing" is a
//                     claim about the maker, "I could not find it" is a claim about the search.
//                     Default word list covers weight/thickness/lug/water/crystal/caliber/lume.
//   --grep <regex>    grep the raw body for your own pattern instead
//   --around <regex>  print de-tagged text starting at the first match (default 60 lines)
//   --lines <n>       how much --around prints, and how much of the page prints by default
//   --raw             print the raw body instead of de-tagged text
//   --shopify         also fetch <url>.json and summarise title, variants, prices and images
//   --lang <tag>      send an Accept-Language header (e.g. de-DE). OFF by default on purpose —
//                     see the presentment-currency warning under --shopify below
//   --fresh           ignore the cache and refetch
//
// Why this exists. Every brand researched in pass 22 hid at least one MANDATORY field from a
// markdown-converting fetch: Traska's dimensions are a drawing, Sinn's band prices are in a
// configurator widget, Oris's per-reference prices are in a sibling page's variation list,
// Nomadic's water resistance is printed on the dial, and Abinger's Square storefront renders its
// specs client-side and carries none in the HTML at all. In every case the answer was in the raw
// source or one hop away, and the WebFetch that came first was wasted. So: raw source FIRST, and
// only reach for a prose-summarising fetch when the page is genuinely prose.
//
// Bodies are cached under the OS temp dir and the path is printed, so grepping the same page five
// different ways costs one request. Nothing here is watch-specific and nothing restates a spec.

const fs = require('fs');
const os = require('os');
const path = require('path');

const CACHE = path.join(os.tmpdir(), 'add-watch-pages');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// The fields a row literal needs, as makers actually spell them. Hits here are the difference
// between a researched '—' and a missed one.
const DEFAULT_PROBE = [
  'weight', 'gewicht', 'gramm', 'grams',
  'thickness', 'height', 'hoehe', 'höhe', 'gesamthöhe',
  'lug.to.lug', 'lug to lug', 'l2l', 'anstoss', 'anstoß', 'interhorn',
  'water.resist', 'wasserdicht', 'wr[: ]', 'atm\\b', 'bar\\b', '\\d{2,3}\\s*m\\b',
  'sapphire', 'saphir', 'crystal', 'deckglas', 'case.?back', 'boden', 'exhibition',
  'calibre', 'caliber', 'kaliber', 'movement', 'werk\\b',
  'power.reserve', 'gangreserve', 'accuracy', 'ganggenauigkeit', 'tolerance',
  'lumin', 'lume\\b', 'leuchtfarbe', 'bezel', 'drehring', 'clasp', 'schliesse', 'schließe',
];

function usage(code) {
  console.error(fs.readFileSync(__filename, 'utf8')
    .split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
  process.exit(code);
}

// --- args -------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) usage(argv.length ? 0 : 2);

function opt(name, fallback) {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
}
const flag = name => argv.includes(name);

const urls = argv.filter((a, i) => /^https?:\/\//.test(a) && argv[i - 1] !== '--grep' && argv[i - 1] !== '--around');
if (!urls.length) { console.error('page-text.js: no URL given\n'); usage(2); }

const probe = flag('--probe') ? (typeof opt('--probe', true) === 'string'
  ? String(opt('--probe')).split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_PROBE) : null;
const grepRe = typeof opt('--grep', null) === 'string' ? new RegExp(opt('--grep'), 'i') : null;
const aroundRe = typeof opt('--around', null) === 'string' ? new RegExp(opt('--around'), 'i') : null;
const maxLines = Number(opt('--lines', 60)) || 60;

// --- fetch, with a cache ------------------------------------------------------------------------
function cachePath(url) {
  const safe = url.replace(/^https?:\/\//, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 150);
  return path.join(CACHE, safe + '.body');
}

async function body(url) {
  const file = cachePath(url);
  if (!flag('--fresh') && fs.existsSync(file)) return { text: fs.readFileSync(file, 'utf8'), file, cached: true };
  fs.mkdirSync(CACHE, { recursive: true });
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      ...(typeof opt('--lang', null) === 'string' ? { 'Accept-Language': opt('--lang') } : {}),
      'Referer': new URL(url).origin + '/',
    },
  });
  const text = await res.text();
  fs.writeFileSync(file, text);
  if (!res.ok) console.error(`  ! HTTP ${res.status} — body saved anyway, it is often still the page`);
  return { text, file, cached: false, status: res.status };
}

// --- de-tagging ---------------------------------------------------------------------------------
const ENTITIES = {
  nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', euro: '€', pound: '£',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  eacute: 'é', deg: '°', reg: '®', trade: '™', copy: '©', hellip: '…', mdash: '—', ndash: '–',
};

function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => (n in ENTITIES ? ENTITIES[n] : m));
}

// Strips script/style, turns every tag into a line break, decodes entities, drops repeats. The
// repeat-dropping is what makes a nav-heavy maker page readable — the menu is the same 200 links
// on every page and it is never the spec table.
function detag(html) {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, '\n');
  const seen = new Set();
  return decode(stripped).split('\n')
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => s.length > 1 && !seen.has(s) && (seen.add(s), true));
}

// --- Shopify sidecar ------------------------------------------------------------------------------
// Shopify stores expose the product record at <product-url>.json: title, every variant with its
// price and availability, and every image URL. Traska and Nomadic both answered this in pass 22
// and it is strictly better than reading prices out of rendered HTML.
//
// TWO TRAPS, both found by running this against pass 22's own rows:
//
//   `price` has NO CURRENCY FIELD. It is whatever the storefront decided to present to this
//   request, and market-aware stores decide on Accept-Language. Traska returns 700.00 with no
//   language header and 614.95 with de-DE — the same watch, auto-converted at roughly the live
//   rate. That is why --lang is off by default: what comes back unprompted is the maker's own
//   listing currency, which is what priceValue/priceCurrency are supposed to hold. A converted
//   figure frozen into the file would drift; recording USD and letting recomputePriceEUR() do the
//   conversion does not. Confirm the currency from the rendered page before writing the row.
//
//   `grams` / `weight` / `weight_unit` on a variant are the SHIPPING weight of the packed parcel,
//   not the watch. Traska's Summiteer reports 454 g / 1 lb. This is never a WEIGHT_MEASURED
//   figure, and a row whose only "published" mass is this one belongs in WEIGHT_UNPUBLISHED.
async function shopify(url) {
  const jsonUrl = url.replace(/[?#].*$/, '').replace(/\.json$/, '') + '.json';
  const { text } = await body(jsonUrl);
  let p;
  try { p = JSON.parse(text).product; } catch { console.log('  (no Shopify product record here)'); return; }
  if (!p) return;
  console.log(`  title    ${p.title}`);
  console.log(`  handle   ${p.handle}   vendor ${p.vendor}`);
  for (const v of p.variants) console.log(`  variant  ${v.title} = ${v.price}${v.available === false ? ' (sold out)' : ''}`);
  console.log('  ! price has no currency field — it is the presentment currency for THIS request.');
  console.log('    Confirm it against the rendered page; do not freeze a converted figure into the row.');
  if (p.variants.some(v => v.grams || v.weight)) {
    console.log('  ! this record carries grams/weight — that is the SHIPPING weight of the parcel,');
    console.log('    not the watch. Never a WEIGHT_MEASURED figure.');
  }
  for (const i of p.images) console.log(`  image    ${i.src}`);
}

// --- output ---------------------------------------------------------------------------------------
// CSS is the enemy of a spec probe: "font-weight" and "line-height" match a weight/height search on
// every page ever built, and a Nuxt or Shopify page inlines tens of kilobytes of it. Style blocks go
// before probing; SCRIPT blocks deliberately do NOT, because that is where the embedded product
// record lives — case_weight, case_thickness and case_lug_to_lug on longines.com are inside one.
const CSS_NOISE = /font-weight|line-height|letter-spacing|font-style|font-family|stroke-width|border-width|[a-z-]+-width\s*:|@media|\.vjs|--[a-z-]+\s*:/i;

function probeRaw(html, words) {
  const searchable = html.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const re = new RegExp(`.{0,60}(?:${words.join('|')}).{0,90}`, 'gi');
  const hits = [...new Set((searchable.match(re) || []).map(s => decode(s).replace(/\s+/g, ' ').trim()))]
    .filter(h => !CSS_NOISE.test(h));
  if (!hits.length) {
    console.log('  (no probe hits outside CSS — that is evidence of absence, and worth recording as one)');
    return;
  }
  console.log(`  ${hits.length} probe hit(s):`);
  for (const h of hits) console.log('    ' + h);
}

(async () => {
  for (const url of urls) {
    console.log('='.repeat(94));
    console.log(url);
    const { text, file, cached, status } = await body(url);
    console.log(`  ${text.length} bytes${cached ? ' (cached)' : status ? ` · HTTP ${status}` : ''} · ${file}`);
    console.log('-'.repeat(94));

    if (flag('--shopify')) { await shopify(url); continue; }
    if (flag('--raw')) { console.log(text); continue; }

    if (probe) { probeRaw(text, probe); continue; }

    if (grepRe) {
      const re = new RegExp(`.{0,60}(?:${grepRe.source}).{0,90}`, 'gi');
      const hits = [...new Set((text.match(re) || []).map(s => decode(s).replace(/\s+/g, ' ').trim()))];
      console.log(hits.length ? hits.map(h => '    ' + h).join('\n') : '  (no match in the raw body)');
      continue;
    }

    const lines = detag(text);
    const start = aroundRe ? Math.max(0, lines.findIndex(l => aroundRe.test(l))) : 0;
    if (aroundRe && lines.findIndex(l => aroundRe.test(l)) === -1) {
      console.log(`  (--around pattern not found in the de-tagged text; it may still be in the raw body — try --grep)`);
      continue;
    }
    console.log(lines.slice(start, start + maxLines).join('\n'));
    if (lines.length > start + maxLines) console.log(`  … ${lines.length - start - maxLines} more lines (--lines N)`);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
