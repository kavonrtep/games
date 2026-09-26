/**
 * OLC ASSEMBLY – VIEWS
 * ====================
 * SVG string builders for olc.html: overlap graph (with transitive edges),
 * read-layout block, dotplot of contigs against the genome, Lander–Waterman
 * chart and N50 bar chart.
 */
const OlcViews = (() => {
    const BASE = { A: '#16a34a', C: '#2563eb', G: '#d97706', T: '#dc2626', N: '#94a3b8' };
    const CONTIG_COLORS = ['#4f46e5', '#0891b2', '#16a34a', '#d97706', '#be185d', '#7c3aed', '#0f766e', '#b45309'];
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const marker = (id, color) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>`;

    /**
     * graph: from OlcEngine.buildGraph; x: Map node → x position (bp); opts: { showTransitive, contigOf: Map node → contig index,
     * names, flipped: Set of reads used reverse-complemented, width }
     */
    function graph(g, x, opts = {}) {
        const o = Object.assign({ showTransitive: true, contigOf: new Map(), names: null, flipped: new Set(), width: 720, highlight: null }, opts);
        const live = g.nodes.filter(n => !n.contained);
        const xs = live.map(n => x.get(n.id) || 0), lo = Math.min(...xs), hi = Math.max(...xs, lo + 1);
        const W = o.width, ml = 30, mr = 30, rowY = 150;
        const X = v => ml + (v - lo) / (hi - lo) * (W - ml - mr);
        // stagger nodes that are close to each other
        const order = live.slice().sort((a, b) => (x.get(a.id) || 0) - (x.get(b.id) || 0));
        const pos = new Map();
        let lastX = -1e9, lane = 0;
        for (const n of order) { const px = X(x.get(n.id) || 0); lane = px - lastX < 30 ? (lane + 1) % 3 : 0; lastX = px; pos.set(n.id, { x: px, y: rowY + [0, 34, -34][lane] }); }
        const cont = g.nodes.filter(n => n.contained);
        let H = 250;
        let s = `<svg class="olc-graph" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs>${marker('og-a', '#475569')}${marker('og-t', '#cbd5e0')}${marker('og-h', '#dc2626')}</defs>`;
        const edges = g.edges.filter(e => pos.has(e.from) && pos.has(e.to));
        for (const e of edges) {
            if (e.transitive && !o.showTransitive) continue;
            const a = pos.get(e.from), b = pos.get(e.to);
            const hot = o.highlight && o.highlight.has(e);
            const lift = Math.min(110, 18 + Math.abs(b.x - a.x) * 0.35);
            const dir = b.x >= a.x ? -1 : 1;
            const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) + dir * lift;
            const color = hot ? '#dc2626' : e.transitive ? '#cbd5e0' : '#475569';
            // end the curve at the edge of the target circle so the arrowhead stays visible
            const dx = b.x - mx, dy = b.y - my, dl = Math.hypot(dx, dy) || 1, ex = b.x - dx / dl * 15, ey = b.y - dy / dl * 15;
            s += `<path d="M${a.x},${a.y} Q${mx},${my} ${ex.toFixed(1)},${ey.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${hot ? 3 : e.transitive ? 1.2 : 1.8}" ${e.transitive ? 'stroke-dasharray="4 3"' : ''} marker-end="url(#${hot ? 'og-h' : e.transitive ? 'og-t' : 'og-a'})"><title>${esc(o.names ? o.names[e.from] : e.from)} → ${esc(o.names ? o.names[e.to] : e.to)}: overlap ${e.len} bp${e.mis ? `, ${e.mis} mismatch${e.mis > 1 ? 'es' : ''}` : ''}${e.transitive ? ' (transitive – implied by a path through another read)' : ''}</title></path>`;
            if (!e.transitive || o.showTransitive) s += `<text x="${mx}" y="${(a.y + b.y) / 2 + dir * lift / 2 + (dir < 0 ? -2 : 10)}" font-size="9" text-anchor="middle" fill="${e.transitive ? '#a0aec0' : '#4a5568'}">${e.len}</text>`;
        }
        for (const n of live) {
            const p = pos.get(n.id), ci = o.contigOf.get(n.id), col = ci === undefined ? '#94a3b8' : CONTIG_COLORS[ci % CONTIG_COLORS.length];
            s += `<g><circle cx="${p.x}" cy="${p.y}" r="13" fill="${col}" stroke="#fff" stroke-width="2"/><text x="${p.x}" y="${p.y + 4}" font-size="10" font-weight="600" text-anchor="middle" fill="#fff">${esc(o.names ? o.names[n.id] : n.id)}</text>`;
            if (o.flipped.has(n.id)) s += `<text x="${p.x}" y="${p.y + 25}" font-size="9" text-anchor="middle" fill="#7a3e1d">⇄ rc</text>`;
            s += '</g>';
        }
        if (cont.length) {
            const txt = `contained reads (inside another read, left out of the graph): ${cont.map(n => o.names ? o.names[n.id] : n.id).join(', ')}`;
            s += `<text x="${ml}" y="${H - 8}" font-size="10" fill="#718096">${esc(txt)}</text>`;
        }
        return s + '</svg>';
    }

    // force-directed placement (seeded, deterministic): overlapping reads attract, all reads repel.
    // It shows the shape of the graph (a chain, a knot at a repeat) without revealing genome positions.
    function forceLayout(n, links, seed, W, H) {
        const rng = new OlcEngine.Rng('layout-' + seed);
        const p = Array.from({ length: n }, (_, i) => ({ x: W / 2 + Math.cos(2 * Math.PI * i / n) * W / 3 + rng.next() * 10, y: H / 2 + Math.sin(2 * Math.PI * i / n) * H / 3 + rng.next() * 10 }));
        const k = Math.sqrt(W * H / Math.max(1, n)) * 0.8;
        for (let it = 0, t = W / 8; it < 400; it++, t *= 0.985) {
            const d = p.map(() => ({ x: 0, y: 0 }));
            for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
                const dx = p[i].x - p[j].x, dy = p[i].y - p[j].y, dist = Math.max(1, Math.hypot(dx, dy)), f = k * k / dist;
                d[i].x += dx / dist * f; d[i].y += dy / dist * f; d[j].x -= dx / dist * f; d[j].y -= dy / dist * f;
            }
            for (const l of links) {
                const a = p[l.a], b = p[l.b], dx = a.x - b.x, dy = a.y - b.y, dist = Math.max(1, Math.hypot(dx, dy)), f = dist * dist / k * (0.5 + l.w);
                d[l.a].x -= dx / dist * f; d[l.a].y -= dy / dist * f; d[l.b].x += dx / dist * f; d[l.b].y += dy / dist * f;
            }
            for (let i = 0; i < n; i++) { const len = Math.max(1e-9, Math.hypot(d[i].x, d[i].y)); p[i].x += d[i].x / len * Math.min(len, t); p[i].y += d[i].y / len * Math.min(len, t); }
        }
        const xs = p.map(q => q.x), ys = p.map(q => q.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        return p.map(q => ({ x: 30 + (q.x - x0) / Math.max(1, x1 - x0) * (W - 60), y: 30 + (q.y - y0) / Math.max(1, y1 - y0) * (H - 60) }));
    }

    /**
     * The puzzle's overlap graph on the reads as sequenced. pairs: [{a, b, flip, len, mis, used}] (one per pair of reads);
     * blue arrow = same strand (end of a matches start of b), orange line = opposite strands (one read must be flipped).
     */
    function puzzleGraph(names, pos, pairs, opts = {}) {
        const o = Object.assign({ selected: null, W: 700, H: 280 }, opts);
        let s = `<svg class="olc-pgraph" viewBox="0 0 ${o.W} ${o.H}" width="${o.W}" height="${o.H}" xmlns="http://www.w3.org/2000/svg"><defs>${marker('pg-s', '#2563eb')}${marker('pg-u', '#16a34a')}</defs>`;
        pairs.forEach((e, idx) => {
            const a = pos[e.a], b = pos[e.b];
            const dx = b.x - a.x, dy = b.y - a.y, dl = Math.hypot(dx, dy) || 1;
            const ax = a.x + dx / dl * 15, ay = a.y + dy / dl * 15, bx = b.x - dx / dl * 17, by = b.y - dy / dl * 17;
            const color = e.used ? '#16a34a' : e.flip ? '#ea580c' : '#2563eb';
            const width = e.used ? 4 : 1.2 + Math.min(3, e.len / 8);
            const arrow = !e.flip ? `marker-end="url(#${e.used ? 'pg-u' : 'pg-s'})"` : '';
            const title = e.flip
                ? `${names[e.a]} and ${names[e.b]}: opposite strands – they overlap by ${e.len} bp once one of them is flipped${e.mis ? `, ${e.mis} mismatch(es)` : ''}. Click to put them together.`
                : `${names[e.a]} → ${names[e.b]}: the end of ${names[e.a]} matches the start of ${names[e.b]} (${e.len} bp${e.mis ? `, ${e.mis} mismatch(es)` : ''}). Click to put them together.`;
            s += `<g class="olc-pedge" data-edge="${idx}"><line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="transparent" stroke-width="12"/>
                <line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${color}" stroke-width="${width}" ${e.mis ? 'stroke-dasharray="5 3"' : ''} ${arrow}/><title>${esc(title)}</title>
                <text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 4}" font-size="10" text-anchor="middle" fill="${color}" font-weight="600">${e.len}${e.flip ? ' ⇄' : ''}</text></g>`;
        });
        pos.forEach((p, i) => {
            const sel = o.selected === i;
            s += `<g class="olc-pnode" data-node="${i}"><circle cx="${p.x}" cy="${p.y}" r="14" fill="${sel ? '#1f1e1b' : '#fff'}" stroke="#1f1e1b" stroke-width="2"/><text x="${p.x}" y="${p.y + 4}" font-size="10" font-weight="700" text-anchor="middle" fill="${sel ? '#fff' : '#1f1e1b'}">${esc(names[i])}</text></g>`;
        });
        return s + '</svg>';
    }

    // reads of a contig stacked at their offsets, with the consensus on top (HTML)
    function layoutBlock(contig, names, opts = {}) {
        const o = Object.assign({ genome: null, showDepth: true }, opts);
        const cons = contig.consensus, len = cons.seq.length;
        const cell = (ch, cls = '', title = '') => `<span class="olc-c ${cls}"${title ? ` title="${title}"` : ''}>${ch}</span>`;
        let h = '<div class="olc-block">';
        h += `<div class="olc-brow olc-cons"><span class="olc-blab">consensus</span>${cons.columns.map((c, i) => cell(cons.seq[i], (c.tie ? 'olc-tie' : c.agree ? '' : 'olc-fixed') + ' b-' + cons.seq[i], `depth ${c.depth}: ${Object.entries(c.counts).map(([b, n]) => b + '×' + n).join(' ')}`)).join('')}</div>`;
        if (o.showDepth) h += `<div class="olc-brow olc-depth"><span class="olc-blab">depth</span>${cons.columns.map(c => cell(c.depth, 'd' + Math.min(4, c.depth))).join('')}</div>`;
        const rows = cons.rows.slice().sort((a, b) => a.offset - b.offset);
        for (const r of rows) {
            let line = '';
            for (let c = 0; c < len; c++) {
                const k = c - r.offset;
                if (k < 0 || k >= r.seq.length) { line += cell(''); continue; }
                const ch = r.seq[k], col = cons.columns[c];
                line += cell(ch, (ch !== cons.seq[c] ? 'olc-err' : 'olc-ok') + (r.contained ? ' olc-contained' : ''));
            }
            h += `<div class="olc-brow"><span class="olc-blab">${esc(names[r.id])}${r.contained ? ' ⊂' : ''}</span>${line}</div>`;
        }
        return h + '</div>';
    }

    // dotplot of assembled contigs (concatenated, separated) against the genome; exact k-mer matches, both strands
    function dotplot(genome, contigs, opts = {}) {
        const o = Object.assign({ k: 8, size: 300, title: '' }, opts);
        const seqs = contigs.map(c => c.consensus.seq);
        const total = seqs.reduce((a, s) => a + s.length, 0) + (seqs.length - 1) * 4;
        const G = genome.length, S = o.size, sx = S / G, sy = S / Math.max(total, 1);
        const idx = new Map();
        for (let i = 0; i + o.k <= G; i++) { const w = genome.substr(i, o.k); if (!idx.has(w)) idx.set(w, []); idx.get(w).push(i); }
        const rc = OlcEngine.revcomp;
        let s = `<svg class="olc-dot" viewBox="0 0 ${S + 50} ${S + 40}" width="${S + 50}" height="${S + 40}" xmlns="http://www.w3.org/2000/svg"><rect x="40" y="10" width="${S}" height="${S}" fill="#fff" stroke="#a0aec0"/>`;
        let y0 = 0;
        seqs.forEach((q, ci) => {
            const col = contigs[ci].correct === false ? '#dc2626' : CONTIG_COLORS[ci % CONTIG_COLORS.length];
            for (let j = 0; j + o.k <= q.length; j++) {
                const w = q.substr(j, o.k);
                for (const i of idx.get(w) || []) s += `<rect x="${40 + i * sx}" y="${10 + (y0 + j) * sy}" width="${Math.max(1, sx)}" height="${Math.max(1, sy)}" fill="${col}"/>`;
                for (const i of idx.get(rc(w)) || []) s += `<rect x="${40 + (i + o.k - 1) * sx}" y="${10 + (y0 + j) * sy}" width="${Math.max(1, sx)}" height="${Math.max(1, sy)}" fill="${col}" opacity="0.6"/>`;
            }
            if (ci < seqs.length - 1) s += `<line x1="40" x2="${40 + S}" y1="${10 + (y0 + q.length + 2) * sy}" y2="${10 + (y0 + q.length + 2) * sy}" stroke="#e2e8f0"/>`;
            s += `<text x="36" y="${10 + (y0 + q.length / 2) * sy + 3}" font-size="9" text-anchor="end" fill="${col}">${ci + 1}</text>`;
            y0 += q.length + 4;
        });
        s += `<text x="${40 + S / 2}" y="${S + 32}" font-size="10" text-anchor="middle" fill="#4a5568">true genome →</text><text x="12" y="${10 + S / 2}" font-size="10" text-anchor="middle" fill="#4a5568" transform="rotate(-90 12 ${10 + S / 2})">contigs ↓</text>`;
        if (o.title) s += `<text x="${40 + S / 2}" y="8" font-size="10" text-anchor="middle" fill="#1f1e1b">${esc(o.title)}</text>`;
        return s + '</svg>';
    }

    // Lander–Waterman: expected contigs and uncovered fraction versus coverage, with simulated points
    function lwChart(curve, sim, current) {
        const W = 620, H = 240, ml = 50, mr = 50, mt = 16, mb = 38;
        const cmax = curve[curve.length - 1].c, ymax = Math.max(...curve.map(p => p.contigs), ...sim.map(p => p.contigs), 1);
        const X = c => ml + c / cmax * (W - ml - mr), Y = v => mt + (1 - v / ymax) * (H - mt - mb), Y2 = f => mt + (1 - f) * (H - mt - mb);
        let s = `<svg class="olc-chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
        s += `<line x1="${ml}" x2="${W - mr}" y1="${H - mb}" y2="${H - mb}" stroke="#a0aec0"/><line x1="${ml}" x2="${ml}" y1="${mt}" y2="${H - mb}" stroke="#a0aec0"/><line x1="${W - mr}" x2="${W - mr}" y1="${mt}" y2="${H - mb}" stroke="#a0aec0"/>`;
        for (let c = 0; c <= cmax; c += cmax > 20 ? 5 : 2) s += `<text x="${X(c)}" y="${H - mb + 14}" font-size="10" text-anchor="middle" fill="#718096">${c}×</text>`;
        s += `<text x="${ml - 6}" y="${Y(ymax) + 4}" font-size="10" text-anchor="end" fill="#4f46e5">${Math.round(ymax)}</text><text x="${ml - 6}" y="${Y(0)}" font-size="10" text-anchor="end" fill="#4f46e5">0</text>`;
        s += `<text x="${W - mr + 6}" y="${Y2(1) + 4}" font-size="10" fill="#d97706">100 %</text><text x="${W - mr + 6}" y="${Y2(0)}" font-size="10" fill="#d97706">0 %</text>`;
        s += `<polyline fill="none" stroke="#4f46e5" stroke-width="2" points="${curve.map(p => `${X(p.c)},${Y(p.contigs)}`).join(' ')}"/>`;
        s += `<polyline fill="none" stroke="#d97706" stroke-width="2" stroke-dasharray="5 3" points="${curve.map(p => `${X(p.c)},${Y2(p.uncovered)}`).join(' ')}"/>`;
        for (const p of sim) s += `<circle cx="${X(p.c)}" cy="${Y(p.contigs)}" r="3.5" fill="#fff" stroke="#4f46e5" stroke-width="1.5"><title>simulated: ${p.contigs.toFixed(1)} contigs at ${p.c}×</title></circle>`;
        if (current) s += `<line x1="${X(current)}" x2="${X(current)}" y1="${mt}" y2="${H - mb}" stroke="#1f1e1b" stroke-dasharray="3 3"/>`;
        s += `<text x="${(W) / 2}" y="${H - 4}" font-size="11" text-anchor="middle" fill="#4a5568">coverage c = N·L/G</text>`;
        s += `<text x="14" y="${(H - mb + mt) / 2}" font-size="11" text-anchor="middle" fill="#4f46e5" transform="rotate(-90 14 ${(H - mb + mt) / 2})">expected contigs</text>`;
        s += `<text x="${W - 12}" y="${(H - mb + mt) / 2}" font-size="11" text-anchor="middle" fill="#d97706" transform="rotate(90 ${W - 12} ${(H - mb + mt) / 2})">genome not covered</text>`;
        return s + '</svg>';
    }

    // sorted contig lengths with the cumulative sum and the 50 % line
    function n50Chart(lengths, reveal) {
        const st = OlcEngine.n50(lengths), s0 = st.sorted, total = st.total;
        const W = 560, H = 190, ml = 40, mr = 16, mt = 14, mb = 30, bw = (W - ml - mr) / s0.length;
        const Y = v => mt + (1 - v / total) * (H - mt - mb);
        let s = `<svg class="olc-chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
        let acc = 0;
        const pts = [];
        s0.forEach((l, i) => {
            const hBar = (H - mt - mb) * l / total;
            s += `<rect x="${ml + i * bw + 2}" y="${H - mb - hBar}" width="${bw - 4}" height="${hBar}" fill="${reveal && i === st.l50 - 1 ? '#dc2626' : '#94a3b8'}"/><text x="${ml + i * bw + bw / 2}" y="${H - mb + 12}" font-size="9" text-anchor="middle" fill="#718096">${l}</text>`;
            acc += l; pts.push(`${ml + (i + 1) * bw},${Y(acc)}`);
        });
        if (reveal) {
            s += `<polyline fill="none" stroke="#4f46e5" stroke-width="2" points="${ml},${Y(0)} ${pts.join(' ')}"/>`;
            s += `<line x1="${ml}" x2="${W - mr}" y1="${Y(total / 2)}" y2="${Y(total / 2)}" stroke="#dc2626" stroke-dasharray="4 3"/><text x="${W - mr}" y="${Y(total / 2) - 4}" font-size="10" text-anchor="end" fill="#dc2626">half of the assembly (${total / 2} bp)</text>`;
        }
        s += `<text x="${(W + ml) / 2}" y="${H - 2}" font-size="10" text-anchor="middle" fill="#4a5568">contigs sorted from longest to shortest (length in bp)</text>`;
        return s + '</svg>';
    }

    return { BASE, CONTIG_COLORS, graph, forceLayout, puzzleGraph, layoutBlock, dotplot, lwChart, n50Chart };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = OlcViews;
}
