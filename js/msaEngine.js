/**
 * MSA ENGINE
 * ==========
 * DOM-free multiple-sequence-alignment computations for the MSA workbench:
 * FASTA parsing, pairwise distances, UPGMA guide tree, progressive
 * profile–profile alignment (affine gaps), sum-of-pairs scoring, per-column
 * statistics (frequencies, entropy, information content, consensus, PSSM)
 * and PSSM scanning. Builds on AlignEngine for substitution scores and
 * pairwise alignment.
 */
const MsaEngine = (() => {
    const E = AlignEngine;
    const LN2 = Math.log(2);

    // Robinson & Robinson (1991) amino-acid background frequencies
    const AA_BACKGROUND = {
        A: 0.0780, R: 0.0512, N: 0.0449, D: 0.0536, C: 0.0192, Q: 0.0426, E: 0.0629, G: 0.0738, H: 0.0219, I: 0.0514,
        L: 0.0902, K: 0.0574, M: 0.0224, F: 0.0386, P: 0.0520, S: 0.0712, T: 0.0584, W: 0.0133, Y: 0.0321, V: 0.0644
    };
    const DNA_BACKGROUND = { A: 0.25, C: 0.25, G: 0.25, T: 0.25 };
    const RNA_BACKGROUND = { A: 0.25, C: 0.25, G: 0.25, U: 0.25 };
    const IUPAC = { A: 'A', C: 'C', G: 'G', T: 'T', AG: 'R', CT: 'Y', CG: 'S', AT: 'W', GT: 'K', AC: 'M', CGT: 'B', AGT: 'D', ACT: 'H', ACG: 'V', ACGT: 'N' };

    function alphabet(type) { return type === 'PROTEIN' ? E.BLOSUM_ORDER : type === 'RNA' ? 'ACGU' : 'ACGT'; }
    function background(type) { return type === 'PROTEIN' ? AA_BACKGROUND : type === 'RNA' ? RNA_BACKGROUND : DNA_BACKGROUND; }

    // ------------------------------------------------------------ input
    function parseFasta(text) {
        const seqs = [];
        let cur = null;
        for (const raw of (text || '').split(/\r?\n/)) {
            const line = raw.trim();
            if (!line) continue;
            if (line.startsWith('>')) { cur = { name: line.slice(1).trim().split(/\s+/)[0] || `seq${seqs.length + 1}`, seq: '' }; seqs.push(cur); }
            else if (cur) cur.seq += line.replace(/[\s\d]/g, '');
            else { seqs.push({ name: `seq${seqs.length + 1}`, seq: line.replace(/[\s\d]/g, '') }); cur = null; }
        }
        return seqs.filter(s => s.seq.length);
    }

    function detectType(seqs) {
        const all = seqs.map(s => s.seq.replace(/-/g, '')).join('');
        return E.detectType(all);
    }

    function cleanAll(seqs, type) {
        return seqs.map(s => ({ name: s.name, seq: E.cleanSequence(s.seq.replace(/-/g, ''), type) })).filter(s => s.seq.length);
    }

    // ------------------------------------------------------------ guide tree
    function pairwiseIdentity(a, b) {
        let same = 0, aligned = 0;
        for (let k = 0; k < a.length; k++) {
            if (a[k] === '-' || b[k] === '-') continue;
            aligned++;
            if (a[k] === b[k]) same++;
        }
        return aligned ? same / aligned : 0;
    }

    function distanceMatrix(seqs, params) {
        const n = seqs.length;
        const D = Array.from({ length: n }, () => Array(n).fill(0));
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
            const r = E.globalAlign(seqs[i].seq, seqs[j].seq, params);
            D[i][j] = D[j][i] = 1 - pairwiseIdentity(r.aligned1, r.aligned2);
        }
        return D;
    }

    // UPGMA: returns a binary tree { members, height, left, right, index? }
    function upgma(D, names) {
        let clusters = names.map((nm, i) => ({ members: [i], name: nm, height: 0, size: 1 }));
        let dist = D.map(r => r.slice());
        while (clusters.length > 1) {
            let bi = 0, bj = 1, best = Infinity;
            for (let i = 0; i < clusters.length; i++) for (let j = i + 1; j < clusters.length; j++) if (dist[i][j] < best) { best = dist[i][j]; bi = i; bj = j; }
            const a = clusters[bi], b = clusters[bj];
            const merged = { members: a.members.concat(b.members), left: a, right: b, height: best / 2, size: a.size + b.size };
            const newDist = [];
            for (let k = 0; k < clusters.length; k++) if (k !== bi && k !== bj) newDist.push((dist[bi][k] * a.size + dist[bj][k] * b.size) / (a.size + b.size));
            const keep = clusters.filter((_, k) => k !== bi && k !== bj);
            const d2 = keep.map((_, x) => keep.map((_, y) => {
                const ox = clusters.indexOf(keep[x]), oy = clusters.indexOf(keep[y]);
                return dist[ox][oy];
            }));
            d2.forEach((row, x) => row.push(newDist[x]));
            d2.push(newDist.concat([0]));
            clusters = keep.concat([merged]);
            dist = d2;
        }
        return clusters[0];
    }

    // Newick string with branch lengths (for display)
    function newick(tree) {
        if (!tree.left) return tree.name;
        const bl = t => (tree.height - t.height).toFixed(3);
        return `(${newick(tree.left)}:${bl(tree.left)},${newick(tree.right)}:${bl(tree.right)})`;
    }

    // ------------------------------------------------------------ profile alignment
    function columnCounts(rows, k) {
        const counts = {};
        let gaps = 0;
        for (const r of rows) { const c = r[k]; if (c === '-') gaps++; else counts[c] = (counts[c] || 0) + 1; }
        return { counts, gaps, n: rows.length };
    }

    // average substitution score between two profile columns (gap vs residue = 0)
    function colScore(ca, cb, params) {
        let s = 0;
        for (const a in ca.counts) for (const b in cb.counts) s += ca.counts[a] * cb.counts[b] * E.subScore(params, a, b);
        return s / (ca.n * cb.n);
    }

    /**
     * Align two groups of already-aligned rows (Gotoh over columns).
     * Returns { rowsA, rowsB } with gap columns inserted so both have equal length.
     */
    function alignProfiles(rowsA, rowsB, params) {
        const n = rowsA[0].length, m = rowsB[0].length;
        const A = Array.from({ length: n }, (_, i) => columnCounts(rowsA, i));
        const B = Array.from({ length: m }, (_, j) => columnCounts(rowsB, j));
        const open = params.gapModel === 'affine' ? params.gapOpen : params.gap;
        const ext = params.gapModel === 'affine' ? params.gapExtend : params.gap;
        const NEG = -1e9;
        const mk = v => Array.from({ length: n + 1 }, () => Array(m + 1).fill(v));
        const M = mk(NEG), X = mk(NEG), Y = mk(NEG), tM = mk(0), tX = mk(0), tY = mk(0);
        M[0][0] = 0;
        for (let i = 1; i <= n; i++) { X[i][0] = open + (i - 1) * ext; tX[i][0] = i === 1 ? 0 : 1; }
        for (let j = 1; j <= m; j++) { Y[0][j] = open + (j - 1) * ext; tY[0][j] = j === 1 ? 0 : 2; }
        for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
            const s = colScore(A[i - 1], B[j - 1], params);
            const c = [M[i - 1][j - 1], X[i - 1][j - 1], Y[i - 1][j - 1]];
            const k = c.indexOf(Math.max(...c));
            M[i][j] = c[k] + s; tM[i][j] = k;
            const xo = M[i - 1][j] + open, xe = X[i - 1][j] + ext;
            if (xo >= xe) { X[i][j] = xo; tX[i][j] = 0; } else { X[i][j] = xe; tX[i][j] = 1; }
            const yo = M[i][j - 1] + open, ye = Y[i][j - 1] + ext;
            if (yo >= ye) { Y[i][j] = yo; tY[i][j] = 0; } else { Y[i][j] = ye; tY[i][j] = 2; }
        }
        const finals = [M[n][m], X[n][m], Y[n][m]];
        let state = finals.indexOf(Math.max(...finals));
        const score = finals[state];
        // traceback → list of column operations from the end
        const ops = [];
        let i = n, j = m;
        while (i > 0 || j > 0) {
            if (i === 0) { ops.push('Y'); j--; continue; }
            if (j === 0) { ops.push('X'); i--; continue; }
            if (state === 0) { ops.push('M'); state = tM[i][j]; i--; j--; }
            else if (state === 1) { ops.push('X'); state = tX[i][j]; i--; }
            else { ops.push('Y'); state = tY[i][j]; j--; }
        }
        ops.reverse();
        const outA = rowsA.map(() => ''), outB = rowsB.map(() => '');
        i = 0; j = 0;
        for (const op of ops) {
            if (op === 'M') { rowsA.forEach((r, x) => outA[x] += r[i]); rowsB.forEach((r, x) => outB[x] += r[j]); i++; j++; }
            else if (op === 'X') { rowsA.forEach((r, x) => outA[x] += r[i]); rowsB.forEach((r, x) => outB[x] += '-'); i++; }
            else { rowsA.forEach((r, x) => outA[x] += '-'); rowsB.forEach((r, x) => outB[x] += r[j]); j++; }
        }
        return { rowsA: outA, rowsB: outB, score };
    }

    /**
     * Progressive alignment. Returns { tree, steps, rows } where rows are the
     * aligned sequences in the ORIGINAL input order and steps describe every
     * merge: { a: [indices], b: [indices], before: {rowsA, rowsB}, after: rows, score }.
     */
    function progressive(seqs, params) {
        if (seqs.length === 1) return { tree: { members: [0], name: seqs[0].name, height: 0 }, steps: [], rows: [seqs[0].seq], D: [[0]], order: [0] };
        const D = distanceMatrix(seqs, params);
        const tree = upgma(D, seqs.map(s => s.name));
        const steps = [];
        const build = node => {
            if (!node.left) return { members: [node.members[0]], rows: [seqs[node.members[0]].seq] };
            const L = build(node.left), R = build(node.right);
            const res = alignProfiles(L.rows, R.rows, params);
            const members = L.members.concat(R.members);
            const rows = res.rowsA.concat(res.rowsB);
            node.step = steps.length;          // which merge this node represents
            steps.push({ a: L.members, b: R.members, before: { rowsA: L.rows, rowsB: R.rows }, after: rows, members, score: res.score, node });
            return { members, rows };
        };
        const final = build(tree);
        const rows = seqs.map((_, idx) => final.rows[final.members.indexOf(idx)]);
        // order = sequence indices in guide-tree leaf order (left to right)
        return { tree, steps, rows, D, order: final.members };
    }

    // ------------------------------------------------------------ scoring an MSA
    function sumOfPairs(rows, params) {
        const L = rows[0].length, per = [];
        let total = 0;
        for (let k = 0; k < L; k++) {
            let s = 0;
            for (let a = 0; a < rows.length; a++) for (let b = a + 1; b < rows.length; b++) {
                const x = rows[a][k], y = rows[b][k];
                if (x === '-' && y === '-') continue;
                if (x === '-' || y === '-') s += params.gapModel === 'affine' ? params.gapExtend : params.gap;   // per-column gap cost (no opening model in SP)
                else s += E.subScore(params, x, y);
            }
            per.push(s); total += s;
        }
        return { total, perColumn: per };
    }

    function identityMatrix(rows) {
        return rows.map((a, i) => rows.map((b, j) => i === j ? 1 : pairwiseIdentity(a, b)));
    }

    function removeGapOnlyColumns(rows) {
        const keep = [];
        for (let k = 0; k < rows[0].length; k++) if (rows.some(r => r[k] !== '-')) keep.push(k);
        return rows.map(r => keep.map(k => r[k]).join(''));
    }

    /**
     * Per-column statistics.
     * opts: { pseudocount (β, default 1), correction (small-sample, default true), gapScale (default true), threshold (consensus, default 0.5) }
     */
    function columnStats(rows, type, opts = {}) {
        const o = Object.assign({ pseudocount: 1, correction: true, gapScale: true, threshold: 0.5 }, opts);
        const alpha = alphabet(type).split(''), bg = background(type), N = rows.length, L = rows[0].length;
        const maxBits = Math.log2(alpha.length);
        const cols = [];
        for (let k = 0; k < L; k++) {
            const cc = columnCounts(rows, k);
            const nRes = N - cc.gaps;
            const freq = {}, pfreq = {}, pssm = {};
            let H = 0;
            for (const a of alpha) {
                const c = cc.counts[a] || 0;
                freq[a] = nRes ? c / nRes : 0;
                if (freq[a] > 0) H -= freq[a] * Math.log2(freq[a]);
                pfreq[a] = (c + o.pseudocount * bg[a]) / (nRes + o.pseudocount || 1);
                pssm[a] = nRes ? Math.log2(pfreq[a] / bg[a]) : 0;
            }
            const en = o.correction && nRes > 0 ? (alpha.length - 1) / (2 * LN2 * nRes) : 0;
            let R = nRes ? Math.max(0, maxBits - H - en) : 0;
            const gapFraction = cc.gaps / N;
            const Rlogo = o.gapScale ? R * (1 - gapFraction) : R;
            // consensus: most frequent residue (fraction of ALL rows) if it reaches the threshold
            let top = null, topCount = 0;
            for (const a in cc.counts) if (cc.counts[a] > topCount) { topCount = cc.counts[a]; top = a; }
            let consensus;
            if (cc.gaps > N / 2) consensus = '-';
            else if (top && topCount / N >= o.threshold) consensus = top;
            else if (type !== 'PROTEIN') {
                const set = alpha.filter(a => (cc.counts[a] || 0) / N >= 0.25).map(a => a === 'U' ? 'T' : a).sort().join('');
                consensus = IUPAC[set] || 'N';
                if (type === 'RNA' && consensus === 'T') consensus = 'U';
            } else consensus = topCount / N >= o.threshold / 2 ? top.toLowerCase() : 'x';
            cols.push({ index: k, counts: cc.counts, gaps: cc.gaps, nRes, freq, pfreq, pssm, entropy: H, correction: en, info: R, logoHeight: Rlogo,
                        gapFraction, consensus, top, topFraction: topCount / N, conserved: topCount === N && cc.gaps === 0,
                        letters: alpha.filter(a => freq[a] > 0).map(a => ({ a, h: freq[a] * Rlogo })).sort((x, y) => x.h - y.h) });
        }
        return { columns: cols, maxBits, alphabet: alpha, background: bg };
    }

    function consensusString(stats) { return stats.columns.map(c => c.consensus).join(''); }

    /**
     * Score a sequence against the PSSM at every position (columns with more
     * than 50 % gaps are skipped, i.e. the PSSM has only the "core" columns).
     */
    function scanPSSM(seq, stats) {
        const core = stats.columns.filter(c => c.gapFraction <= 0.5);
        const W = core.length, out = [];
        for (let p = 0; p + W <= seq.length; p++) {
            let s = 0;
            for (let k = 0; k < W; k++) { const v = core[k].pssm[seq[p + k]]; s += v === undefined ? -2 : v; }
            out.push({ pos: p, score: s });
        }
        return { width: W, scores: out, best: out.reduce((b, x) => (!b || x.score > b.score) ? x : b, null) };
    }

    // helpers used by example questions
    function bestColumn(stats, residue) {
        const cols = residue ? stats.columns.filter(c => c.top === residue) : stats.columns;
        return cols.reduce((b, c) => c.info > b.info ? c : b, cols[0]);
    }
    function meanIdentity(I) { let s = 0, n = 0; for (let i = 0; i < I.length; i++) for (let j = i + 1; j < I.length; j++) { s += I[i][j]; n++; } return n ? s / n : 0; }
    // alignment column of residue `offset` of the first occurrence of `motif` in an aligned row
    function motifColumn(row, motif, offset) {
        const bare = row.replace(/-/g, '');
        const p = bare.indexOf(motif);
        if (p < 0) return -1;
        let res = -1;
        for (let k = 0; k < row.length; k++) { if (row[k] !== '-') res++; if (res === p + offset) return k; }
        return -1;
    }

    return { parseFasta, detectType, cleanAll, alphabet, background, distanceMatrix, upgma, newick, alignProfiles, progressive,
             sumOfPairs, identityMatrix, pairwiseIdentity, removeGapOnlyColumns, columnStats, consensusString, scanPSSM, columnCounts,
             bestColumn, meanIdentity, motifColumn };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MsaEngine;
}
