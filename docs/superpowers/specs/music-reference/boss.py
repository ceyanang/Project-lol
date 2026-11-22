from synth import *
bpm=92; B=60/bpm; bars=12; dur=bars*4*B; m=Mix(dur+3)
pad=np.zeros(int(SR*(dur+3)))
for f in(hz(28),hz(40),hz(46),hz(52)):
    for det in(0.994,1.006): pad+=saw(f*det,dur+3)[:len(pad)]*0.10
pad=lowpass(pad,300)*(0.8+0.2*np.sin(2*np.pi*np.arange(len(pad))/SR*0.35)); m.b[:len(pad)]+=pad
horn=[(0,52,2),(2,53,1),(3,52,1), (4,55,2),(6,53,1),(7,52,1), (8,58,2),(10,57,1),(11,55,1), (12,53,2),(14,52,2),
      (16,52,1),(17,53,1),(18,55,2),(20,58,2),(22,59,2), (24,57,1),(25,55,1),(26,53,2),(28,52,4)]
for b,n,l in horn:
    note=saw(hz(n),l*B,decay=None)*0.5+saw(hz(n)*1.004,l*B)*0.4+sq(hz(n-12),l*B,0.5)*0.3
    m.put(b*B,lowpass(note,1400)*0.9,0.5)
for bar in range(bars):
    t0=bar*4*B
    m.put(t0,taiko(1.1),1.0); m.put(t0+2*B,taiko(0.8),0.9)
    if bar%4==3:
        for i in range(12): m.put(t0+2*B+i*B/6,taiko(0.45+0.05*i),0.7)                                  # roll into the next phrase
    if bar%2==1: m.put(t0+3.5*B,lowpass(saw(hz(64),0.35)+saw(hz(65),0.35)+saw(hz(71),0.35),2500)*0.5,0.5)  # dissonant stab
    for i in range(4): m.put(t0+i*B+B*0.5,hat(),0.2)
for b in(10,26,42): m.put(b*B,breath(hz(76),3*B),0.4)
out=reverb(m.b,0.3); save('boss',out,dur,fade=2.0)
