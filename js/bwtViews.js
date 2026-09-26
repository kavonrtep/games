/**
 * GENOME INDEX LAB – VIEWS
 * ========================
 * SVG for suffix tries/trees and HTML for the sorted-rotation matrix,
 * the suffix array and the Occ table.
 */
const BwtViews = (() => {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

    /**
     * Tree drawing. For a trie: node.ch is the edge label, node.children a Map. For a suffix tree: node.label is the
     * edge label, node.children an array. Leaves (suffix start) are drawn as boxes. `on`: Set of nodes on the search
     * path; `hitLeaves`: Set of leaf numbers to highlight.
     */
    function tree(root, opts = {}) {
        const o = Object.assign({ on: new Set(), hitLeaves: new Set(), levelH: 44, leafW: 34 }, opts);
        const kids = n => (n.children instanceof Map ? [...n.children.values()].sort((a, b) => (a.ch < b.ch ? -1 : 1)) : n.children);
        const lab = n => (n.children instanceof Map ? n.ch : n.label);
        // leaf order x, parent at the middle of its children
        let nextX = 0, maxDepth = 0;
        const place = (n, d) => {
            n._d = d; maxDepth = Math.max(maxDepth, d);
            const ch = kids(n);
            ch.forEach(c => place(c, d + 1));
            if (!ch.length) { n._x = nextX++; }
            else n._x = n.leaf !== null && n.leaf !== undefined ? (nextX++ , (ch[0]._x + nextX - 1) / 2) : (ch[0]._x + ch[ch.length - 1]._x) / 2;
        };
        place(root, 0);
        const W = Math.max(200, nextX * o.leafW + 40), H = (maxDepth + 1) * o.levelH + 50;
        const X = x => 20 + x * o.leafW + o.leafW / 2, Y = d => 20 + d * o.levelH;
        let s = `<svg class="bw-tree" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
        const draw = n => {
            for (const c of kids(n)) {
                const onEdge = o.on.has(c);
                s += `<line x1="${X(n._x)}" y1="${Y(n._d)}" x2="${X(c._x)}" y2="${Y(c._d)}" stroke="${onEdge ? '#dc2626' : '#a0aec0'}" stroke-width="${onEdge ? 3 : 1.4}"/>`;
                const l = lab(c);
                s += `<text x="${(X(n._x) + X(c._x)) / 2 + 4}" y="${(Y(n._d) + Y(c._d)) / 2 + 3}" font-size="${l.length > 1 ? 10 : 12}" font-family="JetBrains Mono, monospace" font-weight="600" fill="${onEdge ? '#b91c1c' : '#1f1e1b'}" paint-order="stroke" stroke="#fff" stroke-width="3">${esc(l)}</text>`;
                draw(c);
            }
            const isLeaf = n.leaf !== null && n.leaf !== undefined;
            if (isLeaf) {
                const hit = o.hitLeaves.has(n.leaf);
                s += `<rect x="${X(n._x) - 11}" y="${Y(n._d) - 9}" width="22" height="18" rx="3" fill="${hit ? '#16a34a' : '#fff'}" stroke="${hit ? '#16a34a' : '#4a5568'}"/><text x="${X(n._x)}" y="${Y(n._d) + 4}" font-size="10" text-anchor="middle" fill="${hit ? '#fff' : '#1f1e1b'}">${n.leaf}</text>`;
            } else s += `<circle cx="${X(n._x)}" cy="${Y(n._d)}" r="${n === root ? 6 : 4}" fill="${o.on.has(n) || n === root ? '#dc2626' : '#4a5568'}"/>`;
        };
        draw(root);
        return s + '</svg>';
    }

    /**
     * Sorted rotations as a matrix: row, SA, F … L. opts: { interval: [sp, ep), row (single highlighted row),
     * prefixLen (highlight the first letters in the interval), showMiddle }
     */
    function matrix(rots, opts = {}) {
        const o = Object.assign({ interval: null, row: null, prefixLen: 0, showMiddle: true, mark: null }, opts);
        const n = rots.length;
        let h = `<table class="bw-matrix"><tr><th>row</th><th>SA</th><th class="bw-F">F</th>${o.showMiddle ? `<th colspan="${n - 2}"></th>` : '<th>…</th>'}<th class="bw-L">L</th></tr>`;
        rots.forEach((r, i) => {
            const inI = o.interval && i >= o.interval[0] && i < o.interval[1];
            const cls = (inI ? 'bw-in ' : '') + (o.row === i ? 'bw-row ' : '') + (o.mark && o.mark.has(i) ? 'bw-mark' : '');
            const cells = r.rot.split('');
            h += `<tr class="${cls}"><td class="bw-rn">${i}</td><td class="bw-sa">${r.start}</td>`;
            h += `<td class="bw-F${inI && o.prefixLen > 0 ? ' bw-pre' : ''}">${cells[0]}</td>`;
            if (o.showMiddle) for (let k = 1; k < n - 1; k++) h += `<td class="${inI && k < o.prefixLen ? 'bw-pre' : 'bw-mid'}">${cells[k]}</td>`;
            else h += '<td class="bw-mid">…</td>';
            h += `<td class="bw-L">${cells[n - 1]}</td></tr>`;
        });
        return h + '</table>';
    }

    function occTable(fm, highlight = []) {
        const al = fm.alphabet;
        let h = `<table class="bw-occ"><tr><th>i</th><th>L[i]</th>${al.map(c => `<th>Occ(${c}, i)</th>`).join('')}</tr>`;
        for (let i = 0; i <= fm.n; i++) {
            const hl = highlight.includes(i);
            h += `<tr class="${hl ? 'bw-row' : ''}"><td>${i}</td><td class="bw-L">${i < fm.n ? fm.L[i] : ''}</td>${al.map(c => `<td>${fm.occ[i][c]}</td>`).join('')}</tr>`;
        }
        return h + '</table><p class="dp-hint">Occ(c, i) = number of c in L[0 … i−1] (the rows above row i).</p>';
    }

    return { tree, matrix, occTable, esc };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BwtViews;
}
