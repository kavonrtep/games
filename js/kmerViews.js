/**
 * K-MER SPECTRUM – VIEWS
 * ======================
 * SVG builders for kmer-spectrum.html: the k-mer histogram (optionally
 * coloured by the true origin of every k-mer, with model curves, cut-off and
 * peak markers, clickable bins), the SNP window diagram, and the small
 * "reads over a genome" grid of the first step. Pure string builders.
 */
const KmerViews = (() => {
    const COPY_COLORS = ['#f87171', '#38bdf8', '#4f46e5', '#16a34a', '#d97706', '#7c3aed'];
    const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + ' M' : n >= 1e4 ? Math.round(n / 1e3) + ' k' : Math.round(n).toLocaleString();

    function copyLabel(m, ploidy) {
        if (m === 0) return 'error k-mers (not in the genome)';
        if (ploidy === 2) return ['', '1 copy – heterozygous (one allele)', '2 copies – homozygous, unique', '3 copies', '4 copies – e.g. a 2-copy repeat', '5 or more copies'][m];
        return ['', '1 copy – unique', '2 copies – repeat', '3 copies', '4 copies', '5 or more copies'][m];
    }

    /**
     * o: { h, byCopy, ploidy, colorTruth, xmax, logY, cutoff, markers:[{x,label,color}], curve:fn, components:[fn], clickable,
     *      width, height, overlay:[{h, color, label}] }
     */
    function histogram(o) {
        const W = o.width || 720, H = o.height || 290, ml = 58, mr = 14, mt = 22, mb = 44;
        const xmax = Math.max(4, o.xmax), pw = W - ml - mr, ph = H - mt - mb;
        // yMode 'share': plot n·h(n) – the number of k-mer occurrences, proportional to the genome positions each count represents
        const share = o.yMode === 'share', val = (n, v) => share ? n * v : v;
        if (o.yMode === 'log') o.logY = true;
        const bw = pw / xmax;
        const X = n => ml + (n - 0.5) * bw;
        // y range: from the genomic part (n ≥ cutoff) so the error spike does not flatten everything; clipped bars get an arrow
        let ymaxData = 0;
        for (let n = Math.max(2, o.cutoff || 2); n <= xmax; n++) ymaxData = Math.max(ymaxData, val(n, o.h[n] || 0));
        if (o.overlay) for (const ov of o.overlay) for (let n = 2; n <= xmax; n++) ymaxData = Math.max(ymaxData, val(n, ov.h[n] || 0));
        if (!ymaxData) ymaxData = Math.max(1, ...Array.from(o.h).slice(1, xmax + 1).map((v, i) => val(i + 1, v)));
        const logMax = Math.log10(Math.max(...Array.from(o.h).slice(1, xmax + 1).map((v, i) => val(i + 1, v)), 10) + 1);
        const Y = o.logY ? v => mt + ph * (1 - Math.log10(v + 1) / logMax) : v => mt + ph * (1 - Math.min(1.08, v / (ymaxData * 1.15)));
        let s = `<svg class="km-hist" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
        // axes and grid
        const ticksY = o.logY ? [1, 10, 100, 1e3, 1e4, 1e5, 1e6].filter(v => Math.log10(v + 1) <= logMax) : niceTicks(ymaxData * 1.15, 4);
        for (const v of ticksY) s += `<line x1="${ml}" x2="${W - mr}" y1="${Y(v)}" y2="${Y(v)}" stroke="#edf2f7"/><text x="${ml - 6}" y="${Y(v) + 3}" font-size="10" text-anchor="end" fill="#718096">${fmt(v)}</text>`;
        if (o.cutoff) s += `<rect x="${ml}" y="${mt}" width="${(o.cutoff - 1) * bw}" height="${ph}" fill="rgba(248,113,113,0.08)"/>`;
        // bars
        for (let n = 1; n <= xmax; n++) {
            const v = val(n, o.h[n] || 0);
            if (!v) continue;
            const clipped = !o.logY && v > ymaxData * 1.2;
            if (o.colorTruth && o.byCopy) {
                let base = 0;
                for (let m = 0; m < 6; m++) {
                    const c = val(n, o.byCopy[m][n]);
                    if (!c) continue;
                    const y1 = Y(base + c), y0 = Y(base);
                    s += `<rect x="${X(n) - bw / 2 + 0.5}" y="${y1}" width="${Math.max(0.8, bw - 1)}" height="${Math.max(0, y0 - y1)}" fill="${COPY_COLORS[m]}"/>`;
                    base += c;
                }
            } else s += `<rect x="${X(n) - bw / 2 + 0.5}" y="${Y(v)}" width="${Math.max(0.8, bw - 1)}" height="${Math.max(0, Y(0) - Y(v))}" fill="${n < (o.cutoff || 0) ? '#fca5a5' : '#94a3b8'}"/>`;
            if (clipped) s += `<text x="${X(n) + 4}" y="${mt + 10}" font-size="10" fill="#b91c1c">↑ ${fmt(v)}</text>`;
            if (o.clickable) s += `<rect x="${X(n) - bw / 2}" y="${mt}" width="${bw}" height="${ph}" fill="transparent" data-n="${n}" class="km-bin"><title>${n}×: ${fmt(o.h[n])} distinct k-mers${share ? ` = ${fmt(v)} occurrences` : ''}</title></rect>`;
        }
        // overlays (other k, …)
        if (o.overlay) for (const ov of o.overlay) {
            let d = '';
            for (let n = 1; n <= xmax; n++) d += `${d ? 'L' : 'M'}${X(n).toFixed(1)},${Y(val(n, ov.h[n] || 0)).toFixed(1)}`;
            s += `<path d="${d}" fill="none" stroke="${ov.color}" stroke-width="2"/>`;
        }
        // model curves
        const line = (fn, color, width, dash) => { let d = ''; for (let n = Math.max(1, o.curveFrom || 1); n <= xmax; n += 0.25) { const v = val(Math.round(n), fn(Math.round(n))); d += `${d ? 'L' : 'M'}${X(n).toFixed(1)},${Y(Math.max(0, v)).toFixed(1)}`; } return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`; };
        if (o.components) o.components.forEach((fn, j) => { s += line(fn, COPY_COLORS[Math.min(5, j + 1)], 1.5, '4 3'); });
        if (o.curve) s += line(o.curve, '#1f1e1b', 2);
        if (o.cutoff) s += `<line x1="${ml + (o.cutoff - 1) * bw}" x2="${ml + (o.cutoff - 1) * bw}" y1="${mt}" y2="${mt + ph}" stroke="#b91c1c" stroke-width="1.5" stroke-dasharray="3 3"/><text x="${ml + (o.cutoff - 1) * bw + 3}" y="${mt + ph - 4}" font-size="10" fill="#b91c1c">cut-off ${o.cutoff}×</text>`;
        (o.markers || []).forEach((m, i) => { s += `<line x1="${X(m.x)}" x2="${X(m.x)}" y1="${mt - 4}" y2="${mt + ph}" stroke="${m.color}" stroke-width="2"/><text x="${X(m.x) + (X(m.x) > W - 170 ? -4 : 4)}" y="${mt + 8 + i * 12}" font-size="10" text-anchor="${X(m.x) > W - 170 ? 'end' : 'start'}" fill="${m.color}">${m.label}</text>`; });
        // x axis
        const step = xmax <= 40 ? 5 : xmax <= 100 ? 10 : xmax <= 250 ? 25 : 50;
        for (let n = step; n <= xmax; n += step) s += `<line x1="${X(n)}" x2="${X(n)}" y1="${mt + ph}" y2="${mt + ph + 4}" stroke="#a0aec0"/><text x="${X(n)}" y="${mt + ph + 15}" font-size="10" text-anchor="middle" fill="#718096">${n}</text>`;
        s += `<line x1="${ml}" x2="${W - mr}" y1="${mt + ph}" y2="${mt + ph}" stroke="#a0aec0"/>`;
        s += `<text x="${ml + pw / 2}" y="${H - 6}" font-size="11" text-anchor="middle" fill="#4a5568">k-mer count n (how many times a k-mer was seen in the reads)</text>`;
        s += `<text x="13" y="${mt + ph / 2}" font-size="11" text-anchor="middle" fill="#4a5568" transform="rotate(-90 13 ${mt + ph / 2})">${share ? 'k-mer occurrences n·h(n)' : 'distinct k-mers seen n times'}${o.logY ? ' (log)' : ''}</text>`;
        return s + '</svg>';
    }

    function niceTicks(max, n) {
        const raw = max / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 5, 10].map(x => x * mag).find(x => x >= raw);
        const out = []; for (let v = step; v <= max; v += step) out.push(v); return out;
    }

    function legend(ploidy, present) {
        return `<div class="km-legend">${[0, 1, 2, 3, 4, 5].filter(m => !present || present[m]).map(m => `<span><i style="background:${COPY_COLORS[m]}"></i>${copyLabel(m, ploidy)}</span>`).join('')}</div>`;
    }

    // a SNP between two haplotypes and the k windows that contain it
    function snpDiagram(k = 5) {
        const left = 'GATTCAGT', right = 'CCATGAAC', a = 'A', b = 'G';
        const hapA = left + a + right, hapB = left + b + right, snp = left.length, cw = 17, x0 = 120;
        const W = x0 + hapA.length * cw + 360, rows = k + 1, H = 70 + rows * 16 + 30;
        let s = `<svg class="km-diagram" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
        const seq = (str, y, label) => { let t = `<text x="${x0 - 10}" y="${y}" font-size="11" text-anchor="end" fill="#4a5568">${label}</text>`; for (let i = 0; i < str.length; i++) t += `<text x="${x0 + i * cw + cw / 2}" y="${y}" font-size="13" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="${i === snp ? 700 : 400}" fill="${i === snp ? '#b91c1c' : '#1f1e1b'}">${str[i]}</text>`; return t; };
        s += `<rect x="${x0 + snp * cw}" y="10" width="${cw}" height="46" fill="#fee2e2"/>`;
        s += seq(hapA, 28, 'haplotype 1') + seq(hapB, 48, 'haplotype 2');
        let y = 72;
        for (let st = 0; st + k <= hapA.length; st++) {
            const covers = st <= snp && snp < st + k;
            if (!covers && (st < snp - k - 1 || st > snp + 2)) continue;
            s += `<rect x="${x0 + st * cw + 1}" y="${y - 10}" width="${k * cw - 2}" height="12" rx="3" fill="${covers ? '#38bdf8' : '#4f46e5'}" opacity="${covers ? 0.85 : 0.5}"/>`;
            s += `<text x="${x0 + (st + k) * cw + 6}" y="${y}" font-size="10" fill="#4a5568">${covers ? `${hapA.substr(st, k)} / ${hapB.substr(st, k)} – two different k-mers, one per allele` : `${hapA.substr(st, k)} – the same in both haplotypes`}</text>`;
            y += 16;
        }
        s += `<text x="${x0}" y="${y + 12}" font-size="11" fill="#4a5568">k = ${k}: the ${k} windows that contain the SNP give ${k} k-mers per allele, each seen at half the depth.</text>`;
        return s.replace(`height="${H}"`, `height="${y + 22}"`).replace(`0 0 ${W} ${H}`, `0 0 ${W} ${y + 22}`) + '</svg>';
    }

    return { COPY_COLORS, fmt, copyLabel, histogram, legend, snpDiagram };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = KmerViews;
}
