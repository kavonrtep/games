/**
 * ALIGNMENT TRAINER
 * =================
 * Controller for needleman-wunsch.html (global) and smith-waterman.html
 * (local). The mode comes from <body data-mode="global|local">.
 */
class AlignTrainer {
    constructor() {
        this.E = AlignEngine;
        this.mode = document.body.dataset.mode === 'local' ? 'local' : 'global';
        this.$ = id => document.getElementById(id);
        this.seq1 = ''; this.seq2 = ''; this.type = 'DNA';
        this.active = false;
        this.opt = null;            // engine result for the optimal alignment
        this.localList = [];
        this.currentExample = null;
        this.revealed = false;

        this.editor = new AlignEditor(this.$('editor'), { local: this.mode === 'local', onChange: () => this.onEdit() });
        this.matrix = new AlignMatrixView(this.$('matrix'), {
            onHover: (cell, x, y) => this.matrixTooltip(cell, x, y),
            onStep: cell => this.explainStep(cell)
        });
        this.matrix.showOptimal = false;

        document.querySelectorAll('.local-only').forEach(el => el.hidden = this.mode !== 'local');
        document.querySelectorAll('.global-only').forEach(el => el.hidden = this.mode !== 'global');
        if (this.mode === 'local') this.$('threshold-controls').hidden = false;

        this.buildCustomMatrix();
        this.bindInputs();
        this.bindParams();
        this.bindMatrixControls();
        this.populateExamples();
        this.updateParamVisibility();
    }

    // ------------------------------------------------------------ inputs & examples
    bindInputs() {
        const s1 = this.$('sequence1'), s2 = this.$('sequence2');
        const onInput = () => {
            this.currentExample = null;
            this.$('example-info').hidden = true;
            this.$('example-selector').value = '';
            this.updateTypeBadge();
        };
        s1.addEventListener('input', onInput);
        s2.addEventListener('input', onInput);
        [s1, s2].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') this.start(); }));
        this.$('start-btn').addEventListener('click', () => this.start());
        this.$('example-selector').addEventListener('change', e => { if (e.target.value) this.loadExample(e.target.value); });

        this.$('check-btn').addEventListener('click', () => this.check());
        this.$('show-optimal-btn').addEventListener('click', () => this.showOptimal());
        this.$('remove-gap-cols-btn').addEventListener('click', () => {
            const n = this.editor.removeGapOnlyColumns();
            this.toast(n ? `Removed ${n} gap-only column${n === 1 ? '' : 's'}` : 'No gap-only columns', 'info');
        });
        this.$('reset-btn').addEventListener('click', () => { this.editor.reset(); this.$('feedback').hidden = true; });
    }

    populateExamples() {
        const sel = this.$('example-selector');
        const groups = { basic: 'Basics', rich: 'Multiple edits', parameters: 'Parameters matter', protein: 'Protein' };
        const examples = Object.entries(ALIGNMENT_EXAMPLES[this.mode]);
        for (const [g, label] of Object.entries(groups)) {
            const items = examples.filter(([, ex]) => (ex.group || 'basic') === g);
            if (!items.length) continue;
            const og = document.createElement('optgroup');
            og.label = label;
            for (const [key, ex] of items) {
                const o = document.createElement('option');
                o.value = key; o.textContent = ex.name;
                og.appendChild(o);
            }
            sel.appendChild(og);
        }
    }

    updateTypeBadge() {
        const t = this.E.detectType(this.$('sequence1').value + this.$('sequence2').value);
        const badge = this.$('type-badge');
        badge.textContent = (this.$('sequence1').value || this.$('sequence2').value) ? t : '';
        badge.className = 'at-badge ' + t.toLowerCase();
        return t;
    }

    loadExample(key) {
        const ex = ALIGNMENT_EXAMPLES[this.mode][key];
        if (!ex) return;
        this.currentExample = ex;
        this.$('sequence1').value = ex.seq1;
        this.$('sequence2').value = ex.seq2;
        const type = this.E.detectType(ex.seq1 + ex.seq2);
        this.applyParams(Object.assign(this.E.defaultParams(type), ex.params || {}));
        this.start();
        this.$('example-name').textContent = ex.name;
        this.$('example-description').textContent = ex.description;
        this.$('example-expected').textContent = ex.expected || '';
        this.$('example-notes').textContent = ex.notes || '';
        this.renderQuiz(ex);
        this.$('example-info').hidden = false;
        this.$('example-selector').value = key;
    }

    start() {
        const type = this.updateTypeBadge();
        const s1 = this.E.cleanSequence(this.$('sequence1').value, type);
        const s2 = this.E.cleanSequence(this.$('sequence2').value, type);
        if (s1.length < 2 || s2.length < 2) { this.toast('Enter two sequences of at least 2 residues', 'error'); return; }
        if (s1.length > 60 || s2.length > 60) { this.toast('Sequences are limited to 60 residues so the matrix stays readable', 'error'); return; }
        this.seq1 = s1; this.seq2 = s2; this.type = type;
        this.$('sequence1').value = s1; this.$('sequence2').value = s2;
        this.active = true;
        this.revealed = false;
        this.$('feedback').hidden = true;
        this.updateParamVisibility();
        this.editor.setParams(this.params());
        this.editor.init(s1, s2, type);
        this.editor.container.focus();
        this.recompute();
        this.$('mv-optimal').checked = false;
        this.matrix.setOptions({ showOptimal: false });
    }

    // ------------------------------------------------------------ parameters
    bindParams() {
        const rerun = () => { if (this.active) { this.editor.setParams(this.params()); this.recompute(); } };
        document.querySelectorAll('input[name="sub-kind"], input[name="gap-model"], input[name="end-gaps"]').forEach(r =>
            r.addEventListener('change', () => { this.updateParamVisibility(); rerun(); }));
        const slider = (id, valueId, fmt) => {
            const el = this.$(id);
            el.addEventListener('input', () => { this.$(valueId).textContent = fmt(parseInt(el.value)); rerun(); });
        };
        const signed = v => v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0';
        slider('match', 'match-value', signed);
        slider('mismatch', 'mismatch-value', signed);
        slider('ti-match', 'ti-match-value', signed);
        slider('transition', 'transition-value', signed);
        slider('transversion', 'transversion-value', signed);
        slider('gap', 'gap-value', signed);
        slider('gap-open', 'gap-open-value', signed);
        slider('gap-extend', 'gap-extend-value', signed);
        slider('threshold', 'threshold-value', v => v);
        this.$('custom-matrix').addEventListener('input', rerun);
    }

    buildCustomMatrix() {
        const bases = ['A', 'C', 'G', 'T'];
        let h = '<tr><th></th>' + bases.map(b => `<th>${b}</th>`).join('') + '</tr>';
        for (const a of bases) {
            h += `<tr><th>${a}</th>` + bases.map(b => `<td><input type="number" id="custom-${a}${b}" value="${a === b ? 2 : -1}" min="-10" max="10"></td>`).join('') + '</tr>';
        }
        this.$('custom-matrix').innerHTML = h;
    }

    updateParamVisibility() {
        const protein = this.type === 'PROTEIN';
        const kindRadios = document.querySelectorAll('input[name="sub-kind"]');
        kindRadios.forEach(r => {
            const dnaOnly = r.value === 'titv' || r.value === 'custom';
            r.disabled = (protein && dnaOnly) || (!protein && r.value === 'blosum62');
            r.parentElement.classList.toggle('disabled', r.disabled);
        });
        let kind = document.querySelector('input[name="sub-kind"]:checked').value;
        if (protein && (kind === 'titv' || kind === 'custom')) { kind = 'blosum62'; document.querySelector('input[name="sub-kind"][value="blosum62"]').checked = true; }
        if (!protein && kind === 'blosum62') { kind = 'simple'; document.querySelector('input[name="sub-kind"][value="simple"]').checked = true; }
        this.$('simple-controls').hidden = kind !== 'simple';
        this.$('titv-controls').hidden = kind !== 'titv';
        this.$('custom-controls').hidden = kind !== 'custom';
        this.$('blosum-hint').hidden = kind !== 'blosum62';
        const affine = document.querySelector('input[name="gap-model"]:checked').value === 'affine';
        this.$('linear-controls').hidden = affine;
        this.$('affine-controls').hidden = !affine;
        // step / fill modes explain the single-matrix recurrence, i.e. linear gaps
        this.$('mv-step-btn').disabled = affine;
        this.$('mv-fill-btn').disabled = affine;
        this.$('mv-step-btn').title = affine ? 'Step-by-step fill is available for linear gaps (one matrix)' : '';
        this.$('mv-fill-btn').title = this.$('mv-step-btn').title;
        if (affine && this.matrix.mode !== 'full') this.setMatrixMode('full');
    }

    params() {
        const kind = document.querySelector('input[name="sub-kind"]:checked').value;
        let substitution;
        if (kind === 'blosum62') substitution = { kind: 'blosum62' };
        else if (kind === 'titv') substitution = { kind: 'titv', match: +this.$('ti-match').value, transition: +this.$('transition').value, transversion: +this.$('transversion').value };
        else if (kind === 'custom') {
            const table = {};
            for (const a of 'ACGT') { table[a] = {}; for (const b of 'ACGT') table[a][b] = parseFloat(this.$(`custom-${a}${b}`).value) || 0; }
            table.U = table.T;
            substitution = { kind: 'custom', table, match: 2, mismatch: -1 };
        } else substitution = { kind: 'simple', match: +this.$('match').value, mismatch: +this.$('mismatch').value };
        return {
            type: this.type,
            gapModel: document.querySelector('input[name="gap-model"]:checked').value,
            gap: +this.$('gap').value, gapOpen: +this.$('gap-open').value, gapExtend: +this.$('gap-extend').value,
            endGaps: this.mode === 'global' ? document.querySelector('input[name="end-gaps"]:checked').value : 'penalized',
            substitution
        };
    }

    applyParams(p) {
        const set = (id, valueId, v) => { this.$(id).value = v; this.$(valueId).textContent = v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0'; };
        const s = p.substitution || {};
        document.querySelector(`input[name="sub-kind"][value="${s.kind || 'simple'}"]`).checked = true;
        if (s.kind === 'simple' || !s.kind) { set('match', 'match-value', s.match ?? 2); set('mismatch', 'mismatch-value', s.mismatch ?? -1); }
        if (s.kind === 'titv') { set('ti-match', 'ti-match-value', s.match); set('transition', 'transition-value', s.transition); set('transversion', 'transversion-value', s.transversion); }
        document.querySelector(`input[name="gap-model"][value="${p.gapModel || 'linear'}"]`).checked = true;
        set('gap', 'gap-value', p.gap ?? -2);
        set('gap-open', 'gap-open-value', p.gapOpen ?? -4);
        set('gap-extend', 'gap-extend-value', p.gapExtend ?? -1);
        if (this.mode === 'global') document.querySelector(`input[name="end-gaps"][value="${p.endGaps || 'penalized'}"]`).checked = true;
        this.type = p.type || this.type;
        this.updateParamVisibility();
    }

    // ------------------------------------------------------------ core updates
    recompute() {
        if (!this.active) return;
        const p = this.params();
        this.opt = this.mode === 'global' ? this.E.globalAlign(this.seq1, this.seq2, p) : this.E.localAlign(this.seq1, this.seq2, p);
        if (this.mode === 'local') {
            this.localList = this.E.localAlignments(this.seq1, this.seq2, p, +this.$('threshold').value).alignments;
            this.renderLocalList();
        }
        this.matrix.set({ s1: this.seq1, s2: this.seq2, params: p, result: this.opt, local: this.mode === 'local' });
        this.matrix.setHighlightPath(null);
        this.onEdit();
        if (this.currentExample) this.renderQuiz(this.currentExample);
    }

    studentScore() {
        const { a1, a2, sel } = this.editor.get();
        const p = this.params();
        if (this.mode === 'global') return { score: this.E.scoreAlignment(a1, a2, p), a1, a2 };
        if (!sel) return null;
        const r1 = a1.slice(sel.start, sel.end + 1), r2 = a2.slice(sel.start, sel.end + 1);
        return { score: this.E.scoreAlignment(r1, r2, Object.assign({}, p, { endGaps: 'penalized' })), a1: r1, a2: r2 };
    }

    studentPath() {
        const { a1, a2, sel } = this.editor.get();
        if (this.mode === 'global') return this.E.alignmentToPath(a1, a2);
        if (!sel) return null;
        let i = 0, j = 0;
        for (let k = 0; k < sel.start; k++) { if (a1[k] !== '-') i++; if (a2[k] !== '-') j++; }
        const path = [{ i, j }];
        for (let k = sel.start; k <= sel.end; k++) {
            if (a1[k] !== '-') i++; if (a2[k] !== '-') j++;
            if (a1[k] === '-' && a2[k] === '-') continue;
            path.push({ i, j });
        }
        return path;
    }

    onEdit() {
        if (!this.active || !this.opt) return;
        this.updateStats();
        this.updateTarget();
        if (this.$('mv-student').checked) this.matrix.setStudentPath(this.studentPath());
    }

    updateTarget() {
        const line = this.$('target-line');
        const s = this.studentScore();
        if (this.mode === 'global') {
            const mine = s.score.total;
            const diff = this.opt.score - mine;
            line.innerHTML = `Optimal score with these parameters: <strong>${this.opt.score}</strong>` +
                (this.opt.optimalPaths ? ` <span class="dp-hint">(${this.opt.optimalPaths} co-optimal alignment${this.opt.optimalPaths === 1 ? '' : 's'})</span>` : '') +
                ` · your alignment: <strong class="${diff === 0 ? 'forward-color' : 'reverse-color'}">${mine}</strong>` +
                (diff === 0 ? ' ✔ optimal' : ` (${diff} below optimum)`);
        } else {
            line.innerHTML = `Best local score with these parameters: <strong>${this.opt.score}</strong>` +
                (s ? ` · your selected region: <strong class="${s.score.total === this.opt.score ? 'forward-color' : 'reverse-color'}">${s.score.total}</strong>` +
                     (s.score.total === this.opt.score ? ' ✔ optimal' : ` (${this.opt.score - s.score.total} below the best)`)
                   : ' · <em>mark the start and end of your local alignment with [ and ]</em>');
        }
    }

    updateStats() {
        const s = this.studentScore();
        const box = this.$('stats');
        if (!s) { box.innerHTML = '<p class="no-stats">Select a region in the editor to score it.</p>'; return; }
        const sc = s.score;
        const similar = sc.columns.filter(c => (c.type === 'match' || c.type === 'mismatch') && c.score > 0).length;
        const rows = [
            ['Score', `<strong>${sc.total}</strong>`],
            ['Substitutions total / gaps total', `${sc.subTotal} / ${sc.gapTotal}`],
            ['Columns', sc.length],
            ['Matches / mismatches', `${sc.matches} / ${sc.mismatches}`],
            ['Identity (of aligned columns)', `${(sc.identity * 100).toFixed(1)} %`],
            ['Similarity (positive-scoring columns)', `${sc.matches + sc.mismatches ? (similar / (sc.matches + sc.mismatches) * 100).toFixed(1) : 0} %`],
            ['Gap symbols / gap openings', `${sc.gaps} / ${sc.gapOpenings}`],
            ['Free terminal gap columns', sc.endGapCols]
        ];
        box.innerHTML = '<div class="stats-grid">' + rows.map(([k, v]) => `<div class="stat-item"><span class="stat-label">${k}</span><span class="stat-value">${v}</span></div>`).join('') + '</div>';
    }

    // ------------------------------------------------------------ checking / revealing
    check() {
        if (!this.active) return;
        const fb = this.$('feedback');
        const s = this.studentScore();
        fb.hidden = false;
        if (!s) { fb.className = 'dp-feedback wrong'; fb.textContent = 'Mark the region of your local alignment first: put the cursor at its first column and press [, then at its last column and press ].'; return; }
        const mine = s.score.total, best = this.opt.score;
        if (mine === best) {
            fb.className = 'dp-feedback correct';
            fb.innerHTML = `✔ <strong>Optimal!</strong> Your ${this.mode} alignment scores ${mine}, the best possible with these parameters.` +
                (this.opt.optimalPaths > 1 ? ` There are ${this.opt.optimalPaths} alignments with this score – yours is one of them.` : '');
        } else {
            fb.className = 'dp-feedback wrong';
            const hints = [];
            if (this.mode === 'global') {
                const optSc = this.E.scoreAlignment(this.opt.aligned1, this.opt.aligned2, this.params());
                if (s.score.gaps > optSc.gaps) hints.push(`the optimum uses fewer gap symbols (${optSc.gaps} vs. your ${s.score.gaps})`);
                if (s.score.gaps < optSc.gaps) hints.push(`the optimum uses more gap symbols (${optSc.gaps} vs. your ${s.score.gaps})`);
                if (s.score.mismatches > optSc.mismatches) hints.push(`it has fewer mismatches (${optSc.mismatches} vs. ${s.score.mismatches})`);
            } else {
                hints.push(`the best local alignment covers Seq 1 ${this.opt.s1Start}–${this.opt.s1End} – is your region in the right place?`);
            }
            fb.innerHTML = `✘ Your alignment scores <strong>${mine}</strong>; the optimum is <strong>${best}</strong>.` +
                (hints.length ? ` Hint: ${hints.join('; ')}.` : '') +
                ' Look at the matrix: follow the arrows from the end cell, or turn on "optimal path".';
        }
    }

    showOptimal() {
        if (!this.active) return;
        this.revealed = true;
        if (this.mode === 'global') {
            this.editor.setAlignment(this.opt.aligned1, this.opt.aligned2);
        } else {
            // embed the optimal local alignment into the editor and select it
            const o = this.opt;
            const L1 = this.seq1.slice(0, o.s1Start - 1), L2 = this.seq2.slice(0, o.s2Start - 1);
            const R1 = this.seq1.slice(o.s1End), R2 = this.seq2.slice(o.s2End);
            const padL = Math.max(L1.length, L2.length);
            const a1 = '-'.repeat(padL - L1.length) + L1 + o.aligned1 + R1;
            const a2 = '-'.repeat(padL - L2.length) + L2 + o.aligned2 + R2;
            this.editor.setAlignment(a1, a2);
            this.editor.setSelection(padL, padL + o.aligned1.length - 1);
        }
        this.$('mv-optimal').checked = true;
        this.matrix.setOptions({ showOptimal: true });
        const fb = this.$('feedback');
        fb.hidden = false;
        fb.className = 'dp-feedback';
        fb.innerHTML = `Optimal ${this.mode} alignment loaded (score ${this.opt.score}). The dashed path in the matrix is its traceback` +
            (this.opt.optimalPaths > 1 ? `; ${this.opt.optimalPaths} different alignments reach this score – cells with two arrows on the path are where they diverge.` : '.');
    }

    // ------------------------------------------------------------ local list
    renderLocalList() {
        const box = this.$('local-list');
        this.$('local-list-section').hidden = false;
        this.$('local-count').textContent = `(${this.localList.length})`;
        if (!this.localList.length) { box.innerHTML = '<p class="no-alignments">Nothing scores that high – lower the threshold.</p>'; return; }
        box.innerHTML = this.localList.map((a, k) => {
            const sc = this.E.scoreAlignment(a.aligned1, a.aligned2, this.params());
            const mid = a.aligned1.split('').map((c, x) => c !== '-' && c === a.aligned2[x] ? '|' : (sc.columns[x].score > 0 && c !== '-' && a.aligned2[x] !== '-') ? ':' : ' ').join('');
            return `<div class="alignment-item" data-k="${k}">
                <div class="alignment-header"><span>#${k + 1} · Seq 1 ${a.s1Start}–${a.s1End} · Seq 2 ${a.s2Start}–${a.s2End}</span><span class="alignment-score">${a.score}</span></div>
                <div class="alignment-coords">${a.aligned1.length} columns · ${(sc.identity * 100).toFixed(0)} % identity</div>
                <pre class="at-aln">${String(a.s1Start).padStart(3)} ${a.aligned1}\n    ${mid}\n${String(a.s2Start).padStart(3)} ${a.aligned2}</pre></div>`;
        }).join('');
        box.querySelectorAll('.alignment-item').forEach(item => item.addEventListener('click', () => {
            const on = item.classList.contains('selected');
            box.querySelectorAll('.alignment-item').forEach(x => x.classList.remove('selected'));
            if (!on) item.classList.add('selected');
            this.matrix.setHighlightPath(on ? null : this.localList[+item.dataset.k].path);
        }));
    }

    // ------------------------------------------------------------ matrix controls
    bindMatrixControls() {
        this.$('mv-values').addEventListener('change', e => this.matrix.setOptions({ showValues: e.target.checked }));
        this.$('mv-arrows').addEventListener('change', e => this.matrix.setOptions({ showArrows: e.target.checked }));
        this.$('mv-optimal').addEventListener('change', e => this.matrix.setOptions({ showOptimal: e.target.checked }));
        this.$('mv-student').addEventListener('change', e => this.matrix.setStudentPath(e.target.checked ? this.studentPath() : null));
        this.$('mv-step-btn').addEventListener('click', () => this.setMatrixMode('step'));
        this.$('mv-fill-btn').addEventListener('click', () => this.setMatrixMode('fill'));
        this.$('mv-full-btn').addEventListener('click', () => this.setMatrixMode('full'));
        this.$('step-next').addEventListener('click', () => this.matrix.stepForward());
        this.$('step-row').addEventListener('click', () => this.matrix.stepRow());
        this.$('step-all').addEventListener('click', () => this.matrix.stepAll());
        this.$('step-back').addEventListener('click', () => this.matrix.stepBack());
        this.$('fill-check').addEventListener('click', () => {
            const r = this.matrix.checkFill();
            if (!r) return;
            this.$('fill-result').innerHTML = r.correct === r.total
                ? `<span class="forward-color">✔ All ${r.total} cells correct!</span>`
                : `<span class="reverse-color">${r.correct} of ${r.total} correct – wrong cells are marked; hover them for the right value.</span>`;
        });
    }

    setMatrixMode(mode) {
        if (!this.active) { this.toast('Align two sequences first', 'warning'); return; }
        this.matrix.setMode(mode);
        this.$('step-controls').hidden = mode !== 'step';
        this.$('fill-controls').hidden = mode !== 'fill';
        this.$('fill-result').textContent = '';
        this.$('mv-full-btn').hidden = mode === 'full';
        this.$('mv-step-btn').hidden = mode !== 'full';
        this.$('mv-fill-btn').hidden = mode !== 'full';
        ['mv-values', 'mv-arrows', 'mv-optimal', 'mv-student'].forEach(id => this.$(id).disabled = mode !== 'full');
    }

    explainStep(cell) {
        const box = this.$('step-explain');
        if (!cell) { box.innerHTML = '<strong>Matrix complete.</strong> ' + (this.mode === 'global' ? 'The bottom-right cell holds the optimal score; follow the arrows back to read the alignment.' : 'The highest cell holds the best local score; trace back from it until you reach 0.'); return; }
        const p = this.params();
        const c = this.E.cellCandidates(this.opt.S, this.seq1, this.seq2, cell.i, cell.j, p, this.mode === 'local');
        const r1 = this.seq1[cell.i - 1], r2 = this.seq2[cell.j - 1];
        const fmt = v => v < 0 ? `(${v})` : v;
        box.innerHTML = `<strong>Cell (${cell.i}, ${cell.j})</strong> – ${r1} (Seq 1) vs ${r2} (Seq 2):
            <ul>${c.candidates.map(x => `<li class="${x.best ? 'best' : ''}">${x.dir === 'diag' ? '↖ diagonal' : x.dir === 'left' ? '← from the left' : '↑ from above'}: ${x.base} + ${fmt(x.delta)} (${x.label}) = <strong>${x.value}</strong>${x.best ? ' ◀ max' : ''}</li>`).join('')}
            ${this.mode === 'local' ? `<li class="${c.floored ? 'best' : ''}">0 (start a new local alignment)${c.floored ? ' ◀ max' : ''}</li>` : ''}</ul>
            Value: <strong>${c.best}</strong>`;
    }

    matrixTooltip(cell, x, y) {
        const tip = this.$('mv-tooltip');
        if (!cell || !this.opt) { tip.hidden = true; return; }
        const v = this.opt.S[cell.i][cell.j];
        const r1 = cell.i ? this.seq1[cell.i - 1] : '–', r2 = cell.j ? this.seq2[cell.j - 1] : '–';
        let extra = '';
        if (cell.i && cell.j) extra = `<br>substitution ${r1}/${r2}: ${this.E.subScore(this.params(), r1, r2)}`;
        tip.innerHTML = `(${cell.i}, ${cell.j}) = <b>${v <= -1e8 ? '−∞' : v}</b>${extra}`;
        const wrap = tip.parentElement.getBoundingClientRect();
        tip.style.left = (x - wrap.left + 14) + 'px';
        tip.style.top = (y - wrap.top + 14) + 'px';
        tip.hidden = false;
    }

    // ------------------------------------------------------------ quiz
    renderQuiz(ex) {
        const box = this.$('quiz');
        box.innerHTML = '';
        if (!ex.questions || !ex.questions.length || !this.opt) return;
        const p = this.params();
        const ctx = { E: this.E, s1: this.seq1, s2: this.seq2, params: p,
            opt: this.mode === 'global' ? this.opt : this.E.globalAlign(this.seq1, this.seq2, p),
            loc: this.mode === 'local' ? this.opt : this.E.localAlign(this.seq1, this.seq2, p) };
        const h = document.createElement('h4');
        h.textContent = 'Check your understanding (answers use the current parameters)';
        box.appendChild(h);
        ex.questions.forEach((q, idx) => {
            const answer = q.answer(ctx);
            const item = document.createElement('div');
            item.className = 'dp-question';
            item.innerHTML = `<p><strong>${idx + 1}.</strong> ${q.q}</p>`;
            const fb = document.createElement('div');
            fb.className = 'dp-feedback'; fb.hidden = true;
            let attempts = 0;
            const judge = ok => {
                attempts++;
                fb.hidden = false;
                fb.className = 'dp-feedback ' + (ok ? 'correct' : 'wrong');
                if (ok) { fb.innerHTML = `✔ Correct. ${q.explanation ? q.explanation(ctx) : ''}`; item.querySelectorAll('input,button').forEach(el => el.disabled = true); }
                else if (attempts >= 2) fb.innerHTML = `✘ The answer is <strong>${q.type === 'choice' ? q.options[answer] : answer}</strong>. ${q.explanation ? q.explanation(ctx) : ''}`;
                else fb.textContent = '✘ Not quite – use the matrix or the editor and try once more.';
            };
            if (q.type === 'choice') {
                const opts = document.createElement('div'); opts.className = 'dp-options';
                q.options.forEach((t, oi) => { const b = document.createElement('button'); b.textContent = t; b.addEventListener('click', () => judge(oi === answer)); opts.appendChild(b); });
                item.appendChild(opts);
            } else {
                const row = document.createElement('div'); row.className = 'dp-answer-row';
                const inp = document.createElement('input'); inp.type = 'number'; inp.step = 'any';
                const b = document.createElement('button'); b.textContent = 'Check';
                const chk = () => { if (inp.value !== '') judge(Math.abs(parseFloat(inp.value) - answer) <= (q.tolerance || 0)); };
                b.addEventListener('click', chk);
                inp.addEventListener('keydown', e => { if (e.key === 'Enter') chk(); });
                row.appendChild(inp); row.appendChild(b); item.appendChild(row);
            }
            item.appendChild(fb);
            box.appendChild(item);
        });
    }

    toast(message, type = 'info') {
        const el = document.createElement('div');
        el.className = `notification notification-${type} show`;
        el.textContent = message;
        this.$('toast-stack').appendChild(el);
        setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3000);
    }
}

(function () {
    const start = () => { window.alignTrainer = new AlignTrainer(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
