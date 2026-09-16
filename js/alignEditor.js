/**
 * ALIGNMENT EDITOR
 * ================
 * Keyboard + mouse editor for a pairwise alignment. Only gaps can be
 * inserted or removed, so the residues are never changed.
 *
 * Keys: ← → move, ↑ ↓ / Tab switch sequence, Space or - insert gap,
 * Delete / Backspace remove a gap, [ and ] set the start / end of the
 * selected region (local mode), Home / End jump.
 */
class AlignEditor {
    constructor(container, options = {}) {
        this.container = container;
        this.opts = Object.assign({ onChange: null, local: false, params: null }, options);
        this.seq1 = ''; this.seq2 = ''; this.type = 'DNA';
        this.a1 = ''; this.a2 = '';
        this.cursor = 0; this.row = 1;
        this.sel = null;          // {start, end} column range (inclusive) in local mode
        this.active = false;
        this.columns = [];

        this.container.tabIndex = 0;
        this.container.classList.add('ae');
        this.container.innerHTML = `
            <div class="ae-rows">
                <div class="ae-row" data-row="1"><span class="ae-label">Seq 1</span><span class="ae-seq" id="${container.id}-s1"></span></div>
                <div class="ae-row"><span class="ae-label"></span><span class="ae-seq ae-match" id="${container.id}-m"></span></div>
                <div class="ae-row" data-row="2"><span class="ae-label">Seq 2</span><span class="ae-seq" id="${container.id}-s2"></span></div>
                <div class="ae-row"><span class="ae-label ae-small">score</span><span class="ae-seq ae-scores" id="${container.id}-sc"></span></div>
            </div>
            <div class="ae-empty">Load an example or enter two sequences to start editing.</div>`;
        this.el = {
            s1: container.querySelector(`#${container.id}-s1`),
            m: container.querySelector(`#${container.id}-m`),
            s2: container.querySelector(`#${container.id}-s2`),
            sc: container.querySelector(`#${container.id}-sc`),
            rows: container.querySelector('.ae-rows'),
            empty: container.querySelector('.ae-empty')
        };
        container.addEventListener('keydown', e => this.onKey(e));
        container.addEventListener('mousedown', e => this.onClick(e));
    }

    // ------------------------------------------------------------ state
    init(seq1, seq2, type) {
        this.seq1 = seq1; this.seq2 = seq2; this.type = type;
        this.a1 = seq1; this.a2 = seq2;
        this.cursor = 0; this.row = 1; this.sel = null;
        this.active = true;
        this.normalize();
        this.render();
        this.emit();
    }

    setAlignment(a1, a2) {
        this.a1 = a1; this.a2 = a2;
        this.cursor = Math.min(this.cursor, a1.length);
        this.normalize();
        this.render();
        this.emit();
    }

    setParams(params) { this.opts.params = params; this.render(); }
    setLocal(local) { this.opts.local = local; if (!local) this.sel = null; this.render(); }
    setSelection(start, end) { this.sel = { start, end }; this.render(); this.emit(); }

    get() { return { a1: this.a1, a2: this.a2, sel: this.sel }; }

    reset() {
        this.a1 = this.seq1; this.a2 = this.seq2; this.cursor = 0; this.sel = null;
        this.normalize(); this.render(); this.emit();
    }

    clear() {
        this.active = false; this.a1 = this.a2 = ''; this.render();
    }

    // pad the shorter sequence with trailing gaps, drop gap-only columns at both ends
    normalize() {
        while (this.a1.length < this.a2.length) this.a1 += '-';
        while (this.a2.length < this.a1.length) this.a2 += '-';
        let lead = 0;
        while (lead < this.a1.length && this.a1[lead] === '-' && this.a2[lead] === '-') lead++;
        let end = this.a1.length;
        while (end > lead && this.a1[end - 1] === '-' && this.a2[end - 1] === '-') end--;
        if (lead > 0 || end < this.a1.length) {
            this.a1 = this.a1.slice(lead, end); this.a2 = this.a2.slice(lead, end);
            this.cursor = Math.max(0, Math.min(this.cursor - lead, this.a1.length));
            if (this.sel) this.sel = { start: Math.max(0, this.sel.start - lead), end: Math.min(this.a1.length - 1, this.sel.end - lead) };
        }
    }

    removeGapOnlyColumns() {
        let a1 = '', a2 = '', removed = 0;
        for (let k = 0; k < this.a1.length; k++) {
            if (this.a1[k] === '-' && this.a2[k] === '-') { removed++; continue; }
            a1 += this.a1[k]; a2 += this.a2[k];
        }
        this.a1 = a1; this.a2 = a2;
        this.cursor = Math.min(this.cursor, a1.length);
        this.normalize(); this.render(); this.emit();
        return removed;
    }

    emit() { if (this.opts.onChange) this.opts.onChange(this.get()); }

    // ------------------------------------------------------------ editing
    insertGap() {
        const key = this.row === 1 ? 'a1' : 'a2';
        const s = this[key];
        this[key] = s.slice(0, this.cursor) + '-' + s.slice(this.cursor);
        this.cursor++;
        if (this.sel && this.sel.end >= this.cursor - 1) this.sel.end++;
        this.normalize(); this.render(); this.emit();
    }

    removeGap(backspace) {
        const key = this.row === 1 ? 'a1' : 'a2';
        const s = this[key];
        const pos = backspace ? this.cursor - 1 : this.cursor;
        if (pos < 0 || pos >= s.length || s[pos] !== '-') return;
        this[key] = s.slice(0, pos) + s.slice(pos + 1);
        if (backspace) this.cursor--;
        if (this.sel && this.sel.end > pos) this.sel.end = Math.max(this.sel.start, this.sel.end - 1);
        this.normalize(); this.render(); this.emit();
    }

    onKey(e) {
        if (!this.active) return;
        const len = this.a1.length;
        switch (e.key) {
            case 'ArrowLeft': this.cursor = Math.max(0, this.cursor - 1); break;
            case 'ArrowRight': this.cursor = Math.min(len, this.cursor + 1); break;
            case 'Home': this.cursor = 0; break;
            case 'End': this.cursor = len; break;
            case 'ArrowUp': this.row = 1; break;
            case 'ArrowDown': this.row = 2; break;
            case 'Tab': this.row = this.row === 1 ? 2 : 1; break;
            case ' ': case '-': this.insertGap(); break;
            case 'Delete': this.removeGap(false); break;
            case 'Backspace': this.removeGap(true); break;
            case '[': if (this.opts.local) this.setSelection(Math.min(this.cursor, len - 1), Math.max(this.sel ? this.sel.end : len - 1, Math.min(this.cursor, len - 1))); break;
            case ']': if (this.opts.local) this.setSelection(Math.min(this.sel ? this.sel.start : 0, Math.max(0, this.cursor - 1)), Math.max(0, this.cursor - 1)); break;
            default: return;   // let the browser handle everything else (F5, Ctrl+…)
        }
        e.preventDefault();
        this.render();
    }

    onClick(e) {
        if (!this.active) return;
        const span = e.target.closest('.ae-char');
        if (!span) return;
        const row = span.closest('.ae-row');
        if (row && row.dataset.row) this.row = parseInt(row.dataset.row);
        const k = parseInt(span.dataset.k);
        // click on the left half → cursor before the character, right half → after
        const r = span.getBoundingClientRect();
        this.cursor = e.clientX - r.left < r.width / 2 ? k : k + 1;
        if (this.opts.local && e.shiftKey) {
            const col = Math.min(k, this.a1.length - 1);
            if (!this.sel) this.sel = { start: col, end: col };
            else if (col < this.sel.start) this.sel.start = col;
            else this.sel.end = col;
            this.emit();
        }
        this.container.focus();
        this.render();
        e.preventDefault();
    }

    // ------------------------------------------------------------ rendering
    charClass(c) {
        if (c === '-') return 'gap';
        if (this.type === 'PROTEIN') {
            if ('AVLIMFWP'.includes(c)) return 'aa-hydrophobic';
            if ('KRH'.includes(c)) return 'aa-positive';
            if ('DE'.includes(c)) return 'aa-negative';
            if ('STNQ'.includes(c)) return 'aa-polar';
            if (c === 'C') return 'aa-cysteine';
            if (c === 'G') return 'aa-glycine';
            if ('Y'.includes(c)) return 'aa-aromatic';
            return '';
        }
        return `nt-${c === 'U' ? 'T' : c}`;
    }

    render() {
        this.el.empty.hidden = this.active;
        this.el.rows.hidden = !this.active;
        if (!this.active) return;
        const params = this.opts.params;
        const scored = params ? AlignEngine.scoreAlignment(this.a1, this.a2, params) : null;
        this.columns = scored ? scored.columns : [];
        const inSel = k => this.sel && k >= this.sel.start && k <= this.sel.end;
        const build = (s, row) => {
            let h = '';
            for (let k = 0; k < s.length; k++) {
                const cls = ['ae-char', this.charClass(s[k])];
                if (this.row === row && this.cursor === k) cls.push('cursor');
                if (inSel(k)) cls.push('sel');
                if (this.opts.local && this.sel && !inSel(k)) cls.push('dim');
                h += `<span class="${cls.join(' ')}" data-k="${k}">${s[k]}</span>`;
            }
            // caret after the last character
            const endCls = 'ae-char ae-end' + (this.row === row && this.cursor === s.length ? ' cursor' : '');
            h += `<span class="${endCls}" data-k="${s.length}">&nbsp;</span>`;
            return h;
        };
        this.el.s1.innerHTML = build(this.a1, 1);
        this.el.s2.innerHTML = build(this.a2, 2);
        let m = '', sc = '';
        for (let k = 0; k < this.a1.length; k++) {
            const col = this.columns[k];
            const c1 = this.a1[k], c2 = this.a2[k];
            let sym = ' ', cls = '';
            if (c1 !== '-' && c2 !== '-') {
                if (c1 === c2) { sym = '|'; cls = 'ok'; }
                else if (col && col.score > 0) { sym = ':'; cls = 'similar'; }
                else { sym = '·'; cls = 'bad'; }
            }
            m += `<span class="ae-char ${cls}${inSel(k) ? ' sel' : ''}">${sym}</span>`;
            if (col) {
                const v = col.score;
                sc += `<span class="ae-char ${v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero'}${inSel(k) ? ' sel' : ''}" title="${col.type}${col.terminal ? ' (terminal)' : ''}">${v > 0 ? '+' + v : v}</span>`;
            }
        }
        this.el.m.innerHTML = m + '<span class="ae-char ae-end">&nbsp;</span>';
        this.el.sc.innerHTML = sc + '<span class="ae-char ae-end">&nbsp;</span>';
    }
}
