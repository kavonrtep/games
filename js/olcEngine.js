/**
 * OLC ASSEMBLY ENGINE
 * ===================
 * DOM-free model for olc.html (overlap–layout–consensus assembly):
 *
 *   genome (optional repeat) → reads from both strands with substitution errors
 *   → overlaps (dovetail suffix–prefix, both orientations; containment)
 *   → orientation of every read → overlap graph → transitive reduction
 *   → layout (unitigs of the reduced graph, or greedy longest-overlap-first)
 *   → consensus (column-wise majority) → evaluation against the truth
 *   plus mate pairs and scaffolding, Lander–Waterman statistics, N50/L50.
 *
 * Errors are substitutions only, so an overlap is an ungapped comparison
 * of a suffix with a prefix; real long-read assemblers must align with gaps.
 */
const OlcEngine = (() => {
    const BASES = 'ACGT';
    const COMP = { A: 'T', C: 'G', G: 'C', T: 'A', N: 'N' };
    const revcomp = s => { let o = ''; for (let i = s.length - 1; i >= 0; i--) o += COMP[s[i]] || 'N'; return o; };

    function hashString(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
    class Rng {
        constructor(seed) { let a = (typeof seed === 'number' ? seed : hashString(String(seed))) >>> 0; this.next = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
        int(lo, hi) { return lo + Math.floor(this.next() * (hi - lo + 1)); }
        pick(a) { return a[Math.floor(this.next() * a.length)]; }
        chance(p) { return this.next() < p; }
        seq(n) { let s = ''; for (let i = 0; i < n; i++) s += BASES[Math.floor(this.next() * 4)]; return s; }
        shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(this.next() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; }
        normal() { const u = Math.max(1e-12, this.next()), v = this.next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    }

    // ------------------------------------------------------------ genome: U0 R U1 R … (repeat copies with distinct flanking bases)
    function buildGenome(p) {
        const rng = new Rng('olc-genome-' + p.seed);
        const R = p.repeatLength || 0, copies = R > 0 ? Math.max(2, p.repeatCopies || 2) : 0;
        const nBlocks = copies + 1, u = Math.max(4, Math.round((p.G - copies * R) / nBlocks));
        const blocks = Array.from({ length: nBlocks }, () => rng.seq(u));
        const repeat = R > 0 ? rng.seq(R) : '';
        if (copies > 1) {                                   // bases before/after each copy differ between copies
            const fix = (get, set) => { const used = new Set(); for (let c = 0; c < copies; c++) { let ch = get(c); if (used.has(ch)) { ch = [...BASES].find(x => !used.has(x)); set(c, ch); } used.add(ch); } };
            fix(c => blocks[c].slice(-1), (c, ch) => { blocks[c] = blocks[c].slice(0, -1) + ch; });
            fix(c => blocks[c + 1][0], (c, ch) => { blocks[c + 1] = ch + blocks[c + 1].slice(1); });
        }
        let seq = '';
        const repeats = [];
        for (let b = 0; b < nBlocks; b++) {
            seq += blocks[b];
            if (b < copies) { repeats.push({ start: seq.length, end: seq.length + R }); seq += repeat; }
        }
        return { seq, repeats, repeat };
    }

    // ------------------------------------------------------------ reads
    /**
     * p: { n (number of reads) | coverage, L, bothStrands, errorRate, minOverlap, seed, tile }
     * With tile = true the reads are resampled until consecutive reads overlap by ≥ minOverlap
     * and the whole genome is covered (a solvable puzzle).
     */
    function sampleReads(genome, p) {
        const G = genome.seq.length, L = p.L;
        const n = p.n || Math.max(2, Math.round(p.coverage * G / L));
        let starts;
        for (let attempt = 0; attempt < 400; attempt++) {
            const rng = new Rng(`olc-reads-${p.seed}-${attempt}`);
            starts = Array.from({ length: n }, () => rng.int(0, G - L)).sort((a, b) => a - b);
            if (!p.tile) break;
            starts[0] = 0; starts[n - 1] = G - L;
            starts.sort((a, b) => a - b);
            let ok = true;
            for (let i = 1; i < n; i++) if (starts[i - 1] + L - starts[i] < p.minOverlap || starts[i] === starts[i - 1]) { ok = false; break; }
            if (ok) break;
            if (attempt === 399) {                          // fall back to jittered tiling
                const step = (G - L) / (n - 1);
                starts = Array.from({ length: n }, (_, i) => Math.round(i * step));
            }
        }
        const rng = new Rng(`olc-strand-${p.seed}`);
        const reads = starts.map((start, i) => {
            const strand = p.bothStrands ? (rng.chance(0.5) ? 1 : -1) : 1;
            let seq = genome.seq.substr(start, L);
            if (strand < 0) seq = revcomp(seq);
            const errors = [];
            if (p.errorRate) {
                const c = seq.split('');
                for (let k = 0; k < c.length; k++) if (rng.chance(p.errorRate)) { c[k] = BASES.replace(c[k], '')[rng.int(0, 2)]; errors.push(k); }
                seq = c.join('');
            }
            return { start, strand, seq, errors, len: seq.length };
        });
        // present the reads in a random order with neutral names
        const order = new Rng(`olc-order-${p.seed}`).shuffle(reads.map((_, i) => i));
        return order.map((j, i) => Object.assign(reads[j], { id: i, name: 'r' + (i + 1) }));
    }

    // ------------------------------------------------------------ overlaps
    const allowed = (len, rate) => Math.floor(rate * len + 1e-9);
    // longest proper suffix(a)–prefix(b) overlap with at most rate·len mismatches
    function dovetail(a, b, minOl, rate) {
        for (let len = Math.min(a.length, b.length) - 1; len >= minOl; len--) {
            const off = a.length - len, maxMis = allowed(len, rate);
            let mis = 0;
            for (let k = 0; k < len && mis <= maxMis; k++) if (a[off + k] !== b[k]) mis++;
            if (mis <= maxMis) return { len, shift: off, mis };
        }
        return null;
    }
    // b lies completely inside a
    function contained(a, b, rate) {
        if (b.length > a.length) return null;
        let best = null;
        for (let off = 0; off + b.length <= a.length; off++) {
            let mis = 0; const maxMis = allowed(b.length, rate);
            for (let k = 0; k < b.length && mis <= maxMis; k++) if (a[off + k] !== b[k]) mis++;
            if (mis <= maxMis && (!best || mis < best.mis)) best = { shift: off, mis };
        }
        return best;
    }
    function mismatchPositions(a, b, shift, len) { const out = []; for (let k = 0; k < len; k++) if (a[shift + k] !== b[k]) out.push(k); return out; }

    /**
     * All overlaps between reads as given (both orientations of the second read).
     * Returns { overlaps: [{a, b, flip, len, shift, mis}], containments: [{outer, inner, flip, shift, mis}] }
     * flip = true: b must be reverse-complemented to overlap a.
     */
    function findOverlaps(reads, opts) {
        const o = Object.assign({ minOverlap: 8, maxErrorRate: 0.1, bothStrands: true }, opts);
        const overlaps = [], containments = [];
        for (let i = 0; i < reads.length; i++) for (let j = 0; j < reads.length; j++) {
            if (i === j) continue;
            for (const flip of o.bothStrands ? [false, true] : [false]) {
                const b = flip ? revcomp(reads[j].seq) : reads[j].seq;
                const ov = dovetail(reads[i].seq, b, o.minOverlap, o.maxErrorRate);
                if (ov) overlaps.push(Object.assign({ a: i, b: j, flip }, ov));
                // opposite strands can also overlap the other way round: reverse complement of j first, then i
                if (flip) { const ov2 = dovetail(b, reads[i].seq, o.minOverlap, o.maxErrorRate); if (ov2) overlaps.push(Object.assign({ a: j, b: i, flip, aFlipped: true }, ov2)); }
                if (reads[j].len <= reads[i].len && (reads[j].len < reads[i].len || j > i)) {
                    const c = contained(reads[i].seq, b, o.maxErrorRate);
                    if (c && !containments.some(x => x.inner === j)) containments.push(Object.assign({ outer: i, inner: j, flip }, c));
                }
            }
        }
        return { overlaps, containments };
    }

    // orientation of every read: maximum spanning tree over overlaps, read 0 forward; flip ⇒ opposite orientation
    function orient(reads, overlaps, containments = []) {
        const n = reads.length, or = new Array(n).fill(0);
        const edges = overlaps.map(o => ({ u: o.a, v: o.b, flip: o.flip, w: o.len })).concat(containments.map(c => ({ u: c.outer, v: c.inner, flip: c.flip, w: reads[c.inner].len })));
        edges.sort((x, y) => y.w - x.w);
        let components = 0;
        for (let s = 0; s < n; s++) {
            if (or[s]) continue;
            components++;
            or[s] = 1;
            let changed = true;
            while (changed) {                                // grow along the heaviest edges first (Prim-like)
                changed = false;
                for (const e of edges) {
                    if (or[e.u] && !or[e.v]) { or[e.v] = e.flip ? -or[e.u] : or[e.u]; changed = true; break; }
                    if (or[e.v] && !or[e.u]) { or[e.u] = e.flip ? -or[e.v] : or[e.v]; changed = true; break; }
                }
            }
        }
        return { orientation: or, components };
    }

    // ------------------------------------------------------------ overlap graph on oriented reads
    function buildGraph(reads, orientation, opts) {
        const o = Object.assign({ minOverlap: 8, maxErrorRate: 0.1 }, opts);
        const seqs = reads.map((r, i) => orientation[i] < 0 ? revcomp(r.seq) : r.seq);
        const { overlaps, containments } = findOverlaps(seqs.map((s, i) => ({ seq: s, len: s.length, id: i })), { minOverlap: o.minOverlap, maxErrorRate: o.maxErrorRate, bothStrands: false });
        const containedSet = new Set(containments.map(c => c.inner));
        const nodes = reads.map((r, i) => ({ id: i, seq: seqs[i], contained: containedSet.has(i) }));
        const edges = overlaps.filter(e => !containedSet.has(e.a) && !containedSet.has(e.b)).map(e => ({ from: e.a, to: e.b, len: e.len, shift: e.shift, mis: e.mis, transitive: false }));
        return { nodes, edges, seqs, containments };
    }

    // remove i→k when i→j→k explains it (shifts add up, within `fuzz` bases)
    function transitiveReduction(graph, fuzz = 2) {
        const out = new Map();
        for (const e of graph.edges) { if (!out.has(e.from)) out.set(e.from, []); out.get(e.from).push(e); }
        for (const e of graph.edges) {
            for (const e1 of out.get(e.from) || []) {
                if (e1 === e || e1.to === e.to) continue;
                const e2 = (out.get(e1.to) || []).find(x => x.to === e.to);
                if (e2 && Math.abs(e1.shift + e2.shift - e.shift) <= fuzz) { e.transitive = true; e.via = e1.to; break; }
            }
        }
        return graph;
    }

    // ------------------------------------------------------------ layout
    function pathToContig(path, shifts, graph) { const offsets = [0]; for (let i = 0; i < shifts.length; i++) offsets.push(offsets[i] + shifts[i]); return { reads: path, offsets, seqs: path.map(i => graph.seqs[i]) }; }

    // unitigs: maximal chains of reads; A and B are merged only if A has exactly one successor and B exactly one
    // predecessor (the arrow A → B is then unavoidable). Every read lies in exactly one unitig; arrows at branch
    // points join nothing – so a unitig never jumps between repeat copies.
    function unitigs(graph) {
        const live = graph.nodes.filter(n => !n.contained).map(n => n.id);
        const E = graph.edges.filter(e => !e.transitive);
        const outs = new Map(live.map(id => [id, []])), ins = new Map(live.map(id => [id, []]));
        for (const e of E) { outs.get(e.from).push(e); ins.get(e.to).push(e); }
        const nextE = id => { const o = outs.get(id); return o.length === 1 && ins.get(o[0].to).length === 1 ? o[0] : null; };
        const hasPrev = new Set();
        for (const id of live) { const e = nextE(id); if (e) hasPrev.add(e.to); }
        const used = new Set(), contigs = [];
        const chain = start => {
            const path = [start], shifts = [];
            used.add(start);
            let e = nextE(start);
            while (e && !used.has(e.to)) { path.push(e.to); shifts.push(e.shift); used.add(e.to); e = nextE(e.to); }
            return pathToContig(path, shifts, graph);
        };
        for (const id of live) if (!hasPrev.has(id)) contigs.push(chain(id));
        for (const id of live) if (!used.has(id)) contigs.push(chain(id));                  // pure cycles
        return contigs;
    }

    // greedy: take overlaps from the longest down; join if the ends are free and no cycle forms
    function greedy(graph) {
        const live = graph.nodes.filter(n => !n.contained).map(n => n.id);
        const next = new Map(), prev = new Map(), steps = [];
        const E = graph.edges.slice().sort((x, y) => y.len - x.len || x.mis - y.mis);
        const headOf = id => { let x = id; while (prev.has(x)) x = prev.get(x).from; return x; };
        for (const e of E) {
            if (next.has(e.from) || prev.has(e.to)) { steps.push({ e, taken: false, why: next.has(e.from) ? 'the left read already has a successor' : 'the right read already has a predecessor' }); continue; }
            if (headOf(e.from) === e.to) { steps.push({ e, taken: false, why: 'it would close a cycle' }); continue; }
            next.set(e.from, e); prev.set(e.to, e); steps.push({ e, taken: true });
        }
        const contigs = [];
        for (const id of live) {
            if (prev.has(id)) continue;
            const path = [id], shifts = [];
            let x = id;
            while (next.has(x)) { const e = next.get(x); shifts.push(e.shift); path.push(e.to); x = e.to; }
            contigs.push(pathToContig(path, shifts, graph));
        }
        return { contigs, steps };
    }

    // ------------------------------------------------------------ consensus
    function consensus(contig, extra = []) {
        const rows = contig.reads.map((id, i) => ({ id, offset: contig.offsets[i], seq: contig.seqs[i] })).concat(extra);
        const len = Math.max(...rows.map(r => r.offset + r.seq.length));
        const columns = [];
        let seq = '';
        for (let c = 0; c < len; c++) {
            const counts = {};
            let depth = 0;
            for (const r of rows) { const k = c - r.offset; if (k >= 0 && k < r.seq.length) { counts[r.seq[k]] = (counts[r.seq[k]] || 0) + 1; depth++; } }
            const base = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))[0] || 'N';
            const top = counts[base] || 0, tie = Object.values(counts).filter(v => v === top).length > 1;
            columns.push({ counts, depth, base: tie ? 'N' : base, agree: top === depth, tie });
            seq += tie ? 'N' : base;
        }
        return { seq, columns, rows };
    }

    // contained reads placed inside their container, for the consensus
    function containedRows(graph, contig) {
        const extra = [];
        for (const c of graph.containments) {
            const idx = contig.reads.indexOf(c.outer);
            if (idx >= 0) extra.push({ id: c.inner, offset: contig.offsets[idx] + c.shift, seq: graph.seqs[c.inner], contained: true });
        }
        return extra;
    }

    // ------------------------------------------------------------ evaluation against the genome
    function bestPlacement(seq, genome) {
        let best = null;
        for (const [strand, s] of [[1, seq], [-1, revcomp(seq)]]) {
            for (let p = -s.length + 1; p < genome.length; p++) {
                let mis = 0, ov = 0;
                for (let k = 0; k < s.length; k++) { const g = p + k; if (g < 0 || g >= genome.length) continue; ov++; if (s[k] !== genome[g] && s[k] !== 'N') mis++; }
                if (ov < Math.min(s.length, genome.length) * 0.9) continue;
                if (!best || mis < best.mis) best = { pos: p, strand, mis, identity: 1 - mis / Math.max(1, ov) };
            }
        }
        return best;
    }
    // is every adjacent pair of reads in the contig at its true relative position?
    function checkContig(contig, reads, orientation) {
        const joins = [];
        for (let i = 0; i + 1 < contig.reads.length; i++) {
            const a = contig.reads[i], b = contig.reads[i + 1], shift = contig.offsets[i + 1] - contig.offsets[i];
            const ga = reads[a].strand * orientation[a], gb = reads[b].strand * orientation[b];
            const trueShift = ga > 0 ? reads[b].start - reads[a].start : (reads[a].start + reads[a].len) - (reads[b].start + reads[b].len);
            joins.push({ a, b, ok: ga === gb && trueShift === shift, shift, trueShift });
        }
        return { joins, correct: joins.every(j => j.ok) };
    }

    // ------------------------------------------------------------ mate pairs and scaffolding
    function matePairs(genome, p) {
        const rng = new Rng('olc-mates-' + p.seed);
        const G = genome.seq.length, pairs = [];
        for (let i = 0; i < p.n; i++) {
            const ins = Math.max(2 * p.L, Math.round(p.insert + p.sd * rng.normal()));
            const start = rng.int(0, Math.max(0, G - ins));
            pairs.push({ id: i, start, insert: ins, r1: genome.seq.substr(start, p.L), r2: revcomp(genome.seq.substr(start + ins - p.L, p.L)) });
        }
        return pairs;
    }
    // unique near-exact placement of a read on the contigs (either strand); null if absent or ambiguous
    function placeRead(seq, contigSeqs, maxMis = 1) {
        const hits = [];
        contigSeqs.forEach((cs, ci) => {
            for (const [strand, s] of [[1, seq], [-1, revcomp(seq)]]) for (let p = 0; p + s.length <= cs.length; p++) {
                let mis = 0; for (let k = 0; k < s.length && mis <= maxMis; k++) if (cs[p + k] !== s[k]) mis++;
                if (mis <= maxMis) hits.push({ contig: ci, pos: p, strand, mis });
            }
        });
        return hits.length === 1 ? hits[0] : hits.length ? { ambiguous: true, n: hits.length } : null;
    }
    /**
     * Links between contigs from pairs whose two reads land on different contigs. In each link, orientation and
     * offset of contig B relative to contig A follow from the forward–reverse pair and the insert size.
     */
    function scaffold(contigSeqs, pairs, insert, minLinks = 2) {
        const placed = pairs.map(pr => ({ pr, p1: placeRead(pr.r1, contigSeqs), p2: placeRead(pr.r2, contigSeqs) }));
        const links = [];
        for (const x of placed) {
            if (!x.p1 || !x.p2 || x.p1.ambiguous || x.p2.ambiguous || x.p1.contig === x.p2.contig) continue;
            // orientation of each contig relative to the genome: r1 is genome-forward, r2 genome-reverse
            const gA = x.p1.strand, gB = -x.p2.strand, L = x.pr.r1.length;
            const lenA = contigSeqs[x.p1.contig].length, lenB = contigSeqs[x.p2.contig].length;
            const inFrame = (pos, len, g, clen) => g > 0 ? pos : clen - pos - len;       // start in genome direction
            const s1 = inFrame(x.p1.pos, L, gA, lenA), s2 = inFrame(x.p2.pos, L, gB, lenB);
            links.push({ a: x.p1.contig, b: x.p2.contig, gA, gB, offset: s1 + x.pr.insert - L - s2, pair: x.pr.id });
        }
        // combine links per contig pair (normalised so that A < B)
        const byPair = new Map();
        for (const l of links) {
            const key = l.a < l.b ? `${l.a}-${l.b}` : `${l.b}-${l.a}`;
            if (!byPair.has(key)) byPair.set(key, []);
            byPair.get(key).push(l);
        }
        const summary = [...byPair.values()].map(ls => {
            const a = Math.min(ls[0].a, ls[0].b), b = Math.max(ls[0].a, ls[0].b);
            // express every link as position of b's genome-direction start relative to a's genome-direction start
            const offs = ls.map(l => l.a === a ? l.offset : -l.offset);
            return { a, b, n: ls.length, offset: Math.round(offs.reduce((s, v) => s + v, 0) / offs.length) };
        }).filter(s => s.n >= minLinks);
        // place contigs along a line (breadth-first from the longest)
        const posOf = new Map(), orientOf = new Map();
        const order = contigSeqs.map((_, i) => i).sort((x, y) => contigSeqs[y].length - contigSeqs[x].length);
        for (const root of order) {
            if (posOf.has(root) || !summary.some(s => s.a === root || s.b === root)) continue;
            posOf.set(root, 0);
            const queue = [root];
            while (queue.length) {
                const c = queue.shift();
                for (const s of summary) {
                    if (s.a === c && !posOf.has(s.b)) { posOf.set(s.b, posOf.get(c) + s.offset); queue.push(s.b); }
                    else if (s.b === c && !posOf.has(s.a)) { posOf.set(s.a, posOf.get(c) - s.offset); queue.push(s.a); }
                }
            }
        }
        const orientation = placed.reduce((m, x) => { if (x.p1 && !x.p1.ambiguous) m[x.p1.contig] = x.p1.strand; if (x.p2 && !x.p2.ambiguous && m[x.p2.contig] === undefined) m[x.p2.contig] = -x.p2.strand; return m; }, {});
        const layout = [...posOf.entries()].map(([c, pos]) => ({ contig: c, pos, len: contigSeqs[c].length, orient: orientation[c] || 1 })).sort((x, y) => x.pos - y.pos);
        return { placed, links, summary, layout };
    }

    // ------------------------------------------------------------ Lander–Waterman
    // N reads of length L on a genome of length G (coverage c = NL/G); overlaps shorter than T are not detected (θ = T/L)
    function landerWaterman(G, L, c, T = 0) {
        const N = c * G / L, theta = T / L;
        return { N, contigs: N * Math.exp(-c * (1 - theta)), uncovered: Math.exp(-c), contigLength: L * (Math.exp(c * (1 - theta)) - 1) / c + L };
    }
    function simulateIslands(G, L, c, T, rng, reps = 50) {
        const N = Math.round(c * G / L);
        let sumC = 0, sumCov = 0;
        for (let r = 0; r < reps; r++) {
            const st = Array.from({ length: N }, () => Math.floor(rng.next() * G)).sort((a, b) => a - b);
            let contigs = N ? 1 : 0, covered = 0, curEnd = -1, curStart = -1;
            for (let i = 0; i < N; i++) {
                if (i > 0 && st[i] > st[i - 1] + L - T) contigs++;
                if (st[i] > curEnd) { if (curEnd >= 0) covered += curEnd - curStart; curStart = st[i]; }
                curEnd = Math.max(curEnd, st[i] + L);
            }
            if (curEnd >= 0) covered += Math.min(G, curEnd) - curStart;
            sumC += contigs; sumCov += Math.min(1, covered / G);
        }
        return { contigs: sumC / reps, uncovered: 1 - sumCov / reps };
    }

    function n50(lengths) {
        const s = lengths.slice().sort((a, b) => b - a), total = s.reduce((a, b) => a + b, 0);
        let acc = 0;
        for (let i = 0; i < s.length; i++) { acc += s[i]; if (acc * 2 >= total) return { n50: s[i], l50: i + 1, total, sorted: s }; }
        return { n50: 0, l50: 0, total, sorted: s };
    }

    // ------------------------------------------------------------ whole pipeline
    function assemble(reads, genome, opts) {
        const o = Object.assign({ minOverlap: 8, maxErrorRate: 0.1, bothStrands: true }, opts);
        const raw = findOverlaps(reads, o);
        const or = orient(reads, raw.overlaps, raw.containments);
        const graph = transitiveReduction(buildGraph(reads, or.orientation, o));
        const tigs = unitigs(graph).map(c => finish(c, graph, reads, or.orientation, genome));
        const gr = greedy(graph);
        const gtigs = gr.contigs.map(c => finish(c, graph, reads, or.orientation, genome));
        return { raw, orientation: or.orientation, components: or.components, graph, unitigs: tigs, greedy: gtigs, greedySteps: gr.steps };
    }
    function finish(contig, graph, reads, orientation, genome) {
        const cons = consensus(contig, containedRows(graph, contig));
        const check = checkContig(contig, reads, orientation);
        const place = genome ? bestPlacement(cons.seq, genome.seq) : null;
        // correct = the consensus occurs in the genome (a collapsed repeat contig is correct, just ambiguous);
        // a misjoin puts together sequence from places that are not adjacent and does not occur anywhere
        const correct = !!place && place.identity >= 0.93 && place.pos >= -2 && place.pos + cons.seq.length <= genome.seq.length + 2;
        const repeat = correct && genome.repeats.some(r => place.pos >= r.start - 2 && place.pos + cons.seq.length <= r.end + 2);
        return Object.assign(contig, { consensus: cons, check, place, correct, repeat, length: cons.seq.length });
    }

    return { BASES, Rng, revcomp, buildGenome, sampleReads, dovetail, contained, mismatchPositions, findOverlaps, orient, buildGraph, transitiveReduction,
             unitigs, greedy, consensus, containedRows, bestPlacement, checkContig, matePairs, placeRead, scaffold, landerWaterman, simulateIslands, n50, assemble };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = OlcEngine;
}
