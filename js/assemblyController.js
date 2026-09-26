/**
 * ASSEMBLY EXPLORER – controller
 * ==============================
 * Drives assembly.html: three tabs with their own parameter sets
 * (building the graph step by step, repeats, sequencing errors) sharing one
 * side panel, plus the quiz. Deep links: #basics-3, #repeats, #errors, #quiz.
 */
class AssemblyController {
    constructor() {
        this.D = DeBruijn;
        this.$ = id => document.getElementById(id);
        this.keys = ['k', 'uniqueLen', 'repeatLength', 'repeatCopies', 'readLength', 'coverage', 'errorRate', 'pruneThreshold'];
        this.tabs = {};
        for (const t of ['basics', 'repeats', 'errors']) this.tabs[t] = { preset: ASSEMBLY_EXAMPLES[t].findIndex(e => e.name.includes('★')), params: null, view: new AssemblyView(this.$('view-' + t)) };
        for (const t of Object.keys(this.tabs)) this.loadPreset(t, Math.max(0, this.tabs[t].preset), false);
        this.step = 1;
        this.selKmer = null;
        this.quiz = new AssemblyQuiz(this);

        document.querySelectorAll('.bl-tab').forEach(b => b.addEventListener('click', () => this.showTab(b.dataset.tab)));
        document.querySelectorAll('#as-steps .bl-step').forEach(b => b.addEventListener('click', () => this.showStep(+b.dataset.step)));
        this.$('as-prev').addEventListener('click', () => this.showStep(this.step - 1));
        this.$('as-next').addEventListener('click', () => this.showStep(this.step + 1));
        this.$('preset').addEventListener('change', e => this.loadPreset(this.tab, +e.target.value));
        this.$('reroll').addEventListener('click', () => { const T = this.tabs[this.tab]; T.params.seed = (T.params.seed * 1103515245 + 12345) & 0x7fffffff; this.update(); });
        for (const key of this.keys) this.$(key).addEventListener('input', () => this.fromSliders(key));
        this.$('sweep').addEventListener('click', e => { const r = e.target.closest('[data-k]'); if (r) { this.tabs.repeats.params.k = +r.dataset.k; this.syncSliders(); this.update(); } });
        document.querySelector('.game-container').addEventListener('click', e => { const c = e.target.closest('[data-kmer]'); if (c) { this.selKmer = c.dataset.kmer === this.selKmer ? null : c.dataset.kmer; this.renderBasics(); } });
        window.addEventListener('resize', () => this.update());
        const m = /^#(basics|repeats|errors|quiz)(?:-(\d))?$/.exec(location.hash);
        if (m && m[2]) this.step = +m[2];
        this.showTab(m ? m[1] : 'basics');
    }

    // ------------------------------------------------------------ parameters
    loadPreset(tab, i, render = true) {
        const ex = ASSEMBLY_EXAMPLES[tab][i];
        const T = this.tabs[tab];
        T.preset = i;
        T.params = Object.assign({}, this.D.DEFAULTS, ex.params, { seed: 12345 });
        this.selKmer = null;
        if (render) { this.syncSide(); this.update(); }
    }

    syncSide() {
        const T = this.tabs[this.tab];
        if (!T) return;
        const sel = this.$('preset');
        sel.innerHTML = ASSEMBLY_EXAMPLES[this.tab].map((e, i) => `<option value="${i}">${e.name}</option>`).join('');
        sel.value = T.preset;
        this.$('preset-note').textContent = ASSEMBLY_EXAMPLES[this.tab][T.preset].blurb;
        this.syncSliders();
    }

    syncSliders() {
        const p = this.tabs[this.tab].params;
        this.$('k').max = p.readLength;
        const unit = { uniqueLen: ' bp', repeatLength: ' bp', readLength: ' bp', coverage: '×', errorRate: ' %', pruneThreshold: '×' };
        for (const key of this.keys) { this.$(key).value = p[key]; this.$(key + '-value').textContent = p[key] + (unit[key] || ''); }
        const R = p.repeatLength;
        this.$('k-hint').innerHTML = R > 0 && p.repeatCopies > 1
            ? `The repeat is ${R} bp: its copies are told apart only when k − 1 > ${R}, i.e. <strong>k ≥ ${R + 2}</strong>${R + 2 > p.readLength ? ' – impossible with reads of ' + p.readLength + ' bp' : ''}.`
            : 'No repeat in this genome.';
    }

    fromSliders(key) {
        const p = this.tabs[this.tab].params;
        p[key] = +this.$(key).value;
        if (p.k > p.readLength) p.k = p.readLength;
        this.selKmer = null;
        this.syncSliders();
        this.update();
    }

    state(tab = this.tab) { return this.D.assemble(this.tabs[tab].params); }

    // ------------------------------------------------------------ tabs
    showTab(tab) {
        this.tab = tab;
        document.querySelectorAll('.bl-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        for (const t of ['basics', 'repeats', 'errors', 'quiz']) this.$('tab-' + t).hidden = t !== tab;
        this.$('side-params').hidden = this.$('side-legend').hidden = tab === 'quiz';
        document.querySelector('[data-for="quiz"]').hidden = tab !== 'quiz';
        if (tab === 'quiz') { this.quiz.ensure(); history.replaceState(null, '', '#quiz'); return; }
        this.syncSide();
        this.update();
    }

    update() {
        if (this.tab === 'basics') this.showStep(this.step);
        else if (this.tab === 'repeats') this.renderRepeats();
        else if (this.tab === 'errors') this.renderErrors();
    }

    tiles(id, list) {
        this.$(id).innerHTML = list.map(([v, cap, cls]) => `<div class="as-tile ${cls || ''}"><div class="as-num">${v}</div><div class="as-cap">${cap}</div></div>`).join('');
    }
    diag(id, st) { const d = this.$(id); d.className = 'as-diag as-' + st.diagnosis.regime; d.innerHTML = st.diagnosis.text; }

    renderRepeats() {
        const st = this.state('repeats'), s = st.stats, p = st.params;
        this.tiles('tiles-repeats', [[s.nContigs, 'contigs', s.wholeGenome ? 'good' : 'bad'], [s.longest, `longest (genome ${s.G} bp)`], [s.n50, 'N50'], [s.repeatBranches, 'repeat branch nodes', s.repeatBranches ? 'bad' : '']]);
        this.diag('diag-repeats', st);
        this.tabs.repeats.view.render(st);
        this.$('sweep').innerHTML = AssemblyCharts.sweep(this.D.sweepK(p), p.k, p);
        history.replaceState(null, '', '#repeats');
    }

    renderErrors() {
        const st = this.state('errors'), s = st.stats;
        this.tiles('tiles-errors', [[s.nContigs, 'contigs', s.nContigs === 1 && st.contigs[0].correct ? 'good' : 'bad'], [s.errorKmersKept, `error k-mers kept (of ${s.errorKmers})`, s.errorKmersKept ? 'bad' : 'good'], [s.trueKmersLost, 'true k-mers removed', s.trueKmersLost ? 'bad' : ''], [s.n50, `N50 (genome ${s.G} bp)`]]);
        this.diag('diag-errors', st);
        this.tabs.errors.view.render(st);
        this.$('spectrum').innerHTML = AssemblyCharts.spectrum(this.D.spectrum(st.graph), s.threshold);
        history.replaceState(null, '', '#errors');
    }

    // ------------------------------------------------------------ tab 1: step by step
    showStep(n) {
        this.step = Math.max(1, Math.min(4, n));
        document.querySelectorAll('#as-steps .bl-step').forEach(b => b.classList.toggle('active', +b.dataset.step === this.step));
        this.$('as-prev').disabled = this.step === 1; this.$('as-next').disabled = this.step === 4;
        history.replaceState(null, '', '#basics-' + this.step);
        this.renderBasics();
    }

    kmerChips(st, onlyRead = null) {
        const k = st.params.k;
        const list = onlyRead
            ? Array.from({ length: onlyRead.seq.length - k + 1 }, (_, i) => onlyRead.seq.substr(i, k))
            : [...st.graph.edges.values()].sort((a, b) => Math.min(...a.positions) - Math.min(...b.positions)).map(e => e.kmer);
        return `<div class="bl-chips">${list.map(km => { const e = st.graph.edges.get(km); return `<span class="bl-chip ${km === this.selKmer ? 'sel' : ''}" data-kmer="${km}" title="seen ${e.count}× in the reads">${km}${onlyRead ? '' : `<small>${e.count}×</small>`}</span>`; }).join('')}</div>`;
    }

    renderBasics() {
        const st = this.state('basics'), s = st.stats, p = st.params, k = p.k;
        const view = this.tabs.basics.view;
        view.setZones({ reads: true, graph: this.step >= 3, contigs: this.step >= 4 });
        const read0 = st.reads[0];
        const sel = this.selKmer && st.graph.edges.get(this.selKmer) ? this.selKmer : null;
        let text = '', after = '';
        if (this.step === 1) {
            text = `<h3>Step 1 – We have reads, not a genome</h3>
                <p>A sequencer does not read a genome from end to end. It produces millions of short <strong>reads</strong> – here ${s.nReads} reads of ${s.L} bp – from random places of many copies of the genome. The genome is drawn on top only so that you can check the result; the assembler never sees it.</p>
                <p><strong>Coverage</strong> = total read length / genome length = ${s.nReads} × ${s.L} / ${s.G} = <strong>${s.coverage.toFixed(1)}×</strong>: on average every base is read ${s.coverage.toFixed(1)} times. Reads that overlap share sequence – that overlap is all the assembler has to work with.</p>`;
            after = `<div class="bl-lesson"><strong>The assembly problem.</strong> Put the reads back together into the genome. Comparing every read with every other read (overlap–layout–consensus) works for thousands of long reads but not for millions of short ones. The de Bruijn graph avoids pairwise comparisons altogether: it cuts reads into k-mers (step 2) and lets identical k-mers meet in a graph (step 3).</div>`;
        } else if (this.step === 2) {
            text = `<h3>Step 2 – Cut every read into k-mers</h3>
                <p>A <strong>k-mer</strong> is a word of k letters. A read of length L contains L − k + 1 overlapping k-mers: read 1 (${read0.seq}) gives ${read0.seq.length - k + 1} k-mers of length ${k}:</p>
                ${this.kmerChips(st, read0)}
                <p>All reads together give ${st.reads.reduce((a, r) => a + Math.max(0, r.seq.length - k + 1), 0)} k-mers, but only <strong>${s.kmers} distinct</strong> ones: overlapping reads produce the same k-mers again. The number after each k-mer is how many times it was seen. <strong>Click a k-mer</strong> to see where it comes from in the genome.</p>
                ${this.kmerChips(st)}`;
            after = `<div class="bl-lesson"><strong>Why k-mers?</strong> Identical k-mers can be found by simple counting (a hash table) instead of aligning reads to each other. The read boundaries are forgotten – all that is kept is which k-mers exist and how often. Change k in the side panel and compare the lists.</div>`;
        } else if (this.step === 3) {
            const e = sel ? st.graph.edges.get(sel) : null;
            text = `<h3>Step 3 – Connect k-mers into a de Bruijn graph</h3>
                <p>Each k-mer becomes an <strong>edge</strong> from its first k − 1 letters to its last k − 1 letters; the <strong>nodes</strong> are the (k−1)-mers. Two k-mers that overlap by k − 1 letters – consecutive k-mers of the genome – share a node, so the graph threads them together in the order they occur in the genome.</p>
                ${e ? `<p class="as-example">k-mer <code>${sel}</code> → edge <code>${sel.slice(0, -1)}</code> → <code>${sel.slice(1)}</code>, seen ${e.count}×.</p>` : '<p class="dp-hint">Click a k-mer to highlight its edge and its place in the genome.</p>'}
                ${this.kmerChips(st)}
                <p>Here: ${s.nodes} nodes, ${s.kmers} edges. ${s.repeatBranches + s.chanceBranches ? `<strong>${s.repeatBranches + s.chanceBranches} node${s.repeatBranches + s.chanceBranches > 1 ? 's have' : ' has'} more than one way in or out</strong> – a (k−1)-mer that occurs at more than one place in the genome (lifted above the line).` : 'Every node has one way in and one way out: the graph is a single line.'}</p>`;
            after = `<div class="bl-lesson"><strong>Reading the graph.</strong> A node that occurs once in the genome sits on the line under its position. A node that occurs several times has several ways in and out – the graph does not know which way belongs to which copy. Hover over a node for its sequence and genome positions.</div>`;
        } else {
            const whole = s.wholeGenome;
            text = `<h3>Step 4 – Walk the graph: contigs</h3>
                <p>Reading the genome back means walking along the edges and using every k-mer once (an <em>Eulerian path</em>). Where a node has exactly one way in and one way out, there is no choice: such stretches are glued into <strong>contigs</strong> (unitigs). At a branch point the walk could continue in several ways, so the assembler stops the contig there rather than guess.</p>
                <p>${whole ? `<strong>One contig of ${s.G} bp – the whole genome.</strong>` : `<strong>${s.nContigs} contigs</strong> (longest ${s.longest} bp, genome ${s.G} bp).`} ${st.diagnosis.text}</p>`;
            after = `<table class="bl-table"><thead><tr><th>contig</th><th>length</th><th>where in the genome</th></tr></thead><tbody>${st.contigs.map((c, i) => `<tr><td class="bl-mono">${c.seq}</td><td>${c.length}</td><td>${c.loci.length ? c.loci.map(l => `${l + 1}–${l + c.length}`).join(', ') + (c.repeat ? ' (repeat – fits several places)' : '') : '<span class="dp-red">nowhere – misjoined</span>'}</td></tr>`).join('')}</tbody></table>
                <div class="bl-lesson"><strong>Try it:</strong> switch to the preset with a repeat, or lower k until nodes are shared. Every branch point ends contigs, so the genome comes back in pieces. Tabs 2 and 3 explore the two main enemies of assembly: repeats and sequencing errors.</div>`;
        }
        this.$('basics-text').innerHTML = text;
        this.$('basics-after').innerHTML = after;
        view.render(st, sel);
    }
}

(function () {
    const start = () => { window.assembly = new AssemblyController(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
