"""Phase 10: retrain the taste selector on the user's ratings (set U*), weighted above the by-eye labels.
The user's integer scores are treated as ordinal/interval, not exact values:
  * interval loss: a rating r means "r.x", so any prediction in [r, r+1) costs nothing (squared hinge outside)
  * pairwise loss: within the user's ratings, every pair with different scores is a RankNet (logistic) pair
  * the by-eye labels (P*) keep the scale calibrated with a small-weight squared loss
Gradient boosting on that combined objective with depth-3 regression trees, so the model ships in the same tree format
(src/engine/aesthetic/model.ts).  usage: python3 train_user.py [cv|export]"""
import pandas as pd, numpy as np, json, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import GradientBoostingRegressor
from scipy.stats import spearmanr
P = dict(rounds=300, lr=0.05, depth=3, leaf=8, wMine=0.15, wUser=3.0, wPair=3.0, sub=0.8)

def load():
    d = pd.read_csv('train.csv'); names = list(d.columns[3:])
    return d, names, d.iloc[:, 3:].values.astype(float), d.y.values.astype(float), d.set.str.startswith('U').values

def load_pairs(names):
    """A/B judgements from rate.html (pairs.csv): returns stacked X (a rows, then b rows) and w (1 a better, -1 b, 0 tie)"""
    if not os.path.exists('pairs.csv'): return None
    q = pd.read_csv('pairs.csv'); q = q[q.w != 0]
    if not len(q): return None
    Xa = q[['a:' + n for n in names]].values.astype(float); Xb = q[['b:' + n for n in names]].values.astype(float)
    return np.vstack([Xa, Xb]), q.w.values.astype(float)

def fit(X, y, isU, p=P, seed=0, fine=None, ab=None):
    """fine: mask of finer-step user ratings (interval ±0.25); ab: (X pairs stacked a|b, w) from A/B mode"""
    rng = np.random.default_rng(seed)
    F0 = y[~isU].mean(); n0 = len(y)
    ui = np.where(isU)[0]
    yi = y[ui]
    A, B = np.where(yi[:, None] > yi[None, :])  # pairs (a better than b)
    pa, pb = ui[A], ui[B]
    if fine is None: fine = np.zeros(n0, bool)
    if ab is not None:  # A/B posters join as unlabelled rows that only carry pairwise terms
        Xp, w = ab; k = len(w)
        X = np.vstack([X, Xp]); y = np.concatenate([y, np.full(2 * k, np.nan)]); isU = np.concatenate([isU, np.zeros(2 * k, bool)]); fine = np.concatenate([fine, np.zeros(2 * k, bool)])
        a_ = n0 + np.arange(k); b_ = n0 + k + np.arange(k)
        pa = np.concatenate([pa, np.where(w > 0, a_, b_)]); pb = np.concatenate([pb, np.where(w > 0, b_, a_)])
    lab = ~np.isnan(y)
    F = np.full(len(y), F0); trees = []
    npair = np.bincount(np.concatenate([pa, pb]), minlength=len(y)).clip(1)
    w = np.where(isU | ~lab, p['wUser'], p['wMine'])
    for m in range(p['rounds']):
        g = np.where(isU | ~lab, 0.0, np.nan_to_num(y) - F)
        lo = np.where(fine, y - 0.25, y); hi = np.where(fine, y + 0.25, y + 1)
        g = np.where(isU & (F < lo), lo - F, g); g = np.where(isU & (F > hi), hi - F, g); g = np.nan_to_num(g)
        s = 1 / (1 + np.exp(F[pa] - F[pb]))           # d/dF of -log sigmoid(Fa-Fb)
        gp = np.zeros(len(y)); np.add.at(gp, pa, s); np.add.at(gp, pb, -s)
        g = g + p['wPair'] / p['wUser'] * gp / npair * 4
        idx = rng.random(len(y)) < p['sub']
        t = DecisionTreeRegressor(max_depth=p['depth'], min_samples_leaf=p['leaf'], random_state=m).fit(X[idx], g[idx], sample_weight=w[idx])
        F += p['lr'] * t.predict(X); trees.append(t)
    return dict(init=F0, lr=p['lr'], trees=trees)

def predict(M, X):
    return M['init'] + M['lr'] * sum(t.predict(X) for t in M['trees'])

def old_model():
    src = open('../../src/engine/aesthetic/model.ts').read()
    j = json.loads(src[src.index('= {') + 2: src.rindex(' as const')])
    return j

def old_predict(j, names, X):
    col = [names.index(n) if n in names else None for n in j['names']]
    out = []
    for x in X:
        s = j['init']
        for feat, thr, L, R, val in j['trees']:
            i = 0
            while L[i] != -1:
                c = col[feat[i]]; v = x[c] if c is not None else 0
                i = L[i] if v <= thr[i] else R[i]
            s += j['lr'] * val[i]
        out.append(s)
    return np.array(out)

def pairacc(y, p):
    a, b = np.where(y[:, None] > y[None, :])
    return float(((p[a] - p[b]) > 0).mean() + 0.5 * ((p[a] - p[b]) == 0).mean())

def cv(k=5, reps=2):
    d, names, X, y, isU = load()
    ui = np.where(isU)[0]
    res = {'old (shipped)': [], 'gbr ints (all, U×3)': [], 'ordinal+pairwise (new)': []}
    oldj = old_model(); po = old_predict(oldj, names, X)
    Pn = np.zeros((reps, len(y))); Pg = np.zeros((reps, len(y)))
    for r in range(reps):
        perm = np.random.default_rng(100 + r).permutation(ui)
        for f in range(k):
            te = perm[f::k]; tr = np.setdiff1d(np.arange(len(y)), te)
            M = fit(X[tr], y[tr], isU[tr], seed=r); Pn[r, te] = predict(M, X[te])
            g = GradientBoostingRegressor(n_estimators=250, max_depth=3, learning_rate=0.03, subsample=0.8, min_samples_leaf=8, random_state=0).fit(X[tr], y[tr], sample_weight=np.where(isU[tr], 3, 1))
            Pg[r, te] = g.predict(X[te])
    yu = y[ui]
    for name, p in [('old (shipped)', np.tile(po, (reps, 1))), ('gbr ints (all, U×3)', Pg), ('ordinal+pairwise (new)', Pn)]:
        sp = np.mean([spearmanr(yu, p[r, ui])[0] for r in range(reps)]); pa = np.mean([pairacc(yu, p[r, ui]) for r in range(reps)])
        # top-1 of random groups of 8 (what the selector does): mean user score of the picked poster
        rng = np.random.default_rng(7); pick = []
        for _ in range(4000):
            g8 = rng.choice(len(ui), 8, replace=False); pick.append(yu[g8[np.argmax(p[0, ui][g8])]])
        print(f'{name:26s} spearman {sp:+.3f}  pair-acc {pa:.3f}  best-of-8 user score {np.mean(pick):.3f}  (random {yu.mean():.3f}, oracle {np.mean([yu[rng.choice(len(ui), 8, replace=False)].max() for _ in range(4000)]):.3f})')

def export():
    d, names, X, y, isU = load()
    M = fit(X, y, isU, fine=d.set.str.match(r'^U.*f$').values, ab=load_pairs(names))
    trees = []
    for est in M['trees']:
        t = est.tree_
        trees.append([t.feature.tolist(), [round(float(v), 5) for v in t.threshold], t.children_left.tolist(), t.children_right.tolist(), [round(float(v[0][0]), 5) for v in t.value]])
    out = {'names': names, 'init': round(float(M['init']), 5), 'lr': M['lr'], 'trees': trees, 'n': len(y)}
    src = '// Generated by scripts/taste/train_user.py: boosted trees on the user\'s ratings (U*, interval + pairwise loss, weighted\n// above the by-eye labels P*, which keep the scale). Previous model: scripts/taste/export.py. Do not edit by hand.\nexport const TASTE_MODEL: { names: string[]; init: number; lr: number; n: number; trees: [number[], number[], number[], number[], number[]][] } = ' + json.dumps(out, separators=(',', ':')) + ' as const;\n'
    open('../../src/engine/aesthetic/model.ts', 'w').write(src)
    p = predict(M, X); print('exported', len(src) // 1024, 'KB; train user spearman %.3f, mine spearman %.3f' % (spearmanr(y[isU], p[isU])[0], spearmanr(y[~isU], p[~isU])[0]))

if __name__ == '__main__':
    (export if sys.argv[1:] == ['export'] else cv)()
