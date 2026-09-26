/**
 * GENOME INDEX ENGINE
 * ===================
 * DOM-free index structures for bwt.html (how read mappers find a read in a
 * genome):
 *
 *  - k-mer (hash) index: k-mer → positions; seeds, diagonal voting, verification
 *  - suffix trie and suffix tree (path-compressed trie), pattern search
 *  - suffix array, binary search with a recorded trace
 *  - Burrows–Wheeler transform from sorted rotations, inversion by LF-mapping
 *  - FM-index: C table, Occ (rank) table, backward search with recorded steps,
 *    locate through the suffix array
 *  - approximate matching by backtracking (substitutions), with the number of
 *    search steps, and read mapping on both strands against a small genome
 *
 * The text always ends with the sentinel '$', which sorts before every letter.
 */
const BwtEngine = (() => {
    const COMP = { A: 'T', C: 'G', G: 'C', T: 'A', N: 'N' };
    const revcomp = s => { let o = ''; for (let i = s.length - 1; i >= 0; i--) o += COMP[s[i]] || 'N'; return o; };
    const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);      // '$' (36) < 'A' (65): plain string order works

    function hashString(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
    class Rng {
        constructor(seed) { let a = (typeof seed === 'number' ? seed : hashString(String(seed))) >>> 0; this.next = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
        int(lo, hi) { return lo + Math.floor(this.next() * (hi - lo + 1)); }
        pick(a) { return a[Math.floor(this.next() * a.length)]; }
        chance(p) { return this.next() < p; }
        seq(n, alpha = 'ACGT') { let s = ''; for (let i = 0; i < n; i++) s += alpha[Math.floor(this.next() * alpha.length)]; return s; }
    }

    // ------------------------------------------------------------ k-mer index
    function kmerIndex(text, k) {
        const idx = new Map();
        for (let i = 0; i + k <= text.length; i++) { const w = text.substr(i, k); if (!idx.has(w)) idx.set(w, []); idx.get(w).push(i); }
        return idx;
    }
    const hamming = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; };
    /**
     * Seed-and-verify with a k-mer index: every k-mer of the read is looked up (a seed); each hit votes for the
     * read's start (hit position − offset in the read); candidates are verified by counting mismatches.
     */
    function kmerMap(genome, idx, k, read, maxMis = 2) {
        const seeds = [], votes = new Map();
        for (let o = 0; o + k <= read.length; o++) {
            const w = read.substr(o, k), hits = idx.get(w) || [];
            seeds.push({ offset: o, kmer: w, hits });
            for (const h of hits) { const d = h - o; votes.set(d, (votes.get(d) || 0) + 1); }
        }
        const candidates = [...votes.entries()].map(([pos, v]) => {
            const ok = pos >= 0 && pos + read.length <= genome.length;
            return { pos, votes: v, mismatches: ok ? hamming(read, genome.substr(pos, read.length)) : null };
        }).sort((a, b) => b.votes - a.votes || a.pos - b.pos);
        const hits = candidates.filter(c => c.mismatches !== null && c.mismatches <= maxMis);
        return { seeds, candidates, hits, lookups: seeds.length };
    }

    // ------------------------------------------------------------ suffix trie and suffix tree
    function suffixTrie(text) {
        const root = { ch: '', children: new Map(), leaf: null, depth: 0 };
        let nodes = 1;
        for (let i = 0; i < text.length; i++) {
            let n = root;
            for (let j = i; j < text.length; j++) {
                const c = text[j];
                if (!n.children.has(c)) { n.children.set(c, { ch: c, children: new Map(), leaf: null, depth: n.depth + 1 }); nodes++; }
                n = n.children.get(c);
            }
            n.leaf = i;
        }
        return { root, nodes };
    }
    // path compression: every chain of single-child nodes becomes one edge labelled with a substring
    function suffixTree(text) {
        const trie = suffixTrie(text);
        const compress = (n, label) => {
            let lab = label, cur = n;
            while (cur.children.size === 1 && cur.leaf === null) { const c = [...cur.children.values()][0]; lab += c.ch; cur = c; }
            return { label: lab, leaf: cur.leaf, children: [...cur.children.values()].sort((a, b) => cmp(a.ch, b.ch)).map(c => compress(c, c.ch)) };
        };
        const root = { label: '', leaf: null, children: [...trie.root.children.values()].sort((a, b) => cmp(a.ch, b.ch)).map(c => compress(c, c.ch)) };
        let nodes = 0;
        const count = n => { nodes++; n.children.forEach(count); };
        count(root);
        return { root, nodes, trieNodes: trie.nodes, trie };
    }
    // follow a pattern from the root of the trie; returns the path and the leaves (occurrences) below its end
    function trieSearch(trie, p) {
        const path = [trie.root];
        let n = trie.root;
        for (const c of p) { if (!n.children.has(c)) return { found: false, path, matched: path.length - 1, leaves: [] }; n = n.children.get(c); path.push(n); }
        const leaves = [];
        const collect = x => { if (x.leaf !== null) leaves.push(x.leaf); x.children.forEach(collect); };
        collect(n);
        return { found: true, path, matched: p.length, leaves: leaves.sort((a, b) => a - b), end: n };
    }

    // ------------------------------------------------------------ suffix array
    function suffixArray(text) {
        return Array.from({ length: text.length }, (_, i) => i).sort((a, b) => cmp(text.slice(a), text.slice(b)));
    }
    // binary search for the first and the last suffix starting with p; every comparison is recorded
    function saSearch(text, sa, p) {
        const trace = [];
        const pre = i => text.substr(sa[i], p.length);
        let lo = 0, hi = sa.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; const c = cmp(pre(mid), p); trace.push({ phase: 'first', lo, hi, mid, prefix: pre(mid), cmp: c }); if (c < 0) lo = mid + 1; else hi = mid; }
        const first = lo;
        hi = sa.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; const c = cmp(pre(mid), p); trace.push({ phase: 'last', lo, hi, mid, prefix: pre(mid), cmp: c }); if (c <= 0) lo = mid + 1; else hi = mid; }
        return { first, end: lo, count: lo - first, positions: sa.slice(first, lo).sort((a, b) => a - b), trace };
    }

    // ------------------------------------------------------------ BWT
    function rotations(text) {
        return Array.from({ length: text.length }, (_, i) => ({ start: i, rot: text.slice(i) + text.slice(0, i) })).sort((a, b) => cmp(a.rot, b.rot));
    }
    function bwt(text, sa = suffixArray(text)) { return sa.map(i => text[(i - 1 + text.length) % text.length]).join(''); }

    // C[c] = number of characters in the text smaller than c; Occ[i][c] = occurrences of c in L[0..i)
    function fmIndex(L) {
        const alphabet = [...new Set(L)].sort(cmp);
        const counts = Object.fromEntries(alphabet.map(c => [c, 0]));
        for (const c of L) counts[c]++;
        const C = {}; let acc = 0;
        for (const c of alphabet) { C[c] = acc; acc += counts[c]; }
        const occ = [Object.fromEntries(alphabet.map(c => [c, 0]))];
        for (let i = 0; i < L.length; i++) { const row = Object.assign({}, occ[i]); row[L[i]]++; occ.push(row); }
        return { L, alphabet, C, occ, n: L.length };
    }
    const rank = (fm, c, i) => (fm.occ[i][c] || 0);
    // LF(i): the row of the rotation that starts with L[i]
    const LF = (fm, i) => fm.C[fm.L[i]] + rank(fm, fm.L[i], i);

    // invert the BWT: start at the row beginning with '$' (row 0) and step backwards with LF
    function inverse(fm) {
        const steps = [];
        let i = 0, text = '$';
        for (let s = 0; s < fm.n - 1; s++) {
            const c = fm.L[i], j = LF(fm, i);
            steps.push({ row: i, c, next: j, rankBefore: rank(fm, c, i) });
            text = c + text; i = j;
        }
        return { text, steps };
    }

    // backward search: interval [sp, ep) of rows prefixed by the pattern, processing the pattern from its last letter
    function backwardSearch(fm, p) {
        let sp = 0, ep = fm.n;
        const steps = [];
        for (let k = p.length - 1; k >= 0; k--) {
            const c = p[k];
            if (fm.C[c] === undefined) { steps.push({ k, c, sp, ep, nsp: 0, nep: 0, missing: true }); return { sp: 0, ep: 0, count: 0, steps }; }
            const nsp = fm.C[c] + rank(fm, c, sp), nep = fm.C[c] + rank(fm, c, ep);
            steps.push({ k, c, sp, ep, nsp, nep, rsp: rank(fm, c, sp), rep: rank(fm, c, ep), C: fm.C[c] });
            sp = nsp; ep = nep;
            if (sp >= ep) return { sp, ep, count: 0, steps };
        }
        return { sp, ep, count: ep - sp, steps };
    }

    /**
     * Approximate search by backtracking: at every backward step try all letters; a letter different from the
     * pattern's costs one mismatch. Returns the hits (with the aligned text) and how many search steps were taken.
     */
    function backtrack(fm, sa, p, maxMis) {
        const hits = [];
        let steps = 0;
        const letters = fm.alphabet.filter(c => c !== '$');
        const rec = (k, sp, ep, mis, suffix) => {
            if (k < 0) { for (let r = sp; r < ep; r++) hits.push({ pos: sa[r], mismatches: mis, matched: suffix }); return; }
            for (const c of letters) {
                const cost = c === p[k] ? 0 : 1;
                if (mis + cost > maxMis) continue;
                steps++;
                const nsp = fm.C[c] + rank(fm, c, sp), nep = fm.C[c] + rank(fm, c, ep);
                if (nsp < nep) rec(k - 1, nsp, nep, mis + cost, c + suffix);
            }
        };
        rec(p.length - 1, 0, fm.n, 0, '');
        hits.sort((a, b) => a.mismatches - b.mismatches || a.pos - b.pos);
        return { hits, steps };
    }

    // ------------------------------------------------------------ read mapping on a small genome
    function buildGenome(p) {
        const rng = new Rng('bwt-genome-' + p.seed);
        const u = Math.max(10, Math.round((p.G - p.repeatCopies * p.repeatLength) / (p.repeatCopies + 1)));
        const rep = rng.seq(p.repeatLength);
        let seq = '';
        const repeats = [];
        for (let b = 0; b <= p.repeatCopies; b++) {
            seq += rng.seq(u);
            if (b < p.repeatCopies && p.repeatLength > 0) { repeats.push({ start: seq.length, end: seq.length + p.repeatLength }); seq += rep; }
        }
        return { seq, repeats };
    }
    function simulateReads(genome, p) {
        const rng = new Rng('bwt-reads-' + p.seed);
        const G = genome.seq.length, reads = [];
        for (let i = 0; i < p.n; i++) {
            const start = rng.int(0, G - p.L), strand = rng.chance(0.5) ? 1 : -1;
            let s = genome.seq.substr(start, p.L);
            if (strand < 0) s = revcomp(s);
            const c = s.split(''), errors = [];
            for (let k = 0; k < c.length; k++) if (rng.chance(p.errorRate)) { c[k] = 'ACGT'.replace(c[k], '')[rng.int(0, 2)]; errors.push(k); }
            reads.push({ id: i, name: 'read' + (i + 1), seq: c.join(''), start, strand, errors });
        }
        return reads;
    }
    // map one read: search it and its reverse complement, keep the hits with the fewest mismatches
    function mapRead(fm, sa, read, maxMis) {
        const fw = backtrack(fm, sa, read.seq, maxMis), rv = backtrack(fm, sa, revcomp(read.seq), maxMis);
        const all = fw.hits.map(h => Object.assign({ strand: 1 }, h)).concat(rv.hits.map(h => Object.assign({ strand: -1 }, h)));
        const best = all.length ? Math.min(...all.map(h => h.mismatches)) : null;
        const top = all.filter(h => h.mismatches === best);
        const status = !all.length ? 'unmapped' : top.length > 1 ? 'multi' : 'unique';
        const correct = top.some(h => h.pos === read.start && h.strand === read.strand);
        return { hits: all, top, best, status, correct, steps: fw.steps + rv.steps };
    }

    return { revcomp, cmp, Rng, kmerIndex, hamming, kmerMap, suffixTrie, suffixTree, trieSearch, suffixArray, saSearch, rotations, bwt, fmIndex, rank, LF, inverse,
             backwardSearch, backtrack, buildGenome, simulateReads, mapRead };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BwtEngine;
}
