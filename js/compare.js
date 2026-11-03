import { runLL1 } from './ll1.js';
import { runSLR } from './slr.js';

const yn = c => (c.length ? `No (${c.length} conflicts)` : 'Yes');

export function compareRows(L1, L2, S, changed, r1, r2) {
  return [
    ['Grammar as entered is LL(1)', yn(L1.conf), ''],
    ['Grammar is LL(1) after preprocessing', yn(L2.conf), ''],
    ['Grammar is SLR(1)', '', yn(S.conf)],
    ['Preprocessing needed', changed ? 'Left recursion / factoring' : 'None', 'Augmentation only'],
    ['Table entries', L2.cells, S.cells],
    ['Number of states', 'n/a', S.states.length],
    ['Steps for the input', r1.rows.length, r2.rows.length],
    ['Result for the input', r1.ok ? 'Accepted' : 'Rejected', r2.ok ? 'Accepted' : 'Rejected'],
  ];
}

export function errorRows(strings, g2, L2, S) {
  const f = r => (r.ok ? 'Accepted' : `token ${r.err.pos + 1}: ${r.err.msg}`);
  return strings.map(s => {
    const t = s.split(' ').filter(Boolean);
    return [s, f(runLL1(g2, L2.M, t)), f(runSLR(S, t))];
  });
}