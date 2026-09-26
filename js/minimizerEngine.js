/**
 * MINIMIZER MAPPING ENGINE
 * ========================
 * DOM-free model of long-read mapping in the style of minimap2, for
 * minimizers.html:
 *
 *  - (w,k)-minimizers: the smallest k-mer in every window of w consecutive
 *    k-mers, by lexicographic order or by a hash; window-by-window trace
 *  - minimizer index of a reference, frequency filter
 *  - anchors (read position, reference position, strand) from shared minimizers
 *  - chaining by dynamic programming with minimap2's gap cost; primary and
 *    secondary chains; mapping quality from the two best chain scores
 *  - simulation of a reference with repeats and of long reads with
 *    substitution, insertion and deletion errors
 *
 * k ≤ 15, so a k-mer fits in a 32-bit integer (2 bits per base).
 */
const MinimizerEngine = (() => {
    const BASES = 'ACGT', CODE = { A: 0, C: 1, G: 2, T: 3 };
    const COMP = { A: 'T', C: 'G', G: 'C', T: 'A', N: 'N' };
    const revcomp = s => { let o = ''; for (let i = s.length - 1; i >= 0; i--) o += COMP[s[i]] || 'N'; return o; };

    function hashString(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
    class Rng {
        constructor(seed) { let a = (typeof seed === 'number' ? seed : hashString(String(seed))) >>> 0; this.next = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
        int(lo, hi) { return lo + Math.floor(this.next() * (hi - lo + 1)); }
        pick(a) { return a[Math.floor(this.next() * a.length)]; }
        chance(p) { return this.next() < p; }
        seq(n, alpha = BASES) { let s = ''; for (let i = 0; i < n; i++) s += alpha[Math.floor(this.next() * alpha.length)]; return s; }
    }

    // ------------------------------------------------------------ k-mer values
    const code = kmer => { let v = 0; for (const c of kmer) v = v * 4 + (CODE[c] === undefined ? 0 : CODE[c]); return v; };
    // an invertible integer mix (like minimap2's hash64, on 32 bits): consecutive codes get unrelated values
    function mix(x, k) {
        const mask = k >= 16 ? 0xffffffff : (1 << (2 * k)) - 1;
        x = (~x + (x << 15)) & mask; x ^= x >>> 12; x = (x + (x << 2)) & mask; x ^= x >>> 4; x = Math.imul(x, 2057) & mask; x ^= x >>> 16;
        return x >>> 0;
    }
    const value = (kmer, k, order) => order === 'hash' ? mix(code(kmer), k) : code(kmer);

    /**
     * (w,k)-minimizers of a sequence. Returns the selected positions (each once) and, for teaching, the choice made
     * in every window. Ties are broken by the leftmost position.
     */
    function minimizers(seq, k, w, order = 'hash') {
        const n = seq.length - k + 1;
        if (n <= 0) return { list: [], windows: [], nKmers: 0 };
        const vals = Array.from({ length: n }, (_, i) => value(seq.substr(i, k), k, order));
        const windows = [], chosen = new Map();
        for (let s = 0; s + w <= n; s++) {
            let best = s;
            for (let j = s + 1; j < s + w; j++) if (vals[j] < vals[best]) best = j;
            windows.push({ start: s, pos: best });
            chosen.set(best, { pos: best, kmer: seq.substr(best, k), value: vals[best] });
        }
        if (n < w) { let best = 0; for (let j = 1; j < n; j++) if (vals[j] < vals[best]) best = j; chosen.set(best, { pos: best, kmer: seq.substr(best, k), value: vals[best] }); }
        return { list: [...chosen.values()].sort((a, b) => a.pos - b.pos), windows, vals, nKmers: n };
    }

    // ------------------------------------------------------------ index and anchors
    function buildIndex(ref, k, w, order) {
        const mz = minimizers(ref, k, w, order);
        const idx = new Map();
        for (const m of mz.list) { if (!idx.has(m.value)) idx.set(m.value, []); idx.get(m.value).push(m.pos); }
        return { idx, k, w, order, entries: mz.list.length, distinct: idx.size, kmers: mz.nKmers, list: mz.list };
    }
    // minimizers occurring more often than `maxOcc` in the reference are ignored (repeats would flood the anchors)
    function anchors(read, index, maxOcc = Infinity) {
        const out = [];
        let filtered = 0;
        for (const [strand, s] of [[1, read], [-1, revcomp(read)]]) {
            for (const m of minimizers(s, index.k, index.w, index.order).list) {
                const hits = index.idx.get(m.value);
                if (!hits) continue;
                if (hits.length > maxOcc) { filtered++; continue; }
                for (const t of hits) out.push({ q: m.pos, t, strand, kmer: m.kmer });
            }
        }
        return { anchors: out, filtered };
    }

    // ------------------------------------------------------------ chaining (minimap2, Li 2018)
    // gap cost γ(l) = 0.01·k·l + 0.5·log2(l) for a difference l between the read and the reference distance
    const gapCost = (l, k) => l === 0 ? 0 : 0.01 * k * l + 0.5 * Math.log2(l);
    /**
     * f(i) = max( k, max_j f(j) + α(j,i) − β(j,i) ), α = matched bases gained (≤ k), β = gap cost;
     * j must lie before i on both sequences, within maxGap and with diagonal difference ≤ bandwidth.
     */
    function chain(anchorsIn, opts = {}) {
        const o = Object.assign({ k: 15, maxGap: 500, bandwidth: 100, maxPred: 50, minScore: 40, maxChains: 5 }, opts);
        const chains = [], dp = [];
        for (const strand of [1, -1]) {
            const A = anchorsIn.filter(a => a.strand === strand).sort((a, b) => a.t - b.t || a.q - b.q);
            const f = new Array(A.length), pred = new Array(A.length).fill(-1), considered = [];
            for (let i = 0; i < A.length; i++) {
                f[i] = o.k;
                const cand = [];
                for (let j = i - 1, seen = 0; j >= 0 && seen < o.maxPred; j--, seen++) {
                    const dq = A[i].q - A[j].q, dt = A[i].t - A[j].t;
                    if (dt > o.maxGap) break;
                    if (dq <= 0 || dt <= 0 || dq > o.maxGap) continue;
                    const l = Math.abs(dq - dt);
                    if (l > o.bandwidth) continue;
                    const alpha = Math.min(dq, dt, o.k), beta = gapCost(l, o.k), sc = f[j] + alpha - beta;
                    cand.push({ j, alpha, beta, score: sc });
                    if (sc > f[i]) { f[i] = sc; pred[i] = j; }
                }
                considered.push(cand);
            }
            dp.push({ strand, A, f, pred, considered });
            // backtrack chains from the best unused end
            const used = new Array(A.length).fill(false);
            const order = A.map((_, i) => i).sort((x, y) => f[y] - f[x]);
            for (const end of order) {
                if (used[end]) continue;
                const idxs = [];
                let i = end;
                while (i >= 0 && !used[i]) { idxs.push(i); used[i] = true; i = pred[i]; }
                const members = idxs.reverse().map(x => A[x]);
                // score counts only the part of the chain not shared with an earlier chain
                const score = f[end] - (i >= 0 ? f[i] : 0);
                if (score < o.minScore || members.length < 2) continue;
                chains.push({ strand, anchors: members, idx: idxs, score, qStart: members[0].q, qEnd: members[members.length - 1].q + o.k, tStart: members[0].t, tEnd: members[members.length - 1].t + o.k });
            }
        }
        chains.sort((a, b) => b.score - a.score);
        // a secondary chain overlapping the primary on the read is an alternative placement (e.g. another repeat copy)
        const primary = chains[0] || null;
        const secondaries = primary ? chains.slice(1).filter(c => Math.min(c.qEnd, primary.qEnd) - Math.max(c.qStart, primary.qStart) > 0.5 * (c.qEnd - c.qStart)) : [];
        return { chains: chains.slice(0, o.maxChains), primary, secondaries, dp };
    }

    // minimap2's mapping quality: 40 · (1 − f2/f1) · min(1, m/10) · ln f1, capped at 60
    function mapq(primary, secondaries) {
        if (!primary) return { mapq: 0, f1: 0, f2: 0, m: 0 };
        const f1 = primary.score, f2 = secondaries.length ? Math.max(...secondaries.map(c => c.score)) : 0, m = primary.anchors.length;
        const q = Math.max(0, Math.min(60, Math.round(40 * (1 - f2 / f1) * Math.min(1, m / 10) * Math.log(f1))));
        return { mapq: q, f1, f2, m };
    }

    // ------------------------------------------------------------ simulation
    /**
     * Reference: random sequence with repeat families (each in `copies` identical copies) and one poly-A run.
     */
    function buildReference(p) {
        const rng = new Rng('mm-ref-' + p.seed);
        const G = p.G;
        const ref = rng.seq(G).split('');
        const repeats = [];
        const slots = Math.floor(G / p.repeatLength);
        const taken = new Set();
        for (let f = 0; f < p.families; f++) {
            const unit = rng.seq(p.repeatLength);
            for (let c = 0; c < p.copies; c++) {
                let s;
                for (let t = 0; t < 200; t++) { s = rng.int(1, slots - 2); if (!taken.has(s) && !taken.has(s - 1) && !taken.has(s + 1)) break; }
                taken.add(s);
                const start = s * p.repeatLength;
                for (let i = 0; i < p.repeatLength; i++) ref[start + i] = unit[i];
                repeats.push({ family: f, copy: c, start, end: start + p.repeatLength });
            }
        }
        if (p.polyA) { const s = rng.int(0, G - p.polyA); for (let i = 0; i < p.polyA; i++) ref[s + i] = 'A'; repeats.push({ family: -1, start: s, end: s + p.polyA, polyA: true }); }
        return { seq: ref.join(''), repeats: repeats.sort((a, b) => a.start - b.start) };
    }
    /**
     * Long reads: random start, length ~ uniform [minLen, maxLen], either strand; errors at rate e split into
     * substitutions (40 %), insertions (30 %) and deletions (30 %), as typical of nanopore reads.
     */
    function simulateReads(ref, p) {
        const rng = new Rng('mm-reads-' + p.seed);
        const G = ref.seq.length, reads = [];
        for (let i = 0; i < p.n; i++) {
            const len = rng.int(p.minLen, p.maxLen);
            const start = p.fixedStart !== undefined ? p.fixedStart : rng.int(0, G - len);
            const strand = p.strand || (rng.chance(0.5) ? 1 : -1);
            const src = ref.seq.substr(start, len);
            let out = '';
            let subs = 0, ins = 0, dels = 0;
            for (const c of src) {
                if (rng.chance(p.errorRate)) {
                    const r = rng.next();
                    if (r < 0.4) { out += BASES.replace(c, '')[rng.int(0, 2)]; subs++; }
                    else if (r < 0.7) { out += c + rng.seq(1); ins++; }
                    else { dels++; }
                } else out += c;
            }
            reads.push({ id: i, name: 'read' + (i + 1), seq: strand > 0 ? out : revcomp(out), start, end: start + len, strand, len: out.length, errors: { subs, ins, dels } });
        }
        return reads;
    }

    // map one read: anchors → chains → MAPQ; correct if the primary chain overlaps the true origin on the true strand
    function mapRead(read, index, opts = {}) {
        const o = Object.assign({ maxOcc: 20 }, opts);
        const an = anchors(read.seq, index, o.maxOcc);
        const ch = chain(an.anchors, Object.assign({ k: index.k }, o));
        const q = mapq(ch.primary, ch.secondaries);
        let correct = null;
        if (ch.primary && read.start !== undefined) {
            const ov = Math.min(ch.primary.tEnd, read.end) - Math.max(ch.primary.tStart, read.start);
            correct = ch.primary.strand === read.strand && ov > 0.5 * (ch.primary.tEnd - ch.primary.tStart);
        }
        return { anchors: an.anchors, filtered: an.filtered, chain: ch, mapq: q, correct };
    }

    // reference span of the primary chain, extended to the read ends, for base-level alignment
    function alignmentRegion(read, primary, refLen) {
        const q = primary.strand > 0 ? read.seq : revcomp(read.seq);
        const t0 = Math.max(0, primary.tStart - primary.qStart), t1 = Math.min(refLen, primary.tEnd + (q.length - primary.qEnd));
        return { query: q, tStart: t0, tEnd: t1 };
    }
    // CIGAR string of an alignment of a read (a1) to the reference (a2): M = aligned pair, I = base in the read only, D = base in the reference only
    function cigar(a1, a2) {
        let out = '', last = '', n = 0;
        for (let i = 0; i < a1.length; i++) {
            const op = a1[i] === '-' ? 'D' : a2[i] === '-' ? 'I' : 'M';          // a1 = read, a2 = reference
            if (op === last) n++; else { if (n) out += n + last; last = op; n = 1; }
        }
        return out + (n ? n + last : '');
    }

    return { BASES, Rng, revcomp, code, mix, value, minimizers, buildIndex, anchors, gapCost, chain, mapq, buildReference, simulateReads, mapRead, alignmentRegion, cigar };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MinimizerEngine;
}
