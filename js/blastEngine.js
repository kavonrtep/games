/**
 * BLAST ENGINE
 * ============
 * A faithful, small-scale re-implementation of the BLAST pipeline for
 * teaching, plus scenario generation and statistics. DOM-free.
 *
 * Pipeline (search):
 *   1. words        – query words of size w (protein: neighbourhood words scoring >= T)
 *   2. scan         – look every database word up in the query word table → hits
 *   3. seeds        – blastn: every hit; blastp: two hits on one diagonal within A
 *   4. ungapped     – X-drop extension of each seed along its diagonal → HSPs
 *   5. gapped       – local alignment (AlignEngine) in a window around the HSP
 *   6. statistics   – Karlin–Altschul: bit score, E-value for a chosen database size
 */
const BlastEngine = (() => {
    const E = AlignEngine;
    const AA = 'ARNDCQEGHILKMFPSTWYV';
    const AA_BG = { A: 0.0780, R: 0.0512, N: 0.0449, D: 0.0536, C: 0.0192, Q: 0.0426, E: 0.0629, G: 0.0738, H: 0.0219, I: 0.0514,
                    L: 0.0902, K: 0.0574, M: 0.0224, F: 0.0386, P: 0.0520, S: 0.0712, T: 0.0584, W: 0.0133, Y: 0.0321, V: 0.0644 };

    // ------------------------------------------------------------ seeded RNG
    function hashString(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
    class Rng {
        constructor(seed) { let a = (typeof seed === 'number' ? seed : hashString(String(seed))) >>> 0; this.next = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
        int(lo, hi) { return lo + Math.floor(this.next() * (hi - lo + 1)); }
        pick(a) { return a[Math.floor(this.next() * a.length)]; }
        chance(p) { return this.next() < p; }
        shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(this.next() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; }
        seq(len, alphabet = 'ACGT') { let s = ''; for (let k = 0; k < len; k++) s += alphabet[this.int(0, alphabet.length - 1)]; return s; }
    }

    // ------------------------------------------------------------ programs & parameters
    const PROGRAMS = {
        megablast:    { label: 'megablast', type: 'DNA', word: 28, template: null, twoHit: false, reward: 1, penalty: -2, gapOpen: -5, gapExtend: -2, xDrop: 20, note: 'long exact words: fast, for near-identical sequences' },
        'dc-megablast': { label: 'discontiguous megablast', type: 'DNA', word: 11, template: '1110110110110111', twoHit: false, reward: 2, penalty: -3, gapOpen: -5, gapExtend: -2, xDrop: 20, note: '12-of-16 coding template: tolerates third-codon-position changes' },
        blastn:       { label: 'blastn', type: 'DNA', word: 11, template: null, twoHit: false, reward: 2, penalty: -3, gapOpen: -5, gapExtend: -2, xDrop: 20, note: 'short exact words: slower, more sensitive' },
        blastp:       { label: 'blastp', type: 'PROTEIN', word: 3, template: null, twoHit: true, T: 11, A: 40, gapOpen: -11, gapExtend: -1, xDrop: 7, note: 'neighbourhood words + two-hit rule' }
    };

    // Karlin–Altschul parameters (NCBI tables) for the scoring schemes offered
    const KA = {
        'DNA:1:-2': { ungapped: { lambda: 1.33, K: 0.621, H: 1.12 }, gapped: { lambda: 1.28, K: 0.46, H: 0.85 } },
        'DNA:1:-3': { ungapped: { lambda: 1.374, K: 0.711, H: 1.31 }, gapped: { lambda: 1.37, K: 0.71, H: 1.31 } },
        'DNA:2:-3': { ungapped: { lambda: 0.665, K: 0.41, H: 0.78 }, gapped: { lambda: 0.625, K: 0.41, H: 0.78 } },
        'DNA:1:-1': { ungapped: { lambda: 1.099, K: 0.333, H: 0.49 }, gapped: { lambda: 1.09, K: 0.33, H: 0.49 } },
        'PROTEIN:blosum62': { ungapped: { lambda: 0.3176, K: 0.134, H: 0.40 }, gapped: { lambda: 0.267, K: 0.041, H: 0.14 } }
    };

    function scoringParams(p) {
        if (p.type === 'PROTEIN') return { type: 'PROTEIN', gapModel: 'affine', gapOpen: p.gapOpen, gapExtend: p.gapExtend, endGaps: 'penalized', substitution: { kind: 'blosum62' } };
        return { type: 'DNA', gapModel: 'affine', gapOpen: p.gapOpen, gapExtend: p.gapExtend, endGaps: 'penalized', substitution: { kind: 'simple', match: p.reward, mismatch: p.penalty } };
    }
    function sub(p, a, b) { return p.type === 'PROTEIN' ? (E.BLOSUM62[a] && E.BLOSUM62[a][b] !== undefined ? E.BLOSUM62[a][b] : -4) : (a === b ? p.reward : p.penalty); }
    function kaFor(p, gapped) {
        const key = p.type === 'PROTEIN' ? 'PROTEIN:blosum62' : `DNA:${p.reward}:${p.penalty}`;
        const t = KA[key] || KA['DNA:1:-2'];
        return gapped ? t.gapped : t.ungapped;
    }

    // λ for an ungapped scoring scheme: solve Σ p_i p_j e^{λ s_ij} = 1 (bisection) – shown to students next to the table value
    function computeLambda(p) {
        const alpha = p.type === 'PROTEIN' ? AA.split('') : 'ACGT'.split('');
        const bg = p.type === 'PROTEIN' ? AA_BG : { A: 0.25, C: 0.25, G: 0.25, T: 0.25 };
        const f = lam => { let s = 0; for (const a of alpha) for (const b of alpha) s += bg[a] * bg[b] * Math.exp(lam * sub(p, a, b)); return s - 1; };
        let lo = 1e-4, hi = 5;
        for (let it = 0; it < 80; it++) { const mid = (lo + hi) / 2; if (f(mid) > 0) hi = mid; else lo = mid; }
        return (lo + hi) / 2;
    }

    // ------------------------------------------------------------ masking (DUST/SEG-like, simplified)
    function lowComplexityMask(seq, type) {
        const n = seq.length, mask = new Array(n).fill(false);
        const win = type === 'PROTEIN' ? 12 : 24, k = type === 'PROTEIN' ? 1 : 3;
        const maxEntropy = type === 'PROTEIN' ? Math.log2(20) : Math.log2(64);
        const threshold = type === 'PROTEIN' ? 2.2 : 3.0;   // bits; random sequence scores ≈ 3.8 / 4.5
        for (let i = 0; i + win <= n; i++) {
            const counts = {};
            let total = 0;
            for (let j = i; j + k <= i + win; j++) { const t = seq.slice(j, j + k); counts[t] = (counts[t] || 0) + 1; total++; }
            let H = 0;
            for (const c in counts) { const f = counts[c] / total; H -= f * Math.log2(f); }
            if (H < threshold) for (let j = i; j < i + win; j++) mask[j] = true;
        }
        return mask;
    }
    function applyMask(seq, mask) { return seq.split('').map((c, i) => mask[i] ? c.toLowerCase() : c).join(''); }

    // ------------------------------------------------------------ words
    function templatePositions(template) { const pos = []; for (let i = 0; i < template.length; i++) if (template[i] === '1') pos.push(i); return pos; }
    function wordAt(seq, i, w, template) {
        if (!template) return seq.substr(i, w);
        const pos = templatePositions(template);
        if (i + template.length > seq.length) return null;
        return pos.map(o => seq[i + o]).join('');
    }
    function wordSpan(w, template) { return template ? template.length : w; }

    /**
     * Query word table. Lower-case (masked) residues never form words.
     * Protein: every word's neighbourhood (all words scoring >= T against it) is added.
     */
    function buildWordTable(query, p) {
        const span = wordSpan(p.word, p.template), table = new Map(), words = [];
        let neighbourhoodSize = 0;
        for (let i = 0; i + span <= query.length; i++) {
            const raw = wordAt(query, i, p.word, p.template);
            if (!raw || /[a-z]/.test(raw)) continue;
            if (p.type === 'PROTEIN' && /[^ARNDCQEGHILKMFPSTWYV]/.test(raw)) continue;   // X, * from translation
            const entry = { pos: i, word: raw, neighbours: [] };
            if (p.type === 'PROTEIN') {
                entry.neighbours = neighbourhood(raw, p.T);
                neighbourhoodSize += entry.neighbours.length;
                for (const nb of entry.neighbours) { if (!table.has(nb.word)) table.set(nb.word, []); table.get(nb.word).push({ qpos: i, score: nb.score, exact: nb.word === raw }); }
            } else {
                if (!table.has(raw)) table.set(raw, []);
                table.get(raw).push({ qpos: i, exact: true });
            }
            words.push(entry);
        }
        return { words, table, span, neighbourhoodSize };
    }

    // all protein words of the same length scoring >= T against `word` (BLOSUM62), best first
    function neighbourhood(word, T) {
        const out = [];
        const rec = (prefix, i, score, remainingMax) => {
            if (i === word.length) { if (score >= T) out.push({ word: prefix, score }); return; }
            for (const a of AA) {
                const s = E.BLOSUM62[word[i]][a];
                // prune: even with the best possible remaining scores we cannot reach T
                if (score + s + remainingMax[i + 1] < T) continue;
                rec(prefix + a, i + 1, score + s, remainingMax);
            }
        };
        const best = word.split('').map(c => Math.max(...AA.split('').map(a => E.BLOSUM62[c][a])));
        const remainingMax = new Array(word.length + 1).fill(0);
        for (let i = word.length - 1; i >= 0; i--) remainingMax[i] = remainingMax[i + 1] + best[i];
        rec('', 0, 0, remainingMax);
        out.sort((a, b) => b.score - a.score);
        return out;
    }

    // ------------------------------------------------------------ scanning
    function scan(wordTable, db, p) {
        const span = wordTable.span;
        let lookups = 0;
        const perSubject = db.map((s, si) => {
            const hits = [];
            for (let j = 0; j + span <= s.seq.length; j++) {
                const wd = wordAt(s.seq, j, p.word, p.template);
                lookups++;
                if (!wd || /[a-z]/.test(wd)) continue;
                if (p.type === 'PROTEIN' && /[^ARNDCQEGHILKMFPSTWYV]/.test(wd)) continue;
                const found = wordTable.table.get(wd);
                if (found) for (const f of found) hits.push({ qpos: f.qpos, spos: j, diag: j - f.qpos, exact: f.exact, score: f.score });
            }
            return { subject: si, hits };
        });
        return { perSubject, lookups, totalHits: perSubject.reduce((s, x) => s + x.hits.length, 0) };
    }

    // ------------------------------------------------------------ seeds (two-hit rule)
    function seeds(scanResult, p, span) {
        return scanResult.perSubject.map(ps => {
            const list = [];
            if (!p.twoHit) {
                for (const h of ps.hits) list.push({ subject: ps.subject, hits: [h], diag: h.diag, qpos: h.qpos, spos: h.spos });
                return { subject: ps.subject, seeds: list, rejected: 0 };
            }
            const byDiag = new Map();
            for (const h of ps.hits) { if (!byDiag.has(h.diag)) byDiag.set(h.diag, []); byDiag.get(h.diag).push(h); }
            let rejected = 0;
            for (const [diag, hs] of byDiag) {
                hs.sort((a, b) => a.qpos - b.qpos);
                let used = false, skipUntil = -1;
                for (let k = 1; k < hs.length; k++) {
                    if (hs[k].qpos < skipUntil) continue;
                    // nearest earlier hit that does not overlap this one
                    let j = k - 1;
                    while (j >= 0 && hs[k].qpos - hs[j].qpos < span) j--;
                    if (j < 0) continue;
                    const d = hs[k].qpos - hs[j].qpos;
                    if (d <= p.A) {
                        list.push({ subject: ps.subject, hits: [hs[j], hs[k]], diag, qpos: hs[k].qpos, spos: hs[k].spos, distance: d });
                        used = true;
                        skipUntil = hs[k].qpos + span;   // overlapping hits do not spawn further seeds
                    }
                }
                if (!used) rejected += hs.length;
            }
            return { subject: ps.subject, seeds: list, rejected };
        });
    }

    // ------------------------------------------------------------ ungapped extension (X-drop)
    function extendUngapped(query, subject, seed, p, span) {
        const q = query.toUpperCase(), s = subject.toUpperCase();
        const q0 = seed.qpos, s0 = seed.spos;
        let score = 0;
        for (let k = 0; k < span; k++) score += sub(p, q[q0 + k], s[s0 + k]);
        // right
        let best = score, bestEnd = q0 + span - 1, cur = score;
        const traceR = [];
        for (let qi = q0 + span, si = s0 + span; qi < q.length && si < s.length; qi++, si++) {
            cur += sub(p, q[qi], s[si]);
            traceR.push({ q: qi, score: cur, best });
            if (cur > best) { best = cur; bestEnd = qi; }
            if (cur <= best - p.xDrop) break;
        }
        // left
        let bestStart = q0, curL = best;
        const traceL = [];
        let bestL = best;
        for (let qi = q0 - 1, si = s0 - 1; qi >= 0 && si >= 0; qi--, si--) {
            curL += sub(p, q[qi], s[si]);
            traceL.push({ q: qi, score: curL, best: bestL });
            if (curL > bestL) { bestL = curL; bestStart = qi; }
            if (curL <= bestL - p.xDrop) break;
        }
        const finalScore = bestL;
        const qStart = bestStart, qEnd = bestEnd, sStart = s0 - (q0 - bestStart), sEnd = s0 + (bestEnd - q0);
        return { qStart, qEnd, sStart, sEnd, score: finalScore, diag: seed.diag, seed, traceR, traceL, length: qEnd - qStart + 1 };
    }

    function hsps(query, db, seedResult, p, span) {
        const out = [];
        for (const ss of seedResult) {
            const seen = [];
            for (const sd of ss.seeds) {
                const h = extendUngapped(query, db[ss.subject].seq, sd, p, span);
                h.subject = ss.subject;
                // merge with an existing HSP on the same diagonal that overlaps
                const dup = seen.find(x => x.diag === h.diag && !(h.qEnd < x.qStart || h.qStart > x.qEnd));
                if (dup) { if (h.score > dup.score) Object.assign(dup, h); continue; }
                seen.push(h);
            }
            out.push(...seen);
        }
        out.sort((a, b) => b.score - a.score);
        return out;
    }

    // ------------------------------------------------------------ gapped extension
    function extendGapped(query, subject, hsp, p, window = 40) {
        const sp = scoringParams(p);
        const q = query.toUpperCase(), s = subject.toUpperCase();
        const qa = Math.max(0, hsp.qStart - window), qb = Math.min(q.length, hsp.qEnd + 1 + window);
        const sa = Math.max(0, hsp.sStart - window), sb = Math.min(s.length, hsp.sEnd + 1 + window);
        const r = E.localAlign(q.slice(qa, qb), s.slice(sa, sb), sp);
        const sc = E.scoreAlignment(r.aligned1, r.aligned2, sp);
        const positives = sc.columns.filter(c => (c.type === 'match' || c.type === 'mismatch') && c.score > 0).length;
        return {
            score: r.score, aligned1: r.aligned1, aligned2: r.aligned2,
            qStart: qa + r.s1Start, qEnd: qa + r.s1End, sStart: sa + r.s2Start, sEnd: sa + r.s2End,
            identities: sc.matches, positives, gaps: sc.gaps, length: r.aligned1.length,
            cells: (qb - qa) * (sb - sa)
        };
    }

    // ------------------------------------------------------------ statistics
    function bitScore(raw, ka) { return (ka.lambda * raw - Math.log(ka.K)) / Math.LN2; }
    function evalue(bits, m, n) { return m * n * Math.pow(2, -bits); }
    function effectiveLengths(m, n, nSeqs, ka) {
        // NCBI length adjustment (simplified): l = ln(K·m·n) / H, capped
        const l = Math.max(0, Math.min(Math.log(ka.K * m * n) / ka.H, Math.min(m, n) / 2));
        return { m: Math.max(1, m - l), n: Math.max(1, n - nSeqs * l), l };
    }

    // ------------------------------------------------------------ full search
    function search(query, db, params, opts = {}) {
        const p = Object.assign({}, params);
        const o = Object.assign({ mask: false, dbSizeFactor: 1, gappedWindow: 40, maxGapped: 12 }, opts);
        let q = query.toUpperCase();
        const qmask = o.mask ? lowComplexityMask(q, p.type) : null;
        if (qmask) q = applyMask(q, qmask);
        const dbm = db.map(s => { let seq = s.seq.toUpperCase(); if (o.mask) seq = applyMask(seq, lowComplexityMask(seq, p.type)); return Object.assign({}, s, { seq }); });

        const wt = buildWordTable(q, p);
        const sc = scan(wt, dbm, p);
        const sd = seeds(sc, p, wt.span);
        const hs = hsps(q, dbm, sd, p, wt.span);
        const kaU = kaFor(p, false), kaG = kaFor(p, true);
        const dbLength = db.reduce((s, x) => s + x.seq.length, 0) * o.dbSizeFactor;
        const nSeqs = db.length * o.dbSizeFactor;
        const eff = effectiveLengths(q.length, dbLength, nSeqs, kaG);
        // gapped extension for the best HSPs (one per subject/diagonal region), then statistics
        const results = [];
        let gappedCells = 0;
        const perSubjectDone = {};
        for (const h of hs.slice(0, o.maxGapped)) {
            const g = extendGapped(q, dbm[h.subject].seq, h, p, o.gappedWindow);
            gappedCells += g.cells;
            // the same gapped alignment is often reached from several HSPs – keep one
            const key = h.subject + ':' + g.qStart + ':' + g.sStart + ':' + g.qEnd;
            if (perSubjectDone[key]) continue;
            perSubjectDone[key] = true;
            const bits = bitScore(g.score, kaG);
            results.push(Object.assign({ subject: h.subject, hsp: h, bits, evalue: evalue(bits, eff.m, eff.n), ungappedBits: bitScore(h.score, kaU) }, g));
        }
        results.sort((a, b) => a.evalue - b.evalue);
        return {
            params: p, opts: o, query: q, qmask, db: dbm, wordTable: wt, scan: sc, seeds: sd, hsps: hs, results,
            stats: { kaU, kaG, lambdaComputed: computeLambda(p), dbLength, nSeqs, eff, lookups: sc.lookups, hits: sc.totalHits,
                     seeds: sd.reduce((s, x) => s + x.seeds.length, 0), hspCount: hs.length, gappedCells,
                     swCells: db.reduce((s, x) => s + x.seq.length * q.length, 0) }
        };
    }

    // ------------------------------------------------------------ shuffle test (empirical score distribution)
    // Best local-alignment score (full Smith–Waterman, same scoring) of shuffled queries against the database:
    // the chance distribution that Karlin–Altschul statistics describe.
    function bestLocalScore(query, db, p) {
        const sp = scoringParams(p);
        let best = 0;
        for (const s of db) best = Math.max(best, E.localAlign(query, s.seq.toUpperCase(), sp).score);
        return best;
    }
    function shuffleTest(query, db, params, rng, n = 100) {
        const scores = [];
        const q = query.toUpperCase();
        for (let t = 0; t < n; t++) scores.push(bestLocalScore(rng.shuffle(q.split('')).join(''), db, params));
        scores.sort((a, b) => a - b);
        const real = bestLocalScore(q, db, params);
        return { scores, max: scores[scores.length - 1], median: scores[Math.floor(n / 2)], mean: scores.reduce((a, b) => a + b, 0) / n, real };
    }
    // Gumbel (extreme value) density of the best score for lengths m, n: P(S = x) ≈ λ K m n e^{-λx} exp(-K m n e^{-λx})
    function gumbelPdf(x, ka, m, n) { const u = ka.K * m * n * Math.exp(-ka.lambda * x); return ka.lambda * u * Math.exp(-u); }

    // ------------------------------------------------------------ translation
    const CODON = (() => {
        const bases = 'TCAG', aas = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
        const t = {}; let k = 0;
        for (const a of bases) for (const b of bases) for (const c of bases) t[a + b + c] = aas[k++];
        return t;
    })();
    function revcomp(s) { const c = { A: 'T', C: 'G', G: 'C', T: 'A' }; return s.split('').reverse().map(x => c[x] || x).join(''); }
    function translate(dna, frame) {
        const s = frame < 0 ? revcomp(dna) : dna, off = Math.abs(frame) - 1;
        let out = '';
        for (let i = off; i + 3 <= s.length; i += 3) out += CODON[s.substr(i, 3)] || 'X';
        return out;
    }
    function sixFrames(dna) { return [1, 2, 3, -1, -2, -3].map(f => ({ frame: f, protein: translate(dna, f) })); }
    // translated search: query and/or database in six frames, protein parameters
    function translatedSearch(query, db, mode, params, opts = {}) {
        const p = Object.assign({}, PROGRAMS.blastp, params || {});
        const qFrames = mode === 'blastx' || mode === 'tblastx' ? sixFrames(query) : [{ frame: 0, protein: query }];
        const out = [];
        for (const qf of qFrames) {
            const dbT = [];
            for (const s of db) {
                if (mode === 'tblastn' || mode === 'tblastx') for (const sf of sixFrames(s.seq)) dbT.push({ name: `${s.name} (frame ${sf.frame > 0 ? '+' : ''}${sf.frame})`, seq: sf.protein.replace(/\*/g, 'X'), origin: s.name, frame: sf.frame });
                else dbT.push({ name: s.name, seq: s.seq, origin: s.name, frame: 0 });
            }
            const r = search(qf.protein.replace(/\*/g, 'X'), dbT, p, opts);
            for (const res of r.results) out.push(Object.assign({ qFrame: qf.frame, subjectName: dbT[res.subject].name, origin: dbT[res.subject].origin, sFrame: dbT[res.subject].frame }, res));
        }
        out.sort((a, b) => a.evalue - b.evalue);
        return out;
    }

    // ------------------------------------------------------------ scenario generation
    function mutateDna(rng, seq, identity) {
        const a = seq.split(''), n = Math.round(seq.length * (1 - identity));
        const used = new Set();
        while (used.size < n) { const i = rng.int(0, a.length - 1); if (used.has(i)) continue; used.add(i); a[i] = 'ACGT'.replace(a[i], '')[rng.int(0, 2)]; }
        return a.join('');
    }
    function mutateProtein(rng, seq, identity) {
        const a = seq.split(''), n = Math.round(seq.length * (1 - identity));
        const used = new Set();
        while (used.size < n) {
            const i = rng.int(0, a.length - 1); if (used.has(i)) continue; used.add(i);
            // mostly conservative substitutions (BLOSUM >= 0), sometimes random
            const cands = AA.split('').filter(b => b !== a[i] && (rng.chance(0.25) || E.BLOSUM62[a[i]][b] >= 0));
            a[i] = cands.length ? cands[rng.int(0, cands.length - 1)] : AA[rng.int(0, 19)];
        }
        return a.join('');
    }
    function randomProtein(rng, len) { return rng.seq(len, AA); }
    function randomCoding(rng, ncodons) { let s = 'ATG'; while (s.length < ncodons * 3) { const c = rng.seq(3); if (CODON[c] !== '*') s += c; } return s; }
    // synonymous variant: change third positions where the amino acid is preserved
    function synonymousVariant(rng, dna, fraction) {
        let out = '';
        for (let i = 0; i + 3 <= dna.length; i += 3) {
            const c = dna.substr(i, 3);
            if (rng.chance(fraction)) {
                const alts = 'ACGT'.split('').map(b => c.slice(0, 2) + b).filter(x => x !== c && CODON[x] === CODON[c]);
                out += alts.length ? alts[rng.int(0, alts.length - 1)] : c;
            } else out += c;
        }
        return out + dna.slice(out.length);
    }

    const SCENARIOS = {
        'dna-family': {
            name: 'DNA: homolog family (95 – 50 % identity)',
            type: 'DNA',
            build(rng) {
                const core = rng.seq(70), query = rng.seq(10) + core + rng.seq(10);
                const db = [];
                for (const id of [0.95, 0.85, 0.75, 0.65, 0.50]) db.push({ name: `homolog_${Math.round(id * 100)}`, seq: rng.seq(rng.int(20, 60)) + mutateDna(rng, core, id) + rng.seq(rng.int(20, 60)), truth: { kind: 'homolog', identity: id } });
                for (let k = 1; k <= 3; k++) db.push({ name: `unrelated_${k}`, seq: rng.seq(rng.int(120, 180)), truth: { kind: 'unrelated' } });
                return { query, db, note: 'The database holds five copies of the query core at planted identities (95–50 %) inside random flanks, plus three unrelated sequences.' };
            }
        },
        'protein-family': {
            name: 'Protein: homolog family (90 / 70 / 50 / 35 % identity)',
            type: 'PROTEIN',
            build(rng) {
                const core = randomProtein(rng, 60), query = randomProtein(rng, 8) + core + randomProtein(rng, 8);
                const db = [];
                for (const id of [0.90, 0.70, 0.50, 0.35]) db.push({ name: `homolog_${Math.round(id * 100)}`, seq: randomProtein(rng, rng.int(15, 40)) + mutateProtein(rng, core, id) + randomProtein(rng, rng.int(15, 40)), truth: { kind: 'homolog', identity: id } });
                for (let k = 1; k <= 3; k++) db.push({ name: `unrelated_${k}`, seq: randomProtein(rng, rng.int(100, 150)), truth: { kind: 'unrelated' } });
                return { query, db, note: 'Four homologs of the query core with mostly conservative substitutions, plus three unrelated proteins.' };
            }
        },
        'low-complexity': {
            name: 'DNA: query with a low-complexity stretch',
            type: 'DNA',
            build(rng) {
                const core = rng.seq(60);
                const query = rng.seq(8) + core + 'CACACACACACACACACACACACA' + rng.seq(8);
                const db = [{ name: 'true_homolog', seq: rng.seq(40) + mutateDna(rng, core, 0.92) + rng.seq(40), truth: { kind: 'homolog', identity: 0.92 } }];
                for (let k = 1; k <= 4; k++) db.push({ name: `CA_repeat_${k}`, seq: rng.seq(rng.int(30, 60)) + 'CA'.repeat(rng.int(10, 18)) + rng.seq(rng.int(30, 60)), truth: { kind: 'lowcomplexity' } });
                db.push({ name: 'unrelated_1', seq: rng.seq(150), truth: { kind: 'unrelated' } });
                return { query, db, note: 'The query carries a (CA)12 microsatellite; four unrelated sequences carry CA repeats too, one sequence is a real homolog of the unique part.' };
            }
        },
        'coding-synonymous': {
            name: 'Coding DNA: synonymous divergence (protein conserved)',
            type: 'DNA',
            build(rng) {
                const query = randomCoding(rng, 40);
                const db = [
                    { name: 'ortholog_synonymous', seq: rng.seq(3 * rng.int(7, 13)) + synonymousVariant(rng, query, 0.9) + rng.seq(3 * rng.int(7, 13)), truth: { kind: 'synonymous' } },
                    { name: 'unrelated_1', seq: rng.seq(160), truth: { kind: 'unrelated' } },
                    { name: 'unrelated_2', seq: rng.seq(140), truth: { kind: 'unrelated' } }
                ];
                return { query, db, note: 'The ortholog encodes the same protein but nearly every codon has a different third base: DNA identity ≈ 70 %, protein identity 100 %.' };
            }
        },
        'short-query': {
            name: 'DNA: very short query (primer-sized)',
            type: 'DNA',
            build(rng) {
                const query = rng.seq(14);
                const db = [{ name: 'target', seq: rng.seq(80) + query + rng.seq(80), truth: { kind: 'homolog', identity: 1 } }];
                for (let k = 1; k <= 5; k++) db.push({ name: `unrelated_${k}`, seq: rng.seq(200), truth: { kind: 'unrelated' } });
                return { query, db, note: 'A 14-mer that occurs exactly once: a perfect match whose E-value is still poor once the database is large.' };
            }
        }
    };

    function buildScenario(key, seed) {
        const sc = SCENARIOS[key];
        const rng = new Rng(`${key}#${seed}`);
        const data = sc.build(rng);
        return Object.assign({ key, type: sc.type, name: sc.name, seed }, data);
    }

    return { Rng, PROGRAMS, KA, SCENARIOS, buildScenario, buildWordTable, neighbourhood, scan, seeds, extendUngapped, hsps, extendGapped,
             search, shuffleTest, bestLocalScore, gumbelPdf, bitScore, evalue, effectiveLengths, computeLambda, kaFor, scoringParams, lowComplexityMask, applyMask,
             translate, sixFrames, translatedSearch, revcomp, wordSpan, sub };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlastEngine;
}
