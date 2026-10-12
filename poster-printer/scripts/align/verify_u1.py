"""Phase 15: re-verify Ar't's claims (art-kb rea-alignment-01 §7.4) on 白's U1 ratings with bootstrap CIs and
a confound check (composition fixed effects + aspect). Run: python3 scripts/align/verify_u1.py"""
import csv, random, json, numpy as np
R = [x for x in csv.DictReader(open('scripts/taste/train.csv')) if x['set'] == 'U1']
y = np.array([float(x['y']) for x in R]); n = len(y)
C = [k for k in R[0] if k.startswith('c_')]
def comp(x):
    for k in C:
        if x[k] == '1': return k[2:]
    return 'other'
comps = [comp(x) for x in R]; cats = sorted(set(comps))
asp = [round(float(x['aspect']), 2) for x in R]; aspc = sorted(set(asp))
def f(k, s=1.0): return np.array([float(x[k]) * s for x in R])
rng = np.random.default_rng(15)
B = 4000
def boot(fn):
    v = [fn(rng.integers(0, n, n)) for _ in range(B)]
    return np.percentile(v, [2.5, 97.5])
def rank(a): return np.argsort(np.argsort(a)).astype(float)
def sp(a, b): return float(np.corrcoef(rank(a), rank(b))[0, 1])
def design(cols, idx, fe=True):
    X = [np.ones(len(idx))] + [c[idx] for c in cols]
    if fe:
        for c in cats[1:]: X.append(np.array([comps[i] == c for i in idx], float))
        for a in aspc[1:]: X.append(np.array([asp[i] == a for i in idx], float))
    return np.column_stack(X)
def ols(cols, idx, fe=True):
    X = design(cols, idx, fe); b = np.linalg.lstsq(X, y[idx], rcond=None)[0]; return b[1]
out = {}
def claim(name, mask_a, mask_b, cont, scale_note):
    ia, ib = np.where(mask_a)[0], np.where(mask_b)[0]
    d = y[ia].mean() - y[ib].mean()
    ci = boot(lambda s: (y[s][mask_a[s]].mean() - y[s][mask_b[s]].mean()) if mask_a[s].any() and mask_b[s].any() else 0)
    rho = sp(cont, y); rci = boot(lambda s: sp(cont[s], y[s]))
    allx = np.arange(n); raw = ols([cont], allx, False); adj = ols([cont], allx, True)
    aci = boot(lambda s: ols([cont], s, True))
    out[name] = dict(nA=len(ia), meanA=round(y[ia].mean(), 2), nB=len(ib), meanB=round(y[ib].mean(), 2), diff=round(d, 2),
                     diffCI=[round(v, 2) for v in ci], rho=round(rho, 3), rhoCI=[round(v, 3) for v in rci],
                     slopeRaw=round(raw, 4), slopeAdj=round(adj, 4), slopeAdjCI=[round(v, 4) for v in aci], unit=scale_note)
ch = f('chars'); claim('chars>=140 vs <80', ch >= 140, ch < 80, ch, 'per char')
mm = f('minMargin'); claim('minMargin<2u vs >=6u', mm < 2, mm >= 6, mm, 'per u')
w = f('weights'); claim('weights>=4 vs 3', w >= 4, w == 3, w, 'per weight')
h3 = f('hier3'); claim('hier3>=6 vs <6', h3 >= 6, h3 < 6, np.minimum(h3, 20), 'per ratio unit (capped 20)')
dl = f('gHeroDL', 100); claim('heroDL 25-35 vs >=35', (dl >= 25) & (dl < 35), dl >= 35, dl, 'per L point')
nm = f('gNearMiss'); claim('nearMiss>=1 vs 0', nm >= 1, nm == 0, nm, 'per near-miss')
ac = f('gAccent', 100); claim('accent 2-15% vs <2%', (ac >= 2) & (ac < 15), ac < 2, ac, 'per %')
nt = f('nText'); claim('nText>=13 vs <=8', nt >= 13, nt <= 8, nt, 'per block')
# composition shrinkage (empirical Bayes, k = within var / between var)
mu = y.mean(); tab = {}
for c in cats:
    v = y[[i for i in range(n) if comps[i] == c]]; tab[c] = (len(v), v.mean())
wv = np.mean([np.var(y[[i for i in range(n) if comps[i] == c]], ddof=1) for c in cats if tab[c][0] > 2])
bv = max(1e-3, np.var([m for c, (k, m) in tab.items() if k >= 4]) - wv / np.mean([k for k, _ in tab.values()]))
K = wv / bv
out['_shrink'] = dict(mu=round(mu, 3), withinVar=round(wv, 3), betweenVar=round(bv, 4), k=round(K, 1),
    comps={c: dict(n=k, mean=round(m, 2), shrunk=round(mu + (m - mu) * k / (k + K), 2)) for c, (k, m) in sorted(tab.items(), key=lambda t: -t[1][1])})
# 9:16 look
tall = np.array([a < -0.5 for a in asp])
out['_916'] = dict(n=int(tall.sum()), mean=round(y[tall].mean(), 2), rest=round(y[~tall].mean(), 2),
    diffCI=[round(v, 2) for v in boot(lambda s: y[s][tall[s]].mean() - y[s][~tall[s]].mean())],
    adjDiff=round(float(ols([tall.astype(float)], np.arange(n), False)), 2),
    compsTall={c: comps.count(c) for c in cats if any(comps[i] == c and tall[i] for i in range(n))},
    charsTall=round(ch[tall].mean(), 1), charsRest=round(ch[~tall].mean(), 1), mmTall=round(mm[tall].mean(), 2), mmRest=round(mm[~tall].mean(), 2))
# 9:16 adjusted for composition only
X = [np.ones(n), tall.astype(float)] + [np.array([c2 == c for c2 in comps], float) for c in cats[1:]]
out['_916']['adjForComp'] = round(float(np.linalg.lstsq(np.column_stack(X), y, rcond=None)[0][1]), 2)
json.dump(out, open('scripts/align/verify_u1.json', 'w'), ensure_ascii=False, indent=1)
for k, v in out.items(): print(k, json.dumps(v, ensure_ascii=False))
