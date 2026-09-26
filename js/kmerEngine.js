/**
 * K-MER SPECTRUM ENGINE
 * =====================
 * DOM-free simulation and analysis for kmer-spectrum.html:
 *
 *   genome (haplotypes with SNPs, repeat families with diverged copies)
 *     → reads (random positions, both strands, substitution errors)
 *     → canonical k-mer counts (as `jellyfish count -C`)
 *     → histogram (as `jellyfish histo`)
 *     → estimates: genome size from the peak, and a GenomeScope-like mixture
 *       fit giving genome size, heterozygosity, repeat content and error rate.
 *
 * k-mers are encoded as numbers (2 bits per base; k ≤ 26 stays exact in a
 * double, the app offers k ≤ 25) and counted in an open-addressing hash table on typed arrays, so a
 * few hundred kb at 50× take about a second. The genomes' own k-mers are
 * counted as well: every read k-mer then gets its true origin (error, or
 * present m times in the genome), which the app can reveal as colours.
 */
const KmerEngine = (() => {
    const BASES = 'ACGT';

    // ------------------------------------------------------------ RNG
    function hashString(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
    class Rng {
        constructor(seed) { let a = (typeof seed === 'number' ? seed : hashString(String(seed))) >>> 0; this.next = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
        int(lo, hi) { return lo + Math.floor(this.next() * (hi - lo + 1)); }
        pick(a) { return a[Math.floor(this.next() * a.length)]; }
        chance(p) { return this.next() < p; }
        base() { return Math.floor(this.next() * 4); }
        other(b) { return (b + 1 + Math.floor(this.next() * 3)) % 4; }
        shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(this.next() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; }
    }

    // ------------------------------------------------------------ hash table: number key -> count
    class KmerTable {
        constructor(cap = 1 << 16) { this.alloc(cap); }
        alloc(cap) { this.cap = cap; this.mask = cap - 1; this.keys = new Float64Array(cap).fill(-1); this.vals = new Uint32Array(cap); this.size = 0; }
        slot(key) {
            const hi = Math.floor(key / 67108864), lo = key - hi * 67108864;            // key = hi·2^26 + lo
            let h = Math.imul(lo ^ Math.imul(hi, 0x9E3779B1), 0x85EBCA6B);
            h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16;
            let i = h & this.mask;
            while (this.keys[i] !== -1 && this.keys[i] !== key) i = (i + 1) & this.mask;
            return i;
        }
        add(key, n = 1) {
            let i = this.slot(key);
            if (this.keys[i] === -1) {
                if ((this.size + 1) * 10 > this.cap * 6) { this.grow(); i = this.slot(key); }
                this.keys[i] = key; this.size++;
            }
            this.vals[i] += n;
        }
        get(key) { const i = this.slot(key); return this.keys[i] === -1 ? 0 : this.vals[i]; }
        grow() {
            const ok = this.keys, ov = this.vals;
            this.alloc(this.cap * 2);
            for (let i = 0; i < ok.length; i++) if (ok[i] !== -1) { const j = this.slot(ok[i]); this.keys[j] = ok[i]; this.vals[j] = ov[i]; this.size++; }
        }
        forEach(fn) { for (let i = 0; i < this.cap; i++) if (this.keys[i] !== -1) fn(this.keys[i], this.vals[i]); }
    }

    // canonical k-mer codes of a base array (0–3), calling fn(code, position) for every window
    function forEachKmer(bases, len, k, fn) {
        const top = Math.pow(4, k - 1);
        let f = 0, r = 0;
        for (let i = 0; i < len; i++) {
            const b = bases[i];
            f = (f % top) * 4 + b;
            r = Math.floor(r / 4) + (3 - b) * top;
            if (i >= k - 1) fn(f < r ? f : r, i - k + 1);
        }
    }
    const encode = s => { const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = BASES.indexOf(s[i]); return a; };
    const decode = (a, from = 0, to = a.length) => { let s = ''; for (let i = from; i < to; i++) s += BASES[a[i]]; return s; };
    function codeToString(code, k) { let s = ''; for (let i = 0; i < k; i++) { s = BASES[code % 4] + s; code = Math.floor(code / 4); } return s; }
    function canonicalString(s) { const rc = s.split('').reverse().map(c => BASES[3 - BASES.indexOf(c)]).join(''); return s < rc ? s : rc; }

    // ------------------------------------------------------------ genome
    /**
     * p: { G, ploidy (1|2), het (SNP rate between haplotypes), repeatFraction, repeatCopies,
     *      repeatLength (bp per copy), repeatDivergence, seed }
     * Returns haplotypes (Uint8Array each) and the truth.
     */
    function buildGenome(p) {
        const rng = new Rng('genome-' + p.seed);
        const G = Math.round(p.G);
        const A = new Uint8Array(G);
        for (let i = 0; i < G; i++) A[i] = rng.base();
        const isRepeat = new Uint8Array(G);
        const copies = Math.max(2, p.repeatCopies | 0), elen = Math.max(50, Math.min(p.repeatLength | 0, Math.floor(G / (2 * copies))));
        let families = 0;
        if (p.repeatFraction > 0) {
            // non-overlapping slots of one element length, filled family by family
            const nSlots = Math.floor(G / elen);
            const want = Math.min(nSlots, Math.round(p.repeatFraction * G / elen));
            const nFam = Math.max(1, Math.floor(want / copies));
            const slots = rng.shuffle(Array.from({ length: nSlots }, (_, i) => i)).slice(0, nFam * copies);
            for (let f = 0; f < nFam; f++) {
                const el = new Uint8Array(elen);
                for (let i = 0; i < elen; i++) el[i] = rng.base();
                for (let c = 0; c < copies; c++) {
                    const s0 = slots[f * copies + c] * elen;
                    for (let i = 0; i < elen; i++) { A[s0 + i] = rng.chance(p.repeatDivergence || 0) ? rng.other(el[i]) : el[i]; isRepeat[s0 + i] = 1; }
                }
                families++;
            }
        }
        const haps = [A];
        let snps = 0;
        if (p.ploidy === 2) {
            const B = A.slice();
            for (let i = 0; i < G; i++) if (rng.chance(p.het || 0)) { B[i] = rng.other(B[i]); snps++; }
            haps.push(B);
        }
        const repeatBases = isRepeat.reduce((a, b) => a + b, 0);
        return { haps, G, truth: { G, ploidy: p.ploidy, het: p.ploidy === 2 ? snps / G : 0, snps, repeatFraction: repeatBases / G, families, copies, elementLength: elen } };
    }

    // ------------------------------------------------------------ reads and counting
    /**
     * p: { coverage (total, per haploid genome length), readLength, errorRate, k, seed, keepReads }
     * Reads start uniformly at random on a random haplotype and strand.
     */
    function sequenceAndCount(genome, p, onProgress) {
        const rng = new Rng('reads-' + p.seed + '-' + p.coverage + '-' + p.readLength + '-' + p.errorRate);
        const G = genome.G, L = Math.min(p.readLength, G), k = p.k;
        const N = Math.round(p.coverage * G / L);
        const table = new KmerTable(1 << 16);
        const buf = new Uint8Array(L);
        const reads = p.keepReads ? [] : null;
        let errors = 0, kmerTotal = 0;
        for (let r = 0; r < N; r++) {
            const hap = genome.haps.length > 1 ? rng.int(0, genome.haps.length - 1) : 0;
            const H = genome.haps[hap], start = rng.int(0, G - L), minus = rng.chance(0.5);
            const errPos = [];
            for (let i = 0; i < L; i++) {
                let b = minus ? 3 - H[start + L - 1 - i] : H[start + i];
                if (p.errorRate && rng.chance(p.errorRate)) { b = rng.other(b); errPos.push(i); errors++; }
                buf[i] = b;
            }
            forEachKmer(buf, L, k, code => { table.add(code); kmerTotal++; });
            if (reads) reads.push({ hap, start, minus, seq: decode(buf, 0, L), errors: errPos });
        }
        return { table, N, L, k, errors, kmerTotal, reads };
    }

    // k-mers of the genome itself: how many times each canonical k-mer occurs across all haplotypes
    function genomeKmers(genome, k) {
        const t = new KmerTable(1 << 16);
        for (const H of genome.haps) forEachKmer(H, H.length, k, code => t.add(code));
        return t;
    }

    /**
     * Histogram h[n] = number of distinct k-mers seen n times (n ≥ 1; counts above maxCount pooled in the last bin),
     * split by true origin: byCopy[m][n] for k-mers present m times in the genome (m = 0: errors; m ≥ 5 pooled).
     */
    function histogram(counts, truthTable, maxCount = 2000) {
        const h = new Float64Array(maxCount + 1);
        const byCopy = Array.from({ length: 6 }, () => new Float64Array(maxCount + 1));
        counts.table.forEach((key, n) => {
            const c = Math.min(n, maxCount);
            h[c]++;
            if (truthTable) byCopy[Math.min(5, truthTable.get(key))][c]++;
        });
        return { h, byCopy: truthTable ? byCopy : null, maxCount, distinct: counts.table.size, total: counts.kmerTotal };
    }

    // ------------------------------------------------------------ simple analysis
    // first local minimum after n = 1 (the valley between error k-mers and the genome)
    function valley(h, maxN = 200) {
        for (let n = 2; n < Math.min(h.length - 1, maxN); n++) if (h[n] <= h[n - 1] && h[n] < h[n + 1]) return n;
        return 2;
    }
    // highest bin at or above `from`
    function peakAbove(h, from, to = h.length - 1) {
        let best = from;
        for (let n = from; n <= to; n++) if (h[n] > h[best]) best = n;
        return best;
    }
    function totalAbove(h, from) { let s = 0; for (let n = from; n < h.length; n++) s += n * h[n]; return s; }

    // genome size from a chosen peak: every genome position contributes `depth` k-mer occurrences on average
    function sizeFromPeak(h, depth, cutoff) { return totalAbove(h, cutoff) / depth; }

    const lgamma = x => {                                         // Lanczos
        const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
        if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
        x -= 1; let a = c[0]; const t = x + g + 0.5;
        for (let i = 1; i < 9; i++) a += c[i] / (x + i);
        return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
    };
    const logPois = (n, mu) => n * Math.log(mu) - mu - lgamma(n + 1);
    // negative binomial with mean mu and size r (variance mu + mu²/r); r = Infinity → Poisson
    const logNB = (n, mu, r) => !isFinite(r) ? logPois(n, mu) : lgamma(n + r) - lgamma(r) - lgamma(n + 1) + r * Math.log(r / (r + mu)) + n * Math.log(mu / (r + mu));

    /**
     * GenomeScope-like fit: counts n ≥ cutoff are a mixture of peaks at j·λ (j = 1…J; j = number of copies of the
     * k-mer across the haplotypes), each a Poisson (or a slightly overdispersed negative binomial). λ = k-mer depth of one
     * copy (one haplotype). Grid search over λ and overdispersion, EM for the weights.
     */
    function fitModel(h, opts) {
        const o = Object.assign({ ploidy: 2, k: 21, cutoff: 2, J: 8, maxN: null, total: null }, opts);
        const top = o.maxN || Math.min(h.length - 2, 8 * Math.max(peakAbove(h, o.cutoff), 4));
        const ns = [], ys = [];
        for (let n = o.cutoff; n <= top; n++) if (h[n] > 0) { ns.push(n); ys.push(h[n]); }
        const Ntot = ys.reduce((a, b) => a + b, 0);
        if (!Ntot) return null;
        const peak = peakAbove(h, o.cutoff, top);
        // Which multiple of λ is the main peak? Haploid: one copy. Diploid: either the heterozygous peak (λ, one
        // allele) or the homozygous peak (2λ). Both readings are fitted; a reading whose homozygous component
        // (j = ploidy) is essentially empty is rejected, and the simpler reading (main peak = 1 copy) is kept
        // unless the other fits clearly better. (A homozygous diploid looks exactly like a haploid genome –
        // the ploidy must be known, as in GenomeScope.)
        const fitWindow = (lo, hi) => {
            let best = null;
            for (const r of [Infinity, 40]) for (let lam = lo; lam <= hi; lam *= 1.01) {
                let w = new Array(o.J).fill(1 / o.J);
                const lp = ns.map(n => Array.from({ length: o.J }, (_, j) => logNB(n, (j + 1) * lam, r)));
                let ll = -Infinity;
                for (let it = 0; it < 60; it++) {
                    const acc = new Array(o.J).fill(0); let tot = 0; ll = 0;
                    for (let i = 0; i < ns.length; i++) {
                        let m = -Infinity; const t = [];
                        for (let j = 0; j < o.J; j++) { t[j] = Math.log(w[j] + 1e-300) + lp[i][j]; if (t[j] > m) m = t[j]; }
                        let s2 = 0; for (let j = 0; j < o.J; j++) s2 += Math.exp(t[j] - m);
                        ll += ys[i] * (m + Math.log(s2));
                        for (let j = 0; j < o.J; j++) acc[j] += ys[i] * Math.exp(t[j] - m) / s2;
                        tot += ys[i];
                    }
                    w = acc.map(x => x / tot);
                }
                if (!best || ll > best.ll) best = { ll, lam, r, w };
            }
            return best;
        };
        const one = fitWindow(peak / 1.3, peak * 1.3);
        let best = one;
        if (o.ploidy === 2) {
            const two = fitWindow(peak / 2.6, peak / 1.6);
            const plausible = f => f.w[1] >= 0.08;                                  // homozygous component present
            // reading "main peak = homozygous" needs its own heterozygous peak at half the depth, or the other reading must be impossible
            if (!plausible(one) || (plausible(two) && two.w[0] >= 0.05 && two.ll > one.ll + 50)) best = two;
        }
        // number of distinct k-mers in each component (including the part of each peak below the cutoff)
        const Nj = best.w.map((w, j) => {
            let below = 0;
            for (let n = 1; n < o.cutoff; n++) below += Math.exp(logNB(n, (j + 1) * best.lam, best.r));
            return w * Ntot / Math.max(1e-9, 1 - below);
        });
        // Genome size from ALL k-mer occurrences above the cut-off (as GenomeScope): high-copy repeats far to the right
        // of the fitted peaks still count. `total` (all k-mer occurrences in the reads) avoids losing the pooled last bin.
        let low = 0; for (let n = 1; n < o.cutoff; n++) low += n * h[n];
        const occ = o.total ? o.total - low : totalAbove(h, o.cutoff);
        const G = occ / (o.ploidy * best.lam);
        // single-copy part of the genome: the peaks with at most `ploidy` copies (heterozygous + homozygous); everything else is repeats
        let uniquePositions = 0; for (let j = 0; j < o.ploidy; j++) uniquePositions += (j + 1) * Nj[j] / o.ploidy;
        const repeatFraction = Math.max(0, 1 - uniquePositions / G);
        let het = 0;
        if (o.ploidy === 2) {
            // p = share of k-mer windows containing a SNP. In unique sequence such a window gives two k-mers present once
            // (one per allele); inside a repeat copy only the new allele is present once (the old one merges with the other
            // copies). So N1 ≈ p·G·(2 − repeatFraction). Without repeats: p = (N1/2)/G, the two-peak formula of step 5.
            const pw = Nj[0] / (G * (2 - repeatFraction));
            het = 1 - Math.pow(Math.max(1e-12, Math.min(1, 1 - pw)), 1 / o.k);
        }
        return { lambda: best.lam, r: best.r, w: best.w, Nj, G, het, repeatFraction, cutoff: o.cutoff, top, ll: best.ll, J: o.J,
                 curve: n => best.w.reduce((s, w, j) => s + w * Ntot * Math.exp(logNB(n, (j + 1) * best.lam, best.r)), 0),
                 component: (j, n) => best.w[j] * Ntot * Math.exp(logNB(n, (j + 1) * best.lam, best.r)) };
    }

    // error rate from the k-mers below the cutoff: each error makes about k wrong k-mer occurrences
    function errorRate(h, cutoff, k, total) {
        let low = 0; for (let n = 1; n < cutoff; n++) low += n * h[n];
        return low / (k * total);
    }

    // ------------------------------------------------------------ one call for the app
    function run(p, opts = {}) {
        const genome = buildGenome(p);
        const counts = sequenceAndCount(genome, Object.assign({}, p, { keepReads: !!opts.keepReads }));
        const truthTable = genomeKmers(genome, p.k);
        const hist = histogram(counts, truthTable, opts.maxCount || 2000);
        const cutoff = valley(hist.h);
        const Lk = counts.L - p.k + 1;
        const depthHom = p.coverage * Lk / counts.L;                     // expected k-mer depth of a k-mer present on every haplotype
        return { p, genome, counts, truthTable, hist, cutoff, Lk, depthHom, lambda: depthHom / p.ploidy };
    }

    return { BASES, Rng, KmerTable, forEachKmer, encode, decode, codeToString, canonicalString, buildGenome, sequenceAndCount, genomeKmers, histogram,
             valley, peakAbove, totalAbove, sizeFromPeak, fitModel, errorRate, logPois, logNB, run };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = KmerEngine;
}
