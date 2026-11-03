import { parseGrammar, symbols, elimLR, leftFactor, firstFollow, gtxt, words } from './grammar.js';
import { buildLL1, runLL1 } from './ll1.js';
import { buildSLR, runSLR, pstr } from './slr.js';
import { compareRows, errorRows } from './compare.js';

const $ = id => document.getElementById(id);
const lines = a => a.join('\n');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tbl = (head, rows) => `<div class='sc'><table><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>` +
  rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') + '</table></div>';
const trace = r => tbl(['Step', 'Stack', 'Input', 'Action'], r.rows.map((x, i) => [i + 1, x.s, x.i, x.a]));
const verdict = r => (r.ok ? "<b class='ok'>Accepted</b>" : `<b class='er'>Error at token ${r.err.pos + 1}: ${esc(r.err.msg)}</b>`);
const confs = c => (c.length ? c.map(x => `<div class='cf'>${esc(x)}</div>`).join('') : "<p class='ok'>No conflicts</p>");
const set = s => '{ ' + [...s].join(', ') + ' }';
const ffTable = (g, ff) => tbl(['Non-terminal', 'FIRST', 'FOLLOW'], g.order.map(A => [A, set(ff.F[A]), set(ff.Fo[A])]));

function analyze() {
  $('msg').textContent = '';
  try {
    const g = parseGrammar($('g').value);
    const toks = words($('inp').value.trim());
    const errs = $('errs').value.split('\n').map(s => s.trim()).filter(Boolean);
    const { T } = symbols(g), ff = firstFollow(g);
    const g2 = leftFactor(elimLR(g)), ff2 = firstFollow(g2);
    const changed = gtxt(g) !== gtxt(g2);
    const L1 = buildLL1(g, ff), L2 = buildLL1(g2, ff2), S = buildSLR(g, ff);
    const r1 = runLL1(g2, L2.M, toks), r2 = runSLR(S, toks);

    // Module 1
    $('p0').innerHTML = `<h2>Original grammar</h2><pre>${esc(gtxt(g))}</pre>` +
      `<h2>After left-recursion removal and left factoring</h2><pre>${esc(gtxt(g2))}</pre>` +
      `<h2>FIRST and FOLLOW (original)</h2>${ffTable(g, ff)}` +
      (changed ? `<h2>FIRST and FOLLOW (preprocessed)</h2>${ffTable(g2, ff2)}` : '');

    // Module 2
    const cols = [...symbols(g2).T, '$'];
    $('p1').innerHTML = `<h2>LL(1) table</h2>` +
      tbl(['M', ...cols], g2.order.map(A => [A, ...cols.map(a => (L2.M[A][a] || []).join(' / '))])) +
      `<h2>Conflicts</h2>${confs(L2.conf)}<h2>Parse trace</h2><p>${verdict(r1)}</p>${trace(r1)}`;

    // Module 3
    const tc = [...T, '$'];
    $('p2').innerHTML = `<h2>Augmented grammar</h2><pre>${esc(lines(S.prods.map((p, i) => i + ': ' + pstr(p))))}</pre>` +
      `<h2>LR(0) states (${S.states.length})</h2><pre>${esc(lines(S.states.map((I, i) => 'I' + i + '\n' + lines([...I].map(S.item))).map(x => x + '\n')))}</pre>` +
      `<h2>ACTION and GOTO (s = shift, r = reduce by production number, acc = accept)</h2>` +
      tbl(['State', ...tc, ...g.order], S.act.map((row, i) => [i, ...tc.map(a => (row[a] || []).join('/')), ...g.order.map(A => S.gt[i][A] ?? '')])) +
      `<h2>Conflicts</h2>${confs(S.conf)}<h2>Parse trace</h2><p>${verdict(r2)}</p>${trace(r2)}`;

    // Module 4
    $('p3').innerHTML = `<h2>Comparison</h2>${tbl(['Metric', 'LL(1)', 'SLR'], compareRows(L1, L2, S, changed, r1, r2))}` +
      `<h2>Error analysis</h2>${tbl(['Invalid string', 'LL(1) detects', 'SLR detects'], errorRows(errs, g2, L2, S))}`;
  } catch (e) {
    $('msg').textContent = e.message;
  }
}

document.querySelectorAll('[data-tab]').forEach(b => {
  b.onclick = () => document.querySelectorAll('.pn').forEach(p => p.classList.toggle('on', p.id === b.dataset.tab));
});
$('go').onclick = analyze;
analyze();