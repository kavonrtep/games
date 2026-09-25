/**
 * HMM EXPLORER – PART 2: PAIR HMM
 * ===============================
 * Alignment as a path through the pair HMM (states M, X, Y): probability of
 * an alignment (editable), Viterbi = affine-gap alignment with log-odds
 * scores, Forward over all alignments, posterior probabilities of aligned
 * pairs.
 */
class HmmPair {
    constructor(app) {
        this.app = app; this.H = HmmEngine; this.V = HmmViews;
        this.$ = id => document.getElementById(id);
        this.box = this.$('pair-content');
        this.step = 1;
        this.sampled = null;
        const sel = this.$('p-example');
        for (const [key, ex] of Object.entries(HMM_PAIRS)) sel.add(new Option(ex.name, key));
        sel.addEventListener('change', () => this.loadExample(sel.value));
        const slider = (id, fmt) => this.$(id).addEventListener('input', () => { this.$(id + '-value').textContent = fmt(+this.$(id).value); this.recompute(); });
        slider('p-delta', v => v.toFixed(3)); slider('p-epsilon', v => v.toFixed(2)); slider('p-tau', v => v.toFixed(3)); slider('p-pid', v => v.toFixed(2));
        this.$('p-apply').addEventListener('click', () => this.useInputs());
        this.$('p-sample').addEventListener('click', () => { this.sample(); this.showStep(1); });
        this.box.addEventListener('click', e => this.onClick(e));
        this.loadExample('dna-close');
    }

    loadExample(key) {
        const ex = HMM_PAIRS[key];
        this.$('p-example').value = key;
        this.$('p-x').value = ex.x; this.$('p-y').value = ex.y;
        const set = (id, v, d) => { this.$(id).value = v; this.$(id + '-value').textContent = (+v).toFixed(d); };
        set('p-delta', ex.params.delta, 3); set('p-epsilon', ex.params.epsilon, 2); set('p-tau', ex.params.tau, 3);
        if (ex.params.pid) set('p-pid', ex.params.pid, 2);
        this.$('p-note').innerHTML = ex.note;
        this.setSequences(ex.x, ex.y, ex.type);
    }

    useInputs() {
        const x = this.$('p-x').value.toUpperCase().replace(/[^A-Z]/g, ''), y = this.$('p-y').value.toUpperCase().replace(/[^A-Z]/g, '');
        const type = AlignEngine.detectType(x + y) === 'PROTEIN' ? 'PROTEIN' : 'DNA';
        const A = this.H.alphabetFor(type);
        const cx = [...x].filter(c => A.includes(c)).join(''), cy = [...y].filter(c => A.includes(c)).join('');
        if (!cx.length || !cy.length) { this.app.toast('Enter two sequences.'); return; }
        if (cx.length > 60 || cy.length > 60) this.app.toast('Sequences were cut to 60 residues to keep the matrix readable.');
        this.$('p-note').textContent = '';
        this.setSequences(cx.slice(0, 60), cy.slice(0, 60), type);
    }

    setSequences(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.$('p-x').value = x; this.$('p-y').value = y;
        this.$('p-type').textContent = type === 'PROTEIN' ? 'protein' : 'DNA';
        this.$('p-type').className = 'at-badge ' + (type === 'PROTEIN' ? 'protein' : 'dna');
        this.$('p-pid-group').hidden = type === 'PROTEIN';
        this.$('p-emit-note').innerHTML = type === 'PROTEIN'
            ? 'Protein: the pair emissions p(a,b) are the BLOSUM62 target frequencies, q(a) the background frequencies.'
            : 'DNA: p(a,a) = P(identical)/4, p(a,b) = (1 − P(identical))/12, q(a) = 1/4.';
        this.aln = null;
        this.recompute();
    }

    params() { return { type: this.type, delta: +this.$('p-delta').value, epsilon: +this.$('p-epsilon').value, tau: +this.$('p-tau').value, pid: +this.$('p-pid').value }; }

    recompute() {
        const p = this.params();
        if (2 * p.delta + p.tau >= 1 || p.epsilon + p.tau >= 1) { this.app.toast('δ, ε and τ are too large: probabilities out of M or X would be negative.'); return; }
        this.M = this.H.pairModel(p);
        this.vit = this.H.pairViterbi(this.M, this.x, this.y);
        this.post = this.H.pairPosterior(this.M, this.x, this.y);
        if (!this.aln) this.aln = { a1: this.vit.aligned1, a2: this.vit.aligned2 };
        this.showStep(this.step);
    }

    sample() {
        const rng = new this.H.Rng((Math.random() * 1e9) | 0);
        let s;
        for (let t = 0; t < 30; t++) { s = this.H.samplePair(this.M, rng, 40); if (s.x.length >= 6 && s.y.length >= 6) break; }
        this.sampled = s;
    }

    showStep(n) {
        this.step = Math.max(1, Math.min(5, n));
        this.app.setPills('pair', this.step);
        this.box.innerHTML = [null, this.stepModel, this.stepPath, this.stepGotoh, this.stepForward, this.stepPosterior][this.step].call(this);
        if (this.step === 2) this.mountEditor();
    }

    // ------------------------------------------------------------ helpers
    stateRow(a1, a2) {
        const st = this.H.alignmentStates(a1, a2);
        return st.map(s => `<span class="hm-st hm-st-${s}">${s}</span>`).join('');
    }
    alnBlock(a1, a2, extra = '') {
        let mid = '';
        for (let k = 0; k < a1.length; k++) mid += a1[k] === '-' || a2[k] === '-' ? ' ' : a1[k] === a2[k] ? '|' : (this.type === 'PROTEIN' && AlignEngine.BLOSUM62[a1[k]][a2[k]] > 0 ? ':' : '·');
        return `<div class="hm-aln"><div><span class="hm-alnlab">x</span>${this.V.esc(a1)}</div><div><span class="hm-alnlab"></span>${mid}</div><div><span class="hm-alnlab">y</span>${this.V.esc(a2)}</div><div><span class="hm-alnlab">π</span>${this.stateRow(a1, a2)}</div>${extra}</div>`;
    }
    bits(lnp, d = 2) { return this.V.f2(lnp / Math.LN2, d); }

    // ------------------------------------------------------------ step 1
    stepModel() {
        const M = this.M;
        let emit;
        if (this.type === 'DNA') {
            const A = 'ACGT';
            emit = `<table class="hm-emit hm-emit-pair"><tr><th>p(a,b)</th>${[...A].map(b => `<th>${b}</th>`).join('')}<th class="hm-gapcol">q(a)</th></tr>${[...A].map(a => `<tr><th>${a}</th>${[...A].map(b => `<td class="${a === b ? 'hm-diag' : ''}">${M.p[a][b].toFixed(3)}</td>`).join('')}<td class="hm-gapcol">${M.q[a].toFixed(2)}</td></tr>`).join('')}</table>`;
        } else {
            const A = 'WFYLIVAG';
            emit = `<table class="hm-emit hm-emit-pair"><tr><th>p(a,b)</th>${[...A].map(b => `<th>${b}</th>`).join('')}<th class="hm-gapcol">q(a)</th></tr>${[...A].map(a => `<tr><th>${a}</th>${[...A].map(b => `<td class="${a === b ? 'hm-diag' : ''}">${(M.p[a][b] * 1000).toFixed(1)}</td>`).join('')}<td class="hm-gapcol">${M.q[a].toFixed(3)}</td></tr>`).join('')}</table>
                <p class="dp-hint">An excerpt of the 20 × 20 table, values × 1000. They are the BLOSUM62 target frequencies: BLOSUM62 scores are s(a,b) = 2·log<sub>2</sub>[p(a,b) / q(a)q(b)], so p(a,b) = q(a)q(b)·2<sup>s/2</sup>.</p>`;
        }
        const s = this.sampled;
        return `<h3>One model, two sequences</h3>
            <p>A <strong>pair HMM</strong> does not emit one sequence but two at once – an <em>aligned pair</em>. It has three states, one for each kind of alignment column:</p>
            <div class="hm-diagram-wrap">${this.V.pairDiagram(M)}</div>
            <ul class="hm-list">
                <li><strong>M</strong> (match) emits a residue in both sequences, pair (a, b) with probability p(a,b). Similar residues get high p(a,b).</li>
                <li><strong>X</strong> emits a residue of x against a gap in y, <strong>Y</strong> a residue of y against a gap in x, with the background probabilities q(a).</li>
                <li><strong>δ</strong> = probability of opening a gap, <strong>ε</strong> = probability of extending it, <strong>τ</strong> = probability of ending. A gap has on average 1/(1−ε) = ${(1 / (1 - M.epsilon)).toFixed(1)} residues; M → X → Y is not allowed (as in affine-gap alignment).</li>
            </ul>
            ${emit}
            <p>Run the model to see it generate: <button class="primary" data-act="sample">Generate an aligned pair</button></p>
            ${s ? `<div class="hm-sampled">${this.alnBlock(s.aligned1, s.aligned2)}<p class="dp-hint">The states used are the alignment. The two sequences on their own are x = ${s.x}, y = ${s.y}. <button data-act="use-sample">Use this pair</button></p></div>` : ''}
            ${this.V.lesson(`<strong>The key idea:</strong> every path through the pair HMM <em>is</em> an alignment – the sequence of states M, X, Y is the sequence of columns (pair, gap in y, gap in x). Aligning two given sequences means asking which path the model most probably took to produce them. And because it is a probability model, the parameters mean something: δ and ε are how often insertions/deletions happen and how long they are, p(a,b) is how often a is found aligned to b in related proteins.`)}`;
    }

    // ------------------------------------------------------------ step 2
    stepPath() {
        return `<h3>An alignment is a path – and has a probability</h3>
            <p>Edit the alignment below (click a residue, <kbd>Space</kbd> inserts a gap, <kbd>Backspace</kbd>/<kbd>Delete</kbd> removes one, ↑↓ switch sequence). The path of states and the probability update as you go.</p>
            <div id="p-editor"></div>
            <div id="p-path-info"></div>
            <div class="dp-buttons input-controls hm-tight">
                <button data-act="aln-viterbi">Show the most probable alignment (Viterbi)</button>
                <button data-act="aln-reset">Start from the ungapped sequences</button>
            </div>
            ${this.V.lesson(`P(x, y, π) is a product of one transition and one emission per column – exactly like one path in part 1. Its logarithm is a <strong>sum over columns</strong>: every column contributes a "score". Compare with the random model R (x and y unrelated, each residue drawn from q): the log-odds log<sub>2</sub>[P(x,y,π) / P(x,y | R)] is an ordinary alignment score in bits – step 3.`)}`;
    }

    mountEditor() {
        const el = this.$('p-editor');
        if (!el) return;
        const saved = this.aln;
        this.editor = new AlignEditor(el, { onChange: a => { this.aln = { a1: a.a1, a2: a.a2 }; this.renderPathInfo(); } });
        this.editor.init(this.x, this.y, this.type);
        if (saved) this.editor.setAlignment(saved.a1, saved.a2);
    }

    renderPathInfo() {
        const el = this.$('p-path-info');
        if (!el || !this.aln) return;
        const { a1, a2 } = this.aln;
        const P = this.H.pairPath(this.M, a1, a2);
        const rnd = this.H.randomModelLog(this.M, this.x, this.y);
        const cols = P.cols.map(c => `<span class="hm-colp ${c.state === 'M' ? (c.x === c.y ? 'pos' : 'neg') : 'gap'}" title="${c.state}: transition ${c.trans.toFixed(3)} × emission ${c.emit.toExponential(2)}">${this.V.f2(Math.log10(c.trans * c.emit), 1)}</span>`).join('');
        if (P.logp === -Infinity) {
            el.innerHTML = `<div class="hm-under"><div><span class="ae-label ae-small">state</span>${this.stateRow(a1, a2)}</div></div>
                <p class="dp-red">Probability 0: somewhere a gap in one sequence is directly followed by a gap in the other (X next to Y). The pair HMM has no X ↔ Y transition – just as affine-gap alignment would never prefer it. Merge those two columns into one aligned pair.</p>`;
            return;
        }
        const best = this.vit.logp;
        const diff = (best - P.logp) / Math.LN10;
        el.innerHTML = `<div class="hm-under"><div><span class="ae-label ae-small">state</span>${this.stateRow(a1, a2)}</div>
            <div><span class="ae-label ae-small">log₁₀</span>${cols}</div></div>
            <table class="bl-table hm-narrow">
                <tr><td>log<sub>10</sub> P(x, y, π) = Σ columns + log τ (end)</td><td><strong>${this.V.fmtLog10(P.logp)}</strong></td></tr>
                <tr><td>log<sub>10</sub> P(x, y | R) (unrelated sequences)</td><td>${this.V.fmtLog10(rnd)}</td></tr>
                <tr><td>log-odds score log<sub>2</sub>[P(x,y,π) / P(x,y|R)]</td><td><strong>${this.bits(P.logp - rnd)} bits</strong></td></tr>
                <tr><td>compared with the Viterbi alignment</td><td>${diff < 1e-9 ? '🎉 this is the most probable alignment' : `10<sup>${diff.toFixed(2)}</sup> times less probable`}</td></tr>
            </table>`;
    }

    // ------------------------------------------------------------ step 3
    stepGotoh() {
        const M = this.M, lo = this.H.logOddsScores(M), gp = this.H.gotohParams(M);
        const g = AlignEngine.globalAlign(this.x, this.y, gp);
        const same = g.aligned1 === this.vit.aligned1 && g.aligned2 === this.vit.aligned2;
        const vitBits = this.vit.logOdds / Math.LN2;
        const st = this.H.alignmentStates(this.vit.aligned1, this.vit.aligned2);
        const endGap = st.length && st[st.length - 1] !== 'M';
        const endCorr = endGap ? Math.log2(M.t.MM / M.t.XM) : 0;
        let subs;
        if (this.type === 'DNA') subs = `<tr><td>s(a, a) – identical pair</td><td>${lo.s.A.A.toFixed(2)}</td></tr><tr><td>s(a, b) – mismatch</td><td>${lo.s.A.C.toFixed(2)}</td></tr>`;
        else subs = ['WW', 'LL', 'LI', 'DE', 'WA'].map(p => `<tr><td>s(${p[0]}, ${p[1]})</td><td>${lo.s[p[0]][p[1]].toFixed(2)} <span class="dp-hint">(BLOSUM62 ${AlignEngine.BLOSUM62[p[0]][p[1]]} half-bits = ${(AlignEngine.BLOSUM62[p[0]][p[1]] / 2).toFixed(1)} bits, plus ${lo.base.toFixed(2)})</span></td></tr>`).join('');
        // the other direction: gap costs of BLASTP (11 + 1 per residue, half-bits) as probabilities
        const eB = 0.5, dB = 6;
        const epsB = Math.pow(2, -eB) * (1 - M.eta), deltaB = Math.pow(2, -dB) * (1 - M.eta) * (1 - M.tau) / (1 - epsB - M.tau);
        return `<h3>Viterbi on the pair HMM = affine-gap alignment</h3>
            <p>Divide the probability of the path by the probability under the random model and take log<sub>2</sub>. Durbin et al. (1998, ch. 4) showed that the log-odds then splits into ordinary alignment scores:</p>
            <p class="hm-formula">s(a,b) = log<sub>2</sub> p(a,b)/(q(a)q(b)) + log<sub>2</sub> (1−2δ−τ)/(1−η)² &nbsp;&nbsp; d = −log<sub>2</sub> δ(1−ε−τ)/((1−η)(1−2δ−τ)) &nbsp;&nbsp; e = −log<sub>2</sub> ε/(1−η)</p>
            <p>(η = τ is the end probability of the random model.) A gap of length g costs d + (g−1)·e: <strong>gap opening d comes from δ, gap extension e from ε.</strong> With the current parameters:</p>
            <table class="bl-table hm-narrow">${subs}
                <tr><td>gap open d (first gap position)</td><td>${lo.d.toFixed(2)}</td></tr>
                <tr><td>gap extend e</td><td>${lo.e.toFixed(2)}</td></tr></table>
            <p>Now align x and y twice: Viterbi on the pair HMM, and the Gotoh algorithm of the alignment trainers (<code>AlignEngine</code>) with the scores above.</p>
            <div class="bl-two"><div><h4>Viterbi (pair HMM)</h4>${this.alnBlock(this.vit.aligned1, this.vit.aligned2)}<p>log-odds: <strong>${vitBits.toFixed(2)} bits</strong></p></div>
            <div><h4>Gotoh (affine gaps)</h4>${this.alnBlock(g.aligned1, g.aligned2)}<p>score: <strong>${g.score.toFixed(2)} bits</strong></p></div></div>
            <p>${same ? '✔ <strong>The same alignment.</strong>' : '<strong>The alignments differ</strong> – they have (nearly) equal scores; the difference comes from how ties and the end correction are handled.'}
            The scores differ only by a constant: log<sub>2</sub>(τ/η²) = ${lo.c.toFixed(2)} bits${endGap ? `, plus ${endCorr.toFixed(2)} bits because this alignment ends with a gap (leaving a gap costs 1−ε−τ in the HMM, which the Gotoh score does not see at the end)` : ''}: ${g.score.toFixed(2)} + ${lo.c.toFixed(2)}${endGap ? ' + ' + endCorr.toFixed(2) : ''} = ${(g.score + lo.c + endCorr).toFixed(2)}.</p>
            <h4>The other direction</h4>
            <p>Every scoring scheme implies probabilities. BLASTP's default gap costs (11 + 1 per residue, in BLOSUM62 half-bits: d = 6 bits, e = 0.5 bit) correspond to ε ≈ ${epsB.toFixed(2)} (mean gap length ${(1 / (1 - epsB)).toFixed(1)}) and δ ≈ ${deltaB.toFixed(3)} (a gap opens about once every ${Math.round(1 / deltaB)} aligned pairs).</p>
            ${this.V.lesson(`<strong>Scores are log-odds.</strong> The pair HMM explains <em>why</em> alignment scores look the way they do: substitution scores are log ratios of "seen in related sequences" to "expected by chance", gap penalties are log probabilities of indels. Move the δ and ε sliders: the gap penalties change, and so may the alignment.`)}`;
    }

    // ------------------------------------------------------------ step 4
    stepForward() {
        const n = this.x.length, m = this.y.length;
        const count = this.H.countAlignments(n, m);
        const f = this.post;
        const share = Math.exp(this.vit.logp - f.logp);
        const rng = new this.H.Rng(n * 131 + m);
        const ysh = rng.shuffle(this.y.split('')).join('');
        const fsh = this.H.pairForward(this.M, this.x, ysh);
        const vsh = this.H.pairViterbi(this.M, this.x, ysh);
        return `<h3>Summing over all alignments</h3>
            <p>The Forward algorithm for the pair HMM fills the same three matrices as Viterbi but adds instead of maximising. It gives the probability that x and y were generated together, <em>by any alignment</em>:</p>
            <p class="hm-formula">P(x, y) = Σ<sub>alignments π</sub> P(x, y, π)</p>
            <table class="bl-table hm-narrow">
                <tr><td>number of possible alignments of ${n} and ${m} residues</td><td><strong>${count < 1e6 ? count.toLocaleString() : count.toExponential(2)}</strong></td></tr>
                <tr><td>log<sub>10</sub> P(x, y, π*) – best alignment</td><td>${this.V.fmtLog10(this.vit.logp)}</td></tr>
                <tr><td>log<sub>10</sub> P(x, y) – all alignments</td><td>${this.V.fmtLog10(f.logp)}</td></tr>
                <tr><td>P(π* | x, y): probability that the best alignment is exactly right</td><td><strong>${this.V.fmtP(share)}</strong></td></tr>
            </table>
            <h4>Are x and y related at all?</h4>
            <p>Log-odds against the random model, for the real pair and for x against a shuffled y (same composition, no homology):</p>
            <table class="bl-table hm-narrow"><tr><th></th><th>best alignment (Viterbi)</th><th>all alignments (Forward)</th></tr>
                <tr><td>x vs y</td><td>${this.bits(this.vit.logOdds)} bits</td><td><strong>${this.bits(f.logOdds)} bits</strong></td></tr>
                <tr><td>x vs shuffled y</td><td>${this.bits(vsh.logOdds)} bits</td><td>${this.bits(fsh.logOdds)} bits</td></tr></table>
            ${this.V.lesson(`<strong>The best alignment is rarely "the" alignment.</strong> For similar sequences it carries a large share of the probability; for divergent ones (try the divergent DNA or the α-globin/myoglobin example) it is one of very many almost equally good alignments. The Forward score counts the evidence from all of them, which makes it a better test of homology than the single best score – and it is what HMMER uses to rank database hits.`)}`;
    }

    // ------------------------------------------------------------ step 5
    stepPosterior() {
        const P = this.post, n = this.x.length, m = this.y.length;
        const onPath = new Set(this.vit.path.filter(p => p.state === 'M').map(p => p.i + ':' + p.j));
        let h = `<div class="hm-heat-wrap"><table class="hm-heat"><tr><th></th>${[...this.x].map((c, i) => `<th title="x${i + 1}">${c}</th>`).join('')}</tr>`;
        for (let j = 1; j <= m; j++) {
            h += `<tr><th title="y${j}">${this.y[j - 1]}</th>`;
            for (let i = 1; i <= n; i++) {
                const p = P.PM[i][j];
                const on = onPath.has(i + ':' + j);
                h += `<td class="${on ? 'hm-vpath' : ''}" style="background:rgba(37,99,235,${Math.min(1, p).toFixed(3)})" title="P(x${i}=${this.x[i - 1]} aligned to y${j}=${this.y[j - 1]}) = ${p.toFixed(3)}">${p >= 0.995 ? '' : p >= 0.05 ? `<span class="${p > 0.5 ? 'hm-light' : ''}">${Math.round(p * 100)}</span>` : ''}</td>`;
            }
            h += '</tr>';
        }
        h += '</table></div>';
        const conf = this.H.alignmentConfidence(P, this.vit.aligned1, this.vit.aligned2);
        const confRow = `<div><span class="hm-alnlab">P</span>${conf.map(c => `<span class="hm-conf" style="background:${c > 0.9 ? '#16a34a' : c > 0.5 ? '#ca8a04' : '#dc2626'};opacity:${(0.35 + 0.65 * c).toFixed(2)}" title="${c.toFixed(3)}">${c >= 0.995 ? '*' : Math.floor(c * 10)}</span>`).join('')}</div>`;
        const low = conf.filter(c => c < 0.5).length;
        return `<h3>Posterior probabilities: how sure is each aligned pair?</h3>
            <p>Forward × Backward / P(x, y) gives, for every pair of positions, the probability that x<sub>i</sub> and y<sub>j</sub> are aligned to each other – summed over all alignments that contain that pair (the same formula as posterior decoding in part 1):</p>
            <p class="hm-formula">P(x<sub>i</sub> ◇ y<sub>j</sub> | x, y) = f<sup>M</sup>(i, j) · b<sup>M</sup>(i, j) / P(x, y)</p>
            <p>Darker blue = more probable (numbers are percent; empty dark cells ≈ 100 %). Outlined: the Viterbi alignment. Sequence 1 runs across, sequence 2 down.</p>
            ${h}
            <h4>The Viterbi alignment with the confidence of every column</h4>
            ${this.alnBlock(this.vit.aligned1, this.vit.aligned2, confRow)}
            <p class="dp-hint">P row: posterior probability of each column in tenths (* = ≥ 0.995); green &gt; 0.9, yellow 0.5–0.9, red &lt; 0.5. ${low} of ${conf.length} columns are more likely wrong than right.</p>
            ${this.V.lesson(`<strong>Where is the alignment reliable?</strong> A single alignment hides its own uncertainty; posterior probabilities reveal it. Conserved blocks come out near 100 %, gap placement in repeats and divergent regions spreads over several cells. This is used in practice: probabilistic aligners (ProbCons, MAFFT's L-INS-i, BAli-Phy) build alignments from these posteriors, and alignment-trimming before phylogenetics removes low-confidence columns. HMMER prints the same quantity for each aligned residue as its <code>PP</code> line.`)}`;
    }

    onClick(e) {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        if (act === 'sample') { this.sample(); this.showStep(1); }
        else if (act === 'use-sample' && this.sampled) { this.$('p-note').textContent = 'A pair generated by the pair HMM itself.'; this.setSequences(this.sampled.x, this.sampled.y, this.type); }
        else if (act === 'aln-viterbi') { this.aln = { a1: this.vit.aligned1, a2: this.vit.aligned2 }; this.editor.setAlignment(this.aln.a1, this.aln.a2); }
        else if (act === 'aln-reset') { this.editor.init(this.x, this.y, this.type); }
    }
}
