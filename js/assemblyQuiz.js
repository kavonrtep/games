/**
 * ASSEMBLY EXPLORER – QUIZ
 * ========================
 * Seeded question generators. Numerical answers are computed (with the
 * engine where a graph is involved), never typed in.
 */
class AssemblyQuiz {
    constructor(app) {
        this.app = app; this.D = DeBruijn;
        this.$ = id => document.getElementById(id);
        this.seed = null;
        this.$('quiz-new').addEventListener('click', () => this.render((Math.random() * 1e6) | 0));
    }

    ensure() { if (this.seed === null) this.render((Math.random() * 1e6) | 0); }

    render(seed) {
        this.seed = seed;
        this.$('quiz-seed').textContent = `question set #${seed}`;
        const r = this.D.rngFrom(seed * 2654435761);
        const rng = { next: r, int: (a, b) => a + Math.floor(r() * (b - a + 1)), pick: arr => arr[Math.floor(r() * arr.length)], seq: n => this.D.randomBases(n, r) };
        const gens = [this.qKmersInRead, this.qDistinct, this.qEdge, this.qEdgesGenome, this.qCoverage, this.qRepeatK, this.qMaxRepeat, this.qErrorKmers, this.qGap, this.qThreshold, this.qN50, this.qTipBubble, this.qSmallK];
        const qs = gens.map(g => g.call(this, rng));
        qs.forEach((q, i) => { if (q.type === 'choice') { const n = q.options.length, rot = rng.int(0, n - 1); q.options = q.options.map((_, j) => q.options[(j + rot) % n]); q.answer = (q.answer - rot + n) % n; } });
        this.draw(qs);
    }

    // ------------------------------------------------------------ generators
    qKmersInRead(rng) {
        const L = rng.int(50, 250), k = rng.pick([21, 25, 31, 41, 55]);
        return { q: `How many k-mers does a read of ${L} bp contain for k = ${k}?`, type: 'number', answer: L - k + 1, tolerance: 0, explanation: `L − k + 1 = ${L} − ${k} + 1 = ${L - k + 1}: one k-mer starts at every position that leaves k letters to the end.` };
    }
    qDistinct(rng) {
        let s, k, n;
        for (let t = 0; t < 50; t++) {
            s = rng.seq(rng.int(11, 14)); k = rng.int(3, 4);
            // plant a repeated k-mer so the answer is not simply L − k + 1
            const w = s.substr(rng.int(0, s.length - k), k), p = rng.int(0, s.length - k);
            s = s.slice(0, p) + w + s.slice(p + k);
            const all = new Set(); for (let i = 0; i + k <= s.length; i++) all.add(s.substr(i, k));
            n = all.size; if (n < s.length - k + 1) break;
        }
        return { q: `How many <em>distinct</em> ${k}-mers does the sequence <code>${s}</code> contain?`, type: 'number', answer: n, tolerance: 0,
                 explanation: `${s.length} − ${k} + 1 = ${s.length - k + 1} positions, but some ${k}-mers occur more than once; only ${n} are different. Each distinct k-mer is one edge of the de Bruijn graph.` };
    }
    qEdge(rng) {
        const km = rng.seq(rng.int(5, 7));
        return { q: `In a de Bruijn graph with k = ${km.length}, the k-mer <code>${km}</code> becomes…`, type: 'choice',
                 options: [`an edge from <code>${km.slice(0, -1)}</code> to <code>${km.slice(1)}</code>`, `an edge from <code>${km.slice(0, -2)}</code> to <code>${km.slice(2)}</code>`, `a node <code>${km}</code> with edges to all its neighbours`, `an edge from <code>${km[0]}</code> to <code>${km[km.length - 1]}</code>`], answer: 0,
                 explanation: 'Edges are k-mers, nodes are (k−1)-mers: the prefix and the suffix of the k-mer, which overlap in k − 2 letters.' };
    }
    qEdgesGenome(rng) {
        const G = rng.int(200, 5000), k = rng.pick([21, 31, 51]);
        return { q: `A genome of ${G.toLocaleString()} bp has no repeated (k−1)-mer and is completely covered by reads. With k = ${k}, how many edges does its de Bruijn graph have?`, type: 'number', answer: G - k + 1, tolerance: 0,
                 explanation: `One edge per distinct k-mer: G − k + 1 = ${G - k + 1}. The graph is a single path of ${G - k + 2} nodes – and the contig is the whole genome.` };
    }
    qCoverage(rng) {
        const N = rng.pick([2e6, 5e6, 1e7, 4e7]), L = rng.pick([100, 150, 250]), G = rng.pick([5e6, 1.2e7, 1e8]);
        const c = N * L / G;
        return { q: `${(N / 1e6).toLocaleString()} million reads of ${L} bp from a ${(G / 1e6).toLocaleString()} Mbp genome: what is the mean coverage (×)? (±0.1)`, type: 'number', answer: +c.toFixed(2), tolerance: 0.1,
                 explanation: `coverage = N·L / G = ${N.toExponential(0)} × ${L} / ${G.toExponential(1)} = ${c.toFixed(2)}×.` };
    }
    qRepeatK(rng) {
        // validated with the engine: regenerate until the first k giving the whole genome is exactly R + 2
        let R;
        for (let t = 0; t < 30; t++) {
            R = rng.int(4, 9);
            const p = { uniqueLen: 12, repeatLength: R, repeatCopies: 2, readLength: R + 8, coverage: R + 8, k: 3, errorRate: 0, pruneThreshold: 1, seed: rng.int(1, 1e6) };
            const first = this.D.sweepK(p).find(s => s.whole);
            if (first && first.k === R + 2) break;
        }
        return { q: `A genome contains two copies of a ${R} bp repeat; the bases next to the copies differ and there are no other repeats. Reads are long and coverage is deep. What is the smallest k that separates the two copies?`, type: 'number', answer: R + 2, tolerance: 0,
                 explanation: `A (k−1)-mer lying inside the repeat is shared by both copies. The copies are told apart only when every (k−1)-mer reaches past the repeat into unique sequence: k − 1 ≥ R + 1, so k ≥ R + 2 = ${R + 2}. With k = R + 1 the repeat itself is one shared node. See tab 2.` };
    }
    qMaxRepeat(rng) {
        const L = rng.pick([100, 150, 250]);
        return { q: `With reads of ${L} bp (and k at most ${L}), what is the longest repeat that a de Bruijn graph can still resolve?`, type: 'number', answer: L - 2, tolerance: 0,
                 explanation: `k ≤ L and the repeat needs k ≥ R + 2, so R ≤ L − 2 = ${L - 2}. Longer repeats need longer reads, or read pairs whose two ends lie on either side of the repeat.` };
    }
    qErrorKmers(rng) {
        const k = rng.pick([21, 25, 31]), L = rng.pick([100, 150]);
        return { q: `A read of ${L} bp has one wrong base in its middle. With k = ${k}, how many of its k-mers are wrong?`, type: 'number', answer: k, tolerance: 0,
                 explanation: `Every k-mer that contains the wrong position: k of them (the error sits at each of the k offsets once). Each is almost certainly seen only in this read – a bubble in the graph.` };
    }
    qGap(rng) {
        const L = rng.int(12, 20), k = rng.int(6, L - 2), step = rng.int(2, L - 4);
        const ok = step <= L - k + 1;
        return { q: `Reads of ${L} bp start every ${step} bp along the genome. With k = ${k}, is every k-mer of the genome contained in at least one read?`, type: 'choice',
                 options: ok ? ['yes', 'no'] : ['no', 'yes'], answer: 0,
                 explanation: `A read contains the k-mers starting at its first L − k + 1 = ${L - k + 1} positions. Consecutive reads start ${step} bp apart, so ${ok ? `${step} ≤ ${L - k + 1}: no k-mer is missed` : `${step} > ${L - k + 1}: the k-mers starting in between are in no read and the path breaks`}.` };
    }
    qThreshold(rng) {
        const lo = rng.int(1, 2), hiA = rng.int(8, 12), hiB = hiA + rng.int(5, 10);
        const good = lo + 1 + rng.int(0, 2);
        return { q: `In the k-mer count histogram, error k-mers are seen ${lo === 1 ? 'once' : '1–2 times'}, true k-mers ${hiA}–${hiB} times. Which coverage threshold removes the errors but keeps the genome?`, type: 'choice',
                 options: [`${good}×`, '1×', `${hiB + 5}×`], answer: 0,
                 explanation: `The threshold belongs in the valley between the two peaks. 1× keeps every error; ${hiB + 5}× removes the genome as well.` };
    }
    qN50(rng) {
        const n = rng.int(5, 8), lens = [];
        for (let i = 0; i < n; i++) lens.push(rng.int(2, 40) * 10);
        const ans = this.D.n50(lens);
        const total = lens.reduce((a, b) => a + b, 0);
        return { q: `An assembly has contigs of ${lens.join(', ')} bp. What is its N50?`, type: 'number', answer: ans, tolerance: 0,
                 explanation: `Sort from longest (${lens.slice().sort((a, b) => b - a).join(', ')}) and add up until half of the total (${total / 2} of ${total} bp) is reached: the contig that crosses the half is ${ans} bp. Half of the assembly lies in contigs at least this long.` };
    }
    qTipBubble(rng) {
        return { q: 'A sequencing error in the last few bases of a read produces…', type: 'choice',
                 options: ['a tip: a short dead-end branch off the true path', 'a bubble: a parallel path that rejoins the true path', 'a longer repeat', 'nothing, errors at read ends are ignored'], answer: 0,
                 explanation: 'Near the end of the read the wrong k-mers never reach a k-mer that is correct again, so the detour ends blind (a tip). An error in the middle is followed by correct k-mers again: the detour rejoins the true path – a bubble.' };
    }
    qSmallK(rng) {
        const k = rng.pick([3, 4, 5]);
        return { q: `Why does a de Bruijn graph with k = ${k} tangle even for a genome without designed repeats?`, type: 'choice',
                 options: [`there are only 4<sup>${k - 1}</sup> = ${Math.pow(4, k - 1)} different (k−1)-mers, so in a longer genome many occur more than once by chance`, 'small k makes more sequencing errors', 'the reads are too long for small k', 'small k means fewer k-mers per read'], answer: 0,
                 explanation: 'Short words repeat by chance: every repeated (k−1)-mer is a shared node with several ways in and out. That is why real assemblers use k of 21–127.' };
    }

    // ------------------------------------------------------------ rendering (same pattern as the other quizzes)
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
