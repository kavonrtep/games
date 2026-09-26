/**
 * K-MER SPECTRUM LAB – controller
 * ===============================
 * Tab 1 teaches the method in seven steps, each on its own simulated data
 * set with a few inline controls; tab 2 is the free genome lab; tab 3 the
 * quiz. Deep links: #principle-4, #lab, #quiz.
 */
const KM_PRESETS = [
    { name: 'Bacterium: haploid, clean', note: 'Haploid, no repeats: one clean peak – the easy case.', p: { G: 2, ploidy: 1, het: 0, rep: 0, copies: 2, div: 0, cov: 30, L: 1, err: 0.3, k: 21 } },
    { name: 'Diploid, 1 % heterozygous ★', note: 'Two peaks: heterozygous k-mers at half the depth of homozygous ones. Which one tells the genome size?', p: { G: 2, ploidy: 2, het: 1, rep: 0, copies: 2, div: 0, cov: 40, L: 1, err: 0.5, k: 21 } },
    { name: 'Highly heterozygous (3 %)', note: 'The heterozygous peak is now the higher one – the classic trap: taking the tallest peak halves the depth and doubles the genome size.', p: { G: 2, ploidy: 2, het: 3, rep: 0, copies: 2, div: 0, cov: 40, L: 1, err: 0.5, k: 21 } },
    { name: 'Repetitive genome', note: '40 % of the genome in 4-copy repeat families: a peak at 8λ (4 copies × 2 haplotypes). In the ordinary plot it is low and flat – a family in c copies has c times fewer distinct k-mers, spread over a √c times wider peak. Switch the y axis to n·h(n): each peak then shows the share of the genome it stands for.', ymode: 'share', p: { G: 2, ploidy: 2, het: 0.5, rep: 40, copies: 4, div: 0, cov: 40, L: 1, err: 0.5, k: 21 } },
    { name: 'Old, diverged repeats', note: 'The same repeats with 5 % divergence between copies: most of their k-mers now differ between copies and look unique.', p: { G: 2, ploidy: 2, het: 0.5, rep: 40, copies: 4, div: 5, cov: 40, L: 1, err: 0.5, k: 21 } },
    { name: 'Low coverage', note: '10× coverage: the error spike and the genomic peaks overlap. Where do you put the cut-off?', p: { G: 2, ploidy: 2, het: 1, rep: 0, copies: 2, div: 0, cov: 10, L: 1, err: 1, k: 21 } },
    { name: 'k too small', note: 'A random 200 kb genome without repeats, counted with k = 9: there are only 4⁹ ≈ 262 000 possible 9-mers, so most occur several times by chance. The genome size still comes out right (Σ n·h(n) / depth counts positions), but the genome looks highly repetitive. Raise k to 13 and the fake repeats vanish.', p: { G: 2, ploidy: 1, het: 0, rep: 0, copies: 2, div: 0, cov: 30, L: 1, err: 0.3, k: 9 } }
];
const KM_G = [50000, 100000, 200000, 500000, 1000000];
const KM_L = [50, 100, 150, 250];

class KmerApp {
    constructor() {
        this.K = KmerEngine; this.V = KmerViews;
        this.$ = id => document.getElementById(id);
        this.cache = new Map();
        this.step = 1;
        this.s = { miniPos: 10, cov2: 30, pick: null, err4: 1, cut4: null, truth4: true, het5: 1, pick5: null, rep6: 30, copies6: 4, div6: 0, y6: 'distinct', truth6: true, fitTruth7: false };
        this.lab = { p: Object.assign({}, KM_PRESETS[1].p), preset: 1, seed: 1, truth: false, ymode: 'distinct', model: true, xmax: 'auto', pick: null, overlay: null };
        this.quiz = new KmerQuiz(this);

        document.querySelectorAll('.bl-tab').forEach(b => b.addEventListener('click', () => this.showTab(b.dataset.tab)));
        document.querySelectorAll('#km-steps .bl-step').forEach(b => b.addEventListener('click', () => this.showStep(+b.dataset.step)));
        this.$('step-prev').addEventListener('click', () => this.showStep(this.step - 1));
        this.$('step-next').addEventListener('click', () => this.showStep(this.step + 1));
        this.$('step-content').addEventListener('click', e => this.onStepClick(e));
        this.$('step-content').addEventListener('input', e => this.onStepInput(e));
        this.$('step-content').addEventListener('change', e => this.onStepInput(e));
        this.bindLab();
        const m = /^#(principle|lab|quiz)(?:-(\d))?$/.exec(location.hash);
        if (m && m[2]) this.step = +m[2];
        this.showTab(m ? m[1] : 'principle');
    }

    // ------------------------------------------------------------ data
    run(p) {
        const full = Object.assign({ G: 100000, ploidy: 1, het: 0, repeatFraction: 0, repeatCopies: 2, repeatLength: 1000, repeatDivergence: 0, seed: 1, coverage: 30, readLength: 100, errorRate: 0, k: 21 }, p);
        const key = JSON.stringify(full);
        if (!this.cache.has(key)) {
            if (this.cache.size > 24) this.cache.delete(this.cache.keys().next().value);
            this.cache.set(key, this.K.run(full, { keepReads: full.G < 1000 }));
        }
        return this.cache.get(key);
    }
    fit(R, cutoff) { return this.K.fitModel(R.hist.h, { ploidy: R.p.ploidy, k: R.p.k, cutoff: cutoff || R.cutoff, total: R.hist.total }); }
    xmaxFor(R, mult = 3.2) { return Math.min(R.hist.maxCount, Math.max(20, Math.ceil(R.depthHom * mult))); }
    fmt(n) { return Math.round(n).toLocaleString(); }
    pct(x, d = 2) { return (100 * x).toFixed(d) + ' %'; }
    lesson(html) { return `<div class="bl-lesson">${html}</div>`; }
    // mean depth of the single-copy peak: Σ n·h(n) / Σ h(n) from the cut-off to 1.5 × the peak
    peakMean(h, cut, peak) { let a = 0, b = 0; for (let n = cut; n < 1.5 * peak; n++) { a += n * h[n]; b += h[n]; } return a / b; }
    presentCopies(R) { return R.hist.byCopy ? R.hist.byCopy.map(a => a.some(v => v > 0)) : null; }

    // ------------------------------------------------------------ tabs & steps
    showTab(tab) {
        this.tab = tab;
        document.querySelectorAll('.bl-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        for (const t of ['principle', 'lab', 'quiz']) this.$('tab-' + t).hidden = t !== tab;
        document.querySelectorAll('.side-panel [data-for]').forEach(s => { s.hidden = s.dataset.for !== tab; });
        if (tab === 'principle') this.showStep(this.step);
        else if (tab === 'lab') { this.syncLabControls(); this.runLab(); history.replaceState(null, '', '#lab'); }
        else { this.quiz.ensure(); history.replaceState(null, '', '#quiz'); }
    }

    showStep(n) {
        this.step = Math.max(1, Math.min(7, n));
        document.querySelectorAll('#km-steps .bl-step').forEach(b => b.classList.toggle('active', +b.dataset.step === this.step));
        this.$('step-prev').disabled = this.step === 1; this.$('step-next').disabled = this.step === 7;
        history.replaceState(null, '', '#principle-' + this.step);
        const box = this.$('step-content');
        box.innerHTML = '<p class="hm-busy">Simulating the genome and counting k-mers…</p>';
        setTimeout(() => { box.innerHTML = this['step' + this.step](); }, 10);
    }
    rerender() { this.$('step-content').innerHTML = this['step' + this.step](); }

    // ---- step 1: counting k-mers on a tiny genome
    step1() {
        const R = this.run({ G: 48, ploidy: 1, coverage: 6, readLength: 12, k: 5, seed: 7 });
        const g = this.K.decode(R.genome.haps[0]), k = R.p.k, L = R.counts.L;
        const pos = Math.max(0, Math.min(g.length - k, this.s.miniPos));
        const kmer = g.substr(pos, k);
        const reads = R.counts.reads.slice().sort((a, b) => a.start - b.start);
        const ends = [], rows = [];
        for (const r of reads) { let row = ends.findIndex(e => e < r.start); if (row < 0) { row = ends.length; ends.push(-1); } ends[row] = r.start + L; rows.push(row); }
        const containing = reads.filter(r => r.start <= pos && pos + k <= r.start + L);
        const cell = (c, cls) => `<span class="km-c ${cls}">${c}</span>`;
        let grid = `<div class="km-row"><span class="km-lab">genome</span>${g.split('').map((c, i) => cell(c, i >= pos && i < pos + k ? 'km-hl' : '')).join('')}</div>`;
        for (let row = 0; row < ends.length; row++) {
            let line = '';
            let x = 0;
            reads.forEach((r, i) => {
                if (rows[i] !== row) return;
                while (x < r.start) { line += cell('', ''); x++; }
                const has = containing.includes(r);
                const seqG = g.substr(r.start, L);
                for (let j = 0; j < L; j++) { line += cell(seqG[j], (has && r.start + j >= pos && r.start + j < pos + k ? 'km-hl' : '') + (has ? ' km-in' : ' km-read')); x++; }
            });
            grid += `<div class="km-row"><span class="km-lab">${row === 0 ? 'reads' : ''}</span>${line}</div>`;
        }
        const code = this.K.encode(kmer); let canon = null;
        this.K.forEachKmer(code, k, k, c => { canon = c; });
        const count = R.counts.table.get(canon);
        // all k-mers with their counts, in genome order
        const seen = new Set(), chips = [];
        for (let i = 0; i + k <= g.length; i++) {
            const km = g.substr(i, k), c = this.K.canonicalString(km);
            if (seen.has(c)) continue; seen.add(c);
            const cc = this.K.encode(km); let cv; this.K.forEachKmer(cc, k, k, x => { cv = x; });
            chips.push(`<span class="bl-chip ${i === pos ? 'sel' : ''}" data-pos="${i}">${km}<small>${R.counts.table.get(cv)}×</small></span>`);
        }
        const Ck = R.p.coverage * (L - k + 1) / L;
        const xmax = Math.max(10, ...Array.from(R.hist.h).map((v, n) => v ? n : 0)) + 1;
        return `<h3>Step 1 – Counting k-mers</h3>
            <p>Sequencing gives us many short <strong>reads</strong> from random places of the genome (here ${R.counts.N} reads of ${L} bp from a ${g.length} bp genome; in reality millions of reads from a genome we do not know). We cut every read into all its overlapping <strong>k-mers</strong> (here k = ${k}) and count how many times each distinct k-mer occurs – nothing else. This is what <code>jellyfish count</code> does.</p>
            <div class="dp-answer-row"><label for="mini-pos">k-mer at genome position</label><input type="range" id="mini-pos" min="0" max="${g.length - k}" value="${pos}" data-s="miniPos" style="flex:1"><strong>${pos + 1}</strong></div>
            <div class="km-grid">${grid}</div>
            <p>The k-mer <code class="km-code">${kmer}</code> lies completely inside <strong>${containing.length}</strong> of the reads (highlighted), so it is counted <strong>${count}×</strong>${count !== containing.length ? ' (its reverse complement also occurs somewhere, and both are counted as one canonical k-mer)' : ''}. Move the slider or click a k-mer below: the counts differ – reads start at random places, so some stretches happen to be covered by more reads than others – but they scatter around one typical value, calculated below.</p>
            <h4>All k-mers of the genome and their counts</h4>
            <div class="bl-chips">${chips.join('')}</div>
            <div class="bl-two"><div>${this.V.histogram({ h: R.hist.h, xmax, width: 380, height: 210 })}</div>
            <div><p><strong>How many times should a k-mer be seen?</strong> A read contains a given k-mer only if it starts in one of the L − k + 1 positions that leave the whole k-mer inside the read. With coverage C = N·L/G = ${R.p.coverage}:</p>
            <p class="hm-formula">C<sub>k</sub> = C · (L − k + 1) / L = ${R.p.coverage} × ${L - k + 1} / ${L} = ${Ck.toFixed(1)}</p>
            <p>The histogram on the left counts <em>how many different k-mers</em> were seen n times. That is the k-mer spectrum.</p></div></div>
            ${this.lesson(`<strong>Reads come from both strands.</strong> A k-mer read on the reverse strand appears as its reverse complement; counting a k-mer and its reverse complement as one (<em>canonical</em> k-mers, <code>jellyfish count -C</code>) makes the count independent of the strand. With a real genome the same logic holds with millions of k-mers – step 2.`)}`;
    }

    // ---- step 2: the histogram
    step2() {
        const R = this.run({ G: 100000, ploidy: 1, coverage: this.s.cov2, readLength: 100, k: 21, seed: 2 });
        const Ck = R.depthHom, xmax = this.xmaxFor(R, 2.2);
        const pois = n => R.genome.G * Math.exp(this.K.logPois(n, Ck));
        const peak = this.K.peakAbove(R.hist.h, 3);
        return `<h3>Step 2 – The k-mer spectrum</h3>
            <p>The same counting for a genome of ${this.fmt(R.genome.G)} bp sequenced to ${R.p.coverage}× with ${R.counts.L} bp reads, k = 21: ${this.fmt(R.counts.kmerTotal)} k-mers in the reads, ${this.fmt(R.hist.distinct)} distinct. Coverage: <select data-s="cov2">${[10, 20, 30, 60].map(c => `<option ${c === this.s.cov2 ? 'selected' : ''}>${c}</option>`).join('')}</select>×</p>
            <div class="km-hist-wrap">${this.V.histogram({ h: R.hist.h, xmax, curve: pois, curveFrom: 1, markers: [{ x: Ck, label: `C_k = ${Ck.toFixed(1)}`, color: '#16a34a' }] })}</div>
            <p>Almost every k-mer of the genome occurs once in it, and each is seen about C<sub>k</sub> = ${R.p.coverage} × ${R.counts.L - 20} / ${R.counts.L} = <strong>${Ck.toFixed(1)}</strong> times – the peak is at ${peak}. It is not a single bar because reads start at random places: the count of a k-mer follows a <strong>Poisson distribution</strong> with mean C<sub>k</sub> (black line: G·Poisson(n; C<sub>k</sub>)), so the spread grows with depth (standard deviation √C<sub>k</sub>).</p>
            ${this.lesson(`<strong>Why k = 21?</strong> There are 4<sup>21</sup> ≈ 4.4 × 10<sup>12</sup> possible 21-mers – far more than the positions in any genome, so a random 21-mer occurs in the genome at most once by chance. Every k-mer of the genome then stands for one position: count the positions, and you have the genome size (step 3). With k too small (lab preset "k too small") random k-mers repeat and the method breaks down. Change the coverage and watch the peak move.`)}`;
    }

    // ---- step 3: genome size
    step3() {
        const R = this.run({ G: 100000, ploidy: 1, coverage: 30, readLength: 100, k: 21, seed: 2 });
        const h = R.hist.h, total = this.K.totalAbove(h, 1), xmax = this.xmaxFor(R, 2.2);
        const pick = this.s.pick;
        const markers = pick ? [{ x: pick, label: `your peak: ${pick}×`, color: '#dc2626' }] : [];
        const est = pick ? total / pick : null;
        return `<h3>Step 3 – Genome size from the peak</h3>
            <p>If every position of the genome produces one k-mer, and each of those k-mers is seen C<sub>k</sub> times, then</p>
            <p class="hm-formula">total number of k-mers in the reads = G × C<sub>k</sub> &nbsp;&nbsp;⇒&nbsp;&nbsp; G = Σ<sub>n</sub> n·h(n) / C<sub>k</sub></p>
            <p>The total is simply the histogram weighted by the count: Σ n·h(n) = <strong>${this.fmt(total)}</strong>. We do not need to know the coverage – the position of the peak <em>is</em> C<sub>k</sub>. <strong>Click the bar you take for the peak.</strong></p>
            <div class="km-hist-wrap">${this.V.histogram({ h, xmax, clickable: true, markers })}</div>
            ${pick ? `<table class="bl-table hm-narrow"><tr><td>Σ n·h(n)</td><td>${this.fmt(total)}</td></tr><tr><td>peak depth (your choice)</td><td>${pick}</td></tr>
                <tr><td>estimated genome size</td><td><strong>${this.fmt(est)} bp</strong></td></tr><tr><td>true genome size</td><td>${this.fmt(R.genome.G)} bp (${est > R.genome.G ? '+' : ''}${this.pct(est / R.genome.G - 1, 1)})</td></tr></table>
                <p>${Math.abs(est / R.genome.G - 1) < 0.05 ? 'Within a few percent.' : 'Try the highest bar of the peak.'} A single bar is a noisy measure of the depth: the tallest bar jumps around by chance. Better is the <strong>mean of the peak</strong>, Σ n·h(n) / Σ h(n) over the peak = ${this.peakMean(h, 2, this.K.peakAbove(h, 3)).toFixed(2)}, giving <strong>${this.fmt(total / this.peakMean(h, 2, this.K.peakAbove(h, 3)))} bp</strong>. The model of step 7 uses the whole shape of the peak in the same spirit.</p>` : ''}
            ${this.lesson(`<strong>Nothing else is needed:</strong> no assembly, no reference genome, not even the coverage. Before assembling a new genome, this tells you how big it is and how much sequencing you need – and (steps 4–6) whether it will be hard: many errors, heterozygous, repetitive.`)}`;
    }

    // ---- step 4: errors
    step4() {
        const R = this.run({ G: 100000, ploidy: 1, coverage: 30, readLength: 100, k: 21, seed: 2, errorRate: this.s.err4 / 100 });
        const h = R.hist.h, k = R.p.k;
        const cut = this.s.cut4 || R.cutoff;
        const peak = this.K.peakAbove(h, cut);
        const mean = this.peakMean(h, cut, peak);
        const all = this.K.totalAbove(h, 1) / mean, kept = this.K.totalAbove(h, cut) / mean;
        let errDistinct = 0; for (let n = 1; n <= R.hist.maxCount; n++) errDistinct += R.hist.byCopy[0][n];
        const eEst = this.K.errorRate(h, cut, k, R.hist.total);
        const exp = R.counts.errors;
        return `<h3>Step 4 – Sequencing errors</h3>
            <p>A wrong base in a read changes every k-mer that covers it: up to <strong>k = ${k} wrong k-mers per error</strong>. Such a k-mer almost never occurs in the genome and is seen once, rarely twice – so errors pile up at the very left of the spectrum. Error rate: <select data-s="err4">${[0.2, 0.5, 1, 2].map(c => `<option value="${c}" ${c === this.s.err4 ? 'selected' : ''}>${c} %</option>`).join('')}</select> <label class="ms-check km-inline"><input type="checkbox" data-s="truth4" ${this.s.truth4 ? 'checked' : ''}> colour by true origin</label></p>
            <div class="km-hist-wrap">${this.V.histogram({ h, byCopy: R.hist.byCopy, ploidy: 1, colorTruth: this.s.truth4, xmax: this.xmaxFor(R, 2.2), cutoff: cut, markers: [{ x: peak, label: `peak ${peak}×`, color: '#16a34a' }] })}</div>
            ${this.s.truth4 ? this.V.legend(1, this.presentCopies(R)) : ''}
            <div class="dp-answer-row"><label for="cut4">cut-off: ignore k-mers seen fewer than</label><input type="range" id="cut4" min="1" max="${Math.max(8, Math.ceil(peak / 2))}" value="${cut}" data-s="cut4" style="flex:1"><strong>${cut}×</strong> <span class="dp-hint">(automatic: the valley at ${R.cutoff}×)</span></div>
            <table class="bl-table hm-narrow">
                <tr><td>errors in the reads</td><td>${this.fmt(exp)} (${this.pct(exp / (R.counts.N * R.counts.L))} of bases)</td></tr>
                <tr><td>distinct k-mers created by errors</td><td>${this.fmt(errDistinct)} – ${(errDistinct / R.genome.G).toFixed(2)}× as many as the genome has positions</td></tr>
                <tr><td>depth: tallest bar / mean of the peak</td><td>${peak}× / ${mean.toFixed(2)}× (the mean is used below)</td></tr>
                <tr><td>genome size with all k-mers</td><td>${this.fmt(all)} bp (${this.pct(all / R.genome.G - 1, 1)})</td></tr>
                <tr><td>genome size ignoring k-mers below the cut-off</td><td><strong>${this.fmt(kept)} bp</strong> (${this.pct(kept / R.genome.G - 1, 1)}; true ${this.fmt(R.genome.G)})</td></tr>
                <tr><td>error rate estimated from the k-mers below the cut-off</td><td>${this.pct(eEst)} (true ${this.pct(this.s.err4 / 100)})</td></tr>
            </table>
            <p>Error k-mers inflate the total, so the cut-off matters. The error rate itself can be read off the spectrum: the k-mer occurrences below the cut-off are ≈ k × (number of errors), so e ≈ Σ<sub>n&lt;cut</sub> n·h(n) / (k · total).</p>
            ${this.lesson(`<strong>The valley.</strong> The natural cut-off is the minimum between the error spike and the genomic peak. At low coverage the genomic peak moves left and the two overlap (lab preset "Low coverage") – then no cut-off separates them cleanly. Real data also have errors that are not random (e.g. systematic ones at particular sequence contexts) which can form a shoulder instead of a clean spike.`)}`;
    }

    // ---- step 5: heterozygosity
    step5() {
        const R = this.run({ G: 100000, ploidy: 2, het: this.s.het5 / 100, coverage: 40, readLength: 100, k: 21, seed: 5, errorRate: 0.005 });
        // the observed depth: errors destroy some k-mers, so the peaks sit a little below C_k (fitted λ, see step 7)
        const h = R.hist.h, k = R.p.k, cut = R.cutoff, lam = this.fit(R).lambda;
        const total = this.K.totalAbove(h, cut);
        const F = this.fit(R), N1 = F.Nj[0], N2 = F.Nj[1];                  // areas of the two fitted peaks
        const q = N2 / (N2 + N1 / 2), r = 1 - Math.pow(q, 1 / k);
        const pick = this.s.pick5;
        const peakHet = this.K.peakAbove(h, cut, Math.floor(1.5 * lam)), peakHom = this.K.peakAbove(h, Math.ceil(1.5 * lam), Math.floor(2.5 * lam));
        return `<h3>Step 5 – Heterozygosity: two peaks</h3>
            <p>A diploid genome has two copies of every chromosome. Where both copies are identical, a k-mer is seen from both: depth 2λ. Around a <strong>heterozygous site</strong> (a SNP between the two copies), each of the k windows that contain the SNP gives two different k-mers – one per allele – and each is seen from one copy only: depth λ.</p>
            <div class="hm-diagram-wrap">${this.V.snpDiagram(5)}</div>
            <p class="dp-hint">Here the heterozygous peak is at λ ≈ ${lam.toFixed(1)} and the homozygous one at 2λ ≈ ${(2 * lam).toFixed(1)} – a little below the error-free values ${R.lambda.toFixed(1)} and ${(2 * R.lambda).toFixed(1)}, because 0.5 % sequencing errors destroy about ${this.pct(1 - Math.pow(0.995, k), 0)} of the k-mers.</p>
            <p>Heterozygosity: <select data-s="het5">${[0.2, 0.5, 1, 2, 3].map(c => `<option value="${c}" ${c === this.s.het5 ? 'selected' : ''}>${c} % (1 SNP per ${Math.round(100 / c)} bp)</option>`).join('')}</select> <span class="dp-hint">– ${this.fmt(R.genome.G)} bp diploid genome, 40× coverage, k = 21.</span></p>
            <div class="km-hist-wrap">${this.V.histogram({ h, byCopy: R.hist.byCopy, ploidy: 2, colorTruth: true, xmax: this.xmaxFor(R, 2), cutoff: cut, clickable: true, markers: [{ x: lam, label: `λ ≈ ${lam.toFixed(0)}: heterozygous`, color: '#0284c7' }, { x: 2 * lam, label: `2λ ≈ ${(2 * lam).toFixed(0)}: homozygous`, color: '#4338ca' }].concat(pick ? [{ x: pick, label: `your peak ${pick}×`, color: '#dc2626' }] : []) })}</div>
            ${this.V.legend(2, this.presentCopies(R))}
            <p><strong>Which peak gives the genome size?</strong> Click it. Σ n·h(n) above the cut-off = ${this.fmt(total)}.
            ${pick ? `Dividing by ${pick}: <strong>${this.fmt(total / pick)} bp</strong> (true haploid size ${this.fmt(R.genome.G)}). ${Math.abs(total / pick / R.genome.G - 1) < 0.1 ? 'Right: the homozygous peak is the depth of <em>one position of the haploid genome</em> read from both copies.' : total / pick > 1.5 * R.genome.G ? 'Twice too large: the heterozygous peak is the depth of one <em>allele</em>. Dividing by it counts both copies of the genome.' : 'Pick one of the two peaks.'}` : ''}</p>
            <h4>Heterozygosity from the two peaks</h4>
            <p>A stretch of k bases without a SNP gives one k-mer seen at 2λ; with a SNP it gives two k-mers seen at λ. With r = SNPs per base, a k-mer window is SNP-free with probability (1 − r)<sup>k</sup>, so the numbers of distinct k-mers in the two peaks are N<sub>hom</sub> ≈ G·(1 − r)<sup>k</sup> and N<sub>het</sub> ≈ 2·G·(1 − (1 − r)<sup>k</sup>):</p>
            <p class="hm-formula">(1 − r)<sup>k</sup> = N<sub>hom</sub> / (N<sub>hom</sub> + N<sub>het</sub>/2) &nbsp;⇒&nbsp; r = 1 − (${this.fmt(N2)} / (${this.fmt(N2)} + ${this.fmt(N1)}/2))<sup>1/${k}</sup> = <strong>${this.pct(r)}</strong> <span class="dp-hint">(true ${this.pct(R.genome.truth.het)})</span></p>
            <p class="dp-hint">N<sub>het</sub> = ${this.fmt(N1)} and N<sub>hom</sub> = ${this.fmt(N2)} are the areas under the two peaks. The peaks overlap (the left tail of the homozygous peak reaches below 1.5λ), so simply cutting the histogram between them would count part of the homozygous k-mers as heterozygous; the areas are taken from two Poisson curves fitted to the peaks – the model of step 7.</p>
            ${this.lesson(`<strong>The trap:</strong> at ${this.s.het5 >= 2 ? 'this' : 'high'} heterozygosity the heterozygous peak (${this.fmt(h[peakHet])} k-mers at ${peakHet}×) can be ${h[peakHet] > h[peakHom] ? '<strong>higher</strong>' : 'nearly as high as'} the homozygous one (${this.fmt(h[peakHom])} at ${peakHom}×): the tallest peak is not always the right one. Try 3 %. Knowing the ploidy – and that the two peaks must be at depths in ratio 1 : 2 – resolves it. A haploid genome, or a fully homozygous diploid one, has a single peak.`)}`;
    }

    // ---- step 6: repeats
    step6() {
        const R = this.run({ G: 100000, ploidy: 1, repeatFraction: this.s.rep6 / 100, repeatCopies: this.s.copies6, repeatLength: 800, repeatDivergence: this.s.div6 / 100, coverage: 30, readLength: 100, k: 21, seed: 6, errorRate: 0.003 });
        const h = R.hist.h, cut = R.cutoff, Ck = this.peakMean(h, cut, this.K.peakAbove(h, cut, Math.ceil(R.depthHom * 1.4)));   // mean depth of the single-copy peak
        const all = this.K.totalAbove(h, cut);
        let single = 0; for (let n = cut; n < 1.5 * Ck; n++) single += n * h[n];
        const repFrac = 1 - single / all;
        const xmax = Math.min(R.hist.maxCount, Math.ceil(Ck * this.s.copies6 + 4.5 * Math.sqrt(Ck * this.s.copies6) + 3));
        const markers = [{ x: Ck, label: `1 copy: ${Ck.toFixed(1)}×`, color: '#0284c7' }, { x: Ck * this.s.copies6, label: `${this.s.copies6} copies: ${(Ck * this.s.copies6).toFixed(0)}×`, color: '#d97706' }];
        return `<h3>Step 6 – Repeats</h3>
            <p>A sequence present in c copies produces the same k-mers c times, so they are counted c times more often: a peak at c·C<sub>k</sub>. Each such distinct k-mer stands for c positions of the genome – which is exactly what Σ n·h(n) / C<sub>k</sub> counts correctly, <em>as long as the high-count k-mers are included</em>.</p>
            <p>Repeat content <select data-s="rep6">${[10, 30, 50].map(c => `<option ${c === this.s.rep6 ? 'selected' : ''}>${c}</option>`).join('')}</select> %, copies per family <select data-s="copies6">${[2, 4, 10].map(c => `<option ${c === this.s.copies6 ? 'selected' : ''}>${c}</option>`).join('')}</select>, divergence between copies <select data-s="div6">${[0, 2, 5].map(c => `<option ${c === this.s.div6 ? 'selected' : ''}>${c}</option>`).join('')}</select> % · y axis <select data-s="y6" data-str="1">${[['distinct', 'distinct k-mers h(n)'], ['log', 'h(n), log scale'], ['share', 'k-mer occurrences n·h(n)']].map(([v, t]) => `<option value="${v}" ${v === this.s.y6 ? 'selected' : ''}>${t}</option>`).join('')}</select></p>
            <div class="km-hist-wrap">${this.V.histogram({ h, byCopy: R.hist.byCopy, ploidy: 1, colorTruth: true, yMode: this.s.y6, xmax, cutoff: cut, markers })}</div>
            ${this.V.legend(1, this.presentCopies(R))}
            <p><strong>Why is the repeat peak so low?</strong> The histogram counts <em>distinct</em> k-mers. ${this.s.rep6} % of the genome in ${this.s.copies6}-copy families is only ${this.s.rep6}/${this.s.copies6} = ${(this.s.rep6 / this.s.copies6).toFixed(1)} % of the distinct k-mers – and their peak at ${this.s.copies6}·C<sub>k</sub> is √${this.s.copies6} ≈ ${Math.sqrt(this.s.copies6).toFixed(1)} times wider (Poisson spread √n). ${this.s.y6 !== 'share' ? '<strong>Switch the y axis to n·h(n)</strong>:' : 'With the y axis n·h(n)'} every bar is multiplied by its count, so the area of each peak becomes the number of k-mer occurrences – proportional to the number of genome positions it stands for. Now the repeat peak shows its real weight. (GenomeScope 2 calls this the "transformed" plot.)</p>
            <table class="bl-table hm-narrow">
                <tr><td>genome size, all k-mers above the cut-off</td><td><strong>${this.fmt(all / Ck)} bp</strong> (true ${this.fmt(R.genome.G)})</td></tr>
                <tr><td>genome size from the single-copy peak only (&lt; 1.5 C<sub>k</sub>)</td><td>${this.fmt(single / Ck)} bp – the repeats are missing</td></tr>
                <tr><td>repeat content from the spectrum (k-mer occurrences above 1.5 C<sub>k</sub>)</td><td><strong>${this.pct(repFrac, 1)}</strong> (true ${this.pct(R.genome.truth.repeatFraction, 1)})</td></tr>
            </table>
            ${this.lesson(`<strong>Two practical consequences.</strong> (1) Highly repetitive genomes have k-mers seen thousands of times; tools that stop the histogram at some maximum count (<code>jellyfish histo</code> stops at 10 000 by default) lose them and <em>underestimate</em> the genome size. (2) <strong>Diverged repeats look unique:</strong> set the divergence to 5 % – with one difference every 20 bp most 21-mers differ between copies, the repeat peaks shrink and the repeat content is underestimated. The spectrum sees only recent, near-identical repeats – the same repeats that also break assemblies.`)}`;
    }

    // ---- step 7: the model
    step7() {
        const R = this.run({ G: 200000, ploidy: 2, het: 0.012, repeatFraction: 0.25, repeatCopies: 3, repeatLength: 1000, coverage: 40, readLength: 150, k: 21, seed: 11, errorRate: 0.005 });
        const f = this.fit(R), T = R.genome.truth, h = R.hist.h;
        const eEst = this.K.errorRate(h, R.cutoff, R.p.k, R.hist.total);
        return `<h3>Step 7 – Fitting a model: everything at once</h3>
            <p>Real spectra combine all of the above: errors, a heterozygous and a homozygous peak, repeat peaks, all overlapping. Instead of reading peaks by eye, programs such as <strong>GenomeScope</strong> fit a model: the spectrum above the error cut-off is a sum of peaks at λ, 2λ, 3λ, … – one for k-mers present in 1, 2, 3, … copies across the two haplotypes – each with the Poisson-like shape of step 2. The fit finds λ and the size of every peak; the rest is the arithmetic of steps 3–6.</p>
            <div class="km-hist-wrap">${this.V.histogram({ h, byCopy: R.hist.byCopy, ploidy: 2, colorTruth: this.s.fitTruth7, xmax: this.xmaxFor(R, 3.8), cutoff: R.cutoff, curve: f.curve, components: f.w.map((w, j) => n => f.component(j, n)).filter((_, j) => f.w[j] > 0.003), curveFrom: R.cutoff })}</div>
            <p><label class="ms-check km-inline"><input type="checkbox" data-s="fitTruth7" ${this.s.fitTruth7 ? 'checked' : ''}> colour the bars by true origin</label> <span class="dp-hint">Black: the fitted model; dashed: its components (1, 2, 3, … copies).</span></p>
            ${this.s.fitTruth7 ? this.V.legend(2, this.presentCopies(R)) : ''}
            <table class="bl-table"><thead><tr><th></th><th>from the model</th><th>true</th><th>how</th></tr></thead><tbody>
                <tr><td>k-mer depth of one copy λ</td><td>${f.lambda.toFixed(1)}</td><td>${R.lambda.toFixed(1)} <span class="dp-hint">(slightly less with errors: a k-mer with an error is lost)</span></td><td>position of the peaks</td></tr>
                <tr><td>haploid genome size</td><td><strong>${this.fmt(f.G)} bp</strong></td><td>${this.fmt(T.G)} bp</td><td>Σ copies × k-mers in each peak / 2</td></tr>
                <tr><td>heterozygosity</td><td><strong>${this.pct(f.het)}</strong></td><td>${this.pct(T.het)}</td><td>1-copy vs 2-copy peak (step 5)</td></tr>
                <tr><td>repeat content</td><td><strong>${this.pct(f.repeatFraction, 1)}</strong></td><td>${this.pct(T.repeatFraction, 1)}</td><td>peaks with more than 2 copies</td></tr>
                <tr><td>sequencing error rate</td><td>${this.pct(eEst)}</td><td>${this.pct(R.p.errorRate)}</td><td>k-mers below the cut-off (step 4)</td></tr>
            </tbody></table>
            <h4>The same analysis on real reads</h4>
<pre class="hm-cmd"># count canonical 21-mers in the reads (-C: a k-mer and its reverse complement are one)
jellyfish count -C -m 21 -s 1G -t 8 -o reads.jf reads_1.fastq reads_2.fastq
# the histogram: two columns, n and h(n)
jellyfish histo -h 1000000 reads.jf > reads.histo
# fit the model (web version at genomescope.org, or the R script); -p 2 = diploid
genomescope2 -i reads.histo -o genomescope_out -k 21 -p 2</pre>
            ${this.lesson(`<strong>What the model needs from you:</strong> the ploidy (a homozygous diploid genome and a haploid genome give identical spectra) and a sensible k. What it cannot see: repeats that are diverged (step 6), and anything not in the reads (contamination, organelles and bacteria inflate the counts). GenomeScope reports exactly these numbers – genome size, heterozygosity, repeat content ("unique length" vs "repeat length"), error rate – and its plot looks like this one. Continue to the lab and break the model.`)}`;
    }

    onStepClick(e) {
        const bin = e.target.closest('[data-n]');
        if (bin) { if (this.step === 3) this.s.pick = +bin.dataset.n; if (this.step === 5) this.s.pick5 = +bin.dataset.n; this.rerender(); return; }
        const chip = e.target.closest('[data-pos]');
        if (chip) { this.s.miniPos = +chip.dataset.pos; this.rerender(); }
    }
    onStepInput(e) {
        const t = e.target, key = t.dataset.s;
        if (!key) return;
        if (t.type === 'checkbox') { if (e.type !== 'change') return; this.s[key] = t.checked; }
        else if (t.type === 'range') { if (e.type !== 'input') return; this.s[key] = +t.value; }
        else { if (e.type !== 'change') return; this.s[key] = t.dataset.str ? t.value : +t.value; }
        if (key === 'err4') this.s.cut4 = null;
        if (key === 'het5') this.s.pick5 = null;
        this.rerender();
    }

    // ------------------------------------------------------------ lab
    bindLab() {
        const sel = this.$('lab-preset');
        KM_PRESETS.forEach((pr, i) => sel.add(new Option(pr.name, i)));
        sel.addEventListener('change', () => { this.lab.preset = +sel.value; this.lab.p = Object.assign({}, KM_PRESETS[this.lab.preset].p); this.lab.pick = null; this.lab.overlay = null; if (KM_PRESETS[this.lab.preset].ymode) this.lab.ymode = KM_PRESETS[this.lab.preset].ymode; this.syncLabControls(); this.runLab(); });
        this.$('lab-reroll').addEventListener('click', () => { this.lab.seed++; this.lab.overlay = null; this.runLab(); });
        const bind = (id, key) => this.$(id).addEventListener('input', () => { this.lab.p[key] = +this.$(id).value; this.lab.pick = null; this.lab.overlay = null; this.syncLabControls(); this.runLabSoon(); });
        bind('p-G', 'G'); bind('p-het', 'het'); bind('p-rep', 'rep'); bind('p-copies', 'copies'); bind('p-div', 'div'); bind('p-cov', 'cov'); bind('p-L', 'L'); bind('p-err', 'err'); bind('p-k', 'k');
        document.querySelectorAll('input[name="p-ploidy"]').forEach(r => r.addEventListener('change', () => { this.lab.p.ploidy = +r.value; this.lab.pick = null; this.syncLabControls(); this.runLab(); }));
        for (const [id, key] of [['lab-truth', 'truth'], ['lab-model', 'model']]) this.$(id).addEventListener('change', () => { this.lab[key] = this.$(id).checked; this.drawLab(); });
        this.$('lab-ymode').addEventListener('change', () => { this.lab.ymode = this.$('lab-ymode').value; this.drawLab(); });
        this.$('lab-xmax').addEventListener('change', () => { this.lab.xmax = this.$('lab-xmax').value; this.drawLab(); });
        this.$('lab-hist').addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (b) { this.lab.pick = +b.dataset.n; this.drawLab(); } });
        this.$('lab-compare-k').addEventListener('click', () => this.compareK());
    }

    labParams() {
        const p = this.lab.p;
        return { G: KM_G[p.G], ploidy: p.ploidy, het: p.ploidy === 2 ? p.het / 100 : 0, repeatFraction: p.rep / 100, repeatCopies: p.copies, repeatLength: 1000, repeatDivergence: p.div / 100,
                 coverage: p.cov, readLength: KM_L[p.L], errorRate: p.err / 100, k: p.k, seed: 100 + this.lab.seed };
    }

    syncLabControls() {
        const p = this.lab.p;
        this.$('lab-preset').value = this.lab.preset;
        this.$('lab-preset-note').textContent = KM_PRESETS[this.lab.preset].note;
        const set = (id, v, txt) => { this.$(id).value = v; this.$(id + '-value').textContent = txt; };
        set('p-G', p.G, KM_G[p.G] >= 1e6 ? '1 Mbp' : KM_G[p.G] / 1000 + ' kbp');
        set('p-het', p.het, p.ploidy === 2 ? p.het.toFixed(1) + ' %' : '– (haploid)');
        set('p-rep', p.rep, p.rep + ' %'); set('p-copies', p.copies, p.copies); set('p-div', p.div, p.div + ' %');
        set('p-cov', p.cov, p.cov + '×'); set('p-L', p.L, KM_L[p.L] + ' bp'); set('p-err', p.err, p.err.toFixed(1) + ' %'); set('p-k', p.k, p.k);
        this.$('p-het').disabled = p.ploidy !== 2;
        document.querySelectorAll('input[name="p-ploidy"]').forEach(r => { r.checked = +r.value === p.ploidy; });
        this.$('lab-truth').checked = this.lab.truth; this.$('lab-ymode').value = this.lab.ymode; this.$('lab-model').checked = this.lab.model;
    }

    runLabSoon() { clearTimeout(this.labTimer); this.labTimer = setTimeout(() => this.runLab(), 250); }
    runLab() {
        const P = this.labParams();
        const cost = P.G * P.coverage;
        this.$('lab-status').textContent = cost > 2e7 ? `Sequencing ${(cost / 1e6).toFixed(0)} Mbp of reads and counting k-mers…` : '';
        setTimeout(() => {
            const t0 = performance.now();
            this.labR = this.run(P);
            this.labF = this.fit(this.labR);
            this.$('lab-status').textContent = `${this.fmt(this.labR.counts.N)} reads, ${this.fmt(this.labR.counts.kmerTotal)} k-mers, ${this.fmt(this.labR.hist.distinct)} distinct – computed in ${((performance.now() - t0) / 1000).toFixed(1)} s`;
            this.drawLab();
        }, 20);
    }

    drawLab() {
        const R = this.labR, f = this.labF;
        if (!R) return;
        const h = R.hist.h, T = R.genome.truth;
        const lamA = f ? f.lambda : R.lambda, topPeak = lamA * R.p.ploidy * (R.p.repeatFraction > 0 ? R.p.repeatCopies : 1);
        const xmax = this.lab.xmax === 'auto' ? Math.min(R.hist.maxCount, Math.max(25, Math.ceil(Math.max(lamA * 4.8, topPeak + 3.5 * Math.sqrt(topPeak) + lamA)))) : +this.lab.xmax;
        const markers = this.lab.pick ? [{ x: this.lab.pick, label: `your peak ${this.lab.pick}×`, color: '#dc2626' }] : [];
        const overlay = this.lab.overlay ? this.lab.overlay.map(o => ({ h: o.h, color: o.color })) : null;
        this.$('lab-hist').innerHTML = this.V.histogram({ h, byCopy: R.hist.byCopy, ploidy: R.p.ploidy, colorTruth: this.lab.truth, yMode: this.lab.ymode, xmax, cutoff: R.cutoff, clickable: true, markers,
            curve: this.lab.model && f ? f.curve : null, curveFrom: R.cutoff, overlay });
        this.$('lab-legend').innerHTML = (this.lab.truth ? this.V.legend(R.p.ploidy, this.presentCopies(R)) : '') + (overlay ? `<div class="km-legend">${this.lab.overlay.map(o => `<span><i style="background:${o.color}"></i>k = ${o.k}</span>`).join('')}<span class="dp-hint">bars: k = ${R.p.k}</span></div>` : '');
        const total = this.K.totalAbove(h, R.cutoff);
        const pickEst = this.lab.pick ? total / this.lab.pick : null;
        const eEst = this.K.errorRate(h, R.cutoff, R.p.k, R.hist.total);
        const row = (name, est, truth, fmt) => `<tr><td>${name}</td><td><strong>${est === null ? '–' : fmt(est)}</strong></td><td>${fmt(truth)}</td><td class="${est !== null && truth > 0 && Math.abs(est / truth - 1) > 0.1 ? 'dp-red' : ''}">${est === null || !truth ? '' : (est >= truth ? '+' : '') + this.pct(est / truth - 1, 1)}</td></tr>`;
        const bp = x => this.fmt(x) + ' bp', pc = x => this.pct(x);
        this.$('lab-results').innerHTML = `<table class="bl-table"><thead><tr><th></th><th>estimate</th><th>true</th><th>error</th></tr></thead><tbody>
            ${row('genome size – your peak (click a bar): Σ n·h(n) / peak', pickEst, T.G, bp)}
            ${row('genome size – model fit', f ? f.G : null, T.G, bp)}
            ${R.p.ploidy === 2 ? row('heterozygosity – model fit', f ? f.het : null, T.het, pc) : ''}
            ${row('repeat content – model fit', f ? f.repeatFraction : null, T.repeatFraction, x => this.pct(x, 1))}
            ${row('sequencing error rate – below the cut-off', eEst, R.p.errorRate, pc)}
            ${row('k-mer depth of one copy λ (expected: C_k / ploidy · (1 − e)^k)', f ? f.lambda : null, R.lambda * Math.pow(1 - R.p.errorRate, R.p.k), x => x.toFixed(1))}
            </tbody></table>
            <p class="dp-hint">Σ n·h(n) above the cut-off (${R.cutoff}×) = ${this.fmt(total)}. Each error removes up to k correct k-mers, so the expected depth is multiplied by (1 − e)<sup>k</sup>. Red: more than 10 % off – find out why (the side-panel note and tab 1 help).</p>`;
    }

    compareK() {
        const P = this.labParams();
        const colors = { 15: '#0ea5e9', 21: '#16a34a', 25: '#d97706' };
        this.$('lab-status').textContent = 'Counting k-mers for k = 15, 21 and 25…';
        setTimeout(() => {
            this.lab.overlay = [15, 21, 25].filter(k => k !== P.k).map(k => ({ k, h: this.run(Object.assign({}, P, { k })).hist.h, color: colors[k] }));
            this.$('lab-status').textContent = 'Lines: the spectrum for other k. Larger k → fewer k-mers per read → the peak moves left (C_k = C·(L−k+1)/L); smaller k → more chance repeats and a more crowded right tail.';
            this.drawLab();
        }, 20);
    }
}

(function () {
    const start = () => { window.kmerApp = new KmerApp(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
