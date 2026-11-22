from synth import *
bpm=112; B=60/bpm; bars=16; dur=bars*4*B; m=Mix(dur+3)
prog=[(48,[60,62,67]),(43,[55,62,67]),(45,[57,60,64]),(41,[53,57,60])]
mel=[[72,74,79,79,81,79,74,72],[74,79,81,79,74,79,76,74],[72,76,81,81,79,76,72,None],[77,77,81,79,77,74,72,74]]
mel2=[[79,81,84,81,79,74,76,79],[81,79,74,79,81,86,84,81],[84,81,79,76,72,76,79,81],[77,81,84,81,79,77,74,72]]
for bar in range(bars):
    root,ch=prog[bar%4]; t0=bar*4*B
    for i in range(8):  # bass: root / fifth on 8ths, triangle
        n=root if i%4 in(0,1,3) else root+7
        m.put(t0+i*B/2,tri(hz(n),B*0.45,decay=0.5),0.5)
    for i in range(16): m.put(t0+i*B/4,sq(hz(ch[i%3]+12),B*0.22,0.25,decay=0.12),0.10)   # soft arpeggio
    for i in range(8):
        n=(mel if bar<8 else mel2 if bar%8>=4 or bar>=12 else mel)[bar%4][i]
        if bar>=4 and n:
            m.put(t0+i*B/2,pluck(hz(n),B*0.9),0.5); m.put(t0+i*B/2,sq(hz(n),B*0.4,0.25,decay=0.2),0.12)
    for i in range(8): m.put(t0+i*B/2+B/4,hat(),0.35)                                       # shaker
    m.put(t0+B,tick(),0.5); m.put(t0+3*B,tick(1200),0.5)                                     # woodblock
    if bar%2==0: m.put(t0,kick(),0.45)
out=reverb(m.b,0.22); save('map',out,dur,fade=2.0)
