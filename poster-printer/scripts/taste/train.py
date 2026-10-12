import pandas as pd, numpy as np, json, sys
import os; os.chdir(os.path.dirname(os.path.abspath(__file__)))
from scipy.stats import spearmanr, pearsonr
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
HO=sys.argv[1] if len(sys.argv)>1 else 'P6r1'
d=pd.read_csv('train.csv'); X=d.iloc[:,3:].values.astype(float); y=d.y.values.astype(float); g=d.set.values
comp=d[[c for c in d.columns if c.startswith('c_')]].values.argmax(1)
models={'ridge':lambda:make_pipeline(StandardScaler(),Ridge(alpha=30)),
 'gbr':lambda:GradientBoostingRegressor(n_estimators=250,max_depth=3,learning_rate=0.03,subsample=0.8,min_samples_leaf=8,random_state=0),
 'rf':lambda:RandomForestRegressor(n_estimators=300,min_samples_leaf=5,max_features=0.4,random_state=0,n_jobs=-1)}
def within(yt,yp,c):
    a=[];b=[]
    for k in set(c):
        m=c==k
        if m.sum()>=4: a+=list(yt[m]-yt[m].mean()); b+=list(yp[m]-yp[m].mean())
    return spearmanr(a,b)[0]
for name,mk in models.items():
    P=np.zeros(len(y))
    for s in sorted(set(g)):
        tr=g!=s; m=mk().fit(X[tr],y[tr]); P[~tr]=m.predict(X[~tr])
    te=g==HO
    print(f"{name:6s} LOSO spearman {spearmanr(y,P)[0]:.3f} pearson {pearsonr(y,P)[0]:.3f} within-comp {within(y,P,comp):.3f} | heldout {HO} spearman {spearmanr(y[te],P[te])[0]:.3f} within {within(y[te],P[te],comp[te]):.3f} MAE {np.abs(y[te]-P[te]).mean():.2f}")
