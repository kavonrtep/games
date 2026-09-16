/**
 * MSA EDITOR
 * ==========
 * Multi-row gap editor. One horizontally scrolling grid holds, top to
 * bottom: a ruler, an optional logo row (SVG), an optional consensus row and
 * the sequence rows, so logo, consensus and residues stay column-aligned.
 *
 * Keys: ← → ↑ ↓ move, Home/End, Space or - insert a gap in the active row,
 * Shift+Space insert a gap column in all rows, Delete/Backspace remove a
 * gap, Shift+Delete remove a gap-only column. Click a residue to move the
 * cursor and select its column.
 */
class MsaEditor {
    constructor(container, options = {}) {
        this.container = container;
        this.opts = Object.assign({ onChange: null, onColumn: null, cellWidth: 20, logoHeight: 90 }, options);
        this.names = []; this.rows = []; this.type = 'PROTEIN';
        this.cursor = { row: 0, col: 0 };
        this.selectedCol = null;
        this.readOnly = false;
        this.logoSvg = '';
        this.consensus = '';
        this.shading = null;          // per-column 0..1 conservation for background shading
        this.container.classList.add('me');
        this.container.tabIndex = 0;
        this.container.innerHTML = `<div class="me-scroll"><div class="me-grid"></div></div><div class="me-empty">Paste sequences or load an example.</div>`;
        this.scroll = this.container.querySelector('.me-scroll');
        this.grid = this.container.querySelector('.me-grid');
        this.empty = this.container.querySelector('.me-empty');
        this.container.addEventListener('keydown', e => this.onKey(e));
        this.grid.addEventListener('mousedown', e => this.onClick(e));
    }

    // ------------------------------------------------------------ state
    init(names, rows, type) {
        this.names = names.slice(); this.rows = rows.slice(); this.type = type;
        this.cursor = { row: 0, col: 0 }; this.selectedCol = null;
        this.normalize(); this.render(); this.emit();
    }
    setRows(rows, silent) { this.rows = rows.slice(); this.normalize(); this.render(); if (!silent) this.emit(); }
    get() { return this.rows.slice(); }
    setLogo(svg) { this.logoSvg = svg || ''; this.render(); }
    setConsensus(s) { this.consensus = s || ''; this.render(); }
    setShading(values) { this.shading = values; this.render(); }
    setReadOnly(ro) { this.readOnly = ro; this.container.classList.toggle('readonly', ro); }
    length() { return this.rows.length ? this.rows[0].length : 0; }

    normalize() {
        const L = Math.max(0, ...this.rows.map(r => r.length));
        this.rows = this.rows.map(r => r.padEnd(L, '-'));
        this.cursor.col = Math.min(this.cursor.col, L);
        this.cursor.row = Math.min(this.cursor.row, Math.max(0, this.rows.length - 1));
    }

    removeGapOnlyColumns() {
        const L = this.length(); const keep = [];
        for (let k = 0; k < L; k++) if (this.rows.some(r => r[k] !== '-')) keep.push(k);
        const removed = L - keep.length;
        if (removed) { this.rows = this.rows.map(r => keep.map(k => r[k]).join('')); this.cursor.col = Math.min(this.cursor.col, keep.length); this.selectedCol = null; this.render(); this.emit(); }
        return removed;
    }

    emit() { if (this.opts.onChange) this.opts.onChange(this.get()); }

    // ------------------------------------------------------------ editing
    insertGap(allRows) {
        const c = this.cursor.col;
        this.rows = this.rows.map((r, i) => (allRows || i === this.cursor.row) ? r.slice(0, c) + '-' + r.slice(c) : r);
        this.cursor.col++;
        this.normalize(); this.render(); this.emit();
    }

    removeGap(backspace, allRows) {
        const c = backspace ? this.cursor.col - 1 : this.cursor.col;
        if (c < 0 || c >= this.length()) return;
        if (allRows) {
            if (!this.rows.every(r => r[c] === '-')) return;
            this.rows = this.rows.map(r => r.slice(0, c) + r.slice(c + 1));
        } else {
            const r = this.rows[this.cursor.row];
            if (r[c] !== '-') return;
            this.rows[this.cursor.row] = r.slice(0, c) + r.slice(c + 1);
        }
        if (backspace) this.cursor.col--;
        this.normalize(); this.render(); this.emit();
    }

    onKey(e) {
        if (!this.rows.length) return;
        const L = this.length();
        switch (e.key) {
            case 'ArrowLeft': this.cursor.col = Math.max(0, this.cursor.col - 1); break;
            case 'ArrowRight': this.cursor.col = Math.min(L, this.cursor.col + 1); break;
            case 'ArrowUp': this.cursor.row = Math.max(0, this.cursor.row - 1); break;
            case 'ArrowDown': this.cursor.row = Math.min(this.rows.length - 1, this.cursor.row + 1); break;
            case 'Home': this.cursor.col = 0; break;
            case 'End': this.cursor.col = L; break;
            case ' ': case '-': if (this.readOnly) return; this.insertGap(e.shiftKey); e.preventDefault(); return;
            case 'Delete': if (this.readOnly) return; this.removeGap(false, e.shiftKey); e.preventDefault(); return;
            case 'Backspace': if (this.readOnly) return; this.removeGap(true, e.shiftKey); e.preventDefault(); return;
            default: return;
        }
        e.preventDefault();
        this.selectColumn(Math.min(this.cursor.col, L - 1));
        this.render();
        this.scrollCursorIntoView();
    }

    onClick(e) {
        const cell = e.target.closest('.me-cell');
        if (!cell) return;
        const col = parseInt(cell.dataset.col);
        const rowEl = cell.closest('.me-row');
        if (rowEl && rowEl.dataset.row !== undefined) {
            this.cursor.row = parseInt(rowEl.dataset.row);
            const r = cell.getBoundingClientRect();
            this.cursor.col = e.clientX - r.left < r.width / 2 ? col : col + 1;
        }
        this.selectColumn(col);
        this.container.focus();
        this.render();
        e.preventDefault();
    }

    selectColumn(col) {
        if (col < 0 || col >= this.length()) return;
        this.selectedCol = col;
        if (this.opts.onColumn) this.opts.onColumn(col);
    }

    scrollCursorIntoView() {
        const x = this.cursor.col * this.opts.cellWidth;
        const left = this.scroll.scrollLeft, w = this.scroll.clientWidth - 140;
        if (x < left) this.scroll.scrollLeft = Math.max(0, x - 60);
        else if (x > left + w) this.scroll.scrollLeft = x - w + 60;
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
            if (c === 'Y') return 'aa-aromatic';
            return '';
        }
        return `nt-${c === 'U' ? 'T' : c}`;
    }

    render() {
        const has = this.rows.length > 0;
        this.empty.hidden = has; this.scroll.hidden = !has;
        if (!has) return;
        const L = this.length(), cw = this.opts.cellWidth;
        const sel = this.selectedCol;
        let h = '';
        // ruler
        h += `<div class="me-row me-ruler"><div class="me-name"></div><div class="me-cells" style="width:${L * cw}px">`;
        for (let k = 0; k < L; k++) h += `<span class="me-cell me-tick${sel === k ? ' selcol' : ''}" data-col="${k}">${(k + 1) % 10 === 0 || k === 0 ? k + 1 : ((k + 1) % 5 === 0 ? '·' : '')}</span>`;
        h += '</div></div>';
        // logo
        if (this.logoSvg) h += `<div class="me-row me-logo"><div class="me-name me-logo-axis"><span>bits</span></div><div class="me-cells" style="width:${L * cw}px;height:${this.opts.logoHeight}px">${this.logoSvg}</div></div>`;
        // consensus
        if (this.consensus) {
            h += `<div class="me-row me-consensus"><div class="me-name">consensus</div><div class="me-cells" style="width:${L * cw}px">`;
            for (let k = 0; k < L; k++) { const c = this.consensus[k] || ' '; h += `<span class="me-cell ${this.charClass(c.toUpperCase())}${sel === k ? ' selcol' : ''}" data-col="${k}">${c}</span>`; }
            h += '</div></div>';
        }
        // sequences
        this.rows.forEach((r, i) => {
            const active = i === this.cursor.row;
            h += `<div class="me-row me-seq${active ? ' active' : ''}" data-row="${i}"><div class="me-name" title="${this.names[i]}">${this.names[i]}</div><div class="me-cells" style="width:${L * cw}px">`;
            for (let k = 0; k < L; k++) {
                const c = r[k];
                const cls = ['me-cell', this.charClass(c)];
                if (active && this.cursor.col === k) cls.push('cursor');
                if (sel === k) cls.push('selcol');
                const shade = this.shading && c !== '-' ? ` style="background:rgba(59,130,246,${(this.shading[k] * 0.35).toFixed(2)})"` : '';
                h += `<span class="${cls.join(' ')}" data-col="${k}"${shade}>${c}</span>`;
            }
            const endCls = 'me-cell me-end' + (active && this.cursor.col === L ? ' cursor' : '');
            h += `<span class="${endCls}" data-col="${L}">&nbsp;</span></div></div>`;
        });
        this.grid.innerHTML = h;
    }
}
