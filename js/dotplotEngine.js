/**
 * DOTPLOT ENGINE
 * ==============
 * Pure computation for the dotplot trainer – no DOM access, so it can be
 * unit-tested in Node (see the module.exports guard at the bottom).
 *
 * Two dot-placing modes are supported:
 *
 *  'runlength'  – every base-to-base identity is a candidate dot; dots are
 *                 kept only if they lie on a diagonal run of >= minRun
 *                 consecutive identities. (Equivalent to plotting all exact
 *                 word matches of length minRun and drawing the whole run.)
 *
 *  'window'     – classic sliding-window dotplot (EMBOSS dotmatcher style):
 *                 a window of `window` bases is slid along every diagonal and
 *                 a dot is placed at the window centre when the number of
 *                 identities in the window is >= `threshold`. Dots may
 *                 therefore sit on mismatched bases; those are flagged so the
 *                 renderer can draw them hollow.
 *
 * Matrix cell values: 0 = no dot, 1 = dot on an identity, 2 = dot on a mismatch.
 * Coordinates are 0-based; i indexes seq1 (x axis), j indexes the compared
 * sequence (seq2 for forward, reverse complement of seq2 for reverse).
 */

const DotplotEngine = (() => {
    const COMPLEMENT = { A: 'T', T: 'A', G: 'C', C: 'G' };

    function cleanSequence(text) {
        return (text || '').toUpperCase().replace(/[^ATGC]/g, '');
    }

    function reverseComplement(seq) {
        let out = '';
        for (let i = seq.length - 1; i >= 0; i--) out += COMPLEMENT[seq[i]] || seq[i];
        return out;
    }

    function complement(seq) {
        let out = '';
        for (let i = 0; i < seq.length; i++) out += COMPLEMENT[seq[i]] || seq[i];
        return out;
    }

    // Fisher–Yates shuffle – preserves base composition, destroys order.
    function shuffle(seq) {
        const a = seq.split('');
        for (let i = a.length - 1; i > 0; i--) {
            const k = Math.floor(Math.random() * (i + 1));
            [a[i], a[k]] = [a[k], a[i]];
        }
        return a.join('');
    }

    function randomSequence(length) {
        const bases = 'ATGC';
        let s = '';
        for (let i = 0; i < length; i++) s += bases[Math.floor(Math.random() * 4)];
        return s;
    }

    function normalizeParams(p) {
        const params = Object.assign({ mode: 'runlength', minRun: 3, window: 9, threshold: 6 }, p || {});
        params.minRun = Math.max(1, Math.floor(params.minRun));
        params.window = Math.max(1, Math.floor(params.window));
        params.threshold = Math.min(params.window, Math.max(1, Math.floor(params.threshold)));
        return params;
    }

    /**
     * Compare a against b (both already cleaned). Returns
     * { matrix: Uint8Array(n*m), segments: [{i, j, len, matches, mismatches}] }
     * where segments are maximal diagonal runs of dots, in a/b coordinates.
     */
    function compare(a, b, params) {
        const n = a.length, m = b.length;
        const matrix = new Uint8Array(n * m);
        const segments = [];
        if (n === 0 || m === 0) return { matrix, segments };

        const w = params.mode === 'window' ? params.window : params.minRun;
        // Walk every diagonal: d = i - j, from (i0, j0) downwards-right.
        for (let d = -(m - 1); d <= n - 1; d++) {
            const i0 = Math.max(0, d), j0 = Math.max(0, -d);
            const len = Math.min(n - i0, m - j0);
            if (len < w) continue;

            // identity[k] along this diagonal
            const ident = new Uint8Array(len);
            for (let k = 0; k < len; k++) ident[k] = a[i0 + k] === b[j0 + k] ? 1 : 0;

            const dot = new Uint8Array(len);
            if (params.mode === 'window') {
                const centre = Math.floor(w / 2);
                let count = 0;
                for (let k = 0; k < w; k++) count += ident[k];
                for (let start = 0; start + w <= len; start++) {
                    if (start > 0) count += ident[start + w - 1] - ident[start - 1];
                    if (count >= params.threshold) dot[start + centre] = 1;
                }
            } else {
                let k = 0;
                while (k < len) {
                    if (!ident[k]) { k++; continue; }
                    let e = k;
                    while (e < len && ident[e]) e++;
                    if (e - k >= w) for (let q = k; q < e; q++) dot[q] = 1;
                    k = e;
                }
            }

            // Write dots into the matrix and collect runs of consecutive dots.
            let k = 0;
            while (k < len) {
                if (!dot[k]) { k++; continue; }
                let e = k, matches = 0;
                while (e < len && dot[e]) {
                    matrix[(j0 + e) * n + (i0 + e)] = ident[e] ? 1 : 2;
                    matches += ident[e];
                    e++;
                }
                segments.push({ i: i0 + k, j: j0 + k, len: e - k, matches, mismatches: e - k - matches });
                k = e;
            }
        }
        return { matrix, segments };
    }

    /**
     * Convert a segment from comparison coordinates to 1-based inclusive
     * coordinates on the ORIGINAL sequences. For reverse segments the
     * compared sequence is the reverse complement of seq2, so j has to be
     * flipped: original index = m - 1 - j.
     */
    function segmentToOriginal(seg, m, reverse) {
        const s1Start = seg.i + 1, s1End = seg.i + seg.len;
        if (!reverse) return { s1Start, s1End, s2Start: seg.j + 1, s2End: seg.j + seg.len };
        // On the rc strand the run covers rc positions j .. j+len-1, which are
        // original positions m-1-(j+len-1) .. m-1-j (ascending).
        return { s1Start, s1End, s2Start: m - seg.j - seg.len + 1, s2End: m - seg.j };
    }

    // Binomial tail: P(X >= t) for X ~ Bin(w, 1/4)
    function binomialTail(w, t, p = 0.25) {
        let prob = 0;
        for (let s = t; s <= w; s++) {
            let c = 1;
            for (let k = 1; k <= s; k++) c = c * (w - s + k) / k;
            prob += c * Math.pow(p, s) * Math.pow(1 - p, w - s);
        }
        return prob;
    }

    /**
     * How many dots / word hits would two RANDOM sequences of these lengths
     * produce under the current parameters (per strand)?
     */
    function expectedRandom(n, m, params) {
        if (params.mode === 'window') {
            const w = params.window;
            if (n < w || m < w) return { label: 'dots', value: 0 };
            return { label: 'dots', value: (n - w + 1) * (m - w + 1) * binomialTail(w, params.threshold) };
        }
        const k = params.minRun;
        if (n < k || m < k) return { label: `${k}-mer matches`, value: 0 };
        return { label: `${k}-mer matches`, value: (n - k + 1) * (m - k + 1) / Math.pow(4, k) };
    }

    // Observed quantity comparable to expectedRandom(): dots in window mode,
    // number of k-mer matches (a run of length R contains R-k+1 k-mers) otherwise.
    function observedComparable(segments, params) {
        if (params.mode === 'window') return segments.reduce((s, seg) => s + seg.len, 0);
        const k = params.minRun;
        return segments.reduce((s, seg) => s + Math.max(0, seg.len - k + 1), 0);
    }

    function summarize(segments) {
        let dots = 0, longest = 0;
        for (const seg of segments) { dots += seg.len; if (seg.len > longest) longest = seg.len; }
        return { dots, segments: segments.length, longest };
    }

    /**
     * Main entry point.
     * Returns { seq1, seq2, seq2rc, n, m, params, forward, reverse, stats }
     */
    function computeDotplot(rawSeq1, rawSeq2, rawParams) {
        const params = normalizeParams(rawParams);
        const seq1 = cleanSequence(rawSeq1);
        const seq2 = cleanSequence(rawSeq2);
        const seq2rc = reverseComplement(seq2);
        const n = seq1.length, m = seq2.length;

        const forward = compare(seq1, seq2, params);
        const reverse = compare(seq1, seq2rc, params);

        const expected = expectedRandom(n, m, params);
        const stats = {
            n, m, params,
            forward: summarize(forward.segments),
            reverse: summarize(reverse.segments),
            expectedLabel: expected.label,
            expectedPerStrand: expected.value,
            observedForward: observedComparable(forward.segments, params),
            observedReverse: observedComparable(reverse.segments, params)
        };
        return { seq1, seq2, seq2rc, n, m, params, forward, reverse, stats };
    }

    /**
     * Alignment blocks = diagonal segments at least minLen long, in original
     * coordinates, longest first. identity is computed from the real bases.
     */
    function findBlocks(result, minLen) {
        const blocks = [];
        const add = (segs, reverse) => {
            for (const seg of segs) {
                if (seg.len < minLen) continue;
                const coords = segmentToOriginal(seg, result.m, reverse);
                blocks.push(Object.assign({
                    reverse,
                    len: seg.len,
                    matches: seg.matches,
                    mismatches: seg.mismatches,
                    identity: seg.matches / seg.len,
                    seg
                }, coords));
            }
        };
        add(result.forward.segments, false);
        add(result.reverse.segments, true);
        blocks.sort((a, b) => b.len - a.len || a.s1Start - b.s1Start);
        blocks.forEach((b, idx) => { b.index = idx; });
        return blocks;
    }

    return {
        cleanSequence, reverseComplement, complement, shuffle, randomSequence,
        normalizeParams, computeDotplot, findBlocks, segmentToOriginal,
        expectedRandom, binomialTail
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DotplotEngine;
}
