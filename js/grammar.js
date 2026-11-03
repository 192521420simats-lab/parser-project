export const EPS = 'ε';
export const words = s => s.split(' ').filter(Boolean);

export function parseGrammar(text) {
  const rules = {}, order = [];
  for (let line of text.split('\n')) {
    line = line.trim();
    if (!line) continue;
    const parts = line.split(/->|→/);
    if (parts.length !== 2) throw new Error('Bad rule: ' + line);
    const lhs = parts[0].trim();
    if (!rules[lhs]) { rules[lhs] = []; order.push(lhs); }
    for (const alt of parts[1].split('|')) {
      let syms = words(alt.trim()).map(x => ['eps', '#', 'ε'].includes(x) ? EPS : x);
      if (!syms.length) syms = [EPS];
      rules[lhs].push(syms);
    }
  }
  if (!order.length) throw new Error('Grammar is empty');
  return { rules, order, start: order[0] };
}

export function symbols(g) {
  const N = new Set(g.order), T = new Set();
  for (const A of g.order) for (const p of g.rules[A]) for (const x of p) if (!N.has(x) && x !== EPS) T.add(x);
  return { N, T };
}

export function clone(g) {
  const rules = {};
  for (const A of g.order) rules[A] = g.rules[A].map(p => p.slice());
  return { rules, order: g.order.slice(), start: g.start };
}

export function fresh(g, A) {
  let n = A + '′';
  while (g.rules[n]) n += '′';
  return n;
}

export const gtxt = g => g.order.map(A => A + ' → ' + g.rules[A].map(p => p.join(' ')).join(' | ')).join('\n');

// Removes left recursion: A -> A a | b  becomes  A -> b A'  and  A' -> a A' | eps
export function elimLR(g0) {
  const g = clone(g0), ord = g.order.slice();
  for (let i = 0; i < ord.length; i++) {
    const Ai = ord[i];
    for (let j = 0; j < i; j++) {
      const Aj = ord[j], np = [];
      for (const p of g.rules[Ai]) {
        if (p[0] === Aj) {
          const rest = p.slice(1);
          for (const q of g.rules[Aj]) np.push(q[0] === EPS ? (rest.length ? rest : [EPS]) : q.concat(rest));
        } else np.push(p);
      }
      g.rules[Ai] = np;
    }
    const rec = g.rules[Ai].filter(p => p[0] === Ai);
    const non = g.rules[Ai].filter(p => p[0] !== Ai);
    if (rec.length) {
      const A2 = fresh(g, Ai);
      g.rules[Ai] = (non.length ? non : [[EPS]]).map(p => p[0] === EPS ? [A2] : p.concat([A2]));
      g.rules[A2] = rec.map(p => p.slice(1).concat([A2]));
      g.rules[A2].push([EPS]);
      g.order.splice(g.order.indexOf(Ai) + 1, 0, A2);
    }
  }
  return g;
}

// Left factoring: A -> a b | a c  becomes  A -> a A'  and  A' -> b | c
export function leftFactor(g0) {
  const g = clone(g0);
  let changed = true, guard = 0;
  while (changed && guard++ < 50) {
    changed = false;
    for (const A of g.order.slice()) {
      const groups = {};
      g.rules[A].forEach(p => (groups[p[0]] = groups[p[0]] || []).push(p));
      for (const k in groups) {
        const grp = groups[k];
        if (grp.length < 2 || k === EPS) continue;
        let n = 0;
        while (grp.every(p => p[n] !== undefined && p[n] === grp[0][n])) n++;
        const prefix = grp[0].slice(0, n), A2 = fresh(g, A);
        g.rules[A2] = grp.map(p => p.length > n ? p.slice(n) : [EPS]);
        g.rules[A] = g.rules[A].filter(p => !grp.includes(p));
        g.rules[A].push(prefix.concat([A2]));
        g.order.splice(g.order.indexOf(A) + 1, 0, A2);
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
  return g;
}

export function firstFollow(g) {
  const { N, T } = symbols(g), F = {}, Fo = {};
  N.forEach(a => { F[a] = new Set(); Fo[a] = new Set(); });
  // FIRST of a sequence of symbols
  const fs = seq => {
    const r = new Set();
    let all = true;
    for (const x of seq) {
      if (x === EPS) continue;
      if (N.has(x)) {
        F[x].forEach(y => y !== EPS && r.add(y));
        if (!F[x].has(EPS)) { all = false; break; }
      } else { r.add(x); all = false; break; }
    }
    if (all) r.add(EPS);
    return r;
  };
  let ch = true;
  while (ch) {
    ch = false;
    for (const A of g.order) for (const p of g.rules[A])
      fs(p).forEach(x => { if (!F[A].has(x)) { F[A].add(x); ch = true; } });
  }
  Fo[g.start].add('$');
  ch = true;
  while (ch) {
    ch = false;
    for (const A of g.order) for (const p of g.rules[A]) for (let i = 0; i < p.length; i++) {
      const B = p[i];
      if (!N.has(B)) continue;
      const f = fs(p.slice(i + 1));
      f.forEach(x => { if (x !== EPS && !Fo[B].has(x)) { Fo[B].add(x); ch = true; } });
      if (f.has(EPS)) Fo[A].forEach(x => { if (!Fo[B].has(x)) { Fo[B].add(x); ch = true; } });
    }
  }
  return { F, Fo, fs, N, T };
      }
