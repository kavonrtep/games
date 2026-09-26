/**
 * ASSEMBLY VIEW
 * =============
 * One canvas, four aligned zones sharing the genome's horizontal scale:
 *   genome (repeat copies shaded) · reads (errors as red ticks) ·
 *   de Bruijn graph · contigs placed where they occur in the genome.
 *
 * Graph layout: a (k−1)-mer that occurs once sits on the centre line under
 * its genome position, so an unbranched genome is a straight chain. Nodes
 * that occur at several places (a collapsed repeat, or a chance repeat) are
 * lifted above the line at the mean of their positions; nodes created only
 * by sequencing errors hang below it. Nodes glide to their new place when a
 * parameter changes. Also: the contigs-vs-k chart and the k-mer count
 * histogram (SVG strings).
 */
const BASE_COLORS = { A: '#16a34a', C: '#2563eb', G: '#d97706', T: '#dc2626' };
const AS_COLORS = { unique: '#4f46e5', repeat: '#d97706', repeatBranch: '#dc2626', chance: '#ea580c', error: '#dc2626', errorEdge: '#f87171', trueEdge: '#15803d', pruned: '#cbd5e0', edge: '#8b93c9' };

class AssemblyView {
    constructor(wrap, opts = {}) {
        this.wrap = wrap;
        this.opts = opts;
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'as-canvas';
        this.tip = document.createElement('div');
        this.tip.className = 'as-tip'; this.tip.hidden = true;
        wrap.appendChild(this.canvas); wrap.appendChild(this.tip);
        this.ctx = this.canvas.getContext('2d');
        this.pos = new Map();        // node id -> current {x, y}
        this.state = null;
        this.zones = { reads: true, graph: true, contigs: true };
        this.highlight = null;       // k-mer string
        this.canvas.addEventListener('mousemove', e => this.hover(e));
        this.canvas.addEventListener('mouseleave', () => { this.tip.hidden = true; });
    }

    setZones(z) { this.zones = Object.assign({ reads: true, graph: true, contigs: true }, z); }

    render(state, highlight = null) {
        this.state = state; this.highlight = highlight;
        this.layout();
        const from = new Map(this.pos);
        const to = this.targets;
        const t0 = performance.now(), dur = from.size ? 450 : 0;
        cancelAnimationFrame(this.raf);
        const step = now => {
            const t = dur ? Math.min(1, (now - t0) / dur) : 1, e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            this.pos = new Map();
            for (const [id, p] of to) { const f = from.get(id) || p; this.pos.set(id, { x: f.x + (p.x - f.x) * e, y: f.y + (p.y - f.y) * e }); }
            this.draw();
            if (t < 1) this.raf = requestAnimationFrame(step);
        };
        this.raf = requestAnimationFrame(step);
    }

    // ------------------------------------------------------------ layout
    layout() {
        const st = this.state, G = st.genome.sequence.length, k = st.params.k;
        const avail = (this.wrap.clientWidth || 800) - 2;
        this.pad = 34;
        this.px = Math.max(16, (avail - 2 * this.pad) / G);
        this.W = Math.ceil(this.pad * 2 + G * this.px);
        const X = p => this.pad + p * this.px;
        this.X = X;
        // zone geometry
        let y = 6;
        this.yGenome = y + 14; y += 34;
        // reads packed into rows
        this.readRows = [];
        if (this.zones.reads) {
            const ends = [];
            for (const r of st.reads) {
                let row = ends.findIndex(e => e < r.start);
                if (row < 0) { row = ends.length; ends.push(-1); }
                ends[row] = r.start + r.seq.length;
                this.readRows.push(row);
            }
            this.yReads = y + 4; y += 8 + Math.max(1, ends.length) * 7;
        }
        // graph
        const nodes = [...st.graph.nodes.values()];
        const mid = n => (n.positions.reduce((a, b) => a + b, 0) / n.positions.length) + (k - 1) / 2;
        const up = [], down = [], line = [];
        for (const n of nodes) (n.errorNode ? down : n.positions.length > 1 ? up : line).push(n);
        // pack whole chains (connected runs of lifted or error nodes) into lanes, so a detour stays on one level
        const lanes = list => {
            const inList = new Set(list.map(n => n.id)), comp = new Map();
            let c = 0;
            for (const n of list) {
                if (comp.has(n.id)) continue;
                const stack = [n.id]; comp.set(n.id, c);
                while (stack.length) {
                    const id = stack.pop(), nd = st.graph.nodes.get(id);
                    for (const nb of [...nd.out.keys(), ...nd.in.keys()]) if (inList.has(nb) && !comp.has(nb)) { comp.set(nb, c); stack.push(nb); }
                }
                c++;
            }
            const span = Array.from({ length: c }, () => ({ lo: Infinity, hi: -Infinity }));
            for (const n of list) { const sp = span[comp.get(n.id)], x = X(mid(n)); sp.lo = Math.min(sp.lo, x); sp.hi = Math.max(sp.hi, x); }
            const order = span.map((sp, i) => ({ i, ...sp })).sort((a, b) => a.lo - b.lo);
            const laneEnd = [], laneOf = [];
            for (const o of order) { let l = 0; while (laneEnd[l] !== undefined && o.lo - laneEnd[l] < 40) l++; laneEnd[l] = o.hi; laneOf[o.i] = l; }
            const lane = new Map(list.map(n => [n.id, laneOf[comp.get(n.id)]]));
            return { lane, n: laneEnd.length };
        };
        const U = lanes(up), D = lanes(down);
        this.laneH = 30;
        this.targets = new Map();
        if (this.zones.graph) {
            this.yGraphTop = y + 16;
            const center = this.yGraphTop + 14 + Math.max(1, U.n) * this.laneH;
            this.yCenter = center;
            for (const n of line) this.targets.set(n.id, { x: X(mid(n)), y: center });
            for (const n of up) this.targets.set(n.id, { x: X(mid(n)), y: center - (1 + U.lane.get(n.id)) * this.laneH });
            for (const n of down) this.targets.set(n.id, { x: X(mid(n)), y: center + (1 + D.lane.get(n.id)) * this.laneH });
            y = center + (Math.max(1, D.n) + 0.6) * this.laneH + 6;
        }
        // contigs packed into rows (every locus of a repeat contig)
        this.contigRows = [];
        if (this.zones.contigs) {
            this.yContigs = y + 16;
            const ends = [];
            const place = (c, start, kind) => {
                let row = ends.findIndex(e => e < start - 0.5);
                if (row < 0) { row = ends.length; ends.push(-1); }
                ends[row] = start + c.length;
                this.contigRows.push({ c, start, row, kind });
            };
            for (const c of st.contigs) {
                if (c.loci.length) for (const l of c.loci) place(c, l, c.repeat ? 'repeat' : 'ok');
                else place(c, Math.max(0, Math.min(G - c.length, c.start)), c.fromErrors ? 'error' : 'chimera');
            }
            y = this.yContigs + Math.max(1, ends.length) * 16 + 10;
        }
        this.H = y;
    }

    // ------------------------------------------------------------ drawing
    draw() {
        const st = this.state, ctx = this.ctx, dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.W * dpr; this.canvas.height = this.H * dpr;
        this.canvas.style.width = this.W + 'px'; this.canvas.style.height = this.H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, this.W, this.H);
        const X = this.X, px = this.px, seq = st.genome.sequence, k = st.params.k;
        const hl = this.highlight ? this.hlPositions() : [];
        // --- genome
        this.label('genome', this.yGenome - 12);
        for (const s of st.genome.segments) if (s.type === 'repeat') { ctx.fillStyle = 'rgba(217,119,6,0.18)'; ctx.fillRect(X(s.start), this.yGenome - 10, (s.end - s.start) * px, 20); }
        for (const p of hl) { ctx.fillStyle = 'rgba(220,38,38,0.2)'; ctx.fillRect(X(p), this.yGenome - 10, k * px, 20); }
        ctx.font = `600 ${Math.min(14, px * 0.8)}px "JetBrains Mono", "Courier New", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let i = 0; i < seq.length; i++) { ctx.fillStyle = BASE_COLORS[seq[i]]; ctx.fillText(seq[i], X(i + 0.5), this.yGenome); }
        ctx.fillStyle = '#a0aec0'; ctx.font = '9px sans-serif';
        for (let i = 0; i <= seq.length; i += 10) ctx.fillText(i ? String(i) : '', X(i - 0.5), this.yGenome + 16);
        // --- reads
        if (this.zones.reads) {
            this.label(`reads (${st.reads.length})`, this.yReads - 5);
            st.reads.forEach((r, i) => {
                const y = this.yReads + this.readRows[i] * 7;
                ctx.fillStyle = 'rgba(79,70,229,0.55)'; ctx.fillRect(X(r.start) + 1, y, r.seq.length * px - 2, 4);
                ctx.fillStyle = '#dc2626';
                for (const e of r.errors) ctx.fillRect(X(r.start + e) + px * 0.2, y - 2, px * 0.6, 8);
            });
        }
        // --- graph
        if (this.zones.graph) this.drawGraph(hl);
        // --- contigs
        if (this.zones.contigs) {
            this.label(`contigs (${st.contigs.length})`, this.yContigs - 6);
            for (const r of this.contigRows) {
                const x = X(r.start), w = r.c.length * px, y = this.yContigs + r.row * 16;
                ctx.fillStyle = r.kind === 'ok' ? '#4f46e5' : r.kind === 'repeat' ? '#d97706' : r.kind === 'error' ? '#fca5a5' : '#dc2626';
                ctx.globalAlpha = r.kind === 'repeat' ? 0.75 : 0.9;
                ctx.fillRect(x + 1, y, w - 2, 11);
                ctx.globalAlpha = 1;
                ctx.fillStyle = r.kind === 'error' ? '#7f1d1d' : '#fff'; ctx.font = '600 9px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                const txt = `${r.c.length} bp${r.kind === 'repeat' ? ' · repeat' : r.kind === 'chimera' ? ' · misjoined!' : r.kind === 'error' ? ' · error' : ''}`;
                if (ctx.measureText(txt).width < w - 6) ctx.fillText(txt, x + 4, y + 6);
            }
        }
    }

    label(t, y) { const c = this.ctx; c.fillStyle = '#718096'; c.font = '10px sans-serif'; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText(t, 4, y); }

    hlPositions() {
        const e = this.state.graph.edges.get(this.highlight);
        return e ? [...e.positions].filter(p => this.state.genome.sequence.substr(p, this.state.params.k) === this.highlight) : [];
    }

    nodeStyle(n) {
        const errorsMode = this.state.params.errorRate > 0;
        if (n.errorNode) return { fill: AS_COLORS.error, r: 7 };
        if (n.isRepeatBranch) return { fill: AS_COLORS.repeatBranch, r: 10, ring: true };
        if (n.isChanceBranch) return { fill: AS_COLORS.chance, r: 9 };
        if (n.isErrorBranch) return { fill: AS_COLORS.trueEdge, r: 9, outline: '#1f1e1b' };
        if (n.positions.length > 1 || n.inRepeat) return { fill: AS_COLORS.repeat, r: 8 };
        return { fill: errorsMode ? AS_COLORS.trueEdge : AS_COLORS.unique, r: 8 };
    }

    drawGraph() {
        const st = this.state, ctx = this.ctx, g = st.graph, thr = st.stats.threshold;
        this.label(`de Bruijn graph: ${g.nodes.size} nodes = (k−1)-mers, ${g.edges.size} edges = k-mers (k = ${st.params.k})`, this.yGraphTop - 4);
        const r0 = Math.min(9, this.px * 0.42);
        // edges
        for (const e of g.edges.values()) {
            const a = this.pos.get(e.from), b = this.pos.get(e.to);
            if (!a || !b) continue;
            const pruned = e.count < thr, err = e.fromError === e.count, hot = e.kmer === this.highlight;
            ctx.strokeStyle = hot ? '#dc2626' : pruned ? AS_COLORS.pruned : err ? AS_COLORS.errorEdge : st.params.errorRate > 0 ? AS_COLORS.trueEdge : AS_COLORS.edge;
            ctx.lineWidth = hot ? 4 : st.params.errorRate > 0 ? Math.min(6, 0.8 + e.count * 0.45) : 1.6;
            ctx.setLineDash(pruned ? [3, 3] : []);
            this.arrow(a, b, r0);
            ctx.setLineDash([]);
        }
        // nodes
        const nodes = [...g.nodes.values()].filter(n => this.pos.get(n.id)).sort((a, b) => this.pos.get(a.id).x - this.pos.get(b.id).x);
        const lastLabel = {};
        let flip = false;
        for (const n of nodes) {
            const p = this.pos.get(n.id), s = this.nodeStyle(n), r = Math.min(s.r, r0 + 1);
            const pruned = st.params.errorRate > 0 && n.coverage < thr;
            ctx.globalAlpha = pruned ? 0.35 : 1;
            if (s.ring) { ctx.beginPath(); ctx.arc(p.x, p.y, r + 6, 0, 7); ctx.fillStyle = 'rgba(220,38,38,0.15)'; ctx.fill(); }
            ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fillStyle = s.fill; ctx.fill();
            ctx.lineWidth = s.outline ? 2.5 : 1.5; ctx.strokeStyle = s.outline || '#fff'; ctx.stroke();
            if (this.highlight && (this.highlight.slice(0, -1) === n.id || this.highlight.slice(1) === n.id)) { ctx.lineWidth = 3; ctx.strokeStyle = '#dc2626'; ctx.beginPath(); ctx.arc(p.x, p.y, r + 2, 0, 7); ctx.stroke(); }
            ctx.globalAlpha = 1;
            // labels: alternate above/below the centre line, skip where they would overprint
            const zone = p.y < this.yCenter - 1 ? 'up' : p.y > this.yCenter + 1 ? 'down' : 'line';
            ctx.font = '9px "JetBrains Mono", "Courier New", monospace';
            const w = ctx.measureText(n.seq).width + 4;
            // alternate above/below on the line and among lifted nodes; error detours label below
            const above = zone === 'down' ? false : (flip = !flip);
            const key = zone + (above ? 'A' : 'B');
            if (p.x - (lastLabel[key] ?? -1e9) >= w || n.isBranch) {
                lastLabel[key] = p.x;
                ctx.fillStyle = n.isBranch ? '#1f1e1b' : '#4a5568'; ctx.textAlign = 'center'; ctx.textBaseline = above ? 'bottom' : 'top';
                ctx.fillText(n.seq, p.x, above ? p.y - r - 2 : p.y + r + 2);
            }
        }
    }

    arrow(a, b, r) {
        const ctx = this.ctx;
        const dx = b.x - a.x, dy = b.y - a.y;
        const straight = Math.abs(dy) < 1 && dx > 0 && dx < this.px * 1.6;
        ctx.beginPath();
        let ang;
        if (straight) { ctx.moveTo(a.x + r, a.y); ctx.lineTo(b.x - r - 3, b.y); ang = 0; }
        else {
            // curve; backward edges bow away from the line
            const bow = dx < 0 ? 40 : 0;
            const c1 = { x: a.x + Math.max(20, Math.abs(dx) * 0.4), y: a.y - bow }, c2 = { x: b.x - Math.max(20, Math.abs(dx) * 0.4), y: b.y - bow };
            ctx.moveTo(a.x, a.y); ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
            ang = Math.atan2(b.y - c2.y, b.x - c2.x);
        }
        ctx.stroke();
        const hx = b.x - Math.cos(ang) * (r + 2), hy = b.y - Math.sin(ang) * (r + 2);
        ctx.beginPath(); ctx.moveTo(hx, hy);
        ctx.lineTo(hx - Math.cos(ang - 0.45) * 6, hy - Math.sin(ang - 0.45) * 6);
        ctx.lineTo(hx - Math.cos(ang + 0.45) * 6, hy - Math.sin(ang + 0.45) * 6);
        ctx.closePath(); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
    }

    // ------------------------------------------------------------ hover
    hover(ev) {
        if (!this.state || !this.zones.graph) return;
        const rect = this.canvas.getBoundingClientRect(), x = ev.clientX - rect.left, y = ev.clientY - rect.top;
        let best = null, bd = 12;
        for (const [id, p] of this.pos) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = id; } }
        if (!best) { this.tip.hidden = true; return; }
        const n = this.state.graph.nodes.get(best);
        const kind = n.errorNode ? 'made only by sequencing errors' : n.isErrorBranch ? 'true k-mer where an error detour leaves or rejoins – branch point' : n.isRepeatBranch ? 'collapsed repeat – branch point' : n.isChanceBranch ? 'occurs twice by chance – branch point' : n.positions.length > 1 ? 'occurs at several places' : 'unique';
        this.tip.innerHTML = `<strong>${n.seq}</strong> · ${kind}<br>genome position${n.positions.length > 1 ? 's' : ''}: ${n.positions.map(p => p + 1).join(', ')}<br>${n.indeg} in, ${n.outdeg} out · coverage ${n.coverage}×`;
        this.tip.hidden = false;
        this.tip.style.left = Math.min(x + 14, this.wrap.scrollWidth - 240) + 'px';
        this.tip.style.top = (y + 12) + 'px';
    }
}

// ------------------------------------------------------------ charts (SVG strings)
const AssemblyCharts = {
    sweep(sweep, k, params) {
        const W = 600, H = 190, ml = 44, mr = 16, mt = 14, mb = 36;
        const maxC = Math.max(...sweep.map(s => s.nContigs), 2);
        const kmin = sweep[0].k, kmax = sweep[sweep.length - 1].k;
        const x = kk => ml + (kk - kmin) / Math.max(1, kmax - kmin) * (W - ml - mr);
        const y = v => mt + (1 - (Math.log(v) / Math.log(maxC))) * (H - mt - mb);
        let s = `<svg class="as-chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
        const R = params.repeatLength;
        if (R > 0 && params.repeatCopies > 1) {
            const kr = R + 2;
            if (kr <= kmax) s += `<rect x="${x(Math.max(kmin, kr)) - 6}" y="${mt}" width="${x(kmax) - x(Math.max(kmin, kr)) + 12}" height="${H - mt - mb}" fill="rgba(22,163,74,0.07)"/><text x="${x(Math.max(kmin, kr))}" y="${mt + 10}" font-size="10" fill="#15803d">k ≥ R + 2 = ${kr}</text>`;
        }
        for (const v of [1, 2, 5, 10, 20, 50].filter(v => v <= maxC)) s += `<line x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}" stroke="#edf2f7"/><text x="${ml - 6}" y="${y(v) + 3}" font-size="10" text-anchor="end" fill="#718096">${v}</text>`;
        s += `<polyline fill="none" stroke="#4f46e5" stroke-width="2" points="${sweep.map(p => `${x(p.k)},${y(p.nContigs)}`).join(' ')}"/>`;
        for (const p of sweep) s += `<circle cx="${x(p.k)}" cy="${y(p.nContigs)}" r="${p.k === k ? 6 : 3.5}" fill="${p.whole ? '#16a34a' : p.repeatBranches ? '#dc2626' : '#4f46e5'}" stroke="${p.k === k ? '#1f1e1b' : 'none'}" stroke-width="2"><title>k = ${p.k}: ${p.nContigs} contig${p.nContigs === 1 ? '' : 's'}${p.whole ? ' (whole genome)' : ''}</title></circle><text x="${x(p.k)}" y="${H - mb + 14}" font-size="10" text-anchor="middle" fill="${p.k === k ? '#1f1e1b' : '#718096'}">${p.k}</text>`;
        s += `<text x="${(W + ml) / 2}" y="${H - 4}" font-size="11" text-anchor="middle" fill="#4a5568">k (click a point to use it)</text>`;
        s += `<text x="12" y="${(H - mb + mt) / 2}" font-size="11" text-anchor="middle" fill="#4a5568" transform="rotate(-90 12 ${(H - mb + mt) / 2})">contigs</text>`;
        sweep.forEach(p => { s += `<rect x="${x(p.k) - 10}" y="${mt}" width="20" height="${H - mt - mb + 18}" fill="transparent" data-k="${p.k}" style="cursor:pointer"/>`; });
        return s + '</svg>';
    },

    spectrum(spec, threshold) {
        const W = 600, H = 200, ml = 44, mr = 16, mt = 26, mb = 36;
        const maxX = Math.max(...spec.map(s => s.count), threshold + 1), maxY = Math.max(...spec.map(s => s.trueK + s.errorK), 1);
        const bw = (W - ml - mr) / maxX, ph = H - mt - mb;
        const x = c => ml + (c - 1) * bw, h = v => ph * Math.sqrt(v / maxY);      // square-root axis: small peaks stay visible
        let s = `<svg class="as-chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
        s += `<rect x="${ml}" y="${mt}" width="${(threshold - 1) * bw}" height="${ph}" fill="rgba(160,174,192,0.2)"/>`;
        for (const v of [1, 5, 10, 25, 50, 100, 200].filter(v => v <= maxY)) s += `<line x1="${ml}" x2="${W - mr}" y1="${H - mb - h(v)}" y2="${H - mb - h(v)}" stroke="#edf2f7"/><text x="${ml - 6}" y="${H - mb - h(v) + 3}" font-size="10" text-anchor="end" fill="#718096">${v}</text>`;
        for (const b of spec) {
            const tot = b.trueK + b.errorK, hTot = h(tot), hE = tot ? hTot * b.errorK / tot : 0;
            s += `<rect x="${x(b.count) + 1}" y="${H - mb - hE}" width="${bw - 2}" height="${hE}" fill="#f87171"><title>${b.errorK} error k-mers seen ${b.count}×</title></rect>`;
            s += `<rect x="${x(b.count) + 1}" y="${H - mb - hTot}" width="${bw - 2}" height="${hTot - hE}" fill="#15803d"><title>${b.trueK} true k-mers seen ${b.count}×</title></rect>`;
        }
        for (let c = 1; c <= maxX; c++) if (maxX <= 25 || c % 2 === 1) s += `<text x="${x(c) + bw / 2}" y="${H - mb + 14}" font-size="10" text-anchor="middle" fill="#718096">${c}</text>`;
        s += `<line x1="${x(threshold)}" x2="${x(threshold)}" y1="${mt - 6}" y2="${H - mb}" stroke="#1f1e1b" stroke-width="2" stroke-dasharray="4 3"/><text x="${x(threshold) + 4}" y="${mt - 10}" font-size="10" fill="#1f1e1b">threshold ${threshold}×: k-mers left of the line are removed</text>`;
        s += `<text x="${(W + ml) / 2}" y="${H - 4}" font-size="11" text-anchor="middle" fill="#4a5568">how many times a k-mer was seen in the reads</text>`;
        s += `<text x="12" y="${(H - mb + mt) / 2}" font-size="11" text-anchor="middle" fill="#4a5568" transform="rotate(-90 12 ${(H - mb + mt) / 2})">k-mers (√ scale)</text>`;
        return s + '</svg>';
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AssemblyView, AssemblyCharts };
}
