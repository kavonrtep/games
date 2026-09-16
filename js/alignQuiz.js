/**
 * ALIGNMENT QUIZ – session / drill controller
 * ===========================================
 * Same structure as the dotplot quiz: seeded questions from
 * AlignQuizGen, local grading, history in localStorage.
 */
class AlignQuiz {
    constructor() {
        this.G = AlignQuizGen;
        this.E = AlignEngine;
        this.$ = id => document.getElementById(id);
        this.matrix = new AlignMatrixView(this.$('matrix'), { onHover: (c, x, y) => this.tooltip(c, x, y) });
        this.editor = new AlignEditor(this.$('editor'), { onChange: () => this.onEdit() });

        this.mode = null; this.seed = ''; this.plan = []; this.index = 0;
        this.q = null; this.answered = false; this.hintUsed = false; this.log = [];

        this.bindStart();
        this.bindQuestion();
        this.renderHistory();
        this.initSeed();
        this.renderBlosum();
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
            const first = Object.values(this.G.TYPES).find(t => t.level === level);
            og.label = `Level ${level} – ${this.G.SKILLS[first.skill]}`;
            for (const [key, t] of Object.entries(this.G.TYPES)) {
                if (t.level !== level) continue;
                const o = document.createElement('option'); o.value = key; o.textContent = t.name; og.appendChild(o);
            }
            sel.appendChild(og);
        }
        this.$('new-seed').addEventListener('click', () => { this.$('seed-input').value = this.G.randomSeedString(new this.G.Rng(Date.now() + Math.random())); });
        this.$('start-session').addEventListener('click', () => this.startSession(this.$('seed-input').value.trim() || 'default'));
        this.$('start-drill').addEventListener('click', () => this.startDrill(sel.value));
        this.$('again-same').addEventListener('click', () => this.startSession(this.seed));
        this.$('again-new').addEventListener('click', () => { this.$('new-seed').click(); this.startSession(this.$('seed-input').value); });
        this.$('drill-weakest').addEventListener('click', () => this.startDrill(this.weakestType || 'fill-global'));
    }

    startSession(seed) {
        this.mode = 'session'; this.seed = seed;
        location.hash = 'seed=' + encodeURIComponent(seed);
        this.plan = this.G.sessionPlan(new this.G.Rng(seed + '#plan'));
        this.index = 0; this.log = [];
        this.showScreen('question'); this.showQuestion();
    }

    startDrill(type) {
        this.mode = 'drill'; this.drillType = type;
        this.seed = this.G.randomSeedString(new this.G.Rng(Date.now() + Math.random()));
        this.plan = []; this.index = 0; this.log = [];
        this.showScreen('question'); this.showQuestion();
    }

    showScreen(name) { for (const s of ['start', 'question', 'summary']) this.$(`${s}-screen`).hidden = s !== name; }

    // ------------------------------------------------------------ question flow
    currentType() { return this.mode === 'session' ? this.plan[this.index] : this.drillType; }

    showQuestion() {
        const type = this.currentType();
        const q = this.G.generate(type, new this.G.Rng(`${this.seed}#${this.index}#${type}`));
        this.q = q; this.answered = false; this.hintUsed = false;
        const total = this.mode === 'session' ? this.plan.length : null;
        this.$('progress-text').textContent = total
            ? `Question ${this.index + 1} of ${total} · Level ${q.level} · ${this.G.SKILLS[q.skill]}`
            : `Drill · question ${this.index + 1} · Level ${q.level} · ${this.G.SKILLS[q.skill]}`;
        this.$('progress-fill').style.width = total ? `${(this.index / total) * 100}%` : '0%';
        this.$('q-title').textContent = q.title;
        this.$('q-prompt').innerHTML = q.prompt;
        this.$('hint-box').hidden = true; this.$('feedback-box').hidden = true;
        this.$('check-btn').hidden = false; this.$('hint-btn').disabled = false; this.$('next-btn').hidden = true;
        this.updateRunningScore();

        // workspace
        this.result = q.local ? this.E.localAlign(q.s1, q.s2, q.params) : this.E.globalAlign(q.s1, q.s2, q.params);
        const w = q.workspace.matrix;
        this.matrix.showValues = w.values !== false;
        this.matrix.showArrows = w.arrows !== false;
        this.matrix.showOptimal = !!w.optimal;
        this.matrix.studentPath = null;
        this.matrix.mode = w.mode || 'full';
        this.matrix.set({ s1: q.s1, s2: q.s2, params: q.params, result: this.result, local: !!q.local });
        this.$('matrix-area').hidden = false;
        this.$('blosum-area').hidden = !q.showBlosum;

        this.$('editor-area').hidden = !q.workspace.editor;
        if (q.workspace.editor) {
            this.editor.setLocal(!!q.local);
            this.editor.setParams(q.params);
            this.editor.init(q.s1, q.s2, q.params.type);
        } else this.editor.clear();

        this.renderAnswerWidget(q);
    }

    onEdit() {
        if (!this.q || !this.q.workspace.editor) return;
        const s = this.studentScore();
        this.$('editor-score').textContent = s === null ? 'Mark the region with [ and ] to score it.' : `Your ${this.q.local ? 'selected region' : 'alignment'} scores ${s} (target ${this.q.answer.target}).`;
        if (this.matrix.mode === 'full') this.matrix.setStudentPath(this.studentPath());
    }

    studentScore() {
        const { a1, a2, sel } = this.editor.get();
        const p = this.q.params;
        if (!this.q.local) return this.E.scoreAlignment(a1, a2, p).total;
        if (!sel) return null;
        return this.E.scoreAlignment(a1.slice(sel.start, sel.end + 1), a2.slice(sel.start, sel.end + 1), Object.assign({}, p, { endGaps: 'penalized' })).total;
    }

    studentPath() {
        const { a1, a2, sel } = this.editor.get();
        if (!this.q.local) return this.E.alignmentToPath(a1, a2);
        if (!sel) return null;
        let i = 0, j = 0;
        for (let k = 0; k < sel.start; k++) { if (a1[k] !== '-') i++; if (a2[k] !== '-') j++; }
        const path = [{ i, j }];
        for (let k = sel.start; k <= sel.end; k++) { if (a1[k] !== '-') i++; if (a2[k] !== '-') j++; if (!(a1[k] === '-' && a2[k] === '-')) path.push({ i, j }); }
        return path;
    }

    // ------------------------------------------------------------ widgets
    renderAnswerWidget(q) {
        const area = this.$('answer-area');
        area.innerHTML = '';
        const a = q.answer;
        if (a.kind === 'fill') {
            area.innerHTML = '<p class="dp-hint">Type the values into the matrix on the right, then press Check.</p>';
        } else if (a.kind === 'align') {
            area.innerHTML = `<p class="dp-hint">Target score: <strong>${a.target}</strong>. Edit the alignment on the right, then press Check.</p>`;
        } else if (a.kind === 'choice') {
            const box = document.createElement('div'); box.className = 'dp-checklist';
            a.options.forEach((label, i) => { const lab = document.createElement('label'); lab.innerHTML = `<input type="radio" name="choice" value="${i}"> <span>${label}</span>`; box.appendChild(lab); });
            area.appendChild(box);
        } else if (a.kind === 'fields') {
            a.fields.forEach(f => {
                const row = document.createElement('div'); row.className = 'dp-field';
                const lab = document.createElement('label'); lab.textContent = f.label; row.appendChild(lab);
                if (f.kind === 'number') {
                    const inp = document.createElement('input'); inp.type = 'number'; inp.step = 'any'; inp.dataset.key = f.key;
                    inp.addEventListener('keydown', e => { if (e.key === 'Enter') this.check(); });
                    row.appendChild(inp);
                } else {
                    const sel = document.createElement('select'); sel.dataset.key = f.key;
                    sel.innerHTML = '<option value="">– choose –</option>' + f.options.map((o, i) => `<option value="${i}">${o}</option>`).join('');
                    row.appendChild(sel);
                }
                const mark = document.createElement('span'); mark.className = 'dp-mark'; row.appendChild(mark);
                area.appendChild(row);
            });
        }
    }

    renderBlosum() {
        const order = this.E.BLOSUM_ORDER.split('');
        let h = '<tr><th></th>' + order.map(a => `<th>${a}</th>`).join('') + '</tr>';
        for (const a of order) h += `<tr><th>${a}</th>` + order.map(b => { const v = this.E.BLOSUM62[a][b]; return `<td class="${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${v}</td>`; }).join('') + '</tr>';
        this.$('blosum-table').innerHTML = h;
    }

    // ------------------------------------------------------------ grading
    bindQuestion() {
        this.$('check-btn').addEventListener('click', () => this.check());
        this.$('hint-btn').addEventListener('click', () => {
            this.hintUsed = true;
            this.$('hint-box').innerHTML = `<strong>Hint:</strong> ${this.q.hint}`;
            this.$('hint-box').className = 'dp-feedback'; this.$('hint-box').hidden = false;
            this.$('hint-btn').disabled = true;
        });
        this.$('next-btn').addEventListener('click', () => this.next());
        this.$('quit-btn').addEventListener('click', () => this.finish());
    }

    grade() {
        const q = this.q, a = q.answer, area = this.$('answer-area');
        if (a.kind === 'fill') {
            const empty = this.matrix.fillValues().filter(v => v.value === '').length;
            if (empty === this.matrix.fillValues().length) return null;
            const r = this.matrix.checkFill();
            const ok = r.correct === r.total;
            return { ok, score: r.correct / r.total, detail: ok ? `All ${r.total} cells correct.` : `${r.correct} of ${r.total} cells correct – wrong cells are marked red; hover them for the right value.` };
        }
        if (a.kind === 'align') {
            const s = this.studentScore();
            if (s === null) return null;
            const ok = s === a.target;
            this.editor.active = false;
            return { ok, score: ok ? 1 : 0, detail: ok ? `Your ${q.local ? 'region' : 'alignment'} scores ${s} – optimal.` : `Your ${q.local ? 'region' : 'alignment'} scores ${s}, the optimum is ${a.target}.`, retry: !ok };
        }
        if (a.kind === 'choice') {
            const sel = area.querySelector('input:checked');
            if (!sel) return null;
            const ok = parseInt(sel.value) === a.correct;
            area.querySelectorAll('input').forEach(el => { el.disabled = true; el.parentElement.classList.toggle('correct', parseInt(el.value) === a.correct); el.parentElement.classList.toggle('wrong', el.checked && parseInt(el.value) !== a.correct); });
            return { ok, score: ok ? 1 : 0, detail: '' };
        }
        if (a.kind === 'fields') {
            let good = 0;
            for (const f of a.fields) {
                const el = area.querySelector(`[data-key="${f.key}"]`);
                if (el.value === '') return null;
                const ok = f.kind === 'number' ? Math.abs(parseFloat(el.value) - f.answer) <= (f.tolerance || 0) : parseInt(el.value) === f.answer;
                if (ok) good++;
                el.disabled = true;
                const mark = el.parentElement.querySelector('.dp-mark');
                mark.textContent = ok ? '✔' : `✘ ${f.kind === 'number' ? f.answer : f.options[f.answer]}`;
                mark.className = 'dp-mark ' + (ok ? 'correct' : 'wrong');
            }
            const ok = good === a.fields.length;
            return { ok, score: good / a.fields.length, detail: ok ? '' : `${good} of ${a.fields.length} answers correct.` };
        }
        return null;
    }

    check() {
        if (this.answered) return;
        const g = this.grade();
        if (g === null) { this.toast('Answer every part of the question first', 'warning'); return; }
        if (g.retry) {
            this.editor.active = true;
            const fb = this.$('feedback-box');
            fb.className = 'dp-feedback wrong';
            fb.innerHTML = `✘ Not yet. ${g.detail} Keep editing and check again, or press Next to give up.`;
            fb.hidden = false;
            this.$('next-btn').hidden = false;
            this.pending = g;
            return;
        }
        this.commit(g);
    }

    commit(g) {
        this.answered = true;
        let score = g.score;
        if (this.hintUsed) score = Math.min(score, 0.5);
        this.log.push({ type: this.q.type, level: this.q.level, skill: this.q.skill, score, ok: g.ok });
        const fb = this.$('feedback-box');
        const head = g.ok ? '✔ Correct.' : score > 0 ? `◐ Partly correct (${Math.round(score * 100)} %).` : '✘ Not correct.';
        fb.className = 'dp-feedback ' + (g.ok ? 'correct' : 'wrong');
        fb.innerHTML = `<strong>${head}</strong> ${g.detail || ''}<div class="dp-explain">${this.q.explanation}</div>` + (this.hintUsed && g.ok ? '<div class="dp-hint">Hint used – half points.</div>' : '');
        fb.hidden = false;
        this.$('check-btn').hidden = true; this.$('hint-btn').disabled = true; this.$('next-btn').hidden = false;
        this.$('next-btn').focus();
        // reveal the optimal path in the matrix
        if (this.matrix.mode === 'fill') { this.matrix.mode = 'full'; this.matrix.render(); }
        this.matrix.setOptions({ showOptimal: true, showArrows: true, showValues: true });
        this.editor.active = false;
        this.updateRunningScore();
    }

    next() {
        if (!this.answered) {
            if (this.pending) { this.commit(Object.assign({}, this.pending, { score: 0, ok: false })); this.pending = null; }
            return;
        }
        this.pending = null;
        this.index++;
        if (this.mode === 'session' && this.index >= this.plan.length) { this.finish(); return; }
        this.showQuestion();
    }

    updateRunningScore() {
        const got = this.log.reduce((s, e) => s + e.score, 0);
        this.$('running-score').textContent = this.log.length ? `Score so far: ${got.toFixed(1)} / ${this.log.length}` : '';
    }

    // ------------------------------------------------------------ summary & history
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
        this.$('summary-score').textContent = `${got.toFixed(1)} / ${this.log.length} points (${Math.round(got / this.log.length * 100)} %)`;
        let rows = '', weakest = null, weakestRatio = 2;
        for (const [skill, v] of Object.entries(perSkill)) {
            const ratio = v.got / v.n;
            const prevRatio = prev && prev.skills[skill] ? prev.skills[skill].got / prev.skills[skill].n : null;
            const trend = prevRatio === null ? '' : ratio > prevRatio + 0.01 ? ' ▲' : ratio < prevRatio - 0.01 ? ' ▼' : ' ▬';
            rows += `<div class="stat-item"><span class="stat-label">${this.G.SKILLS[skill]}</span><span class="stat-value ${ratio >= 0.75 ? 'forward-color' : ratio < 0.5 ? 'reverse-color' : ''}">${v.got.toFixed(1)} / ${v.n}${trend}</span></div>`;
            if (ratio < weakestRatio) { weakestRatio = ratio; weakest = Object.entries(v.types).sort((a, b) => b[1] - a[1])[0][0]; }
        }
        this.weakestType = weakest;
        this.$('summary-skills').innerHTML = `<div class="stats-grid">${rows}</div>`;
        this.$('summary-compare').textContent = prev ? `Previous session on ${new Date(prev.date).toLocaleDateString()}: ${prev.score.toFixed(1)} / ${prev.total} (▲▼ show change per skill).` : 'First recorded session on this browser.';
        this.$('drill-weakest').textContent = weakest ? `Drill: ${this.G.TYPES[weakest].name}` : 'Drill weakest skill';
        const link = location.origin + location.pathname + '#seed=' + encodeURIComponent(this.seed);
        this.$('summary-link').textContent = link; this.$('summary-link').href = link;
        if (this.mode === 'session') {
            history.push({ date: Date.now(), seed: this.seed, score: got, total: this.log.length, skills: Object.fromEntries(Object.entries(perSkill).map(([k, v]) => [k, { got: v.got, n: v.n }])) });
            this.saveHistory(history.slice(-20));
            this.renderHistory();
        }
        this.showScreen('summary');
        this.matrix.set(null); this.editor.clear();
        this.$('editor-area').hidden = true; this.$('blosum-area').hidden = true;
    }

    loadHistory() { try { return JSON.parse(localStorage.getItem('alignQuizHistory') || '[]'); } catch (e) { return []; } }
    saveHistory(h) { try { localStorage.setItem('alignQuizHistory', JSON.stringify(h)); } catch (e) { /* ignore */ } }
    renderHistory() {
        const h = this.loadHistory();
        this.$('history-box').hidden = !h.length;
        if (!h.length) return;
        this.$('history-content').innerHTML = '<div class="stats-grid">' + h.slice(-5).reverse().map(s =>
            `<div class="stat-item"><span class="stat-label">${new Date(s.date).toLocaleString()} · <a href="#seed=${encodeURIComponent(s.seed)}" class="dp-seed-link">${s.seed}</a></span><span class="stat-value">${s.score.toFixed(1)} / ${s.total}</span></div>`).join('') + '</div>';
        this.$('history-content').querySelectorAll('.dp-seed-link').forEach(a => a.addEventListener('click', e => { e.preventDefault(); this.$('seed-input').value = decodeURIComponent(a.getAttribute('href').slice(6)); }));
    }

    tooltip(cell, x, y) {
        const tip = this.$('mv-tooltip');
        if (!cell || !this.result || this.matrix.mode === 'fill') { tip.hidden = true; return; }
        const v = this.result.S[cell.i][cell.j];
        tip.innerHTML = `(${cell.i}, ${cell.j}) = <b>${v <= -1e8 ? '−∞' : v}</b>`;
        const wrap = tip.parentElement.getBoundingClientRect();
        tip.style.left = (x - wrap.left + 14) + 'px'; tip.style.top = (y - wrap.top + 14) + 'px';
        tip.hidden = false;
    }

    toast(message, type = 'info') {
        const el = document.createElement('div');
        el.className = `notification notification-${type} show`; el.textContent = message;
        this.$('toast-stack').appendChild(el);
        setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3000);
    }
}

(function () {
    const start = () => { window.alignQuiz = new AlignQuiz(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
