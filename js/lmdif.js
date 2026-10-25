/**
 * LMDIF
 * =====
 * MINPACK lmdif (Levenberg-Marquardt with a trust region, forward-difference Jacobian; Moré 1978) ported from
 * lmdif.f / lmpar.f / qrfac.f / qrsolv.f as used by R's minpack.lm 1.2.4, including its two changes:
 * fcn_lmdif clamps the parameters to [lower, upper] in place before every evaluation, and every Jacobian
 * counts as one iteration – at maxiter the fit stops with info = -1 and returns the current parameters.
 *
 * lmdif(fcn, x0, m, opts): fcn(x) -> residual array of length m. Returns { x, fvec, info, nfev, niter }.
 */
const Lmdif = (() => {
    const EPSMCH = 2.220446049250313e-16, DWARF = 2.2250738585072014e-308;

    function enorm(n, x, off = 0) {
        // plain Euclidean norm with scaling (overflow-safe enough for our magnitudes)
        let s = 0, mx = 0;
        for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(x[off + i]));
        if (mx === 0) return 0;
        for (let i = 0; i < n; i++) { const v = x[off + i] / mx; s += v * v; }
        return mx * Math.sqrt(s);
    }

    // QR with column pivoting of the m x n matrix a (column-major: a[j][i] = column j, row i)
    function qrfac(m, n, a, pivot, ipvt, rdiag, acnorm, wa) {
        for (let j = 0; j < n; j++) {
            acnorm[j] = enorm(m, a[j]);
            rdiag[j] = acnorm[j];
            wa[j] = rdiag[j];
            if (pivot) ipvt[j] = j;
        }
        const minmn = Math.min(m, n);
        for (let j = 0; j < minmn; j++) {
            if (pivot) {
                let kmax = j;
                for (let k = j; k < n; k++) if (rdiag[k] > rdiag[kmax]) kmax = k;
                if (kmax !== j) {
                    const t = a[j]; a[j] = a[kmax]; a[kmax] = t;
                    rdiag[kmax] = rdiag[j]; wa[kmax] = wa[j];
                    const ti = ipvt[j]; ipvt[j] = ipvt[kmax]; ipvt[kmax] = ti;
                }
            }
            const aj = a[j];
            let ajnorm = 0;
            { let mx = 0; for (let i = j; i < m; i++) mx = Math.max(mx, Math.abs(aj[i]));
              if (mx > 0) { let s = 0; for (let i = j; i < m; i++) { const v = aj[i] / mx; s += v * v; } ajnorm = mx * Math.sqrt(s); } }
            if (ajnorm !== 0) {
                if (aj[j] < 0) ajnorm = -ajnorm;
                for (let i = j; i < m; i++) aj[i] /= ajnorm;
                aj[j] += 1;
                for (let k = j + 1; k < n; k++) {
                    const ak = a[k];
                    let sum = 0;
                    for (let i = j; i < m; i++) sum += aj[i] * ak[i];
                    const temp = sum / aj[j];
                    for (let i = j; i < m; i++) ak[i] -= temp * aj[i];
                    if (pivot && rdiag[k] !== 0) {
                        const t = ak[j] / rdiag[k];
                        rdiag[k] *= Math.sqrt(Math.max(0, 1 - t * t));
                        if (0.05 * (rdiag[k] / wa[k]) ** 2 <= EPSMCH) {
                            let mx = 0; for (let i = j + 1; i < m; i++) mx = Math.max(mx, Math.abs(ak[i]));
                            let s = 0; if (mx > 0) for (let i = j + 1; i < m; i++) { const v = ak[i] / mx; s += v * v; }
                            rdiag[k] = mx * Math.sqrt(s);
                            wa[k] = rdiag[k];
                        }
                    }
                }
            }
            rdiag[j] = -ajnorm;
        }
    }

    // solve (R'R + D'D) z = R'qtb in the least-squares sense (MINPACK qrsolv); r is n x n column-major (r[j][i])
    function qrsolv(n, r, ipvt, diag, qtb, x, sdiag, wa) {
        for (let j = 0; j < n; j++) {
            for (let i = j; i < n; i++) r[j][i] = r[i][j];
            x[j] = r[j][j];
            wa[j] = qtb[j];
        }
        for (let j = 0; j < n; j++) {
            const l = ipvt[j];
            if (diag[l] !== 0) {
                for (let k = j; k < n; k++) sdiag[k] = 0;
                sdiag[j] = diag[l];
                let qtbpj = 0;
                for (let k = j; k < n; k++) {
                    if (sdiag[k] === 0) continue;
                    let sin, cos;
                    if (Math.abs(r[k][k]) < Math.abs(sdiag[k])) {
                        const cotan = r[k][k] / sdiag[k];
                        sin = 0.5 / Math.sqrt(0.25 + 0.25 * cotan * cotan);
                        cos = sin * cotan;
                    } else {
                        const tan = sdiag[k] / r[k][k];
                        cos = 0.5 / Math.sqrt(0.25 + 0.25 * tan * tan);
                        sin = cos * tan;
                    }
                    r[k][k] = cos * r[k][k] + sin * sdiag[k];
                    const temp = cos * wa[k] + sin * qtbpj;
                    qtbpj = -sin * wa[k] + cos * qtbpj;
                    wa[k] = temp;
                    for (let i = k + 1; i < n; i++) {
                        const t = cos * r[k][i] + sin * sdiag[i];
                        sdiag[i] = -sin * r[k][i] + cos * sdiag[i];
                        r[k][i] = t;
                    }
                }
            }
            sdiag[j] = r[j][j];
            r[j][j] = x[j];
        }
        let nsing = n;
        for (let j = 0; j < n; j++) {
            if (sdiag[j] === 0 && nsing === n) nsing = j;
            if (nsing < n) wa[j] = 0;
        }
        for (let k = 1; k <= nsing; k++) {
            const j = nsing - k;
            let sum = 0;
            for (let i = j + 1; i < nsing; i++) sum += r[j][i] * wa[i];
            wa[j] = (wa[j] - sum) / sdiag[j];
        }
        for (let j = 0; j < n; j++) x[ipvt[j]] = wa[j];
    }

    // MINPACK lmpar
    function lmpar(n, r, ipvt, diag, qtb, delta, par, x, sdiag, wa1, wa2) {
        const p1 = 0.1, p001 = 0.001;
        let nsing = n;
        for (let j = 0; j < n; j++) {
            wa1[j] = qtb[j];
            if (r[j][j] === 0 && nsing === n) nsing = j;
            if (nsing < n) wa1[j] = 0;
        }
        for (let k = 1; k <= nsing; k++) {
            const j = nsing - k;
            wa1[j] /= r[j][j];
            const temp = wa1[j];
            for (let i = 0; i < j; i++) wa1[i] -= r[j][i] * temp;
        }
        for (let j = 0; j < n; j++) x[ipvt[j]] = wa1[j];
        let iter = 0;
        for (let j = 0; j < n; j++) wa2[j] = diag[j] * x[j];
        let dxnorm = enorm(n, wa2);
        let fp = dxnorm - delta;
        if (fp <= p1 * delta) return 0;
        let parl = 0;
        if (nsing >= n) {
            for (let j = 0; j < n; j++) { const l = ipvt[j]; wa1[j] = diag[l] * (wa2[l] / dxnorm); }
            for (let j = 0; j < n; j++) {
                let sum = 0;
                for (let i = 0; i < j; i++) sum += r[j][i] * wa1[i];
                wa1[j] = (wa1[j] - sum) / r[j][j];
            }
            const temp = enorm(n, wa1);
            parl = fp / delta / temp / temp;
        }
        for (let j = 0; j < n; j++) {
            let sum = 0;
            for (let i = 0; i <= j; i++) sum += r[j][i] * qtb[i];
            wa1[j] = sum / diag[ipvt[j]];
        }
        const gnorm = enorm(n, wa1);
        let paru = gnorm / delta;
        if (paru === 0) paru = DWARF / Math.min(delta, p1);
        par = Math.max(par, parl);
        par = Math.min(par, paru);
        if (par === 0) par = gnorm / dxnorm;
        for (;;) {
            iter++;
            if (par === 0) par = Math.max(DWARF, p001 * paru);
            const temp = Math.sqrt(par);
            for (let j = 0; j < n; j++) wa1[j] = temp * diag[j];
            qrsolv(n, r, ipvt, wa1, qtb, x, sdiag, wa2);
            for (let j = 0; j < n; j++) wa2[j] = diag[j] * x[j];
            dxnorm = enorm(n, wa2);
            const temp2 = fp;
            fp = dxnorm - delta;
            if (Math.abs(fp) <= p1 * delta || (parl === 0 && fp <= temp2 && temp2 < 0) || iter === 10) break;
            for (let j = 0; j < n; j++) { const l = ipvt[j]; wa1[j] = diag[l] * (wa2[l] / dxnorm); }
            for (let j = 0; j < n; j++) {
                wa1[j] /= sdiag[j];
                const t = wa1[j];
                for (let i = j + 1; i < n; i++) wa1[i] -= r[j][i] * t;
            }
            const t3 = enorm(n, wa1);
            const parc = fp / delta / t3 / t3;
            if (fp > 0) parl = Math.max(parl, par);
            if (fp < 0) paru = Math.min(paru, par);
            par = Math.max(parl, par + parc);
        }
        return par;
    }

    function lmdif(fcn, x0, m, opts) {
        const o = Object.assign({ ftol: 1.49012e-8, xtol: 1.49012e-8, gtol: 0, maxfev: 100 * (x0.length + 1), epsfcn: 0, factor: 100, maxiter: 50, lower: null, upper: null }, opts);
        const n = x0.length;
        const lower = o.lower || new Array(n).fill(-Infinity), upper = o.upper || new Array(n).fill(Infinity);
        const x = x0.slice();
        let nfev = 0, niter = 0, info = 0;
        // minpack.lm: clamp in place, then evaluate
        const call = v => { for (let i = 0; i < n; i++) { if (v[i] < lower[i]) v[i] = lower[i]; if (v[i] > upper[i]) v[i] = upper[i]; } nfev++; return fcn(v); };
        const diag = new Array(n).fill(0), qtf = new Array(n), wa1 = new Array(n), wa2 = new Array(n), wa3 = new Array(n);
        const ipvt = new Array(n), rdiag = new Array(n), acnorm = new Array(n), qraux = new Array(n);
        const eps = Math.sqrt(Math.max(o.epsfcn, EPSMCH));
        let fvec = call(x);
        if (fvec.some(v => !isFinite(v))) return { x, fvec, info: -2, nfev, niter };   // R: "non-sensible value" error
        let fnorm = enorm(m, fvec);
        let par = 0, delta = 0, xnorm = 0;
        let iter = 1;
        const wa4 = new Array(m);
        outer:
        for (;;) {
            // forward-difference Jacobian (fdjac2); fjac[j] = column j
            const fjac = [];
            for (let j = 0; j < n; j++) {
                const temp = x[j];
                let h = eps * Math.abs(temp);
                if (h === 0) h = eps;
                x[j] = temp + h;
                const f2 = call(x);
                x[j] = temp;
                const col = new Array(m);
                for (let i = 0; i < m; i++) col[i] = (f2[i] - fvec[i]) / h;
                fjac.push(col);
            }
            // minpack.lm: fcn(iflag = 0) after every Jacobian counts the iteration and stops at maxiter
            niter++;
            if (niter === o.maxiter) { info = -1; break; }
            qrfac(m, n, fjac, true, ipvt, rdiag, acnorm, wa2);   // fjac columns permuted in place
            // fjac[j] now holds column j of the factored matrix (after pivoting)
            if (iter === 1) {
                for (let j = 0; j < n; j++) { diag[j] = acnorm[j]; if (diag[j] === 0) diag[j] = 1; }
                for (let j = 0; j < n; j++) wa3[j] = diag[j] * x[j];
                xnorm = enorm(n, wa3);
                delta = o.factor * xnorm;
                if (delta === 0) delta = o.factor;
            }
            for (let i = 0; i < m; i++) wa4[i] = fvec[i];
            for (let j = 0; j < n; j++) {
                const fj = fjac[j];
                if (fj[j] !== 0) {
                    let sum = 0;
                    for (let i = j; i < m; i++) sum += fj[i] * wa4[i];
                    const temp = -sum / fj[j];
                    for (let i = j; i < m; i++) wa4[i] += fj[i] * temp;
                }
                fj[j] = rdiag[j];
                qtf[j] = wa4[j];
            }
            // r as n x n column-major: r[j][i] = fjac[j][i] for i <= j
            const r = Array.from({ length: n }, (_, j) => fjac[j].slice(0, n));
            let gnorm = 0;
            if (fnorm !== 0) {
                for (let j = 0; j < n; j++) {
                    const l = ipvt[j];
                    if (acnorm[l] !== 0) {
                        let sum = 0;
                        for (let i = 0; i <= j; i++) sum += r[j][i] * (qtf[i] / fnorm);
                        gnorm = Math.max(gnorm, Math.abs(sum / acnorm[l]));
                    }
                }
            }
            if (gnorm <= o.gtol) info = 4;
            if (info !== 0) break;
            // ipvt maps position j -> original column; acnorm indexed by original column
            for (let j = 0; j < n; j++) diag[j] = Math.max(diag[j], acnorm[j]);
            for (;;) {
                // lmpar works with r in pivoted order and diag/x in original order
                par = lmpar(n, r, ipvt, diag, qtf, delta, par, wa1, wa2, wa3, wa4);
                for (let j = 0; j < n; j++) { wa1[j] = -wa1[j]; wa2[j] = x[j] + wa1[j]; wa3[j] = diag[j] * wa1[j]; }
                const pnorm = enorm(n, wa3);
                if (iter === 1) delta = Math.min(delta, pnorm);
                const wa2c = wa2.slice();
                const f4 = call(wa2c);                 // clamped in place
                for (let j = 0; j < n; j++) wa2[j] = wa2c[j];
                const fnorm1 = f4.some(v => !isFinite(v)) ? Infinity : enorm(m, f4);
                let actred = -1;
                if (0.1 * fnorm1 < fnorm) actred = 1 - (fnorm1 / fnorm) ** 2;
                for (let j = 0; j < n; j++) {
                    wa3[j] = 0;
                    const l = ipvt[j], temp = wa1[l];
                    for (let i = 0; i <= j; i++) wa3[i] += r[j][i] * temp;
                }
                const temp1 = enorm(n, wa3) / fnorm, temp2 = Math.sqrt(par) * pnorm / fnorm;
                const prered = temp1 * temp1 + temp2 * temp2 / 0.5;
                const dirder = -(temp1 * temp1 + temp2 * temp2);
                const ratio = prered !== 0 ? actred / prered : 0;
                if (ratio <= 0.25) {
                    let temp = actred >= 0 ? 0.5 : 0.5 * dirder / (dirder + 0.5 * actred);
                    if (0.1 * fnorm1 >= fnorm || temp < 0.1) temp = 0.1;
                    delta = temp * Math.min(delta, pnorm / 0.1);
                    par /= temp;
                } else if (par === 0 || ratio >= 0.75) {
                    delta = pnorm / 0.5;
                    par = 0.5 * par;
                }
                if (ratio >= 1e-4) {
                    for (let j = 0; j < n; j++) { x[j] = wa2[j]; wa2[j] = diag[j] * x[j]; }
                    fvec = f4;
                    xnorm = enorm(n, wa2);
                    fnorm = fnorm1;
                    iter++;
                }
                if (Math.abs(actred) <= o.ftol && prered <= o.ftol && 0.5 * ratio <= 1) info = 1;
                if (delta <= o.xtol * xnorm) info = 2;
                if (Math.abs(actred) <= o.ftol && prered <= o.ftol && 0.5 * ratio <= 1 && info === 2) info = 3;
                if (info !== 0) break outer;
                if (nfev >= o.maxfev) { info = 5; break outer; }
                if (Math.abs(actred) <= EPSMCH && prered <= EPSMCH && 0.5 * ratio <= 1) { info = 6; break outer; }
                if (delta <= EPSMCH * xnorm) { info = 7; break outer; }
                if (gnorm <= EPSMCH) { info = 8; break outer; }
                if (ratio >= 1e-4) break;
            }
        }
        return { x, fvec, info, nfev, niter };
    }

    return { lmdif, enorm };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Lmdif;
