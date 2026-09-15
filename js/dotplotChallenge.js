/**
 * DOTPLOT CHALLENGE – "Name the event"
 * ====================================
 * Generates a random pair of sequences in which a known evolutionary event
 * (or none) has been applied, so the student can practise reading dotplots
 * on material they have never seen. Returns the correct answer for scoring.
 */
const DotplotChallenge = (() => {
    const E = DotplotEngine;
    const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];

    const EVENTS = [
        { key: 'identical', label: 'Identical sequences' },
        { key: 'snps', label: 'Point mutations only' },
        { key: 'indel', label: 'Insertion / deletion' },
        { key: 'inversion', label: 'Inversion' },
        { key: 'duplication', label: 'Segment duplication' },
        { key: 'tandem', label: 'Tandem repeat (self-comparison)' },
        { key: 'inverted-repeat', label: 'Inverted repeat / hairpin (self-comparison)' },
        { key: 'unrelated', label: 'Unrelated sequences' }
    ];

    function mutate(seq, count) {
        const a = seq.split('');
        const used = new Set();
        while (used.size < count) {
            const p = rnd(0, a.length - 1);
            if (used.has(p)) continue;
            used.add(p);
            const others = 'ACGT'.replace(a[p], '');
            a[p] = others[rnd(0, 2)];
        }
        return a.join('');
    }

    // A random sequence that contains no accidental long repeats, so the
    // planted event is the only strong signal.
    function cleanRandom(len) {
        for (let attempt = 0; attempt < 20; attempt++) {
            const s = E.randomSequence(len);
            const r = E.computeDotplot(s, s, { mode: 'runlength', minRun: 6 });
            const off = r.forward.segments.filter(seg => seg.i !== seg.j).length + r.reverse.segments.length;
            if (off === 0) return s;
        }
        return E.randomSequence(len);
    }

    const generators = {
        identical() {
            const s = cleanRandom(rnd(50, 64));
            return { seq1: s, seq2: s, note: 'One unbroken diagonal: every position matches.' };
        },
        snps() {
            const s = cleanRandom(rnd(50, 64));
            const k = rnd(3, 6);
            return { seq1: s, seq2: mutate(s, k), note: `The diagonal is interrupted at ${k} positions but never shifts – substitutions only.` };
        },
        indel() {
            const s = cleanRandom(rnd(46, 56));
            const ins = cleanRandom(rnd(7, 12));
            const p = rnd(Math.floor(s.length * 0.3), Math.floor(s.length * 0.7));
            const longer = s.slice(0, p) + ins + s.slice(p);
            const seq2HasInsert = Math.random() < 0.5;
            return {
                seq1: seq2HasInsert ? s : longer,
                seq2: seq2HasInsert ? longer : s,
                note: `The diagonal jumps ${seq2HasInsert ? 'down' : 'right'} by ${ins.length} cells: ${ins.length} bases were ${seq2HasInsert ? 'inserted in Seq 2' : 'inserted in Seq 1 (= deleted from Seq 2)'}.`
            };
        },
        inversion() {
            const s = cleanRandom(rnd(56, 68));
            const len = rnd(16, 26);
            const a = rnd(10, s.length - len - 10);
            const seq2 = s.slice(0, a) + E.reverseComplement(s.slice(a, a + len)) + s.slice(a + len);
            return { seq1: s, seq2, note: `Green flanks and a red anti-diagonal in the middle: positions ${a + 1}–${a + len} were inverted.` };
        },
        duplication() {
            const a = cleanRandom(rnd(14, 20)), b = cleanRandom(rnd(10, 15)), c = cleanRandom(rnd(14, 20));
            const seq1 = a + b + c;
            const seq2 = a + b + b + c;
            return { seq1, seq2, note: `Seq 2 has an extra copy of a ${b.length}-bp segment: the diagonal shifts down and a short parallel piece appears.` };
        },
        tandem() {
            const unit = cleanRandom(rnd(5, 9));
            const copies = rnd(4, 7);
            const s = cleanRandom(rnd(5, 10)) + unit.repeat(copies) + cleanRandom(rnd(5, 10));
            return { seq1: s, seq2: s, self: true, note: `A ${unit.length}-bp unit repeated ${copies} times gives ${copies - 1} parallel diagonals on each side of the main one.` };
        },
        'inverted-repeat'() {
            const arm = cleanRandom(rnd(12, 18));
            const loop = cleanRandom(rnd(3, 8));
            const s = cleanRandom(rnd(6, 12)) + arm + loop + E.reverseComplement(arm) + cleanRandom(rnd(6, 12));
            return { seq1: s, seq2: s, self: true, note: `Two ${arm.length}-bp arms in opposite orientation give a red anti-diagonal with a ${loop.length}-bp gap for the loop.` };
        },
        unrelated() {
            const len = rnd(50, 64);
            return { seq1: cleanRandom(len), seq2: cleanRandom(len), note: 'Only scattered short chance matches, no diagonal at all.' };
        }
    };

    function generate(excludeKey) {
        const candidates = EVENTS.filter(e => e.key !== excludeKey);
        const event = pick(candidates);
        const data = generators[event.key]();
        return Object.assign({ event: event.key, label: event.label, params: { mode: 'runlength', minRun: 5 } }, data);
    }

    return { EVENTS, generate };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DotplotChallenge;
}
