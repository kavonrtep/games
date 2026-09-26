/**
 * OLC ASSEMBLY LAB – QUIZ
 * =======================
 * Seeded question generators; answers are computed with OlcEngine.
 */
class OlcQuiz {
    constructor(app) {
        this.app = app; this.E = OlcEngine;
        this.$ = id => document.getElementById(id);
        this.seed = null;
        this.$('quiz-new').addEventListener('click', () => this.render((Math.random() * 1e6) | 0));
    }
    ensure() { if (this.seed === null) this.render((Math.random() * 1e6) | 0); }

    render(seed) {
        this.seed = seed;
        this.$('quiz-seed').textContent = `question set #${seed}`;
        const rng = new this.E.Rng('olc-quiz-' + seed);
        const gens = [this.qRevcomp, this.qOverlap, this.qFlip, this.qComparisons, this.qTransitive, this.qConsensus, this.qDepth, this.qRepeat, this.qMate, this.qUncovered, this.qContigs, this.qN50, this.qL50, this.qWhich];
        const qs = gens.map(g => g.call(this, rng));
        qs.forEach(q => { if (q.type === 'choice') { const n = q.options.length, rot = rng.int(0, n - 1); q.options = q.options.map((_, j) => q.options[(j + rot) % n]); q.answer = (q.answer - rot + n) % n; } });
        this.draw(qs);
    }

    qRevcomp(rng) {
        const s = rng.seq(8), rc = this.E.revcomp(s);
        const wrong1 = s.split('').reverse().join(''), wrong2 = s.split('').map(c => ({ A: 'T', C: 'G', G: 'C', T: 'A' })[c]).join('');
        return { q: `A read <code>${s}</code> came from the other strand. What sequence does it have on the genome's strand (its reverse complement)?`, type: 'choice',
                 options: [`<code>${rc}</code>`, `<code>${wrong1}</code> (only reversed)`, `<code>${wrong2}</code> (only complemented)`], answer: 0,
                 explanation: `Complement every base (A↔T, C↔G) and read it backwards: <code>${rc}</code>. The two strands run in opposite directions.` };
    }
    qOverlap(rng) {
        let a, b, ov;
        for (let t = 0; t < 50; t++) {
            const g = rng.seq(22), l = rng.int(4, 8);
            a = g.slice(0, 12); b = g.slice(12 - l, 12 - l + 10);
            ov = this.E.dovetail(a, b, 3, 0);
            if (ov && ov.len === l) break;
        }
        return { q: `How long is the (longest) overlap between the end of <code>${a}</code> and the beginning of <code>${b}</code>?`, type: 'number', answer: ov.len, tolerance: 0,
                 explanation: `The last ${ov.len} bases of the first read, <code>${a.slice(-ov.len)}</code>, are the first ${ov.len} bases of the second.` };
    }
    qFlip(rng) {
        const g = rng.seq(20), a = g.slice(0, 12), b = this.E.revcomp(g.slice(6, 18));
        return { q: `Reads <code>${a}</code> and <code>${b}</code> do not overlap as they are. What should the assembler try?`, type: 'choice',
                 options: ['reverse-complement one of them – they probably come from opposite strands', 'reduce the minimum overlap to 1', 'discard both reads', 'reverse (but not complement) one of them'], answer: 0,
                 explanation: `The reverse complement of the second read is <code>${this.E.revcomp(b)}</code>, whose beginning <code>${g.slice(6, 12)}</code> matches the end of the first read.` };
    }
    qComparisons(rng) {
        const n = rng.pick([100, 1000, 10000, 50000]);
        const ans = n * (n - 1) / 2;
        return { q: `How many unordered pairs of reads must be compared in an all-against-all overlap search of ${n.toLocaleString()} reads?`, type: 'number', answer: ans, tolerance: 0,
                 explanation: `n(n − 1)/2 = ${ans.toLocaleString()} – growing with the square of the number of reads (and each pair in two orientations). That is why real tools first find candidate pairs through shared k-mers/minimizers.` };
    }
    qTransitive(rng) {
        const la = rng.int(18, 24), sAB = rng.int(4, 8), sBC = rng.int(4, 8);
        const oAC = la - sAB - sBC;
        return { q: `Reads of ${la} bp: A overlaps B by ${la - sAB} bp, B overlaps C by ${la - sBC} bp, and A overlaps C by ${oAC} bp. Which arrow does transitive reduction remove?`, type: 'choice',
                 options: ['A → C', 'A → B', 'B → C', 'none – all three are needed'], answer: 0,
                 explanation: `B starts ${sAB} bp after A and C ${sBC} bp after B, so C starts ${sAB + sBC} bp after A – exactly what the A → C overlap of ${oAC} bp says. The arrow A → C is implied by A → B → C and adds nothing.` };
    }
    qConsensus(rng) {
        const base = rng.pick(['A', 'C', 'G', 'T']), other = rng.pick(['A', 'C', 'G', 'T'].filter(b => b !== base));
        const n = rng.int(4, 7), wrong = rng.int(1, Math.floor((n - 1) / 2));
        const col = rng.shuffle(Array(n - wrong).fill(base).concat(Array(wrong).fill(other)));
        return { q: `In one column of the layout the reads show ${col.join(', ')}. What is the consensus base?`, type: 'choice', options: [base, other, 'N (undecided)'], answer: 0,
                 explanation: `The majority: ${n - wrong} × ${base} against ${wrong} × ${other}. The ${other} is a sequencing error that the other reads outvote.` };
    }
    qDepth(rng) {
        return { q: 'At a position covered by only two reads, one of them has a sequencing error. What does a majority consensus give?', type: 'choice',
                 options: ['a tie – the base cannot be decided (N) without base qualities', 'the correct base', 'the wrong base', 'a gap'], answer: 0,
                 explanation: 'One vote against one. At least three reads are needed to outvote a single error – one reason assemblies need depth beyond the minimum for overlap.' };
    }
    qRepeat(rng) {
        const L = rng.pick([150, 250, 10000, 20000]), R = rng.pick([300, 1000, 6000]);
        const ok = L > R;
        return { q: `A genome contains two identical copies of a ${R.toLocaleString()} bp transposon. Can overlaps between reads of ${L.toLocaleString()} bp resolve which unique sequence follows which copy?`, type: 'choice',
                 options: ok ? ['yes – a read can span a whole copy and reach unique sequence on both sides', 'no'] : ['no – no read spans a copy; the overlap graph branches at the repeat', 'yes'], answer: 0,
                 explanation: ok ? 'A read longer than the repeat anchors it in unique sequence on both sides, so the copies are distinguished – why long reads assemble repeats.' : 'Every read ends inside the repeat or starts in it; the assembler cannot tell which copy continues where. Longer reads or mate pairs spanning the repeat are needed.' };
    }
    qMate(rng) {
        const R = rng.pick([500, 2000, 5000]), L = 150;
        return { q: `To link the unique sequences on both sides of a ${R.toLocaleString()} bp repeat with read pairs (reads of ${L} bp), the fragments (insert size) must be…`, type: 'choice',
                 options: [`longer than ${R + 2 * L} bp – repeat plus both reads in unique sequence`, `shorter than ${L} bp`, 'exactly as long as the repeat', 'of any length'], answer: 0,
                 explanation: `Both reads of a pair must land in unique sequence on either side, so the fragment must span the repeat plus two read lengths: > ${R + 2 * L} bp. Mate-pair libraries with inserts of several kb were made for exactly this.` };
    }
    qUncovered(rng) {
        const c = rng.pick([1, 2, 3, 5, 8]);
        return { q: `Reads placed at random at ${c}× coverage: what percentage of the genome is expected to be in no read at all? (±0.5)`, type: 'number', answer: +(100 * Math.exp(-c)).toFixed(2), tolerance: 0.5,
                 explanation: `e<sup>−c</sup> = e<sup>−${c}</sup> = ${(100 * Math.exp(-c)).toFixed(2)} % (Lander–Waterman).` };
    }
    qContigs(rng) {
        const G = rng.pick([1e6, 5e6]), L = rng.pick([1000, 5000]), c = rng.pick([3, 4, 5, 6]), th = 0.1;
        const lw = this.E.landerWaterman(G, L, c, th * L);
        return { q: `G = ${G / 1e6} Mb, reads of ${L} bp, coverage ${c}×, overlaps of at least ${th * 100} % of a read are detected. How many contigs does Lander–Waterman predict? (±5 %)`, type: 'number', answer: Math.round(lw.contigs), tolerance: Math.max(1, lw.contigs * 0.05),
                 explanation: `N = c·G/L = ${lw.N.toLocaleString()} reads; N·e<sup>−c(1−θ)</sup> = ${lw.N.toLocaleString()} × e<sup>−${c} × ${1 - th}</sup> = ${lw.contigs.toFixed(0)}.` };
    }
    qN50(rng) {
        const lens = Array.from({ length: rng.int(5, 8) }, () => rng.int(2, 50) * 100), st = this.E.n50(lens);
        return { q: `Contigs of ${lens.join(', ')} bp. What is the N50?`, type: 'number', answer: st.n50, tolerance: 0,
                 explanation: `Sorted: ${st.sorted.join(', ')}; total ${st.total}, half ${st.total / 2}; the running sum first reaches the half at the contig of ${st.n50} bp.` };
    }
    qL50(rng) {
        const lens = Array.from({ length: rng.int(5, 8) }, () => rng.int(2, 50) * 100), st = this.E.n50(lens);
        return { q: `Contigs of ${lens.join(', ')} bp. What is the L50 (how many of the longest contigs hold half of the assembly)?`, type: 'number', answer: st.l50, tolerance: 0,
                 explanation: `Sorted: ${st.sorted.join(', ')}; the first ${st.l50} contig${st.l50 > 1 ? 's' : ''} add up to at least half of ${st.total} bp.` };
    }
    qWhich(rng) {
        return { q: 'You have 800 million Illumina reads of 150 bp. Why is OLC not the method of choice?', type: 'choice',
                 options: ['comparing all pairs of so many reads is infeasible and short overlaps are unreliable – de Bruijn graphs are used instead', 'OLC cannot handle sequencing errors', 'OLC needs a reference genome', 'OLC only works for bacteria'], answer: 0,
                 explanation: 'All-against-all overlaps scale with the square of the number of reads. OLC (and string graphs) is used for fewer, long reads; de Bruijn graphs for many short ones.' };
    }

    draw(qs) {
        const box = this.$('quiz');
        box.innerHTML = '';
        qs.forEach((q, idx) => {
            const item = document.createElement('div'); item.className = 'dp-question';
            item.innerHTML = `<p><strong>${idx + 1}.</strong> ${q.q}</p>`;
            const fb = document.createElement('div'); fb.className = 'dp-feedback'; fb.hidden = true;
            let attempts = 0;
            const judge = (ok, btn) => {
                attempts++; fb.hidden = false; fb.className = 'dp-feedback ' + (ok ? 'correct' : 'wrong');
                if (btn) btn.classList.add(ok ? 'correct' : 'wrong');
                if (ok) { fb.innerHTML = `✔ Correct. ${q.explanation}`; item.querySelectorAll('input,button').forEach(el => el.disabled = true); }
                else if (attempts >= 2) fb.innerHTML = `✘ The answer is <strong>${q.type === 'choice' ? q.options[q.answer] : q.answer.toLocaleString()}</strong>. ${q.explanation}`;
                else fb.textContent = '✘ Not quite – try once more.';
            };
            if (q.type === 'choice') {
                const opts = document.createElement('div'); opts.className = 'dp-options';
                q.options.forEach((t, oi) => { const b = document.createElement('button'); b.innerHTML = t; b.addEventListener('click', () => judge(oi === q.answer, b)); opts.appendChild(b); });
                item.appendChild(opts);
            } else {
                const row = document.createElement('div'); row.className = 'dp-answer-row';
                const inp = document.createElement('input'); inp.type = 'number'; inp.step = 'any';
                const b = document.createElement('button'); b.textContent = 'Check';
                const chk = () => { if (inp.value !== '') judge(Math.abs(parseFloat(inp.value) - q.answer) <= (q.tolerance || 0) + 1e-9); };
                b.addEventListener('click', chk); inp.addEventListener('keydown', e => { if (e.key === 'Enter') chk(); });
                row.appendChild(inp); row.appendChild(b); item.appendChild(row);
            }
            item.appendChild(fb); box.appendChild(item);
        });
    }
}
