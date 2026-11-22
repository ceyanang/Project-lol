from synth import *
bpm=156; B=60/bpm; bars=16; dur=bars*4*B; m=Mix(dur+3)
prog=[(45,[69,72,76,72]),(43,[67,71,74,71]),(41,[65,69,72,69]),(40,[64,68,71,68])]
hook=[[81,None,79,81,84,None,81,79],[79,None,76,79,83,None,79,76],[77,None,76,77,81,None,77,76],[76,None,76,80,83,None,80,76]]
for bar in range(bars):
    root,arp=prog[bar%4]; t0=bar*4*B
    for i in range(8): m.put(t0+i*B/2,sq(hz(root),B*0.42,0.5,decay=0.18)*0.9+saw(hz(root-12),B*0.42,decay=0.2)*0.5,0.5)   # driving bass
    for i in range(16): m.put(t0+i*B/4,sq(hz(arp[i%4]),B*0.2,0.125,decay=0.08),0.16)                                       # fast arps
    for beat in range(4): m.put(t0+beat*B,kick(),0.9)
    for beat in(1,3): m.put(t0+beat*B,snare(),0.7)
    for i in range(8): m.put(t0+i*B/2+B/4,hat(i==7),0.45)
    if bar>=4:
        for i in range(8):
            n=hook[bar%4][i]
            if n: m.put(t0+i*B/2,sq(hz(n),B*0.45,0.25,decay=0.3)*0.7+tri(hz(n-12),B*0.45)*0.3,0.32)
    if bar%4==3:
        for i in range(8): m.put(t0+3*B+i*B/8,snare(),0.25+0.05*i)                                                           # fill
out=reverb(m.b,0.12); save('battle',out,dur,fade=1.5)
