/**
 * MINIMIZER MAPPING LAB – QUIZ
 * ============================
 * Seeded question generators; answers are computed with MinimizerEngine.
 */
class MinimizerQuiz {
    constructor(app) {
        this.app = app; this.E = MinimizerEngine;
        this.$ = id => document.getElementById(id);
        this.seed = null;
        this.$('quiz-new').addEventListener('click', () => this.render((Math.random() * 1e6) | 0));
    }
    ensure() { if (this.seed === null) this.render((Math.random() * 1e6) | 0); }

    render(seed) {
        this.seed = seed;
        this.$('quiz-seed').textContent = `question set #${seed}`;
        const rng = new this.E.Rng('mm-quiz-' + seed);
        const gens = [this.qWindowMin, this.qDensity, this.qIndexSize, this.qGuarantee, this.qHash, this.qAnchor, this.qGap, this.qChainScore, this.qCigar, this.qCigarLen, this.qMapq, this.qMapqProb, this.qRepeat, this.qSampling];
        const qs = gens.map(g => g.call(this, rng));
        qs.forEach(q => { if (q.type === 'choice') { const right = q.options[q.answer]; q.options = [...new Set(q.options)]; q.answer = q.options.indexOf(right); const n = q.options.length, rot = rng.int(0, n - 1); q.options = q.options.map((_, j) => q.options[(j + rot) % n]); q.answer = (q.answer - rot + n) % n; } });
        this.draw(qs);
    }
    code(s) { return `<code class="bw-code">${s}</code>`; }

    qWindowMin(rng) {
        const k = 3, w = 4, s = rng.seq(w + k - 1);
        const kmers = Array.from({ length: w }, (_, i) => s.substr(i, k));
        const min = kmers.slice().sort()[0];
        return { q: `Window ${this.code(s)}, k = ${k}, w = ${w}, alphabetical order. Which k-mer is the minimizer?`, type: 'choice', options: [...new Set([min, ...kmers])].map(x => this.code(x)), answer: 0,
                 explanation: `The window holds the k-mers ${kmers.join(', ')}; the alphabetically smallest is ${min}.` };
    }
    qDensity(rng) {
        const w = rng.pick([5, 10, 19]);
        return { q: `With random (hash) order, roughly what fraction of all k-mers are minimizers for w = ${w}? (±0.02)`, type: 'number', answer: +(2 / (w + 1)).toFixed(3), tolerance: 0.02,
                 explanation: `About 2/(w + 1) = ${(2 / (w + 1)).toFixed(3)}: a new minimizer appears when the smallest k-mer leaves the window or a smaller one enters it – each with probability ≈ 1/(w + 1) per step.` };
    }
    qIndexSize(rng) {
        const G = rng.pick([5e6, 1e8, 3.1e9]), w = rng.pick([5, 10]);
        const ans = 2 * G / (w + 1);
        return { q: `About how many minimizer positions does an index of a ${G >= 1e9 ? (G / 1e9) + ' Gb' : (G / 1e6) + ' Mb'} genome store for w = ${w}? (within 10 %)`, type: 'number', answer: Math.round(ans), tolerance: ans * 0.1,
                 explanation: `2/(w + 1) × G = ${ans.toExponential(2)} – instead of one position per base.` };
    }
    qGuarantee(rng) {
        const k = rng.pick([11, 15, 19]), w = rng.pick([5, 10, 15]);
        return { q: `k = ${k}, w = ${w}. How long must an exact common stretch of two sequences be to guarantee that they share a minimizer?`, type: 'number', answer: w + k - 1, tolerance: 0,
                 explanation: `w + k − 1 = ${w + k - 1}: such a stretch contains a whole window of ${w} k-mers, and both sequences pick the same smallest one in it.` };
    }
    qHash(rng) {
        return { q: 'Why does minimap2 order k-mers by a hash rather than alphabetically?', type: 'choice',
                 options: ['alphabetical order prefers A-rich, low-complexity k-mers (AAAA… is smallest), which are frequent and useless as seeds', 'hashing makes the index exact', 'alphabetical order is not defined for DNA', 'a hash makes k-mers shorter'], answer: 0,
                 explanation: 'A pseudo-random order spreads minimizers evenly and does not favour poly-A or repeats.' };
    }
    qAnchor(rng) {
        const q = rng.int(100, 900), t = rng.int(2000, 9000), d = rng.int(80, 300);
        return { q: `An anchor lies at read ${q} ↔ reference ${t}. Another anchor of the same (+ strand) read lies at read ${q + d}. If there is no insertion or deletion between them, at which reference position is it?`, type: 'number', answer: t + d, tolerance: 0,
                 explanation: `On the same diagonal: the reference advances as much as the read, ${t} + ${d} = ${t + d}. A shift away from this diagonal means an indel.` };
    }
    qGap(rng) {
        const k = 15, l = rng.pick([2, 4, 8, 16]);
        const ans = this.E.gapCost(l, k);
        return { q: `minimap2's gap cost is γ(l) = 0.01·k·l + ½·log<sub>2</sub>(l). What is it for k = ${k} and a ${l} bp indel between two anchors? (±0.05)`, type: 'number', answer: +ans.toFixed(3), tolerance: 0.05,
                 explanation: `0.01 × ${k} × ${l} + 0.5 × log2(${l}) = ${(0.01 * k * l).toFixed(2)} + ${(0.5 * Math.log2(l)).toFixed(2)} = ${ans.toFixed(2)} – small compared with the ≤ ${k} bases an anchor adds, so chains survive indels.` };
    }
    qChainScore(rng) {
        const k = 15, f = rng.int(30, 80), dq = rng.int(20, 60), l = rng.pick([0, 2, 3]);
        const dt = dq + l, ans = f + Math.min(dq, dt, k) - this.E.gapCost(l, k);
        return { q: `k = ${k}. The best chain ending at anchor j scores f(j) = ${f}. Anchor i lies ${dq} bp further in the read and ${dt} bp further in the reference. What does the chain through j give at i? (±0.1)`, type: 'number', answer: +ans.toFixed(2), tolerance: 0.1,
                 explanation: `f(j) + α − β = ${f} + min(${dq}, ${dt}, ${k}) − γ(${l}) = ${f} + ${Math.min(dq, dt, k)} − ${this.E.gapCost(l, k).toFixed(2)} = ${ans.toFixed(2)}.` };
    }
    qCigar(rng) {
        return { q: 'In a CIGAR string such as 120M2I45M3D200M, what does 3D mean?', type: 'choice',
                 options: ['3 bases present in the reference but missing from the read (a deletion)', '3 extra bases in the read (an insertion)', '3 mismatches', '3 bases clipped from the read end'], answer: 0,
                 explanation: 'M: aligned bases (match or mismatch), I: insertion (in the read only), D: deletion (in the reference only).' };
    }
    qCigarLen(rng) {
        const a = rng.int(50, 300), i = rng.int(1, 5), b = rng.int(30, 200), d = rng.int(1, 6), c = rng.int(50, 400);
        return { q: `How many bases of the read does the alignment ${this.code(`${a}M${i}I${b}M${d}D${c}M`)} cover?`, type: 'number', answer: a + i + b + c, tolerance: 0,
                 explanation: `M and I consume read bases, D does not: ${a} + ${i} + ${b} + ${c} = ${a + i + b + c}.` };
    }
    qMapq(rng) {
        const f1 = rng.int(200, 900), f2 = Math.round(f1 * rng.pick([0, 0.5, 0.8, 0.95, 1])), m = rng.int(12, 60);
        const q = this.E.mapq({ score: f1, anchors: { length: m } }, f2 ? [{ score: f2 }] : []).mapq;
        return { q: `Primary chain score f1 = ${f1} with ${m} anchors; the best secondary chain scores f2 = ${f2}. MAPQ = 40·(1 − f2/f1)·min(1, m/10)·ln f1, capped at 60. What is the MAPQ? (±1)`, type: 'number', answer: q, tolerance: 1,
                 explanation: `40 × (1 − ${f2}/${f1}) × ${Math.min(1, m / 10)} × ln ${f1} = ${(40 * (1 - f2 / f1) * Math.min(1, m / 10) * Math.log(f1)).toFixed(1)} → ${q}${f2 === f1 ? ': an equally good alternative gives 0' : ''}.` };
    }
    qMapqProb(rng) {
        const q = rng.pick([10, 20, 30, 40]);
        return { q: `A read has MAPQ ${q}. What is the estimated probability that it is placed wrongly?`, type: 'number', answer: Math.pow(10, -q / 10), tolerance: Math.pow(10, -q / 10) * 0.01,
                 explanation: `MAPQ = −10·log10(P(wrong)), so P = 10^(−${q}/10) = ${Math.pow(10, -q / 10)}.` };
    }
    qRepeat(rng) {
        const R = rng.pick([2000, 6000]), L = rng.pick([1000, 15000]);
        const ok = L > R + 1000;
        return { q: `A read of ${L.toLocaleString()} bp comes from a genome with two identical ${R.toLocaleString()} bp copies of a repeat; the read overlaps one copy. What MAPQ do you expect?`, type: 'choice',
                 options: ok ? ['high – if it spans the whole copy, its unique flanks make the true chain score clearly higher', 'always 0'] : ['low (near 0) if the read lies inside the copy – both copies give equally good chains', 'always 60'], answer: 0,
                 explanation: ok ? 'Anchors from unique sequence on both sides exist only at the true copy.' : 'Inside a repeat copy the read matches both copies equally well: f2 ≈ f1, MAPQ ≈ 0.' };
    }
    qSampling(rng) {
        return { q: 'What distinguishes syncmers from minimizers?', type: 'choice',
                 options: ['a syncmer is selected by its own sequence only, independent of neighbouring k-mers', 'syncmers are longer k-mers', 'syncmers use alphabetical order', 'syncmers select every k-mer'], answer: 0,
                 explanation: 'Minimizers depend on the whole window, so a mutation nearby can change the choice; syncmers (and strobemers, which join several k-mers at variable distance) are designed to be more robust to errors.' };
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
                else if (attempts >= 2) fb.innerHTML = `✘ The answer is <strong>${q.type === 'choice' ? q.options[q.answer] : q.answer.toLocaleString(undefined, { maximumSignificantDigits: 6 })}</strong>. ${q.explanation}`;
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
