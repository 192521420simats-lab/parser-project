import { EPS, fresh } from './grammar.js';

export const pstr = p => p.l + ' → ' + (p.r.join(' ') || EPS);

export function buildSLR(g, ff) {
  const Sp = fresh(g, g.start);
  const prods = [{ l: Sp, r: [g.start] }];
  g.order.forEach(A => g.rules[A].forEach(p => prods.push({ l: A, r: p[0] === EPS ? [] : p })));
  const N = new Set(g.order), byL = {};
  prods.forEach((p, i) => (byL[p.l] = byL[p.l] || []).push(i));
  const dec = it => it.split(':').map(Number);
  const key = s => [...s].sort().join(',');

  const closure = items => {
    const s = new Set(items), q = [...s];
    while (q.length) {
      const [p, d] = dec(q.pop()), X = prods[p].r[d];
      if (X && N.has(X)) for (const pi of byL[X]) {
        const k = pi + ':0';
        if (!s.has(k)) { s.add(k); q.push(k); }
      }
    }
    return s;
  };
  const go = (I, X) => {
    const r = [];
    I.forEach(it => { const [p, d] = dec(it); if (prods[p].r[d] === X) r.push(p + ':' + (d + 1)); });
    return closure(r);
  };

  const states = [closure(['0:0'])], idx = { [key(states[0])]: 0 }, tr = [];
  for (let i = 0; i < states.length; i++) {
    tr[i] = {};
    const syms = new Set();
    states[i].forEach(it => { const [p, d] = dec(it), X = prods[p].r[d]; if (X) syms.add(X); });
    for (const X of syms) {
      const J = go(states[i], X), k = key(J);
      if (!(k in idx)) { idx[k] = states.length; states.push(J); }
      tr[i][X] = idx[k];
    }
  }

  const act = [], gt = [], conf = [];
  const put = (i, a, v) => { act[i][a] = act[i][a] || []; if (!act[i][a].includes(v)) act[i][a].push(v); };
  states.forEach((I, i) => {
    act[i] = {}; gt[i] = {};
    for (const X in tr[i]) { if (N.has(X)) gt[i][X] = tr[i][X]; else put(i, X, 's' + tr[i][X]); }
    I.forEach(it => {
      const [p, d] = dec(it);
      if (d === prods[p].r.length) {
        if (p === 0) put(i, '$', 'acc');
        else ff.Fo[prods[p].l].forEach(a => put(i, a, 'r' + p));
      }
    });
  });

  let cells = 0;
  const name = v => v[0] === 's' ? 'shift ' + v.slice(1) : v === 'acc' ? 'accept' : 'reduce ' + pstr(prods[+v.slice(1)]);
  act.forEach((row, i) => {
    for (const a in row) {
      cells++;
      if (row[a].length > 1) {
        const kind = row[a].filter(v => v[0] === 'r').length > 1 ? 'reduce/reduce' : 'shift/reduce';
        conf.push(`I${i}, '${a}': ${kind} conflict: ` + row[a].map(name).join('  /  '));
      }
    }
  });
  gt.forEach(r => (cells += Object.keys(r).length));

  const item = it => {
    const [p, d] = dec(it), P = prods[p];
    return P.l + ' → ' + P.r.slice(0, d).concat(['•'], P.r.slice(d)).join(' ');
  };
  return { prods, states, tr, act, gt, conf, cells, item };
}

export function runSLR(S, toks) {
  const rows = [], inp = toks.concat(['$']);
  const st = [0], sy = [];
  let ip = 0, err = null;
  while (true) {
    const s = st[st.length - 1], a = inp[ip];
    const row = { s: st.map((x, k) => (k ? sy[k - 1] + ' ' : '') + x).join(' '), i: inp.slice(ip).join(' ') };
    const e = S.act[s][a];
    if (!e) {
      row.a = 'Error';
      err = { pos: ip, msg: `expected one of {${Object.keys(S.act[s]).join(', ')}}, found '${a}'` };
      rows.push(row);
      break;
    }
    const v = e[0];
    if (v === 'acc') { row.a = 'Accept'; rows.push(row); break; }
    if (v[0] === 's') { row.a = 'Shift ' + v.slice(1); sy.push(a); st.push(+v.slice(1)); ip++; }
    else {
      const p = S.prods[+v.slice(1)];
      row.a = 'Reduce ' + pstr(p);
      for (let k = 0; k < p.r.length; k++) { st.pop(); sy.pop(); }
      const nx = S.gt[st[st.length - 1]][p.l];
      if (nx === undefined) { err = { pos: ip, msg: 'goto failed' }; rows.push(row); break; }
      sy.push(p.l); st.push(nx);
    }
    rows.push(row);
    if (rows.length > 500) { err = { pos: ip, msg: 'step limit reached' }; break; }
  }
  return { rows, err, ok: !err };
}