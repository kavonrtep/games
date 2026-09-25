/**
 * HMM ENGINE
 * ==========
 * DOM-free hidden-Markov-model computations for the HMM Explorer:
 *
 *  1. General discrete HMM (e.g. CpG islands, the dishonest casino):
 *     sampling, probability of a path, Viterbi, Forward, Backward,
 *     posterior decoding, estimation of parameters by counting.
 *  2. Pair HMM (states M, X, Y; Durbin et al. 1998, ch. 4): probability of
 *     an alignment, Viterbi, Forward/Backward, posterior probabilities of
 *     aligned pairs, and the log-odds scores that make Viterbi the same as
 *     affine-gap (Gotoh) alignment.
 *  3. Profile HMM (Plan7 architecture as in HMMER): building from an MSA
 *     with pseudocounts, Viterbi and Forward scores in bits against a
 *     length-matched null model, sampling, E-values by simulation with the
 *     exponential tail fixed at λ = ln 2, and a family-database generator.
 *
 * All dynamic programming is in log space (natural log for parts 1–2,
 * log2 = bits for part 3). Matrix orientation follows the other apps:
 * sequence positions run horizontally.
 */
const HmmEngine = (() => {
    const NEG = -Infinity;
    const LN2 = Math.log(2), LN10 = Math.log(10);
    const ln = x => x > 0 ? Math.log(x) : NEG;
    const lg2 = x => x > 0 ? Math.log2(x) : NEG;
    function logsum(a, b) {
        if (a === NEG) return b;
        if (b === NEG) return a;
        return a > b ? a + Math.log1p(Math.exp(b - a)) : b + Math.log1p(Math.exp(a - b));
    }
    const logsum2 = (a, b) => (a === NEG) ? b : (b === NEG) ? a : (a > b ? a + Math.log2(1 + Math.pow(2, b - a)) : b + Math.log2(1 + Math.pow(2, a - b)));
    const maxOf = arr => arr.reduce((m, x) => x > m ? x : m, NEG);
    const argmax = arr => { let b = 0; for (let k = 1; k < arr.length; k++) if (arr[k] > arr[b]) b = k; return b; };

    // ------------------------------------------------------------ seeded RNG (same generator as the other apps)
    function hashString(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
    class Rng {
        constructor(seed) { let a = (typeof seed === 'number' ? seed : hashString(String(seed))) >>> 0; this.next = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
        int(lo, hi) { return lo + Math.floor(this.next() * (hi - lo + 1)); }
        pick(a) { return a[Math.floor(this.next() * a.length)]; }
        chance(p) { return this.next() < p; }
        shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(this.next() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; }
        // draw an index from probabilities p (array) or a key from an object {key: p}
        draw(p) {
            let r = this.next();
            if (Array.isArray(p)) { for (let k = 0; k < p.length; k++) { r -= p[k]; if (r < 0) return k; } return p.length - 1; }
            const keys = Object.keys(p);
            for (const k of keys) { r -= p[k]; if (r < 0) return k; }
            return keys[keys.length - 1];
        }
    }

    // ------------------------------------------------------------ backgrounds
    const AA = 'ARNDCQEGHILKMFPSTWYV';
    const AA_BG = { A: 0.0780, R: 0.0512, N: 0.0449, D: 0.0536, C: 0.0192, Q: 0.0426, E: 0.0629, G: 0.0738, H: 0.0219, I: 0.0514,
                    L: 0.0902, K: 0.0574, M: 0.0224, F: 0.0386, P: 0.0520, S: 0.0712, T: 0.0584, W: 0.0133, Y: 0.0321, V: 0.0644 };
    const aaSum = Object.values(AA_BG).reduce((a, b) => a + b, 0);
    for (const a of AA) AA_BG[a] /= aaSum;
    const DNA_BG = { A: 0.25, C: 0.25, G: 0.25, T: 0.25 };
    const alphabetFor = type => type === 'PROTEIN' ? AA : 'ACGT';
    const backgroundFor = type => type === 'PROTEIN' ? AA_BG : DNA_BG;

    // log10 formatting helper for probabilities that would underflow
    function sci(logp, digits = 2) {
        if (logp === NEG) return '0';
        const l10 = logp / LN10, e = Math.floor(l10), m = Math.pow(10, l10 - e);
        if (e >= -3 && e <= 0) return Math.exp(logp).toPrecision(digits);
        return `${m.toFixed(digits - 1)}×10<sup>${e}</sup>`;
    }

    // =====================================================================
    // 1. GENERAL DISCRETE HMM
    // =====================================================================
    // model = { alphabet: 'ACGT', states: [{ key, name, color, emit: {A:..} }], start: [p...], trans: [[p...]] }
    function normalizeModel(model) {
        const norm = v => { const s = v.reduce((a, b) => a + b, 0); return v.map(x => s > 0 ? x / s : 1 / v.length); };
        model.start = norm(model.start);
        model.trans = model.trans.map(norm);
        for (const st of model.states) {
            const keys = model.alphabet.split(''), v = norm(keys.map(a => st.emit[a] || 0));
            keys.forEach((a, k) => { st.emit[a] = v[k]; });
        }
        return model;
    }

    function sample(model, L, rng) {
        let seq = '', path = [];
        let s = rng.draw(model.start);
        for (let i = 0; i < L; i++) {
            if (i > 0) s = rng.draw(model.trans[s]);
            path.push(s);
            seq += rng.draw(model.states[s].emit);
        }
        return { seq, path };
    }

    // probability of the sequence together with one given path, factor by factor
    function joint(model, seq, path) {
        const terms = [];
        let logp = 0;
        for (let i = 0; i < seq.length; i++) {
            const s = path[i];
            const t = i === 0 ? model.start[s] : model.trans[path[i - 1]][s];
            terms.push({ kind: i === 0 ? 'start' : 'trans', i, from: i === 0 ? null : path[i - 1], to: s, p: t });
            const e = model.states[s].emit[seq[i]] || 0;
            terms.push({ kind: 'emit', i, state: s, symbol: seq[i], p: e });
            logp += ln(t) + ln(e);
        }
        return { terms, logp };
    }

    // Viterbi: V[k][i] = log probability of the best path ending in state k at position i
    function viterbi(model, seq) {
        const K = model.states.length, L = seq.length;
        const V = Array.from({ length: K }, () => new Array(L).fill(NEG));
        const P = Array.from({ length: K }, () => new Array(L).fill(-1));
        for (let i = 0; i < L; i++) {
            for (let k = 0; k < K; k++) {
                const e = ln(model.states[k].emit[seq[i]] || 0);
                if (i === 0) { V[k][0] = ln(model.start[k]) + e; continue; }
                const cand = model.trans.map((row, j) => V[j][i - 1] + ln(row[k]));
                const b = argmax(cand);
                V[k][i] = cand[b] + e; P[k][i] = b;
            }
        }
        if (!L) return { V, P, path: [], logp: 0 };
        const path = new Array(L);
        path[L - 1] = argmax(V.map(r => r[L - 1]));
        for (let i = L - 1; i > 0; i--) path[i - 1] = P[path[i]][i];
        return { V, P, path, logp: V[path[L - 1]][L - 1] };
    }

    // candidates of one Viterbi / Forward cell, for the step-by-step explanation
    function cellCandidates(model, seq, V, k, i) {
        const e = ln(model.states[k].emit[seq[i]] || 0);
        if (i === 0) return { emit: e, cands: [{ from: null, prev: 0, trans: ln(model.start[k]), total: ln(model.start[k]) }] };
        return { emit: e, cands: model.trans.map((row, j) => ({ from: j, prev: V[j][i - 1], trans: ln(row[k]), total: V[j][i - 1] + ln(row[k]) })) };
    }

    function forward(model, seq) {
        const K = model.states.length, L = seq.length;
        const F = Array.from({ length: K }, () => new Array(L).fill(NEG));
        for (let i = 0; i < L; i++) for (let k = 0; k < K; k++) {
            const e = ln(model.states[k].emit[seq[i]] || 0);
            if (i === 0) { F[k][0] = ln(model.start[k]) + e; continue; }
            let s = NEG;
            for (let j = 0; j < K; j++) s = logsum(s, F[j][i - 1] + ln(model.trans[j][k]));
            F[k][i] = s + e;
        }
        let logp = L ? NEG : 0;
        if (L) for (let k = 0; k < K; k++) logp = logsum(logp, F[k][L - 1]);
        return { F, logp };
    }

    function backward(model, seq) {
        const K = model.states.length, L = seq.length;
        const B = Array.from({ length: K }, () => new Array(L).fill(NEG));
        for (let k = 0; k < K; k++) if (L) B[k][L - 1] = 0;
        for (let i = L - 2; i >= 0; i--) for (let k = 0; k < K; k++) {
            let s = NEG;
            for (let j = 0; j < K; j++) s = logsum(s, ln(model.trans[k][j]) + ln(model.states[j].emit[seq[i + 1]] || 0) + B[j][i + 1]);
            B[k][i] = s;
        }
        let logp = L ? NEG : 0;
        if (L) for (let k = 0; k < K; k++) logp = logsum(logp, ln(model.start[k]) + ln(model.states[k].emit[seq[0]] || 0) + B[k][0]);
        return { B, logp };
    }

    // posterior P(state k at position i | whole sequence)
    function posterior(model, seq) {
        const f = forward(model, seq), b = backward(model, seq);
        const K = model.states.length, L = seq.length;
        const post = Array.from({ length: K }, (_, k) => Array.from({ length: L }, (_, i) => Math.exp(f.F[k][i] + b.B[k][i] - f.logp)));
        const decoded = Array.from({ length: L }, (_, i) => argmax(post.map(r => r[i])));
        return { post, decoded, logp: f.logp, F: f.F, B: b.B };
    }

    // maximum-likelihood estimate from labelled sequences (paths known), with pseudocount r added to every count
    function estimate(model, data, r = 0) {
        const K = model.states.length, A = model.alphabet.split('');
        const startC = new Array(K).fill(0), transC = Array.from({ length: K }, () => new Array(K).fill(0));
        const emitC = Array.from({ length: K }, () => Object.fromEntries(A.map(a => [a, 0])));
        for (const { seq, path } of data) {
            if (!seq.length) continue;
            startC[path[0]]++;
            for (let i = 0; i < seq.length; i++) {
                if (i > 0) transC[path[i - 1]][path[i]]++;
                if (emitC[path[i]][seq[i]] !== undefined) emitC[path[i]][seq[i]]++;
            }
        }
        const norm = v => { const s = v.reduce((a, b) => a + b + r, 0); return v.map(x => s > 0 ? (x + r) / s : 1 / v.length); };
        const est = {
            alphabet: model.alphabet,
            states: model.states.map((st, k) => { const v = norm(A.map(a => emitC[k][a])); return Object.assign({}, st, { emit: Object.fromEntries(A.map((a, x) => [a, v[x]])) }); }),
            start: norm(startC), trans: transC.map(norm)
        };
        return { model: est, counts: { start: startC, trans: transC, emit: emitC } };
    }

    // Baum–Welch (EM): paths unknown, so counts are replaced by their expectations under the current model
    function baumWelch(init, seqs, iterations = 20, r = 0.01) {
        let model = JSON.parse(JSON.stringify(init));
        const K = model.states.length, A = model.alphabet.split('');
        const history = [];
        for (let it = 0; it <= iterations; it++) {
            const startC = new Array(K).fill(0), transC = Array.from({ length: K }, () => new Array(K).fill(0));
            const emitC = Array.from({ length: K }, () => Object.fromEntries(A.map(a => [a, 0])));
            let loglik = 0;
            for (const seq of seqs) {
                if (!seq.length) continue;
                const f = forward(model, seq), b = backward(model, seq);
                loglik += f.logp;
                for (let i = 0; i < seq.length; i++) for (let k = 0; k < K; k++) {
                    const g = Math.exp(f.F[k][i] + b.B[k][i] - f.logp);
                    if (i === 0) startC[k] += g;
                    if (emitC[k][seq[i]] !== undefined) emitC[k][seq[i]] += g;
                    if (i < seq.length - 1) for (let l = 0; l < K; l++)
                        transC[k][l] += Math.exp(f.F[k][i] + ln(model.trans[k][l]) + ln(model.states[l].emit[seq[i + 1]] || 0) + b.B[l][i + 1] - f.logp);
                }
            }
            history.push({ model, loglik });
            if (it === iterations) break;
            const norm = v => { const s = v.reduce((x, y) => x + y + r, 0); return v.map(x => (x + r) / s); };
            model = {
                alphabet: model.alphabet,
                states: model.states.map((st, k) => { const v = norm(A.map(a => emitC[k][a])); return Object.assign({}, st, { emit: Object.fromEntries(A.map((a, x) => [a, v[x]])) }); }),
                start: norm(startC), trans: transC.map(norm)
            };
        }
        return history;
    }

    // =====================================================================
    // 2. PAIR HMM
    // =====================================================================
    // params: { type: 'DNA'|'PROTEIN', delta, epsilon, tau, eta, pid (DNA: probability that an aligned pair is identical) }
    function pairModel(params) {
        const type = params.type || 'DNA';
        const alphabet = alphabetFor(type), q = Object.assign({}, backgroundFor(type)), p = {};
        if (type === 'PROTEIN') {
            // BLOSUM62 is in half-bits: s = 2·log2(p_ab / q_a q_b), so p_ab ∝ q_a q_b 2^(s/2)
            let tot = 0;
            for (const a of AA) { p[a] = {}; for (const b of AA) { p[a][b] = q[a] * q[b] * Math.pow(2, AlignEngine.BLOSUM62[a][b] / 2); tot += p[a][b]; } }
            for (const a of AA) for (const b of AA) p[a][b] /= tot;
        } else {
            const pid = params.pid === undefined ? 0.8 : params.pid;
            for (const a of alphabet) { p[a] = {}; for (const b of alphabet) p[a][b] = a === b ? pid / 4 : (1 - pid) / 12; }
        }
        const delta = params.delta, epsilon = params.epsilon, tau = params.tau, eta = params.eta === undefined ? tau : params.eta;
        const t = { MM: 1 - 2 * delta - tau, MX: delta, MY: delta, XX: epsilon, XM: 1 - epsilon - tau, END: tau };
        return { type, alphabet, p, q, delta, epsilon, tau, eta, t };
    }

    const emitM = (M, a, b) => ln((M.p[a] && M.p[a][b]) || 0);
    const emitG = (M, a) => ln(M.q[a] || 0);

    // column types of a pairwise alignment: M (pair), X (x residue vs gap), Y (gap vs y residue)
    function alignmentStates(a1, a2) {
        const s = [];
        for (let k = 0; k < a1.length; k++) {
            const c1 = a1[k], c2 = a2[k];
            if (c1 === '-' && c2 === '-') continue;
            s.push(c1 === '-' ? 'Y' : c2 === '-' ? 'X' : 'M');
        }
        return s;
    }

    // joint probability of the sequences and one alignment (path), factor by factor; and its log-odds against the random model
    function pairPath(M, a1, a2) {
        const terms = [];
        let logp = 0, prev = 'M';          // Begin behaves like M
        const trans = (from, to) => from === 'M' ? (to === 'M' ? M.t.MM : M.t.MX) : (to === 'M' ? M.t.XM : to === from ? M.t.XX : 0);
        let k = 0;
        const cols = [];
        for (let c = 0; c < a1.length; c++) {
            const x = a1[c], y = a2[c];
            if (x === '-' && y === '-') continue;
            const st = x === '-' ? 'Y' : y === '-' ? 'X' : 'M';
            const t = trans(prev, st);
            const e = st === 'M' ? Math.exp(emitM(M, x, y)) : Math.exp(emitG(M, st === 'X' ? x : y));
            terms.push({ kind: 'trans', from: prev, to: st, p: t });
            terms.push({ kind: 'emit', state: st, x: st === 'Y' ? '-' : x, y: st === 'X' ? '-' : y, p: e });
            logp += ln(t) + ln(e);
            cols.push({ col: k++, state: st, x, y, trans: t, emit: e });
            prev = st;
        }
        terms.push({ kind: 'trans', from: prev, to: 'End', p: M.tau });
        logp += ln(M.tau);
        return { terms, cols, logp };
    }

    function randomModelLog(M, x, y) {
        let l = 2 * ln(M.eta) + (x.length + y.length) * ln(1 - M.eta);
        for (const a of x) l += emitG(M, a);
        for (const b of y) l += emitG(M, b);
        return l;
    }

    // DP over the three pair-HMM states; op = max (Viterbi) or logsum (Forward)
    function pairDP(M, x, y, viterbiMode) {
        const n = x.length, m = y.length;
        const mk = () => Array.from({ length: n + 1 }, () => new Array(m + 1).fill(NEG));
        const VM = mk(), VX = mk(), VY = mk();
        const tM = mk(), tX = mk(), tY = mk();       // Viterbi pointers: 0 = M, 1 = X, 2 = Y
        const lMM = ln(M.t.MM), lMX = ln(M.t.MX), lXX = ln(M.t.XX), lXM = ln(M.t.XM);
        VM[0][0] = 0;                               // Begin
        const pick = (arr) => { if (viterbiMode) { const b = argmax(arr); return [arr[b], b]; } let s = NEG; for (const v of arr) s = logsum(s, v); return [s, -1]; };
        for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
            if (i > 0 && j > 0) {
                const [v, b] = pick([VM[i - 1][j - 1] + lMM, VX[i - 1][j - 1] + lXM, VY[i - 1][j - 1] + lXM]);
                VM[i][j] = v + emitM(M, x[i - 1], y[j - 1]); tM[i][j] = b;
            }
            if (i > 0) {
                const [v, b] = pick([VM[i - 1][j] + lMX, VX[i - 1][j] + lXX]);
                VX[i][j] = v + emitG(M, x[i - 1]); tX[i][j] = b;
            }
            if (j > 0) {
                const [v, b] = pick([VM[i][j - 1] + lMX, NEG, VY[i][j - 1] + lXX]);
                VY[i][j] = v + emitG(M, y[j - 1]); tY[i][j] = b;
            }
        }
        const lt = ln(M.tau);
        const ends = [VM[n][m] + lt, VX[n][m] + lt, VY[n][m] + lt];
        return { VM, VX, VY, tM, tX, tY, ends, n, m };
    }

    function pairViterbi(M, x, y) {
        const d = pairDP(M, x, y, true);
        let state = argmax(d.ends), i = d.n, j = d.m;
        const logp = d.ends[state];
        let a1 = '', a2 = '';
        const path = [{ i, j, state: 'MXY'[state] }];
        while (i > 0 || j > 0) {
            const ptr = state === 0 ? d.tM[i][j] : state === 1 ? d.tX[i][j] : d.tY[i][j];
            if (state === 0) { a1 = x[i - 1] + a1; a2 = y[j - 1] + a2; i--; j--; }
            else if (state === 1) { a1 = x[i - 1] + a1; a2 = '-' + a2; i--; }
            else { a1 = '-' + a1; a2 = y[j - 1] + a2; j--; }
            state = ptr;
            path.unshift({ i, j, state: (i === 0 && j === 0) ? 'B' : 'MXY'[state] });
        }
        return Object.assign(d, { logp, aligned1: a1, aligned2: a2, path, logOdds: logp - randomModelLog(M, x, y) });
    }

    function pairForward(M, x, y) {
        const d = pairDP(M, x, y, false);
        let logp = NEG;
        for (const e of d.ends) logp = logsum(logp, e);
        return { FM: d.VM, FX: d.VX, FY: d.VY, logp, logOdds: logp - randomModelLog(M, x, y) };
    }

    function pairBackward(M, x, y) {
        const n = x.length, m = y.length;
        const mk = () => Array.from({ length: n + 1 }, () => new Array(m + 1).fill(NEG));
        const BM = mk(), BX = mk(), BY = mk();
        const lMM = ln(M.t.MM), lMX = ln(M.t.MX), lXX = ln(M.t.XX), lXM = ln(M.t.XM), lt = ln(M.tau);
        for (let i = n; i >= 0; i--) for (let j = m; j >= 0; j--) {
            if (i === n && j === m) { BM[i][j] = BX[i][j] = BY[i][j] = lt; continue; }
            const toM = (i < n && j < m) ? emitM(M, x[i], y[j]) + BM[i + 1][j + 1] : NEG;
            const toX = i < n ? emitG(M, x[i]) + BX[i + 1][j] : NEG;
            const toY = j < m ? emitG(M, y[j]) + BY[i][j + 1] : NEG;
            BM[i][j] = logsum(logsum(lMM + toM, lMX + toX), lMX + toY);
            BX[i][j] = logsum(lXM + toM, lXX + toX);
            BY[i][j] = logsum(lXM + toM, lXX + toY);
        }
        return { BM, BX, BY, logp: BM[0][0] };
    }

    // posterior probabilities: P(x_i aligned to y_j), P(x_i aligned to a gap), P(y_j aligned to a gap)
    function pairPosterior(M, x, y) {
        const f = pairForward(M, x, y), b = pairBackward(M, x, y);
        const n = x.length, m = y.length;
        const PM = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
        const gapX = new Array(n + 1).fill(0), gapY = new Array(m + 1).fill(0);
        for (let i = 1; i <= n; i++) for (let j = 0; j <= m; j++) {
            if (j > 0) PM[i][j] = Math.exp(f.FM[i][j] + b.BM[i][j] - f.logp);
            gapX[i] += Math.exp(f.FX[i][j] + b.BX[i][j] - f.logp);
        }
        for (let j = 1; j <= m; j++) for (let i = 0; i <= n; i++) gapY[j] += Math.exp(f.FY[i][j] + b.BY[i][j] - f.logp);
        return { PM, gapX, gapY, logp: f.logp, logOdds: f.logOdds, forward: f, backward: b };
    }

    // posterior probability of every column of a given alignment
    function alignmentConfidence(post, a1, a2) {
        const out = [];
        let i = 0, j = 0;
        for (let c = 0; c < a1.length; c++) {
            const x = a1[c], y = a2[c];
            if (x !== '-') i++;
            if (y !== '-') j++;
            if (x === '-' && y === '-') continue;
            out.push(x !== '-' && y !== '-' ? post.PM[i][j] : x !== '-' ? post.gapX[i] : post.gapY[j]);
        }
        return out;
    }

    // log-odds scores (bits) under which Viterbi = affine-gap global alignment (Durbin et al. eq. 4.7–4.9)
    function logOddsScores(M) {
        const s = {};
        const base = Math.log2(M.t.MM / Math.pow(1 - M.eta, 2));
        for (const a of M.alphabet) { s[a] = {}; for (const b of M.alphabet) s[a][b] = Math.log2(M.p[a][b] / (M.q[a] * M.q[b])) + base; }
        const d = -Math.log2(M.delta * M.t.XM / ((1 - M.eta) * M.t.MM));
        const e = -Math.log2(M.epsilon / (1 - M.eta));
        const c = Math.log2(M.tau / (M.eta * M.eta));
        return { s, d, e, c, base };
    }

    // AlignEngine parameters equivalent to the log-odds scores
    function gotohParams(M) {
        const lo = logOddsScores(M);
        return { type: M.type, gapModel: 'affine', gap: -lo.d, gapOpen: -lo.d, gapExtend: -lo.e, endGaps: 'penalized', substitution: { kind: 'custom', table: lo.s } };
    }

    // number of distinct alignments of lengths n and m (no X next to Y, as in the pair HMM and Gotoh)
    function countAlignments(n, m) {
        const mk = () => Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
        const CM = mk(), CX = mk(), CY = mk();
        CM[0][0] = 1;
        for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
            if (i > 0 && j > 0) CM[i][j] = CM[i - 1][j - 1] + CX[i - 1][j - 1] + CY[i - 1][j - 1];
            if (i > 0) CX[i][j] = CM[i - 1][j] + CX[i - 1][j];
            if (j > 0) CY[i][j] = CM[i][j - 1] + CY[i][j - 1];
        }
        return CM[n][m] + CX[n][m] + CY[n][m];
    }

    // the pair HMM as a generator of aligned pairs
    function samplePair(M, rng, maxLen = 60) {
        let a1 = '', a2 = '', st = 'M', states = '';
        for (let guard = 0; guard < 400; guard++) {
            const r = rng.next();
            let next;
            if (st === 'M') next = r < M.t.MM ? 'M' : r < M.t.MM + M.delta ? 'X' : r < M.t.MM + 2 * M.delta ? 'Y' : 'E';
            else next = r < M.t.XX ? st : r < M.t.XX + M.t.XM ? 'M' : 'E';
            if (next === 'E' || a1.length >= maxLen) break;
            if (next === 'M') {
                let u = rng.next(), pair = null;
                outer: for (const a of M.alphabet) for (const b of M.alphabet) { u -= M.p[a][b]; if (u < 0) { pair = [a, b]; break outer; } }
                if (!pair) pair = [M.alphabet[0], M.alphabet[0]];
                a1 += pair[0]; a2 += pair[1];
            } else if (next === 'X') { a1 += rng.draw(M.q); a2 += '-'; }
            else { a1 += '-'; a2 += rng.draw(M.q); }
            states += next; st = next;
        }
        return { aligned1: a1, aligned2: a2, states, x: a1.replace(/-/g, ''), y: a2.replace(/-/g, '') };
    }

    // =====================================================================
    // 3. PROFILE HMM (Plan7)
    // =====================================================================
    // Nodes k = 1..m each have M_k (emits, match), D_k (silent, deletion); I_k (emits, insertion) for k = 1..m-1.
    // Node 0 is the Begin state B with transitions B→M1 (stored as t[0].MM) and B→D1 (t[0].MD).
    // M_m and D_m go to the End state E with probability 1.
    const TRANS = ['MM', 'MI', 'MD', 'IM', 'II', 'DM', 'DD'];
    function allowedTrans(k, m) {
        if (k === 0) return { M: ['MM', 'MD'], I: [], D: [] };
        if (k === m) return { M: [], I: [], D: [] };
        return { M: ['MM', 'MI', 'MD'], I: ['IM', 'II'], D: ['DM', 'DD'] };
    }

    // which alignment columns become match states: residues in at least `minOccupancy` of the sequences
    function matchColumns(rows, minOccupancy = 0.5) {
        const L = rows[0] ? rows[0].length : 0;
        const out = [];
        for (let c = 0; c < L; c++) {
            let res = 0;
            for (const r of rows) if (r[c] !== '-' && r[c] !== '.') res++;
            out.push(rows.length ? res / rows.length >= minOccupancy : false);
        }
        return out;
    }

    // path of one aligned sequence through the model (before and after "trace doctoring")
    function traceRow(row, isMatch) {
        const raw = [];
        let node = 0, pos = 0;
        for (let c = 0; c < row.length; c++) {
            const ch = row[c], res = ch !== '-' && ch !== '.';
            if (isMatch[c]) { node++; raw.push({ s: res ? 'M' : 'D', k: node, col: c, res: res ? ch.toUpperCase() : null, pos: res ? pos : null }); }
            else if (res) raw.push({ s: 'I', k: node, col: c, res: ch.toUpperCase(), pos });
            if (res) pos++;
        }
        const m = node;
        // residues before the first / after the last match column are flanking sequence (N and C states), not inserts
        let first = raw.findIndex(t => t.s !== 'I'), last = raw.length - 1;
        while (last >= 0 && raw[last].s === 'I') last--;
        const flankN = first < 0 ? raw.length : first, flankC = first < 0 ? 0 : raw.length - 1 - last;
        let core = first < 0 ? [] : raw.slice(first, last + 1).map(t => Object.assign({}, t));
        // insert states exist only for k = 1..m-1 and cannot follow or precede a deletion (Plan7): fix as HMMER's trace doctor does
        let doctored = 0;
        for (let x = 0; x < core.length; x++) {
            const t = core[x];
            if (t.s === 'D' && core[x + 1] && core[x + 1].s === 'I') {      // D_k → I_k: the first inserted residue becomes M_k
                const ins = core[x + 1];
                Object.assign(t, { s: 'M', res: ins.res, pos: ins.pos, col: ins.col, moved: true });
                core.splice(x + 1, 1); doctored++; x--;
            } else if (t.s === 'I' && core[x + 1] && core[x + 1].s === 'D') {   // I_k → D_k+1: the last inserted residue becomes M_k+1
                const del = core[x + 1];
                Object.assign(del, { s: 'M', res: t.res, pos: t.pos, col: t.col, moved: true });
                core.splice(x, 1); doctored++; x = Math.max(-1, x - 2);
            }
        }
        return { trace: core, flankN, flankC, doctored, m };
    }

    /**
     * rows: aligned sequences (strings with '-'); type 'DNA'|'PROTEIN'.
     * opts: { minOccupancy, isMatch (override array), emitPseudo (total pseudocount weight A, spread by background),
     *         transPseudo (added to each allowed transition count) }
     */
    function buildProfile(rows, type, opts = {}) {
        const o = Object.assign({ minOccupancy: 0.5, isMatch: null, emitPseudo: 1, transPseudo: 1 }, opts);
        rows = rows.map(r => r.toUpperCase());
        const alphabet = alphabetFor(type), bg = backgroundFor(type);
        const isMatch = o.isMatch ? o.isMatch.slice() : matchColumns(rows, o.minOccupancy);
        const m = isMatch.filter(Boolean).length;
        const matchColIndex = [];               // node k → alignment column
        isMatch.forEach((v, c) => { if (v) matchColIndex.push(c); });
        const emitC = Array.from({ length: m + 1 }, () => Object.fromEntries(alphabet.split('').map(a => [a, 0])));
        const insC = Array.from({ length: m + 1 }, () => Object.fromEntries(alphabet.split('').map(a => [a, 0])));
        const transC = Array.from({ length: m + 1 }, () => Object.fromEntries(TRANS.map(t => [t, 0])));
        const traces = rows.map(r => traceRow(r, isMatch));
        for (const tr of traces) {
            let prev = { s: 'M', k: 0 };      // Begin
            for (const t of tr.trace) {
                if (t.s === 'M' && t.res && emitC[t.k][t.res] !== undefined) emitC[t.k][t.res]++;
                if (t.s === 'I' && t.res && insC[t.k][t.res] !== undefined) insC[t.k][t.res]++;
                transC[prev.k][prev.s + t.s]++;
                prev = t;
            }
        }
        const eM = [null], eI = [null];
        for (let k = 1; k <= m; k++) {
            const N = alphabet.split('').reduce((s, a) => s + emitC[k][a], 0);
            const row = {};
            for (const a of alphabet) row[a] = (N + o.emitPseudo) > 0 ? (emitC[k][a] + o.emitPseudo * bg[a]) / (N + o.emitPseudo) : bg[a];
            eM.push(row);
            eI.push(Object.assign({}, bg));        // insert states emit the background distribution (as in HMMER)
        }
        const t = [];
        for (let k = 0; k <= m; k++) {
            const al = allowedTrans(k, m), row = Object.fromEntries(TRANS.map(x => [x, 0]));
            for (const grp of ['M', 'I', 'D']) {
                const list = al[grp];
                const tot = list.reduce((s, x) => s + transC[k][x] + o.transPseudo, 0);
                for (const x of list) row[x] = tot > 0 ? (transC[k][x] + o.transPseudo) / tot : 1 / list.length;
            }
            t.push(row);
        }
        const info = [0];
        const consensus = [''];
        for (let k = 1; k <= m; k++) {
            info.push(alphabet.split('').reduce((s, a) => s + (eM[k][a] > 0 ? eM[k][a] * Math.log2(eM[k][a] / bg[a]) : 0), 0));
            consensus.push(alphabet.split('').reduce((b, a) => eM[k][a] > eM[k][b] ? a : b, alphabet[0]));
        }
        return { type, alphabet, bg, m, isMatch, matchColIndex, rows, traces, counts: { emit: emitC, ins: insC, trans: transC },
                 eM, eI, t, info, consensus, opts: o };
    }

    // bits for DP: match emissions as log-odds, transitions as log2 probabilities
    function scorer(P, L, mode = 'glocal') {
        const msc = [null];
        for (let k = 1; k <= P.m; k++) { const r = {}; for (const a of P.alphabet) r[a] = Math.log2(P.eM[k][a] / P.bg[a]); msc.push(r); }
        const tsc = P.t.map(row => Object.fromEntries(TRANS.map(x => [x, lg2(row[x])])));
        // flanking N/C states with the null model's expected length L: loops cost (almost) nothing, entering the core costs log2(2/(L+2))
        const loop = lg2(L / (L + 2)), move = lg2(2 / (L + 2));
        const nullLoop = lg2(L / (L + 1)), nullEnd = lg2(1 / (L + 1));
        const entry = mode === 'local' ? lg2(1 / P.m) : null;
        return { msc, tsc, loop, move, nullLoop, nullEnd, entry, mode, L };
    }

    /**
     * Viterbi or Forward of a sequence against a profile, in bits relative to the null model.
     * Returns the DP matrices (rows i = 0..L, nodes k = 0..m) for display, and for Viterbi the trace and alignment.
     */
    function profileDP(P, seq, opts = {}) {
        const o = Object.assign({ mode: 'glocal', forward: false }, opts);
        seq = seq.toUpperCase();
        const L = seq.length, m = P.m;
        const S = scorer(P, Math.max(L, 1), o.mode);
        const op = o.forward ? logsum2 : Math.max;
        const mk = () => Array.from({ length: L + 1 }, () => new Array(m + 1).fill(NEG));
        const VM = mk(), VI = mk(), VD = mk();
        const N = new Array(L + 1).fill(NEG), B = new Array(L + 1).fill(NEG), E = new Array(L + 1).fill(NEG), C = new Array(L + 1).fill(NEG);
        const ms = (k, a) => (S.msc[k][a] !== undefined ? S.msc[k][a] : 0);
        N[0] = 0;
        for (let i = 0; i <= L; i++) {
            if (i > 0) N[i] = N[i - 1] + S.loop;
            B[i] = N[i] + S.move;
            for (let k = 1; k <= m; k++) {
                if (i > 0) {
                    const a = seq[i - 1];
                    const fromB = o.mode === 'local' ? B[i - 1] + S.entry : (k === 1 ? B[i - 1] + S.tsc[0].MM : NEG);
                    const prevM = k > 1 ? VM[i - 1][k - 1] + S.tsc[k - 1].MM : NEG;
                    const prevI = k > 1 ? VI[i - 1][k - 1] + S.tsc[k - 1].IM : NEG;
                    const prevD = k > 1 ? VD[i - 1][k - 1] + S.tsc[k - 1].DM : NEG;
                    VM[i][k] = op(op(fromB, prevM), op(prevI, prevD)) + ms(k, a);
                    if (k < m) VI[i][k] = op(VM[i - 1][k] + S.tsc[k].MI, VI[i - 1][k] + S.tsc[k].II);      // insert emission = background: 0 bits
                }
                const dB = k === 1 && o.mode !== 'local' ? B[i] + S.tsc[0].MD : NEG;
                const dM = k > 1 ? VM[i][k - 1] + S.tsc[k - 1].MD : NEG;
                const dD = k > 1 ? VD[i][k - 1] + S.tsc[k - 1].DD : NEG;
                VD[i][k] = op(op(dB, dM), dD);
            }
            if (o.mode === 'local') { let e = NEG; for (let k = 1; k <= m; k++) e = op(e, VM[i][k]); E[i] = op(e, VD[i][m]); }
            else E[i] = op(VM[i][m], VD[i][m]);
            C[i] = op(i > 0 ? C[i - 1] + S.loop : NEG, E[i] + S.move);
        }
        const total = C[L] + S.move;                                       // C → T
        const nullScore = L * S.nullLoop + S.nullEnd;
        const score = total - nullScore;
        const res = { VM, VI, VD, N, B, E, C, score, L, m, mode: o.mode, forward: o.forward, S, seq };
        if (!o.forward) Object.assign(res, profileTraceback(P, res));
        return res;
    }

    const near = (a, b) => Math.abs(a - b) < 1e-9 || (a === NEG && b === NEG);

    function profileTraceback(P, R) {
        const { VM, VI, VD, N, B, E, C, S, seq, m, mode } = R;
        let i = R.L, st = 'C', k = 0;
        const trace = [];
        let guard = 0;
        while (st !== 'S' && guard++ < 100000) {
            if (st === 'C') {
                if (i > 0 && near(C[i], C[i - 1] + S.loop)) { trace.unshift({ s: 'C', i }); i--; }
                else st = 'E';
            } else if (st === 'E') {
                if (near(E[i], VD[i][m])) { st = 'D'; k = m; }
                else if (mode !== 'local' || near(E[i], VM[i][m])) { st = 'M'; k = m; }
                else { st = 'M'; for (let kk = 1; kk <= m; kk++) if (near(E[i], VM[i][kk])) { k = kk; break; } }
            } else if (st === 'M') {
                trace.unshift({ s: 'M', k, i });
                const sc = S.msc[k][seq[i - 1]] !== undefined ? S.msc[k][seq[i - 1]] : 0;
                const v = VM[i][k] - sc;
                i--;
                if (k > 1 && near(v, VM[i][k - 1] + S.tsc[k - 1].MM)) { k--; st = 'M'; }
                else if (k > 1 && near(v, VI[i][k - 1] + S.tsc[k - 1].IM)) { k--; st = 'I'; }
                else if (k > 1 && near(v, VD[i][k - 1] + S.tsc[k - 1].DM)) { k--; st = 'D'; }
                else st = 'B';
            } else if (st === 'I') {
                trace.unshift({ s: 'I', k, i });
                const v = VI[i][k];
                i--;
                st = near(v, VM[i][k] + S.tsc[k].MI) ? 'M' : 'I';
            } else if (st === 'D') {
                trace.unshift({ s: 'D', k, i });
                const v = VD[i][k];
                if (k > 1 && near(v, VM[i][k - 1] + S.tsc[k - 1].MD)) { k--; st = 'M'; }
                else if (k > 1 && near(v, VD[i][k - 1] + S.tsc[k - 1].DD)) { k--; st = 'D'; }
                else st = 'B';
            } else if (st === 'B') {
                st = 'N';
            } else if (st === 'N') {
                if (i > 0) { trace.unshift({ s: 'N', i }); i--; } else st = 'S';
            }
        }
        return { trace, alignment: hmmerAlignment(P, trace, seq) };
    }

    // HMMER-style alignment of the core of a trace: model consensus line, match line and target line
    function hmmerAlignment(P, trace, seq) {
        const core = trace.filter(t => t.s === 'M' || t.s === 'I' || t.s === 'D');
        let model = '', match = '', target = '', states = '';
        const cols = [];
        for (const t of core) {
            if (t.s === 'M') {
                const a = seq[t.i - 1], cons = P.consensus[t.k];
                const sc = Math.log2(P.eM[t.k][a] / P.bg[a]);
                const strong = P.eM[t.k][cons] >= 0.5;
                model += strong ? cons : cons.toLowerCase(); target += a;
                match += a === cons ? (strong ? a : a.toLowerCase()) : sc > 0 ? '+' : ' ';
                cols.push({ s: 'M', k: t.k, i: t.i, res: a, score: sc });
            } else if (t.s === 'I') {
                model += '.'; target += seq[t.i - 1].toLowerCase(); match += ' ';
                cols.push({ s: 'I', k: t.k, i: t.i, res: seq[t.i - 1], score: 0 });
            } else {
                const cons = P.consensus[t.k];
                model += P.eM[t.k][cons] >= 0.5 ? cons : cons.toLowerCase(); target += '-'; match += ' ';
                cols.push({ s: 'D', k: t.k, i: null, score: 0 });
            }
            states += t.s;
        }
        const ms = core.filter(t => t.s === 'M');
        const withSeq = core.filter(t => t.s !== 'D');
        return {
            model, match, target, states, cols,
            hmmFrom: core.length ? core[0].k : 0, hmmTo: core.length ? core[core.length - 1].k : 0,
            seqFrom: withSeq.length ? withSeq[0].i : 0, seqTo: withSeq.length ? withSeq[withSeq.length - 1].i : 0,
            nMatch: ms.length, nInsert: core.filter(t => t.s === 'I').length, nDelete: core.filter(t => t.s === 'D').length
        };
    }

    function profileViterbi(P, seq, mode = 'glocal') { return profileDP(P, seq, { mode, forward: false }); }
    function profileForward(P, seq, mode = 'glocal') { return profileDP(P, seq, { mode, forward: true }); }

    // the profile HMM as a generator of family members
    function sampleProfile(P, rng, opts = {}) {
        const o = Object.assign({ maxInsert: 12 }, opts);
        let seq = '', k = 0, st = 'M';
        const trace = [];
        const drawT = (row, list) => { const tot = list.reduce((s, x) => s + row[x], 0); let r = rng.next() * tot; for (const x of list) { r -= row[x]; if (r < 0) return x; } return list[list.length - 1]; };
        let inserts = 0;
        for (let guard = 0; guard < 10000; guard++) {
            if (k === P.m && st !== 'I') break;
            const al = allowedTrans(k, P.m)[st];
            const tr = drawT(P.t[k], al);
            let next = tr[1];
            if (next === 'I' && inserts >= o.maxInsert) next = 'M';
            if (next === 'I') { inserts++; const a = rng.draw(P.eI[k]); seq += a; trace.push({ s: 'I', k, res: a }); st = 'I'; continue; }
            inserts = 0;
            k++;
            if (next === 'M') { const a = rng.draw(P.eM[k]); seq += a; trace.push({ s: 'M', k, res: a }); }
            else trace.push({ s: 'D', k });
            st = next;
        }
        return { seq, trace };
    }

    // HMMER-like E-values: Forward bit scores of random sequences have an exponential tail with λ = ln 2 (per bit);
    // τ (location) is estimated by simulation: P(S > x) = exp(−λ(x − τ)) = 2^−(x − τ)
    function calibrate(P, L, rng, n = 200, mode = 'glocal', tailp = 0.04) {
        const scores = [];
        for (let r = 0; r < n; r++) {
            let s = '';
            for (let i = 0; i < L; i++) s += rng.draw(P.bg);
            scores.push(profileForward(P, s, mode).score);
        }
        scores.sort((a, b) => a - b);
        const idx = Math.min(n - 1, Math.floor(n * (1 - tailp)));
        const tau = scores[idx] + Math.log2(tailp);
        return { scores, tau, lambda: LN2, L, n };
    }
    const evalue = (bits, tau, dbSize) => dbSize * Math.pow(2, -(bits - tau));

    // remote homolog of a family member: node k keeps a family residue (drawn from the match emissions) with
    // probability keep + (1 − keep)·c_k, where c_k is the node's conservation (relative entropy / maximum)
    // raised to `sharp`; otherwise the residue is random. Conserved positions survive, variable ones drift –
    // the situation in which a profile beats a single query sequence.
    function evolveMember(P, ancestorTrace, keep, rng, opts = {}) {
        const o = Object.assign({ indelRate: 0.02, sharp: 2 }, opts);
        const maxInfo = Math.max(...P.info.slice(1), 1e-9);
        let seq = '';
        for (const t of ancestorTrace) {
            if (t.s === 'I') { if (rng.chance(0.5 + keep / 2)) seq += rng.chance(keep) ? t.res : rng.draw(P.bg); continue; }
            const c = Math.pow(P.info[t.k] / maxInfo, o.sharp);
            if (rng.chance(o.indelRate * (1 - c))) {                 // indels mostly in variable regions
                if (rng.chance(0.5)) continue;
                const n = rng.int(1, 4); for (let x = 0; x < n; x++) seq += rng.draw(P.bg);
            }
            if (t.s === 'D' && !rng.chance(1 - keep)) continue;
            const fam = rng.chance(keep + (1 - keep) * c);
            seq += fam ? (t.s === 'M' && rng.chance(keep) ? t.res : rng.draw(P.eM[t.k])) : rng.draw(P.bg);
        }
        return seq;
    }

    // ------------------------------------------------------------ synthetic protein family with a known conservation pattern
    const AA_GROUPS = ['ILVM', 'FYW', 'KR', 'DE', 'ST', 'NQ', 'AG', 'C', 'P', 'H'];
    /**
     * A "true" family: every position has its own residue distribution – invariant (one residue),
     * conservative (a chemical group), or variable (mostly background with a weak preference);
     * a few loop positions accept insertions. Members are drawn position by position, so they share
     * the pattern but are only ~25–40 % identical to each other.
     */
    function makeFamily(rng, length = 60, opts = {}) {
        const o = Object.assign({ invariant: 0.22, conservative: 0.38, loops: 3 }, opts);
        const pos = [];
        for (let k = 0; k < length; k++) {
            const r = rng.next();
            const dist = Object.fromEntries(AA.split('').map(a => [a, 0]));
            let kind;
            if (r < o.invariant) { kind = 'invariant'; const a = rng.pick('CGWHPYFDKLRE'.split('')); for (const b of AA) dist[b] = b === a ? 0.9 : 0.1 * AA_BG[b]; }
            else if (r < o.invariant + o.conservative) { kind = 'conservative'; const g = rng.pick(AA_GROUPS.filter(x => x.length > 1)); for (const b of AA) dist[b] = (g.includes(b) ? 0.8 / g.length : 0) + 0.2 * AA_BG[b]; }
            else { kind = 'variable'; const g = rng.pick(AA_GROUPS); for (const b of AA) dist[b] = (g.includes(b) ? 0.25 / g.length : 0) + 0.75 * AA_BG[b]; }
            pos.push({ kind, dist, loop: false, del: kind === 'variable' ? 0.04 : 0 });
        }
        const variable = pos.map((p, k) => ({ p, k })).filter(x => x.p.kind === 'variable' && x.k > 2 && x.k < length - 3);
        for (const x of rng.shuffle(variable).slice(0, o.loops)) x.p.loop = true;
        return { length, pos };
    }

    // one member: `fidelity` = probability that a position follows the family distribution (else random residue)
    function familyMember(fam, rng, fidelity = 1) {
        let aligned = '', seq = '';
        const cols = [];          // per core position: residue or '-', then inserted residues
        for (const p of fam.pos) {
            let r;
            if (rng.chance(p.del)) r = '-';
            else r = rng.chance(fidelity) ? rng.draw(p.dist) : rng.draw(AA_BG);
            let ins = '';
            if (p.loop && rng.chance(0.6)) { const n = rng.int(1, 4); for (let x = 0; x < n; x++) ins += rng.draw(AA_BG); }
            cols.push({ r, ins });
            if (r !== '-') seq += r;
            seq += ins;
        }
        return { seq, cols };
    }

    // members → a gapped MSA (loop inserts padded with gaps)
    function familyAlignment(members) {
        const n = members[0].cols.length;
        const rows = members.map(() => '');
        for (let k = 0; k < n; k++) {
            const w = Math.max(...members.map(m => m.cols[k].ins.length));
            members.forEach((m, x) => { const c = m.cols[k]; rows[x] += c.r + c.ins + '-'.repeat(w - c.ins.length); });
        }
        return rows;
    }

    const randomSeq = (bg, len, rng) => { let s = ''; for (let i = 0; i < len; i++) s += rng.draw(bg); return s; };

    function identity(a, b, type) {
        const r = AlignEngine.globalAlign(a, b, AlignEngine.defaultParams(type === 'PROTEIN' ? 'PROTEIN' : 'DNA'));
        let same = 0, cols = 0;
        for (let k = 0; k < r.aligned1.length; k++) { if (r.aligned1[k] === '-' || r.aligned2[k] === '-') continue; cols++; if (r.aligned1[k] === r.aligned2[k]) same++; }
        return cols ? same / Math.max(cols, Math.min(a.length, b.length)) : 0;
    }

    return {
        NEG, LN2, LN10, Rng, logsum, logsum2, sci, AA, AA_BG, DNA_BG, alphabetFor, backgroundFor,
        // general HMM
        normalizeModel, sample, joint, viterbi, cellCandidates, forward, backward, posterior, estimate, baumWelch,
        // pair HMM
        pairModel, alignmentStates, pairPath, randomModelLog, pairViterbi, pairForward, pairBackward, pairPosterior,
        alignmentConfidence, logOddsScores, gotohParams, countAlignments, samplePair,
        // profile HMM
        TRANS, allowedTrans, matchColumns, traceRow, buildProfile, scorer, profileDP, profileViterbi, profileForward,
        hmmerAlignment, sampleProfile, calibrate, evalue, evolveMember, makeFamily, familyMember, familyAlignment, randomSeq, identity
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HmmEngine;
}
