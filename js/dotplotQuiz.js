/**
 * DOTPLOT QUIZ – session / drill controller
 * =========================================
 * Runs entirely in the browser (static hosting): questions come from
 * DotplotQuizGen with a seed, grading is local, history lives in localStorage.
 */
class DotplotQuiz {
    constructor() {
        this.G = DotplotQuizGen;
        this.E = DotplotEngine;
        this.$ = id => document.getElementById(id);
        this.canvas = new DotplotCanvas('dotplot-canvas');
        this.canvas.emptyText = 'Start a session or a drill – the plot appears here';
        this.canvas.draw();
        this.canvas.onHover = (cell, x, y) => this.showTooltip(cell, x, y);
        this.canvas.onSelect = (i, j) => this.readout(i, j);

        this.mode = null;           // 'session' | 'drill'
        this.seed = '';
        this.plan = [];
        this.index = 0;
        this.q = null;
        this.result = null;
        this.answered = false;
        this.hintUsed = false;
        this.log = [];

        this.bindStart();
        this.bindQuestion();
        this.bindParams();
        this.renderHistory();
        this.initSeed();
    }

    // ------------------------------------------------------------ start screen
    initSeed() {
        const m = location.hash.match(/seed=([^&]+)/);
        this.$('seed-input').value = m ? decodeURIComponent(m[1]) : this.G.randomSeedString(new this.G.Rng(Date.now() + Math.random()));
    }

    bindStart() {
        const sel = this.$('drill-type');
        for (let level = 1; level <= 6; level++) {
            const og = document.createElement('optgroup');
            og.label = `Level ${level} – ${this.G.SKILLS[Object.values(this.G.TYPES).find(t => t.level === level).skill]}`;
            for (const [key, t] of Object.entries(this.G.TYPES)) {
                if (t.level !== level) continue;
                const o = document.createElement('option');
                o.value = key; o.textContent = t.name;
                og.appendChild(o);
            }
            sel.appendChild(og);
        }
        this.$('new-seed').addEventListener('click', () => {
            this.$('seed-input').value = this.G.randomSeedString(new this.G.Rng(Date.now() + Math.random()));
        });
        this.$('start-session').addEventListener('click', () => this.startSession(this.$('seed-input').value.trim() || 'default'));
        this.$('start-drill').addEventListener('click', () => this.startDrill(sel.value));
        this.$('again-same').addEventListener('click', () => this.startSession(this.seed));
        this.$('again-new').addEventListener('click', () => { this.$('new-seed').click(); this.startSession(this.$('seed-input').value); });
        this.$('drill-weakest').addEventListener('click', () => this.startDrill(this.weakestType || 'events-single'));
    }

    startSession(seed) {
        this.mode = 'session';
        this.seed = seed;
        location.hash = 'seed=' + encodeURIComponent(seed);
        this.plan = this.G.sessionPlan(new this.G.Rng(seed + '#plan'));
        this.index = 0;
        this.log = [];
        this.showScreen('question');
        this.showQuestion();
    }

    startDrill(type) {
        this.mode = 'drill';
        this.drillType = type;
        this.seed = this.G.randomSeedString(new this.G.Rng(Date.now() + Math.random()));
        this.plan = [];
        this.index = 0;
        this.log = [];
        this.showScreen('question');
        this.showQuestion();
    }

    showScreen(name) {
        for (const s of ['start', 'question', 'summary']) this.$(`${s}-screen`).hidden = s !== name;
    }

    // ------------------------------------------------------------ question flow
    currentType() {
        return this.mode === 'session' ? this.plan[this.index] : this.drillType;
    }

    showQuestion() {
        const type = this.currentType();
        // one RNG per question so a question never depends on how earlier ones were answered
        const rng = new this.G.Rng(`${this.seed}#${this.index}#${type}`);
        const q = this.G.generate(type, rng);
        this.q = q;
        this.answered = false;
        this.hintUsed = false;

        const total = this.mode === 'session' ? this.plan.length : null;
        this.$('progress-text').textContent = total
            ? `Question ${this.index + 1} of ${total} · Level ${q.level} · ${this.G.SKILLS[q.skill]}`
            : `Drill · question ${this.index + 1} · Level ${q.level} · ${this.G.SKILLS[q.skill]}`;
        this.$('progress-fill').style.width = total ? `${(this.index / total) * 100}%` : '0%';
        this.$('q-title').textContent = q.title;
        this.$('q-prompt').innerHTML = q.prompt;
        this.$('hint-box').hidden = true;
        this.$('feedback-box').hidden = true;
        this.$('check-btn').hidden = false;
        this.$('check-btn').disabled = false;
        this.$('hint-btn').disabled = false;
        this.$('next-btn').hidden = true;
        this.updateRunningScore();

        // plot
        this.$('grid-area').hidden = !q.grid;
        this.$('plot-area').hidden = !!q.grid;
        this.$('plot-title').textContent = q.self ? 'Dotplot (self-comparison)' : 'Dotplot';
        if (q.grid) {
            this.renderGrid(q);
        } else {
            this.canvas.setLetterVisibility(q.showSeq.seq1, q.showSeq.seq2);
            this.setParams(q.params);
            this.recompute();
        }
        this.$('param-panel').hidden = !q.allowParams;
        this.setParamsEnabled(q.allowParams);
        this.renderSequencePanel(q);
        this.$('cell-readout').textContent = 'Hover over the plot to read coordinates; click a cell to keep a cross-hair, then use ← ↑ → ↓ < > [ ] to move it.';

        this.renderAnswerWidget(q);
    }

    renderSequencePanel(q) {
        const panel = this.$('seq-panel');
        const show1 = q.showSeq.seq1, show2 = q.showSeq.seq2;
        panel.hidden = !(show1 || show2) || q.grid;
        this.$('seq1-line').innerHTML = show1 ? `<strong>Seq 1</strong> (${q.seq1.length} bp): <code>${q.seq1}</code>` : '';
        this.$('seq2-line').innerHTML = show2 ? `<strong>Seq 2</strong> (${q.seq2.length} bp): <code>${q.seq2}</code>` : '';
    }

    recompute() {
        this.result = this.E.computeDotplot(this.q.seq1, this.q.seq2, this.params());
        this.canvas.setResult(this.result);
        if (this.answered) this.canvas.setOverlays(this.q.overlays);
        const s = this.result.stats;
        this.$('param-stats').textContent = `${s.forward.dots} forward dots, ${s.reverse.dots} reverse dots · expected by chance ≈ ${s.expectedPerStrand.toFixed(1)} ${s.expectedLabel} per strand`;
    }

    // ------------------------------------------------------------ parameters
    bindParams() {
        document.querySelectorAll('input[name="mode"]').forEach(r =>
            r.addEventListener('change', () => { this.syncParamControls(); this.recompute(); }));
        const slider = (id, valueId, after) => {
            const el = this.$(id);
            el.addEventListener('input', () => {
                this.$(valueId).textContent = el.value;
                if (after) after();
                this.recompute();
            });
        };
        slider('min-run', 'min-run-value');
        slider('window-size', 'window-size-value', () => {
            const t = this.$('threshold'), w = parseInt(this.$('window-size').value);
            t.max = w;
            if (parseInt(t.value) > w) t.value = w;
            this.$('threshold-value').textContent = t.value;
        });
        slider('threshold', 'threshold-value');
    }

    syncParamControls() {
        const mode = document.querySelector('input[name="mode"]:checked').value;
        this.$('runlength-controls').hidden = mode !== 'runlength';
        this.$('window-controls').hidden = mode !== 'window';
    }

    params() {
        return {
            mode: document.querySelector('input[name="mode"]:checked').value,
            minRun: parseInt(this.$('min-run').value),
            window: parseInt(this.$('window-size').value),
            threshold: parseInt(this.$('threshold').value)
        };
    }

    setParams(p) {
        p = this.E.normalizeParams(p);
        document.querySelector(`input[name="mode"][value="${p.mode}"]`).checked = true;
        this.$('min-run').value = p.minRun; this.$('min-run-value').textContent = p.minRun;
        this.$('window-size').value = p.window; this.$('window-size-value').textContent = p.window;
        this.$('threshold').max = p.window;
        this.$('threshold').value = p.threshold; this.$('threshold-value').textContent = p.threshold;
        this.syncParamControls();
    }

    setParamsEnabled(on) {
        this.$('param-panel').querySelectorAll('input').forEach(el => el.disabled = !on);
    }

    // ------------------------------------------------------------ answer widgets
    renderAnswerWidget(q) {
        const area = this.$('answer-area');
        area.innerHTML = '';
        const a = q.answer;
        if (a.kind === 'multi') {
            const box = document.createElement('div');
            box.className = 'dp-checklist';
            a.options.forEach(o => {
                const lab = document.createElement('label');
                lab.innerHTML = `<input type="checkbox" value="${o.key}"> ${o.label}`;
                box.appendChild(lab);
            });
            area.appendChild(box);
        } else if (a.kind === 'choice') {
            const box = document.createElement('div');
            box.className = 'dp-checklist';
            a.options.forEach((label, i) => {
                const lab = document.createElement('label');
                lab.innerHTML = `<input type="radio" name="choice" value="${i}"> ${label}`;
                box.appendChild(lab);
            });
            area.appendChild(box);
        } else if (a.kind === 'fields') {
            a.fields.forEach(f => {
                const row = document.createElement('div');
                row.className = 'dp-field';
                const lab = document.createElement('label');
                lab.textContent = f.label;
                row.appendChild(lab);
                if (f.kind === 'number') {
                    const inp = document.createElement('input');
                    inp.type = 'number'; inp.dataset.key = f.key; inp.step = 'any';
                    inp.addEventListener('keydown', e => { if (e.key === 'Enter') this.check(); });
                    row.appendChild(inp);
                } else {
                    const sel = document.createElement('select');
                    sel.dataset.key = f.key;
                    sel.innerHTML = '<option value="">– choose –</option>' + f.options.map((o, i) => `<option value="${i}">${o}</option>`).join('');
                    row.appendChild(sel);
                }
                const mark = document.createElement('span');
                mark.className = 'dp-mark';
                row.appendChild(mark);
                area.appendChild(row);
            });
        } else if (a.kind === 'params') {
            area.innerHTML = '<p class="dp-hint">Use the parameter controls under the plot, then press <strong>Check</strong>. You can check as often as you like before pressing Next.</p>';
        } else if (a.kind === 'cells') {
            area.innerHTML = '<p class="dp-hint">Click cells in the grid on the right to mark them; click again to unmark.</p>';
        }
    }

    renderGrid(q) {
        const area = this.$('grid-area');
        const n = q.seq1.length, m = q.seq2.length;
        let html = '<table class="dp-grid"><tr><th></th>';
        for (let i = 0; i < n; i++) html += `<th>${q.seq1[i]}<small>${i + 1}</small></th>`;
        html += '</tr>';
        for (let j = 0; j < m; j++) {
            html += `<tr><th>${q.seq2[j]}<small>${j + 1}</small></th>`;
            for (let i = 0; i < n; i++) html += `<td data-i="${i}" data-j="${j}"></td>`;
            html += '</tr>';
        }
        html += '</table><p class="dp-hint">Sequence 1 runs left→right, Sequence 2 top→bottom.</p>';
        area.innerHTML = html;
        area.querySelectorAll('td').forEach(td => td.addEventListener('click', () => {
            if (!this.answered) td.classList.toggle('on');
        }));
    }

    // ------------------------------------------------------------ grading
    bindQuestion() {
        this.$('check-btn').addEventListener('click', () => this.check());
        this.$('hint-btn').addEventListener('click', () => {
            this.hintUsed = true;
            this.$('hint-box').innerHTML = `<strong>Hint:</strong> ${this.q.hint}`;
            this.$('hint-box').className = 'dp-feedback';
            this.$('hint-box').hidden = false;
            this.$('hint-btn').disabled = true;
        });
        this.$('next-btn').addEventListener('click', () => this.next());
        this.$('quit-btn').addEventListener('click', () => this.finish());
    }

    grade() {
        const q = this.q, a = q.answer, area = this.$('answer-area');
        if (a.kind === 'multi') {
            const chosen = [...area.querySelectorAll('input:checked')].map(el => el.value);
            const correct = new Set(a.correct);
            const missed = a.correct.filter(k => !chosen.includes(k));
            const extra = chosen.filter(k => !correct.has(k));
            const label = k => a.options.find(o => o.key === k).label;
            const ok = !missed.length && !extra.length;
            let detail = '';
            if (missed.length) detail += `Missed: ${missed.map(label).join(', ')}. `;
            if (extra.length) detail += `Not present: ${extra.map(label).join(', ')}. `;
            area.querySelectorAll('input').forEach(el => {
                el.disabled = true;
                el.parentElement.classList.toggle('correct', correct.has(el.value));
                el.parentElement.classList.toggle('wrong', el.checked && !correct.has(el.value));
            });
            const score = ok ? 1 : Math.max(0, (a.correct.length - missed.length - extra.length) / a.correct.length);
            return { ok, score: ok ? 1 : Math.min(0.5, score), detail };
        }
        if (a.kind === 'choice') {
            const sel = area.querySelector('input:checked');
            if (!sel) return null;
            const ok = parseInt(sel.value) === a.correct;
            area.querySelectorAll('input').forEach(el => {
                el.disabled = true;
                el.parentElement.classList.toggle('correct', parseInt(el.value) === a.correct);
                el.parentElement.classList.toggle('wrong', el.checked && parseInt(el.value) !== a.correct);
            });
            return { ok, score: ok ? 1 : 0, detail: '' };
        }
        if (a.kind === 'fields') {
            let good = 0, detail = '';
            for (const f of a.fields) {
                const el = area.querySelector(`[data-key="${f.key}"]`);
                if (el.value === '') return null;
                let ok;
                if (f.kind === 'number') ok = Math.abs(parseFloat(el.value) - f.answer) <= (f.tolerance || 0);
                else ok = parseInt(el.value) === f.answer;
                if (ok) good++;
                el.disabled = true;
                const mark = el.parentElement.querySelector('.dp-mark');
                mark.textContent = ok ? '✔' : `✘ ${f.kind === 'number' ? (Number.isInteger(f.answer) ? f.answer : f.answer.toFixed(1)) : f.options[f.answer]}`;
                mark.className = 'dp-mark ' + (ok ? 'correct' : 'wrong');
            }
            const ok = good === a.fields.length;
            if (!ok) detail = `${good} of ${a.fields.length} answers correct.`;
            return { ok, score: good / a.fields.length, detail };
        }
        if (a.kind === 'params') {
            const g = a.grade(this.params());
            return { ok: g.ok, score: g.score, detail: g.message, retry: !g.ok };
        }
        if (a.kind === 'cells') {
            const marked = new Set([...this.$('grid-area').querySelectorAll('td.on')].map(td => `${td.dataset.i},${td.dataset.j}`));
            const truth = new Set(a.correct.map(c => c.join(',')));
            let missed = 0, extra = 0;
            for (const k of truth) if (!marked.has(k)) missed++;
            for (const k of marked) if (!truth.has(k)) extra++;
            this.$('grid-area').querySelectorAll('td').forEach(td => {
                const k = `${td.dataset.i},${td.dataset.j}`;
                if (truth.has(k) && !marked.has(k)) td.classList.add('missed');
                if (!truth.has(k) && marked.has(k)) td.classList.add('extra');
            });
            const ok = missed === 0 && extra === 0;
            return { ok, score: Math.max(0, 1 - (missed + extra) / truth.size), detail: ok ? '' : `${missed} cell${missed === 1 ? '' : 's'} missed (red), ${extra} marked wrongly (crossed).` };
        }
        return null;
    }

    check() {
        if (this.answered) return;
        const g = this.grade();
        if (g === null) { this.toast('Please answer every part of the question first', 'warning'); return; }

        const fb = this.$('feedback-box');
        if (g.retry) {
            // parameter question: allow further attempts
            fb.className = 'dp-feedback wrong';
            fb.innerHTML = `✘ Not yet. ${g.detail} Adjust the parameters and check again, or press Next to give up.`;
            fb.hidden = false;
            this.$('next-btn').hidden = false;
            this.pendingParams = g;
            return;
        }
        this.commit(g);
    }

    commit(g) {
        this.answered = true;
        let score = g.score;
        if (this.hintUsed) score = Math.min(score, 0.5);
        this.log.push({ type: this.q.type, level: this.q.level, skill: this.q.skill, score, ok: g.ok, hint: this.hintUsed });

        const fb = this.$('feedback-box');
        const head = g.ok ? '✔ Correct.' : (score > 0 ? `◐ Partly correct (${Math.round(score * 100)} %).` : '✘ Not correct.');
        fb.className = 'dp-feedback ' + (g.ok ? 'correct' : 'wrong');
        fb.innerHTML = `<strong>${head}</strong> ${g.detail || ''}<div class="dp-explain">${this.q.explanation}</div>` +
            (this.hintUsed && g.ok ? '<div class="dp-hint">Hint used – half points.</div>' : '');
        fb.hidden = false;

        this.$('check-btn').hidden = true;
        this.$('hint-btn').disabled = true;
        this.$('next-btn').hidden = false;
        this.$('next-btn').focus();
        this.setParamsEnabled(true && this.q.allowParams);
        if (!this.q.grid) this.canvas.setOverlays(this.q.overlays);
        this.updateRunningScore();
    }

    next() {
        if (!this.answered) {
            // parameter question given up
            if (this.pendingParams) this.commit(Object.assign({}, this.pendingParams, { score: 0, ok: false }));
            else return;
            this.pendingParams = null;
            return;   // show the explanation first; the next click moves on
        }
        this.pendingParams = null;
        this.index++;
        if (this.mode === 'session' && this.index >= this.plan.length) { this.finish(); return; }
        this.showQuestion();
    }

    updateRunningScore() {
        const got = this.log.reduce((s, e) => s + e.score, 0);
        this.$('running-score').textContent = this.log.length ? `Score so far: ${got.toFixed(1)} / ${this.log.length}` : '';
    }

    // ------------------------------------------------------------ summary
    finish() {
        if (!this.log.length) { this.showScreen('start'); return; }
        const got = this.log.reduce((s, e) => s + e.score, 0);
        const perSkill = {};
        for (const e of this.log) {
            perSkill[e.skill] = perSkill[e.skill] || { got: 0, n: 0, types: {} };
            perSkill[e.skill].got += e.score; perSkill[e.skill].n++;
            perSkill[e.skill].types[e.type] = (perSkill[e.skill].types[e.type] || 0) + (1 - e.score);
        }
        const history = this.loadHistory();
        const prev = history.length ? history[history.length - 1] : null;

        this.$('summary-score').innerHTML = `${got.toFixed(1)} / ${this.log.length} points (${Math.round(got / this.log.length * 100)} %)`;
        let rows = '';
        let weakest = null, weakestRatio = 2;
        for (const [skill, v] of Object.entries(perSkill)) {
            const ratio = v.got / v.n;
            const prevRatio = prev && prev.skills[skill] ? prev.skills[skill].got / prev.skills[skill].n : null;
            const trend = prevRatio === null ? '' : ratio > prevRatio + 0.01 ? ' ▲' : ratio < prevRatio - 0.01 ? ' ▼' : ' ▬';
            rows += `<div class="stat-item"><span class="stat-label">${this.G.SKILLS[skill]}</span><span class="stat-value ${ratio >= 0.75 ? 'forward-color' : ratio < 0.5 ? 'reverse-color' : ''}">${v.got.toFixed(1)} / ${v.n}${trend}</span></div>`;
            if (ratio < weakestRatio) {
                weakestRatio = ratio;
                weakest = Object.entries(v.types).sort((a, b) => b[1] - a[1])[0][0];
            }
        }
        this.weakestType = weakest;
        this.$('summary-skills').innerHTML = `<div class="stats-grid">${rows}</div>`;
        this.$('summary-compare').textContent = prev
            ? `Previous session on ${new Date(prev.date).toLocaleDateString()}: ${prev.score.toFixed(1)} / ${prev.total} (▲▼ show change per skill).`
            : 'First recorded session on this browser.';
        this.$('drill-weakest').textContent = weakest ? `Drill: ${this.G.TYPES[weakest].name}` : 'Drill weakest skill';
        const link = location.origin + location.pathname + '#seed=' + encodeURIComponent(this.seed);
        this.$('summary-link').textContent = link;
        this.$('summary-link').href = link;

        if (this.mode === 'session') {
            history.push({ date: Date.now(), seed: this.seed, score: got, total: this.log.length,
                skills: Object.fromEntries(Object.entries(perSkill).map(([k, v]) => [k, { got: v.got, n: v.n }])) });
            this.saveHistory(history.slice(-20));
            this.renderHistory();
        }
        this.showScreen('summary');
        this.$('plot-title').textContent = 'Dotplot';
        this.canvas.clear();
        this.$('param-panel').hidden = true;
        this.$('seq-panel').hidden = true;
        this.$('grid-area').hidden = true;
        this.$('plot-area').hidden = false;
    }

    loadHistory() {
        try { return JSON.parse(localStorage.getItem('dotplotQuizHistory') || '[]'); } catch (e) { return []; }
    }
    saveHistory(h) {
        try { localStorage.setItem('dotplotQuizHistory', JSON.stringify(h)); } catch (e) { /* private mode etc. */ }
    }
    renderHistory() {
        const h = this.loadHistory();
        this.$('history-box').hidden = !h.length;
        if (!h.length) return;
        this.$('history-content').innerHTML = '<div class="stats-grid">' + h.slice(-5).reverse().map(s =>
            `<div class="stat-item"><span class="stat-label">${new Date(s.date).toLocaleString()} · <a href="#seed=${encodeURIComponent(s.seed)}" class="dp-seed-link">${s.seed}</a></span><span class="stat-value">${s.score.toFixed(1)} / ${s.total}</span></div>`).join('') + '</div>';
        this.$('history-content').querySelectorAll('.dp-seed-link').forEach(a => a.addEventListener('click', e => {
            e.preventDefault();
            this.$('seed-input').value = decodeURIComponent(a.getAttribute('href').slice(6));
        }));
    }

    // ------------------------------------------------------------ plot helpers
    showTooltip(cell, clientX, clientY) {
        const tip = this.$('dp-tooltip');
        if (!cell || !this.result) { tip.hidden = true; return; }
        const { seq1, seq2, n, m } = this.result;
        const fwd = this.result.forward.matrix[cell.j * n + cell.i];
        const rev = this.result.reverse.matrix[(m - 1 - cell.j) * n + cell.i];
        const b1 = this.q.showSeq.seq1 ? ` ${seq1[cell.i]}` : '', b2 = this.q.showSeq.seq2 ? ` ${seq2[cell.j]}` : '';
        const status = fwd && rev ? 'both strands' : fwd ? 'same-strand dot' : rev ? 'reverse-complement dot' : 'no dot';
        tip.innerHTML = `Seq 1: <b>${cell.i + 1}</b>${b1} &nbsp; Seq 2: <b>${cell.j + 1}</b>${b2}<br><span class="dp-tip-status">${status}</span>`;
        const wrap = tip.parentElement.getBoundingClientRect();
        tip.style.left = (clientX - wrap.left + 14) + 'px';
        tip.style.top = (clientY - wrap.top + 14) + 'px';
        tip.hidden = false;
    }

    readout(i, j) {
        this.$('cell-readout').textContent = `Selected cell: Seq 1 position ${i + 1}, Seq 2 position ${j + 1}. Use ← ↑ → ↓ to move, < > along the diagonal, [ ] along the anti-diagonal.`;
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
    const start = () => { window.dotplotQuiz = new DotplotQuiz(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
