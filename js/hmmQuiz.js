/**
 * HMM EXPLORER – QUIZ
 * ===================
 * Seeded question generators covering the three parts. Every answer is
 * computed with HmmEngine (never typed in), so the numbers change with the
 * seed while the explanation stays valid.
 */
class HmmQuiz {
    constructor(app) {
        this.app = app; this.H = HmmEngine; this.V = HmmViews;
        this.$ = id => document.getElementById(id);
        this.seed = null;
        this.$('quiz-new').addEventListener('click', () => this.render((Math.random() * 1e6) | 0));
    }

    ensure() { if (this.seed === null) this.render((Math.random() * 1e6) | 0); }

    render(seed) {
        this.seed = seed;
        this.$('quiz-seed').textContent = `question set #${seed}`;
        const rng = new this.H.Rng('hmm-quiz-' + seed);
        const gens = [
            this.qJoint, this.qPaths, this.qViterbiCell, this.qForwardCell, this.qRunLength, this.qScoringConcept, this.qPosteriorConcept,
            this.qGapLength, this.qGapOpen, this.qCountAlignments, this.qPairConcept,
            this.qMatchStates, this.qEmission, this.qTransition, this.qBits, this.qEvalue, this.qPssmConcept
        ];
        const qs = gens.map(g => g.call(this, rng));
        this.V.quiz(this.$('quiz'), qs, x => (Number.isInteger(x) ? x.toLocaleString() : Math.abs(x) < 1e-3 || Math.abs(x) > 1e5 ? x.toExponential(2) : (+x.toFixed(3)).toString()));
    }

    // ------------------------------------------------------------ helpers
    round(x, d = 2) { const f = Math.pow(10, d); return Math.round(x * f) / f; }
    smallModel(rng) {
        const a = this.round(0.6 + 0.3 * rng.next(), 1), b = this.round(0.6 + 0.3 * rng.next(), 1);
        const hi = this.round(0.3 + 0.1 * rng.int(0, 1), 1);
        const model = {
            alphabet: 'ACGT', start: [0.5, 0.5], trans: [[a, this.round(1 - a, 1)], [this.round(1 - b, 1), b]],
            states: [
                { key: 'g', name: 'genome', color: '#64748b', emit: { A: hi, C: this.round(0.5 - hi, 1), G: this.round(0.5 - hi, 1), T: hi } },
                { key: 'I', name: 'island', color: '#d97706', emit: { A: this.round(0.5 - hi, 1), C: hi, G: hi, T: this.round(0.5 - hi, 1) } }
            ]
        };
        return model;
    }
    modelTable(m) {
        const A = m.alphabet.split('');
        return `<table class="bl-table hm-qtable"><tr><th></th><th>start</th><th>→ ${m.states[0].key}</th><th>→ ${m.states[1].key}</th>${A.map(a => `<th>e(${a})</th>`).join('')}</tr>
            ${m.states.map((st, k) => `<tr><th>${st.key} (${st.name})</th><td>${m.start[k]}</td><td>${m.trans[k][0]}</td><td>${m.trans[k][1]}</td>${A.map(a => `<td>${st.emit[a]}</td>`).join('')}</tr>`).join('')}</table>`;
    }
    rseq(rng, n, A = 'ACGT') { let s = ''; for (let i = 0; i < n; i++) s += A[rng.int(0, A.length - 1)]; return s; }

    // ------------------------------------------------------------ part 1
    qJoint(rng) {
        const m = this.smallModel(rng), L = 3, x = this.rseq(rng, L), path = Array.from({ length: L }, () => rng.int(0, 1));
        const J = this.H.joint(m, x, path);
        const ans = this.round(J.logp / Math.LN10, 3);
        const fac = J.terms.map(t => t.p).join(' × ');
        return { q: `${this.modelTable(m)}Sequence x = <code>${x}</code>, path π = <code>${path.map(k => m.states[k].key).join('')}</code>. What is log<sub>10</sub> P(x, π)? (±0.01)`,
                 type: 'number', answer: ans, tolerance: 0.01, explanation: `P(x, π) = ${fac} = ${Math.exp(J.logp).toExponential(3)}; log<sub>10</sub> = ${ans}. (Part 1, step 3.)` };
    }
    qPaths(rng) {
        const K = rng.int(2, 3), L = rng.int(5, 10);
        return { q: `An HMM has ${K} states. How many different state paths can produce a sequence of length ${L}?`, type: 'number', answer: Math.pow(K, L), tolerance: 0,
                 explanation: `Each of the ${L} positions can be in any of the ${K} states: ${K}<sup>${L}</sup> = ${Math.pow(K, L).toLocaleString()}. Viterbi avoids trying them all.` };
    }
    qViterbiCell(rng) {
        const m = this.smallModel(rng);
        const v0 = -this.round(1 + 2 * rng.next(), 2), v1 = -this.round(1 + 2 * rng.next(), 2);
        const l = rng.int(0, 1), sym = 'ACGT'[rng.int(0, 3)];
        const c0 = v0 + Math.log10(m.trans[0][l]), c1 = v1 + Math.log10(m.trans[1][l]);
        const ans = this.round(Math.max(c0, c1) + Math.log10(m.states[l].emit[sym]), 3);
        return { q: `${this.modelTable(m)}In the Viterbi table, log<sub>10</sub> v<sub>g</sub>(i−1) = ${v0} and log<sub>10</sub> v<sub>I</sub>(i−1) = ${v1}. The symbol at position i is ${sym}. What is log<sub>10</sub> v<sub>${m.states[l].key}</sub>(i)? (±0.01)`,
                 type: 'number', answer: ans, tolerance: 0.01,
                 explanation: `From g: ${v0} + log ${m.trans[0][l]} = ${c0.toFixed(3)}; from I: ${v1} + log ${m.trans[1][l]} = ${c1.toFixed(3)}. Take the maximum and add log e<sub>${m.states[l].key}</sub>(${sym}) = ${Math.log10(m.states[l].emit[sym]).toFixed(3)} → ${ans}.` };
    }
    qForwardCell(rng) {
        const m = this.smallModel(rng);
        const f0 = this.round(0.001 + 0.02 * rng.next(), 4), f1 = this.round(0.001 + 0.02 * rng.next(), 4);
        const l = rng.int(0, 1), sym = 'ACGT'[rng.int(0, 3)];
        const ans = (f0 * m.trans[0][l] + f1 * m.trans[1][l]) * m.states[l].emit[sym];
        return { q: `${this.modelTable(m)}In the Forward table f<sub>g</sub>(i−1) = ${f0} and f<sub>I</sub>(i−1) = ${f1} (probabilities, not logs). The symbol at position i is ${sym}. What is f<sub>${m.states[l].key}</sub>(i)? (±2 %)`,
                 type: 'number', answer: ans, tolerance: ans * 0.02,
                 explanation: `f = e<sub>${m.states[l].key}</sub>(${sym}) · (f<sub>g</sub> · a<sub>g${m.states[l].key}</sub> + f<sub>I</sub> · a<sub>I${m.states[l].key}</sub>) = ${m.states[l].emit[sym]} × (${f0} × ${m.trans[0][l]} + ${f1} × ${m.trans[1][l]}) = ${ans.toExponential(3)}. Sum instead of max.` };
    }
    qRunLength(rng) {
        const a = rng.pick([0.5, 0.75, 0.8, 0.9, 0.95, 0.98, 0.99]);
        return { q: `A state has self-transition probability ${a}. What is the expected length of a run in that state?`, type: 'number', answer: 1 / (1 - a), tolerance: 0.05,
                 explanation: `Run lengths are geometric: each step leaves with probability ${this.round(1 - a, 2)}, so the mean is 1 / (1 − ${a}) = ${(1 / (1 - a)).toFixed(1)}.` };
    }
    qScoringConcept(rng) {
        const opts = ['the Forward probability P(x), compared with a random model', 'the Viterbi path', 'the posterior probability of the first state', 'the number of possible paths'];
        const order = rng.shuffle([0, 1, 2, 3]);
        return { q: 'You want to decide whether a sequence fits an HMM better than random sequence. Which quantity do you compute?', type: 'choice', options: order.map(i => opts[i]), answer: order.indexOf(0),
                 explanation: 'The Forward algorithm sums over all paths; the log-odds against a null model is the score HMMER reports. The path tells you <em>how</em> it fits, not <em>whether</em>.' };
    }
    qPosteriorConcept(rng) {
        const opts = ['The Viterbi path is the single most probable path; posterior decoding picks the most probable state at each position separately, so the two can differ.',
                      'Posterior decoding always gives the same path as Viterbi.',
                      'Posterior decoding needs only the Forward algorithm.',
                      'The Viterbi path maximises the expected number of correctly labelled positions.'];
        const order = rng.shuffle([0, 1, 2, 3]);
        return { q: 'Which statement about Viterbi and posterior decoding is correct?', type: 'choice', options: order.map(i => opts[i]), answer: order.indexOf(0),
                 explanation: 'Posterior decoding uses Forward and Backward: P(π<sub>i</sub> = k | x) = f<sub>k</sub>(i) b<sub>k</sub>(i) / P(x); it maximises the expected number of correct positions, Viterbi the probability of the whole path.' };
    }

    // ------------------------------------------------------------ part 2
    qGapLength(rng) {
        const e = rng.pick([0.2, 0.25, 0.4, 0.5, 0.6, 0.75, 0.8, 0.9]);
        return { q: `In a pair HMM the gap-extension probability is ε = ${e}. What is the mean length of a gap?`, type: 'number', answer: 1 / (1 - e), tolerance: 0.05,
                 explanation: `Once a gap is open it continues with probability ε: mean length 1 / (1 − ε) = ${(1 / (1 - e)).toFixed(2)}.` };
    }
    qGapOpen(rng) {
        const delta = rng.pick([0.01, 0.02, 0.05, 0.1]), eps = rng.pick([0.3, 0.5, 0.7]), tau = 0.02;
        const M = this.H.pairModel({ type: 'DNA', delta, epsilon: eps, tau, pid: 0.8 });
        const lo = this.H.logOddsScores(M);
        return { q: `A pair HMM has δ = ${delta}, ε = ${eps}, τ = η = ${tau}. Using d = −log<sub>2</sub>[δ(1−ε−τ) / ((1−η)(1−2δ−τ))], what is the gap-opening penalty d in bits? (±0.05)`,
                 type: 'number', answer: this.round(lo.d, 3), tolerance: 0.05,
                 explanation: `d = −log<sub>2</sub>[${delta} × ${this.round(1 - eps - tau, 3)} / (${1 - tau} × ${this.round(1 - 2 * delta - tau, 3)})] = ${lo.d.toFixed(3)} bits. The rarer gaps are (smaller δ), the larger the penalty.` };
    }
    qCountAlignments(rng) {
        const n = rng.int(1, 3), m = rng.int(1, 3);
        const c = this.H.countAlignments(n, m);
        return { q: `How many different alignments of a sequence of length ${n} with a sequence of length ${m} are there, if a gap in one sequence may not be directly followed by a gap in the other (as in the pair HMM: no X → Y transition)?`,
                 type: 'number', answer: c, tolerance: 0,
                 explanation: `Counting paths through the pair HMM with a DP of the same shape as Viterbi (sum of the counts instead of max of the scores) gives ${c}. The number grows exponentially with the lengths.` };
    }
    qPairConcept(rng) {
        const opts = ['Needleman–Wunsch/Gotoh global alignment with affine gaps, with log-odds substitution scores and gap penalties from δ and ε',
                      'Smith–Waterman local alignment with a linear gap penalty', 'BLAST', 'progressive multiple alignment'];
        const order = rng.shuffle([0, 1, 2, 3]);
        return { q: 'Viterbi on the pair HMM (states M, X, Y), written in log-odds form, is equivalent to…', type: 'choice', options: order.map(i => opts[i]), answer: order.indexOf(0),
                 explanation: 'Durbin et al., ch. 4: substitution score = log p(a,b)/q(a)q(b) (+ constant), gap open from δ, gap extension from ε. Part 2, step 3.' };
    }

    // ------------------------------------------------------------ part 3
    qMatchStates(rng) {
        const n = 5, L = 7, rows = [];
        for (let r = 0; r < n; r++) rows.push('');
        const gapCols = new Set(rng.shuffle([0, 1, 2, 3, 4, 5, 6]).slice(0, 3));
        for (let c = 0; c < L; c++) {
            const g = gapCols.has(c) ? rng.int(2, 4) : rng.int(0, 1);
            const who = new Set(rng.shuffle([0, 1, 2, 3, 4]).slice(0, g));
            for (let r = 0; r < n; r++) rows[r] += who.has(r) ? '-' : 'ACGT'[rng.int(0, 3)];
        }
        const mc = this.H.matchColumns(rows, 0.5).filter(Boolean).length;
        return { q: `How many match states does a profile HMM built from this alignment have, if a column becomes a match state when at least half of the sequences have a residue there?<pre class="hm-qmsa">${rows.join('\n')}</pre>`,
                 type: 'number', answer: mc, tolerance: 0, explanation: `Count the columns with at most 2 gaps out of 5: ${mc}. The other columns become insert columns.` };
    }
    qEmission(rng) {
        const N = rng.int(4, 9), c = rng.int(1, N), A = rng.pick([1, 2, 4]), q = 0.25;
        const ans = (c + A * q) / (N + A);
        return { q: `A match column of a DNA alignment has ${N} residues, ${c} of them G. With A = ${A} pseudocounts spread by background (q = 0.25 each), what is the emission probability e(G)? (±0.005)`,
                 type: 'number', answer: this.round(ans, 4), tolerance: 0.005, explanation: `(c + A·q) / (N + A) = (${c} + ${A}×0.25) / (${N} + ${A}) = ${ans.toFixed(4)}.` };
    }
    qTransition(rng) {
        const mm = rng.int(2, 8), mi = rng.int(0, 2), md = rng.int(0, 3), beta = 1;
        const ans = (md + beta) / (mm + mi + md + 3 * beta);
        return { q: `Leaving match state M<sub>k</sub>, the sequences of the alignment make ${mm} M→M, ${mi} M→I and ${md} M→D transitions. With a pseudocount of 1 added to each, what is a(M<sub>k</sub>→D<sub>k+1</sub>)? (±0.005)`,
                 type: 'number', answer: this.round(ans, 4), tolerance: 0.005, explanation: `(${md} + 1) / (${mm} + ${mi} + ${md} + 3) = ${ans.toFixed(4)}.` };
    }
    qBits(rng) {
        const s = rng.int(3, 20);
        return { q: `A sequence scores ${s} bits against a profile HMM. How many times more probable is it under the family model than under the random model?`, type: 'number', answer: Math.pow(2, s), tolerance: 0,
                 explanation: `Bits are log<sub>2</sub> of the likelihood ratio: 2<sup>${s}</sup> = ${Math.pow(2, s).toLocaleString()}.` };
    }
    qEvalue(rng) {
        const S = rng.int(15, 40), tau = -this.round(3 + 3 * rng.next(), 1), Nexp = rng.int(4, 7), N = Math.pow(10, Nexp);
        const E = N * Math.pow(2, -(S - tau));
        return { q: `A hit has a Forward score of ${S} bits; the model's calibration gives τ = ${tau} (λ = ln 2). What is the E-value in a database of 10<sup>${Nexp}</sup> sequences? (within 5 %)`,
                 type: 'number', answer: E, tolerance: E * 0.05,
                 explanation: `E = N · 2<sup>−(S − τ)</sup> = 10<sup>${Nexp}</sup> × 2<sup>−${(S - tau).toFixed(1)}</sup> = ${E.toExponential(2)}.` };
    }
    qPssmConcept(rng) {
        const opts = ['It has insert and delete states, so residues can be added or skipped at a position-specific cost', 'It uses a larger substitution matrix', 'It ignores the conserved columns', 'It only works for DNA'];
        const order = rng.shuffle([0, 1, 2, 3]);
        return { q: 'Why does a profile HMM still recognise a family member with a 4-residue insertion, when a PSSM scan fails?', type: 'choice', options: order.map(i => opts[i]), answer: order.indexOf(0),
                 explanation: 'A PSSM scores an ungapped window: after the insertion every column is misaligned. Part 3, step 6.' };
    }
}
