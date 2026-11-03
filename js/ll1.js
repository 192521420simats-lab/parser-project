import { EPS } from './grammar.js';

export function buildLL1(g, ff) {
  const M = {}, conf = [];
  g.order.forEach(A => (M[A] = {}));
  for (const A of g.order) for (const p of g.rules[A]) {
    const s = A + ' → ' + p.join(' ');
    const add = a => {
      M[A][a] = M[A][a] || [];
      if (!M[A][a].includes(s)) M[A][a].push(s);
    };
    const f = ff.fs(p);
    f.forEach(a => { if (a !== EPS) add(a); });
    if (f.has(EPS)) ff.Fo[A].forEach(add);
  }
  let cells = 0;
  for (const A in M) for (const a in M[A]) {
    cells++;
    if (M[A][a].length > 1) conf.push(`M[${A}, ${a}] = ` + M[A][a].join('  |  '));
  }
  return { M, conf, cells };
}

export function runLL1(g, M, toks) {
  const N = new Set(g.order), rows = [], inp = toks.concat(['$']);
  const st = ['$', g.start];
  let ip = 0, err = null;
  while (true) {
    const X = st[st.length - 1], a = inp[ip];
    const row = { s: st.slice().reverse().join(' '), i: inp.slice(ip).join(' ') };
    if (X === '$') {
      if (a === '$') row.a = 'Accept';
      else { row.a = 'Error'; err = { pos: ip, msg: `unexpected '${a}' after a complete parse` }; }
      rows.push(row);
      break;
    }
    if (!N.has(X)) {
      if (X === a) { row.a = 'Match ' + a; st.pop(); ip++; }
      else { row.a = 'Error'; err = { pos: ip, msg: `expected '${X}', found '${a}'` }; rows.push(row); break; }
    } else {
      const e = M[X][a];
      if (!e) {
        row.a = 'Error';
        err = { pos: ip, msg: `expected one of {${Object.keys(M[X]).join(', ')}}, found '${a}'` };
        rows.push(row);
        break;
      }
      row.a = e[0];
      st.pop();
      const rhs = e[0].split(' → ')[1].split(' ');
      if (rhs[0] !== EPS) for (let k = rhs.length - 1; k >= 0; k--) st.push(rhs[k]);
    }
    rows.push(row);
    if (rows.length > 500) { err = { pos: ip, msg: 'step limit reached' }; break; }
  }
  return { rows, err, ok: !err };
}