/**
 * MSA WORKBENCH CONTROLLER
 * ========================
 * Wires msa.html to MsaEngine, MsaEditor and MsaLogo.
 */
class MsaController {
    constructor() {
        this.M = MsaEngine; this.E = AlignEngine;
        this.$ = id => document.getElementById(id);
        this.cellWidth = 20;
        this.seqs = []; this.type = 'PROTEIN';
        this.auto = null;           // progressive() result for the current sequences/params
        this.rows = [];             // current (possibly edited) alignment
        this.stats = null;
        this.selectedCol = null;
        this.currentExample = null;
        this.stepIndex = -1;

        this.editor = new MsaEditor(this.$('editor'), {
            cellWidth: this.cellWidth,
            onChange: rows => { if (this.stepIndex < 0) { this.rows = rows; this.refresh(); } },
            onColumn: col => { this.selectedCol = col; this.renderColumnDetail(); }
        });
        // keep the PSSM table scrolled with the alignment
        this.editor.scroll.addEventListener('scroll', () => { this.$('pssm-wrap').scrollLeft = this.editor.scroll.scrollLeft; });
        this.$('pssm-wrap').addEventListener('scroll', () => { this.editor.scroll.scrollLeft = this.$('pssm-wrap').scrollLeft; });

        this.bind();
        this.populateExamples();
    }

    // ------------------------------------------------------------ binding
    bind() {
        this.$('align-btn').addEventListener('click', () => this.loadFromInput(true));
        this.$('load-raw-btn').addEventListener('click', () => this.loadFromInput(false));
        this.$('example-selector').addEventListener('change', e => { if (e.target.value) this.loadExample(e.target.value); });
        this.$('fasta-input').addEventListener('input', () => { this.currentExample = null; this.$('example-info').hidden = true; this.$('example-selector').value = ''; });

        this.$('remove-gap-cols-btn').addEventListener('click', () => {
            const n = this.editor.removeGapOnlyColumns();
            this.toast(n ? `Removed ${n} gap-only column${n === 1 ? '' : 's'}` : 'No gap-only columns', 'info');
        });
        this.$('reset-btn').addEventListener('click', () => { if (this.auto) { this.endStepping(); this.editor.setRows(this.auto.rows); } });
        this.$('step-btn').addEventListener('click', () => this.startStepping());
        this.$('step-prev').addEventListener('click', () => this.showStep(this.stepIndex - 1));
        this.$('step-next').addEventListener('click', () => this.showStep(this.stepIndex + 1));
        this.$('step-finish').addEventListener('click', () => this.endStepping());

        ['show-logo', 'show-consensus', 'shade-conservation'].forEach(id => this.$(id).addEventListener('change', () => this.refresh()));
        const signed = v => v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0';
        const slider = (id, valueId, fmt, after) => {
            const el = this.$(id);
            el.addEventListener('input', () => { this.$(valueId).textContent = fmt(parseFloat(el.value)); after(); });
        };
        const realign = () => { if (this.seqs.length) this.computeAuto(true); };
        slider('match', 'match-value', signed, realign);
        slider('mismatch', 'mismatch-value', signed, realign);
        slider('gap-open', 'gap-open-value', signed, realign);
        slider('gap-extend', 'gap-extend-value', signed, realign);
        slider('threshold', 'threshold-value', v => v, () => this.refresh());
        slider('pseudocount', 'pseudocount-value', v => v, () => this.refresh());
        this.$('correction').addEventListener('change', () => this.refresh());
        this.$('gap-scale').addEventListener('change', () => this.refresh());
        this.$('scan-btn').addEventListener('click', () => this.scan());
        this.$('scan-input').addEventListener('keydown', e => { if (e.key === 'Enter') this.scan(); });
    }

    populateExamples() {
        const sel = this.$('example-selector');
        const groups = {};
        for (const [key, ex] of Object.entries(MSA_EXAMPLES)) (groups[ex.group || 'Examples'] = groups[ex.group || 'Examples'] || []).push([key, ex]);
        for (const [g, items] of Object.entries(groups)) {
            const og = document.createElement('optgroup'); og.label = g;
            for (const [key, ex] of items) { const o = document.createElement('option'); o.value = key; o.textContent = ex.name; og.appendChild(o); }
            sel.appendChild(og);
        }
    }

    // ------------------------------------------------------------ parameters
    params() {
        const p = this.E.defaultParams(this.type);
        p.gapModel = 'affine';
        p.gapOpen = +this.$('gap-open').value;
        p.gapExtend = +this.$('gap-extend').value;
        if (this.type !== 'PROTEIN') p.substitution = { kind: 'simple', match: +this.$('match').value, mismatch: +this.$('mismatch').value };
        return p;
    }

    applyParams(p) {
        const set = (id, valueId, v) => { this.$(id).value = v; this.$(valueId).textContent = v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0'; };
        if (p.gapOpen !== undefined) set('gap-open', 'gap-open-value', p.gapOpen);
        if (p.gapExtend !== undefined) set('gap-extend', 'gap-extend-value', p.gapExtend);
        if (p.substitution && p.substitution.kind === 'simple') { set('match', 'match-value', p.substitution.match); set('mismatch', 'mismatch-value', p.substitution.mismatch); }
    }

    statOpts() {
        return { threshold: +this.$('threshold').value / 100, pseudocount: +this.$('pseudocount').value, correction: this.$('correction').checked, gapScale: this.$('gap-scale').checked };
    }

    // ------------------------------------------------------------ loading
    loadFromInput(autoAlign) {
        const parsed = this.M.parseFasta(this.$('fasta-input').value);
        if (parsed.length < 2) { this.toast('Enter at least two sequences (FASTA or one per line)', 'error'); return; }
        if (parsed.length > 12) { this.toast('Up to 12 sequences, please – the logo and PSSM must stay readable', 'error'); return; }
        const type = this.M.detectType(parsed);
        const withGaps = parsed.map(s => ({ name: s.name, seq: s.seq.toUpperCase().replace(/[.*]/g, '-') }));
        const clean = this.M.cleanAll(withGaps, type);
        if (clean.some(s => s.seq.length > 400)) { this.toast('Sequences are limited to 400 residues', 'error'); return; }
        // "load as typed": keep gaps, drop anything that is not a residue of this alphabet
        const raw = withGaps.map(s => s.seq.split('').map(ch => ch === '-' ? '-' : this.E.cleanSequence(ch, type)).join(''));
        this.setSequences(clean, type, autoAlign ? null : raw);
    }

    loadExample(key) {
        const ex = MSA_EXAMPLES[key];
        if (!ex) return;
        this.currentExample = ex;
        this.$('fasta-input').value = ex.sequences.map(s => `>${s.name}\n${s.seq}`).join('\n');
        const type = this.M.detectType(ex.sequences);
        this.type = type;
        this.updateTypeUI();
        this.applyParams(Object.assign({ gapOpen: type === 'PROTEIN' ? -10 : -4, gapExtend: -1 }, ex.params || {}));
        this.setSequences(this.M.cleanAll(ex.sequences, type), type, null);
        this.$('example-name').textContent = ex.name;
        this.$('example-description').textContent = ex.description;
        this.$('example-notes').textContent = ex.notes || '';
        this.$('example-info').hidden = false;
        this.$('example-selector').value = key;
        this.renderQuiz(ex);
    }

    updateTypeUI() {
        const badge = this.$('type-badge');
        badge.textContent = this.type; badge.className = 'at-badge ' + this.type.toLowerCase();
        this.$('dna-sub').hidden = this.type === 'PROTEIN';
        this.$('sub-hint').textContent = this.type === 'PROTEIN' ? 'Substitution scores: BLOSUM62.' : 'Substitution scores: match / mismatch.';
    }

    // rawRows: aligned rows to load as typed, or null to align automatically
    setSequences(seqs, type, rawRows) {
        this.seqs = seqs; this.type = type;
        this.updateTypeUI();
        this.endStepping(true);
        this.selectedCol = null;
        this.computeAuto(false);
        // gap-containing raw rows: keep the typed alignment; plain sequences: show unaligned (left-justified)
        this.editor.init(seqs.map(s => s.name), rawRows ? rawRows : this.auto.rows, type);
        this.editor.container.focus();
    }

    computeAuto(reload) {
        const p = this.params();
        const t0 = performance.now();
        this.auto = this.M.progressive(this.seqs, p);
        this.auto.I = this.M.identityMatrix(this.auto.rows);
        this.auto.stats = this.M.columnStats(this.auto.rows, this.type, this.statOpts());
        this.auto.sp = this.M.sumOfPairs(this.auto.rows, p).total;
        this.auto.ms = performance.now() - t0;
        this.renderTree();
        if (reload) { this.endStepping(true); this.editor.setRows(this.auto.rows); }
        if (this.currentExample) this.renderQuiz(this.currentExample);
    }

    // ------------------------------------------------------------ derived views
    refresh() {
        if (!this.rows.length) return;
        const p = this.params();
        this.stats = this.M.columnStats(this.rows, this.type, this.statOpts());
        const showLogo = this.$('show-logo').checked, showCons = this.$('show-consensus').checked;
        this.editor.logoSvg = showLogo ? MsaLogo.render(this.stats, this.type, { cellWidth: this.cellWidth, height: this.editor.opts.logoHeight }) : '';
        this.editor.consensus = showCons ? this.M.consensusString(this.stats) : '';
        this.editor.shading = this.$('shade-conservation').checked ? this.stats.columns.map(c => c.topFraction) : null;
        this.editor.render();
        const axis = this.editor.container.querySelector('.me-logo-axis');
        if (axis) axis.innerHTML = MsaLogo.axis(this.stats.maxBits, this.editor.opts.logoHeight);
        this.renderPssm();
        this.renderStats(p);
        this.renderColumnDetail();
    }

    renderStats(p) {
        const I = this.M.identityMatrix(this.rows);
        const sp = this.M.sumOfPairs(this.rows, p).total;
        const gapCols = this.stats.columns.filter(c => c.gaps > 0).length;
        const gapOnly = this.stats.columns.filter(c => c.gaps === this.rows.length).length;
        const conserved = this.stats.columns.filter(c => c.conserved).length;
        const best = this.M.bestColumn(this.stats);
        let minI = 1, minPair = '';
        for (let i = 0; i < I.length; i++) for (let j = i + 1; j < I.length; j++) if (I[i][j] < minI) { minI = I[i][j]; minPair = `${this.seqs[i].name} / ${this.seqs[j].name}`; }
        const rows = [
            ['Sequences × columns', `${this.rows.length} × ${this.rows[0].length}`],
            ['Sum-of-pairs score', `<strong>${sp.toFixed(0)}</strong>`],
            ['Mean pairwise identity', `${(this.M.meanIdentity(I) * 100).toFixed(1)} %`],
            ['Least similar pair', `${(minI * 100).toFixed(1)} % <span class="dp-hint">${minPair}</span>`],
            ['Fully conserved columns', conserved],
            ['Columns with gaps / gap-only', `${gapCols} / ${gapOnly}`],
            ['Most informative column', `${best.index + 1} (${best.info.toFixed(2)} bits, ${best.top || '–'})`],
            ['Total information', `${this.stats.columns.reduce((s, c) => s + c.info, 0).toFixed(1)} bits`]
        ];
        this.$('stats').innerHTML = '<div class="stats-grid">' + rows.map(([k, v]) => `<div class="stat-item"><span class="stat-label">${k}</span><span class="stat-value">${v}</span></div>`).join('') + '</div>';
        const diff = sp - this.auto.sp;
        this.$('ms-target').innerHTML = `Sum-of-pairs score of your alignment: <strong class="${diff >= 0 ? 'forward-color' : 'reverse-color'}">${sp.toFixed(0)}</strong> · automatic alignment: <strong>${this.auto.sp.toFixed(0)}</strong>` +
            (diff > 0 ? ' – you beat the progressive algorithm (it is a heuristic, not an optimum)!' : diff === 0 ? ' – same score.' : ` (${(-diff).toFixed(0)} below).`) +
            ` <span class="dp-hint">Progressive alignment took ${this.auto.ms.toFixed(0)} ms.</span>`;
    }

    renderPssm() {
        const alpha = this.stats.alphabet, cols = this.stats.columns, cw = this.cellWidth;
        const color = v => { const t = Math.max(-1, Math.min(1, v / 3)); return t >= 0 ? `rgba(22,163,74,${(t * 0.6).toFixed(2)})` : `rgba(220,38,38,${(-t * 0.6).toFixed(2)})`; };
        let h = `<table class="ms-pssm" style="width:${120 + cols.length * cw}px"><thead><tr><th class="ms-pssm-name">pos</th>`;
        cols.forEach((c, k) => h += `<th class="${this.selectedCol === k ? 'selcol' : ''}">${(k + 1) % 5 === 0 || k === 0 ? k + 1 : ''}</th>`);
        h += '</tr></thead><tbody>';
        for (const a of alpha) {
            h += `<tr><th class="ms-pssm-name" style="color:${MsaLogo.color(a, this.type)}">${a}</th>`;
            cols.forEach((c, k) => { const v = c.pssm[a]; h += `<td class="${this.selectedCol === k ? 'selcol' : ''}" style="background:${color(v)}" title="column ${k + 1}, ${a}: ${v.toFixed(2)} bits">${c.nRes ? v.toFixed(1) : ''}</td>`; });
            h += '</tr>';
        }
        h += `<tr class="ms-pssm-info"><th class="ms-pssm-name">bits</th>${cols.map((c, k) => `<td class="${this.selectedCol === k ? 'selcol' : ''}">${c.info.toFixed(1)}</td>`).join('')}</tr>`;
        h += `<tr class="ms-pssm-gap"><th class="ms-pssm-name">gaps</th>${cols.map((c, k) => `<td class="${this.selectedCol === k ? 'selcol' : ''}">${c.gaps || ''}</td>`).join('')}</tr>`;
        h += '</tbody></table>';
        this.$('pssm').innerHTML = h;
        this.$('pssm').querySelectorAll('td, th:not(.ms-pssm-name)').forEach(td => td.addEventListener('click', () => {
            const k = [...td.parentElement.children].indexOf(td) - 1;
            if (k >= 0) { this.selectedCol = k; this.editor.selectColumn(k); this.editor.render(); this.renderPssm(); this.renderColumnDetail(); }
        }));
    }

    renderColumnDetail() {
        const box = this.$('column-detail');
        if (this.selectedCol === null || !this.stats || this.selectedCol >= this.stats.columns.length) { box.innerHTML = '<p class="no-stats">Click a column in the alignment.</p>'; return; }
        const c = this.stats.columns[this.selectedCol];
        const bg = this.stats.background;
        const present = this.stats.alphabet.filter(a => (c.counts[a] || 0) > 0).sort((x, y) => c.counts[y] - c.counts[x]);
        const others = this.stats.alphabet.filter(a => !(c.counts[a] > 0)).slice(0, 3);
        const row = a => `<tr class="${c.counts[a] ? '' : 'dim'}"><td style="color:${MsaLogo.color(a, this.type)}"><strong>${a}</strong></td><td>${c.counts[a] || 0}</td><td>${(c.freq[a] * 100).toFixed(0)} %</td><td>${c.pfreq[a].toFixed(3)}</td><td>${bg[a].toFixed(3)}</td><td class="${c.pssm[a] >= 0 ? 'forward-color' : 'reverse-color'}">${c.pssm[a].toFixed(2)}</td></tr>`;
        box.innerHTML = `
            <p><strong>Column ${c.index + 1}</strong> · ${c.nRes} residue${c.nRes === 1 ? '' : 's'}, ${c.gaps} gap${c.gaps === 1 ? '' : 's'} · consensus <strong>${c.consensus}</strong></p>
            <table class="ms-detail"><thead><tr><th></th><th>count</th><th>freq</th><th>freq+β</th><th>bg</th><th>log₂ odds</th></tr></thead>
            <tbody>${present.map(row).join('')}${others.map(row).join('')}</tbody></table>
            <div class="stats-grid">
                <div class="stat-item"><span class="stat-label">Entropy H = −Σ f·log₂ f</span><span class="stat-value">${c.entropy.toFixed(2)} bits</span></div>
                <div class="stat-item"><span class="stat-label">Maximum log₂(${this.stats.alphabet.length})</span><span class="stat-value">${this.stats.maxBits.toFixed(2)} bits</span></div>
                <div class="stat-item"><span class="stat-label">Small-sample correction</span><span class="stat-value">${c.correction.toFixed(2)} bits</span></div>
                <div class="stat-item"><span class="stat-label">Information R = max − H − e</span><span class="stat-value"><strong>${c.info.toFixed(2)} bits</strong></span></div>
                <div class="stat-item"><span class="stat-label">Logo stack height</span><span class="stat-value">${c.logoHeight.toFixed(2)} bits</span></div>
            </div>
            <p class="dp-hint">Letter height in the logo = frequency × R. The PSSM row is log₂(freq+β ÷ background); β spreads pseudocounts by background frequency.</p>`;
    }

    renderTree() {
        const tree = this.auto.tree;
        const leaves = [];
        const collect = n => { if (!n.left) leaves.push(n); else { collect(n.left); collect(n.right); } };
        collect(tree);
        const W = 260, rowH = 18, H = leaves.length * rowH + 10, nameW = 90;
        const maxH = tree.height || 1e-6;
        const x = h => 8 + (1 - h / maxH) * (W - nameW - 16);
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" class="ms-tree">`;
        const ypos = new Map();
        leaves.forEach((l, i) => ypos.set(l, 12 + i * rowH));
        const draw = n => {
            if (!n.left) { const y = ypos.get(n); svg += `<text x="${(W - nameW + 4).toFixed(1)}" y="${y + 3}" font-size="10">${n.name}</text>`; return y; }
            const yl = draw(n.left), yr = draw(n.right), xn = x(n.height), y = (yl + yr) / 2;
            svg += `<line x1="${xn}" y1="${yl}" x2="${xn}" y2="${yr}" stroke="#4a5568"/>`;
            svg += `<line x1="${xn}" y1="${yl}" x2="${x(n.left.height)}" y2="${yl}" stroke="#4a5568"/><line x1="${xn}" y1="${yr}" x2="${x(n.right.height)}" y2="${yr}" stroke="#4a5568"/>`;
            svg += `<text x="${xn - 2}" y="${y - 3}" font-size="8" fill="#718096" text-anchor="end">${(1 - 2 * n.height).toFixed(2)}</text>`;
            ypos.set(n, y);
            return y;
        };
        draw(tree);
        svg += '</svg>';
        this.$('tree').innerHTML = svg + '<p class="dp-hint">Branch labels: identity of the two merged groups (1 − distance). Merges happen bottom-up; closest pairs first.</p>';
        this.$('newick').textContent = this.M.newick(tree) + ';';
    }

    // ------------------------------------------------------------ progressive stepper
    startStepping() {
        if (!this.auto || !this.auto.steps.length) { this.toast('Load at least two sequences first', 'warning'); return; }
        this.$('stepper').hidden = false;
        this.$('step-btn').hidden = true;
        this.editor.setReadOnly(true);
        this.showStep(0);
    }

    showStep(k) {
        const steps = this.auto.steps;
        k = Math.max(0, Math.min(steps.length - 1, k));
        this.stepIndex = k;
        const st = steps[k];
        const names = st.members.map(i => this.seqs[i].name);
        this.editor.logoSvg = ''; this.editor.consensus = ''; this.editor.shading = null;
        this.editor.names = names;
        this.editor.setRows(st.after, true);
        const nm = idx => idx.map(i => this.seqs[i].name).join(', ');
        this.$('step-explain').innerHTML = `<strong>Merge ${k + 1} of ${steps.length}:</strong> profile {${nm(st.a)}} (${st.before.rowsA[0].length} columns) aligned with profile {${nm(st.b)}} (${st.before.rowsB[0].length} columns) → ${st.after[0].length} columns, profile score ${st.score.toFixed(1)}. ` +
            (k === 0 ? 'The first merge joins the two most similar sequences (deepest split of the guide tree).' : 'Gaps introduced earlier are kept ("once a gap, always a gap"); new gap columns are inserted in whole profiles.');
        this.$('step-prev').disabled = k === 0;
        this.$('step-next').disabled = k === steps.length - 1;
    }

    endStepping(silent) {
        const was = this.stepIndex >= 0;
        this.stepIndex = -1;
        this.$('stepper').hidden = true;
        this.$('step-btn').hidden = false;
        this.editor.setReadOnly(false);
        if (was && !silent) { this.editor.names = this.seqs.map(s => s.name); this.editor.setRows(this.auto.rows); }
    }

    // ------------------------------------------------------------ scanning
    scan() {
        if (!this.stats) return;
        const seq = this.E.cleanSequence(this.$('scan-input').value, this.type);
        const r = this.M.scanPSSM(seq, this.stats);
        const box = this.$('scan-result');
        if (!seq || !r.scores.length) { box.innerHTML = `<span class="reverse-color">The sequence must be at least ${r.width} residues (the PSSM has ${r.width} core columns).</span>`; return; }
        const max = Math.max(...r.scores.map(s => Math.abs(s.score)), 1);
        box.innerHTML = `Best window starts at position <strong>${r.best.pos + 1}</strong> (${seq.slice(r.best.pos, r.best.pos + r.width)}) with score <strong>${r.best.score.toFixed(1)}</strong> bits. Scores along the sequence:` +
            `<div class="ms-scan-bars">${r.scores.map(s => `<span title="position ${s.pos + 1}: ${s.score.toFixed(1)}" class="${s.score >= 0 ? 'pos' : 'neg'}" style="height:${(Math.abs(s.score) / max * 40).toFixed(0)}px"></span>`).join('')}</div>`;
    }

    // ------------------------------------------------------------ quiz
    renderQuiz(ex) {
        const box = this.$('quiz');
        box.innerHTML = '';
        if (!ex.questions || !this.auto) return;
        const ctx = { M: this.M, E: this.E, rows: this.auto.rows, names: this.seqs.map(s => s.name), stats: this.auto.stats, I: this.auto.I, params: this.params(), type: this.type };
        const h = document.createElement('h4');
        h.textContent = 'Check your understanding (answers refer to the automatic alignment with the current parameters)';
        box.appendChild(h);
        ex.questions.forEach((q, idx) => {
            const answer = q.answer(ctx);
            const item = document.createElement('div'); item.className = 'dp-question';
            item.innerHTML = `<p><strong>${idx + 1}.</strong> ${q.q}</p>`;
            const fb = document.createElement('div'); fb.className = 'dp-feedback'; fb.hidden = true;
            let attempts = 0;
            const judge = ok => {
                attempts++; fb.hidden = false; fb.className = 'dp-feedback ' + (ok ? 'correct' : 'wrong');
                if (ok) { fb.innerHTML = `✔ Correct. ${q.explanation ? q.explanation(ctx) : ''}`; item.querySelectorAll('input,button').forEach(el => el.disabled = true); }
                else if (attempts >= 2) fb.innerHTML = `✘ The answer is <strong>${typeof answer === 'number' ? +answer.toFixed(2) : answer}</strong>. ${q.explanation ? q.explanation(ctx) : ''}`;
                else fb.textContent = '✘ Not quite – use the logo, the PSSM table or the statistics panel and try once more.';
            };
            const row = document.createElement('div'); row.className = 'dp-answer-row';
            const inp = document.createElement('input'); inp.type = q.type === 'text' ? 'text' : 'number'; inp.step = 'any';
            const b = document.createElement('button'); b.textContent = 'Check';
            const chk = () => { if (inp.value === '') return; judge(q.type === 'text' ? inp.value.trim().toUpperCase() === String(answer).toUpperCase() : Math.abs(parseFloat(inp.value) - answer) <= (q.tolerance || 0)); };
            b.addEventListener('click', chk); inp.addEventListener('keydown', e => { if (e.key === 'Enter') chk(); });
            row.appendChild(inp); row.appendChild(b); item.appendChild(row); item.appendChild(fb); box.appendChild(item);
        });
    }

    toast(message, type = 'info') {
        const el = document.createElement('div');
        el.className = `notification notification-${type} show`; el.textContent = message;
        this.$('toast-stack').appendChild(el);
        setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3000);
    }
}

(function () {
    const start = () => { window.msa = new MsaController(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
