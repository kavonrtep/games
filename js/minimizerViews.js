/**
 * MINIMIZER MAPPING LAB – VIEWS
 * =============================
 * SVG dotplot of anchors and chains, and an alignment block with CIGAR.
 */
const MinimizerViews = (() => {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

    /**
     * Anchors of one read against the reference. Reference horizontal (x), read vertical (y, top → bottom).
     * opts: { t0, t1 (reference range shown), qLen, chains: [{anchors, color, width}], truth: {start, end},
     *         repeats: [{start, end, polyA}], clickable, selected: anchor, W, H }
     */
    function dotplot(anchors, opts) {
        const o = Object.assign({ W: 700, H: 300, chains: [], truth: null, repeats: [], clickable: false, selected: null }, opts);
        const ml = 46, mr = 12, mt = 16, mb = 34, pw = o.W - ml - mr, ph = o.H - mt - mb;
        const X = t => ml + (t - o.t0) / Math.max(1, o.t1 - o.t0) * pw, Y = q => mt + q / Math.max(1, o.qLen) * ph;
        let s = `<svg class="mm-dot" viewBox="0 0 ${o.W} ${o.H}" width="${o.W}" height="${o.H}" xmlns="http://www.w3.org/2000/svg">`;
        s += `<rect x="${ml}" y="${mt}" width="${pw}" height="${ph}" fill="#fff" stroke="#a0aec0"/>`;
        for (const r of o.repeats) if (r.end > o.t0 && r.start < o.t1) s += `<rect x="${X(Math.max(r.start, o.t0))}" y="${mt}" width="${X(Math.min(r.end, o.t1)) - X(Math.max(r.start, o.t0))}" height="${ph}" fill="${r.polyA ? 'rgba(124,58,237,0.10)' : 'rgba(217,119,6,0.12)'}"><title>${r.polyA ? 'poly-A run' : `repeat family ${r.family + 1}, copy ${r.copy + 1}`}</title></rect>`;
        if (o.truth) s += `<rect x="${X(Math.max(o.truth.start, o.t0))}" y="${mt - 8}" width="${Math.max(2, X(Math.min(o.truth.end, o.t1)) - X(Math.max(o.truth.start, o.t0)))}" height="5" fill="#16a34a"><title>true origin of the read</title></rect>`;
        for (const a of anchors) {
            if (a.t < o.t0 || a.t > o.t1) continue;
            const sel = o.selected === a;
            s += `<circle cx="${X(a.t).toFixed(1)}" cy="${Y(a.q).toFixed(1)}" r="${sel ? 5 : 2.2}" fill="${a.strand > 0 ? '#2563eb' : '#ea580c'}" ${sel ? 'stroke="#1f1e1b" stroke-width="2"' : 'opacity="0.75"'}${o.clickable ? ` data-anchor="${a._i}" class="mm-anchor"` : ''}><title>read ${a.q + 1} ↔ reference ${a.t + 1} (${a.strand > 0 ? '+' : '−'} strand) ${esc(a.kmer)}</title></circle>`;
        }
        for (const c of o.chains) {
            const pts = c.anchors.filter(a => a.t >= o.t0 && a.t <= o.t1).map(a => `${X(a.t).toFixed(1)},${Y(a.q).toFixed(1)}`).join(' ');
            if (pts) s += `<polyline points="${pts}" fill="none" stroke="${c.color}" stroke-width="${c.width || 2.5}" opacity="0.85"/>`;
        }
        const tick = (o.t1 - o.t0) > 8000 ? 5000 : (o.t1 - o.t0) > 2000 ? 1000 : (o.t1 - o.t0) > 800 ? 200 : 100;
        for (let t = Math.ceil(o.t0 / tick) * tick; t <= o.t1; t += tick) s += `<text x="${X(t)}" y="${mt + ph + 13}" font-size="10" text-anchor="middle" fill="#718096">${t.toLocaleString()}</text>`;
        s += `<text x="${ml + pw / 2}" y="${o.H - 4}" font-size="11" text-anchor="middle" fill="#4a5568">reference position →</text>`;
        s += `<text x="${ml - 6}" y="${mt + 8}" font-size="10" text-anchor="end" fill="#718096">0</text><text x="${ml - 6}" y="${mt + ph}" font-size="10" text-anchor="end" fill="#718096">${o.qLen}</text>`;
        s += `<text x="12" y="${mt + ph / 2}" font-size="11" text-anchor="middle" fill="#4a5568" transform="rotate(-90 12 ${mt + ph / 2})">read position ↓</text>`;
        return s + '</svg>';
    }

    // alignment in blocks of 60 columns, with coordinates
    function alignmentBlock(a1, a2, qStart, tStart) {
        let out = '', q = qStart, t = tStart;
        for (let k = 0; k < a1.length; k += 60) {
            const r = a1.slice(k, k + 60), g = a2.slice(k, k + 60);
            const mid = r.split('').map((c, i) => c === '-' || g[i] === '-' ? ' ' : c === g[i] ? '|' : '.').join('');
            const qn = r.replace(/-/g, '').length, tn = g.replace(/-/g, '').length;
            out += `read ${String(q + 1).padStart(5)} ${r} ${q + qn}\n           ${mid}\nref  ${String(t + 1).padStart(5)} ${g} ${t + tn}\n\n`;
            q += qn; t += tn;
        }
        return `<pre class="bl-aln mm-aln">${esc(out)}</pre>`;
    }

    return { dotplot, alignmentBlock, esc };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MinimizerViews;
}
