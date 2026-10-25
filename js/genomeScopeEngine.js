/**
 * GENOMESCOPE ENGINE
 * ==================
 * Port of GenomeScope 2.0 (R package genomescope2 2.1.0, Ranallo-Benavidez, Jaron & Schatz 2020) for ploidy 1
 * and 2 with the default topology and transform_exp 1: a negative-binomial mixture fitted to n·h(n) by
 * Levenberg-Marquardt (lmdif.js, as minpack.lm's nlsLM), four rounds that trim more of the error peak, model
 * selection by score, error k-mers from the residuals, and the summary of summary.txt (min/max = estimate ± 2 SE).
 * The histogram is used row by row as in R (rows of the .histo file, not coverage values), including R's
 * row-index quirks, so the numbers match the R tool. No DOM; test: node test/genomescope/compare.js
 */
const GenomeScope = (() => {
    const NUM_ROUNDS = 4, START_SHIFT = 5, TYPICAL_ERROR = 15, MAX_ITERATIONS = 200, SCORE_CLOSE = 0.20;

    // log-gamma (Lanczos)
    const LG = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
        12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    function lgamma(x) {
        if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
        x -= 1;
        let a = 0.99999999999980993;
        const t = x + 7.5;
        for (let i = 0; i < 8; i++) a += LG[i] / (x + i + 1);
        return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
    }
    // R's dnbinom(x, size, mu) (nmath dnbinom_mu with Loader's saddle-point dbinom_raw): stable for huge size
    const SFERR_HALVES = [0.0, 0.1534264097200273452913848, 0.0810614667953272582196702, 0.0548141210519176538961390,
        0.0413406959554092940938221, 0.03316287351993628748511048, 0.02767792568499833914878929, 0.02374616365629749597132920,
        0.02079067210376509311152277, 0.01848845053267318523077934, 0.01664469118982119216319487, 0.01513497322191737887351255,
        0.01387612882307074799874573, 0.01281046524292022692424986, 0.01189670994589177009505572, 0.01110455975820691732662991,
        0.010411265261972096497478567, 0.009799416126158803298389475, 0.009255462182712732917728637, 0.008768700134139385462952823,
        0.008330563433362871256469318, 0.007934114564314020547248100, 0.007573675487951840794972024, 0.007244554301320383179543912,
        0.006942840107209529865664152, 0.006665247032707682442354394, 0.006408994188004207068439631, 0.006171712263039457647532867,
        0.005951370112758847735624416, 0.005746216513010115682023589, 0.005554733551962801371038690];
    const LN_SQRT_2PI = 0.918938533204672741780329736406;
    function stirlerr(n) {
        const S0 = 1 / 12, S1 = 1 / 360, S2 = 1 / 1260, S3 = 1 / 1680, S4 = 1 / 1188;
        if (n <= 15) {
            const nn = n + n;
            if (nn === Math.floor(nn)) return SFERR_HALVES[nn];
            return lgamma(n + 1) - (n + 0.5) * Math.log(n) + n - LN_SQRT_2PI;
        }
        const nn = n * n;
        if (n > 500) return (S0 - S1 / nn) / n;
        if (n > 80) return (S0 - (S1 - S2 / nn) / nn) / n;
        if (n > 35) return (S0 - (S1 - (S2 - S3 / nn) / nn) / nn) / n;
        return (S0 - (S1 - (S2 - (S3 - S4 / nn) / nn) / nn) / nn) / n;
    }
    function bd0(x, np) {
        if (Math.abs(x - np) < 0.1 * (x + np)) {
            let v = (x - np) / (x + np), s = (x - np) * v;
            if (Math.abs(s) < Number.MIN_VALUE) return s;
            let ej = 2 * x * v; v *= v;
            for (let j = 1; j < 1000; j++) {
                ej *= v;
                const s1 = s + ej / ((j << 1) + 1);
                if (s1 === s) return s1;
                s = s1;
            }
        }
        return x * Math.log(x / np) + np - x;
    }
    function dbinomRaw(x, n, p, q) {
        if (p === 0) return x === 0 ? 1 : 0;
        if (q === 0) return x === n ? 1 : 0;
        if (x === 0) {
            if (n === 0) return 1;
            return Math.exp(p < 0.1 ? -bd0(n, n * q) - n * p : n * Math.log1p(-p));
        }
        if (x === n) return Math.exp(q < 0.1 ? -bd0(n, n * p) - n * q : n * Math.log(p));
        if (x < 0 || x > n) return 0;
        const lc = stirlerr(n) - stirlerr(x) - stirlerr(n - x) - bd0(x, n * p) - bd0(n - x, n * q);
        const lf = Math.log(2 * Math.PI) + Math.log(x) + Math.log1p(-x / n);
        return Math.exp(lc - 0.5 * lf);
    }
    function dnbinom(x, size, mu) {
        if (!(mu >= 0) || !(size >= 0)) return NaN;
        if (x === 0 && size === 0) return 1;
        if (!isFinite(size)) return x === 0 ? Math.exp(-mu) : Math.exp(-stirlerr(x) - bd0(x, mu)) / Math.sqrt(2 * Math.PI * x);   // dpois_raw
        if (mu === 0) return x === 0 ? 1 : 0;
        if (x === 0) return Math.exp(size * (size < mu ? Math.log(size / (size + mu)) : Math.log1p(-mu / (size + mu))));
        if (x < 1e-10 * size) {
            const p = size < mu ? Math.log(size / (1 + size / mu)) : Math.log(mu / (1 + mu / size));
            return Math.exp(x * p - mu - lgamma(x + 1) + Math.log1p(x * (x - 1) / (2 * size)));
        }
        const ans = dbinomRaw(size, x + size, size / (size + mu), mu / (size + mu));
        return ans * size / (size + x);
    }

    // predictP_0(params, x); params: {d, kmercov, bias, r1?}
    function predict(p, k, q, x) {
        const { d, kmercov: c, bias } = q;
        if (d > 1) return 0;
        const nb = j => dnbinom(x, c * j / bias, c * j);
        if (p === 1) return (1 - d) * nb(1) + d * nb(2);
        const r0 = 1 - q.r1;
        if (r0 < 0) return 0;
        const s0 = Math.pow(r0, k), s1 = 1 - s0;
        return ((1 - d) * 2 * s1 + d * (2 * s0 * s1 + 2 * s1 * s1)) * nb(1) + ((1 - d) * s0 + d * s1 * s1) * nb(2) +
            d * 2 * s0 * s1 * nb(3) + d * s0 * s0 * nb(4);
    }
    function predictUnique(p, k, q, x) {
        const { d, kmercov: c, bias } = q;
        const nb = j => dnbinom(x, c * j / bias, c * j);
        if (p === 1) return (1 - d) * nb(1);
        const s0 = Math.pow(1 - q.r1, k), s1 = 1 - s0;
        return (1 - d) * 2 * s1 * nb(1) + (1 - d) * s0 * nb(2);
    }

    const Lm = (typeof Lmdif !== 'undefined') ? Lmdif : require('./lmdif.js');

    // nlsLM as in R minpack.lm 1.2.4: lmdif with factor 0.1, maxiter 200, ftol = ptol = sqrt(eps); then the
    // standard errors of summary.nls from R's numericDeriv gradient (forward differences, delta = |x|*sqrt(eps)).
    // R fails (try() returns NULL) on non-finite residuals or a rank-deficient gradient (qr tolerance 1e-7).
    function nlsLM(f, y, start, lower, upper, maxiter) {
        const n = y.length, m = start.length;
        const resid = t => { const r = new Array(n); for (let i = 0; i < n; i++) r[i] = y[i] - f(t, i); return r; };
        const out = Lm.lmdif(resid, start, n, { factor: 0.1, maxiter, lower, upper });
        if (out.info === -2) return null;
        const th = out.x, S = out.fvec.reduce((s, v) => s + v * v, 0);
        if (!isFinite(S)) return null;
        // gradient (n x m) by numericDeriv
        const f0 = new Array(n); for (let i = 0; i < n; i++) f0[i] = f(th, i);
        const G = [];
        const eps = Math.sqrt(2.220446049250313e-16);
        for (let j = 0; j < m; j++) {
            const t2 = th.slice(); const dl = th[j] === 0 ? eps : Math.abs(th[j]) * eps; t2[j] += dl;
            const col = new Array(n); for (let i = 0; i < n; i++) col[i] = (f(t2, i) - f0[i]) / dl;
            if (col.some(v => !isFinite(v))) return null;
            G.push(col);
        }
        // Householder QR without pivoting (dqrdc2-like rank check with tol 1e-7)
        const A = G.map(c => c.slice()), Rm = Array.from({ length: m }, () => new Array(m).fill(0));
        const norms0 = A.map(c => Lm.enorm(n, c));
        for (let j = 0; j < m; j++) {
            const c = A[j];
            const nrm = Lm.enorm(n - j, c, j);
            if (!(nrm > 1e-7 * norms0[j])) return null;          // singular gradient
            const alpha = c[j] > 0 ? -nrm : nrm;
            const v = c.slice(); for (let i = 0; i < j; i++) v[i] = 0; v[j] -= alpha;
            const vn2 = v.reduce((s, x, i) => i >= j ? s + x * x : s, 0);
            for (let k = j; k < m; k++) {
                const ck = A[k]; let d = 0; for (let i = j; i < n; i++) d += v[i] * ck[i];
                const tt = 2 * d / vn2; for (let i = j; i < n; i++) ck[i] -= tt * v[i];
            }
            for (let k = j; k < m; k++) Rm[j][k] = A[k][j];
            for (let i = 0; i < j; i++) Rm[i][j] = A[j][i];
        }
        // (R'R)^-1 = R^-1 R^-T
        const Ri = Array.from({ length: m }, () => new Array(m).fill(0));
        for (let j = 0; j < m; j++) {
            Ri[j][j] = 1 / Rm[j][j];
            for (let i = j - 1; i >= 0; i--) { let s = 0; for (let k = i + 1; k <= j; k++) s += Rm[i][k] * Ri[k][j]; Ri[i][j] = -s / Rm[i][i]; }
        }
        const s2 = S / (n - m);
        const se = Array.from({ length: m }, (_, i) => { let s = 0; for (let k = 0; k < m; k++) s += Ri[i][k] * Ri[i][k]; return Math.sqrt(s * s2); });
        return { theta: th, deviance: S, se, iterations: out.niter, info: out.info };
    }

    const minMax = (est, se) => [Math.max(0, est - 2 * se), est + 2 * se];
    const minMax1 = (est, se) => [Math.max(0, est - 2 * se), Math.min(1, est + 2 * se)];

    // ------------------------------------------------------------ nls_peak
    function nlsPeak(x, y, k, p, estKmercov, estLength) {
        const names = p === 1 ? ['d', 'kmercov', 'bias', 'length'] : ['d', 'r1', 'kmercov', 'bias', 'length'];
        const n = Math.min(2000, x.length);
        const xs = x.slice(0, n), yT = xs.map((v, i) => v * y[i]);
        const f = (t, i) => {
            const q = {}; names.forEach((nm, j) => q[nm] = t[j]);
            return xs[i] * q.length * predict(p, k, q, xs[i]);
        };
        const rInits = p === 1 ? [null] : [0.001, 0.001, 0.001, 0.01, 0.01, 0.01];
        let best = null;
        for (const r1 of rInits) {
            const start = p === 1 ? [0.1, estKmercov, 0.5, estLength / p] : [0.1, r1, estKmercov, 0.5, estLength / p];
            const lower = p === 1 ? [0, 0, 0, 0] : [0, 1e-5, 0, 0, 0];
            const upper = p === 1 ? [1, Infinity, Infinity, Infinity] : [1, 1, Infinity, Infinity, Infinity];
            const fit = nlsLM(f, yT, start, lower, upper, MAX_ITERATIONS);
            if (fit && (!best || fit.deviance < best.deviance)) best = fit;
        }
        if (!best) return null;
        const est = {}, se = {};
        names.forEach((nm, j) => { est[nm] = best.theta[j]; se[nm] = best.se[j]; });
        const model = { p, k, est, se, deviance: best.deviance, iterations: best.iterations };
        model.ahet = p === 1 ? 0 : est.r1;
        model.het = p === 1 ? [0, 0] : minMax1(est.r1, se.r1);
        model.kcov = minMax(est.kmercov, se.kmercov);
        model.dups = minMax(est.bias, se.bias);
        model.mlen = minMax(est.length, se.length);
        model.md = minMax1(est.d, se.d);
        model.pred = xv => est.length * predict(p, k, est, xv);           // fitted h(x)
        model.predUnique = xv => est.length * predictUnique(p, k, est, xv);
        return model;
    }

    // ------------------------------------------------------------ score_model
    function firstZero(x, yT, pred, kcovLow) {
        const cut = Math.max(1, Math.floor(kcovLow));
        let ind = -1;
        for (let i = 0; i < x.length; i++) if (x[i] <= cut) ind = i;
        if (ind < 0) ind = 0;
        const err = [];
        let fz = -1;
        for (let i = 0; i <= ind; i++) {
            const e = (yT[i] - pred[i]) / x[i];
            if (fz === -1) { err.push(e); if (e < 1) fz = i; }
            else err.push(0);
        }
        if (fz === -1) fz = ind;
        return { fz, ind, err };
    }
    function scoreModel(hx, hy, model) {
        const yT = hx.map((v, i) => v * hy[i]);
        const pred = hx.map(v => v * model.pred(v));
        const kf = Math.max(1, Math.floor(model.kcov[0]));
        const { fz } = firstZero(hx, yT, pred, model.kcov[0]);
        const p = model.p, L = yT.length;
        const range = (a, b) => { let sq = 0, ab = 0, sy = 0; for (let i = a; i < b; i++) { const d = yT[i] - pred[i]; sq += d * d; ab += Math.abs(d); sy += yT[i]; } return { sq, score: 1 - ab / sy }; };
        // R ranges y[first_zero : end] are 1-based inclusive; here 0-based [fz, end)
        const all = range(fz, L), full = range(fz, Math.min(L, (2 * p + 1) * kf)), uniq = range(fz, Math.min(L, (p + 1) * kf));
        return { all: all.sq, allscore: all.score, full: full.sq, fullscore: full.score, unique: uniq.sq, uniquescore: uniq.score, fz };
    }

    function evalModel(hx, hy, a, b) {
        const sa = a ? scoreModel(hx, hy, a) : null, sb = b ? scoreModel(hx, hy, b) : null;
        if (a) {
            if (b) {
                const pdiff = Math.abs(sa.all - sb.all) / Math.max(sa.all, sb.all);
                if (pdiff < SCORE_CLOSE) {
                    if (b.ahet + 0.01 < a.ahet) return [b, sb];          // (sic) as in R
                    if (a.ahet + 0.01 < b.ahet) return [a, sa];
                }
                return sa.all < sb.all ? [a, sa] : [b, sb];
            }
            return [a, sa];
        }
        return [b, sb];
    }

    function estimateGenomePeakp(hx, hy, x, y, k, p) {
        const numofKmers = x.reduce((s, v, i) => s + v * y[i], 0);
        let mx = -1, est1 = null;
        x.forEach((v, i) => { const t = v * y[i]; if (t > mx) { mx = t; est1 = v; } });
        let nls00 = null, nls0 = null;
        for (let i = 1; i <= p; i++) {
            const est2 = est1 / i;
            const nls1 = nlsPeak(x, y, k, p, est2, numofKmers / est2);
            nls0 = evalModel(hx, hy, null, nls1)[0];
            if (i < p) nls00 = evalModel(hx, hy, nls00, nls0)[0];
        }
        return evalModel(hx, hy, nls00, nls0);
    }

    /** Parse a jellyfish/KMC histogram: two numbers per line (count, number of k-mers); other lines are skipped. */
    function parseHisto(text) {
        const rows = [];
        for (const line of text.split(/\r?\n/)) {
            const f = line.trim().split(/[\s,;]+/);
            if (f.length < 2) continue;
            const a = Number(f[0]), b = Number(f[1]);
            if (!isFinite(a) || !isFinite(b) || a <= 0 || b < 0) continue;
            rows.push([a, b]);
        }
        rows.sort((u, v) => u[0] - v[0]);
        return rows;
    }

    /**
     * rows: [[coverage, count], ...] as in the .histo file. Returns the summary numbers of GenomeScope 2.0.
     */
    function run(rows, k = 21, p = 1, opts = {}) {
        if (p !== 1 && p !== 2) throw new Error('only ploidy 1 and 2 are implemented');
        if (rows.length < TYPICAL_ERROR + 5) throw new Error('the histogram has too few rows');
        let r0 = rows;
        if (r0[0][0] === 0) r0 = r0.slice(1);              // minkmerx = 2
        const orig = rows;                                  // kmer_prof_orig keeps all rows (incl. the zero row, as in R)
        const prof = r0.slice(0, r0.length - 1);            // drop the last row
        const px = prof.map(r => r[0]), py = prof.map(r => r[1]);
        const pT = px.map((v, i) => v * py[i]);
        let start = 0, mn = Infinity;
        for (let i = 0; i < Math.min(TYPICAL_ERROR, pT.length); i++) if (pT[i] <= mn) { mn = pT[i]; start = i; }
        // -m / max_kmercov: k-mers with a higher count are ignored by the model (still counted in the totals)
        const maxCovIndex = opts.maxKmercov > 0 ? prof.filter(r => r[0] <= opts.maxKmercov).length : prof.length;
        // R: kmer_prof = kmer_prof_orig[1:maxCovIndex,] (orig, not the minkmerx-trimmed one)
        const loopRows = orig.slice(0, maxCovIndex);
        const hx = loopRows.map(r => r[0]), hy = loopRows.map(r => r[1]);
        let best = [null, null];
        const rounds = [];
        for (let round = 0; round < (opts.rounds || NUM_ROUNDS); round++) {
            const x = hx.slice(start), y = hy.slice(start);
            const mp = estimateGenomePeakp(hx, hy, x, y, k, p);
            rounds.push({ round, start: hx[start], model: mp[0] && { kcov: mp[0].est.kmercov, dev: mp[0].deviance } });
            if (mp[0]) {
                if (!best[0]) best = mp;
                else {
                    const bs = best[0].deviance, ms = mp[0].deviance;
                    const pdiff = Math.abs(ms - bs) / Math.max(ms, bs);
                    if (pdiff < SCORE_CLOSE) {
                        const hetm = mp[0].ahet, hetb = best[0].ahet;
                        if (hetb + 0.01 < hetm) { /* keep */ }
                        else if (hetm + 0.01 < hetb) best = mp;
                        else if (ms < bs) best = mp;
                    } else if (ms < bs) best = mp;
                }
            }
            start += START_SHIFT;
        }
        return report(orig, k, p, best, rounds);
    }

    function report(orig, k, p, [model, score], rounds) {
        if (!model) return { ok: false, rounds };
        const x = orig.map(r => r[0]), y = orig.map(r => r[1]);
        const yT = x.map((v, i) => v * y[i]);
        const pred = x.map(v => v * model.pred(v));
        const { ind, err } = firstZero(x, yT, pred, model.kcov[0]);
        let errK = 0;
        for (let i = 0; i <= ind; i++) errK += Math.max(err[i], 1e-10) * x[i];
        const total = yT.reduce((a, b) => a + b, 0);
        const errorRate = 1 - Math.pow(1 - errK / total, 1 / k);
        const lenFor = c => (total - errK) / (p * c);
        const uniqueK = x.reduce((s, v) => s + v * model.predUnique(v), 0);
        const repeatK = Math.max(0, total - uniqueK - errK);
        const kc = model.kcov;
        const pair = num => [num / (p * kc[1]), num / (p * kc[0])].sort((a, b) => a - b);  // kcov max -> min length
        const uniqueLength = repeatK === 0 ? pair(total - errK) : pair(uniqueK);
        return {
            ok: true, p, k, model, score, rounds,
            kmercov: model.est.kmercov, kcov: model.kcov, bias: model.est.bias, d: model.est.d,
            het: model.het, ahet: model.ahet,
            haploidLength: pair(total - errK), aHaploidLength: lenFor(model.est.kmercov),
            repeatLength: pair(repeatK), uniqueLength,
            uniqueFraction: uniqueLength[0] / pair(total - errK)[0],
            modelFit: [score.allscore, score.fullscore],           // as printed: "Model Fit" min = all k-mers, max = full model
            errorRate, errorKmers: errK, totalKmers: total,
            // for the plots: observed h(x), full model, unique sequence, error k-mers (x[0..errorEnd])
            plot: { x, y, model: x.map(v => model.pred(v)), unique: x.map(v => model.predUnique(v)),
                    errors: err.slice(0, ind + 1).map(v => Math.max(v, 1e-10)), errorEnd: ind },
        };
    }

    /** The table of GenomeScope's summary.txt for a result of run(). meta: { input, maxKmercov } */
    function summaryText(R, meta = {}) {
        const pc = v => String(Number((Number(v.toPrecision(6)) * 100).toPrecision(6))) + '%';
        const bp = v => Math.round(v).toLocaleString('en-US') + ' bp';
        const row = (a, b, c) => a.padEnd(28) + '  ' + (c === undefined ? b : b.padEnd(16) + '  ' + c);
        const out = ['GenomeScope version 2.0 (browser port)'];
        if (meta.input) out.push('input file = ' + meta.input);
        out.push('p = ' + R.p, 'k = ' + R.k);
        if (meta.maxKmercov > 0) out.push('max_kmercov = ' + meta.maxKmercov);
        out.push('', row('property', 'min', 'max'));
        if (R.p === 1) out.push(row('Homozygous (a)', pc(1 - R.het[1]), pc(1 - R.het[0])));
        else out.push(row('Homozygous (aa)', pc(1 - R.het[1]), pc(1 - R.het[0])), row('Heterozygous (ab)', pc(R.het[0]), pc(R.het[1])));
        out.push(row('Genome Haploid Length', bp(R.haploidLength[0]), bp(R.haploidLength[1])),
            row('Genome Repeat Length', bp(R.repeatLength[0]), bp(R.repeatLength[1])),
            row('Genome Unique Length', bp(R.uniqueLength[0]), bp(R.uniqueLength[1])),
            row('Model Fit ', pc(R.modelFit[0]), pc(R.modelFit[1])),
            row('Read Error Rate', pc(R.errorRate), pc(R.errorRate)));
        return out.join('\n') + '\n';
    }

    return { run, parseHisto, summaryText, dnbinom, lgamma, predict, nlsLM };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = GenomeScope;
