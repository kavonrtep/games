/**
 * GENOME INDEX LAB – QUIZ
 * =======================
 * Seeded question generators; answers are computed with BwtEngine.
 */
class BwtQuiz {
    constructor(app) {
        this.app = app; this.E = BwtEngine;
        this.$ = id => document.getElementById(id);
        this.seed = null;
        this.$('quiz-new').addEventListener('click', () => this.render((Math.random() * 1e6) | 0));
    }
    ensure() { if (this.seed === null) this.render((Math.random() * 1e6) | 0); }

    render(seed) {
        this.seed = seed;
        this.$('quiz-seed').textContent = `question set #${seed}`;
        const rng = new this.E.Rng('bwt-quiz-' + seed);
        const gens = [this.qKmerCount, this.qPigeon, this.qSuffixes, this.qSA, this.qSAblock, this.qBWT, this.qFirstCol, this.qRank, this.qLF, this.qInverse, this.qBackward, this.qSteps, this.qMemory, this.qBacktrack];
        const qs = gens.map(g => g.call(this, rng));
        qs.forEach(q => { if (q.type === 'choice') { const right = q.options[q.answer]; q.options = [...new Set(q.options)]; q.answer = q.options.indexOf(right); } });
        qs.forEach(q => { if (q.type === 'choice') { const n = q.options.length, rot = rng.int(0, n - 1); q.options = q.options.map((_, j) => q.options[(j + rot) % n]); q.answer = (q.answer - rot + n) % n; } });
        this.draw(qs);
    }
    text(rng, n) { return rng.seq(n, 'ACGT') + '$'; }
    code(s) { return `<code class="bw-code">${s}</code>`; }

    qKmerCount(rng) {
        const G = rng.pick([1000, 5000, 1e6]), k = rng.pick([11, 15, 21]);
        return { q: `How many k-mer positions does a k-mer index of a ${G.toLocaleString()} bp genome store for k = ${k}?`, type: 'number', answer: G - k + 1, tolerance: 0, explanation: `One per start position: G − k + 1 = ${(G - k + 1).toLocaleString()} – about one number per base of the genome, which is why hash indexes of large genomes are big.` };
    }
    qPigeon(rng) {
        const L = rng.pick([36, 50, 100, 150]), m = rng.int(1, 4);
        return { q: `A read of ${L} bp may contain up to ${m} mismatch${m > 1 ? 'es' : ''}. What is the largest k that still guarantees at least one error-free k-mer seed (non-overlapping pieces)?`, type: 'number', answer: Math.floor(L / (m + 1)), tolerance: 0,
                 explanation: `Cut the read into ${m + 1} pieces: ${m} mismatches can spoil at most ${m} of them (pigeonhole principle), so pieces of ⌊${L}/${m + 1}⌋ = ${Math.floor(L / (m + 1))} bp work.` };
    }
    qSuffixes(rng) {
        const t = this.text(rng, rng.int(5, 9));
        return { q: `How many suffixes (including $) does ${this.code(t)} have?`, type: 'number', answer: t.length, tolerance: 0, explanation: `One starting at every position: ${t.length}. Every occurrence of a pattern is the beginning of one of them.` };
    }
    qSA(rng) {
        const t = this.text(rng, rng.int(5, 7)), sa = this.E.suffixArray(t), r = rng.int(1, t.length - 1);
        return { q: `What is SA[${r}] (row ${r}, rows counted from 0) of the suffix array of ${this.code(t)}?`, type: 'number', answer: sa[r], tolerance: 0,
                 explanation: `Sorted suffixes (with $ first): ${sa.map(i => t.slice(i)).join(', ')}; SA = [${sa.join(', ')}].` };
    }
    qSAblock(rng) {
        return { q: 'Why can all occurrences of a pattern be found by one binary search in a suffix array?', type: 'choice',
                 options: ['all suffixes beginning with the pattern are adjacent in sorted order', 'the suffix array stores the pattern positions directly', 'suffix arrays are hash tables', 'a pattern can occur only once'], answer: 0,
                 explanation: 'Sorting groups equal prefixes: the occurrences form one block of rows, found with two binary searches (its first and last row).' };
    }
    qBWT(rng) {
        const t = this.text(rng, rng.int(4, 6)), L = this.E.bwt(t);
        const wrong1 = t.split('').reverse().join(''), sa = this.E.suffixArray(t), wrong2 = sa.map(i => t[i]).join('');
        return { q: `What is the Burrows–Wheeler transform of ${this.code(t)}?`, type: 'choice', options: [this.code(L), this.code(wrong2) + ' (first column)', this.code(wrong1) + ' (reversed text)'], answer: 0,
                 explanation: `Sort all rotations and read their last letters: ${this.code(L)}.` };
    }
    qFirstCol(rng) {
        const t = this.text(rng, rng.int(5, 7)), F = t.split('').sort((a, b) => (a < b ? -1 : 1)).join('');
        return { q: `The BWT is ${this.code(this.E.bwt(t))}. What is the first column F of the sorted-rotation matrix?`, type: 'choice',
                 options: [this.code(F), this.code(this.E.bwt(t).split('').reverse().join('')), this.code(t)], answer: 0,
                 explanation: 'F contains the same letters as L, sorted: the rows are sorted by their first letter.' };
    }
    qRank(rng) {
        const t = this.text(rng, rng.int(6, 9)), L = this.E.bwt(t), fm = this.E.fmIndex(L), c = rng.pick(['A', 'C', 'G', 'T'].filter(x => L.includes(x))), i = rng.int(1, L.length);
        return { q: `L = ${this.code(L)}. What is Occ(${c}, ${i}) – the number of ${c} in L[0 … ${i - 1}]?`, type: 'number', answer: this.E.rank(fm, c, i), tolerance: 0,
                 explanation: `Count the ${c}s among the first ${i} letters of L (${L.slice(0, i)}): ${this.E.rank(fm, c, i)}.` };
    }
    qLF(rng) {
        const t = this.text(rng, rng.int(6, 8)), L = this.E.bwt(t), fm = this.E.fmIndex(L);
        let r; do { r = rng.int(0, L.length - 1); } while (L[r] === '$');
        const c = L[r], ans = this.E.LF(fm, r);
        return { q: `L = ${this.code(L)}, C[${c}] = ${fm.C[c]}. Row ${r} ends with ${c}. To which row does LF map it?`, type: 'number', answer: ans, tolerance: 0,
                 explanation: `LF(${r}) = C[${c}] + Occ(${c}, ${r}) = ${fm.C[c]} + ${this.E.rank(fm, c, r)} = ${ans}: the row whose rotation starts with this very ${c}.` };
    }
    qInverse(rng) {
        const t = this.text(rng, rng.int(4, 6)), L = this.E.bwt(t);
        const alt = t.slice(0, -1).split('').reverse().join('') + '$', alt2 = t.slice(1, -1) + t[0] + '$';
        const opts = [...new Set([t, alt, alt2])];
        return { q: `Which text has the BWT ${this.code(L)}?`, type: 'choice', options: opts.map(o => this.code(o)), answer: 0,
                 explanation: `Invert with LF-mapping from row 0, reading the text backwards: ${this.code(t)}. Only one text has this BWT.` };
    }
    qBackward(rng) {
        const t = this.text(rng, rng.int(8, 12)), fm = this.E.fmIndex(this.E.bwt(t));
        const p = rng.chance(0.7) ? t.substr(rng.int(0, t.length - 4), rng.int(1, 2)) : rng.seq(2, 'ACGT');
        const bs = this.E.backwardSearch(fm, p);
        return { q: `In ${this.code(t)}, backward search for ${this.code(p)} ends with an interval of how many rows?`, type: 'number', answer: bs.count, tolerance: 0,
                 explanation: `The number of rows = the number of occurrences of ${p}: ${bs.count}${bs.count ? ` (rows ${bs.sp}–${bs.ep - 1})` : ''}.` };
    }
    qSteps(rng) {
        const m = rng.int(15, 150), G = rng.pick(['a bacterium (5 Mb)', 'the human genome (3.1 Gb)', 'wheat (16 Gb)']);
        return { q: `How many backward-search steps are needed to count exact occurrences of a ${m} bp read in ${G}?`, type: 'number', answer: m, tolerance: 0,
                 explanation: `One step per letter of the read: ${m}, independent of the genome size (each step is two rank look-ups).` };
    }
    qMemory(rng) {
        return { q: 'Why did the FM-index replace suffix trees and suffix arrays in short-read mappers?', type: 'choice',
                 options: ['it answers the same queries in memory close to the size of the genome (a few GB for human)', 'it is faster to build than a hash table', 'it allows gaps', 'it stores every read'], answer: 0,
                 explanation: 'A suffix tree needs ~20 bytes per base, a suffix array ~4; the FM-index stores the BWT in 2 bits per base plus sampled Occ and SA – about 3–4 GB for the human genome.' };
    }
    qBacktrack(rng) {
        const z = rng.int(1, 3);
        return { q: `Allowing ${z} mismatch${z > 1 ? 'es' : ''} in a backward search by backtracking…`, type: 'choice',
                 options: ['multiplies the work – at each position the three other letters are tried as well', 'costs nothing extra', 'makes the index larger', 'requires a new index for each read'], answer: 0,
                 explanation: 'Every allowed substitution opens three new branches of the search; the work grows quickly with the number of mismatches (tab 5), which is why modern mappers seed with exact matches first.' };
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
