import numpy as np, subprocess
SR=32000
rng=np.random.default_rng(7)
hz=lambda m: 440.0*2**((m-69)/12)
def T(d): return np.arange(int(SR*d))/SR
def env(n,a=0.005,r=0.04,decay=None):
    e=np.ones(n); na=max(1,int(a*SR)); nr=max(1,int(r*SR))
    e[:na]=np.linspace(0,1,na); e[-nr:]*=np.linspace(1,0,nr)
    if decay: e*=np.exp(-np.arange(n)/SR/decay)
    return e
def lowpass(x,c):
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); X*=1/(1+(f/c)**4); return np.fft.irfft(X,len(x))
def highpass(x): return np.diff(x,prepend=0)
def sq(f,d,duty=0.5,decay=None): t=T(d); return (np.where((t*f)%1<duty,1.0,-1.0))*env(len(t),decay=decay)
def tri(f,d,decay=None): t=T(d); return (2*np.abs(2*((t*f)%1)-1)-1)*env(len(t),decay=decay)
def saw(f,d,decay=None): t=T(d); return (2*((t*f)%1)-1)*env(len(t),decay=decay)
def pluck(f,d):  # koto-ish: decaying harmonics + a tiny noise click
    t=T(d); y=np.zeros(len(t))
    for k in range(1,9): y+=np.sin(2*np.pi*f*k*t*(1+0.0006*k))/(k**1.15)*np.exp(-t*(2.2+0.9*k)/max(d,0.4)*1.0)
    n=int(0.012*SR); y[:n]+=rng.standard_normal(n)*0.25*np.linspace(1,0,n)
    return y*env(len(t),a=0.002,r=0.08)
def bell(f,d=1.6):
    t=T(d); y=sum(np.sin(2*np.pi*f*r*t)*a*np.exp(-t*s) for r,a,s in((1,1,2.2),(2.76,0.5,3.4),(5.4,0.25,5)));return y*env(len(t),a=0.002,r=0.2)
def breath(f,d):
    t=T(d); vib=1+0.004*np.sin(2*np.pi*5*t)*np.minimum(1,t/0.6)
    y=np.sin(2*np.pi*f*t*vib)+0.35*np.sin(2*np.pi*2*f*t*vib); nz=lowpass(rng.standard_normal(len(t)),3500)*0.35
    return (y+nz)*env(len(t),a=0.25,r=0.5)*0.6
def kick(): t=T(0.22); return np.sin(2*np.pi*np.cumsum(45+90*np.exp(-t*35))/SR)*np.exp(-t*14)
def snare(): t=T(0.16); return (highpass(rng.standard_normal(len(t)))*0.7+np.sin(2*np.pi*190*t)*0.5)*np.exp(-t*24)
def hat(open_=False): t=T(0.09 if open_ else 0.035); return highpass(rng.standard_normal(len(t)))*np.exp(-t*(30 if open_ else 90))*0.5
def taiko(big=1.0): t=T(0.7); return (np.sin(2*np.pi*np.cumsum(38+75*np.exp(-t*22))/SR)*np.exp(-t*5.5)+lowpass(rng.standard_normal(len(t)),400)*np.exp(-t*30)*0.8)*big
def tick(f=900): t=T(0.05); return np.sin(2*np.pi*f*t)*np.exp(-t*70)*0.7
class Mix:
    def __init__(s,dur): s.b=np.zeros(int(SR*dur)+SR)
    def put(s,t,x,g=1.0):
        i=int(t*SR)
        if i<0 or i>=len(s.b): return
        n=min(len(x),len(s.b)-i); s.b[i:i+n]+=x[:n]*g
def reverb(x,mix=0.22):
    out=x.copy()
    for d,g in((0.0297,0.78),(0.0371,0.76),(0.0411,0.74),(0.0533,0.72)):
        n=int(d*SR); y=x.copy()
        for i in range(n,len(y),n):
            k=min(n,len(y)-i); y[i:i+k]+=g*y[i-n:i-n+k]
        out+=y*mix*0.5
    return out
def save(name,x,seconds,fade=0.0):
    x=x[:int(SR*seconds)].copy()
    if fade: n=int(fade*SR); x[-n:]*=np.linspace(1,0,n)
    x=x/np.max(np.abs(x))*0.8
    pcm=(x*32767).astype('<i2').tobytes()
    open(name+'.raw','wb').write(pcm)
    subprocess.run(['ffmpeg','-y','-loglevel','error','-f','s16le','-ar',str(SR),'-ac','1','-i',name+'.raw','-b:a','128k',name+'.mp3'],check=True)
