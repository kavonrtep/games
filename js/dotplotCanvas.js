/**
 * DOTPLOT CANVAS
 * ==============
 * Renders a DotplotEngine result on a <canvas>, plus an optional "ribbon"
 * panel underneath that connects alignment blocks between the two sequences
 * (genome-browser style). Handles mouse hover/click and keyboard navigation.
 *
 * Layout: seq1 runs left→right on the x axis (letters/ticks on top),
 * seq2 runs top→bottom on the y axis (letters/ticks on the left). The right
 * axis shows the COMPLEMENT of seq2 in the same order, so that a red
 * anti-diagonal can be read directly: go along it bottom→top on the right
 * axis and you read the reverse complement.
 */
class DotplotCanvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.result = null;
        this.blocks = [];
        this.showBlocks = false;
        this.highlightedBlock = null;   // block index or null
        this.cursor = null;             // {i, j} selected cell
        this.overlays = [];             // answer annotations: {s1:[a,b], s2:[c,d], color?, label?} (1-based)
        this.showLetters = { seq1: true, seq2: true };   // quiz can hide the bases on the axes

        this.margin = { top: 44, right: 40, bottom: 36, left: 44 };   // updated in resize()
        this.ribbonHeight = 130;
        this.maxPlotHeight = 640;
        this.letterLimit = 60;          // show bases on axes up to this length

        this.onSelect = null;           // (i, j) => void
        this.onHover = null;            // (i, j | null, clientX, clientY) => void

        this.canvas.tabIndex = 0;
        this.canvas.addEventListener('click', e => this.handleClick(e));
        this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.onHover && this.onHover(null));
        // Keyboard handling is bound to the canvas only, so typing in the
        // sequence boxes is never intercepted.
        this.canvas.addEventListener('keydown', e => this.handleKey(e));
        window.addEventListener('resize', () => this.scheduleRedraw());

        this.resize();
        this.draw();
    }

    // ------------------------------------------------------------ data
    setResult(result) {
        this.result = result;
        this.cursor = null;
        this.highlightedBlock = null;
        this.overlays = [];
        this.resize();
        this.draw();
    }

    setBlocks(blocks, show) {
        this.blocks = blocks || [];
        this.showBlocks = !!show;
        this.highlightedBlock = null;
        this.resize();
        this.draw();
    }

    setOverlays(list) {
        this.overlays = list || [];
        this.draw();
    }

    setLetterVisibility(seq1, seq2) {
        this.showLetters = { seq1: !!seq1, seq2: !!seq2 };
        this.resize();
        this.draw();
    }

    highlightBlock(index) {
        this.highlightedBlock = (index === null || index === undefined) ? null : index;
        this.draw();
    }

    setCursor(i, j) {
        this.cursor = { i, j };
        this.draw();
        if (this.onSelect) this.onSelect(i, j);
    }

    clear() {
        this.result = null;
        this.blocks = [];
        this.showBlocks = false;
        this.cursor = null;
        this.overlays = [];
        this.resize();
        this.draw();
    }

    // ------------------------------------------------------------ geometry
    scheduleRedraw() {
        clearTimeout(this._redrawTimer);
        this._redrawTimer = setTimeout(() => { this.resize(); this.draw(); }, 120);
    }

    // true when the sequences are short enough for base letters on the axes
    lettersVisible() {
        return !!(this.result && this.result.n <= this.letterLimit && this.result.m <= this.letterLimit
                  && (this.showLetters.seq1 || this.showLetters.seq2));
    }

    resize() {
        const container = this.canvas.parentElement;
        const available = Math.max(320, container.clientWidth - 4);
        // more room when base letters are printed between the ticks and the plot
        const letters = this.lettersVisible();
        this.margin = letters
            ? { top: 62, right: 60, bottom: 36, left: 62 }
            : { top: 44, right: 40, bottom: 36, left: 44 };
        const m = this.margin;
        let plotW, plotH;

        if (!this.result || !this.result.n || !this.result.m) {
            plotW = plotH = Math.min(available - m.left - m.right, 420);
        } else {
            const { n, m: len2 } = this.result;
            const maxW = available - m.left - m.right;
            const maxH = this.maxPlotHeight;
            // square cells: plotW / n == plotH / m
            const cell = Math.min(maxW / n, maxH / len2);
            plotW = cell * n;
            plotH = cell * len2;
        }

        const ribbon = (this.showBlocks && this.result) ? this.ribbonHeight : 0;
        const width = Math.round(plotW + m.left + m.right);
        const height = Math.round(plotH + m.top + m.bottom + ribbon);
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this.width = width;
        this.height = height;
        this.plot = { x: m.left, y: m.top, w: plotW, h: plotH };
    }

    cellSize() {
        return { cw: this.plot.w / this.result.n, ch: this.plot.h / this.result.m };
    }

    // Convert canvas pixel to cell, or null when outside the plot.
    cellAt(px, py) {
        if (!this.result || !this.result.n) return null;
        const { x, y, w, h } = this.plot;
        if (px < x || px >= x + w || py < y || py >= y + h) return null;
        const { cw, ch } = this.cellSize();
        return { i: Math.floor((px - x) / cw), j: Math.floor((py - y) / ch) };
    }

    eventToCanvas(e) {
        const rect = this.canvas.getBoundingClientRect();
        return { px: (e.clientX - rect.left) * (this.width / rect.width),
                 py: (e.clientY - rect.top) * (this.height / rect.height) };
    }

    // ------------------------------------------------------------ drawing
    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        if (!this.result || !this.result.n || !this.result.m) {
            this.drawEmpty();
            return;
        }
        this.drawGrid();
        this.drawCursorCross();
        this.drawAxes();
        this.drawSegments(this.result.forward.segments, false);
        this.drawSegments(this.result.reverse.segments, true);
        this.drawHighlightedBlock();
        this.drawOverlays();
        if (this.showBlocks) this.drawRibbons();
    }

    // Boxes drawn over the plot after a quiz answer, in 1-based original coordinates.
    drawOverlays() {
        if (!this.overlays.length) return;
        const ctx = this.ctx;
        const { x, y } = this.plot;
        const { cw, ch } = this.cellSize();
        ctx.font = 'bold 11px sans-serif';
        ctx.textBaseline = 'alphabetic';
        for (const o of this.overlays) {
            const color = o.color || '#2563eb';
            const bx = x + (o.s1[0] - 1) * cw, by = y + (o.s2[0] - 1) * ch;
            const bw = (o.s1[1] - o.s1[0] + 1) * cw, bh = (o.s2[1] - o.s2[0] + 1) * ch;
            ctx.fillStyle = color + '22';
            ctx.fillRect(bx, by, bw, bh);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 3]);
            ctx.strokeRect(bx, by, bw, bh);
            ctx.setLineDash([]);
            if (o.label) {
                ctx.fillStyle = color;
                ctx.textAlign = 'left';
                ctx.fillText(o.label, bx + 3, Math.max(y + 11, by - 3));
            }
        }
    }

    drawEmpty() {
        const ctx = this.ctx;
        ctx.fillStyle = '#a0aec0';
        ctx.textAlign = 'center';
        ctx.font = '16px sans-serif';
        ctx.fillText(this.emptyText || 'Enter two DNA sequences or load an example', this.width / 2, this.height / 2 - 8);
        ctx.font = '13px sans-serif';
        ctx.fillText('green = same strand, red = reverse complement', this.width / 2, this.height / 2 + 14);
        ctx.textAlign = 'left';
    }

    tickInterval(len) {
        if (len <= 30) return 5;
        if (len <= 100) return 10;
        if (len <= 300) return 25;
        return 50;
    }

    drawAxes() {
        const ctx = this.ctx;
        const { seq1, seq2, n, m } = this.result;
        const { x, y, w, h } = this.plot;
        const { cw, ch } = this.cellSize();
        const letters = this.lettersVisible();

        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = '#2d3748';
        ctx.textBaseline = 'middle';
        if (letters) {
            const fontPx = Math.max(8, Math.min(13, Math.floor(Math.min(cw, ch) * 0.9)));
            ctx.font = `${fontPx}px monospace`;
            if (this.showLetters.seq1) {
                ctx.textAlign = 'center';
                for (let i = 0; i < n; i++) ctx.fillText(seq1[i], x + (i + 0.5) * cw, y - 9);
            }
            if (this.showLetters.seq2) {
                ctx.textAlign = 'right';
                for (let j = 0; j < m; j++) ctx.fillText(seq2[j], x - 6, y + (j + 0.5) * ch);
                // complement of seq2 on the right, same order
                ctx.fillStyle = '#dc2626';
                ctx.textAlign = 'left';
                const comp = DotplotEngine.complement(seq2);
                for (let j = 0; j < m; j++) ctx.fillText(comp[j], x + w + 6, y + (j + 0.5) * ch);
            }
        }

        // numeric ticks (always) – drawn just outside the letters
        ctx.fillStyle = '#4a5568';
        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = 1;
        ctx.font = '10px sans-serif';
        // tick marks sit just outside the letters (if any); labels outside the ticks
        const tickBase = letters ? 20 : 2;
        const t1 = this.tickInterval(n), t2 = this.tickInterval(m);
        ctx.textAlign = 'center';
        for (let p = t1; p <= n; p += t1) {
            const px = x + (p - 0.5) * cw;
            ctx.beginPath(); ctx.moveTo(px, y - tickBase); ctx.lineTo(px, y - tickBase - 5); ctx.stroke();
            ctx.fillText(p, px, y - tickBase - 11);
        }
        ctx.textAlign = 'right';
        for (let p = t2; p <= m; p += t2) {
            const py = y + (p - 0.5) * ch;
            ctx.beginPath(); ctx.moveTo(x - tickBase, py); ctx.lineTo(x - tickBase - 5, py); ctx.stroke();
            ctx.fillText(p, x - tickBase - 7, py);
        }

        // axis titles
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#2d3748';
        ctx.textAlign = 'center';
        ctx.fillText(`Sequence 1 (${n} bp) →`, x + w / 2, y - tickBase - 28);
        ctx.save();
        ctx.translate(x - tickBase - 32, y + h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`← Sequence 2 (${m} bp)`, 0, 0);
        ctx.restore();
        ctx.save();
        ctx.translate(x + w + (letters ? 40 : 16), y + h / 2);
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = '#dc2626';
        ctx.fillText(letters && this.showLetters.seq2 ? 'complement of Seq 2 (read ↑ for reverse complement)' : 'reverse-complement strand', 0, 0);
        ctx.restore();

        // parameter caption
        const p = this.result.params;
        const caption = p.mode === 'window'
            ? `window ${p.window}, threshold ${p.threshold} (dot when ≥ ${p.threshold} of ${p.window} bases match)`
            : `minimum diagonal length ${p.minRun}`;
        ctx.fillStyle = '#718096';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(caption, x, y + h + 16);
        ctx.textBaseline = 'alphabetic';
    }

    drawGrid() {
        const { n, m } = this.result;
        if (n > this.letterLimit || m > this.letterLimit) return;
        const ctx = this.ctx;
        const { x, y, w, h } = this.plot;
        const { cw, ch } = this.cellSize();
        ctx.strokeStyle = '#edf2f7';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let i = 1; i < n; i++) { ctx.moveTo(x + i * cw, y); ctx.lineTo(x + i * cw, y + h); }
        for (let j = 1; j < m; j++) { ctx.moveTo(x, y + j * ch); ctx.lineTo(x + w, y + j * ch); }
        ctx.stroke();
    }

    drawCursorCross() {
        if (!this.cursor) return;
        const ctx = this.ctx;
        const { x, y, w, h } = this.plot;
        const { cw, ch } = this.cellSize();
        ctx.fillStyle = 'rgba(160,160,160,0.35)';
        ctx.fillRect(x, y + this.cursor.j * ch, w, ch);
        ctx.fillRect(x + this.cursor.i * cw, y, cw, h);
    }

    // Pixel centre of a cell given comparison coordinates (i, j) and strand.
    centre(i, j, reverse) {
        const { x, y } = this.plot;
        const { cw, ch } = this.cellSize();
        const jj = reverse ? this.result.m - 1 - j : j;
        return { px: x + (i + 0.5) * cw, py: y + (jj + 0.5) * ch };
    }

    drawSegments(segments, reverse) {
        const ctx = this.ctx;
        const color = reverse ? '#dc2626' : '#22c55e';
        const { cw, ch } = this.cellSize();
        const cell = Math.min(cw, ch);
        const drawDots = cell >= 4;
        const lineWidth = Math.max(1.5, Math.min(3, cell * 0.3));
        const r = cell * 0.22;

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (const seg of segments) {
            const a = this.centre(seg.i, seg.j, reverse);
            const b = this.centre(seg.i + seg.len - 1, seg.j + seg.len - 1, reverse);
            ctx.moveTo(a.px, a.py);
            ctx.lineTo(b.px, b.py);
        }
        ctx.stroke();

        const { seq1 } = this.result;
        const cmp = reverse ? this.result.seq2rc : this.result.seq2;
        // Tolerated mismatches (window mode) are always marked as hollow dots,
        // with a minimum radius so they stay visible on long sequences;
        // filled dots for matches only when the cells are big enough.
        const rHollow = Math.max(2.5, r);
        ctx.lineWidth = 1.2;
        for (const seg of segments) {
            if (!drawDots && seg.mismatches === 0) continue;
            for (let k = 0; k < seg.len; k++) {
                const i = seg.i + k, j = seg.j + k;
                const isMatch = seq1[i] === cmp[j];
                if (isMatch && !drawDots) continue;
                const c = this.centre(i, j, reverse);
                ctx.beginPath();
                if (isMatch) {
                    ctx.arc(c.px, c.py, r, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();
                } else {
                    ctx.arc(c.px, c.py, rHollow, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffffff';
                    ctx.fill();
                    ctx.stroke();
                }
            }
        }
    }

    drawHighlightedBlock() {
        if (this.highlightedBlock === null) return;
        const block = this.blocks[this.highlightedBlock];
        if (!block) return;
        const ctx = this.ctx;
        const seg = block.seg;
        const a = this.centre(seg.i, seg.j, block.reverse);
        const b = this.centre(seg.i + seg.len - 1, seg.j + seg.len - 1, block.reverse);
        const { cw, ch } = this.cellSize();
        ctx.strokeStyle = 'rgba(37,99,235,0.45)';
        ctx.lineWidth = Math.max(8, Math.min(cw, ch) * 1.2);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.px, a.py);
        ctx.lineTo(b.px, b.py);
        ctx.stroke();
    }

    // Ribbon panel: seq1 bar on top, seq2 bar below, one polygon per block.
    drawRibbons() {
        const ctx = this.ctx;
        const { n, m } = this.result;
        const { x, w } = this.plot;
        const top = this.plot.y + this.plot.h + this.margin.bottom;
        const y1 = top + 22, y2 = top + this.ribbonHeight - 22;
        const bar = 7;
        const s1 = w / n, s2 = w / m;

        ctx.fillStyle = '#2d3748';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`Sequence 1 (${n} bp)`, x, y1 - 8);
        ctx.fillText(`Sequence 2 (${m} bp)`, x, y2 + 17);

        ctx.fillStyle = '#4a5568';
        ctx.fillRect(x, y1 - bar / 2, w, bar);
        ctx.fillRect(x, y2 - bar / 2, w, bar);

        const blocks = this.blocks.slice().sort((a, b) => b.len - a.len);
        blocks.forEach(block => {
            const color = block.reverse ? '220,38,38' : '34,197,94';
            const hi = this.highlightedBlock === block.index;
            ctx.fillStyle = `rgba(${color},${hi ? 0.7 : 0.3})`;
            ctx.strokeStyle = hi ? '#2563eb' : `rgb(${color})`;
            ctx.lineWidth = hi ? 2 : 0.8;
            const a0 = x + (block.s1Start - 1) * s1, a1 = x + block.s1End * s1;
            const b0 = x + (block.s2Start - 1) * s2, b1 = x + block.s2End * s2;
            ctx.beginPath();
            ctx.moveTo(a0, y1 + bar / 2);
            ctx.lineTo(a1, y1 + bar / 2);
            if (block.reverse) { ctx.lineTo(b0, y2 - bar / 2); ctx.lineTo(b1, y2 - bar / 2); }
            else { ctx.lineTo(b1, y2 - bar / 2); ctx.lineTo(b0, y2 - bar / 2); }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        });

        if (!blocks.length) {
            ctx.fillStyle = '#a0aec0';
            ctx.textAlign = 'center';
            ctx.fillText('no alignment blocks at the current minimum block length', x + w / 2, (y1 + y2) / 2);
        }
    }

    // ------------------------------------------------------------ interaction
    handleClick(e) {
        const { px, py } = this.eventToCanvas(e);
        const cell = this.cellAt(px, py);
        if (cell) {
            this.canvas.focus();
            this.setCursor(cell.i, cell.j);
        }
    }

    handleMouseMove(e) {
        const { px, py } = this.eventToCanvas(e);
        const cell = this.cellAt(px, py);
        this.canvas.style.cursor = cell ? 'crosshair' : 'default';
        if (this.onHover) this.onHover(cell, e.clientX, e.clientY);
    }

    handleKey(e) {
        if (!this.result || !this.cursor) return;
        const { n, m } = this.result;
        let { i, j } = this.cursor;
        switch (e.key) {
            case 'ArrowLeft':  i--; break;
            case 'ArrowRight': i++; break;
            case 'ArrowUp':    j--; break;
            case 'ArrowDown':  j++; break;
            case '<': case ',': i--; j--; break;   // along the diagonal
            case '>': case '.': i++; j++; break;
            case '[': i++; j--; break;             // along the anti-diagonal
            case ']': i--; j++; break;
            default: return;
        }
        e.preventDefault();
        i = Math.max(0, Math.min(n - 1, i));
        j = Math.max(0, Math.min(m - 1, j));
        if (i !== this.cursor.i || j !== this.cursor.j) this.setCursor(i, j);
    }
}
