/**
 * DOTPLOT QUIZ – QUESTION GENERATORS
 * ==================================
 * Every question is built from seeded random sequences with planted events,
 * so the correct answer is known by construction. After construction the
 * pair is checked with DotplotEngine: if chance produced an unplanned
 * diagonal that could confuse the question, the pair is regenerated.
 *
 * A question object:
 *  {
 *    type, level (1–6), skill, title, prompt (html), hint, explanation (html),
 *    seq1, seq2, self, params, showSeq: {seq1, seq2}, allowParams,
 *    answer: one of
 *      { kind: 'multi',  options: [{key,label}], correct: [keys] }
 *      { kind: 'choice', options: [labels], correct: index }
 *      { kind: 'fields', fields: [{key,label,kind:'number'|'choice',answer,tolerance?,options?}] }
 *      { kind: 'params', grade: params => {ok, score, message} }
 *      { kind: 'cells',  correct: [[i,j],...] }          (0-based, forward strand)
 *    overlays: [{s1:[a,b], s2:[c,d], color?, label?}]   (1-based, shown after answering)
 *  }
 */
const DotplotQuizGen = (() => {
    const E = DotplotEngine;

    // ------------------------------------------------------------ seeded RNG
    function hashString(str) {
        let h = 1779033703 ^ str.length;
        for (let i = 0; i < str.length; i++) {
            h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
            h = (h << 13) | (h >>> 19);
        }
        return h >>> 0;
    }

    class Rng {
        constructor(seed) {
            let a = (typeof seed === 'number' ? seed : hashString(String(seed))) >>> 0;
            this.next = () => {                       // mulberry32
                a = (a + 0x6D2B79F5) | 0;
                let t = Math.imul(a ^ (a >>> 15), 1 | a);
                t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
        }
        int(lo, hi) { return lo + Math.floor(this.next() * (hi - lo + 1)); }
        pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
        chance(p) { return this.next() < p; }
        shuffle(arr) {
            const a = arr.slice();
            for (let i = a.length - 1; i > 0; i--) {
                const k = Math.floor(this.next() * (i + 1));
                [a[i], a[k]] = [a[k], a[i]];
            }
            return a;
        }
        seq(len) { let s = ''; for (let i = 0; i < len; i++) s += 'ACGT'[this.int(0, 3)]; return s; }
    }

    function randomSeedString(rng) {
        const words = ['ALU', 'LINE', 'SINE', 'LTR', 'GYPSY', 'COPIA', 'MITE', 'HELITRON', 'TY1', 'MULE', 'CACTA', 'PIF'];
        return rng.pick(words) + '-' + rng.int(100, 999);
    }

    // ------------------------------------------------------------ sequence helpers
    // Random sequence without internal repeats >= k (same or opposite strand).
    function cleanRandom(rng, len, k = 6) {
        for (let attempt = 0; attempt < 30; attempt++) {
            const s = rng.seq(len);
            if (len < k) return s;
            const r = E.computeDotplot(s, s, { mode: 'runlength', minRun: k });
            const off = r.forward.segments.filter(seg => seg.i !== seg.j).length + r.reverse.segments.length;
            if (off === 0) return s;
        }
        return rng.seq(len);
    }

    // Substitutions at `count` positions, at least `gap` apart and away from the ends.
    function mutate(rng, seq, count, gap = 1, edge = 0) {
        const a = seq.split('');
        const positions = [];
        let guard = 0;
        while (positions.length < count && guard++ < 500) {
            const p = rng.int(edge, a.length - 1 - edge);
            if (positions.some(q => Math.abs(q - p) < gap)) continue;
            positions.push(p);
            a[p] = 'ACGT'.replace(a[p], '')[rng.int(0, 2)];
        }
        positions.sort((x, y) => x - y);
        return { seq: a.join(''), positions };
    }

    /**
     * Build a sequence pair chunk by chunk. Each chunk spec becomes a feature
     * with 1-based ranges on both sequences.
     */
    function compose(rng, plan) {
        let s1 = '', s2 = '';
        const features = [];
        for (const spec of plan) {
            const a1 = s1.length, a2 = s2.length;
            let p1, p2, extra = {};
            switch (spec.type) {
                case 'flank':
                    p1 = p2 = cleanRandom(rng, spec.len); break;
                case 'inversion':
                    p1 = cleanRandom(rng, spec.len); p2 = E.reverseComplement(p1); break;
                case 'insertion': {
                    const base = cleanRandom(rng, spec.len);
                    const ins = cleanRandom(rng, spec.insLen);
                    const at = rng.int(Math.floor(spec.len * 0.35), Math.floor(spec.len * 0.65));
                    const longer = base.slice(0, at) + ins + base.slice(at);
                    if (spec.inSeq === 1) { p1 = longer; p2 = base; } else { p1 = base; p2 = longer; }
                    extra = { insLen: spec.insLen, inSeq: spec.inSeq, at };
                    break;
                }
                case 'snps': {
                    p1 = cleanRandom(rng, spec.len);
                    const m = mutate(rng, p1, spec.count, spec.gap || 4, 3);
                    p2 = m.seq; extra = { positions: m.positions, count: m.positions.length };
                    break;
                }
                case 'tandem': {
                    const unit = cleanRandom(rng, spec.unitLen);
                    const c2 = spec.copies2 || spec.copies1;
                    p1 = unit.repeat(spec.copies1); p2 = unit.repeat(c2);
                    extra = { unit, unitLen: spec.unitLen, copies1: spec.copies1, copies2: c2 };
                    break;
                }
                case 'duplication': {
                    const seg = cleanRandom(rng, spec.len);
                    p1 = seg; p2 = seg + seg; extra = { len: spec.len };
                    break;
                }
                case 'inverted-repeat': {
                    const arm = cleanRandom(rng, spec.armLen), loop = cleanRandom(rng, spec.loopLen);
                    p1 = p2 = arm + loop + E.reverseComplement(arm);
                    extra = { armLen: spec.armLen, loopLen: spec.loopLen };
                    break;
                }
                default: throw new Error('unknown chunk ' + spec.type);
            }
            s1 += p1; s2 += p2;
            features.push({ type: spec.type, s1: [a1 + 1, a1 + p1.length], s2: [a2 + 1, a2 + p2.length], extra });
        }
        return { seq1: s1, seq2: s2, features };
    }

    /**
     * True when the plot contains a diagonal >= minLen that starts outside all
     * allowed boxes (1-based inclusive ranges) – i.e. an accidental repeat.
     */
    function hasAccidental(seq1, seq2, boxes, minLen, params) {
        const r = E.computeDotplot(seq1, seq2, params || { mode: 'runlength', minRun: minLen });
        // a box with diagonalOnly: true only admits cells on the main diagonal (self-comparisons)
        const inside = (i, j, reverse) => boxes.some(b => {
            if (b.diagonalOnly) return !reverse && i === j;
            const pad = b.pad || 0;   // tolerate chance extension of a planted block by a few bases
            return i >= b.s1[0] - pad && i <= b.s1[1] + pad && j >= b.s2[0] - pad && j <= b.s2[1] + pad;
        });
        for (const reverse of [false, true]) {
            for (const seg of (reverse ? r.reverse : r.forward).segments) {
                if (seg.len < minLen) continue;
                const c = E.segmentToOriginal(seg, seq2.length, reverse);
                if (!inside(c.s1Start, c.s2Start, reverse) || !inside(c.s1End, c.s2End, reverse)) return true;
            }
        }
        return false;
    }
    const DIAGONAL = { diagonalOnly: true };

    // Retry a builder until its pair passes the accidental-repeat check.
    function buildClean(rng, builder, minLen = 8, tries = 20) {
        let last;
        for (let t = 0; t < tries; t++) {
            last = builder();
            const boxes = last.boxes || last.features.map(f => ({ s1: f.s1, s2: f.s2 }));
            if (hasAccidental(last.seq1, last.seq2, boxes, minLen, last.params)) continue;
            // optional extra condition, e.g. "the visible block is exactly the planted one"
            if (last.check && !last.check()) continue;
            return last;
        }
        return last;
    }

    // Does the plot at `params` contain a block with exactly these 1-based coordinates?
    function blockExact(seq1, seq2, params, box, reverse) {
        const r = E.computeDotplot(seq1, seq2, params);
        return E.findBlocks(r, 4).some(b => b.reverse === reverse &&
            b.s1Start === box.s1[0] && b.s1End === box.s1[1] && b.s2Start === box.s2[0] && b.s2End === box.s2[1]);
    }

    const P = (minRun) => ({ mode: 'runlength', minRun });
    const featureBox = (f, label, color) => ({ s1: f.s1, s2: f.s2, label, color });

    // ------------------------------------------------------------ option lists
    const EVENT_OPTIONS = [
        { key: 'snps', label: 'Point mutations' },
        { key: 'indel', label: 'Insertion / deletion' },
        { key: 'inversion', label: 'Inversion' },
        { key: 'duplication', label: 'Segment duplication' },
        { key: 'tandem', label: 'Tandem repeat' },
        { key: 'inverted-repeat', label: 'Inverted repeat (hairpin)' },
        { key: 'identical', label: 'No difference – sequences identical, no repeats' },
        { key: 'unrelated', label: 'Unrelated – no similarity' }
    ];
    const EVENT_LABEL = Object.fromEntries(EVENT_OPTIONS.map(o => [o.key, o.label]));

    // ================================================================ LEVEL 1
    function qEventsSingle(rng) {
        const key = rng.pick(['snps', 'indel', 'inversion', 'duplication', 'tandem', 'inverted-repeat', 'identical', 'unrelated']);
        const flank = () => ({ type: 'flank', len: rng.int(14, 20) });
        let data, self = false, why;
        data = buildClean(rng, () => {
            switch (key) {
                case 'identical': why = 'one unbroken diagonal and nothing else'; return compose(rng, [{ type: 'flank', len: rng.int(50, 64) }]);
                case 'unrelated': { const n = rng.int(50, 64); why = 'no diagonal at all, only scattered short chance matches';
                    return { seq1: cleanRandom(rng, n), seq2: cleanRandom(rng, n), features: [], boxes: [] }; }
                case 'snps': why = 'the diagonal is interrupted but never shifted'; return compose(rng, [{ type: 'snps', len: rng.int(50, 64), count: rng.int(3, 6), gap: 6 }]);
                case 'indel': why = 'the diagonal jumps sideways/downwards by the size of the indel';
                    return compose(rng, [flank(), { type: 'insertion', len: rng.int(20, 28), insLen: rng.int(7, 12), inSeq: rng.pick([1, 2]) }, flank()]);
                case 'inversion': why = 'a red anti-diagonal replaces part of the green diagonal';
                    return compose(rng, [flank(), { type: 'inversion', len: rng.int(16, 26) }, flank()]);
                case 'duplication': why = 'the diagonal shifts down and a parallel piece appears where both copies match the original';
                    return compose(rng, [flank(), { type: 'duplication', len: rng.int(10, 15) }, flank()]);
                case 'tandem': why = 'a block of evenly spaced parallel diagonals'; self = true;
                    return compose(rng, [{ type: 'flank', len: rng.int(6, 10) }, { type: 'tandem', unitLen: rng.int(5, 9), copies1: rng.int(4, 7) }, { type: 'flank', len: rng.int(6, 10) }]);
                case 'inverted-repeat': why = 'a red anti-diagonal with a gap in the middle (the loop), crossing the green diagonal'; self = true;
                    return compose(rng, [{ type: 'flank', len: rng.int(6, 12) }, { type: 'inverted-repeat', armLen: rng.int(12, 18), loopLen: rng.int(3, 8) }, { type: 'flank', len: rng.int(6, 12) }]);
            }
        });
        const feat = data.features.find(f => f.type !== 'flank');
        const overlays = !feat ? []
            : key === 'snps' ? feat.extra.positions.map(p => ({ s1: [p + 1, p + 1], s2: [p + 1, p + 1], color: '#dc2626' }))
            : [featureBox(feat, EVENT_LABEL[key])];
        return {
            type: 'events-single', level: 1, skill: 'events', title: 'Name the event',
            prompt: `Tick every feature you can see in the plot.${self ? ' <em>This is a self-comparison: Sequence 2 is a copy of Sequence 1.</em>' : ''}`,
            hint: 'Green = same strand, red = opposite strand. Is the main diagonal complete, shifted, interrupted, or crossed?',
            explanation: `<strong>${EVENT_LABEL[key]}</strong>: ${why}.`,
            seq1: data.seq1, seq2: data.seq2, self, params: P(5),
            showSeq: { seq1: false, seq2: false }, allowParams: true,
            answer: { kind: 'multi', options: EVENT_OPTIONS, correct: [key] },
            overlays
        };
    }

    function qEventsComposite(rng) {
        const pool = ['snps', 'insertion', 'inversion', 'duplication', 'tandem', 'inverted-repeat'];
        const chosen = rng.shuffle(pool).slice(0, rng.int(2, 3));
        const keyOf = t => t === 'insertion' ? 'indel' : t;
        const spec = t => {
            switch (t) {
                case 'snps': return { type: 'snps', len: rng.int(26, 32), count: 3, gap: 6 };
                case 'insertion': return { type: 'insertion', len: rng.int(20, 26), insLen: rng.int(7, 11), inSeq: rng.pick([1, 2]) };
                case 'inversion': return { type: 'inversion', len: rng.int(16, 22) };
                case 'duplication': return { type: 'duplication', len: rng.int(10, 14) };
                case 'tandem': return { type: 'tandem', unitLen: rng.int(4, 6), copies1: rng.int(4, 5) };
                case 'inverted-repeat': return { type: 'inverted-repeat', armLen: rng.int(10, 13), loopLen: rng.int(4, 6) };
            }
        };
        const data = buildClean(rng, () => {
            const plan = [{ type: 'flank', len: rng.int(10, 14) }];
            chosen.forEach((t, k) => { plan.push(spec(t)); plan.push({ type: 'flank', len: rng.int(10, 14) }); });
            return compose(rng, plan);
        });
        const feats = data.features.filter(f => f.type !== 'flank');
        const list = feats.map(f => `<li><strong>${EVENT_LABEL[keyOf(f.type)]}</strong> at Seq 1 positions ${f.s1[0]}–${f.s1[1]}</li>`).join('');
        return {
            type: 'events-composite', level: 1, skill: 'events', title: 'Name all events',
            prompt: 'These two sequences differ by <strong>two or three</strong> separate events along their length. Tick every event that is present.',
            hint: 'Walk along the main diagonal from top-left to bottom-right and describe each place where it changes.',
            explanation: `<ul>${list}</ul>`,
            seq1: data.seq1, seq2: data.seq2, self: false, params: P(5),
            showSeq: { seq1: false, seq2: false }, allowParams: true,
            answer: { kind: 'multi', options: EVENT_OPTIONS, correct: chosen.map(keyOf) },
            overlays: feats.map(f => featureBox(f, EVENT_LABEL[keyOf(f.type)]))
        };
    }

    // ================================================================ LEVEL 2
    function qReadInversion(rng) {
        const data = buildClean(rng, () => {
            const d = compose(rng, [
                { type: 'flank', len: rng.int(14, 24) }, { type: 'inversion', len: rng.int(14, 24) }, { type: 'flank', len: rng.int(14, 24) }]);
            // the red block must not be extended by a chance match in the flanks
            d.check = () => blockExact(d.seq1, d.seq2, P(5), d.features[1], true);
            return d;
        });
        const f = data.features[1];
        return {
            type: 'read-inversion', level: 2, skill: 'reading', title: 'Locate the inversion',
            prompt: 'Part of Sequence 2 is inverted relative to Sequence 1. Read the coordinates of the inverted segment <strong>on Sequence 1</strong> (1-based, inclusive).',
            hint: 'Hover over the ends of the red anti-diagonal – the tooltip shows the coordinates.',
            explanation: `The red block spans Seq 1 positions ${f.s1[0]}–${f.s1[1]} (${f.s1[1] - f.s1[0] + 1} bp).`,
            seq1: data.seq1, seq2: data.seq2, self: false, params: P(5),
            showSeq: { seq1: false, seq2: false }, allowParams: true,
            answer: { kind: 'fields', fields: [
                { key: 'start', label: 'First inverted position in Seq 1', kind: 'number', answer: f.s1[0], tolerance: 1 },
                { key: 'end', label: 'Last inverted position in Seq 1', kind: 'number', answer: f.s1[1], tolerance: 1 }] },
            overlays: [featureBox(f, 'inversion')]
        };
    }

    function qReadIndel(rng) {
        const inSeq = rng.pick([1, 2]);
        const data = buildClean(rng, () => compose(rng, [
            { type: 'flank', len: rng.int(16, 24) }, { type: 'insertion', len: rng.int(18, 24), insLen: rng.int(5, 12), inSeq }, { type: 'flank', len: rng.int(16, 24) }]));
        const f = data.features[1];
        const n = f.extra.insLen;
        return {
            type: 'read-indel', level: 2, skill: 'reading', title: 'Measure the indel',
            prompt: 'The diagonal is displaced at one point. How many bases were inserted, and which sequence carries the extra bases?',
            hint: 'The size of the jump between the two diagonal pieces equals the indel length. Extra bases in Seq 2 (vertical) shift the diagonal down; extra bases in Seq 1 shift it to the right.',
            explanation: `Sequence ${inSeq} contains ${n} extra bases (Seq ${inSeq} is ${n} bp longer: ${data.seq1.length} vs ${data.seq2.length} bp). The diagonal after the indel is offset by exactly ${n} cells.`,
            seq1: data.seq1, seq2: data.seq2, self: false, params: P(5),
            showSeq: { seq1: false, seq2: false }, allowParams: true,
            answer: { kind: 'fields', fields: [
                { key: 'size', label: 'Indel length (bp)', kind: 'number', answer: n, tolerance: 0 },
                { key: 'which', label: 'Which sequence has the extra bases?', kind: 'choice', options: ['Sequence 1', 'Sequence 2'], answer: inSeq - 1 }] },
            overlays: [featureBox(f, 'indel region')]
        };
    }

    function qReadTandem(rng) {
        const unitLen = rng.int(4, 9), copies1 = rng.int(4, 7);
        const copies2 = rng.chance(0.5) ? copies1 : Math.max(2, copies1 + rng.pick([-2, -1, 1, 2]));
        const data = buildClean(rng, () => compose(rng, [
            { type: 'flank', len: rng.int(10, 16) }, { type: 'tandem', unitLen, copies1, copies2 }, { type: 'flank', len: rng.int(10, 16) }]));
        const f = data.features[1];
        return {
            type: 'read-tandem', level: 2, skill: 'reading', title: 'Measure the tandem repeat',
            prompt: 'Both sequences contain the same tandem repeat, possibly with different copy numbers. Determine the repeat unit length and the number of copies in <strong>Sequence 1</strong>.',
            hint: 'Neighbouring parallel diagonals are one unit apart. The width of the striped block on the Seq 1 axis is unit × copies.',
            explanation: `Unit length ${unitLen} bp (unit ${f.extra.unit}); Seq 1 carries ${copies1} copies (positions ${f.s1[0]}–${f.s1[1]}), Seq 2 carries ${copies2}.`,
            seq1: data.seq1, seq2: data.seq2, self: false, params: P(4),
            showSeq: { seq1: false, seq2: false }, allowParams: true,
            answer: { kind: 'fields', fields: [
                { key: 'unit', label: 'Repeat unit length (bp)', kind: 'number', answer: unitLen, tolerance: 0 },
                { key: 'copies', label: 'Copies in Sequence 1', kind: 'number', answer: copies1, tolerance: 0 }] },
            overlays: [featureBox(f, 'repeat block')]
        };
    }

    function qReadSnps(rng) {
        const count = rng.int(3, 7);
        const data = buildClean(rng, () => compose(rng, [{ type: 'snps', len: rng.int(56, 70), count, gap: 5 }]), 7);
        const f = data.features[0];
        return {
            type: 'read-snps', level: 2, skill: 'reading', title: 'Count the mutations',
            prompt: 'The two sequences have the same length and differ only by point substitutions. How many substitutions are there?',
            hint: 'Each substitution interrupts the main diagonal once: count the gaps, not the pieces. Lower the minimum diagonal length if short pieces have disappeared.',
            explanation: `${f.extra.count} substitutions at Seq 1 positions ${f.extra.positions.map(p => p + 1).join(', ')} – the diagonal has ${f.extra.count + 1} pieces.`,
            seq1: data.seq1, seq2: data.seq2, self: false, params: P(3),
            showSeq: { seq1: false, seq2: false }, allowParams: true,
            answer: { kind: 'fields', fields: [{ key: 'count', label: 'Number of substitutions', kind: 'number', answer: f.extra.count, tolerance: 0 }] },
            overlays: f.extra.positions.map(p => ({ s1: [p + 1, p + 1], s2: [p + 1, p + 1], color: '#dc2626' }))
        };
    }

    function qReadOverlap(rng) {
        const ov = rng.int(12, 26);
        const firstContinues = rng.chance(0.5);   // true: 3' end of read 1 overlaps 5' end of read 2
        const data = buildClean(rng, () => {
            const LA = rng.int(44, 54), LB = rng.int(44, 54);
            const genome = cleanRandom(rng, LA + LB - ov);
            const A = genome.slice(0, LA), B = genome.slice(LA - ov);      // A's last ov bases = B's first ov bases
            const seq1 = firstContinues ? A : B, seq2 = firstContinues ? B : A;
            const box = firstContinues
                ? { s1: [LA - ov + 1, LA], s2: [1, ov] }
                : { s1: [1, ov], s2: [LA - ov + 1, LA] };
            const d = { seq1, seq2, features: [], boxes: [box], box };
            d.check = () => blockExact(seq1, seq2, P(5), box, false);
            return d;
        });
        return {
            type: 'read-overlap', level: 2, skill: 'reading', title: 'Read overlap',
            prompt: 'Sequence 1 and Sequence 2 are two sequencing reads from the same genome strand. By how many bases do they overlap, and which end of <strong>Sequence 1</strong> is involved?',
            hint: 'The diagonal touches two different edges of the plot. Its length is the overlap; the edge it touches on the Seq 1 axis tells you which end.',
            explanation: firstContinues
                ? `The last ${ov} bases of Seq 1 (its 3′ end) equal the first ${ov} bases of Seq 2: Seq 2 continues Seq 1.`
                : `The first ${ov} bases of Seq 1 (its 5′ end) equal the last ${ov} bases of Seq 2: Seq 1 continues Seq 2.`,
            seq1: data.seq1, seq2: data.seq2, self: false, params: P(5),
            showSeq: { seq1: false, seq2: false }, allowParams: true,
            answer: { kind: 'fields', fields: [
                { key: 'len', label: 'Overlap length (bp)', kind: 'number', answer: ov, tolerance: 0 },
                { key: 'end', label: 'End of Sequence 1 in the overlap', kind: 'choice', options: ['3′ end (its last bases)', '5′ end (its first bases)'], answer: firstContinues ? 0 : 1 }] },
            overlays: [Object.assign({ label: 'overlap' }, data.box)]
        };
    }

    function qReadLtr(rng) {
        const ltrLen = rng.int(14, 22), inner = rng.int(30, 50);
        const data = buildClean(rng, () => {
            const ltr = cleanRandom(rng, ltrLen);
            const f1 = cleanRandom(rng, rng.int(18, 30)), f2 = cleanRandom(rng, rng.int(18, 30)), mid = cleanRandom(rng, inner);
            const seq = f1 + ltr + mid + ltr + f2;
            const a = f1.length + 1, b = a + ltrLen + inner;
            const L1 = [a, a + ltrLen - 1], L2 = [b, b + ltrLen - 1];
            const boxes = [DIAGONAL, { s1: L1, s2: L2 }, { s1: L2, s2: L1 }];
            const d = { seq1: seq, seq2: seq, features: [], boxes, a, b, params: P(8) };
            d.check = () => blockExact(seq, seq, P(6), { s1: L1, s2: L2 }, false);
            return d;
        }, 8);
        const dist = data.b - data.a;
        return {
            type: 'read-ltr', level: 2, skill: 'reading', title: 'LTR retrotransposon',
            prompt: 'This is a self-comparison of a genomic region that contains one LTR retrotransposon. Its two long terminal repeats (LTRs) are identical and in the same orientation. Determine the LTR length and the distance between the starts of the two LTRs.',
            hint: 'The off-diagonal green line is one LTR matching the other. Its length is the LTR length; its horizontal distance from the main diagonal is the distance between the copies.',
            explanation: `LTRs of ${ltrLen} bp at positions ${data.a}–${data.a + ltrLen - 1} and ${data.b}–${data.b + ltrLen - 1}; the starts are ${dist} bp apart, so the element is ${dist + ltrLen} bp long.`,
            seq1: data.seq1, seq2: data.seq2, self: true, params: P(6),
            showSeq: { seq1: false, seq2: false }, allowParams: true,
            answer: { kind: 'fields', fields: [
                { key: 'ltr', label: 'LTR length (bp)', kind: 'number', answer: ltrLen, tolerance: 0 },
                { key: 'dist', label: 'Distance between LTR starts (bp)', kind: 'number', answer: dist, tolerance: 1 }] },
            overlays: [
                { s1: [data.a, data.a + ltrLen - 1], s2: [data.b, data.b + ltrLen - 1], label: 'LTR × LTR' },
                { s1: [data.b, data.b + ltrLen - 1], s2: [data.a, data.a + ltrLen - 1] }]
        };
    }

    // ================================================================ LEVEL 3
    function qOrientCopies(rng) {
        const inverted = rng.chance(0.5), segLen = rng.int(13, 18);
        const data = buildClean(rng, () => {
            const seg = cleanRandom(rng, segLen);
            const f1 = cleanRandom(rng, rng.int(10, 18)), sp = cleanRandom(rng, rng.int(10, 20)), f2 = cleanRandom(rng, rng.int(10, 18));
            const copy2 = inverted ? E.reverseComplement(seg) : seg;
            const seq = f1 + seg + sp + copy2 + f2;
            const a = f1.length + 1, b = a + segLen + sp.length;
            const c1 = [a, a + segLen - 1], c2 = [b, b + segLen - 1];
            const d = { seq1: seq, seq2: seq, features: [], boxes: [DIAGONAL, { s1: c1, s2: c2 }, { s1: c2, s2: c1 }], a, b, params: P(7) };
            d.check = () => blockExact(seq, seq, P(5), { s1: c1, s2: c2 }, inverted);
            return d;
        }, 7);
        const { a, b } = data;
        return {
            type: 'orient-copies', level: 3, skill: 'orientation', title: 'Orientation of repeat copies',
            prompt: 'Self-comparison of a sequence that contains one segment twice. Are the two copies in the same or in opposite orientation, and where does the second copy start?',
            hint: 'A green line parallel to the main diagonal = same orientation. A red line perpendicular to it = opposite orientation (one copy is the reverse complement of the other).',
            explanation: inverted
                ? `The copies are <strong>inverted</strong> (red anti-diagonal): positions ${a}–${a + segLen - 1} are the reverse complement of ${b}–${b + segLen - 1}.`
                : `The copies are <strong>direct</strong> (green parallel line): positions ${a}–${a + segLen - 1} equal ${b}–${b + segLen - 1}.`,
            seq1: data.seq1, seq2: data.seq2, self: true, params: P(5),
            showSeq: { seq1: false, seq2: false }, allowParams: true,
            answer: { kind: 'fields', fields: [
                { key: 'orient', label: 'Orientation of the second copy', kind: 'choice', options: ['Direct (same orientation)', 'Inverted (opposite orientation)'], answer: inverted ? 1 : 0 },
                { key: 'start', label: 'First position of the second copy', kind: 'number', answer: b, tolerance: 1 }] },
            overlays: [{ s1: [a, a + segLen - 1], s2: [b, b + segLen - 1], label: 'copy 1 × copy 2' }, { s1: [b, b + segLen - 1], s2: [a, a + segLen - 1] }]
        };
    }

    function qOrientSynteny(rng) {
        const scenario = rng.pick(['collinear', 'inverted', 'reordered', 'inverted-reordered']);
        const names = ['A', 'B', 'C'];
        const data = buildClean(rng, () => {
            const blocks = names.map(() => cleanRandom(rng, rng.int(16, 22)));
            const sp = () => cleanRandom(rng, rng.int(6, 9));
            const seq1 = sp() + blocks[0] + sp() + blocks[1] + sp() + blocks[2] + sp();
            let order = [0, 1, 2], invIdx = -1;
            if (scenario === 'reordered' || scenario === 'inverted-reordered') order = rng.pick([[0, 2, 1], [1, 0, 2], [2, 1, 0]]);
            if (scenario === 'inverted' || scenario === 'inverted-reordered') invIdx = rng.int(0, 2);
            let seq2 = sp();
            const pos2 = {};
            order.forEach(k => {
                const b = k === invIdx ? E.reverseComplement(blocks[k]) : blocks[k];
                pos2[k] = [seq2.length + 1, seq2.length + b.length];
                seq2 += b + sp();
            });
            // positions on seq1 (blocks are unique random strings, so indexOf is safe)
            const pos1 = {};
            names.forEach((_, k) => { const at = seq1.indexOf(blocks[k]); pos1[k] = [at + 1, at + blocks[k].length]; });
            const boxes = names.map((_, k) => ({ s1: pos1[k], s2: pos2[k] }));
            return { seq1, seq2, features: [], boxes, pos1, pos2, order, invIdx, params: P(7) };
        }, 7);
        const options = [
            'Collinear: same order and orientation',
            'Same order, but one block is inverted',
            'Blocks reordered, all in the same orientation',
            'Blocks reordered and one of them inverted'];
        const correct = ['collinear', 'inverted', 'reordered', 'inverted-reordered'].indexOf(scenario);
        const desc = names.map((nm, k) => `${nm}: Seq 1 ${data.pos1[k][0]}–${data.pos1[k][1]} ↔ Seq 2 ${data.pos2[k][0]}–${data.pos2[k][1]}${k === data.invIdx ? ' (inverted)' : ''}`).join('; ');
        return {
            type: 'orient-synteny', level: 3, skill: 'orientation', title: 'Synteny between two regions',
            prompt: 'Two genomic regions share three conserved blocks (A, B, C in Sequence 1, left to right) separated by unconserved spacers. How are the blocks arranged in Sequence 2?',
            hint: 'Blocks on one common diagonal = collinear. A block off that diagonal = moved. A red block = inverted.',
            explanation: `${options[correct]}. ${desc}.`,
            seq1: data.seq1, seq2: data.seq2, self: false, params: P(5),
            showSeq: { seq1: false, seq2: false }, allowParams: true,
            answer: { kind: 'choice', options, correct },
            overlays: names.map((nm, k) => ({ s1: data.pos1[k], s2: data.pos2[k], label: nm, color: k === data.invIdx ? '#dc2626' : '#2563eb' }))
        };
    }

    // ================================================================ LEVEL 4
    function qParamTune(rng) {
        const repLen = rng.int(10, 13), maxNoise = 4;
        const data = buildClean(rng, () => {
            const rep = cleanRandom(rng, repLen);
            const a1 = cleanRandom(rng, rng.int(40, 60)), a2 = cleanRandom(rng, rng.int(40, 60));
            const b1 = cleanRandom(rng, rng.int(40, 60)), b2 = cleanRandom(rng, rng.int(40, 60));
            const seq1 = a1 + rep + a2, seq2 = b1 + rep + b2;
            const box = { s1: [a1.length + 1, a1.length + repLen], s2: [b1.length + 1, b1.length + repLen] };
            const d = { seq1, seq2, features: [], boxes: [box], box, params: P(8) };
            // no chance match of 8+ anywhere, and the shared segment is exactly the planted one
            d.check = () => blockExact(seq1, seq2, P(8), box, false);
            return d;
        }, 8);
        const box = data.box;
        const grade = params => {
            const r = E.computeDotplot(data.seq1, data.seq2, params);
            const n = r.n;
            let onRepeat = 0, noise = 0;
            for (let j = 0; j < r.m; j++) for (let i = 0; i < n; i++) {
                const inRep = i >= box.s1[0] - 1 && i <= box.s1[1] - 1 && j >= box.s2[0] - 1 && j <= box.s2[1] - 1 && (i - (box.s1[0] - 1)) === (j - (box.s2[0] - 1));
                if (r.forward.matrix[j * n + i]) { if (inRep) onRepeat++; else noise++; }
                if (r.reverse.matrix[(r.m - 1 - j) * n + i]) noise++;
            }
            // how many dots a perfect repLen match can produce with these settings
            const possible = params.mode === 'window' ? Math.max(0, repLen - params.window + 1) : (params.minRun <= repLen ? repLen : 0);
            const visible = possible > 0 && onRepeat >= Math.max(1, Math.ceil(possible * 0.7));
            const clean = noise <= maxNoise;
            const ok = visible && clean;
            return { ok, score: ok ? 1 : (visible || clean ? 0.5 : 0),
                message: `${onRepeat} dot${onRepeat === 1 ? '' : 's'} on the shared segment${visible ? '' : ' (the segment is not visible with these settings)'}, ${noise} other dot${noise === 1 ? '' : 's'}${clean ? '' : ` (too many – at most ${maxNoise} allowed)`}.` };
        };
        return {
            type: 'param-tune', level: 4, skill: 'parameters', title: 'Tune the parameters',
            prompt: `Two unrelated sequences share one ${repLen}-bp segment. With the current settings the plot is full of noise. <strong>Adjust the parameters</strong> (either mode) so that the shared segment is shown as a diagonal and at most ${maxNoise} other dots remain, then press <em>Check</em>.`,
            hint: `The shared segment is ${repLen} bp long. Chance matches at these lengths are rarely longer than 7 bp – so a minimum diagonal length between 8 and ${repLen} works; in window mode the window must not exceed ${repLen} and the threshold must be strict.`,
            explanation: `Any minimum diagonal length from 8 to ${repLen} keeps the ${repLen}-bp repeat (Seq 1 ${box.s1[0]}–${box.s1[1]} × Seq 2 ${box.s2[0]}–${box.s2[1]}) while removing shorter chance matches. Longer than ${repLen} removes the repeat itself; 7 may still let a chance 7-mer through.`,
            seq1: data.seq1, seq2: data.seq2, self: false, params: P(3),
            showSeq: { seq1: false, seq2: false }, allowParams: true,
            answer: { kind: 'params', grade },
            overlays: [Object.assign({ label: 'shared segment' }, box)]
        };
    }

    function qParamExpected(rng) {
        const n = rng.pick([100, 150, 200, 250, 300]), m = rng.pick([100, 150, 200, 250, 300]), k = rng.int(4, 7);
        const seq1 = rng.seq(n), seq2 = rng.seq(m);
        const expected = E.expectedRandom(n, m, P(k)).value;
        const r = E.computeDotplot(seq1, seq2, P(k));
        return {
            type: 'param-expected', level: 4, skill: 'parameters', title: 'Expected chance matches',
            prompt: `Two <strong>random, unrelated</strong> sequences of ${n} and ${m} bp are compared with minimum diagonal length ${k}. How many ${k}-bp word matches do you expect <strong>by chance on one strand</strong>? (Assume equal base frequencies; ±30 % is accepted.)`,
            hint: `There are (n − k + 1)(m − k + 1) pairs of ${k}-bp words, and two random words agree with probability (1/4)<sup>${k}</sup>.`,
            explanation: `(${n} − ${k} + 1) × (${m} − ${k} + 1) / 4<sup>${k}</sup> = ${expected.toFixed(1)} per strand. This particular random pair shows ${r.stats.observedForward} forward and ${r.stats.observedReverse} reverse ${k}-mer matches.`,
            seq1, seq2, self: false, params: P(k),
            showSeq: { seq1: false, seq2: false }, allowParams: false,
            answer: { kind: 'fields', fields: [{ key: 'exp', label: `Expected ${k}-mer matches per strand`, kind: 'number', answer: expected, tolerance: Math.max(1, expected * 0.3) }] },
            overlays: []
        };
    }

    // ================================================================ LEVEL 5
    function qDrawDotplot(rng) {
        const minRun = rng.pick([1, 1, 2]);
        let seq1, seq2, cells;
        for (let t = 0; t < 30; t++) {
            seq1 = rng.seq(rng.int(7, 9)); seq2 = rng.seq(rng.int(7, 9));
            const r = E.computeDotplot(seq1, seq2, P(minRun));
            cells = [];
            for (let j = 0; j < r.m; j++) for (let i = 0; i < r.n; i++) if (r.forward.matrix[j * r.n + i]) cells.push([i, j]);
            if (cells.length >= 8 && cells.length <= 22) break;
        }
        return {
            type: 'draw-dotplot', level: 5, skill: 'inverse', title: 'Draw the dotplot',
            prompt: minRun === 1
                ? 'Draw the same-strand dotplot of the two short sequences below: click every cell where the base of Sequence 1 (column) equals the base of Sequence 2 (row).'
                : 'Draw the same-strand dotplot with <strong>minimum diagonal length 2</strong>: click only the cells that lie on a diagonal run of at least two consecutive identical bases.',
            hint: minRun === 1 ? 'Go row by row: for each base of Seq 2, mark every column with the same base.' : 'First find all identities, then keep only those with an identical neighbour diagonally up-left or down-right.',
            explanation: `${cells.length} cells should be marked.`,
            seq1, seq2, self: false, params: P(minRun),
            showSeq: { seq1: true, seq2: true }, allowParams: false, grid: true,
            answer: { kind: 'cells', correct: cells },
            overlays: []
        };
    }

    function qWhichSeq2(rng) {
        const event = rng.pick(['inversion', 'insertion', 'duplication']);
        const data = buildClean(rng, () => compose(rng, [
            { type: 'flank', len: rng.int(12, 16) },
            event === 'inversion' ? { type: 'inversion', len: rng.int(14, 18) }
                : event === 'insertion' ? { type: 'insertion', len: rng.int(16, 20), insLen: rng.int(6, 9), inSeq: 2 }
                : { type: 'duplication', len: rng.int(9, 12) },
            { type: 'flank', len: rng.int(12, 16) }]));
        const correct = data.seq2;
        const f = data.features[1];
        // distractors: reverse complement of the correct one; same event at another place
        const rc = E.reverseComplement(correct);
        let other;
        if (event === 'inversion') {
            const a = rng.int(2, 6), L = f.s1[1] - f.s1[0] + 1;
            other = data.seq1.slice(0, a) + E.reverseComplement(data.seq1.slice(a, a + L)) + data.seq1.slice(a + L);
        } else if (event === 'insertion') {
            const at = rng.int(2, 6);
            other = data.seq1.slice(0, at) + cleanRandom(rng, f.extra.insLen) + data.seq1.slice(at);
        } else {
            const L = f.extra.len, at = data.seq1.length - L - rng.int(2, 5);
            other = data.seq1.slice(0, at + L) + data.seq1.slice(at, at + L) + data.seq1.slice(at + L);
        }
        const opts = rng.shuffle([{ s: correct, ok: true }, { s: rc, ok: false }, { s: other, ok: false }]);
        return {
            type: 'which-seq2', level: 5, skill: 'inverse', title: 'Which Sequence 2 produced this plot?',
            prompt: 'Sequence 1 is shown on the horizontal axis. The plot was made with one of the three candidate sequences below as Sequence 2. Which one?',
            hint: 'Locate the event in the plot (where along Seq 1 does it happen?), then check which candidate has the change at that position. One candidate is the reverse complement of the right answer – how would that plot look?',
            explanation: `The plot shows a ${EVENT_LABEL[event === 'insertion' ? 'indel' : event]} at Seq 1 positions ${f.s1[0]}–${f.s1[1]}. The reverse-complement candidate would give a red anti-diagonal across the whole plot; the other candidate has the event at a different position.`,
            seq1: data.seq1, seq2: correct, self: false, params: P(4),
            showSeq: { seq1: true, seq2: false }, allowParams: true,
            answer: { kind: 'choice', options: opts.map(o => `<code>${o.s}</code>`), correct: opts.findIndex(o => o.ok) },
            overlays: [featureBox(f, event)]
        };
    }

    // ================================================================ LEVEL 6
    function qInterpCopies(rng) {
        const copies = rng.int(2, 4), elLen = rng.int(16, 22);
        const data = buildClean(rng, () => {
            const el = cleanRandom(rng, elLen);
            const orient = [false];
            for (let c = 1; c < copies; c++) orient.push(rng.chance(0.5));
            let seq = cleanRandom(rng, rng.int(14, 24));
            const pos = [];
            orient.forEach((rev, c) => {
                pos.push([seq.length + 1, seq.length + elLen]);
                seq += rev ? E.reverseComplement(el) : el;
                seq += cleanRandom(rng, rng.int(14, 24));
            });
            // allowed: the main diagonal and every copy × copy box
            const allowed = [DIAGONAL];
            for (let a = 0; a < copies; a++) for (let b = 0; b < copies; b++) allowed.push({ s1: pos[a], s2: pos[b], pad: 3 });
            return { seq1: seq, seq2: seq, features: [], boxes: allowed, pos, orient, params: P(8) };
        }, 8, 60);
        const reversed = data.orient.filter(Boolean).length;
        const posList = data.pos.map((p, c) => `${p[0]}–${p[1]}${data.orient[c] ? ' (inverted)' : ''}`).join(', ');
        return {
            type: 'interp-copies', level: 6, skill: 'interpretation', title: 'Copies of a transposable element',
            prompt: 'Self-comparison of a genomic region in which one transposable element occurs several times, some copies possibly inverted. How many copies are there in total, and how many are in the <strong>opposite</strong> orientation to the first (leftmost) copy?',
            hint: 'Every pair of copies gives one off-diagonal line: green if both have the same orientation, red if opposite. With c copies there are c(c−1)/2 pairs above the diagonal. Lines in the row/column of the first copy tell you each copy’s orientation relative to it.',
            explanation: `${copies} copies at positions ${posList}; ${reversed} of them are inverted relative to the first copy. Pairs of same-orientation copies give green lines, pairs of opposite orientation give red lines.`,
            seq1: data.seq1, seq2: data.seq2, self: true, params: P(7),
            showSeq: { seq1: false, seq2: false }, allowParams: true,
            answer: { kind: 'fields', fields: [
                { key: 'copies', label: 'Total number of copies', kind: 'number', answer: copies, tolerance: 0 },
                { key: 'rev', label: 'Copies inverted relative to the first', kind: 'number', answer: reversed, tolerance: 0 }] },
            overlays: data.pos.map((p, c) => ({ s1: p, s2: data.pos[0], label: `copy ${c + 1}`, color: data.orient[c] ? '#dc2626' : '#2563eb' }))
        };
    }

    function qInterpReads(rng) {
        const scenario = rng.pick(['r2-continues', 'r1-continues', 'opposite', 'none']);
        const ov = rng.int(14, 26);
        const data = buildClean(rng, () => {
            const L1 = rng.int(46, 56), L2 = rng.int(46, 56);
            const genome = cleanRandom(rng, L1 + L2 - ov);
            let seq1, seq2, box = null;
            if (scenario === 'none') {
                seq1 = cleanRandom(rng, L1); seq2 = cleanRandom(rng, L2);
            } else if (scenario === 'r2-continues') {
                seq1 = genome.slice(0, L1); seq2 = genome.slice(L1 - ov);
                box = { s1: [L1 - ov + 1, L1], s2: [1, ov] };
            } else if (scenario === 'r1-continues') {
                seq2 = genome.slice(0, L2); seq1 = genome.slice(L2 - ov);
                box = { s1: [1, ov], s2: [L2 - ov + 1, L2] };
            } else {
                seq1 = genome.slice(0, L1);
                const fwd2 = genome.slice(L1 - ov);          // read 2 sequenced from the other strand
                seq2 = E.reverseComplement(fwd2);
                box = { s1: [L1 - ov + 1, L1], s2: [seq2.length - ov + 1, seq2.length] };
            }
            const d = { seq1, seq2, features: [], boxes: box ? [box] : [], box, params: P(7) };
            if (box) d.check = () => blockExact(seq1, seq2, P(6), box, scenario === 'opposite');
            return d;
        }, 7);
        const options = [
            'Read 2 continues read 1 (3′ end of read 1 overlaps 5′ end of read 2)',
            'Read 1 continues read 2 (3′ end of read 2 overlaps 5′ end of read 1)',
            'They overlap but were sequenced from opposite strands (one is the reverse complement)',
            'They do not overlap'];
        const correct = ['r2-continues', 'r1-continues', 'opposite', 'none'].indexOf(scenario);
        return {
            type: 'interp-reads', level: 6, skill: 'interpretation', title: 'Assembling two reads',
            prompt: 'Sequence 1 and Sequence 2 are two sequencing reads. Decide how they relate and give the overlap length (0 if they do not overlap).',
            hint: 'A green diagonal touching the right edge on Seq 1 and the top edge on Seq 2 means Seq 1’s end continues into Seq 2’s start. A red diagonal means one read comes from the other strand. No diagonal at all means no overlap.',
            explanation: `${options[correct]}.${scenario === 'none' ? '' : ` Overlap ${ov} bp.`}`,
            seq1: data.seq1, seq2: data.seq2, self: false, params: P(6),
            showSeq: { seq1: false, seq2: false }, allowParams: true,
            answer: { kind: 'fields', fields: [
                { key: 'rel', label: 'Relationship', kind: 'choice', options, answer: correct },
                { key: 'len', label: 'Overlap length (bp)', kind: 'number', answer: scenario === 'none' ? 0 : ov, tolerance: 1 }] },
            overlays: data.box ? [Object.assign({ label: 'overlap' }, data.box)] : []
        };
    }

    // ------------------------------------------------------------ catalogue
    const TYPES = {
        'events-single':    { level: 1, skill: 'events', name: 'Name the event', gen: qEventsSingle },
        'events-composite': { level: 1, skill: 'events', name: 'Name all events (2–3 events)', gen: qEventsComposite },
        'read-inversion':   { level: 2, skill: 'reading', name: 'Locate an inversion', gen: qReadInversion },
        'read-indel':       { level: 2, skill: 'reading', name: 'Measure an indel', gen: qReadIndel },
        'read-tandem':      { level: 2, skill: 'reading', name: 'Measure a tandem repeat', gen: qReadTandem },
        'read-snps':        { level: 2, skill: 'reading', name: 'Count substitutions', gen: qReadSnps },
        'read-overlap':     { level: 2, skill: 'reading', name: 'Read overlap', gen: qReadOverlap },
        'read-ltr':         { level: 2, skill: 'reading', name: 'LTR retrotransposon', gen: qReadLtr },
        'orient-copies':    { level: 3, skill: 'orientation', name: 'Orientation of repeat copies', gen: qOrientCopies },
        'orient-synteny':   { level: 3, skill: 'orientation', name: 'Synteny / rearrangement', gen: qOrientSynteny },
        'param-tune':       { level: 4, skill: 'parameters', name: 'Tune the parameters', gen: qParamTune },
        'param-expected':   { level: 4, skill: 'parameters', name: 'Expected chance matches', gen: qParamExpected },
        'draw-dotplot':     { level: 5, skill: 'inverse', name: 'Draw the dotplot', gen: qDrawDotplot },
        'which-seq2':       { level: 5, skill: 'inverse', name: 'Which sequence made this plot?', gen: qWhichSeq2 },
        'interp-copies':    { level: 6, skill: 'interpretation', name: 'Copies of a transposable element', gen: qInterpCopies },
        'interp-reads':     { level: 6, skill: 'interpretation', name: 'Assembling two reads', gen: qInterpReads }
    };

    const SKILLS = {
        events: 'Recognising events',
        reading: 'Reading positions and sizes',
        orientation: 'Strand and orientation',
        parameters: 'Parameters and noise',
        inverse: 'From sequence to plot and back',
        interpretation: 'Genomic interpretation'
    };

    function generate(type, rng) {
        const q = TYPES[type].gen(rng);
        q.type = type;
        return q;
    }

    // A 12-question session: two questions per level, ascending, no type repeated within a level.
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

    return { Rng, TYPES, SKILLS, EVENT_OPTIONS, generate, sessionPlan, randomSeedString, hashString };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DotplotQuizGen;
}
