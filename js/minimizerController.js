/**
 * MINIMIZER MAPPING LAB – controller
 * ==================================
 * Tab 1 minimizers · tab 2 index and anchors · tab 3 chaining and base-level
 * alignment · tab 4 repeats and MAPQ · tab 5 mapping lab · quiz.
 * Deep links: #mz, #seed, #chain, #mapq, #lab, #quiz.
 */
const MM_READS = [
    ['unique', 'unique sequence, 10 % errors'],
    ['reverse', 'from the reverse strand'],
    ['noisy', '15 % errors'],
    ['spanning', 'spans a repeat copy'],
    ['inside', 'lies inside a repeat copy'],
    ['polyA', 'covers the poly-A run']
];
const ALN_PARAMS = { type: 'DNA', gapModel: 'affine', gap: -2, gapOpen: -6, gapExtend: -2, endGaps: 'penalized', substitution: { kind: 'simple', match: 2, mismatch: -4 } };

class MinimizerApp {
    constructor() {
        this.E = MinimizerEngine; this.V = MinimizerViews;
        this.$ = id => document.getElementById(id);
        this.t1 = { k: 5, w: 4, order: 'lex', win: 0, mm: 2, seed: 1 };
        this.ix = { k: 15, w: 10, occ: 20, order: 'hash' };
        this.readKind = 'unique'; this.mapqKind = 'inside'; this.selAnchor = null;
        this.lab = { err: 10, len: 'mid', seed: 1, res: null };
        this.ref = this.E.buildReference({ G: 20000, families: 3, copies: 2, repeatLength: 800, polyA: 40, seed: 1 });
        this.quiz = new MinimizerQuiz(this);

        document.querySelectorAll('.bl-tab').forEach(b => b.addEventListener('click', () => this.showTab(b.dataset.tab)));
        const fmt = { k: v => v, w: v => v, occ: v => v > 50 ? 'never' : v + '×' };
        for (const key of ['k', 'w', 'occ']) {
            const el = this.$('ix-' + key); el.value = this.ix[key]; this.$(`ix-${key}-value`).textContent = fmt[key](this.ix[key]);
            el.addEventListener('input', () => { this.ix[key] = +el.value; this.$(`ix-${key}-value`).textContent = fmt[key](this.ix[key]); this.lab.res = null; clearTimeout(this.ixT); this.ixT = setTimeout(() => this.showTab(this.tab), 120); });
        }
        document.querySelectorAll('input[name="ix-order"]').forEach(r => r.addEventListener('change', () => { this.ix.order = r.value; this.lab.res = null; this.showTab(this.tab); }));
        for (const id of ['mz', 'seed', 'chain', 'mapq', 'lab']) {
            this.$(id + '-content').addEventListener('click', e => this.onClick(e, id));
            this.$(id + '-content').addEventListener('input', e => this.onInput(e, id));
            this.$(id + '-content').addEventListener('change', e => this.onInput(e, id));
        }
        const m = /^#(mz|seed|chain|mapq|lab|quiz)$/.exec(location.hash);
        this.showTab(m ? m[1] : 'mz');
    }

    showTab(tab) {
        this.tab = tab;
        document.querySelectorAll('.bl-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        for (const t of ['mz', 'seed', 'chain', 'mapq', 'lab', 'quiz']) this.$('tab-' + t).hidden = t !== tab;
        document.querySelectorAll('.side-panel [data-for]').forEach(s => { s.hidden = !s.dataset.for.split(' ').includes(tab); });
        history.replaceState(null, '', '#' + tab);
        ({ mz: () => this.renderMz(), seed: () => this.renderSeed(), chain: () => this.renderChain(), mapq: () => this.renderMapq(), lab: () => this.renderLab(), quiz: () => this.quiz.ensure() })[tab]();
    }
    lesson(h) { return `<div class="bl-lesson">${h}</div>`; }
    index() {
        const key = `${this.ix.k}-${this.ix.w}-${this.ix.order}`;
        if (!this._ix || this._ix.key !== key) this._ix = Object.assign(this.E.buildIndex(this.ref.seq, this.ix.k, this.ix.w, this.ix.order), { key });
        return this._ix;
    }
    maxOcc() { return this.ix.occ > 50 ? Infinity : this.ix.occ; }

    // =====================================================================
    // TAB 1 – minimizers
    // =====================================================================
    seqA() { const r = new this.E.Rng('mz-a-' + this.t1.seed); return r.seq(34) + 'AAAAAAAAAAAA' + r.seq(26); }

    renderMz() {
        const s = this.t1, A = this.seqA(), k = s.k, w = s.w;
        const mz = this.E.minimizers(A, k, w, s.order), n = mz.nKmers;
        s.win = Math.min(s.win, mz.windows.length - 1);
        const win = mz.windows[s.win], sel = new Set(mz.list.map(m => m.pos));
        const inWin = i => i >= win.start && i < win.start + w + k - 1;
        const letters = A.split('').map((c, i) => `<span class="mm-c ${inWin(i) ? 'mm-win' : ''} ${i >= win.pos && i < win.pos + k ? 'mm-min' : ''} ${i >= 34 && i < 46 ? 'mm-polyA' : ''}"><small>${i % 5 === 0 ? i : ''}</small>${c}</span>`).join('');
        // bars for all selected minimizers, packed in rows
        const rows = []; for (const m of mz.list) { let r = rows.findIndex(e => e < m.pos); if (r < 0) { r = rows.length; rows.push(-1); } rows[r] = m.pos + k - 1; m._row = r; }
        const bars = rows.map((_, r) => `<div class="mm-barrow">${mz.list.filter(m => m._row === r).map(m => `<span class="mm-bar" style="left:${m.pos * 17}px;width:${k * 17 - 2}px" title="${m.kmer} (${m.value})">${m.kmer}</span>`).join('')}</div>`).join('');
        const wk = Array.from({ length: w }, (_, j) => { const p = win.start + j; return `<tr class="${p === win.pos ? 'sel' : ''}"><td>${p}</td><td class="bl-mono">${A.substr(p, k)}</td><td>${mz.vals[p]}</td></tr>`; }).join('');
        // density on a long random sequence
        const R = new this.E.Rng('dens').seq(20000), dLex = this.E.minimizers(R, k, w, 'lex'), dHash = this.E.minimizers(R, k, w, 'hash');
        const aShare = d => d.list.filter(m => m.kmer[0] === 'A').length / d.list.length;
        const aRich = d => d.list.reduce((t, m) => t + m.kmer.split('A').length - 1, 0) / (d.list.length * k);
        // guarantee
        const rngB = new this.E.Rng('mz-b-' + s.seed + '-' + s.mm);
        const B = A.split(''), mut = new Set();
        while (mut.size < s.mm) mut.add(rngB.int(0, A.length - 1));
        for (const p of mut) B[p] = 'ACGT'.replace(B[p], '')[rngB.int(0, 2)];
        const Bs = B.join(''), mzB = this.E.minimizers(Bs, k, w, s.order);
        const setA = new Set(mz.list.map(m => m.pos + ':' + m.kmer)), shared = mzB.list.filter(m => setA.has(m.pos + ':' + m.kmer));
        let run = 0, best = 0; for (let i = 0; i < A.length; i++) { run = mut.has(i) ? 0 : run + 1; best = Math.max(best, run); }
        const need = w + k - 1;
        const sharedSet = new Set(shared.map(m => m.pos));
        const lineA = A.split('').map((c, i) => `<span class="mm-c ${[...sharedSet].some(p => i >= p && i < p + k) ? 'mm-shared' : ''}">${c}</span>`).join('');
        const lineB = Bs.split('').map((c, i) => `<span class="mm-c ${mut.has(i) ? 'mm-mut' : ''} ${[...sharedSet].some(p => i >= p && i < p + k) ? 'mm-shared' : ''}">${c}</span>`).join('');
        this.$('mz-content').innerHTML = `<h3 class="as-h">Keep only one k-mer per window</h3>
            <p>Indexing every k-mer (Genome Index Lab, tab 1) stores one entry per base of the genome – yet neighbouring k-mers overlap in k − 1 letters and carry almost the same information. A <strong>minimizer</strong> scheme slides a window of <strong>w</strong> consecutive k-mers along the sequence and keeps only the <em>smallest</em> k-mer in each window. Neighbouring windows usually choose the same k-mer, so only a fraction of the k-mers is kept.</p>
            <div class="mm-controls">
                <label>k = <input type="range" min="3" max="8" value="${k}" data-t1="k"> <strong>${k}</strong></label>
                <label>w = <input type="range" min="2" max="8" value="${w}" data-t1="w"> <strong>${w}</strong></label>
                <label>order: <select data-t1="order"><option value="lex" ${s.order === 'lex' ? 'selected' : ''}>alphabetical (A &lt; C &lt; G &lt; T)</option><option value="hash" ${s.order === 'hash' ? 'selected' : ''}>by a hash (pseudo-random)</option></select></label>
                <button data-t1new="1">⟳ New sequence</button>
            </div>
            <div class="mm-seq">${letters}</div>
            <div class="dp-answer-row"><label>window</label><input type="range" min="0" max="${mz.windows.length - 1}" value="${s.win}" data-t1="win" style="flex:1"><strong>${s.win + 1} / ${mz.windows.length}</strong></div>
            <div class="bl-two"><div><table class="bl-table bw-small"><tr><th>position</th><th>k-mer</th><th>value</th></tr>${wk}</table><p class="dp-hint">The window (blue) holds ${w} k-mers; the smallest value (yellow) is its minimizer. ${s.order === 'lex' ? 'Alphabetical: the value is the k-mer read as a base-4 number (A = 0 … T = 3).' : 'Hash: the base-4 number is scrambled by an invertible hash, so the order looks random.'}</p></div>
            <div style="min-width:0"><h4>All ${mz.list.length} minimizers of the ${n} k-mers</h4><div class="mm-plot"><div class="mm-bars" style="width:${A.length * 17}px">${bars}</div></div></div></div>
            <table class="bl-table hm-narrow"><tr><th></th><th>alphabetical</th><th>hash</th><th>theory 2/(w+1)</th></tr>
                <tr><td>fraction of k-mers kept (random 20 kb)</td><td>${(dLex.list.length / dLex.nKmers).toFixed(3)}</td><td>${(dHash.list.length / dHash.nKmers).toFixed(3)}</td><td>${(2 / (w + 1)).toFixed(3)}</td></tr>
                <tr><td>minimizers beginning with A (random 20 kb)</td><td>${(100 * aShare(dLex)).toFixed(0)} %</td><td>${(100 * aShare(dHash)).toFixed(0)} %</td><td>25 % if unbiased</td></tr>
                <tr><td>share of A among all minimizer letters</td><td>${(100 * aRich(dLex)).toFixed(0)} %</td><td>${(100 * aRich(dHash)).toFixed(0)} %</td><td>25 % if unbiased</td></tr></table>
            <p><strong>Why a hash?</strong> In alphabetical order every window prefers k-mers starting with A, and AAAA… is the smallest of all: minimizers pile up in A-rich and low-complexity sequence (see the table) – exactly the frequent, uninformative k-mers a mapper cannot use. (Inside the poly-A run above every k-mer is the same, so any order picks it – such runs are simply ignored by the frequency filter of tab 2.) A pseudo-random order spreads minimizers evenly (density ≈ 2/(w+1)) and does not prefer low-complexity sequence. minimap2 uses a hash.</p>
            <h4>The guarantee</h4>
            <p>If two sequences share an exact stretch of at least <strong>w + k − 1 = ${need}</strong> bases, that stretch contains a whole window of w k-mers – and both sequences choose the same minimizer in it. Below: the same sequence with <input type="range" min="0" max="8" value="${s.mm}" data-t1="mm" style="width:120px"> <strong>${s.mm}</strong> substitutions (red).</p>
            <div class="mm-seq mm-pair"><div><span class="mm-lab">A</span>${lineA}</div><div><span class="mm-lab">B</span>${lineB}</div></div>
            <p>Longest error-free stretch: <strong>${best}</strong> bp ${best >= need ? `≥ ${need}: guaranteed shared minimizer` : `< ${need}: no guarantee`}. Shared minimizers (green): <strong>${shared.length}</strong>. ${best >= need && !shared.length ? '' : ''}Every shared minimizer is a <strong>seed</strong> that finds B from A.</p>
            ${this.lesson(`<strong>The trade-off:</strong> larger w → smaller index (fewer minimizers) but a longer exact stretch is needed to guarantee a hit; larger k → fewer chance hits but more k-mers destroyed by errors. With 10 % errors an exact stretch of 25 bp is still common in a 10 kb read, so k = 15, w = 10 works for nanopore reads and stores about 2/11 ≈ 18 % of the k-mers.
            <br><strong>Other samplings.</strong> Minimizers depend on the neighbouring k-mers, so one error can change several choices. <em>Syncmers</em> (Edgar, 2021) select a k-mer by its own content only (e.g. its smallest s-mer is at the start), so the same k-mer is chosen in both sequences regardless of context. <em>Strobemers</em> (Sahlin, 2021) link several short k-mers at variable distances into one seed that survives insertions and deletions. Both are used in newer mappers (e.g. strobealign).`)}`;
    }

    // =====================================================================
    // TAB 2 – index and anchors
    // =====================================================================
    presetRead(kind) {
        const G = this.ref.seq.length, reps = this.ref.repeats;
        const free = (s, len) => !reps.some(r => s < r.end + 50 && s + len > r.start - 50);
        const rng = new this.E.Rng('preset-' + kind);
        const uniqueStart = len => { for (let t = 0; t < 500; t++) { const s = rng.int(0, G - len); if (free(s, len)) return s; } return 0; };
        const rep = reps.find(r => !r.polyA), poly = reps.find(r => r.polyA);
        const cfg = {
            unique: { len: 1000, start: uniqueStart(1000), strand: 1, err: 0.1 },
            reverse: { len: 1000, start: uniqueStart(1000), strand: -1, err: 0.1 },
            noisy: { len: 1000, start: uniqueStart(1000), strand: 1, err: 0.15 },
            spanning: { len: 1300, start: rep.start - 250, strand: 1, err: 0.08 },
            inside: { len: 600, start: rep.start + 100, strand: 1, err: 0.08 },
            polyA: { len: 800, start: Math.max(0, poly.start - 380), strand: 1, err: 0.08 }
        }[kind];
        const r = this.E.simulateReads(this.ref, { n: 1, minLen: cfg.len, maxLen: cfg.len, fixedStart: cfg.start, strand: cfg.strand, errorRate: cfg.err, seed: 'p-' + kind })[0];
        r.name = kind;
        return r;
    }
    mapped(kind) {
        const key = `${kind}-${this.index().key}-${this.ix.occ}`;
        if (!this._mapped || this._mapped.key !== key) { const read = this.presetRead(kind); this._mapped = { key, read, res: this.E.mapRead(read, this.index(), { maxOcc: this.maxOcc() }) }; this._mapped.res.anchors.forEach((a, i) => { a._i = i; }); }
        return this._mapped;
    }
    readButtons(cur, act) { return `<div class="dp-options">${MM_READS.map(([v, t]) => `<button data-${act}="${v}" class="${cur === v ? 'correct' : ''}">${t}</button>`).join('')}</div>`; }
    readInfo(r) { return `${r.len} bp, ${r.strand > 0 ? '+' : '−'} strand, from reference ${r.start + 1}–${r.end} (true origin, green bar); errors: ${r.errors.subs} substitutions, ${r.errors.ins} insertions, ${r.errors.dels} deletions`; }

    renderSeed() {
        const ix = this.index(), M = this.mapped(this.readKind), r = M.read, res = M.res;
        const G = this.ref.seq.length;
        const readMz = this.E.minimizers(r.seq, ix.k, ix.w, ix.order).list.length + this.E.minimizers(this.E.revcomp(r.seq), ix.k, ix.w, ix.order).list.length;
        const nFw = res.anchors.filter(a => a.strand > 0).length, nRv = res.anchors.length - nFw;
        const freqHist = [...ix.idx.values()].map(v => v.length);
        const rep = freqHist.filter(c => c > 1).length;
        this.$('seed-content').innerHTML = `<h3 class="as-h">A minimizer index of the reference, and anchors</h3>
            <p>The reference (${G.toLocaleString()} bp) is indexed once: for every minimizer, the positions where it occurs. With k = ${ix.k}, w = ${ix.w}: <strong>${ix.entries.toLocaleString()}</strong> positions stored instead of ${ix.kmers.toLocaleString()} for all k-mers (${(100 * ix.entries / ix.kmers).toFixed(0)} %); ${ix.distinct.toLocaleString()} distinct minimizers, ${rep} of them at more than one place (repeats).</p>
            <p>To map a read, compute <em>its</em> minimizers – of the read and of its reverse complement, since the strand is unknown – and look each up. Every hit is an <strong>anchor</strong>: (position in the read, position in the reference, strand).</p>
            ${this.readButtons(this.readKind, 'read')}
            <p class="dp-hint">Read: ${this.readInfo(r)}.</p>
            <div class="mm-plot">${this.V.dotplot(res.anchors, { t0: 0, t1: G, qLen: r.len, truth: r, repeats: this.ref.repeats })}</div>
            <p class="dp-hint">Blue: anchors on the + strand; orange: the read reverse-complemented (− strand). Shaded: repeat copies (orange) and the poly-A run (violet).</p>
            <table class="bl-table hm-narrow"><tr><td>minimizers of the read (both strands)</td><td>${readMz}</td></tr><tr><td>anchors found</td><td>${res.anchors.length} (${nFw} +, ${nRv} −)</td></tr><tr><td>minimizers ignored as too frequent (&gt; ${this.ix.occ > 50 ? '∞' : this.ix.occ}×)</td><td>${res.filtered}</td></tr></table>
            ${this.lesson(`<strong>What the dotplot shows:</strong> anchors from the true origin line up on a diagonal – read position and reference position increase together. With 10 % errors many minimizers of the read are damaged, so only some of the true anchors appear; the rest of the plot is random matches and repeats. The mapper's task is to find the diagonal: <em>chaining</em> (tab 3). <strong>Memory:</strong> the human genome gives about 2/(w+1) × 3.1 × 10<sup>9</sup> ≈ 5.6 × 10<sup>8</sup> minimizer positions for w = 10 – a minimap2 index of about 7 GB, built in minutes.`)}`;
    }

    // =====================================================================
    // TAB 3 – chaining and alignment
    // =====================================================================
    renderChain() {
        const M = this.mapped(this.readKind), r = M.read, res = M.res, ch = res.chain, P = ch.primary;
        const G = this.ref.seq.length;
        const t0 = P ? Math.max(0, P.tStart - 400) : 0, t1 = P ? Math.min(G, P.tEnd + 400) : G;
        const chainsDraw = ch.chains.map((c, i) => ({ anchors: c.anchors, color: i === 0 ? '#16a34a' : ch.secondaries.includes(c) ? '#d97706' : '#94a3b8', width: i === 0 ? 3 : 2 }));
        let sel = '';
        if (this.selAnchor !== null && res.anchors[this.selAnchor]) {
            const a = res.anchors[this.selAnchor], d = ch.dp.find(x => x.strand === a.strand), i = d.A.indexOf(a);
            if (i >= 0) {
                const cands = d.considered[i].slice().sort((x, y) => y.score - x.score).slice(0, 6);
                sel = `<h4>Anchor: read ${a.q + 1} ↔ reference ${a.t + 1}</h4><p>f = <strong>${d.f[i].toFixed(1)}</strong>${d.pred[i] >= 0 ? `, best predecessor: read ${d.A[d.pred[i]].q + 1} ↔ reference ${d.A[d.pred[i]].t + 1}` : ' – starts a new chain (score k)'}.</p>
                ${cands.length ? `<table class="bl-table bw-small"><tr><th>predecessor</th><th>f(j)</th><th>+ α (matched)</th><th>− β (gap cost)</th><th>= candidate</th></tr>${cands.map(c => `<tr class="${c.j === d.pred[i] ? 'sel' : ''}"><td>${d.A[c.j].q + 1} ↔ ${d.A[c.j].t + 1}</td><td>${d.f[c.j].toFixed(1)}</td><td>${c.alpha}</td><td>${c.beta.toFixed(2)}</td><td>${c.score.toFixed(1)}</td></tr>`).join('')}</table>` : '<p class="dp-hint">No anchor before it within the gap and bandwidth limits.</p>'}`;
            }
        }
        const rows = ch.chains.map((c, i) => `<tr class="${i === 0 ? 'sel' : ''}"><td>${i === 0 ? 'primary' : ch.secondaries.includes(c) ? 'secondary' : 'other'}</td><td>${c.strand > 0 ? '+' : '−'}</td><td>${c.anchors.length}</td><td>${c.score.toFixed(1)}</td><td>${c.qStart + 1}–${c.qEnd}</td><td>${c.tStart + 1}–${c.tEnd}</td></tr>`).join('');
        // base-level alignment of the primary chain region
        let aln = '<p>No chain – the read cannot be placed.</p>';
        if (P) {
            const reg = this.E.alignmentRegion(r, P, G), ref = this.ref.seq.slice(reg.tStart, reg.tEnd);
            const key = `${this._mapped.key}-aln`;
            if (!this._aln || this._aln.key !== key) this._aln = { key, a: AlignEngine.globalAlign(reg.query, ref, ALN_PARAMS), reg };
            const A = this._aln.a;
            let m = 0, x = 0, ins = 0, del = 0;
            for (let i = 0; i < A.aligned1.length; i++) { const p = A.aligned1[i], q = A.aligned2[i]; if (p === '-') del++; else if (q === '-') ins++; else if (p === q) m++; else x++; }
            const cg = this.E.cigar(A.aligned1, A.aligned2);
            aln = `<p>The chain tells <em>where</em>; the exact alignment is computed only there: the read (${P.strand > 0 ? 'as sequenced' : 'reverse-complemented'}) against reference ${reg.tStart + 1}–${reg.tEnd}, with affine gaps (match +2, mismatch −4, gap open −6, extend −2 – the same dynamic programming as in the alignment trainers).</p>
                <table class="bl-table hm-narrow"><tr><td>identical / mismatched columns</td><td>${m} / ${x}</td></tr><tr><td>insertions / deletions (bases)</td><td>${ins} / ${del}</td></tr><tr><td>identity</td><td>${(100 * m / (m + x + ins + del)).toFixed(1)} %</td></tr>
                <tr><td>simulated errors in the read</td><td>${r.errors.subs} subs, ${r.errors.ins} ins, ${r.errors.dels} dels</td></tr>
                <tr><td>CIGAR (as in a SAM/BAM file)</td><td class="bl-mono mm-cigar">${cg.length > 160 ? cg.slice(0, 160) + '…' : cg}</td></tr></table>
                <details class="hm-details"><summary>Show the alignment</summary>${this.V.alignmentBlock(A.aligned1, A.aligned2, 0, reg.tStart)}</details>`;
        }
        this.$('chain-content').innerHTML = `<h3 class="as-h">Chaining: find the diagonal</h3>
            <p>A chain is a series of anchors that increase together in the read and in the reference, as they must if they come from the same place. Chaining is dynamic programming over the anchors sorted by reference position: the best chain ending at anchor i extends the best chain ending at some earlier anchor j,</p>
            <p class="hm-formula">f(i) = max( k, max<sub>j</sub> f(j) + α(j,i) − β(j,i) ) &nbsp;&nbsp; α = min(Δread, Δref, k) &nbsp;&nbsp; β = γ(|Δread − Δref|), γ(l) = 0.01·k·l + ½·log<sub>2</sub> l</p>
            <p>α rewards the bases the two anchors add; β penalises a change of diagonal – an insertion or deletion of l bases between them. Because the penalty grows only slowly, a long read with dozens of indels still forms one chain; exact search (Genome Index Lab) would fail at the first indel.</p>
            ${this.readButtons(this.readKind, 'read')}
            <p class="dp-hint">Read: ${this.readInfo(r)}. Zoomed to the primary chain. <strong>Click an anchor</strong> to see its DP cell.</p>
            <div class="mm-plot">${this.V.dotplot(res.anchors, { t0, t1, qLen: r.len, truth: r, repeats: this.ref.repeats, chains: chainsDraw, clickable: true, selected: this.selAnchor !== null ? res.anchors[this.selAnchor] : null })}</div>
            <p class="dp-hint">Green: primary chain; orange: secondary chains (alternative placements of the same part of the read); grey: other chains.</p>
            ${sel}
            <table class="bl-table"><tr><th>chain</th><th>strand</th><th>anchors</th><th>score</th><th>read</th><th>reference</th></tr>${rows || '<tr><td colspan="6">no chain</td></tr>'}</table>
            <h4>Base-level alignment</h4>${aln}
            ${this.lesson(`<strong>Why it is fast:</strong> a 10 kb read has about 2 000 minimizers but only a few hundred anchors; chaining compares each anchor with up to ~50 predecessors, and the expensive alignment is done only in the one or two regions that chaining selects. minimap2 maps a nanopore read to the human genome in milliseconds. Try the noisy read (15 %) and the reverse-strand read.`)}`;
    }

    // =====================================================================
    // TAB 4 – repeats and MAPQ
    // =====================================================================
    renderMapq() {
        const M = this.mapped(this.mapqKind), r = M.read, res = M.res, ch = res.chain, q = res.mapq, G = this.ref.seq.length;
        const chainsDraw = ch.chains.map((c, i) => ({ anchors: c.anchors, color: i === 0 ? '#16a34a' : ch.secondaries.includes(c) ? '#d97706' : '#94a3b8', width: i === 0 ? 3 : 2 }));
        const rows = ch.chains.map((c, i) => `<tr class="${i === 0 ? 'sel' : ''}"><td>${i === 0 ? 'primary' : ch.secondaries.includes(c) ? 'secondary' : 'other'}</td><td>${c.anchors.length}</td><td>${c.score.toFixed(1)}</td><td>${c.tStart + 1}–${c.tEnd}</td><td>${c.qStart + 1}–${c.qEnd}</td></tr>`).join('');
        const perr = Math.pow(10, -q.mapq / 10);
        this.$('mapq-content').innerHTML = `<h3 class="as-h">Repeats and mapping quality</h3>
            <p>A read from a repeat produces two equally good chains – one per copy. The mapper must report one of them, and say how sure it is: the <strong>mapping quality</strong> MAPQ = −10·log<sub>10</sub>(probability that the placement is wrong). minimap2 estimates it from the best chain score f<sub>1</sub>, the best <em>secondary</em> score f<sub>2</sub> (another placement of the same part of the read) and the number of anchors m:</p>
            <p class="hm-formula">MAPQ = 40 · (1 − f<sub>2</sub>/f<sub>1</sub>) · min(1, m/10) · ln f<sub>1</sub> &nbsp;(capped at 60)</p>
            ${this.readButtons(this.mapqKind, 'mq')}
            <p class="dp-hint">Read: ${this.readInfo(r)}.</p>
            <div class="mm-plot">${this.V.dotplot(res.anchors, { t0: 0, t1: G, qLen: r.len, truth: r, repeats: this.ref.repeats, chains: chainsDraw })}</div>
            <table class="bl-table"><tr><th>chain</th><th>anchors</th><th>score</th><th>reference</th><th>read</th></tr>${rows || '<tr><td colspan="5">no chain</td></tr>'}</table>
            ${ch.primary ? `<p class="hm-formula">MAPQ = 40 · (1 − ${q.f2.toFixed(1)}/${q.f1.toFixed(1)}) · min(1, ${q.m}/10) · ln ${q.f1.toFixed(1)} = <strong>${q.mapq}</strong> &nbsp;→ probability of a wrong placement ≈ ${perr < 1e-4 ? perr.toExponential(0) : perr.toFixed(perr < 0.01 ? 4 : 2)}</p>
            <p>${q.mapq === 0 ? '<strong>MAPQ 0:</strong> the secondary chain is as good as the primary – the read fits two places equally well, and the choice between them is a coin toss. ' : q.mapq < 30 ? 'A secondary chain almost as good as the primary: the placement is uncertain. ' : 'No real alternative: the placement is reliable. '}The primary chain ${res.correct ? 'is' : 'is <strong>not</strong>'} the read's true origin.</p>` : '<p>No chain.</p>'}
            ${this.lesson(`<strong>Compare the three cases.</strong> <em>Inside a repeat copy</em>: two equal chains, MAPQ 0 – the read may be reported at the wrong copy, and a variant caller should ignore it. <em>Spanning a repeat copy</em>: the unique flanks add anchors only to the true copy, so the true chain scores clearly higher – long reads resolve repeats shorter than themselves, the main reason for their success. <em>Unique sequence</em>: no secondary chain, MAPQ 60. Filtering alignments with MAPQ below 20–30 (<code>samtools view -q 20</code>) is a standard first step of variant calling.`)}`;
    }

    // =====================================================================
    // TAB 5 – mapping lab
    // =====================================================================
    runLab() {
        const ix = this.index(), lens = { long: [1000, 3000], mid: [400, 1200], short: [200, 600] }[this.lab.len];
        const reads = this.E.simulateReads(this.ref, { n: 100, minLen: lens[0], maxLen: lens[1], errorRate: this.lab.err / 100, seed: 'lab' + this.lab.seed });
        const t0 = performance.now();
        const res = reads.map(r => this.E.mapRead(r, ix, { maxOcc: this.maxOcc() }));
        this.lab.res = { reads, res, ms: performance.now() - t0, key: `${ix.key}-${this.ix.occ}-${this.lab.err}-${this.lab.len}-${this.lab.seed}` };
    }
    renderLab() {
        const ix = this.index();
        const key = `${ix.key}-${this.ix.occ}-${this.lab.err}-${this.lab.len}-${this.lab.seed}`;
        if (!this.lab.res || this.lab.res.key !== key) this.runLab();
        const { reads, res, ms } = this.lab.res;
        const bins = [[0, 0, 'MAPQ 0'], [1, 29, 'MAPQ 1–29'], [30, 59, 'MAPQ 30–59'], [60, 60, 'MAPQ 60']];
        const binRows = bins.map(([lo, hi, lab]) => { const sel = res.filter(x => x.chain.primary && x.mapq.mapq >= lo && x.mapq.mapq <= hi); const ok = sel.filter(x => x.correct).length; return `<tr><td>${lab}</td><td>${sel.length}</td><td>${sel.length ? `${ok} (${Math.round(100 * ok / sel.length)} %)` : '–'}</td></tr>`; }).join('');
        const unm = res.filter(x => !x.chain.primary).length, anch = res.reduce((a, x) => a + x.anchors.length, 0) / res.length;
        const rows = reads.slice(0, 25).map((r, i) => { const x = res[i], p = x.chain.primary; return `<tr class="${x.correct === false ? 'miss' : ''}"><td>${r.name}</td><td>${r.len}</td><td>${r.start + 1} ${r.strand > 0 ? '+' : '−'}</td><td>${p ? `${p.tStart + 1} ${p.strand > 0 ? '+' : '−'}` : '<span class="dp-red">unmapped</span>'}</td><td>${x.anchors.length}</td><td>${p ? x.mapq.mapq : ''}</td><td>${x.correct === null ? '' : x.correct ? '✔' : '<span class="dp-red">✘</span>'}</td></tr>`; }).join('');
        this.$('lab-content').innerHTML = `<h3 class="as-h">Map 100 simulated reads</h3>
            <div class="mm-controls">
                <label>error rate: <input type="range" min="1" max="20" value="${this.lab.err}" data-lab="err"> <strong>${this.lab.err} %</strong></label>
                <label>read length: <select data-lab="len">${[['short', '200–600 bp'], ['mid', '400–1200 bp'], ['long', '1–3 kb']].map(([v, t]) => `<option value="${v}" ${this.lab.len === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
                <button data-labnew="1">⟳ New reads</button>
            </div>
            <p class="dp-hint">Index settings (k, w, order, frequency filter) in the side panel apply here too. Reads come from random places – some from the repeat copies.</p>
            <div class="as-tiles"><div class="as-tile good"><div class="as-num">${res.filter(x => x.correct).length}</div><div class="as-cap">placed correctly</div></div><div class="as-tile ${res.some(x => x.correct === false) ? 'bad' : ''}"><div class="as-num">${res.filter(x => x.correct === false).length}</div><div class="as-cap">placed wrongly</div></div><div class="as-tile ${unm ? 'bad' : ''}"><div class="as-num">${unm}</div><div class="as-cap">unmapped</div></div><div class="as-tile"><div class="as-num">${ms.toFixed(0)} ms</div><div class="as-cap">for 100 reads</div></div></div>
            <div class="bl-two"><div><h4>Is MAPQ honest?</h4><table class="bl-table"><tr><th>mapping quality</th><th>reads</th><th>correct</th></tr>${binRows}</table></div>
            <div><h4>Index</h4><table class="bl-table"><tr><td>minimizer positions stored</td><td>${ix.entries.toLocaleString()} of ${ix.kmers.toLocaleString()} k-mers</td></tr><tr><td>anchors per read (mean)</td><td>${anch.toFixed(0)}</td></tr></table></div></div>
            <table class="bl-table bw-small"><tr><th>read</th><th>length</th><th>true origin</th><th>mapped to</th><th>anchors</th><th>MAPQ</th><th>correct</th></tr>${rows}</table>
            <p class="dp-hint">First 25 reads shown.</p>
            ${this.lesson(`<strong>Experiments.</strong> (1) Change the read length: reads shorter than the 800 bp repeats can fall inside a copy and get MAPQ 0; kilobase reads span the copies. (2) Raise the error rate: fewer anchors survive, but chaining still finds most reads up to ~15 %; at 20 % reads start to go unmapped. (3) Increase w: a smaller index and fewer anchors – faster, but noisy reads get lost. (4) Set the order to alphabetical: minimizers crowd into A-rich sequence. (5) Switch the frequency filter off ("never"): repeat minimizers add anchors everywhere. Wrong placements should almost only have MAPQ 0 – mapping quality is how the mapper admits uncertainty.`)}`;
    }

    // ------------------------------------------------------------ events
    onClick(e, tab) {
        const t = e.target;
        if (tab === 'mz' && t.closest('[data-t1new]')) { this.t1.seed++; this.renderMz(); return; }
        const rd = t.closest('[data-read]'); if (rd) { this.readKind = rd.dataset.read; this.selAnchor = null; this.showTab(this.tab); return; }
        const mq = t.closest('[data-mq]'); if (mq) { this.mapqKind = mq.dataset.mq; this.renderMapq(); return; }
        const an = t.closest('[data-anchor]'); if (an) { this.selAnchor = +an.dataset.anchor; this.renderChain(); return; }
        if (t.closest('[data-labnew]')) { this.lab.seed++; this.lab.res = null; this.renderLab(); }
    }
    onInput(e, tab) {
        const t = e.target;
        if (t.dataset.t1) { if (t.type === 'range' && e.type !== 'input') return; if (t.tagName === 'SELECT' && e.type !== 'change') return; this.t1[t.dataset.t1] = t.tagName === 'SELECT' ? t.value : +t.value; if (t.dataset.t1 !== 'win') this.t1.win = Math.min(this.t1.win, 999); this.renderMz(); }
        if (t.dataset.lab) { if (e.type !== 'change') return; this.lab[t.dataset.lab] = t.tagName === 'SELECT' ? t.value : +t.value; this.lab.res = null; this.renderLab(); }
    }
}

(function () {
    const start = () => { window.mmApp = new MinimizerApp(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
