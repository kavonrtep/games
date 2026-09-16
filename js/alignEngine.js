/**
 * ALIGNMENT ENGINE
 * ================
 * Pure pairwise-alignment computations shared by the global trainer, the
 * local trainer, the matrix view and the alignment quiz. No DOM access, so
 * it can be tested in Node.
 *
 * Conventions
 *  - i indexes seq1 (drawn left→right, matrix columns), j indexes seq2
 *    (drawn top→bottom, matrix rows). S[i][j] is the score of aligning the
 *    first i characters of seq1 with the first j of seq2.
 *  - A step (i-1,j-1)→(i,j) is a match/mismatch, (i-1,j)→(i,j) consumes a
 *    seq1 character against a gap in seq2, (i,j-1)→(i,j) a seq2 character
 *    against a gap in seq1.
 *  - Gap of length k costs k·gap (linear) or open + (k−1)·extend (affine).
 *    Terminal gaps cost the same unless params.endGaps === 'free'.
 *
 * params = {
 *   type: 'DNA' | 'RNA' | 'PROTEIN',
 *   gapModel: 'linear' | 'affine', gap, gapOpen, gapExtend,
 *   endGaps: 'penalized' | 'free',
 *   substitution: { kind: 'simple', match, mismatch }
 *               | { kind: 'titv', match, transition, transversion }
 *               | { kind: 'custom', table: { A: { A: 2, ... }, ... } }
 *               | { kind: 'blosum62' }
 * }
 */
const AlignEngine = (() => {
    const NEG = -1e9;

    // ------------------------------------------------------------ BLOSUM62
    const BLOSUM_ORDER = 'ARNDCQEGHILKMFPSTWYV';
    const BLOSUM_ROWS = [
        [4, -1, -2, -2, 0, -1, -1, 0, -2, -1, -1, -1, -1, -2, -1, 1, 0, -3, -2, 0],
        [-1, 5, 0, -2, -3, 1, 0, -2, 0, -3, -2, 2, -1, -3, -2, -1, -1, -3, -2, -3],
        [-2, 0, 6, 1, -3, 0, 0, 0, 1, -3, -3, 0, -2, -3, -2, 1, 0, -4, -2, -3],
        [-2, -2, 1, 6, -3, 0, 2, -1, -1, -3, -4, -1, -3, -3, -1, 0, -1, -4, -3, -3],
        [0, -3, -3, -3, 9, -3, -4, -3, -3, -1, -1, -3, -1, -2, -3, -1, -1, -2, -2, -1],
        [-1, 1, 0, 0, -3, 5, 2, -2, 0, -3, -2, 1, 0, -3, -1, 0, -1, -2, -1, -2],
        [-1, 0, 0, 2, -4, 2, 5, -2, 0, -3, -3, 1, -2, -3, -1, 0, -1, -3, -2, -2],
        [0, -2, 0, -1, -3, -2, -2, 6, -2, -4, -4, -2, -3, -3, -2, 0, -2, -2, -3, -3],
        [-2, 0, 1, -1, -3, 0, 0, -2, 8, -3, -3, -1, -2, -1, -2, -1, -2, -2, 2, -3],
        [-1, -3, -3, -3, -1, -3, -3, -4, -3, 4, 2, -3, 1, 0, -3, -2, -1, -3, -1, 3],
        [-1, -2, -3, -4, -1, -2, -3, -4, -3, 2, 4, -2, 2, 0, -3, -2, -1, -2, -1, 1],
        [-1, 2, 0, -1, -3, 1, 1, -2, -1, -3, -2, 5, -1, -3, -1, 0, -1, -3, -2, -2],
        [-1, -1, -2, -3, -1, 0, -2, -3, -2, 1, 2, -1, 5, 0, -2, -1, -1, -1, -1, 1],
        [-2, -3, -3, -3, -2, -3, -3, -3, -1, 0, 0, -3, 0, 6, -4, -2, -2, 1, 3, -1],
        [-1, -2, -2, -1, -3, -1, -1, -2, -2, -3, -3, -1, -2, -4, 7, -1, -1, -4, -3, -2],
        [1, -1, 1, 0, -1, 0, 0, 0, -1, -2, -2, 0, -1, -2, -1, 4, 1, -3, -2, -2],
        [0, -1, 0, -1, -1, -1, -1, -2, -2, -1, -1, -1, -1, -2, -1, 1, 5, -2, -2, 0],
        [-3, -3, -4, -4, -2, -2, -3, -2, -2, -3, -2, -3, -1, 1, -4, -3, -2, 11, 2, -3],
        [-2, -2, -2, -3, -2, -1, -2, -3, 2, -1, -1, -2, -1, 3, -3, -2, -2, 2, 7, -1],
        [0, -3, -3, -3, -1, -2, -2, -3, -3, 3, 1, -2, 1, -1, -2, -2, 0, -3, -1, 4]
    ];
    const BLOSUM62 = {};
    BLOSUM_ORDER.split('').forEach((a, x) => {
        BLOSUM62[a] = {};
        BLOSUM_ORDER.split('').forEach((b, y) => { BLOSUM62[a][b] = BLOSUM_ROWS[x][y]; });
    });

    // ------------------------------------------------------------ sequences
    function detectType(seq) {
        const s = (seq || '').toUpperCase().replace(/[^A-Z]/g, '');
        if (!s) return 'DNA';
        if (/^[ACGTN]+$/.test(s)) return 'DNA';
        if (/^[ACGUN]+$/.test(s)) return 'RNA';
        return 'PROTEIN';
    }

    function cleanSequence(seq, type) {
        const s = (seq || '').toUpperCase();
        if (type === 'DNA') return s.replace(/[^ACGTN]/g, '');
        if (type === 'RNA') return s.replace(/[^ACGUN]/g, '');
        return s.replace(/[^ARNDCQEGHILKMFPSTWYVX]/g, '');
    }

    function randomSequence(len, type = 'DNA') {
        const alphabet = type === 'PROTEIN' ? BLOSUM_ORDER : type === 'RNA' ? 'ACGU' : 'ACGT';
        let s = '';
        for (let k = 0; k < len; k++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
        return s;
    }

    // ------------------------------------------------------------ parameters
    function defaultParams(type = 'DNA') {
        return {
            type,
            gapModel: 'linear', gap: -2, gapOpen: -4, gapExtend: -1,
            endGaps: 'penalized',
            substitution: type === 'PROTEIN' ? { kind: 'blosum62' } : { kind: 'simple', match: 2, mismatch: -1 }
        };
    }

    const PURINES = 'AG', PYRIMIDINES = 'CTU';
    function isTransition(a, b) {
        return (PURINES.includes(a) && PURINES.includes(b)) || (PYRIMIDINES.includes(a) && PYRIMIDINES.includes(b));
    }

    function subScore(params, a, b) {
        const s = params.substitution;
        switch (s.kind) {
            case 'blosum62': return (BLOSUM62[a] && BLOSUM62[a][b] !== undefined) ? BLOSUM62[a][b] : -4;
            case 'custom': return (s.table[a] && s.table[a][b] !== undefined) ? s.table[a][b] : (a === b ? s.match || 1 : s.mismatch || -1);
            case 'titv': return a === b ? s.match : isTransition(a, b) ? s.transition : s.transversion;
            default: return a === b ? s.match : s.mismatch;
        }
    }

    // cost of a gap of length k
    function gapCost(params, k) {
        if (k <= 0) return 0;
        if (params.gapModel === 'affine') return params.gapOpen + (k - 1) * params.gapExtend;
        return k * params.gap;
    }
    // cost of the first / subsequent gap symbol (used by the DP)
    function gapFirst(params) { return params.gapModel === 'affine' ? params.gapOpen : params.gap; }
    function gapNext(params) { return params.gapModel === 'affine' ? params.gapExtend : params.gap; }

    // ------------------------------------------------------------ scoring an alignment
    /**
     * Score a given alignment column by column. Returns per-column details
     * so the editor can show the contribution of each column.
     */
    function scoreAlignment(a1, a2, params) {
        const n = Math.max(a1.length, a2.length);
        const cols = [];
        let total = 0, matches = 0, mismatches = 0, gaps = 0, gapOpenings = 0, subTotal = 0, gapTotal = 0, endGapCols = 0;

        // a gap is terminal when it lies before the first or after the last residue of ITS sequence
        const firstRes = s => { let k = 0; while (k < n && (s[k] === '-' || s[k] === undefined)) k++; return k; };
        const lastRes = s => { let k = n - 1; while (k >= 0 && (s[k] === '-' || s[k] === undefined)) k--; return k; };
        const f1 = firstRes(a1), l1 = lastRes(a1), f2 = firstRes(a2), l2 = lastRes(a2);

        let run = null;   // which sequence the current gap run is in (1 or 2)
        for (let k = 0; k < n; k++) {
            const c1 = a1[k] || '-', c2 = a2[k] || '-';
            const terminal = c1 === '-' ? (k < f1 || k > l1) : c2 === '-' ? (k < f2 || k > l2) : false;
            let col;
            if (c1 === '-' && c2 === '-') {
                col = { c1, c2, type: 'empty', score: 0 };
                run = null;
            } else if (c1 === '-' || c2 === '-') {
                const which = c1 === '-' ? 1 : 2;
                const opening = run !== which;
                run = which;
                gaps++;
                if (opening) gapOpenings++;
                let score = opening ? gapFirst(params) : gapNext(params);
                if (terminal && params.endGaps === 'free') { score = 0; endGapCols++; }
                gapTotal += score;
                col = { c1, c2, type: 'gap', score, opening, terminal };
            } else {
                run = null;
                const score = subScore(params, c1, c2);
                if (c1 === c2) matches++; else mismatches++;
                subTotal += score;
                col = { c1, c2, type: c1 === c2 ? 'match' : 'mismatch', score };
            }
            total += col.score;
            cols.push(col);
        }
        const aligned = matches + mismatches;
        return {
            total, matches, mismatches, gaps, gapOpenings, subTotal, gapTotal, endGapCols,
            length: n, identity: aligned ? matches / aligned : 0, columns: cols
        };
    }

    // ------------------------------------------------------------ helpers
    const mk = (n, m, v) => Array.from({ length: n + 1 }, () => Array(m + 1).fill(v));
    const DIAG = 1, LEFT = 2, UP = 4;   // LEFT: from (i-1,j) (seq1 char vs gap); UP: from (i,j-1)

    /**
     * Linear-gap Needleman–Wunsch with full traceback information.
     * Returns { score, aligned1, aligned2, S, dirs, path, end, optimalPaths }.
     * dirs[i][j] is a bitmask of all predecessors that attain S[i][j].
     */
    function nwLinear(s1, s2, params) {
        const n = s1.length, m = s2.length, g = params.gap, free = params.endGaps === 'free';
        const S = mk(n, m, 0), dirs = mk(n, m, 0), count = mk(n, m, 0);
        count[0][0] = 1;
        for (let i = 1; i <= n; i++) { S[i][0] = free ? 0 : i * g; dirs[i][0] = LEFT; count[i][0] = 1; }
        for (let j = 1; j <= m; j++) { S[0][j] = free ? 0 : j * g; dirs[0][j] = UP; count[0][j] = 1; }
        for (let i = 1; i <= n; i++) {
            for (let j = 1; j <= m; j++) {
                const d = S[i - 1][j - 1] + subScore(params, s1[i - 1], s2[j - 1]);
                const l = S[i - 1][j] + g;
                const u = S[i][j - 1] + g;
                const best = Math.max(d, l, u);
                S[i][j] = best;
                let mask = 0, c = 0;
                if (d === best) { mask |= DIAG; c += count[i - 1][j - 1]; }
                if (l === best) { mask |= LEFT; c += count[i - 1][j]; }
                if (u === best) { mask |= UP; c += count[i][j - 1]; }
                dirs[i][j] = mask;
                count[i][j] = c;
            }
        }
        // end cell: bottom-right, or the best cell on the last row/column when end gaps are free
        let end = { i: n, j: m }, score = S[n][m], optimalPaths = count[n][m];
        if (free) {
            const ends = [];
            for (let i = 0; i <= n; i++) ends.push({ i, j: m });
            for (let j = 0; j < m; j++) ends.push({ i: n, j });
            score = Math.max(...ends.map(e => S[e.i][e.j]));
            const bestEnds = ends.filter(e => S[e.i][e.j] === score);
            end = bestEnds.find(e => e.i === n && e.j === m) || bestEnds[0];
            optimalPaths = bestEnds.reduce((s, e) => s + count[e.i][e.j], 0);
        }
        const tb = tracebackLinear(s1, s2, dirs, end, free);
        return Object.assign({ score, S, dirs, end, optimalPaths, gapModel: 'linear' }, tb);
    }

    // Preferring DIAG, then LEFT, then UP on ties. `path` lists all cells from (0,0) to (n,m).
    function tracebackLinear(s1, s2, dirs, end, free) {
        const n = s1.length, m = s2.length;
        let a1 = '', a2 = '';
        let i = n, j = m;
        const path = [];
        // free trailing gaps after the end cell
        while (i > end.i) { a1 = s1[i - 1] + a1; a2 = '-' + a2; path.push({ i, j }); i--; }
        while (j > end.j) { a1 = '-' + a1; a2 = s2[j - 1] + a2; path.push({ i, j }); j--; }
        while (i > 0 || j > 0) {
            path.push({ i, j });
            const d = dirs[i][j];
            if (d & DIAG) { a1 = s1[i - 1] + a1; a2 = s2[j - 1] + a2; i--; j--; }
            else if (d & LEFT || (j === 0)) { a1 = s1[i - 1] + a1; a2 = '-' + a2; i--; }
            else { a1 = '-' + a1; a2 = s2[j - 1] + a2; j--; }
        }
        path.push({ i: 0, j: 0 });
        path.reverse();
        return { aligned1: a1, aligned2: a2, path };
    }

    /**
     * Linear-gap Smith–Waterman. Returns { score, aligned1, aligned2, S, dirs,
     * start, end, path, s1Start, s1End, s2Start, s2End } (1-based inclusive).
     */
    function swLinear(s1, s2, params) {
        const n = s1.length, m = s2.length, g = params.gap;
        const S = mk(n, m, 0), dirs = mk(n, m, 0);
        let best = 0, end = { i: 0, j: 0 };
        for (let i = 1; i <= n; i++) {
            for (let j = 1; j <= m; j++) {
                const d = S[i - 1][j - 1] + subScore(params, s1[i - 1], s2[j - 1]);
                const l = S[i - 1][j] + g;
                const u = S[i][j - 1] + g;
                const v = Math.max(0, d, l, u);
                S[i][j] = v;
                let mask = 0;
                if (v > 0) {
                    if (d === v) mask |= DIAG;
                    if (l === v) mask |= LEFT;
                    if (u === v) mask |= UP;
                }
                dirs[i][j] = mask;
                if (v > best) { best = v; end = { i, j }; }
            }
        }
        const tb = tracebackLocal(s1, s2, S, dirs, end);
        return Object.assign({ score: best, S, dirs, end, gapModel: 'linear' }, tb);
    }

    function tracebackLocal(s1, s2, S, dirs, end, used) {
        let a1 = '', a2 = '', i = end.i, j = end.j;
        const path = [];
        while (i > 0 && j > 0 && S[i][j] > 0) {
            if (used && used[i][j]) return null;   // runs into an alignment reported earlier
            path.push({ i, j });
            const d = dirs[i][j];
            if (d & DIAG) { a1 = s1[i - 1] + a1; a2 = s2[j - 1] + a2; i--; j--; }
            else if (d & LEFT) { a1 = s1[i - 1] + a1; a2 = '-' + a2; i--; }
            else if (d & UP) { a1 = '-' + a1; a2 = s2[j - 1] + a2; j--; }
            else break;
        }
        path.push({ i, j });
        path.reverse();
        return { aligned1: a1, aligned2: a2, path, start: { i, j },
                 s1Start: i + 1, s1End: end.i, s2Start: j + 1, s2End: end.j };
    }

    /**
     * Gotoh (affine gaps), global or local. Three states: M (match), X (gap in
     * seq2, i.e. seq1 char consumed), Y (gap in seq1). Returns the same shape
     * as the linear functions plus matrices M, X, Y; S holds max(M,X,Y).
     */
    function gotoh(s1, s2, params, local) {
        const n = s1.length, m = s2.length;
        const open = params.gapOpen, ext = params.gapExtend, free = !local && params.endGaps === 'free';
        const M = mk(n, m, NEG), X = mk(n, m, NEG), Y = mk(n, m, NEG);
        const tM = mk(n, m, 0), tX = mk(n, m, 0), tY = mk(n, m, 0);   // 0=M,1=X,2=Y (predecessor state); 3 = start
        M[0][0] = 0;
        for (let i = 1; i <= n; i++) { X[i][0] = local ? NEG : free ? 0 : open + (i - 1) * ext; tX[i][0] = i === 1 ? 0 : 1; }
        for (let j = 1; j <= m; j++) { Y[0][j] = local ? NEG : free ? 0 : open + (j - 1) * ext; tY[0][j] = j === 1 ? 0 : 2; }
        if (local) for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) M[i][j] = 0;

        let best = 0, end = { i: n, j: m };
        for (let i = 1; i <= n; i++) {
            for (let j = 1; j <= m; j++) {
                const sub = subScore(params, s1[i - 1], s2[j - 1]);
                const cand = [M[i - 1][j - 1], X[i - 1][j - 1], Y[i - 1][j - 1]];
                let k = cand.indexOf(Math.max(...cand));
                let v = cand[k] + sub;
                if (local && v <= 0) { v = 0; k = 3; }
                M[i][j] = v; tM[i][j] = k;
                // X: seq1 char vs gap, from (i-1, j)
                const xo = M[i - 1][j] + open, xe = X[i - 1][j] + ext;
                if (xo >= xe) { X[i][j] = xo; tX[i][j] = 0; } else { X[i][j] = xe; tX[i][j] = 1; }
                const yo = M[i][j - 1] + open, ye = Y[i][j - 1] + ext;
                if (yo >= ye) { Y[i][j] = yo; tY[i][j] = 0; } else { Y[i][j] = ye; tY[i][j] = 2; }
                if (local && M[i][j] > best) { best = M[i][j]; end = { i, j }; }
            }
        }
        const S = mk(n, m, 0);
        for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) S[i][j] = Math.max(M[i][j], X[i][j], Y[i][j], local ? 0 : NEG);

        let score, state;
        if (local) {
            score = best; state = 0;
        } else if (free) {
            const ends = [];
            for (let i = 0; i <= n; i++) ends.push({ i, j: m });
            for (let j = 0; j < m; j++) ends.push({ i: n, j });
            score = Math.max(...ends.map(e => S[e.i][e.j]));
            end = ends.find(e => e.i === n && e.j === m && S[e.i][e.j] === score) || ends.find(e => S[e.i][e.j] === score);
            state = [M, X, Y].findIndex(T => T[end.i][end.j] === score);
        } else {
            score = S[n][m];
            state = [M, X, Y].findIndex(T => T[n][m] === score);
        }
        const tb = tracebackGotoh(s1, s2, { M, X, Y, tM, tX, tY }, end, state, local, free);
        return Object.assign({ score, S, M, X, Y, tM, tX, tY, end, gapModel: 'affine', optimalPaths: null }, tb);
    }

    function tracebackGotoh(s1, s2, T, end, state, local, free, used) {
        const n = s1.length, m = s2.length;
        let a1 = '', a2 = '', i = n, j = m;
        const path = [];
        if (!local) {
            while (i > end.i) { a1 = s1[i - 1] + a1; a2 = '-' + a2; path.push({ i, j }); i--; }
            while (j > end.j) { a1 = '-' + a1; a2 = s2[j - 1] + a2; path.push({ i, j }); j--; }
        } else { i = end.i; j = end.j; }
        while (i > 0 || j > 0) {
            if (local && state === 0 && T.M[i][j] <= 0) break;
            if (used && used[i][j]) return null;
            path.push({ i, j });
            if (state === 0) {
                const prev = T.tM[i][j];
                a1 = s1[i - 1] + a1; a2 = s2[j - 1] + a2; i--; j--;
                if (prev === 3) break;
                state = prev;
            } else if (state === 1) {
                const prev = T.tX[i][j];
                a1 = s1[i - 1] + a1; a2 = '-' + a2; i--;
                state = (j === 0 && i > 0) ? 1 : prev;
                if (i === 0 && j === 0) break;
            } else {
                const prev = T.tY[i][j];
                a1 = '-' + a1; a2 = s2[j - 1] + a2; j--;
                state = (i === 0 && j > 0) ? 2 : prev;
                if (i === 0 && j === 0) break;
            }
            if (!local && i === 0 && j === 0) break;
        }
        if (!local) path.push({ i: 0, j: 0 }); else path.push({ i, j });
        path.reverse();
        const out = { aligned1: a1, aligned2: a2, path, start: { i, j } };
        if (local) Object.assign(out, { s1Start: i + 1, s1End: end.i, s2Start: j + 1, s2End: end.j });
        return out;
    }

    // ------------------------------------------------------------ public API
    function globalAlign(s1, s2, params) {
        return params.gapModel === 'affine' ? gotoh(s1, s2, params, false) : nwLinear(s1, s2, params);
    }

    function localAlign(s1, s2, params) {
        return params.gapModel === 'affine' ? gotoh(s1, s2, params, true) : swLinear(s1, s2, params);
    }

    /**
     * All local alignments with score >= threshold, best first. A traceback
     * that runs into a cell already used by a better alignment is discarded,
     * so each reported alignment is a genuinely distinct region.
     */
    function localAlignments(s1, s2, params, threshold, maxCount = 20) {
        const res = localAlign(s1, s2, params);
        const n = s1.length, m = s2.length;
        const cells = [];
        for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) if (res.S[i][j] >= threshold && res.S[i][j] > 0) cells.push({ i, j, score: res.S[i][j] });
        cells.sort((a, b) => b.score - a.score || a.i - b.i || a.j - b.j);
        const used = mk(n, m, false);
        const out = [];
        for (const c of cells) {
            if (used[c.i][c.j]) continue;
            let tb;
            if (params.gapModel === 'affine') {
                if (res.M[c.i][c.j] !== c.score) continue;   // only cells that end in a match state
                tb = tracebackGotoh(s1, s2, res, { i: c.i, j: c.j }, 0, true, false, used);
            } else {
                tb = tracebackLocal(s1, s2, res.S, res.dirs, { i: c.i, j: c.j }, used);
            }
            if (!tb || !tb.aligned1.length) continue;
            for (const p of tb.path) if (p.i > 0 && p.j > 0) used[p.i][p.j] = true;
            out.push(Object.assign({ score: c.score, end: { i: c.i, j: c.j } }, tb));
            if (out.length >= maxCount) break;
        }
        return { alignments: out, S: res.S, best: res };
    }

    // The DP recurrence for one cell, for the step-by-step view (linear gaps).
    function cellCandidates(S, s1, s2, i, j, params, local) {
        const sub = subScore(params, s1[i - 1], s2[j - 1]);
        const c = [
            { dir: 'diag', from: [i - 1, j - 1], base: S[i - 1][j - 1], delta: sub, value: S[i - 1][j - 1] + sub, label: s1[i - 1] === s2[j - 1] ? 'match' : 'mismatch' },
            { dir: 'left', from: [i - 1, j], base: S[i - 1][j], delta: params.gap, value: S[i - 1][j] + params.gap, label: `gap in seq 2` },
            { dir: 'up', from: [i, j - 1], base: S[i][j - 1], delta: params.gap, value: S[i][j - 1] + params.gap, label: `gap in seq 1` }
        ];
        const best = Math.max(...c.map(x => x.value), local ? 0 : NEG);
        c.forEach(x => { x.best = x.value === best; });
        return { candidates: c, best: local ? Math.max(0, best) : best, floored: local && best <= 0 };
    }

    // Aligned strings → list of matrix cells visited (for drawing a student's alignment as a path)
    function alignmentToPath(a1, a2) {
        const path = [{ i: 0, j: 0 }];
        let i = 0, j = 0;
        for (let k = 0; k < Math.max(a1.length, a2.length); k++) {
            const c1 = a1[k] || '-', c2 = a2[k] || '-';
            if (c1 !== '-') i++;
            if (c2 !== '-') j++;
            if (c1 === '-' && c2 === '-') continue;
            path.push({ i, j });
        }
        return path;
    }

    return {
        BLOSUM62, BLOSUM_ORDER, DIAG, LEFT, UP,
        detectType, cleanSequence, randomSequence, defaultParams, subScore, gapCost,
        scoreAlignment, globalAlign, localAlign, localAlignments, cellCandidates, alignmentToPath
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AlignEngine;
}
