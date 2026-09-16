/**
 * ALIGNMENT QUIZ – QUESTION GENERATORS
 * ====================================
 * Seeded, self-checking questions about pairwise alignment. Every answer is
 * computed with AlignEngine from the generated sequences, so it is always
 * consistent with the parameters shown to the student.
 *
 * Question object:
 *  { type, level, skill, title, prompt, hint, explanation,
 *    s1, s2, params, local,
 *    workspace: { matrix: {values, arrows, optimal, mode}, editor: bool },
 *    answer: { kind: 'fill' } | { kind: 'fields', fields } | { kind: 'choice', options, correct }
 *          | { kind: 'align' }  (student's editor alignment must reach the optimum) }
 */
const AlignQuizGen = (() => {
    const E = AlignEngine;

    function hashString(str) {
        let h = 1779033703 ^ str.length;
        for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
        return h >>> 0;
    }
    class Rng {
        constructor(seed) {
            let a = (typeof seed === 'number' ? seed : hashString(String(seed))) >>> 0;
            this.next = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        }
        int(lo, hi) { return lo + Math.floor(this.next() * (hi - lo + 1)); }
        pick(a) { return a[Math.floor(this.next() * a.length)]; }
        chance(p) { return this.next() < p; }
        shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(this.next() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; }
        seq(len, alphabet = 'ACGT') { let s = ''; for (let k = 0; k < len; k++) s += alphabet[this.int(0, alphabet.length - 1)]; return s; }
    }
    function randomSeedString(rng) {
        return rng.pick(['NEEDLE', 'WATER', 'GOTOH', 'BLOSUM', 'GAP', 'TRACE', 'DIAG', 'MATRIX']) + '-' + rng.int(100, 999);
    }

    // ------------------------------------------------------------ helpers
    const simple = (match, mismatch, gap) => ({ type: 'DNA', gapModel: 'linear', gap, gapOpen: -4, gapExtend: -1, endGaps: 'penalized', substitution: { kind: 'simple', match, mismatch } });
    const affine = (open, ext) => ({ type: 'DNA', gapModel: 'affine', gap: -2, gapOpen: open, gapExtend: ext, endGaps: 'penalized', substitution: { kind: 'simple', match: 2, mismatch: -1 } });
    const describe = p => p.gapModel === 'affine'
        ? `match +${p.substitution.match}, mismatch ${p.substitution.mismatch}, gap open ${p.gapOpen}, gap extend ${p.gapExtend}`
        : `match +${p.substitution.match}, mismatch ${p.substitution.mismatch}, gap ${p.gap}${p.endGaps === 'free' ? ', free end gaps' : ''}`;
    const fmtAln = r => `<code>${r.aligned1}</code><br><code>${r.aligned2}</code>`;

    // a related pair: copy with a few substitutions and possibly an indel
    function relatedPair(rng, len, subs, indel) {
        const a = rng.seq(len);
        let b = a.split('');
        const used = new Set();
        while (used.size < subs) { const p = rng.int(0, len - 1); if (used.has(p)) continue; used.add(p); b[p] = 'ACGT'.replace(b[p], '')[rng.int(0, 2)]; }
        b = b.join('');
        if (indel > 0) {
            const at = rng.int(2, len - 2);
            if (rng.chance(0.5)) b = b.slice(0, at) + rng.seq(indel) + b.slice(at);
            else b = b.slice(0, at) + b.slice(at + indel);
        }
        return { s1: a, s2: b };
    }

    // ================================================================ level 1: fill the matrix
    function qFillGlobal(rng) {
        const { s1, s2 } = relatedPair(rng, rng.int(4, 5), 1, rng.chance(0.5) ? 1 : 0);
        const p = simple(rng.pick([1, 2, 3]), rng.pick([-1, -2]), rng.pick([-1, -2, -3]));
        const r = E.globalAlign(s1, s2, p);
        return {
            type: 'fill-global', level: 1, skill: 'matrix', title: 'Fill the Needleman–Wunsch matrix',
            prompt: `Fill every empty cell of the global-alignment matrix for <code>${s1}</code> vs <code>${s2}</code> with ${describe(p)}. Row 0 and column 0 are given.`,
            hint: 'Each cell = max( diagonal + match/mismatch, left + gap, above + gap ). Work row by row.',
            explanation: `The bottom-right cell is the optimal score, ${r.score}. Optimal alignment:<br>${fmtAln(r)}`,
            s1, s2, params: p, local: false,
            workspace: { matrix: { mode: 'fill' }, editor: false },
            answer: { kind: 'fill' }
        };
    }

    function qFillLocal(rng) {
        const s1 = rng.seq(rng.int(4, 5)), motif = rng.seq(3);
        const s2 = rng.seq(1) + motif + rng.seq(1);
        const s1m = s1.slice(0, rng.int(0, 1)) + motif + s1.slice(motif.length + 1);
        const p = simple(rng.pick([1, 2]), rng.pick([-1, -2]), rng.pick([-1, -2]));
        const r = E.localAlign(s1m, s2, p);
        return {
            type: 'fill-local', level: 1, skill: 'matrix', title: 'Fill the Smith–Waterman matrix',
            prompt: `Fill the local-alignment matrix for <code>${s1m}</code> vs <code>${s2}</code> with ${describe(p)}. Remember the extra option: a cell can never drop below 0.`,
            hint: 'Each cell = max( 0, diagonal + match/mismatch, left + gap, above + gap ). Row 0 and column 0 are all 0.',
            explanation: `The highest cell (${r.end.i}, ${r.end.j}) = ${r.score} is the best local score; trace back from it until a 0.<br>${fmtAln(r)}`,
            s1: s1m, s2, params: p, local: true,
            workspace: { matrix: { mode: 'fill' }, editor: false },
            answer: { kind: 'fill' }
        };
    }

    // ================================================================ level 2: read the matrix
    function qReadGlobal(rng) {
        let s1, s2, p, r;
        // only pairs with a unique optimal path, so "the" optimal alignment is well defined
        for (let attempt = 0; attempt < 50; attempt++) {
            ({ s1, s2 } = relatedPair(rng, rng.int(6, 8), 2, rng.chance(0.6) ? rng.int(1, 2) : 0));
            p = simple(2, -1, rng.pick([-1, -2, -3]));
            r = E.globalAlign(s1, s2, p);
            if (r.optimalPaths === 1) break;
        }
        const sc = E.scoreAlignment(r.aligned1, r.aligned2, p);
        return {
            type: 'read-global', level: 2, skill: 'reading', title: 'Read the global matrix',
            prompt: `The matrix for <code>${s1}</code> vs <code>${s2}</code> (${describe(p)}) is filled in, with traceback arrows. Read off the optimal score and follow the arrows back to (0, 0) to count how many gap symbols the optimal alignment contains.`,
            hint: 'Global alignment: the score is in the bottom-right cell. Each ← or ↑ step on the way back to (0,0) is one gap symbol.',
            explanation: `Score ${r.score}; the traceback ${fmtAln(r)} uses ${sc.gaps} gap symbol${sc.gaps === 1 ? '' : 's'}.`,
            s1, s2, params: p, local: false,
            workspace: { matrix: { mode: 'full', values: true, arrows: true, optimal: false }, editor: false },
            answer: { kind: 'fields', fields: [
                { key: 'score', label: 'Optimal score', kind: 'number', answer: r.score, tolerance: 0 },
                { key: 'gaps', label: 'Gap symbols in the optimal alignment', kind: 'number', answer: sc.gaps, tolerance: 0 }] }
        };
    }

    function qReadLocal(rng) {
        const motif = rng.seq(rng.int(4, 6));
        const s1 = rng.seq(rng.int(1, 3)) + motif + rng.seq(rng.int(1, 3));
        const s2 = rng.seq(rng.int(1, 3)) + motif + rng.seq(rng.int(1, 3));
        const p = simple(2, rng.pick([-1, -2, -3]), rng.pick([-2, -3]));
        const r = E.localAlign(s1, s2, p);
        return {
            type: 'read-local', level: 2, skill: 'reading', title: 'Read the local matrix',
            prompt: `The Smith–Waterman matrix for <code>${s1}</code> vs <code>${s2}</code> (${describe(p)}) is filled in. Give the best local score and the cell (i, j) where its traceback starts.`,
            hint: 'The traceback starts at the highest value in the whole matrix – not necessarily the bottom-right corner.',
            explanation: `Maximum ${r.score} at cell (${r.end.i}, ${r.end.j}); tracing back to the first 0 gives ${fmtAln(r)} (Seq 1 ${r.s1Start}–${r.s1End}, Seq 2 ${r.s2Start}–${r.s2End}).`,
            s1, s2, params: p, local: true,
            workspace: { matrix: { mode: 'full', values: true, arrows: false, optimal: false }, editor: false },
            answer: { kind: 'fields', fields: [
                { key: 'score', label: 'Best local score', kind: 'number', answer: r.score, tolerance: 0 },
                { key: 'i', label: 'i (column, Seq 1 position) of the maximum', kind: 'number', answer: r.end.i, tolerance: 0 },
                { key: 'j', label: 'j (row, Seq 2 position) of the maximum', kind: 'number', answer: r.end.j, tolerance: 0 }] }
        };
    }

    // ================================================================ level 3: traceback
    function qTracebackChoice(rng) {
        for (let attempt = 0; attempt < 30; attempt++) {
            const { s1, s2 } = relatedPair(rng, rng.int(6, 8), 1, 1);
            const p = simple(2, -1, rng.pick([-1, -2]));
            const r = E.globalAlign(s1, s2, p);
            // distractors: shift one gap by one position / move it to the end
            const variants = new Set();
            const a1 = r.aligned1, a2 = r.aligned2;
            const shift = (s, k, d) => { const c = s.split(''); if (c[k] === '-' && c[k + d] !== undefined && c[k + d] !== '-') { [c[k], c[k + d]] = [c[k + d], c[k]]; return c.join(''); } return null; };
            for (let k = 0; k < a1.length; k++) for (const d of [-1, 1, -2, 2]) {
                const v1 = shift(a1, k, d); if (v1) variants.add(v1 + '|' + a2);
                const v2 = shift(a2, k, d); if (v2) variants.add(a1 + '|' + v2);
            }
            // also an ungapped alternative
            const n = Math.max(s1.length, s2.length);
            variants.add(s1.padEnd(n, '-') + '|' + s2.padEnd(n, '-'));
            const bad = [...variants].map(v => v.split('|')).filter(([x, y]) => x.length === y.length && !(x[x.length - 1] === '-' && y[y.length - 1] === '-') && E.scoreAlignment(x, y, p).total < r.score);
            if (bad.length < 2) continue;
            const chosen = rng.shuffle(bad).slice(0, 2);
            const opts = rng.shuffle([{ a: [a1, a2], ok: true }, ...chosen.map(c => ({ a: c, ok: false }))]);
            return {
                type: 'traceback-choice', level: 3, skill: 'traceback', title: 'Which alignment does the traceback give?',
                prompt: `The matrix for <code>${s1}</code> vs <code>${s2}</code> (${describe(p)}) is shown with arrows. Exactly one of the alignments below is optimal. Which?`,
                hint: 'Score each candidate column by column, or follow the arrows from the bottom-right cell and write down the moves.',
                explanation: `Optimal (score ${r.score}):<br>${fmtAln(r)}<br>The other candidates score ${chosen.map(c => E.scoreAlignment(c[0], c[1], p).total).join(' and ')}.`,
                s1, s2, params: p, local: false,
                workspace: { matrix: { mode: 'full', values: true, arrows: true, optimal: false }, editor: false },
                answer: { kind: 'choice', options: opts.map(o => `<code>${o.a[0]}</code><br><code>${o.a[1]}</code>`), correct: opts.findIndex(o => o.ok) }
            };
        }
        return qReadGlobal(rng);
    }

    function qCooptimal(rng) {
        for (let attempt = 0; attempt < 40; attempt++) {
            const { s1, s2 } = relatedPair(rng, rng.int(5, 7), rng.int(0, 1), 1);
            const p = simple(2, -1, -2);
            const r = E.globalAlign(s1, s2, p);
            if (r.optimalPaths < 2 || r.optimalPaths > 6) continue;
            return {
                type: 'cooptimal', level: 3, skill: 'traceback', title: 'Count the co-optimal alignments',
                prompt: `The matrix for <code>${s1}</code> vs <code>${s2}</code> (${describe(p)}) is filled with all traceback arrows. How many different alignments reach the optimal score?`,
                hint: 'Start at the bottom-right cell and follow arrows backwards; every cell on the way with two arrows that both lead to (0,0) doubles the number of paths. Count the distinct paths.',
                explanation: `${r.optimalPaths} optimal alignments. One of them:<br>${fmtAln(r)}<br>Traceback programs pick one by an arbitrary tie-break rule – the others are equally good.`,
                s1, s2, params: p, local: false,
                workspace: { matrix: { mode: 'full', values: true, arrows: true, optimal: false }, editor: false },
                answer: { kind: 'fields', fields: [{ key: 'n', label: 'Number of optimal alignments', kind: 'number', answer: r.optimalPaths, tolerance: 0 }] }
            };
        }
        return qReadGlobal(rng);
    }

    // ================================================================ level 4: build an alignment
    function qBuildGlobal(rng) {
        const { s1, s2 } = relatedPair(rng, rng.int(8, 11), rng.int(1, 3), rng.int(1, 3));
        const p = rng.chance(0.4) ? affine(rng.pick([-3, -4, -5]), -1) : simple(2, -1, rng.pick([-1, -2, -3]));
        const r = E.globalAlign(s1, s2, p);
        return {
            type: 'build-global', level: 4, skill: 'building', title: 'Build an optimal global alignment',
            prompt: `Use the editor to align <code>${s1}</code> and <code>${s2}</code> optimally with ${describe(p)}. The matrix is shown without arrows – you can read the values to guide you. Press Check when your score equals the optimum.`,
            hint: 'The optimum is the bottom-right value. Work backwards from there: at each cell decide whether the value came from the diagonal (align residues) or from the left/above (a gap).',
            explanation: `Optimal score ${r.score}, e.g.<br>${fmtAln(r)}${r.optimalPaths > 1 ? `<br>(${r.optimalPaths} alignments share this score.)` : ''}`,
            s1, s2, params: p, local: false,
            workspace: { matrix: { mode: 'full', values: true, arrows: false, optimal: false }, editor: true },
            answer: { kind: 'align', target: r.score }
        };
    }

    function qBuildLocal(rng) {
        const motif = rng.seq(rng.int(6, 8));
        const m2 = motif.split(''); m2[rng.int(1, motif.length - 2)] = 'ACGT'.replace(m2[rng.int(1, motif.length - 2)], '')[0];
        const s1 = rng.seq(rng.int(3, 6)) + motif + rng.seq(rng.int(3, 6));
        const s2 = rng.seq(rng.int(3, 6)) + m2.join('') + rng.seq(rng.int(3, 6));
        const p = simple(2, -1, -2);
        const r = E.localAlign(s1, s2, p);
        return {
            type: 'build-local', level: 4, skill: 'building', title: 'Mark the best local alignment',
            prompt: `<code>${s1}</code> and <code>${s2}</code> share a diverged motif. In the editor, shift Seq 2 with gaps so the motifs line up, then mark the start and end of the best local alignment with <kbd>[</kbd> and <kbd>]</kbd>. Check when the selected region scores the best local score (${describe(p)}).`,
            hint: 'Find the highest value in the matrix; the local alignment ends there. Include only columns that raise the score – stop before mismatches at either end.',
            explanation: `Best local score ${r.score}: Seq 1 ${r.s1Start}–${r.s1End} vs Seq 2 ${r.s2Start}–${r.s2End}<br>${fmtAln(r)}`,
            s1, s2, params: p, local: true,
            workspace: { matrix: { mode: 'full', values: true, arrows: false, optimal: false }, editor: true },
            answer: { kind: 'align', target: r.score }
        };
    }

    // ================================================================ level 5: parameters
    function qGapEffect(rng) {
        for (let attempt = 0; attempt < 30; attempt++) {
            const { s1, s2 } = relatedPair(rng, rng.int(7, 9), rng.int(1, 2), rng.int(1, 2));
            const g1 = rng.pick([-1, -2]), g2 = rng.pick([-3, -4, -5]);
            const p1 = simple(2, -1, g1), p2 = simple(2, -1, g2);
            const r1 = E.globalAlign(s1, s2, p1), r2 = E.globalAlign(s1, s2, p2);
            const gaps1 = E.scoreAlignment(r1.aligned1, r1.aligned2, p1).gaps, gaps2 = E.scoreAlignment(r2.aligned1, r2.aligned2, p2).gaps;
            if (gaps1 === gaps2) continue;
            return {
                type: 'gap-effect', level: 5, skill: 'parameters', title: 'Effect of the gap penalty',
                prompt: `For <code>${s1}</code> vs <code>${s2}</code> (match +2, mismatch −1) the matrix is shown for gap ${g1}. Predict what happens when the gap penalty becomes ${g2}: give the new optimal score and say whether the optimal alignment uses more, fewer or the same number of gap symbols.`,
                hint: 'A harsher gap penalty makes mismatches relatively cheaper. Recompute mentally which is better: the gapped alignment at the new price, or an alignment with fewer gaps and more mismatches.',
                explanation: `Gap ${g1}: score ${r1.score}, ${gaps1} gap symbols ${fmtAln(r1)}<br>Gap ${g2}: score ${r2.score}, ${gaps2} gap symbols ${fmtAln(r2)}`,
                s1, s2, params: p1, local: false,
                workspace: { matrix: { mode: 'full', values: true, arrows: true, optimal: false }, editor: false },
                answer: { kind: 'fields', fields: [
                    { key: 'score', label: `Optimal score with gap ${g2}`, kind: 'number', answer: r2.score, tolerance: 0 },
                    { key: 'gaps', label: 'Number of gap symbols compared with now', kind: 'choice', options: ['more', 'fewer', 'the same'], answer: gaps2 > gaps1 ? 0 : gaps2 < gaps1 ? 1 : 2 }] }
            };
        }
        return qAffineCost(rng);
    }

    function qAffineCost(rng) {
        const open = rng.pick([-3, -4, -5, -6, -8, -10]), ext = rng.pick([-1, -2]), k = rng.int(2, 7);
        const cost = E.gapCost({ gapModel: 'affine', gapOpen: open, gapExtend: ext }, k);
        const two = 2 * E.gapCost({ gapModel: 'affine', gapOpen: open, gapExtend: ext }, Math.ceil(k / 2)) - (k % 2 ? 0 : 0);
        const split = E.gapCost({ gapModel: 'affine', gapOpen: open, gapExtend: ext }, Math.floor(k / 2)) + E.gapCost({ gapModel: 'affine', gapOpen: open, gapExtend: ext }, Math.ceil(k / 2));
        const { s1, s2 } = relatedPair(rng, 8, 1, 3);
        return {
            type: 'affine-cost', level: 5, skill: 'parameters', title: 'Affine gap costs',
            prompt: `With affine gap penalties (open ${open} for the first gap symbol, extend ${ext} for each further one), what does a single gap of length ${k} cost? And what would the same ${k} gap symbols cost if they were split into two separate gaps of ${Math.floor(k / 2)} and ${Math.ceil(k / 2)}?`,
            hint: 'gap of length k = open + (k − 1) × extend. Two gaps pay the opening cost twice.',
            explanation: `One gap: ${open} + ${k - 1} × (${ext}) = ${cost}. Two gaps: ${split}. This is why affine penalties favour one long gap over several short ones – one biological insertion event, one opening cost.`,
            s1, s2, params: affine(open, ext), local: false,
            workspace: { matrix: { mode: 'full', values: true, arrows: false, optimal: true }, editor: false },
            answer: { kind: 'fields', fields: [
                { key: 'one', label: `Cost of one gap of length ${k}`, kind: 'number', answer: cost, tolerance: 0 },
                { key: 'two', label: 'Cost when split into two gaps', kind: 'number', answer: split, tolerance: 0 }] }
        };
    }

    function qEndGaps(rng) {
        const core = rng.seq(rng.int(8, 10));
        const s1 = rng.seq(rng.int(3, 5)) + core, s2 = core + rng.seq(rng.int(3, 5));
        const p = simple(2, -1, -2), pf = Object.assign({}, p, { endGaps: 'free' });
        const r = E.globalAlign(s1, s2, p), rf = E.globalAlign(s1, s2, pf);
        return {
            type: 'end-gaps', level: 5, skill: 'parameters', title: 'Free end gaps',
            prompt: `<code>${s1}</code> and <code>${s2}</code> overlap: the end of Seq 1 is the start of Seq 2. The matrix shows the standard global alignment (${describe(p)}). What is the optimal score when terminal gaps are free (semi-global alignment)? And with the usual penalised end gaps?`,
            hint: 'With free end gaps only the overlapping columns count: matches × 2. With penalised end gaps every overhang position costs the gap penalty.',
            explanation: `Free end gaps: ${rf.score} ${fmtAln(rf)}<br>Penalised: ${r.score} ${fmtAln(r)}<br>Overlap detection, read mapping and primer alignment all use free end gaps for this reason.`,
            s1, s2, params: p, local: false,
            workspace: { matrix: { mode: 'full', values: true, arrows: false, optimal: true }, editor: false },
            answer: { kind: 'fields', fields: [
                { key: 'free', label: 'Optimal score with free end gaps', kind: 'number', answer: rf.score, tolerance: 0 },
                { key: 'pen', label: 'Optimal score with penalised end gaps', kind: 'number', answer: r.score, tolerance: 0 }] }
        };
    }

    // ================================================================ level 6: local vs global, protein
    function qLocalVsGlobal(rng) {
        const motif = rng.seq(rng.int(7, 9));
        const s1 = rng.seq(rng.int(6, 9)) + motif + rng.seq(rng.int(2, 4));
        const s2 = rng.seq(rng.int(2, 4)) + motif + rng.seq(rng.int(6, 9));
        const p = simple(2, -1, -2);
        const g = E.globalAlign(s1, s2, p), l = E.localAlign(s1, s2, p);
        return {
            type: 'local-vs-global', level: 6, skill: 'interpretation', title: 'Local or global?',
            prompt: `<code>${s1}</code> and <code>${s2}</code> share one motif embedded in unrelated flanks (${describe(p)}). The global matrix is shown. Give the optimal global score and the best local score, and decide which method reports the shared motif cleanly.`,
            hint: 'Global alignment must align the unrelated flanks too and pays for it; local alignment simply ignores them.',
            explanation: `Global: ${g.score} ${fmtAln(g)}<br>Local: ${l.score} ${fmtAln(l)}<br>The local alignment is exactly the motif; the global one is dominated by the cost of the flanks.`,
            s1, s2, params: p, local: false,
            workspace: { matrix: { mode: 'full', values: true, arrows: false, optimal: false }, editor: false },
            answer: { kind: 'fields', fields: [
                { key: 'g', label: 'Optimal global score', kind: 'number', answer: g.score, tolerance: 0 },
                { key: 'l', label: 'Best local score', kind: 'number', answer: l.score, tolerance: 0 },
                { key: 'which', label: 'Which method isolates the shared motif?', kind: 'choice', options: ['Local (Smith–Waterman)', 'Global (Needleman–Wunsch)'], answer: 0 }] }
        };
    }

    function qProtein(rng) {
        const pairs = [['W', 'W'], ['W', 'G'], ['I', 'V'], ['L', 'V'], ['K', 'R'], ['D', 'E'], ['C', 'C'], ['P', 'P'], ['F', 'Y'], ['A', 'S'], ['N', 'D'], ['H', 'H'], ['G', 'P'], ['E', 'Q']];
        const chosen = rng.shuffle(pairs).slice(0, 3);
        const s1 = 'HEAGAWGHEE', s2 = 'PAWHEAE';
        const p = { type: 'PROTEIN', gapModel: 'linear', gap: -8, gapOpen: -10, gapExtend: -1, endGaps: 'penalized', substitution: { kind: 'blosum62' } };
        const r = E.globalAlign(s1, s2, p);
        const scoreOf = ([a, b]) => E.subScore(p, a, b);
        const best = chosen.reduce((m, x) => scoreOf(x) > scoreOf(m) ? x : m, chosen[0]);
        return {
            type: 'protein-blosum', level: 6, skill: 'interpretation', title: 'Reading BLOSUM62',
            prompt: `Protein alignments use a substitution matrix instead of match/mismatch. Look up the BLOSUM62 scores for ${chosen.map(x => `${x[0]}↔${x[1]}`).join(', ')} (a BLOSUM62 table is shown under the matrix) and decide which pair is the strongest evidence of homology. The matrix shows the textbook pair HEAGAWGHEE / PAWHEAE with gap −8.`,
            hint: 'Identical rare residues (W, C) score highest; exchanges between chemically similar residues (I/V, K/R, D/E) score slightly positive; dissimilar pairs are negative.',
            explanation: `${chosen.map(x => `${x[0]}/${x[1]} = ${scoreOf(x)}`).join(', ')}. Highest: ${best[0]}/${best[1]}. Optimal alignment of the textbook pair: ${fmtAln(r)} (score ${r.score}).`,
            s1, s2, params: p, local: false, showBlosum: true,
            workspace: { matrix: { mode: 'full', values: true, arrows: true, optimal: true }, editor: false },
            answer: { kind: 'fields', fields: chosen.map((x, k) => ({ key: 'p' + k, label: `BLOSUM62 score ${x[0]}↔${x[1]}`, kind: 'number', answer: scoreOf(x), tolerance: 0 }))
                .concat([{ key: 'best', label: 'Strongest evidence of homology', kind: 'choice', options: chosen.map(x => `${x[0]}↔${x[1]}`), answer: chosen.indexOf(best) }]) }
        };
    }

    // ------------------------------------------------------------ catalogue
    const TYPES = {
        'fill-global':      { level: 1, skill: 'matrix', name: 'Fill the Needleman–Wunsch matrix', gen: qFillGlobal },
        'fill-local':       { level: 1, skill: 'matrix', name: 'Fill the Smith–Waterman matrix', gen: qFillLocal },
        'read-global':      { level: 2, skill: 'reading', name: 'Read the global matrix', gen: qReadGlobal },
        'read-local':       { level: 2, skill: 'reading', name: 'Read the local matrix', gen: qReadLocal },
        'traceback-choice': { level: 3, skill: 'traceback', name: 'Which alignment is the traceback?', gen: qTracebackChoice },
        'cooptimal':        { level: 3, skill: 'traceback', name: 'Count co-optimal alignments', gen: qCooptimal },
        'build-global':     { level: 4, skill: 'building', name: 'Build an optimal global alignment', gen: qBuildGlobal },
        'build-local':      { level: 4, skill: 'building', name: 'Mark the best local alignment', gen: qBuildLocal },
        'gap-effect':       { level: 5, skill: 'parameters', name: 'Effect of the gap penalty', gen: qGapEffect },
        'affine-cost':      { level: 5, skill: 'parameters', name: 'Affine gap costs', gen: qAffineCost },
        'end-gaps':         { level: 5, skill: 'parameters', name: 'Free end gaps', gen: qEndGaps },
        'local-vs-global':  { level: 6, skill: 'interpretation', name: 'Local or global?', gen: qLocalVsGlobal },
        'protein-blosum':   { level: 6, skill: 'interpretation', name: 'Reading BLOSUM62', gen: qProtein }
    };
    const SKILLS = {
        matrix: 'Filling the matrix', reading: 'Reading the matrix', traceback: 'Traceback and ties',
        building: 'Building alignments', parameters: 'Parameters', interpretation: 'Choosing the method'
    };

    function generate(type, rng) { const q = TYPES[type].gen(rng); q.type = q.type || type; return q; }
    function sessionPlan(rng) {
        const plan = [];
        for (let level = 1; level <= 6; level++) {
            const types = Object.keys(TYPES).filter(t => TYPES[t].level === level);
            const picked = rng.shuffle(types).slice(0, 2);
            while (picked.length < 2) picked.push(rng.pick(types));
            plan.push(...picked);
        }
        return plan;
    }

    return { Rng, TYPES, SKILLS, generate, sessionPlan, randomSeedString };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AlignQuizGen;
}
