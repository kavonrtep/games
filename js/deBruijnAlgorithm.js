/**
 * DE BRUIJN ASSEMBLY ENGINE
 * =========================
 * DOM-free model for assembly.html:
 *
 *   genome → simulated reads → k-mers → de Bruijn graph → unitigs (contigs)
 *
 * Nodes are (k−1)-mers, edges are k-mers: a k-mer connects its (k−1)-prefix
 * to its (k−1)-suffix. Maximal non-branching paths are contracted into
 * contigs (unitigs). A repeat whose copies are not spanned by a (k−1)-mer
 * becomes one shared node with several ways in and out – a branch – and every
 * contig stops there. Sequencing errors add low-coverage k-mers that form
 * tips (dead ends) and bubbles (parallel arms); a coverage threshold removes
 * them.
 *
 * Genomes and reads are generated with a seeded RNG, so scrubbing k never
 * changes the data under the student. Reads are tiled at a fixed step (not
 * random): coverage gaps then have a simple cause – the step is larger than
 * L − k + 1 – rather than sampling noise.
 */
const DeBruijn = (() => {
    const BASES = 'ACGT';

    function rngFrom(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    const randomBases = (n, rng) => { let s = ''; for (let i = 0; i < n; i++) s += BASES[Math.floor(rng() * 4)]; return s; };

    const DEFAULTS = { uniqueLen: 12, repeatLength: 8, repeatCopies: 2, readLength: 16, coverage: 8, k: 6, errorRate: 0, pruneThreshold: 1, seed: 12345 };

    // ------------------------------------------------------------ genome: U0 R U1 R … U_n
    // Every U is a distinct random block, every R the same repeat. The bases right next to
    // each repeat copy are forced to differ between copies, so "k − 1 > R" is exactly what
    // resolves the repeat (otherwise a chance match of the flanks would lengthen it).
    function buildGenome(p) {
        const rng = rngFrom(p.seed);
        const R = p.repeatLength, copies = Math.max(1, p.repeatCopies);
        const repeat = randomBases(R, rng);
        const blocks = [];
        for (let c = 0; c <= copies; c++) blocks.push(randomBases(p.uniqueLen, rng));
        if (R > 0 && copies > 1) {
            // base before copy c = last base of block c; base after copy c = first base of block c + 1
            const distinct = (get, set) => {
                const used = new Set();
                for (let c = 0; c < copies; c++) {
                    let ch = get(c);
                    if (used.has(ch)) { ch = [...BASES].find(x => !used.has(x)); set(c, ch); }
                    used.add(ch);
                }
            };
            distinct(c => blocks[c].slice(-1), (c, ch) => { blocks[c] = blocks[c].slice(0, -1) + ch; });
            distinct(c => blocks[c + 1][0], (c, ch) => { blocks[c + 1] = ch + blocks[c + 1].slice(1); });
        }
        let sequence = '';
        const segments = [];
        for (let c = 0; c <= copies; c++) {
            segments.push({ type: 'unique', start: sequence.length, end: sequence.length + blocks[c].length });
            sequence += blocks[c];
            if (c < copies && R > 0) {
                segments.push({ type: 'repeat', copyIndex: c, start: sequence.length, end: sequence.length + R });
                sequence += repeat;
            }
        }
        return { sequence, segments, repeat };
    }

    // ------------------------------------------------------------ reads: tiled every `step` bases, then substitution errors
    function readStep(p, G) { const L = Math.min(p.readLength, G); return Math.max(1, Math.round(L / Math.max(1, p.coverage))); }
    function simulateReads(sequence, p) {
        const G = sequence.length, L = Math.min(p.readLength, G);
        const step = readStep(p, G);
        const reads = [];
        let last = -1;
        for (let s = 0; s + L <= G; s += step) { reads.push({ start: s, seq: sequence.substr(s, L), errors: [] }); last = s; }
        if (last !== G - L) reads.push({ start: G - L, seq: sequence.substr(G - L, L), errors: [] });   // cover the end
        const e = Math.max(0, p.errorRate || 0) / 100;
        if (e > 0) {
            const rng = rngFrom((p.seed ^ 0x9e3779b9) >>> 0);
            for (const r of reads) {
                const c = r.seq.split('');
                for (let i = 0; i < c.length; i++) if (rng() < e) {
                    const others = BASES.replace(c[i], '');
                    c[i] = others[Math.floor(rng() * 3)];
                    r.errors.push(i);
                }
                r.seq = c.join('');
            }
        }
        return reads;
    }

    // ------------------------------------------------------------ graph
    function buildGraph(reads, k, segments = []) {
        const nodes = new Map(), edges = new Map();
        const repeatSegs = segments.filter(s => s.type === 'repeat');
        const node = seq => { let n = nodes.get(seq); if (!n) { n = { id: seq, seq, positions: new Set(), out: new Map(), in: new Map() }; nodes.set(seq, n); } return n; };
        for (const r of reads) {
            for (let i = 0; i + k <= r.seq.length; i++) {
                const kmer = r.seq.substr(i, k), pre = kmer.slice(0, -1), suf = kmer.slice(1);
                const a = node(pre), b = node(suf);
                a.positions.add(r.start + i); b.positions.add(r.start + i + 1);
                const err = r.errors.some(x => x >= i && x < i + k);
                let e = edges.get(kmer);
                if (!e) { e = { kmer, from: pre, to: suf, count: 0, positions: new Set(), fromError: 0 }; edges.set(kmer, e); a.out.set(suf, e); b.in.set(pre, e); }
                e.count++; e.positions.add(r.start + i);
                if (err) e.fromError++;
            }
        }
        for (const n of nodes.values()) {
            n.positions = [...n.positions].sort((x, y) => x - y);
            n.indeg = n.in.size; n.outdeg = n.out.size;
            n.isBranch = n.indeg > 1 || n.outdeg > 1;
            // which repeat copies the (k−1)-mer overlaps, at any of its positions
            const copies = new Set();
            for (const p of n.positions) for (const s of repeatSegs) if (p < s.end && p + k - 1 > s.start) copies.add(s.copyIndex);
            n.repeatCopies = copies;
            n.inRepeat = copies.size > 0;
            n.coverage = Math.max(0, ...[...n.out.values()].map(e => e.count), ...[...n.in.values()].map(e => e.count));
            // every k-mer through it came from a read with an error in that k-mer
            const all = [...n.out.values(), ...n.in.values()];
            n.errorNode = all.length > 0 && all.every(e => e.fromError === e.count);
        }
        for (const n of nodes.values()) {
            n.isRepeatBranch = n.isBranch && n.repeatCopies.size >= 2;
            // branching caused by true k-mers only (a chance repeat) versus by error k-mers joining the true path
            const trueIn = [...n.in.values()].filter(e => e.fromError < e.count).length, trueOut = [...n.out.values()].filter(e => e.fromError < e.count).length;
            n.isChanceBranch = !n.isRepeatBranch && !n.errorNode && (trueIn > 1 || trueOut > 1);
            n.isErrorBranch = n.isBranch && !n.isRepeatBranch && !n.isChanceBranch && !n.errorNode;
        }
        return { nodes, edges, k };
    }
    // ------------------------------------------------------------ unitigs
    // Contract maximal non-branching paths. Edges with coverage < threshold are removed first.
    function unitigs(graph, threshold = 1) {
        const keep = e => e.count >= threshold;
        const outs = id => [...graph.nodes.get(id).out.values()].filter(keep);
        const ins = id => [...graph.nodes.get(id).in.values()].filter(keep);
        const pass = id => ins(id).length === 1 && outs(id).length === 1;
        const used = new Set();
        const contigs = [];
        const walk = firstEdge => {
            const path = [firstEdge.from];
            let seq = firstEdge.from, e = firstEdge;
            const kmers = [];
            while (e && !used.has(e.kmer)) {
                used.add(e.kmer); kmers.push(e.kmer);
                seq += e.to[e.to.length - 1]; path.push(e.to);
                e = pass(e.to) ? outs(e.to)[0] : null;
            }
            return { seq, path, kmers };
        };
        for (const n of graph.nodes.values()) {
            if (pass(n.id)) continue;
            for (const e of outs(n.id)) if (!used.has(e.kmer)) contigs.push(walk(e));
        }
        // isolated cycles (every node pass-through): start anywhere
        for (const e of graph.edges.values()) if (keep(e) && !used.has(e.kmer)) contigs.push(walk(e));
        return contigs;
    }

    // all places where a contig occurs in the genome
    function locate(seq, genome) {
        const out = [];
        for (let p = genome.indexOf(seq); p >= 0; p = genome.indexOf(seq, p + 1)) out.push(p);
        return out;
    }

    function n50(lengths) {
        const s = lengths.slice().sort((a, b) => b - a), total = s.reduce((a, b) => a + b, 0);
        let acc = 0;
        for (const l of s) { acc += l; if (acc * 2 >= total) return l; }
        return 0;
    }

    // ------------------------------------------------------------ whole pipeline
    function assemble(params) {
        const p = Object.assign({}, DEFAULTS, params);
        const genome = buildGenome(p);
        const G = genome.sequence.length;
        const reads = simulateReads(genome.sequence, p);
        const k = Math.max(2, Math.min(p.k, p.readLength));
        const graph = buildGraph(reads, k, genome.segments);
        const threshold = Math.max(1, p.pruneThreshold || 1);
        const contigs = unitigs(graph, threshold);
        for (const c of contigs) {
            c.length = c.seq.length;
            c.loci = locate(c.seq, genome.sequence);
            c.repeat = c.loci.length > 1;
            c.correct = c.loci.length > 0;
            c.fromErrors = c.kmers.some(km => { const e = graph.edges.get(km); return e.fromError === e.count; });
            c.start = c.loci.length ? c.loci[0] : Math.min(...c.path.map(id => graph.nodes.get(id).positions[0]));
        }
        contigs.sort((a, b) => a.start - b.start || b.length - a.length);
        const lengths = contigs.map(c => c.length);
        const nodes = [...graph.nodes.values()];
        const step = readStep(p, G), L = Math.min(p.readLength, G);
        const stats = {
            G, k, threshold, step, L,
            nReads: reads.length, coverage: reads.length * L / G,
            kmers: graph.edges.size, nodes: graph.nodes.size,
            nContigs: contigs.length, longest: lengths.length ? Math.max(...lengths) : 0, n50: n50(lengths),
            repeatBranches: nodes.filter(n => n.isRepeatBranch).length,
            chanceBranches: nodes.filter(n => n.isChanceBranch).length,
            errorKmers: [...graph.edges.values()].filter(e => e.fromError === e.count).length,
            errorKmersKept: [...graph.edges.values()].filter(e => e.fromError === e.count && e.count >= threshold).length,
            trueKmersLost: [...graph.edges.values()].filter(e => e.fromError < e.count && e.count < threshold).length,
            kmerGap: step > L - k + 1,
            wholeGenome: contigs.length === 1 && contigs[0].seq === genome.sequence
        };
        const state = { params: Object.assign({}, p, { k }), genome, reads, graph, contigs, stats };
        state.diagnosis = diagnose(state);
        return state;
    }

    function diagnose(state) {
        const { params: p, stats: s } = state;
        const repeatPresent = p.repeatLength > 0 && p.repeatCopies > 1;
        if (s.wholeGenome) return { regime: 'clean', text: repeatPresent ? `k − 1 = ${s.k - 1} is longer than the ${p.repeatLength} bp repeat, so every (k−1)-mer is unique: the graph is one line and the contig is the whole genome.` : 'One unbranched path from end to end: the contig is the whole genome.' };
        if (s.errorKmersKept > 0) return { regime: 'tangle', text: `Sequencing errors left ${s.errorKmersKept} wrong k-mer${s.errorKmersKept === 1 ? '' : 's'} in the graph: thin tips and bubbles hang off the thick true path and every branch point ends a contig. Raise the coverage threshold to remove them.` };
        if (s.trueKmersLost > 0 && s.errorKmersKept === 0 && s.nContigs === 1 && state.contigs[0].correct) return { regime: 'clean', text: `One contig of ${state.contigs[0].length} bp (the genome has ${s.G}): the threshold ${s.threshold}× removed all error k-mers. It also dropped ${s.trueKmersLost} true k-mer${s.trueKmersLost === 1 ? '' : 's'} at the genome ends, which fewer reads cover.` };
        if (s.trueKmersLost > 0) return { regime: 'gap', text: `The threshold ${s.threshold}× also removed ${s.trueKmersLost} real k-mer${s.trueKmersLost === 1 ? '' : 's'} that happened to be seen fewer times – the true path is broken. Lower the threshold (or sequence deeper).` };
        if (s.repeatBranches > 0) return { regime: 'tangle', text: `k − 1 = ${s.k - 1} is not longer than the ${p.repeatLength} bp repeat: its ${p.repeatCopies} copies collapse into shared nodes (red) with ${p.repeatCopies} ways in and out, and the assembly breaks into ${s.nContigs} contigs. Raise k to at least ${p.repeatLength + 2}.` };
        if (s.kmerGap) return { regime: 'gap', text: `Coverage gap: reads start every ${s.step} bp, but a read of ${s.L} bp holds only ${s.L - s.k + 1} k-mers, so some k-mers of the genome are in no read and the path breaks. Lower k or raise the coverage.` };
        if (s.chanceBranches > 0) return { regime: 'tangle', text: `With k − 1 = ${s.k - 1} some short (k−1)-mers occur twice in the genome just by chance (orange). Short words make ordinary DNA look repetitive – raise k.` };
        if (state.contigs.some(c => !c.correct && !c.fromErrors)) return { regime: 'tangle', text: 'A contig that does not occur in the genome: a (k−1)-mer shared by two distant places looked like an unbranched path, and the assembler joined sequence from both – a misassembly (chimeric contig).' };
        return { regime: 'gap', text: `The path breaks into ${s.nContigs} pieces.` };
    }

    // number of contigs, N50 and branches for every k (the trade-off curve)
    function sweepK(params, kMin = 3) {
        const out = [];
        for (let k = kMin; k <= params.readLength; k++) {
            const st = assemble(Object.assign({}, params, { k }));
            out.push({ k, nContigs: st.stats.nContigs, n50: st.stats.n50, longest: st.stats.longest, whole: st.stats.wholeGenome, repeatBranches: st.stats.repeatBranches });
        }
        return out;
    }

    // how many k-mers were seen once, twice, … (split into true and error k-mers)
    function spectrum(graph) {
        const h = new Map();
        for (const e of graph.edges.values()) {
            const r = h.get(e.count) || { count: e.count, trueK: 0, errorK: 0 };
            if (e.fromError === e.count) r.errorK++; else r.trueK++;
            h.set(e.count, r);
        }
        return [...h.values()].sort((a, b) => a.count - b.count);
    }

    return { BASES, DEFAULTS, rngFrom, randomBases, buildGenome, simulateReads, readStep, buildGraph, unitigs, locate, n50, assemble, sweepK, spectrum };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeBruijn;
}
