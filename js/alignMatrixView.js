/**
 * DP MATRIX VIEW
 * ==============
 * Renders the dynamic-programming matrix of a pairwise alignment as an HTML
 * table: seq1 across the top (columns i), seq2 down the side (rows j),
 * including row 0 / column 0. Can show cell values, traceback arrows (all
 * tied predecessors), the optimal path, the student's current alignment as
 * a path, a highlighted local alignment, a step-by-step fill, and a
 * "fill it yourself" mode with inputs.
 */
class AlignMatrixView {
    constructor(container, options = {}) {
        this.container = container;
        this.opts = Object.assign({ onHover: null, onCell: null, onStep: null }, options);
        this.data = null;           // { s1, s2, params, result, local }
        this.showValues = true;
        this.showArrows = true;
        this.showOptimal = true;
        this.studentPath = null;    // array of {i,j}
        this.highlightPath = null;  // array of {i,j}
        this.mode = 'full';         // 'full' | 'step' | 'fill'
        this.step = 0;              // number of inner cells already filled in step mode
        this.container.classList.add('mv');
        this.container.addEventListener('mousemove', e => this.hover(e));
        this.container.addEventListener('mouseleave', () => this.opts.onHover && this.opts.onHover(null));
        this.container.addEventListener('click', e => {
            const td = e.target.closest('td[data-i]');
            if (td && this.opts.onCell) this.opts.onCell(parseInt(td.dataset.i), parseInt(td.dataset.j));
        });
    }

    set(data) {
        this.data = data;
        this.step = 0;
        this.render();
    }

    setStudentPath(path) { this.studentPath = path; this.render(); }
    setHighlightPath(path) { this.highlightPath = path; this.render(); }
    setMode(mode) { this.mode = mode; this.step = 0; this.render(); }
    setOptions(o) { Object.assign(this, o); this.render(); }

    // ------------------------------------------------------------ step mode
    innerCells() { return this.data ? this.data.s1.length * this.data.s2.length : 0; }
    cellAt(k) { const n = this.data.s1.length; return { i: (k % n) + 1, j: Math.floor(k / n) + 1 }; }
    stepForward() { if (this.step < this.innerCells()) { this.step++; this.render(); } }
    stepBack() { if (this.step > 0) { this.step--; this.render(); } }
    stepRow() { const n = this.data.s1.length; this.step = Math.min(this.innerCells(), (Math.floor(this.step / n) + 1) * n); this.render(); }
    stepAll() { this.step = this.innerCells(); this.render(); }
    currentStepCell() { return this.step < this.innerCells() ? this.cellAt(this.step) : null; }

    // ------------------------------------------------------------ fill mode
    checkFill() {
        if (!this.data) return null;
        const S = this.data.result.S;
        let correct = 0, total = 0;
        this.container.querySelectorAll('input.mv-in').forEach(inp => {
            const i = parseInt(inp.dataset.i), j = parseInt(inp.dataset.j);
            total++;
            const ok = inp.value !== '' && parseFloat(inp.value) === S[i][j];
            inp.classList.toggle('ok', ok);
            inp.classList.toggle('bad', !ok);
            inp.disabled = true;
            if (ok) correct++; else inp.title = `correct value: ${S[i][j]}`;
        });
        return { correct, total };
    }

    fillValues() {
        return [...this.container.querySelectorAll('input.mv-in')].map(inp => ({ i: +inp.dataset.i, j: +inp.dataset.j, value: inp.value }));
    }

    // ------------------------------------------------------------ rendering
    arrowsFor(i, j) {
        const r = this.data.result;
        if (!r.dirs) return '';
        const d = r.dirs[i][j];
        let s = '';
        if (d & AlignEngine.DIAG) s += '↖';
        if (d & AlignEngine.LEFT) s += '←';
        if (d & AlignEngine.UP) s += '↑';
        return s;
    }

    render() {
        const c = this.container;
        if (!this.data) { c.innerHTML = '<div class="mv-empty">The dynamic-programming matrix appears here.</div>'; return; }
        const { s1, s2, result, local } = this.data;
        const n = s1.length, m = s2.length;
        const S = result.S;
        const key = p => `${p.i},${p.j}`;
        const optimal = new Set(this.showOptimal && result.path ? result.path.map(key) : []);
        const student = new Set(this.studentPath ? this.studentPath.map(key) : []);
        const hi = new Set(this.highlightPath ? this.highlightPath.map(key) : []);
        const stepCell = this.mode === 'step' ? this.currentStepCell() : null;
        const big = n > 30 || m > 30;
        const showValues = this.showValues && !big;
        const showArrows = this.showArrows && !big && !!result.dirs;

        let h = `<table class="mv-table${big ? ' mv-big' : ''}"><thead><tr><th class="mv-corner"></th><th class="mv-idx"></th>`;
        for (let i = 1; i <= n; i++) h += `<th class="mv-head"><span class="mv-res ${this.resClass(s1[i - 1])}">${s1[i - 1]}</span><small>${i}</small></th>`;
        h += '</tr></thead><tbody>';
        for (let j = 0; j <= m; j++) {
            h += '<tr>';
            h += j === 0 ? '<th class="mv-head"></th>' : `<th class="mv-head"><span class="mv-res ${this.resClass(s2[j - 1])}">${s2[j - 1]}</span><small>${j}</small></th>`;
            for (let i = 0; i <= n; i++) {
                const k = key({ i, j });
                const cls = ['mv-cell'];
                if (i > 0 && j > 0 && s1[i - 1] === s2[j - 1]) cls.push('match');
                if (optimal.has(k)) cls.push('opt');
                if (student.has(k)) cls.push('stu');
                if (hi.has(k)) cls.push('hi');
                if (local && S[i][j] === 0 && i > 0 && j > 0) cls.push('zero');
                if (i === 0 || j === 0) cls.push('border');
                const inner = i > 0 && j > 0;
                const idx = inner ? (j - 1) * n + (i - 1) : -1;
                let content = '';
                if (this.mode === 'fill' && inner) {
                    content = `<input class="mv-in" data-i="${i}" data-j="${j}" type="number" step="any">`;
                } else if (this.mode === 'step' && inner && idx >= this.step) {
                    if (stepCell && stepCell.i === i && stepCell.j === j) { cls.push('current'); content = '<span class="mv-v">?</span>'; }
                    else content = '';
                } else {
                    const arrows = showArrows && inner ? `<span class="mv-arr">${this.arrowsFor(i, j)}</span>` : '';
                    const v = showValues || !inner ? `<span class="mv-v">${S[i][j] <= -1e8 ? '−∞' : S[i][j]}</span>` : '';
                    content = arrows + v;
                }
                h += `<td class="${cls.join(' ')}" data-i="${i}" data-j="${j}">${content}</td>`;
            }
            h += '</tr>';
        }
        h += '</tbody></table>';
        c.innerHTML = h;
        if (this.mode === 'step' && this.opts.onStep) this.opts.onStep(stepCell);
    }

    resClass(ch) {
        if (this.data.params.type === 'PROTEIN') return '';
        return `nt-${ch === 'U' ? 'T' : ch}`;
    }

    hover(e) {
        if (!this.opts.onHover || !this.data) return;
        const td = e.target.closest('td[data-i]');
        if (!td) { this.opts.onHover(null); return; }
        this.opts.onHover({ i: parseInt(td.dataset.i), j: parseInt(td.dataset.j) }, e.clientX, e.clientY);
    }
}
