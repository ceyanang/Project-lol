from synth import *
bpm=54; B=60/bpm; bars=12; dur=bars*4*B; m=Mix(dur+3)
# In-scale (D Eb G A Bb): drone pad + sparse koto + shakuhachi + wind bells
pad=np.zeros(int(SR*(dur+3)))
for f in(hz(38),hz(45),hz(50)):
    for det in(0.997,1.003): pad+=saw(f*det,dur+3)[:len(pad)]*0.12
pad=lowpass(pad,420)*(0.75+0.25*np.sin(2*np.pi*np.arange(len(pad))/SR/ (B*8)))
m.b[:len(pad)]+=pad
D,Eb,G,A,Bb=62,63,67,69,70
phr=[ # (beat, midi, len)
 (0,D+12,2),(2,A,1),(3,G,1),  (4,Bb,2),(6,A,1),(7,G,1),  (8,D+12,1.5),(9.5,Eb+12,.5),(10,D+12,1),(11,Bb,1),  (12,A,3.5),
 (16,G,1),(17,A,1),(18,Bb,2),  (20,D+12,2),(21+1,Eb+12,1),(23,D+12,1), (24,A,1.5),(25.5,G,.5),(26,D,2.5),
 (32,D+12,2),(34,Bb,1),(35,A,1),(36,G,2),(38,A,2),  (40,Bb,1),(41,D+12,1),(42,Eb+12,2),(44,D+12,3),
]
for b,n,l in phr: m.put(b*B,pluck(hz(n),min(3.2,l*B+1.8)),0.5)
for b in range(0,bars*4,8): m.put(b*B,pluck(hz(50),4.0),0.55); m.put((b+4)*B,pluck(hz(45),4.0),0.4)
m.put(12*B,breath(hz(A+12),3.4*B),0.35); m.put(24*B,breath(hz(D+12),4.2*B),0.35); m.put(44*B,breath(hz(D+12),5*B),0.35)
for b,n in((6.5,86),(15.5,88),(27,91),(37.5,86),(45,93)): m.put(b*B,bell(hz(n)),0.22)
out=reverb(m.b,0.45)
save('menu',out,dur,fade=3.0)
