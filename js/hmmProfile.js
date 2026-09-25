/**
 * HMM EXPLORER – PART 3: PROFILE HMM
 * ==================================
 * From a multiple alignment to a Plan7 profile HMM (as HMMER's hmmbuild),
 * the model as a generator, Viterbi alignment of a query, bit scores and
 * E-values, PSSM versus profile HMM, and a database search compared with
 * BLAST.
 */
class HmmProfile {
    constructor(app) {
        this.app = app; this.H = HmmEngine; this.V = HmmViews;
        this.$ = id => document.getElementById(id);
        this.box = this.$('profile-content');
        this.step = 1;
        this.node = 1;
        this.buildId = 0;
        this.cal = {};
        this.familySeed = 6;           // a typical family (HMM finds 6 of 8 homologs, BLAST 3)
        this.dbSeed = 1;
        this.blastQuery = 0;
        this.samples = null;
        this.search = null;
        this.cellSel = null;

        const sel = this.$('f-example');
        for (const [key, ex] of Object.entries(HMM_PROFILES)) sel.add(new Option(ex.name, key));
        sel.addEventListener('change', () => this.loadExample(sel.value));
        this.$('f-reroll').addEventListener('click', () => { this.familySeed++; this.loadExample('family'); });
        this.$('f-build').addEventListener('click', () => { this.isMatch = null; this.build(); });
        const slider = (id, fmt, fn) => this.$(id).addEventListener('input', () => { this.$(id + '-value').textContent = fmt(+this.$(id).value); fn(); });
        slider('f-occ', v => v, () => { this.isMatch = null; this.build(); });
        slider('f-epseudo', v => v.toFixed(1), () => this.build());
        slider('f-tpseudo', v => v.toFixed(1), () => this.build());
        ['f-occ', 'f-epseudo', 'f-tpseudo'].forEach(id => { this.$(id + '-value').textContent = (+this.$(id).value).toString(); });
        document.querySelectorAll('input[name="f-mode"]').forEach(r => r.addEventListener('change', () => this.align()));
        this.$('f-query-apply').addEventListener('click', () => this.setQuery(this.$('f-query').value));
        this.$('f-query').addEventListener('keydown', e => { if (e.key === 'Enter') this.setQuery(this.$('f-query').value); });
        this.$('f-query-presets').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b) this.setQuery(this.queries[b.dataset.q]); });
        this.box.addEventListener('click', e => this.onClick(e));
        this.box.addEventListener('change', e => this.onInput(e));
        this.loadExample('toy-dna');
    }

    mode() { return document.querySelector('input[name="f-mode"]:checked').value; }

    // ------------------------------------------------------------ examples
    loadExample(key) {
        const ex = HMM_PROFILES[key];
        this.exKey = key; this.type = ex.type;
        this.$('f-example').value = key;
        this.$('f-reroll').hidden = !ex.synthetic;
        this.$('f-note').innerHTML = ex.note;
        const ps = ex.emitPseudo || 1;
        this.$('f-epseudo').value = ps; this.$('f-epseudo-value').textContent = ps.toFixed(1);
        let names, rows;
        this.family = null;
        if (ex.rows) { names = ex.names; rows = ex.rows; }
        else if (ex.align) {
            const src = MSA_EXAMPLES[ex.align];
            const p = { type: 'PROTEIN', gapModel: 'affine', gap: -2, gapOpen: src.params.gapOpen, gapExtend: src.params.gapExtend, endGaps: 'penalized', substitution: { kind: 'blosum62' } };
            names = src.sequences.map(s => s.name);
            rows = MsaEngine.progressive(src.sequences, p).rows;
        } else {
            const rng = new this.H.Rng('family-' + this.familySeed);
            this.family = this.H.makeFamily(rng);
            this.familyMembers = [];
            for (let k = 0; k < 10; k++) this.familyMembers.push(this.H.familyMember(this.family, rng, 1));
            rows = this.H.familyAlignment(this.familyMembers);
            names = rows.map((_, k) => `fam${String(k + 1).padStart(2, '0')}`);
            this.familyRng = rng;
        }
        this.$('f-msa').value = names.map((n, k) => `>${n}\n${rows[k]}`).join('\n');
        this.$('f-type').textContent = this.type === 'PROTEIN' ? 'protein' : 'DNA';
        this.$('f-type').className = 'at-badge ' + (this.type === 'PROTEIN' ? 'protein' : 'dna');
        this.isMatch = null;
        this.search = null;
        this.build(true);
        this.makeQueries(ex);
    }

    makeQueries(ex) {
        const rng = new this.H.Rng('queries-' + this.exKey + this.familySeed);
        const q = {};
        if (ex.queries) Object.assign(q, ex.queries);
        else if (this.family) q.member = this.H.familyMember(this.family, rng, 1).seq;
        const m = q.member;
        if (!q.insertion) { const p = Math.floor(m.length * 0.45); q.insertion = m.slice(0, p) + this.H.randomSeq(this.P.bg, 4, rng) + m.slice(p); }
        if (!q.deletion) { const p = Math.floor(m.length * 0.4); q.deletion = m.slice(0, p) + m.slice(p + 3); }
        q.shuffled = rng.shuffle(m.split('')).join('');
        q.random = this.H.randomSeq(this.P.bg, m.length, rng);
        this.queries = q;
        const labels = { member: 'family member', insertion: 'with an insertion', deletion: 'with a deletion', shuffled: 'shuffled member', random: 'random' };
        this.$('f-query-presets').innerHTML = Object.keys(q).map(k => `<button data-q="${k}">${labels[k] || k}</button>`).join('');
        this.setQuery(q.member);
    }

    parseMsa() {
        const seqs = MsaEngine.parseFasta(this.$('f-msa').value.replace(/\./g, '-'));
        const A = this.H.alphabetFor(this.type);
        const rows = seqs.map(s => s.seq.toUpperCase().split('').map(c => (c === '-' || A.includes(c)) ? c : '-').join(''));
        if (rows.length < 2) { this.app.toast('Enter at least two aligned sequences (FASTA).'); return null; }
        const L = rows[0].length;
        if (rows.some(r => r.length !== L)) { this.app.toast('All aligned sequences must have the same length (use - for gaps).'); return null; }
        return { names: seqs.map(s => s.name), rows };
    }

    build(quiet) {
        const msa = this.parseMsa();
        if (!msa) return;
        this.names = msa.names; this.rows = msa.rows;
        if (this.isMatch && this.isMatch.length !== this.rows[0].length) this.isMatch = null;
        this.P = this.H.buildProfile(this.rows, this.type, {
            minOccupancy: +this.$('f-occ').value / 100, isMatch: this.isMatch,
            emitPseudo: +this.$('f-epseudo').value, transPseudo: +this.$('f-tpseudo').value
        });
        if (this.P.m < 1) { this.app.toast('No match columns – lower the occupancy threshold.'); return; }
        this.buildId++;
        this.node = Math.min(this.node, this.P.m) || 1;
        this.samples = null;
        this.cellSel = null;
        if (!quiet && this.search) this.search = null;
        this.align();
    }

    setQuery(s) {
        const A = this.H.alphabetFor(this.type);
        const q = (s || '').toUpperCase().split('').filter(c => A.includes(c)).join('');
        if (!q.length) { this.app.toast('Enter a query sequence.'); return; }
        this.query = q.slice(0, 400);
        this.$('f-query').value = this.query;
        this.cellSel = null;
        this.align();
    }

    align() {
        if (!this.P || !this.query) return;
        this.vit = this.H.profileViterbi(this.P, this.query, this.mode());
        this.fwd = this.H.profileForward(this.P, this.query, this.mode());
        this.showStep(this.step);
    }

    showStep(n) {
        this.step = Math.max(1, Math.min(7, n));
        this.app.setPills('profile', this.step);
        this.box.innerHTML = [null, this.stepArchitecture, this.stepCounts, this.stepGenerator, this.stepAlign, this.stepScore, this.stepPssm, this.stepSearch][this.step].call(this);
        if (this.step === 4) this.drawHeat();
    }

    // ------------------------------------------------------------ shared pieces
    diagram(opts = {}) { return `<div class="hm-diagram-wrap hm-profile-wrap">${this.V.profileDiagram(this.P, Object.assign({ selected: this.node }, opts))}</div>`; }
    resClass(c) {
        if (c === '-') return 'gap';
        if (this.type !== 'PROTEIN') return 'nt-' + c;
        if ('AVLIMFWP'.includes(c)) return 'aa-hydrophobic'; if ('KRH'.includes(c)) return 'aa-positive'; if ('DE'.includes(c)) return 'aa-negative';
        if ('STNQ'.includes(c)) return 'aa-polar'; if (c === 'C') return 'aa-cysteine'; if (c === 'G') return 'aa-glycine'; if (c === 'Y') return 'aa-aromatic';
        return '';
    }
    traceString(tr) {
        const parts = [];
        for (const t of tr.trace) parts.push(`<span class="hm-st hm-st-${t.s}${t.moved ? ' hm-moved' : ''}" title="${t.moved ? 'moved by the trace doctor' : ''}">${t.s}${t.k}</span>`);
        return `${tr.flankN ? `<span class="hm-st hm-st-N">N×${tr.flankN}</span>` : ''}${parts.join('')}${tr.flankC ? `<span class="hm-st hm-st-C">C×${tr.flankC}</span>` : ''}`;
    }
    hmmerBlock(aln, name = 'query') {
        if (!aln.cols.length) return '<p class="dp-hint">No residue was aligned to the model.</p>';
        const w = Math.max(name.length, 5);
        const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
        const lp = (s, n) => (' '.repeat(n) + s).slice(-n);
        const nw = String(Math.max(aln.hmmTo, aln.seqTo)).length;
        const states = aln.states.split('').map(s => `<span class="hm-st-${s} hm-stc">${s}</span>`).join('');
        return `<pre class="hm-hmmer">${pad('model', w)} ${lp(aln.hmmFrom, nw)} ${this.V.esc(aln.model)} ${aln.hmmTo}
${pad('', w)} ${lp('', nw)} ${this.V.esc(aln.match)}
${pad(name, w)} ${lp(aln.seqFrom, nw)} ${this.V.esc(aln.target)} ${aln.seqTo}
${pad('state', w)} ${lp('', nw)} ${states}</pre>`;
    }

    // ------------------------------------------------------------ step 1: architecture
    msaView() {
        const P = this.P, L = this.rows[0].length;
        const occ = [];
        for (let c = 0; c < L; c++) occ.push(this.rows.filter(r => r[c] !== '-').length / this.rows.length);
        let node = 0;
        const head = P.isMatch.map((m, c) => { if (m) node++; return `<span class="hm-mc ${m ? 'hm-mcM' : 'hm-mcI'}${m && node === this.node ? ' hm-mcsel' : ''}" data-col="${c}" title="column ${c + 1}: ${Math.round(occ[c] * 100)} % residues – click to make it ${m ? 'an insert' : 'a match'} column">${m ? node : 'i'}</span>`; }).join('');
        const occRow = occ.map((o, c) => `<span class="hm-mc hm-occ" style="background:rgba(122,62,29,${(o * 0.6).toFixed(2)})" title="${Math.round(o * 100)} %"></span>`).join('');
        const rows = this.rows.map((r, x) => `<div class="hm-msarow"><span class="hm-msaname">${this.V.esc(this.names[x])}</span>${r.split('').map((ch, c) => `<span class="hm-mc ${this.resClass(ch)}${P.isMatch[c] ? '' : ' hm-inscol'}">${ch}</span>`).join('')}</div>`).join('');
        return `<div class="hm-msa"><div class="hm-msarow"><span class="hm-msaname">state</span>${head}</div><div class="hm-msarow"><span class="hm-msaname">occupancy</span>${occRow}</div>${rows}</div>`;
    }

    stepArchitecture() {
        const P = this.P;
        const doctored = P.traces.reduce((s, t) => s + t.doctored, 0);
        const traces = P.traces.map((tr, x) => `<tr><td class="hm-msaname">${this.V.esc(this.names[x])}</td><td class="hm-trace">${this.traceString(tr)}</td></tr>`).join('');
        return `<h3>From a multiple alignment to a model</h3>
            <p>A <strong>profile HMM</strong> describes a whole family of sequences. It is built from a multiple alignment: every well-occupied column becomes a <strong>node</strong> with three states.</p>
            <ul class="hm-list">
                <li><span class="hm-st hm-st-M">M<sub>k</sub></span> <strong>match</strong> – emits the residue of column k, with column-specific probabilities (like one column of a PSSM).</li>
                <li><span class="hm-st hm-st-I">I<sub>k</sub></span> <strong>insert</strong> – emits extra residues between columns k and k+1 (the rare, gappy columns).</li>
                <li><span class="hm-st hm-st-D">D<sub>k</sub></span> <strong>delete</strong> – silent: skips column k without emitting anything.</li>
            </ul>
            <p>B and E are the begin and end of the model; the flanking states N and C absorb any sequence before and after the part that matches the family, so the model can be found inside a longer protein.</p>
            ${this.diagram()}
            <p class="dp-hint">${P.m} nodes. Thickness of an arrow = transition probability (step 2). This is the <strong>Plan7</strong> architecture of HMMER: no transitions between insert and delete states.</p>
            <h4>Which columns are match states?</h4>
            <p>The rule used by <code>hmmbuild</code>: a column becomes a match state if at least ${this.$('f-occ').value} % of the sequences have a residue there (side panel). Other columns are insert columns. <strong>Click a column label to override the rule.</strong></p>
            ${this.msaView()}
            <h4>Each sequence is a path through the model</h4>
            <p>Reading a row of the alignment from left to right gives its path: residue in a match column → M, gap in a match column → D, residue in an insert column → I (gaps in insert columns are simply nothing).</p>
            <div class="hm-trace-wrap"><table class="hm-traces">${traces}</table></div>
            ${doctored ? `<p class="dp-hint">${doctored} transition${doctored > 1 ? 's' : ''} between an insert and a delete state were not allowed in Plan7 and were fixed as HMMER does (a delete becomes a match with the neighbouring inserted residue; marked with a dotted outline).</p>` : ''}
            ${this.V.lesson(`<strong>The known paths are the training data.</strong> In part 1 we learnt by counting states in sequences with known paths; the multiple alignment tells us the path of every family member, so the model can be estimated by counting (step 2). And note what the model knows that pairwise alignment does not: where in the family indels happen – gaps are cheap in the loop that is often gapped and expensive in the conserved core. <strong>Position-specific gap penalties</strong> are the main advantage over a PSSM.`)}`;
    }

    // ------------------------------------------------------------ step 2: counting
    stepCounts() {
        const P = this.P, k = this.node, A = P.alphabet.split('');
        const C = P.counts.emit[k], N = A.reduce((s, a) => s + C[a], 0), Aps = +this.$('f-epseudo').value;
        const order = A.slice().sort((a, b) => P.eM[k][b] - P.eM[k][a] || a.localeCompare(b));
        const emit = order.map(a => `<tr><td class="hm-res-td ${this.resClass(a)}">${a}</td><td>${C[a]}</td><td>${(C[a] + Aps * P.bg[a]).toFixed(2)}</td><td><strong>${P.eM[k][a].toFixed(3)}</strong></td><td>${P.bg[a].toFixed(3)}</td><td class="${P.eM[k][a] > P.bg[a] ? 'dp-green' : ''}">${Math.log2(P.eM[k][a] / P.bg[a]).toFixed(2)}</td></tr>`).join('');
        const Tc = P.counts.trans[k], T = P.t[k], al = this.H.allowedTrans(k, P.m), tp = +this.$('f-tpseudo').value;
        const trow = (grp, name) => al[grp].length ? al[grp].map(x => `<tr><td>${name}<sub>${k}</sub> → ${x[1]}<sub>${x[1] === 'I' ? k : k + 1}</sub></td><td>${Tc[x]}</td><td>${(Tc[x] + tp).toFixed(1)}</td><td><strong>${T[x].toFixed(3)}</strong></td></tr>`).join('') : '';
        const trans = k === P.m ? `<tr><td colspan="4">M<sub>${k}</sub> and D<sub>${k}</sub> go to the end state E with probability 1.</td></tr>` : trow('M', 'M') + trow('I', 'I') + trow('D', 'D');
        const logo = this.V.profileLogoStats(P);
        const cw = P.m > 40 ? 14 : 22;
        const b0 = P.t[0];
        return `<h3>Estimating the probabilities: counting</h3>
            <p>Every sequence's path is known (step 1), so the probabilities are estimated exactly as in part 1: count and divide. With few sequences many residues are never seen in a column, so <strong>pseudocounts</strong> are added. This app spreads A pseudocounts over the residues in proportion to their background frequencies q(a):</p>
            <p class="hm-formula">e<sub>M<sub>k</sub></sub>(a) = (c<sub>k</sub>(a) + A·q(a)) / (N<sub>k</sub> + A) &nbsp;&nbsp;&nbsp; a<sub>k</sub>(X→Y) = (c + β) / Σ (c + β)</p>
            <p><strong>Click a node</strong> in the diagram (or in the logo) to see its numbers. Selected: node <strong>${k}</strong> (alignment column ${P.matchColIndex[k - 1] + 1}).</p>
            ${this.diagram()}
            <div class="bl-two">
                <div><h4>Match state M<sub>${k}</sub>: emissions</h4>
                <table class="bl-table hm-counts"><tr><th>a</th><th>count</th><th>+ A·q(a)</th><th>e(a)</th><th>q(a)</th><th>log<sub>2</sub> e/q</th></tr>${emit}</table>
                <p class="dp-hint">N<sub>${k}</sub> = ${N} residues, A = ${Aps}. Relative entropy of this state: ${P.info[k].toFixed(2)} bits. Insert states emit the background distribution q (as in HMMER), so inserted residues score 0 bits.</p></div>
                <div><h4>Transitions out of node ${k}</h4>
                <table class="bl-table hm-counts"><tr><th>transition</th><th>count</th><th>+ β</th><th>probability</th></tr>${trans}</table>
                <p class="dp-hint">β = ${tp}. From the begin state: B → M<sub>1</sub> ${b0.MM.toFixed(3)}, B → D<sub>1</sub> ${b0.MD.toFixed(3)}.</p></div>
            </div>
            <h4>HMM logo</h4>
            <div class="hm-logo" style="--cw:${cw}px">${MsaLogo.axis(logo.maxBits, 90)}<div class="hm-logo-cols">${MsaLogo.render(logo, this.type, { cellWidth: cw, height: 90, maxBits: logo.maxBits })}<div class="hm-logo-hit">${Array.from({ length: P.m }, (_, i) => `<span data-node="${i + 1}" class="${i + 1 === k ? 'sel' : ''}" title="node ${i + 1}">${(i + 1) % 5 === 0 || P.m <= 25 ? i + 1 : ''}</span>`).join('')}</div></div></div>
            <p class="dp-hint">Stack height = relative entropy Σ e(a)·log<sub>2</sub>(e(a)/q(a)) of the match state – how much it differs from background; letter height ∝ e(a).</p>
            ${this.V.lesson(`<strong>Try the pseudocount slider.</strong> With A = 0 a residue never seen in a column gets probability 0 and log-odds −∞: a single unusual residue would make a true family member impossible. Large A pulls every column towards the background and the model loses specificity. HMMER's hmmbuild does better than a single pseudocount: it <em>weights</em> sequences (so ten near-identical sequences do not count ten times) and uses <em>Dirichlet mixture priors</em> that know, for instance, that a column with I and V probably also tolerates L and M.`)}`;
    }

    // ------------------------------------------------------------ step 3: the model as a generator
    stepGenerator() {
        if (!this.samples) this.sampleMore();
        const blocks = this.samples.map((s, x) => {
            const tr = s.trace.map((t, i) => Object.assign({}, t, { i: 0 }));
            let i = 0;
            for (const t of tr) if (t.s !== 'D') t.i = ++i;
            const aln = this.H.hmmerAlignment(this.P, tr, s.seq);
            return `<div class="hm-sample"><div class="hm-sample-seq">${this.V.esc(s.seq) || '<em>(empty)</em>'}</div>${this.hmmerBlock(aln, 'sample' + (x + 1))}</div>`;
        }).join('');
        return `<h3>The profile HMM is a generator of family members</h3>
            <p>Like every HMM, the profile can be run to <em>produce</em> sequences: start in B, follow the transition probabilities through M, I and D states, emit a residue in every M (from its column distribution) and I (from the background). Each run gives a new "family member" together with its alignment to the model:</p>
            <div class="dp-buttons input-controls hm-tight"><button class="primary" data-act="sample">Generate 5 new sequences</button></div>
            ${blocks}
            <p class="dp-hint">In the alignment: upper-case = match state, lower-case = insert state (the model line shows a dot), – = delete state. The middle line shows identical residues and <code>+</code> for positive-scoring ones – the same format as HMMER.</p>
            <details class="hm-details"><summary>The model as HMMER writes it (<code>hmmbuild</code> output format)</summary>
            <pre class="hm-hmmfile">${this.V.esc(this.hmmFile())}</pre>
            <p class="dp-hint">Numbers are −ln(probability); * = probability 0. For each node: match emissions, insert emissions, then the seven transitions m→m, m→i, m→d, i→m, i→i, d→m, d→d. HMMER's real files add a few annotation columns and statistics lines; the numbers here are this app's model.</p></details>
            ${this.V.lesson(`<strong>A model of the family, not of a sequence.</strong> The generated sequences look like family members – conserved positions come out conserved, loops vary in length – even though none of them is in the alignment. Scoring a database sequence (steps 4–5) asks the reverse question: how likely is it that <em>this</em> model generated it?`)}`;
    }

    sampleMore() {
        const rng = new this.H.Rng((Math.random() * 1e9) | 0);
        this.samples = [];
        for (let k = 0; k < 5; k++) this.samples.push(this.H.sampleProfile(this.P, rng));
    }

    hmmFile() {
        const P = this.P, A = P.alphabet.split('');
        const nl = p => p > 0 ? (-Math.log(p)).toFixed(5) : '*';
        const f = s => ('         ' + s).slice(-9);
        const lines = [];
        lines.push('HMMER3/f [HMM Explorer, teaching version]');
        lines.push(`NAME  ${this.exKey}`);
        lines.push(`LENG  ${P.m}`);
        lines.push(`ALPH  ${this.type === 'PROTEIN' ? 'amino' : 'DNA'}`);
        lines.push('RF    no', 'MM    no', 'CONS  yes', 'CS    no', 'MAP   yes');
        lines.push(`NSEQ  ${this.rows.length}`);
        const cal = this.cal[this.calKey()];
        if (cal) lines.push(`STATS LOCAL FORWARD ${cal.tau.toFixed(4).padStart(9)}  0.69315`);
        lines.push('HMM     ' + A.map(a => ('        ' + a).slice(-9)).join(''));
        lines.push('        ' + ['m->m', 'm->i', 'm->d', 'i->m', 'i->i', 'd->m', 'd->d'].map(f).join(''));
        const compo = A.map(a => { let s = 0; for (let k = 1; k <= P.m; k++) s += P.eM[k][a]; return s / P.m; });
        lines.push('  COMPO ' + compo.map(p => f(nl(p))).join(''));
        lines.push('        ' + A.map(a => f(nl(P.bg[a]))).join(''));
        const tl = (k) => { const t = P.t[k], al = this.H.allowedTrans(k, P.m);
            const g = x => (al.M.includes(x) || al.I.includes(x) || al.D.includes(x)) ? nl(t[x]) : null;
            const mm = k === P.m ? '0.00000' : g('MM'), mi = g('MI') || '*', md = g('MD') || '*';
            const im = k === 0 ? '0.00000' : (g('IM') || '0.00000'), ii = g('II') || '*';
            const dm = k === 0 || k === P.m ? '0.00000' : g('DM'), dd = g('DD') || '*';
            return '        ' + [mm, mi, md, im, ii, dm, dd].map(f).join(''); };
        lines.push(tl(0));
        for (let k = 1; k <= P.m; k++) {
            lines.push(('      ' + k).slice(-7) + ' ' + A.map(a => f(nl(P.eM[k][a]))).join('') + `  ${P.matchColIndex[k - 1] + 1} ${P.consensus[k].toLowerCase()} - - -`);
            lines.push('        ' + A.map(a => f(nl(P.eI[k][a]))).join(''));
            lines.push(tl(k));
        }
        lines.push('//');
        return lines.join('\n');
    }

    // ------------------------------------------------------------ step 4: aligning a sequence
    small() { return this.P.m <= 16 && this.query.length <= 26; }

    stepAlign() {
        const P = this.P, R = this.vit, aln = R.alignment;
        const local = this.mode() === 'local';
        return `<h3>Aligning a sequence to the model: Viterbi</h3>
            <p>Which path through the model most probably generated the query? Exactly the Viterbi algorithm of part 1, now with three matrices – one for each state type – indexed by node k (rows) and query position i (columns). Scores are in <strong>bits of log-odds</strong> against the random model, so matches to conserved columns add a lot, mismatches cost, and transitions cost log<sub>2</sub> of their probability:</p>
            <p class="hm-formula">V<sup>M</sup><sub>k</sub>(i) = log<sub>2</sub> e<sub>M<sub>k</sub></sub>(x<sub>i</sub>)/q(x<sub>i</sub>) + max { V<sup>M</sup><sub>k−1</sub>(i−1) + log<sub>2</sub> a<sub>MM</sub>, V<sup>I</sup><sub>k−1</sub>(i−1) + log<sub>2</sub> a<sub>IM</sub>, V<sup>D</sup><sub>k−1</sub>(i−1) + log<sub>2</sub> a<sub>DM</sub> }<br>
            V<sup>I</sup><sub>k</sub>(i) = 0 + max { V<sup>M</sup><sub>k</sub>(i−1) + log<sub>2</sub> a<sub>MI</sub>, V<sup>I</sup><sub>k</sub>(i−1) + log<sub>2</sub> a<sub>II</sub> } &nbsp;&nbsp; V<sup>D</sup><sub>k</sub>(i) = max { V<sup>M</sup><sub>k−1</sub>(i) + log<sub>2</sub> a<sub>MD</sub>, V<sup>D</sup><sub>k−1</sub>(i) + log<sub>2</sub> a<sub>DD</sub> }</p>
            <p>The path may enter the model ${local ? 'at <strong>any</strong> match state and leave from any (local mode – finds a domain or a fragment)' : 'only at M<sub>1</sub>/D<sub>1</sub> and leave from node m (glocal mode – the whole model must be used)'}; before and after, the N and C states consume the rest of the query at (almost) no cost.</p>
            ${this.small() ? this.trellisTable() : `<div class="hm-heat-canvas-wrap"><canvas id="f-heat" class="hm-heatcanvas"></canvas></div><p class="dp-hint">Every node (rows) against every query position (columns); blue = the query residue scores positively in that match state (log<sub>2</sub> e/q, darkest ≥ 4 bits) – a dotplot of the query against the model. The <span style="color:#b6402c;font-weight:600">red line</span> is the Viterbi path. (The full table with numbers is shown when the model has ≤ 16 nodes and the query ≤ 26 residues – e.g. the toy DNA example.)</p>`}
            <h4>The alignment</h4>
            ${this.hmmerBlock(aln)}
            <p>Viterbi score <strong>${R.score.toFixed(2)} bits</strong>: ${aln.nMatch} residues in match states, ${aln.nInsert} in insert states, ${aln.nDelete} deleted nodes; model positions ${aln.hmmFrom}–${aln.hmmTo}, query positions ${aln.seqFrom}–${aln.seqTo}.</p>
            ${this.diagram({ trace: R.trace })}
            <p class="dp-hint">The path is highlighted in the model. Try the query presets in the side panel: the insertion goes into an insert state, the deletion through delete states.</p>
            ${this.V.lesson(`<strong>Aligning to a profile = aligning to the whole family at once.</strong> The scores are position-specific: a glycine in an invariant glycine column is worth several bits, the same glycine in a variable loop almost nothing; a gap costs little where the family often has gaps. This is how <code>hmmalign</code> adds sequences to an alignment and how <code>hmmsearch</code> shows its hits.`)}`;
    }

    trellisTable() {
        const P = this.P, R = this.vit, L = this.query.length;
        const on = new Set(R.trace.filter(t => 'MID'.includes(t.s)).map(t => `${t.s}${t.k}:${t.i}`));
        const f = v => v === -Infinity ? '·' : v.toFixed(1);
        let h = `<div class="hm-trellis-wrap"><table class="hm-trellis hm-ptrellis"><tr><th class="hm-corner">k \\ i</th><th>0</th>${[...this.query].map((c, i) => `<th>${i + 1}<br><span class="hm-sym">${c}</span></th>`).join('')}</tr>`;
        for (let k = 1; k <= P.m; k++) {
            h += `<tr><th class="hm-rowh">${k} <span class="hm-sym">${P.consensus[k]}</span></th>`;
            for (let i = 0; i <= L; i++) {
                const sel = this.cellSel && this.cellSel.k === k && this.cellSel.i === i;
                const part = (s, v) => `<div class="hm-sub hm-sub-${s}${on.has(`${s}${k}:${i}`) ? ' hm-subon' : ''}">${s} ${f(v)}</div>`;
                h += `<td class="hm-pcell${sel ? ' hm-selcell' : ''}" data-pk="${k}" data-pi="${i}">${part('M', R.VM[i][k])}${k < P.m ? part('I', R.VI[i][k]) : ''}${part('D', R.VD[i][k])}</td>`;
            }
            h += '</tr>';
        }
        h += '</table></div>';
        const expl = this.cellSel ? this.cellExplain(this.cellSel.k, this.cellSel.i) : 'Click a cell to see how its three values were computed. Highlighted: the Viterbi path.';
        return `<div class="at-step-controls"><div class="at-step-explain">${expl}</div></div>${h}`;
    }

    cellExplain(k, i) {
        const P = this.P, R = this.vit, S = R.S, x = this.query;
        const f = v => v === -Infinity ? '−∞' : v.toFixed(2);
        const li = arr => { const best = Math.max(...arr.map(a => a[1])); return arr.map(([t, v]) => `<li class="${v === best && v > -Infinity ? 'best' : ''}">${t} = ${f(v)}</li>`).join(''); };
        let out = `<strong>Node ${k}, query position ${i}</strong>${i > 0 ? ` (residue ${x[i - 1]})` : ''}<br>`;
        if (i > 0) {
            const c = [];
            if (k > 1) {
                c.push([`V<sup>M</sup><sub>${k - 1}</sub>(${i - 1}) + log a<sub>MM</sub> = ${f(R.VM[i - 1][k - 1])} + ${f(S.tsc[k - 1].MM)}`, R.VM[i - 1][k - 1] + S.tsc[k - 1].MM]);
                c.push([`V<sup>I</sup><sub>${k - 1}</sub>(${i - 1}) + log a<sub>IM</sub> = ${f(R.VI[i - 1][k - 1])} + ${f(S.tsc[k - 1].IM)}`, R.VI[i - 1][k - 1] + S.tsc[k - 1].IM]);
                c.push([`V<sup>D</sup><sub>${k - 1}</sub>(${i - 1}) + log a<sub>DM</sub> = ${f(R.VD[i - 1][k - 1])} + ${f(S.tsc[k - 1].DM)}`, R.VD[i - 1][k - 1] + S.tsc[k - 1].DM]);
            }
            if (S.mode === 'local') c.push([`begin: B(${i - 1}) + log(1/m) = ${f(R.B[i - 1])} + ${f(S.entry)}`, R.B[i - 1] + S.entry]);
            else if (k === 1) c.push([`begin: B(${i - 1}) + log a<sub>B→M1</sub> = ${f(R.B[i - 1])} + ${f(S.tsc[0].MM)}`, R.B[i - 1] + S.tsc[0].MM]);
            const e = S.msc[k][x[i - 1]];
            out += `<strong>M</strong>: best of<ul>${li(c)}</ul>plus emission log<sub>2</sub>(e<sub>M${k}</sub>(${x[i - 1]}) / q) = ${f(e)} → <strong>${f(R.VM[i][k])}</strong><br>`;
            if (k < P.m) {
                const ci = [[`V<sup>M</sup><sub>${k}</sub>(${i - 1}) + log a<sub>MI</sub> = ${f(R.VM[i - 1][k])} + ${f(S.tsc[k].MI)}`, R.VM[i - 1][k] + S.tsc[k].MI], [`V<sup>I</sup><sub>${k}</sub>(${i - 1}) + log a<sub>II</sub> = ${f(R.VI[i - 1][k])} + ${f(S.tsc[k].II)}`, R.VI[i - 1][k] + S.tsc[k].II]];
                out += `<strong>I</strong>: best of<ul>${li(ci)}</ul>plus 0 (insert emission = background) → <strong>${f(R.VI[i][k])}</strong><br>`;
            }
        } else out += 'Column 0: no residue has been consumed yet, so M and I are impossible (−∞).<br>';
        const cd = [];
        if (k > 1) { cd.push([`V<sup>M</sup><sub>${k - 1}</sub>(${i}) + log a<sub>MD</sub> = ${f(R.VM[i][k - 1])} + ${f(S.tsc[k - 1].MD)}`, R.VM[i][k - 1] + S.tsc[k - 1].MD]); cd.push([`V<sup>D</sup><sub>${k - 1}</sub>(${i}) + log a<sub>DD</sub> = ${f(R.VD[i][k - 1])} + ${f(S.tsc[k - 1].DD)}`, R.VD[i][k - 1] + S.tsc[k - 1].DD]); }
        else if (S.mode !== 'local') cd.push([`begin: B(${i}) + log a<sub>B→D1</sub> = ${f(R.B[i])} + ${f(S.tsc[0].MD)}`, R.B[i] + S.tsc[0].MD]);
        out += cd.length ? `<strong>D</strong> (silent, same column i): best of<ul>${li(cd)}</ul>→ <strong>${f(R.VD[i][k])}</strong>` : '<strong>D</strong>: in local mode the path enters at a match state, so D<sub>1</sub> is not used.';
        out += `<br><span class="dp-hint">B(i) = N(i) + log<sub>2</sub>(2/(L+2)) = ${f(R.B[i])}: entering the model after i residues in the N state.</span>`;
        return out;
    }

    drawHeat() {
        const cv = this.$('f-heat');
        if (!cv) return;
        const P = this.P, R = this.vit, L = this.query.length, m = P.m;
        const cs = Math.max(2, Math.min(8, Math.floor(700 / Math.max(L, m))));
        cv.width = (L + 1) * cs; cv.height = m * cs;
        const ctx = cv.getContext('2d');
        // colour = match log-odds of query residue i in node k (a dotplot of the query against the model)
        for (let i = 1; i <= L; i++) for (let k = 1; k <= m; k++) {
            const v = R.S.msc[k][this.query[i - 1]];
            const t = Math.max(0, Math.min(1, (v === undefined ? 0 : v) / 4));
            ctx.fillStyle = `rgba(37,99,235,${(0.04 + 0.96 * t).toFixed(3)})`;
            ctx.fillRect(i * cs, (k - 1) * cs, cs, cs);
        }
        ctx.strokeStyle = '#b6402c'; ctx.lineWidth = Math.max(1.5, cs / 2.5);
        ctx.beginPath();
        let first = true;
        for (const t of R.trace) {
            if (!'MID'.includes(t.s)) continue;
            const X = t.i * cs + cs / 2, Y = (t.k - 1) * cs + cs / 2;
            if (first) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
            first = false;
        }
        ctx.stroke();
    }

    // ------------------------------------------------------------ step 5: scores and E-values
    calKey() { return `${this.buildId}:${this.mode()}:${this.calL()}`; }
    calL() { return Math.max(50, Math.min(400, this.query.length)); }

    ensureCalibration(then) {
        const key = this.calKey();
        if (this.cal[key]) return true;
        if (this.calRunning === key) return false;
        this.calRunning = key;
        setTimeout(() => {
            const rng = new this.H.Rng('cal-' + key);
            this.cal[key] = this.H.calibrate(this.P, this.calL(), rng, 200, this.mode());
            this.calRunning = null;
            then();
        }, 30);
        return false;
    }

    stepScore() {
        if (!this.ensureCalibration(() => { if (this.step === 5) this.showStep(5); })) {
            return `<h3>Scores and E-values</h3><p class="hm-busy">Simulating 200 random sequences of length ${this.calL()} and scoring them with the model…</p>`;
        }
        const cal = this.cal[this.calKey()];
        const rng = new this.H.Rng('shuf-' + this.query);
        const sh = rng.shuffle(this.query.split('')).join('');
        const fsh = this.H.profileForward(this.P, sh, this.mode());
        const vsh = this.H.profileViterbi(this.P, sh, this.mode());
        const N = Math.pow(10, this.dbExp || 6);
        const E = s => this.H.evalue(s, cal.tau, N);
        const fmtE = e => e < 1e-3 || e >= 1e4 ? e.toExponential(1) : e.toPrecision(2);
        const exceed = cal.scores.filter(s => s >= this.fwd.score).length;
        return `<h3>Is the query a family member? Bit scores and E-values</h3>
            <p>The score of a sequence is a <strong>log-odds ratio</strong>: how much more probable the sequence is if the family model generated it than if a random model did (residues drawn independently from the background q, with the same length distribution):</p>
            <p class="hm-formula">S = log<sub>2</sub> [ P(x | profile HMM) / P(x | random) ] &nbsp;bits</p>
            <p>A score of S bits means 2<sup>S</sup> times more probable under the family model. HMMER uses the <strong>Forward</strong> score – summed over all alignments to the model (part 1, step 5) – because it is a more sensitive test than the Viterbi score of the single best alignment.</p>
            <table class="bl-table hm-narrow"><tr><th></th><th>Viterbi (best path)</th><th>Forward (all paths)</th><th>E-value in a database of 10<sup>${this.dbExp || 6}</sup> sequences</th></tr>
                <tr><td>query</td><td>${this.vit.score.toFixed(2)} bits</td><td><strong>${this.fwd.score.toFixed(2)} bits</strong></td><td><strong>${fmtE(E(this.fwd.score))}</strong></td></tr>
                <tr><td>query shuffled</td><td>${vsh.score.toFixed(2)} bits</td><td>${fsh.score.toFixed(2)} bits</td><td>${fmtE(E(fsh.score))}</td></tr></table>
            <p>Database size: <select data-act-input="dbexp">${[3, 4, 5, 6, 7, 8, 9].map(e => `<option value="${e}" ${e === (this.dbExp || 6) ? 'selected' : ''}>10^${e} sequences</option>`).join('')}</select></p>
            <h4>What does chance look like?</h4>
            <p>How high can a <em>random</em> sequence score? The app scored 200 random sequences of length ${cal.L}:</p>
            <div class="hm-plot-wrap">${this.V.histogram(cal.scores, { tau: cal.tau, tailFrom: cal.scores[Math.floor(cal.scores.length * 0.8)], marks: [{ x: this.fwd.score, label: `query ${this.fwd.score.toFixed(1)}`, color: '#16a34a' }, { x: fsh.score, label: `shuffled ${fsh.score.toFixed(1)}`, color: '#b6402c' }] })}</div>
            <p>${exceed} of 200 random sequences score at least as high as the query. The high-scoring tail of the random scores falls off <strong>exponentially, by a factor of 2 per bit</strong> (dashed line; for Forward scores in bits the slope λ = ln 2 is a known result used by HMMER). Only the location τ = ${cal.tau.toFixed(2)} has to be estimated by simulation – exactly what <code>hmmbuild</code> does when it calibrates a model. Then</p>
            <p class="hm-formula">P(random score ≥ S) = 2<sup>−(S − τ)</sup> &nbsp;&nbsp;&nbsp; E = N · 2<sup>−(S − τ)</sup></p>
            ${this.V.lesson(`<strong>Reading HMMER output:</strong> the <em>score</em> (bits) depends only on the model and the sequence; the <em>E-value</em> is the number of hits this good expected by chance in a database of this size – as in BLAST. Every extra bit halves the E-value; a 10× larger database multiplies it by 10. HMMER's default reporting threshold is E ≤ 10, its "inclusion" threshold for trusted hits E ≤ 0.01.`)}`;
    }

    // ------------------------------------------------------------ step 6: PSSM vs HMM
    stepPssm() {
        const stats = MsaEngine.columnStats(this.rows, this.type, { pseudocount: Math.max(0.5, +this.$('f-epseudo').value) });
        const variants = ['member', 'insertion', 'deletion', 'shuffled', 'random'].filter(k => this.queries[k]);
        const labels = { member: 'family member', insertion: 'member with an insertion', deletion: 'member with a deletion', shuffled: 'shuffled member', random: 'random sequence' };
        const res = variants.map(k => {
            const s = this.queries[k];
            const scan = MsaEngine.scanPSSM(s, stats);
            const v = this.H.profileViterbi(this.P, s, this.mode());
            return { k, s, pssm: scan.best ? scan.best.score : null, width: scan.width, hmm: v.score, aln: v.alignment, scan };
        });
        const base = res.find(r => r.k === 'member');
        const rows = res.map(r => `<tr><td>${labels[r.k]}</td><td class="hm-mono">${this.V.esc(r.s.length > 50 ? r.s.slice(0, 48) + '…' : r.s)}</td>
            <td>${r.pssm === null ? '– (shorter than the PSSM)' : r.pssm.toFixed(1)}${base && base.pssm && r.k !== 'member' && r.pssm !== null ? ` <span class="dp-hint">(${Math.round(100 * r.pssm / base.pssm)} %)</span>` : ''}</td>
            <td>${r.hmm.toFixed(1)}${base && r.k !== 'member' ? ` <span class="dp-hint">(${Math.round(100 * r.hmm / base.hmm)} %)</span>` : ''}</td></tr>`).join('');
        const ins = res.find(r => r.k === 'insertion');
        return `<h3>PSSM versus profile HMM</h3>
            <p>A <strong>PSSM</strong> (MSA Workbench) is a profile without gaps: it has one score per residue for each core column and is slid along the sequence as an <em>ungapped</em> window of ${res[0].width} positions. The profile HMM's match states hold the same kind of information, but the insert and delete states let the query have extra or missing residues. Both built from the same alignment:</p>
            <table class="bl-table"><tr><th>query</th><th>sequence</th><th>PSSM, best window (bits)</th><th>profile HMM, Viterbi (bits)</th></tr>${rows}</table>
            ${ins ? `<h4>How the HMM handles the insertion</h4>${this.hmmerBlock(ins.aln, 'insertion')}` : ''}
            ${this.V.lesson(`<strong>Insertions and deletions break a PSSM.</strong> After an inserted residue, every following residue of the window sits one column off, so the conserved positions no longer line up and the score collapses. The profile HMM puts the extra residues into an insert state (or skips missing ones with delete states), pays a small, position-specific transition cost, and keeps scoring the rest correctly. PSI-BLAST builds PSSMs and handles gaps with a fixed gap penalty; profile HMMs make gap costs part of the family model.`)}`;
    }

    // ------------------------------------------------------------ step 7: database search
    stepSearch() {
        if (this.exKey !== 'family') {
            return `<h3>Searching a database: HMMER versus BLAST</h3>
                <p>This experiment uses the synthetic domain family, where we know exactly which database sequences are homologs.</p>
                <button class="primary" data-act="load-family">Load the synthetic family</button>`;
        }
        if (!this.search) {
            setTimeout(() => { this.runSearch(); if (this.step === 7) this.showStep(7); }, 30);
            return `<h3>Searching a database: HMMER versus BLAST</h3><p class="hm-busy">Building the database, calibrating the model and searching…</p>`;
        }
        const S = this.search;
        const fmtE = e => e === null ? '–' : e < 1e-3 || e >= 1e3 ? e.toExponential(1) : e.toPrecision(2);
        const thr = 0.01;
        const rows = S.rows.slice().sort((a, b) => a.hmmE - b.hmmE).map(r => {
            const hom = r.truth.kind === 'homolog';
            const fH = r.hmmE <= thr, fB = r.blastE !== null && r.blastE <= thr;
            return `<tr class="${hom ? 'hm-hom' : ''}"><td>${r.name}</td><td>${hom ? `homolog, fidelity ${Math.round(r.truth.fidelity * 100)} %` : 'unrelated'}</td><td>${hom ? Math.round(r.identity * 100) + ' %' : ''}</td>
                <td class="${fB ? (hom ? 'dp-green' : 'dp-red') : ''}">${fmtE(r.blastE)}</td><td class="${fH ? (hom ? 'dp-green' : 'dp-red') : ''}">${fmtE(r.hmmE)} <span class="dp-hint">(${r.hmmScore.toFixed(1)} bits)</span></td></tr>`;
        }).join('');
        const nHom = S.rows.filter(r => r.truth.kind === 'homolog').length;
        const cnt = f => S.rows.filter(r => r.truth.kind === 'homolog' && f(r)).length;
        const fp = f => S.rows.filter(r => r.truth.kind !== 'homolog' && f(r)).length;
        const hF = r => r.hmmE <= thr, bF = r => r.blastE !== null && r.blastE <= thr;
        const qOpts = this.names.map((n, k) => `<option value="${k}" ${k === this.blastQuery ? 'selected' : ''}>${n}</option>`).join('');
        return `<h3>Searching a database: HMMER versus BLAST</h3>
            <p>A database of ${S.rows.length} protein sequences: ${nHom} planted members of the family (each embedded in random flanking sequence; "fidelity" = the share of positions that follow the family's residue preferences, the rest random) and ${S.rows.length - nHom} unrelated random proteins. We search it twice:</p>
            <ul class="hm-list"><li><strong>BLASTP</strong> (BLAST Explorer engine) with one family member as the query: <select data-act-input="blastq">${qOpts}</select></li>
            <li><strong>The profile HMM</strong> built from all ${this.rows.length} family members (local Forward score, E-value from simulation, as <code>hmmsearch</code>).</li></ul>
            <div class="dp-buttons input-controls hm-tight"><button data-act="new-db">New database</button></div>
            <p>Found with E ≤ ${thr}: <strong>BLAST ${cnt(bF)} of ${nHom}</strong> homologs${fp(bF) ? ` (+${fp(bF)} false)` : ''}, <strong>profile HMM ${cnt(hF)} of ${nHom}</strong>${fp(hF) ? ` (+${fp(hF)} false)` : ''}.</p>
            <table class="bl-table hm-search"><tr><th>sequence</th><th>planted</th><th>identity to BLAST query</th><th>BLAST E</th><th>profile HMM E</th></tr>${rows}</table>
            <p class="dp-hint">Sorted by the HMM E-value; green = true homolog found, red = unrelated sequence reported. Identity measured over the aligned region of a global alignment with the BLAST query.</p>
            <h4>The same search in the practical</h4>
<pre class="hm-cmd"># build the model from an alignment (Stockholm, or aligned FASTA)
hmmbuild family.hmm family.sto
# search a sequence database with the model
hmmsearch --tblout hits.tbl -E 0.01 family.hmm database.fasta > hits.txt
# the reverse: search one protein against a library of models (e.g. Pfam)
hmmpress Pfam-A.hmm
hmmscan Pfam-A.hmm protein.fasta
# add sequences to an existing alignment using the model
hmmalign family.hmm new_sequences.fasta</pre>
            ${this.V.lesson(`<strong>Why the profile wins:</strong> the homologs are only about a third identical to any single member – typical for a protein family. BLAST compares them with one sequence and treats every position alike; the profile knows which positions are invariant, which tolerate a chemical class, and which do not matter, and scores accordingly. That is why Pfam and InterPro use profile HMMs to find domains, and why remote homologs are found by profile methods (HMMER, PSI-BLAST, HHpred) long after BLAST gives up. The price: you first need a good multiple alignment of the family.`)}`;
    }

    runSearch() {
        const rng = new this.H.Rng(`db-${this.familySeed}-${this.dbSeed}`);
        const db = [];
        const query = this.rows[this.blastQuery].replace(/-/g, '');
        for (const f of [1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4]) {
            const mem = this.H.familyMember(this.family, rng, f);
            db.push({ name: '', seq: this.H.randomSeq(this.P.bg, rng.int(10, 50), rng) + mem.seq + this.H.randomSeq(this.P.bg, rng.int(10, 50), rng), core: mem.seq, truth: { kind: 'homolog', fidelity: f } });
        }
        for (let k = 0; k < 22; k++) db.push({ name: '', seq: this.H.randomSeq(this.P.bg, rng.int(60, 160), rng), truth: { kind: 'unrelated' } });
        const order = rng.shuffle(db.map((_, i) => i));
        const dbs = order.map((i, n) => Object.assign(db[i], { name: `seq${String(n + 1).padStart(2, '0')}` }));
        const cal = this.H.calibrate(this.P, 100, new this.H.Rng('dbcal-' + this.buildId), 200, 'local');
        const bl = BlastEngine.search(query, dbs, Object.assign({}, BlastEngine.PROGRAMS.blastp), {});
        const rows = dbs.map((d, i) => {
            const hits = bl.results.filter(r => r.subject === i);
            const f = this.H.profileForward(this.P, d.seq, 'local');
            return { name: d.name, truth: d.truth, identity: d.core ? this.H.identity(query, d.core, 'PROTEIN') : null,
                     blastE: hits.length ? Math.min(...hits.map(h => h.evalue)) : null, hmmScore: f.score, hmmE: this.H.evalue(f.score, cal.tau, dbs.length) };
        });
        this.search = { rows, tau: cal.tau };
    }

    // ------------------------------------------------------------ events
    onClick(e) {
        const col = e.target.closest('[data-col]');
        if (col) {
            const c = +col.dataset.col;
            this.isMatch = this.P.isMatch.slice();
            this.isMatch[c] = !this.isMatch[c];
            if (!this.isMatch.some(Boolean)) { this.isMatch[c] = true; return; }
            this.build();
            return;
        }
        const nd = e.target.closest('.hm-node[data-k], [data-node]');
        if (nd) { this.node = +(nd.dataset.k || nd.dataset.node); if (this.step === 1) this.showStep(2); else this.showStep(this.step); return; }
        const cell = e.target.closest('td[data-pk]');
        if (cell) { this.cellSel = { k: +cell.dataset.pk, i: +cell.dataset.pi }; this.showStep(4); return; }
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        if (act === 'sample') { this.sampleMore(); this.showStep(3); }
        else if (act === 'load-family') { this.loadExample('family'); this.showStep(7); }
        else if (act === 'new-db') { this.dbSeed++; this.search = null; this.showStep(7); }
    }

    onInput(e) {
        const t = e.target;
        if (t.dataset.actInput === 'dbexp') { this.dbExp = +t.value; this.showStep(5); }
        else if (t.dataset.actInput === 'blastq') { this.blastQuery = +t.value; this.search = null; this.showStep(7); }
    }
}
