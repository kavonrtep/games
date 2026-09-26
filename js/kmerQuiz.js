/**
 * K-MER SPECTRUM LAB – QUIZ
 * =========================
 * Seeded question generators; every numerical answer is computed from the
 * formulas of the principle tab (and, for the spectrum questions, from a
 * simulated histogram).
 */
class KmerQuiz {
    constructor(app) {
        this.app = app; this.K = KmerEngine;
        this.$ = id => document.getElementById(id);
        this.seed = null;
        this.$('quiz-new').addEventListener('click', () => this.render((Math.random() * 1e6) | 0));
    }
    ensure() { if (this.seed === null) this.render((Math.random() * 1e6) | 0); }

    render(seed) {
        this.seed = seed;
        this.$('quiz-seed').textContent = `question set #${seed}`;
        const rng = new this.K.Rng('kmer-quiz-' + seed);
        const gens = [this.qCk, this.qCoverageBack, this.qGenomeSize, this.qErrorKmers, this.qCutoff, this.qWhichPeak, this.qHetFraction, this.qHetRate, this.qRepeatPeak, this.qWhyK, this.qCanonical, this.qDiverged, this.qHaploidDiploid];
        const qs = gens.map(g => g.call(this, rng));
        qs.forEach(q => { if (q.type === 'choice') { const n = q.options.length, rot = rng.int(0, n - 1); q.options = q.options.map((_, j) => q.options[(j + rot) % n]); q.answer = (q.answer - rot + n) % n; } });
        this.draw(qs);
    }

    round(x, d) { const f = Math.pow(10, d); return Math.round(x * f) / f; }

    qCk(rng) {
        const C = rng.pick([20, 30, 40, 50, 60]), L = rng.pick([100, 150, 250]), k = rng.pick([17, 21, 25, 31]);
        const ans = C * (L - k + 1) / L;
        return { q: `Reads of ${L} bp at ${C}× coverage, counted with k = ${k}. At what k-mer count do you expect the peak of a haploid genome? (±0.5)`, type: 'number', answer: this.round(ans, 2), tolerance: 0.5,
                 explanation: `C<sub>k</sub> = C·(L − k + 1)/L = ${C} × ${L - k + 1} / ${L} = ${ans.toFixed(2)}. A read contains a given k-mer only if it starts at one of the L − k + 1 positions that keep the k-mer inside the read.` };
    }
    qCoverageBack(rng) {
        const L = rng.pick([100, 150]), k = 21, Ck = rng.int(15, 60);
        const C = Ck * L / (L - k + 1);
        return { q: `The single-copy peak of a haploid genome is at ${Ck}× (k = ${k}, reads of ${L} bp). What is the base coverage C? (±0.5)`, type: 'number', answer: this.round(C, 2), tolerance: 0.5,
                 explanation: `C = C<sub>k</sub> · L / (L − k + 1) = ${Ck} × ${L} / ${L - k + 1} = ${C.toFixed(2)}×. The k-mer coverage is always a bit lower than the base coverage.` };
    }
    qGenomeSize(rng) {
        const peak = rng.int(20, 50), G = rng.int(20, 900) * 1e6, total = G * peak;
        return { q: `The k-mer histogram of a haploid genome has its peak at ${peak}× and Σ n·h(n) above the error cut-off is ${(total / 1e9).toFixed(2)} × 10⁹. What is the genome size in Mbp? (±2 %)`, type: 'number', answer: G / 1e6, tolerance: G / 1e6 * 0.02,
                 explanation: `G = Σ n·h(n) / C<sub>k</sub> = ${(total / 1e9).toFixed(2)} × 10⁹ / ${peak} = ${(G / 1e6).toFixed(0)} Mbp. Every genome position contributes one k-mer, seen C<sub>k</sub> times.` };
    }
    qErrorKmers(rng) {
        const k = rng.pick([17, 21, 25, 31]);
        return { q: `One substitution error lies in the middle of a read. With k = ${k}, how many of the read's k-mers are wrong?`, type: 'number', answer: k, tolerance: 0,
                 explanation: `Every k-mer that covers the error position: ${k} of them. Each almost certainly does not occur in the genome and is seen once – the error spike at the left of the spectrum.` };
    }
    qCutoff(rng) {
        return { q: 'What happens to the genome size estimate if the error k-mers (the spike at 1–3×) are not excluded?', type: 'choice',
                 options: ['it is overestimated: the error k-mers add to Σ n·h(n) although they are not genome positions', 'it is underestimated', 'nothing, errors are too rare to matter', 'the peak disappears'], answer: 0,
                 explanation: 'Every error adds up to k k-mer occurrences that do not belong to any genome position, inflating the total that is divided by the peak depth. Step 4.' };
    }
    qWhichPeak(rng) {
        const lam = rng.int(12, 30);
        return { q: `A diploid genome shows two peaks, at ${lam}× and ${2 * lam}×. Which peak's depth do you divide Σ n·h(n) by to get the haploid genome size?`, type: 'choice',
                 options: [`the ${2 * lam}× peak (homozygous k-mers)`, `the ${lam}× peak (heterozygous k-mers)`, `their average, ${(1.5 * lam).toFixed(1)}×`, 'the higher of the two, whichever it is'], answer: 0,
                 explanation: `The homozygous peak is the depth of one position of the haploid genome, read from both chromosome copies. Dividing by the heterozygous peak (one allele) gives twice the genome size – and the heterozygous peak can be the taller one. Step 5.` };
    }
    qHetFraction(rng) {
        const r = rng.pick([0.001, 0.002, 0.005, 0.01, 0.02]), k = rng.pick([21, 25, 31]);
        const ans = 1 - Math.pow(1 - r, k);
        return { q: `A diploid genome has ${(r * 100).toFixed(1)} % heterozygosity (one SNP per ${Math.round(1 / r)} bp). With k = ${k}, what fraction of k-mer windows contain a heterozygous site? (±0.01)`, type: 'number', answer: this.round(ans, 4), tolerance: 0.01,
                 explanation: `A window is SNP-free with probability (1 − r)<sup>k</sup> = (1 − ${r})<sup>${k}</sup> = ${Math.pow(1 - r, k).toFixed(3)}, so ${ans.toFixed(3)} of the windows contain a SNP. Even modest heterozygosity affects many k-mers because each SNP touches k of them.` };
    }
    qHetRate(rng) {
        const r = rng.pick([0.003, 0.006, 0.01, 0.015]), k = 21, G = 1e6;
        const Nhom = G * Math.pow(1 - r, k), Nhet = 2 * G * (1 - Math.pow(1 - r, k));
        const nh = Math.round(Nhom / 1000) * 1000, nt = Math.round(Nhet / 1000) * 1000;
        const ans = 1 - Math.pow(nh / (nh + nt / 2), 1 / k);
        return { q: `k = 21. The homozygous peak holds ${nh.toLocaleString()} distinct k-mers, the heterozygous peak ${nt.toLocaleString()}. Estimate the heterozygosity r = 1 − (N<sub>hom</sub> / (N<sub>hom</sub> + N<sub>het</sub>/2))<sup>1/k</sup> in %. (±0.05)`, type: 'number', answer: this.round(ans * 100, 3), tolerance: 0.05,
                 explanation: `N<sub>het</sub>/2 counts SNP-containing windows once (each gives two alleles); (1 − r)<sup>k</sup> = ${nh.toLocaleString()} / ${(nh + nt / 2).toLocaleString()} = ${(nh / (nh + nt / 2)).toFixed(4)}, so r = ${(ans * 100).toFixed(3)} %.` };
    }
    qRepeatPeak(rng) {
        const Ck = rng.int(15, 40), c = rng.pick([2, 3, 4, 5]);
        return { q: `In a haploid genome the single-copy peak is at ${Ck}×. Where is the peak of a repeat family present in ${c} identical copies?`, type: 'number', answer: c * Ck, tolerance: 0,
                 explanation: `Each of its k-mers occurs ${c} times in the genome, so it is seen ${c} × ${Ck} = ${c * Ck} times. Each such distinct k-mer stands for ${c} genome positions.` };
    }
    qWhyK(rng) {
        return { q: 'Why is k = 21 (or larger) used instead of, say, k = 11?', type: 'choice',
                 options: ['4²¹ ≈ 4 × 10¹² possible k-mers ≫ genome length, so random k-mers rarely occur twice; with 4¹¹ ≈ 4 × 10⁶ many k-mers repeat by chance', 'longer k-mers are cheaper to count', 'k = 11 is not allowed by jellyfish', 'with short k there are fewer sequencing errors'], answer: 0,
                 explanation: 'The method assumes that a k-mer stands for one genome position. Too short k-mers repeat by chance and pile up at multiples of the peak. Too long k-mers leave fewer k-mers per read (lower C<sub>k</sub>) and are hit more often by errors – 21 is a common compromise.' };
    }
    qCanonical(rng) {
        return { q: 'Why are k-mers counted as "canonical" (<code>jellyfish count -C</code>)?', type: 'choice',
                 options: ['reads come from both strands; a k-mer and its reverse complement are the same genome position and must be counted together', 'to save memory only', 'to remove sequencing errors', 'to separate the two haplotypes'], answer: 0,
                 explanation: 'Without it each position would be split between two k-mers (forward and reverse complement), each at about half the depth.' };
    }
    qDiverged(rng) {
        const d = rng.pick([3, 5, 8]);
        return { q: `A genome is 40 % transposable elements, but the copies differ from each other by about ${d} %. What does the k-mer spectrum show?`, type: 'choice',
                 options: ['much less repeat content than 40 %: most 21-mers differ between copies and look unique', 'exactly 40 % repeats in a peak at 2×', 'a larger genome size than the true one', 'a heterozygous peak'], answer: 0,
                 explanation: `With one difference every ${Math.round(100 / d)} bp most 21-mers of one copy do not occur in the others, so they fall into the single-copy peak. The spectrum sees only young, near-identical repeats (step 6).` };
    }
    qHaploidDiploid(rng) {
        return { q: 'A diploid genome with no heterozygosity at all and a haploid genome of the same sequence give…', type: 'choice',
                 options: ['identical spectra – the ploidy must be supplied to the model', 'spectra with peaks in ratio 1 : 2', 'a heterozygous peak in the diploid case', 'different error spikes'], answer: 0,
                 explanation: 'Without heterozygous sites both copies produce the same k-mers; the spectrum cannot tell that there are two copies. That is why GenomeScope asks for the ploidy (-p).' };
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
                else if (attempts >= 2) fb.innerHTML = `✘ The answer is <strong>${q.type === 'choice' ? q.options[q.answer] : (+q.answer.toFixed(3)).toLocaleString()}</strong>. ${q.explanation}`;
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
