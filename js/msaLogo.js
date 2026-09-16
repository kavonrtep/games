/**
 * SEQUENCE LOGO
 * =============
 * Renders MsaEngine column statistics as an SVG sequence logo: letters
 * stacked by frequency, total stack height = information content in bits.
 */
const MsaLogo = (() => {
    const COLORS = {
        // nucleotides
        A: '#16a34a', C: '#2563eb', G: '#ea580c', T: '#dc2626', U: '#dc2626',
        // amino acids by chemistry (WebLogo-like)
        R: '#2563eb', K: '#2563eb', H: '#2563eb',
        D: '#dc2626', E: '#dc2626',
        N: '#16a34a', Q: '#16a34a', S: '#16a34a', Y: '#16a34a',
        F: '#0f172a', W: '#0f172a', L: '#0f172a', I: '#0f172a', V: '#0f172a', M: '#0f172a', P: '#0f172a'
    };
    const AA_OVERRIDE = { A: '#0f172a', C: '#eab308', G: '#a16207', T: '#16a34a' };   // protein A, C, G, T differ from DNA

    function color(letter, type) {
        if (type === 'PROTEIN' && AA_OVERRIDE[letter]) return AA_OVERRIDE[letter];
        return COLORS[letter] || '#475569';
    }

    /**
     * stats: from MsaEngine.columnStats; returns an SVG string of width L*cellWidth.
     */
    function render(stats, type, opts = {}) {
        const o = Object.assign({ cellWidth: 20, height: 90, maxBits: stats.maxBits }, opts);
        const L = stats.columns.length, W = L * o.cellWidth, H = o.height;
        const scale = (H - 4) / o.maxBits;      // px per bit
        let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="logo-svg">`;
        // gridlines every bit
        for (let b = 1; b <= o.maxBits; b++) { const y = H - 2 - b * scale; s += `<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" stroke="#e2e8f0" stroke-width="1"/>`; }
        stats.columns.forEach((col, k) => {
            let y = H - 2;                 // baseline, letters stack upwards
            const x = k * o.cellWidth;
            for (const { a, h } of col.letters) {   // smallest first (bottom)
                const px = h * scale;
                if (px < 0.5) { y -= px; continue; }
                // a glyph drawn at font-size F has cap height ≈ 0.72 F; scale it to fill exactly px vertically and the cell horizontally
                const F = 20, capH = 0.72 * F, capW = 0.62 * F;
                const sy = px / capH, sx = (o.cellWidth - 2) / capW;
                s += `<text x="0" y="0" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="${F}" fill="${color(a, type)}" transform="translate(${(x + 1).toFixed(1)},${y.toFixed(2)}) scale(${sx.toFixed(3)},${sy.toFixed(3)})">${a}</text>`;
                y -= px;
            }
        });
        s += '</svg>';
        return s;
    }

    function axis(maxBits, height) {
        const H = height, scale = (H - 4) / maxBits;
        let s = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="${H}" class="logo-axis">`;
        s += `<line x1="36" y1="2" x2="36" y2="${H - 2}" stroke="#4a5568"/>`;
        for (let b = 0; b <= Math.floor(maxBits); b++) { const y = H - 2 - b * scale; s += `<line x1="32" y1="${y.toFixed(1)}" x2="36" y2="${y.toFixed(1)}" stroke="#4a5568"/><text x="29" y="${(y + 3).toFixed(1)}" font-size="9" text-anchor="end" fill="#4a5568">${b}</text>`; }
        s += `<text x="8" y="${H / 2}" font-size="9" fill="#4a5568" transform="rotate(-90 8 ${H / 2})" text-anchor="middle">bits</text></svg>`;
        return s;
    }

    return { render, axis, color };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MsaLogo;
}
