/**
 * K-MER SPECTRUM LAB – GENOMESCOPE TAB
 * ====================================
 * Tab 3 of kmer-spectrum.html: GenomeScope 2.0 on the student's own k-mer histogram (file, pasted text, the
 * practical's example or the current Genome-lab spectrum), computed in the browser by genomeScopeEngine.js.
 * Shows the four GenomeScope plots (linear / log, plain / transformed n·h(n)) with the same curves and
 * colours as the R tool, the summary table of summary.txt (downloadable) and, for lab data, the truth.
 */
class GenomeScopeTab {
    constructor(app) {
        this.app = app;
        this.$ = app.$;
        this.GS = GenomeScope;
        this.src = null;        // { rows, name, truth? }
        this.res = null;
        this.view = 'linear';
        this.$('gs-file').addEventListener('change', e => this.loadFile(e.target.files[0]));
        this.$('gs-example').addEventListener('click', () => this.loadExample('usa300'));
        this.$('gs-from-lab').addEventListener('click', () => this.loadFromLab());
        this.$('gs-paste-use').addEventListener('click', () => this.useText(this.$('gs-paste').value, 'pasted histogram'));
        this.$('gs-run').addEventListener('click', () => this.run());
        this.$('gs-download').addEventListener('click', () => this.download());
        document.querySelectorAll('input[name="gs-view"]').forEach(r => r.addEventListener('change', () => { this.view = r.value; this.draw(); }));
        const box = this.$('gs-input');
        box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('gs-drag'); });
        box.addEventListener('dragleave', () => box.classList.remove('gs-drag'));
        box.addEventListener('drop', e => { e.preventDefault(); box.classList.remove('gs-drag'); if (e.dataTransfer.files[0]) this.loadFile(e.dataTransfer.files[0]); });
    }

    show() {
        history.replaceState(null, '', '#genomescope');
        if (!this.src) this.status('Load a histogram – or try the example from the assembly practical.');
    }

    status(msg, bad) { const s = this.$('gs-status'); s.textContent = msg; s.classList.toggle('dp-red', !!bad); }

    // ------------------------------------------------------------ input
    loadFile(file) {
        if (!file) return;
        const rd = new FileReader();
        rd.onload = () => this.useText(String(rd.result), file.name);
        rd.readAsText(file);
    }
    loadExample(key) {
        const ex = GS_EXAMPLES[key];
        this.$('gs-k').value = ex.k; this.$('gs-p').value = ex.p; this.$('gs-m').value = -1;
        this.useText(ex.data.replace(/(\S+) (\S+) ?/g, '$1 $2\n'), ex.file, null, ex.name);
    }
    loadFromLab() {
        const R = this.app.labR || (this.app.labR = this.app.run(this.app.labParams()));
        const h = R.hist.h, lines = [];
        for (let n = 1; n < h.length; n++) if (h[n] > 0) lines.push(n + ' ' + h[n]);
        this.$('gs-k').value = R.p.k; this.$('gs-p').value = R.p.ploidy; this.$('gs-m').value = -1;
        const T = R.genome.truth;
        this.useText(lines.join('\n'), 'genome_lab.histo', { G: T.G, het: T.het, repeatFraction: T.repeatFraction, err: R.p.errorRate, ploidy: R.p.ploidy, k: R.p.k },
            `Genome lab: ${KM_PRESETS[this.app.lab.preset].name}`);
    }
    useText(text, name, truth = null, label = null) {
        const rows = this.GS.parseHisto(text);
        if (rows.length < 20) { this.status(`${name}: found ${rows.length} rows with two numbers – a k-mer histogram has two columns (count, number of k-mers), e.g. the output of jellyfish histo.`, true); return; }
        this.src = { rows, name, truth, label: label || name };
        this.$('gs-paste').value = text.length < 200000 ? text : '';
        const kmers = rows.reduce((s, r) => s + r[0] * r[1], 0);
        this.$('gs-loaded').innerHTML = `<strong>${this.esc(this.src.label)}</strong> – ${rows.length.toLocaleString()} rows, counts ${rows[0][0]}–${rows[rows.length - 1][0].toLocaleString()}, ${this.app.fmt(kmers)} k-mers in total`;
        this.run();
    }
    esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

    // ------------------------------------------------------------ fit
    run() {
        if (!this.src) { this.status('Load a histogram first.', true); return; }
        const k = +this.$('gs-k').value, p = +this.$('gs-p').value, m = +this.$('gs-m').value;
        if (!(k >= 5 && k <= 64)) { this.status('k must be between 5 and 64 – use the k of jellyfish count -m.', true); return; }
        this.status(`Fitting the GenomeScope model (p = ${p}, k = ${k})…`);
        this.$('gs-run').disabled = true;
        setTimeout(() => {
            const t0 = performance.now();
            try {
                this.res = this.GS.run(this.src.rows, k, p, { maxKmercov: m });
                this.meta = { input: this.src.name, maxKmercov: m };
                if (!this.res.ok) this.status('The model did not converge in any of the four rounds (GenomeScope reports "failed to converge"). Check k and the ploidy, and that the histogram has a peak.', true);
                else this.status(`Model fitted in ${((performance.now() - t0) / 1000).toFixed(2)} s.`);
            } catch (e) {
                this.res = null;
                this.status('GenomeScope failed: ' + e.message, true);
            }
            this.$('gs-run').disabled = false;
            this.draw();
        }, 20);
    }

    // ------------------------------------------------------------ output
    draw() {
        const R = this.res;
        this.$('gs-download').disabled = !(R && R.ok);
        if (!R || !R.ok) { this.$('gs-plot').innerHTML = ''; this.$('gs-summary').innerHTML = ''; this.$('gs-truth').innerHTML = ''; return; }
        this.$('gs-plot').innerHTML = this.plot(R, this.view);
        this.$('gs-summary').innerHTML = `<pre class="hm-cmd gs-summary">${this.esc(this.GS.summaryText(R, this.meta))}</pre>`;
        this.$('gs-truth').innerHTML = this.truthTable(R);
    }

    title(R) {
        const f3 = v => Number(v.toPrecision(3));
        const het = R.p === 1 ? `a:${f3(100 * (1 - R.ahet))}%` : `aa:${f3(100 * (1 - R.ahet))}% ab:${f3(100 * R.ahet)}%`;
        return [`len:${Math.round(R.aHaploidLength).toLocaleString('en-US')}bp uniq:${f3(100 * R.uniqueFraction)}%`,
            `${het} kcov:${f3(R.kmercov)} err:${f3(100 * R.errorRate)}% dup:${f3(R.bias)} k:${R.k} p:${R.p}`];
    }

    /** One of the four GenomeScope plots as SVG; view: linear | log | tlinear | tlog. */
    plot(R, view) {
        const C = { hist: '#56B4E9', model: '#000000', unique: '#E0C400', errors: '#D55E00', peaks: '#000000' };
        const W = 760, H = 380, ml = 70, mr = 16, mt = 52, mb = 46, pw = W - ml - mr, ph = H - mt - mb;
        const P = R.plot, tr = view[0] === 't', log = view.endsWith('log');
        const v = (i, y) => tr ? P.x[i] * y : y;
        const n = P.x.length;
        // ranges as GenomeScope: zoom past the error valley (minimum in the first 15 rows), 1.1 × the highest point after it
        let start = 0, mn = Infinity;
        for (let i = 0; i < Math.min(15, n); i++) if (v(i, P.y[i]) <= mn) { mn = v(i, P.y[i]); start = i; }
        let ymax = 0, imax = start;
        for (let i = start; i < n - 1; i++) if (v(i, P.y[i]) > ymax) { ymax = v(i, P.y[i]); imax = i; }
        let X, Y, xticks, yticks, xmax;
        if (!log) {
            xmax = Math.min(P.x[n - 1], Math.max(3 * P.x[imax], R.kmercov * (2 * R.p + 1.1)));
            const ytop = ymax * 1.1;
            X = x => ml + pw * x / xmax; Y = y => mt + ph * (1 - Math.min(1.02, Math.max(0, y) / ytop));
            xticks = this.nice(xmax, 6); yticks = this.nice(ytop, 4);
        } else {
            xmax = P.x[n - 1];
            const yvals = P.y.map((y, i) => v(i, y)).filter(y => y > 0);
            const ylo = Math.max(0.5, Math.min(...yvals)), yhi = Math.max(...yvals) * 3;
            const lx = Math.log10(Math.max(xmax, 10)), ly0 = Math.log10(ylo), ly1 = Math.log10(yhi);
            X = x => ml + pw * Math.log10(Math.max(x, 1)) / lx;
            Y = y => y <= 0 ? mt + ph + 10 : mt + ph * (1 - (Math.log10(y) - ly0) / (ly1 - ly0));
            xticks = []; for (let e = 0; Math.pow(10, e) <= xmax; e++) xticks.push(Math.pow(10, e));
            yticks = []; for (let e = Math.ceil(ly0); e <= ly1; e++) yticks.push(Math.pow(10, e));
        }
        const fmt = a => a >= 1e6 ? (a / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'M' : a >= 1e3 ? (a / 1e3).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'k' : String(a);
        let s = `<svg class="km-hist gs-plot" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
        s += `<defs><clipPath id="gs-clip"><rect x="${ml}" y="${mt - 2}" width="${pw}" height="${ph + 2}"/></clipPath></defs>`;
        const [t1, t2] = this.title(R);
        s += `<text x="${ml + pw / 2}" y="16" font-size="13" font-weight="600" text-anchor="middle" fill="#1f1e1b">GenomeScope ${{ linear: 'Profile', log: 'Profile (log)', tlinear: 'Transformed Profile', tlog: 'Transformed Profile (log)' }[view]}</text>`;
        s += `<text x="${ml + pw / 2}" y="31" font-size="11" text-anchor="middle" fill="#4a5568">${t1}</text><text x="${ml + pw / 2}" y="44" font-size="11" text-anchor="middle" fill="#4a5568">${t2}</text>`;
        for (const t of yticks) s += `<line x1="${ml}" x2="${ml + pw}" y1="${Y(t)}" y2="${Y(t)}" stroke="#edf2f7"/><text x="${ml - 6}" y="${Y(t) + 3}" font-size="10" text-anchor="end" fill="#718096">${fmt(t)}</text>`;
        for (const t of xticks) s += `<line x1="${X(t)}" x2="${X(t)}" y1="${mt + ph}" y2="${mt + ph + 4}" stroke="#a0aec0"/><text x="${X(t)}" y="${mt + ph + 15}" font-size="10" text-anchor="middle" fill="#718096">${fmt(t)}</text>`;
        s += `<g clip-path="url(#gs-clip)">`;
        // observed: bars (linear) or a filled profile (log)
        if (!log) {
            const bw = Math.max(1, pw / xmax * 0.8);
            for (let i = 0; i < n; i++) { if (P.x[i] > xmax) break; const y = v(i, P.y[i]); if (y > 0) s += `<rect x="${X(P.x[i]) - bw / 2}" y="${Y(y)}" width="${bw}" height="${mt + ph - Y(y)}" fill="${C.hist}"/>`; }
        } else {
            let d = ''; for (let i = 0; i < n; i++) { const y = v(i, P.y[i]); if (y > 0) d += `${d ? 'L' : 'M'}${X(P.x[i]).toFixed(1)},${Y(y).toFixed(1)}`; }
            s += `<path d="${d}" fill="none" stroke="${C.hist}" stroke-width="2.5"/>`;
        }
        for (let j = 1; j <= 2 * R.p; j++) s += `<line x1="${X(R.kmercov * j)}" x2="${X(R.kmercov * j)}" y1="${mt}" y2="${mt + ph}" stroke="${C.peaks}" stroke-width="1" stroke-dasharray="5 4"/>`;
        const line = (ys, color, width, upto = n - 1) => {
            let d = '';
            for (let i = 0; i <= upto; i++) { if (!log && P.x[i] > xmax * 1.02) break; const y = v(i, ys[i]); if (log && !(y > 0)) continue; d += `${d ? 'L' : 'M'}${X(P.x[i]).toFixed(1)},${Y(y).toFixed(1)}`; }
            return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round"/>`;
        };
        s += line(P.unique, C.unique, 3) + line(P.model, C.model, 2.5) + line(P.errors, C.errors, 3, P.errorEnd);
        s += `</g><line x1="${ml}" x2="${ml + pw}" y1="${mt + ph}" y2="${mt + ph}" stroke="#a0aec0"/><line x1="${ml}" x2="${ml}" y1="${mt}" y2="${mt + ph}" stroke="#a0aec0"/>`;
        s += `<text x="${ml + pw / 2}" y="${H - 8}" font-size="11" text-anchor="middle" fill="#4a5568">Coverage (k-mer count)</text>`;
        s += `<text x="14" y="${mt + ph / 2}" font-size="11" text-anchor="middle" fill="#4a5568" transform="rotate(-90 14 ${mt + ph / 2})">${tr ? 'Coverage × Frequency' : 'Frequency (distinct k-mers)'}</text>`;
        const items = [['observed', C.hist, ''], ['full model', C.model, ''], ['unique sequence', C.unique, ''], ['errors', C.errors, ''], ['k-mer peaks (1×, 2×, … kcov)', C.peaks, 'dash']];
        return s + '</svg>' + `<div class="km-legend gs-legend">${items.map(([lab, col, dash]) => `<span><i style="${dash ? `background:none;border-top:2px dashed ${col};height:0` : `background:${col};height:4px`}"></i>${lab}</span>`).join('')}</div>`;
    }
    nice(max, n) {
        const raw = max / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 5, 10].map(x => x * mag).find(x => x >= raw);
        const out = []; for (let t = 0; t <= max + 1e-9; t += step) out.push(+t.toPrecision(12)); return out;
    }

    truthTable(R) {
        const T = this.src && this.src.truth;
        if (!T) return '';
        if (T.ploidy !== R.p || T.k !== R.k) return `<p class="dp-hint">The lab genome is ${T.ploidy === 1 ? 'haploid' : 'diploid'} and was counted with k = ${T.k}; set the same values to compare with the truth.</p>`;
        const pc = (x, d = 2) => (100 * x).toFixed(d) + ' %', bp = x => this.app.fmt(x) + ' bp';
        const row = (name, est, truth, f) => `<tr><td>${name}</td><td><strong>${f(est)}</strong></td><td>${f(truth)}</td><td class="${truth > 0 && Math.abs(est / truth - 1) > 0.1 ? 'dp-red' : ''}">${truth > 0 ? (est >= truth ? '+' : '') + pc(est / truth - 1, 1) : ''}</td></tr>`;
        const mid = a => (a[0] + a[1]) / 2;
        return `<h4>GenomeScope vs the true lab genome</h4><table class="bl-table"><thead><tr><th></th><th>GenomeScope</th><th>true</th><th>error</th></tr></thead><tbody>
            ${row('haploid genome length', R.aHaploidLength, T.G, bp)}
            ${R.p === 2 ? row('heterozygosity (ab)', R.ahet, T.het, pc) : ''}
            ${row('repeat content (repeat / haploid length)', mid(R.repeatLength) / mid(R.haploidLength), T.repeatFraction, x => pc(x, 1))}
            ${row('read error rate', R.errorRate, T.err, pc)}
            </tbody></table><p class="dp-hint">The lab's own model (tab 2) uses a simpler fit; compare both on the same genome. Like every k-mer method, GenomeScope sees only near-identical repeats (try the diverged-repeats preset).</p>`;
    }

    download() {
        if (!this.res || !this.res.ok) return;
        const blob = new Blob([this.GS.summaryText(this.res, this.meta)], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'summary.txt';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
}
