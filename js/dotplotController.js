/**
 * DOTPLOT CONTROLLER
 * ==================
 * Wires the DOM to DotplotEngine / DotplotCanvas / DotplotChallenge.
 */
class DotplotController {
    constructor() {
        this.E = DotplotEngine;
        this.canvas = new DotplotCanvas('dotplot-canvas');
        this.result = null;
        this.blocks = [];
        this.currentExample = null;
        this.challenge = null;
        this.score = { correct: 0, total: 0 };
        this.maxLength = 500;
        this.shuffleBackup = null;

        this.$ = id => document.getElementById(id);
        this.bindInputs();
        this.bindParameters();
        this.bindExamples();
        this.bindChallenge();
        this.canvas.onSelect = (i, j) => this.inspectCell(i, j);
        this.canvas.onHover = (cell, x, y) => this.showTooltip(cell, x, y);
        this.syncParamControls();
    }

    // ------------------------------------------------------------ inputs
    bindInputs() {
        const seq1 = this.$('sequence1'), seq2 = this.$('sequence2');
        const debounced = () => {
            clearTimeout(this._inputTimer);
            this._inputTimer = setTimeout(() => this.draw({ quiet: true }), 350);
        };
        seq1.addEventListener('input', () => {
            this.shuffleBackup = null;
            if (this.$('self-compare').checked) seq2.value = seq1.value;
            this.leaveExample();
            debounced();
        });
        seq2.addEventListener('input', () => { this.shuffleBackup = null; this.leaveExample(); debounced(); });

        this.$('self-compare').addEventListener('change', e => {
            seq2.disabled = e.target.checked;
            if (e.target.checked) { seq2.value = seq1.value; this.shuffleBackup = null; }
            this.updateShuffleButton();
            this.draw({ quiet: true });
        });

        this.$('generate-dotplot').addEventListener('click', () => this.draw());
        this.$('clear-sequences').addEventListener('click', () => this.clear());
        this.$('shuffle-seq2').addEventListener('click', () => this.toggleShuffle());
    }

    bindParameters() {
        document.querySelectorAll('input[name="mode"]').forEach(r =>
            r.addEventListener('change', () => { this.syncParamControls(); this.draw({ quiet: true }); }));

        const slider = (id, valueId, after, redraw = true) => {
            const el = this.$(id);
            el.addEventListener('input', () => {
                this.$(valueId).textContent = el.value;
                if (after) after();
                if (redraw) this.draw({ quiet: true });
            });
        };
        slider('min-run', 'min-run-value');
        slider('window-size', 'window-size-value', () => {
            // threshold can never exceed the window
            const t = this.$('threshold'), w = parseInt(this.$('window-size').value);
            t.max = w;
            if (parseInt(t.value) > w) t.value = w;
            this.$('threshold-value').textContent = t.value;
        });
        slider('threshold', 'threshold-value');
        slider('min-block', 'min-block-value', () => this.updateBlocks(), false);

        this.$('show-blocks').addEventListener('change', () => {
            this.$('min-block-group').hidden = !this.$('show-blocks').checked;
            this.updateBlocks();
        });
    }

    syncParamControls() {
        const mode = this.mode();
        this.$('runlength-controls').hidden = mode !== 'runlength';
        this.$('window-controls').hidden = mode !== 'window';
    }

    mode() { return document.querySelector('input[name="mode"]:checked').value; }

    params() {
        return {
            mode: this.mode(),
            minRun: parseInt(this.$('min-run').value),
            window: parseInt(this.$('window-size').value),
            threshold: parseInt(this.$('threshold').value)
        };
    }

    applyParams(p) {
        if (!p) return;
        if (p.mode) document.querySelector(`input[name="mode"][value="${p.mode}"]`).checked = true;
        if (p.minRun) { this.$('min-run').value = p.minRun; this.$('min-run-value').textContent = p.minRun; }
        if (p.window) {
            this.$('window-size').value = p.window; this.$('window-size-value').textContent = p.window;
            this.$('threshold').max = p.window;
        }
        if (p.threshold) { this.$('threshold').value = p.threshold; this.$('threshold-value').textContent = p.threshold; }
        this.syncParamControls();
    }

    // ------------------------------------------------------------ examples
    bindExamples() {
        const sel = this.$('example-selector');
        const groups = { basic: 'Basic patterns (short sequences)', genomic: 'Genomic events (longer sequences)' };
        for (const [g, label] of Object.entries(groups)) {
            const og = document.createElement('optgroup');
            og.label = label;
            for (const [key, ex] of Object.entries(DOTPLOT_EXAMPLES)) {
                if ((ex.group || 'basic') !== g) continue;
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = ex.name;
                og.appendChild(opt);
            }
            sel.appendChild(og);
        }
        sel.addEventListener('change', () => { if (sel.value) this.loadExample(sel.value); });
    }

    loadExample(key) {
        const ex = DOTPLOT_EXAMPLES[key];
        if (!ex) return;
        this.endChallenge();
        this.currentExample = ex;
        this.shuffleBackup = null;
        this.$('sequence1').value = ex.seq1;
        this.$('self-compare').checked = !!ex.self;
        this.$('sequence2').disabled = !!ex.self;
        this.$('sequence2').value = ex.self ? ex.seq1 : ex.seq2;
        this.applyParams(ex.params);

        this.$('example-name').textContent = ex.name;
        this.$('example-description').textContent = ex.description;
        this.$('example-pattern').textContent = ex.expectedPattern || '';
        this.$('example-notes').textContent = ex.educationalNotes || '';
        this.$('example-notes-p').hidden = !ex.educationalNotes;
        this.renderQuiz(ex.questions || []);
        this.$('example-info-section').hidden = false;
        this.draw();
    }

    leaveExample() {
        // The user edited the sequences – the example's questions no longer apply.
        if (!this.currentExample) return;
        this.currentExample = null;
        this.$('example-info-section').hidden = true;
        this.$('example-selector').value = '';
    }

    renderQuiz(questions) {
        const box = this.$('quiz');
        box.innerHTML = '';
        if (!questions.length) return;
        const h = document.createElement('h4');
        h.textContent = 'Check your understanding';
        box.appendChild(h);

        questions.forEach((q, idx) => {
            const item = document.createElement('div');
            item.className = 'dp-question';
            const label = document.createElement('p');
            label.innerHTML = `<strong>${idx + 1}.</strong> ${q.q}`;
            item.appendChild(label);

            const feedback = document.createElement('div');
            feedback.className = 'dp-feedback';
            feedback.hidden = true;
            let attempts = 0;

            const judge = ok => {
                attempts++;
                feedback.hidden = false;
                feedback.className = 'dp-feedback ' + (ok ? 'correct' : 'wrong');
                if (ok) {
                    feedback.innerHTML = `✔ Correct. ${q.explanation || ''}`;
                    item.querySelectorAll('input,button').forEach(el => el.disabled = true);
                } else if (attempts >= 2) {
                    const ans = q.type === 'choice' ? q.options[q.answer] : q.answer;
                    feedback.innerHTML = `✘ Not quite. The answer is <strong>${ans}</strong>. ${q.explanation || ''}`;
                } else {
                    feedback.textContent = '✘ Not quite – look at the plot again and try once more.';
                }
            };

            if (q.type === 'choice') {
                const opts = document.createElement('div');
                opts.className = 'dp-options';
                q.options.forEach((text, oi) => {
                    const b = document.createElement('button');
                    b.textContent = text;
                    b.addEventListener('click', () => judge(oi === q.answer));
                    opts.appendChild(b);
                });
                item.appendChild(opts);
            } else {
                const row = document.createElement('div');
                row.className = 'dp-answer-row';
                const input = document.createElement('input');
                input.type = 'number';
                input.placeholder = 'number';
                const b = document.createElement('button');
                b.textContent = 'Check';
                const check = () => {
                    if (input.value === '') return;
                    judge(Math.abs(parseFloat(input.value) - q.answer) <= (q.tolerance || 0));
                };
                b.addEventListener('click', check);
                input.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
                row.appendChild(input);
                row.appendChild(b);
                item.appendChild(row);
            }
            item.appendChild(feedback);
            box.appendChild(item);
        });
    }

    // ------------------------------------------------------------ challenge
    bindChallenge() {
        this.$('new-challenge').addEventListener('click', () => this.newChallenge());
    }

    newChallenge() {
        const ch = DotplotChallenge.generate(this.challenge && this.challenge.event);
        this.challenge = ch;
        this.currentExample = null;
        this.$('example-info-section').hidden = true;
        this.$('example-selector').value = '';
        this.shuffleBackup = null;

        this.$('sequence1').value = ch.seq1;
        this.$('sequence2').value = ch.seq2;
        this.$('self-compare').checked = !!ch.self;
        this.$('sequence2').disabled = !!ch.self;
        this.applyParams(ch.params);
        this.draw();

        const opts = this.$('challenge-options');
        opts.innerHTML = '';
        DotplotChallenge.EVENTS.forEach(ev => {
            const b = document.createElement('button');
            b.textContent = ev.label;
            b.addEventListener('click', () => this.answerChallenge(ev.key, b));
            opts.appendChild(b);
        });
        opts.hidden = false;
        const fb = this.$('challenge-feedback');
        fb.hidden = true;
        fb.className = 'dp-feedback';
        this.$('new-challenge').textContent = 'Skip / new challenge';
    }

    answerChallenge(key, button) {
        if (!this.challenge || this.challenge.answered) return;
        this.challenge.answered = true;
        const ok = key === this.challenge.event;
        this.score.total++;
        if (ok) this.score.correct++;
        this.$('challenge-score').textContent = `${this.score.correct} / ${this.score.total}`;

        this.$('challenge-options').querySelectorAll('button').forEach(b => {
            b.disabled = true;
            if (b.textContent === this.challenge.label) b.classList.add('correct');
        });
        if (!ok) button.classList.add('wrong');

        const fb = this.$('challenge-feedback');
        fb.className = 'dp-feedback ' + (ok ? 'correct' : 'wrong');
        fb.innerHTML = (ok ? '✔ Correct! ' : `✘ It was <strong>${this.challenge.label}</strong>. `) + this.challenge.note;
        fb.hidden = false;
        this.$('new-challenge').textContent = 'Next challenge';
    }

    endChallenge() {
        this.challenge = null;
        this.$('challenge-options').hidden = true;
        this.$('challenge-feedback').hidden = true;
        this.$('new-challenge').textContent = 'New challenge';
    }

    // ------------------------------------------------------------ shuffle
    toggleShuffle() {
        const seq2 = this.$('sequence2');
        if (this.shuffleBackup !== null) {
            seq2.value = this.shuffleBackup;
            this.shuffleBackup = null;
        } else {
            const clean = this.E.cleanSequence(seq2.value);
            if (!clean) { this.toast('Enter Sequence 2 first', 'warning'); return; }
            this.shuffleBackup = seq2.value;
            seq2.value = this.E.shuffle(clean);
            if (this.$('self-compare').checked) {
                this.$('self-compare').checked = false;
                seq2.disabled = false;
            }
        }
        this.updateShuffleButton();
        this.draw();
    }

    updateShuffleButton() {
        this.$('shuffle-seq2').textContent = this.shuffleBackup !== null ? 'Undo shuffle' : 'Shuffle Seq 2';
    }

    // ------------------------------------------------------------ drawing
    validate(text, label) {
        const clean = this.E.cleanSequence(text);
        if (!clean) return `${label}: enter a DNA sequence (A, C, G, T)`;
        if (clean.length < 2) return `${label}: at least 2 bases are needed`;
        if (clean.length > this.maxLength) return `${label}: at most ${this.maxLength} bases (got ${clean.length})`;
        return null;
    }

    draw(opts = {}) {
        const seq1 = this.$('sequence1'), seq2 = this.$('sequence2');
        if (this.$('self-compare').checked) seq2.value = seq1.value;
        const errors = [this.validate(seq1.value, 'Sequence 1'), this.validate(seq2.value, 'Sequence 2')].filter(Boolean);
        seq1.classList.toggle('error', !!errors[0] && errors[0].startsWith('Sequence 1') && seq1.value.trim() !== '');
        seq2.classList.toggle('error', errors.some(e => e.startsWith('Sequence 2')) && seq2.value.trim() !== '');
        if (errors.length) {
            if (!opts.quiet) this.toast(errors[0], 'error');
            return;
        }
        this.updateShuffleButton();
        this.result = this.E.computeDotplot(seq1.value, seq2.value, this.params());
        this.canvas.setResult(this.result);
        this.hideInspector();
        this.updateStatistics();
        this.updateBlocks();
    }

    updateBlocks() {
        const show = this.$('show-blocks').checked;
        const details = this.$('alignment-details');
        if (!this.result || !show) {
            this.blocks = [];
            this.canvas.setBlocks([], false);
            details.hidden = true;
            return;
        }
        const minLen = parseInt(this.$('min-block').value);
        this.blocks = this.E.findBlocks(this.result, minLen);
        this.canvas.setBlocks(this.blocks, true);
        this.renderBlockList();
        details.hidden = false;
    }

    renderBlockList() {
        const list = this.$('alignment-blocks-list');
        this.$('block-count').textContent = `(${this.blocks.length})`;
        list.innerHTML = '';
        if (!this.blocks.length) {
            list.innerHTML = '<p class="no-alignments">No diagonal is at least this long. Lower the minimum block length.</p>';
            return;
        }
        this.blocks.forEach(b => {
            const item = document.createElement('div');
            item.className = `alignment-block-item ${b.reverse ? 'reverse' : 'forward'}`;
            item.innerHTML = `
                <div class="block-header">
                    <span class="block-type">${b.reverse ? 'Reverse-complement' : 'Forward'} block ${b.index + 1}</span>
                    <span class="block-score">${b.len} bp · ${(b.identity * 100).toFixed(1)} % identity</span>
                </div>
                <div class="block-details">
                    <div class="block-coords">
                        <span>Seq 1: ${b.s1Start}–${b.s1End}</span>
                        <span>Seq 2: ${b.s2Start}–${b.s2End}${b.reverse ? ' (opposite strand)' : ''}</span>
                    </div>
                    <div class="block-stats"><span>${b.matches} matches</span><span>${b.mismatches} mismatches</span></div>
                </div>`;
            item.addEventListener('click', () => {
                const on = item.classList.contains('selected');
                list.querySelectorAll('.alignment-block-item').forEach(el => el.classList.remove('selected'));
                if (!on) item.classList.add('selected');
                this.canvas.highlightBlock(on ? null : b.index);
            });
            list.appendChild(item);
        });
    }

    updateStatistics() {
        const s = this.result.stats;
        const p = s.params;
        const fmt = v => v >= 100 ? Math.round(v).toString() : v >= 10 ? v.toFixed(1) : v.toFixed(2);
        const settings = p.mode === 'window'
            ? `window ${p.window}, threshold ${p.threshold}`
            : `min. diagonal length ${p.minRun}`;
        const observedUnit = p.mode === 'window' ? 'dots' : `${p.minRun}-mer matches`;
        const rows = [
            ['Sequence lengths', `${s.n} × ${s.m}`],
            ['Settings', settings],
            ['Forward dots / diagonals', `<span class="forward-color">${s.forward.dots}</span> / ${s.forward.segments}`],
            ['Reverse dots / diagonals', `<span class="reverse-color">${s.reverse.dots}</span> / ${s.reverse.segments}`],
            ['Longest diagonal (fwd / rev)', `${s.forward.longest} / ${s.reverse.longest} bp`],
            [`Observed ${observedUnit} (fwd / rev)`, `${s.observedForward} / ${s.observedReverse}`],
            ['Expected by chance, per strand', `≈ ${fmt(s.expectedPerStrand)}`]
        ];
        this.$('statistics-content').innerHTML =
            '<div class="stats-grid">' +
            rows.map(([k, v]) => `<div class="stat-item"><span class="stat-label">${k}</span><span class="stat-value">${v}</span></div>`).join('') +
            '</div>' +
            `<p class="dp-hint">"Expected by chance" is how many ${observedUnit} two random sequences of these lengths would give with the same settings` +
            (p.mode === 'window'
                ? ` (windows × P(≥ ${p.threshold} of ${p.window} match, p = ¼)).`
                : ` ((n−k+1)(m−k+1) / 4<sup>k</sup> with k = ${p.minRun}).`) +
            ' Use "Shuffle Seq 2" to check it empirically.</p>';
    }

    // ------------------------------------------------------------ inspection
    context(seq, centre, half = 10) {
        let out = '';
        for (let k = centre - half; k <= centre + half; k++) out += (k < 0 || k >= seq.length) ? ' ' : seq[k];
        return out;
    }

    markup(segment, type) {
        let html = '';
        const centre = Math.floor(segment.length / 2);
        for (let k = 0; k < segment.length; k++) {
            const ch = segment[k];
            let cls = 'base';
            if (type === 'match') { if (ch === '|') cls += ' match-base'; }
            else cls += ch === ' ' ? ' nucleotide-space' : ` nucleotide-${ch}`;
            if (k === centre) cls += ' center-base';
            html += `<span class="${cls}">${ch === ' ' ? '&nbsp;' : ch}</span>`;
        }
        return html;
    }

    matchLine(a, b) {
        let out = '';
        for (let k = 0; k < a.length; k++) out += (a[k] !== ' ' && a[k] === b[k]) ? '|' : ' ';
        return out;
    }

    inspectCell(i, j) {
        if (!this.result) return;
        const { seq1, seq2, seq2rc, m } = this.result;
        const jrc = m - 1 - j;

        const a = this.context(seq1, i), b = this.context(seq2, j);
        this.$('alignment-position-info').textContent = `Same strand: Seq 1 position ${i + 1} (${seq1[i]}) vs Seq 2 position ${j + 1} (${seq2[j]})`;
        this.$('seq1-alignment').innerHTML = this.markup(a, 'seq');
        this.$('match-alignment').innerHTML = this.markup(this.matchLine(a, b), 'match');
        this.$('seq2-alignment').innerHTML = this.markup(b, 'seq');
        this.$('alignment-section').hidden = false;

        const c = this.context(seq2rc, jrc);
        this.$('reverse-alignment-position-info').textContent =
            `Reverse complement: Seq 1 position ${i + 1} (${seq1[i]}) vs Seq 2 position ${j + 1} read on the opposite strand (${seq2rc[jrc]}; position ${jrc + 1} of the reverse complement)`;
        this.$('seq1-reverse-alignment').innerHTML = this.markup(a, 'seq');
        this.$('match-reverse-alignment').innerHTML = this.markup(this.matchLine(a, c), 'match');
        this.$('seq2-reverse-alignment').innerHTML = this.markup(c, 'seq');
        this.$('reverse-alignment-section').hidden = false;
    }

    hideInspector() {
        this.$('alignment-section').hidden = true;
        this.$('reverse-alignment-section').hidden = true;
    }

    showTooltip(cell, clientX, clientY) {
        const tip = this.$('dp-tooltip');
        if (!cell || !this.result) { tip.hidden = true; return; }
        const { seq1, seq2, seq2rc, n, m } = this.result;
        const fwd = this.result.forward.matrix[cell.j * n + cell.i];
        const rev = this.result.reverse.matrix[(m - 1 - cell.j) * n + cell.i];
        let status = 'no dot';
        if (fwd) status = fwd === 1 ? 'same-strand match' : 'same-strand window (mismatch here)';
        if (rev) status = (fwd ? status + ' + ' : '') + (rev === 1 ? 'reverse-complement match' : 'reverse-complement window');
        tip.innerHTML = `Seq 1: <b>${cell.i + 1}</b> ${seq1[cell.i]} &nbsp; Seq 2: <b>${cell.j + 1}</b> ${seq2[cell.j]} (rc: ${seq2rc[m - 1 - cell.j]})<br><span class="dp-tip-status">${status}</span>`;
        const wrap = tip.parentElement.getBoundingClientRect();
        tip.style.left = (clientX - wrap.left + 14) + 'px';
        tip.style.top = (clientY - wrap.top + 14) + 'px';
        tip.hidden = false;
    }

    // ------------------------------------------------------------ misc
    clear() {
        this.$('sequence1').value = '';
        this.$('sequence2').value = '';
        this.$('sequence2').disabled = false;
        this.$('self-compare').checked = false;
        this.$('example-selector').value = '';
        this.$('example-info-section').hidden = true;
        this.shuffleBackup = null;
        this.updateShuffleButton();
        this.endChallenge();
        this.result = null;
        this.blocks = [];
        this.canvas.clear();
        this.hideInspector();
        this.$('alignment-details').hidden = true;
        this.$('statistics-content').innerHTML = '<p class="no-stats">Draw a dotplot to see statistics</p>';
    }

    toast(message, type = 'info') {
        const stack = this.$('toast-stack');
        const el = document.createElement('div');
        el.className = `notification notification-${type} show`;
        el.textContent = message;
        stack.appendChild(el);
        setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3000);
    }
}
