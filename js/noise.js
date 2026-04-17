// Simplex Noise for terrain generation
class SimplexNoise {
    constructor(seed = Math.random()) {
        this.p = new Uint8Array(512);
        const perm = new Uint8Array(256);
        for (let i = 0; i < 256; i++) perm[i] = i;
        let s = Math.floor(seed * 65536);
        for (let i = 255; i > 0; i--) {
            s = (s * 1664525 + 1013904223) & 0xffffffff;
            const j = ((s >>> 0) % (i + 1));
            [perm[i], perm[j]] = [perm[j], perm[i]];
        }
        for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
        this.grad3 = [
            [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
            [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
            [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
        ];
    }

    dot(g, x, y) { return g[0]*x + g[1]*y; }

    noise2D(xin, yin) {
        const F2 = 0.5*(Math.sqrt(3)-1);
        const G2 = (3-Math.sqrt(3))/6;
        const s = (xin+yin)*F2;
        const i = Math.floor(xin+s);
        const j = Math.floor(yin+s);
        const t = (i+j)*G2;
        const X0 = i-t, Y0 = j-t;
        const x0 = xin-X0, y0 = yin-Y0;
        let i1, j1;
        if (x0>y0) { i1=1; j1=0; } else { i1=0; j1=1; }
        const x1=x0-i1+G2, y1=y0-j1+G2;
        const x2=x0-1+2*G2, y2=y0-1+2*G2;
        const ii=i&255, jj=j&255;
        const gi0=this.p[ii+this.p[jj]]%12;
        const gi1=this.p[ii+i1+this.p[jj+j1]]%12;
        const gi2=this.p[ii+1+this.p[jj+1]]%12;
        let n0=0,n1=0,n2=0;
        let t0=0.5-x0*x0-y0*y0;
        if (t0>=0) { t0*=t0; n0=t0*t0*this.dot(this.grad3[gi0],x0,y0); }
        let t1=0.5-x1*x1-y1*y1;
        if (t1>=0) { t1*=t1; n1=t1*t1*this.dot(this.grad3[gi1],x1,y1); }
        let t2=0.5-x2*x2-y2*y2;
        if (t2>=0) { t2*=t2; n2=t2*t2*this.dot(this.grad3[gi2],x2,y2); }
        return 70*(n0+n1+n2);
    }

    octave(x, y, octaves=4, persistence=0.5, lacunarity=2) {
        let val=0, amp=1, freq=1, max=0;
        for (let i=0; i<octaves; i++) {
            val += this.noise2D(x*freq, y*freq)*amp;
            max += amp;
            amp *= persistence;
            freq *= lacunarity;
        }
        return val/max;
    }
}
