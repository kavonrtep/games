/**
 * BLAST EXPLORER – controller
 * ===========================
 * Drives blast.html: scenario/program/parameters, the six pipeline steps
 * with the hit map and X-drop chart, the five experiments and the quiz.
 */
class BlastLab {
    constructor() {
        this.B = BlastEngine; this.E = AlignEngine;
        this.$ = id => document.getElementById(id);
        this.seed = 1;
        this.scenario = null;
        this.result = null;
        this.step = 1;
        this.selectedHsp = 0;
        this.wordIndex = 0;
        this.selectedWord = 0;
        this.anim = null;

        this.bindTabs();
        this.bindScenario();
        this.bindParams();
        this.bindSteps();
        this.bindExperiments();
        this.loadScenario('dna-family');
    }

    // ------------------------------------------------------------ UI plumbing
    bindTabs() {
        document.querySelectorAll('.bl-tab').forEach(b => b.addEventListener('click', () => {
            document.querySelectorAll('.bl-tab').forEach(x => x.classList.toggle('active', x === b));
            ['pipeline', 'experiments', 'quiz'].forEach(t => this.$('tab-' + t).hidden = t !== b.dataset.tab);
            if (b.dataset.tab === 'quiz') this.renderQuiz();
            if (b.dataset.tab === 'experiments') this.renderEvalue();
        }));
    }

    bindScenario() {
        const sel = this.$('scenario');
        for (const [key, sc] of Object.entries(this.B.SCENARIOS)) { const o = document.createElement('option'); o.value = key; o.textContent = sc.name; sel.appendChild(o); }
        sel.addEventListener('change', () => this.loadScenario(sel.value));
        this.$('reroll').addEventListener('click', () => { this.seed++; this.loadScenario(this.$('scenario').value); });
    }

    bindParams() {
        document.querySelectorAll('input[name="program"]').forEach(r => r.addEventListener('change', () => this.applyProgram(r.value)));
        document.querySelectorAll('input[name="scoring"]').forEach(r => r.addEventListener('change', () => this.run()));
        const slider = (id, valueId, fmt) => { const el = this.$(id); el.addEventListener('input', () => { this.$(valueId).textContent = fmt(+el.value); this.run(); }); };
        slider('word', 'word-value', v => v);
        slider('T', 'T-value', v => v);
        slider('xdrop', 'xdrop-value', v => v);
        slider('A', 'A-value', v => v);
        slider('dbsize', 'dbsize-value', v => this.dbFactorLabel(v));
        slider('ecut', 'ecut-value', v => this.ecutLabel(v));
        this.$('two-hit').addEventListener('change', () => this.run());
        this.$('mask').addEventListener('change', () => this.run());
    }

    dbFactorLabel(v) { return v === 0 ? '1×' : `10<sup>${v}</sup>×`; }
    dbFactor() { return Math.pow(10, +this.$('dbsize').value); }
    ecutLabel(v) { return v === 1 ? '10' : v === 2 ? '100' : v === 0 ? '1' : `10<sup>${v}</sup>`; }
    ecut() { return Math.pow(10, +this.$('ecut').value); }

    bindSteps() {
        document.querySelectorAll('.bl-step').forEach(b => b.addEventListener('click', () => this.showStep(+b.dataset.step)));
        this.$('step-prev').addEventListener('click', () => this.showStep(this.step - 1));
        this.$('step-next').addEventListener('click', () => this.showStep(this.step + 1));
    }

    bindExperiments() {
        this.$('run-wordsize').addEventListener('click', () => this.renderWordSize());
        this.$('run-translated').addEventListener('click', () => this.renderTranslated());
        this.$('run-shuffle').addEventListener('click', () => this.renderEvalue(true));
        this.$('run-masking').addEventListener('click', () => this.renderMasking());
        this.$('run-sw').addEventListener('click', () => this.renderSw());
    }

    // ------------------------------------------------------------ scenario & parameters
    loadScenario(key) {
        this.scenario = this.B.buildScenario(key, this.seed);
        this.$('scenario').value = key;
        this.$('scenario-note').textContent = this.scenario.note;
        const protein = this.scenario.type === 'PROTEIN';
        document.querySelectorAll('input[name="program"]').forEach(r => {
            const isP = r.value === 'blastp';
            r.disabled = protein ? !isP : isP;
            r.parentElement.classList.toggle('disabled', r.disabled);
        });
        this.applyProgram(protein ? 'blastp' : (key === 'short-query' ? 'blastn' : 'blastn'));
    }

    applyProgram(key) {
        const P = this.B.PROGRAMS[key];
        document.querySelector(`input[name="program"][value="${key}"]`).checked = true;
        this.$('program-note').textContent = P.note;
        const set = (id, v) => { this.$(id).value = v; this.$(id + '-value').textContent = v; };
        this.$('word').min = P.type === 'PROTEIN' ? 2 : 4;     // range first, then value, or the value is clamped
        this.$('word').max = P.type === 'PROTEIN' ? 4 : 28;
        set('word', P.word);
        set('xdrop', P.xDrop);
        if (P.T) set('T', P.T);
        if (P.A) set('A', P.A);
        this.$('two-hit').checked = !!P.twoHit;
        this.$('t-group').hidden = P.type !== 'PROTEIN';
        this.$('a-group').hidden = false;
        this.$('dna-scoring').hidden = P.type === 'PROTEIN';
        if (P.type === 'DNA') document.querySelector(`input[name="scoring"][value="${P.reward}:${P.penalty}"]`).checked = true;
        this.run();
    }

    params() {
        const key = document.querySelector('input[name="program"]:checked').value;
        const P = Object.assign({}, this.B.PROGRAMS[key], { key });
        P.word = +this.$('word').value;
        P.xDrop = +this.$('xdrop').value;
        P.T = +this.$('T').value;
        P.A = +this.$('A').value;
        P.twoHit = this.$('two-hit').checked;
        if (P.type === 'DNA') { const [r, m] = document.querySelector('input[name="scoring"]:checked').value.split(':').map(Number); P.reward = r; P.penalty = m; }
        if (key !== 'dc-megablast') P.template = null;
        return P;
    }

    run() {
        if (!this.scenario) return;
        const P = this.params();
        const t0 = performance.now();
        this.result = this.B.search(this.scenario.query, this.scenario.db, P, { mask: this.$('mask').checked, dbSizeFactor: this.dbFactor() });
        this.result.ms = performance.now() - t0;
        this.selectedHsp = 0;
        this.renderSequences();
        this.showStep(this.step);
        if (!this.$('tab-quiz').hidden) this.renderQuiz();
        if (!this.$('tab-experiments').hidden) this.renderEvalue();
    }

    // ------------------------------------------------------------ sequences panel
    seqHtml(seq, cls = '') {
        return `<span class="bl-seq ${cls}">${seq.split('').map(c => `<span class="${/[a-z]/.test(c) ? 'masked' : ''}">${c}</span>`).join('')}</span>`;
    }

    truthTag(t) {
        if (!t) return '';
        const txt = t.kind === 'homolog' ? `planted homolog · ${Math.round(t.identity * 100)} %` : t.kind === 'synonymous' ? 'synonymous ortholog' : t.kind === 'lowcomplexity' ? 'CA repeat only' : 'unrelated';
        return `<span class="bl-truth ${t.kind}">${txt}</span>`;
    }

    renderSequences() {
        const r = this.result;
        this.$('query-view').innerHTML = `<div class="bl-seqname">query · ${r.query.length} ${r.params.type === 'PROTEIN' ? 'aa' : 'bp'}</div>${this.seqHtml(r.query)}`;
        const hitsBySubject = r.scan.perSubject.map(ps => ps.hits.length);
        const best = {};
        for (const x of r.results) if (best[x.subject] === undefined) best[x.subject] = x.evalue;
        this.$('db-view').innerHTML = r.db.map((s, i) => `<div class="bl-dbrow"><div class="bl-dbhead"><span class="bl-seqname">${s.name} · ${s.seq.length}</span>${this.truthTag(s.truth)}<span class="bl-dbstat">${hitsBySubject[i]} hits${best[i] !== undefined ? ` · E = ${this.fmtE(best[i])}` : ''}</span></div>${this.seqHtml(s.seq, 'small')}</div>`).join('');
    }

    fmtE(e) { return e < 1e-3 ? e.toExponential(1) : e < 10 ? e.toFixed(2) : e.toFixed(0); }

    // ------------------------------------------------------------ pipeline steps
    showStep(k) {
        this.step = Math.max(1, Math.min(6, k));
        document.querySelectorAll('.bl-step').forEach(b => b.classList.toggle('active', +b.dataset.step === this.step));
        this.$('step-prev').disabled = this.step === 1;
        this.$('step-next').disabled = this.step === 6;
        if (this.anim) { clearInterval(this.anim); this.anim = null; }
        const c = this.$('step-content');
        const fn = ['renderWords', 'renderScan', 'renderSeeds', 'renderUngapped', 'renderGapped', 'renderStats'][this.step - 1];
        c.innerHTML = this[fn]();
        this.afterRender();
    }

    afterRender() {
        const c = this.$('step-content');
        c.querySelectorAll('[data-word]').forEach(el => el.addEventListener('click', () => { this.selectedWord = +el.dataset.word; this.showStep(this.step); }));
        c.querySelectorAll('[data-hsp]').forEach(el => el.addEventListener('click', () => { this.selectedHsp = +el.dataset.hsp; this.showStep(this.step); }));
        const wi = c.querySelector('#word-index');
        if (wi) wi.addEventListener('input', () => { this.wordIndex = +wi.value; this.showStep(1); });
        const canvas = c.querySelector('canvas.bl-hitmap');
        if (canvas) this.drawHitMap(canvas, this.step);
        const play = c.querySelector('#xdrop-play');
        if (play) play.addEventListener('click', () => this.animateXdrop());
        const svg = c.querySelector('#xdrop-chart');
        if (svg) this.drawXdrop(svg);
    }

    // ---- step 1: words
    renderWords() {
        const r = this.result, P = r.params, wt = r.wordTable, span = wt.span;
        const q = r.query;
        this.wordIndex = Math.min(this.wordIndex, Math.max(0, q.length - span));
        const i = this.wordIndex;
        const inWord = k => k >= i && k < i + span && (!P.template || P.template[k - i] === '1');
        const qh = q.split('').map((c, k) => `<span class="${inWord(k) ? 'hl' : ''}${/[a-z]/.test(c) ? ' masked' : ''}">${c}</span>`).join('');
        const entry = wt.words.find(w => w.pos === i);
        const distinct = wt.table.size;
        let nb = '';
        if (P.type === 'PROTEIN') {
            const w = wt.words[Math.min(this.selectedWord, wt.words.length - 1)];
            if (w) nb = `<h4>Neighbourhood of query word <code>${w.word}</code> (position ${w.pos + 1}) with T = ${P.T}</h4>
                <p class="dp-hint">Every 3-letter word whose BLOSUM62 score against <code>${w.word}</code> is at least T is put into the lookup table and counts as a hit. ${w.neighbours.length} words qualify${w.neighbours.length ? `; the exact word scores ${w.neighbours[0].score}` : ''}.</p>
                <div class="bl-chips">${w.neighbours.slice(0, 60).map(n => `<span class="bl-chip ${n.word === w.word ? 'exact' : ''}" title="score ${n.score}">${n.word}<small>${n.score}</small></span>`).join('')}${w.neighbours.length > 60 ? `<span class="bl-chip">… ${w.neighbours.length - 60} more</span>` : ''}</div>`;
        }
        return `
            <h3>Step 1 – Break the query into words</h3>
            <p>${P.type === 'PROTEIN'
                ? `blastp uses words of ${P.word} residues. A database word counts as a hit not only when it is identical but whenever it scores at least T = ${P.T} against a query word – the <em>neighbourhood</em>. That is how protein searches stay sensitive with such short words.`
                : P.template
                    ? `Discontiguous megablast uses a template of ${P.template.length} positions of which ${P.template.split('1').length - 1} must match (<code>${P.template}</code>, 1 = must match, 0 = ignored). The ignored positions are where third codon positions tend to fall.`
                    : `${P.label} uses exact words of w = ${P.word}. A window slides along the query; each window is a key in a hash table pointing back to its query position. The database is then scanned once, looking every database word up in this table – no alignment yet, just lookups.`}</p>
            <div class="bl-seqline">${qh}</div>
            <div class="dp-answer-row"><label for="word-index">word at query position ${i + 1}</label><input type="range" id="word-index" min="0" max="${Math.max(0, q.length - span)}" value="${i}" style="flex:1"></div>
            <p>${entry ? `Word: <code>${entry.word}</code>` : '<em>no word here (masked residues)</em>'} · <strong>${wt.words.length}</strong> words from a ${q.length}-residue query · lookup table has <strong>${distinct}</strong> distinct keys${P.type === 'PROTEIN' ? ` (including <strong>${wt.neighbourhoodSize}</strong> neighbourhood words)` : ''}.</p>
            ${P.type === 'PROTEIN' ? `<div class="bl-chips">${wt.words.map((w, k) => `<span class="bl-chip ${k === this.selectedWord ? 'sel' : ''}" data-word="${k}">${w.word}</span>`).join('')}</div>${nb}` : `<div class="bl-chips small">${wt.words.map(w => `<span class="bl-chip ${w.pos === i ? 'sel' : ''}">${w.word}</span>`).join('')}</div>`}
            <div class="bl-lesson"><strong>Principle.</strong> Instead of comparing every query position with every database position (Smith–Waterman: ${(r.query.length * r.stats.dbLength / this.dbFactor()).toLocaleString()} cells here), BLAST only follows up positions that share a word. ${P.type === 'DNA' ? 'Longer words → fewer chance hits → faster, but a homolog with no identical stretch of w bases is invisible.' : 'The neighbourhood trades table size for sensitivity: lower T finds more distant homologs and costs more lookups.'}</div>`;
    }

    // ---- hit map (steps 2–5)
    hitMapHtml() { return `<canvas class="bl-hitmap" width="800" height="100"></canvas><div class="bl-legend"><span><i class="hit"></i> hit</span><span><i class="seed"></i> seed</span><span><i class="hsp"></i> HSP (ungapped)</span><span><i class="aln"></i> gapped alignment</span><span><i class="sel"></i> selected</span></div>`; }

    drawHitMap(canvas, step) {
        const r = this.result;
        const db = r.db, n = db.length;
        const rowH = 58, labelW = 150, pad = 8;
        const width = canvas.parentElement.clientWidth || 800;
        const dpr = window.devicePixelRatio || 1;
        const height = n * rowH + pad;
        canvas.width = width * dpr; canvas.height = height * dpr;
        canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        const maxLen = Math.max(...db.map(s => s.seq.length));
        const plotW = width - labelW - 20, qLen = r.query.length;
        const sx = plotW / maxLen;
        const boxH = rowH - 14, sy = boxH / qLen;
        const span = r.wordTable.span;
        const seeds = new Set();
        r.seeds.forEach(ss => ss.seeds.forEach(sd => sd.hits.forEach(h => seeds.add(`${ss.subject}:${h.qpos}:${h.spos}`))));
        const sel = r.results[this.selectedHsp];
        db.forEach((s, i) => {
            const y0 = pad / 2 + i * rowH + 4, x0 = labelW;
            ctx.fillStyle = '#4a5568'; ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
            ctx.fillText(s.name, labelW - 8, y0 + boxH / 2 + 4);
            ctx.strokeStyle = '#cbd5e0'; ctx.lineWidth = 1;
            ctx.strokeRect(x0, y0, s.seq.length * sx, boxH);
            // hits
            const ps = r.scan.perSubject[i];
            ctx.lineWidth = 1.6;
            for (const h of ps.hits) {
                const isSeed = seeds.has(`${i}:${h.qpos}:${h.spos}`);
                ctx.strokeStyle = step >= 3 && isSeed ? '#2563eb' : '#718096';
                ctx.beginPath(); ctx.moveTo(x0 + h.spos * sx, y0 + h.qpos * sy); ctx.lineTo(x0 + (h.spos + span) * sx, y0 + (h.qpos + span) * sy); ctx.stroke();
            }
            if (step >= 4) {
                ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2;
                for (const h of r.hsps.filter(x => x.subject === i)) { ctx.beginPath(); ctx.moveTo(x0 + h.sStart * sx, y0 + h.qStart * sy); ctx.lineTo(x0 + (h.sEnd + 1) * sx, y0 + (h.qEnd + 1) * sy); ctx.stroke(); }
            }
            if (step >= 5) {
                for (const g of r.results.filter(x => x.subject === i)) {
                    ctx.strokeStyle = g === sel ? '#dc2626' : '#16a34a'; ctx.lineWidth = g === sel ? 3.5 : 2.5;
                    ctx.beginPath(); ctx.moveTo(x0 + (g.sStart - 1) * sx, y0 + (g.qStart - 1) * sy); ctx.lineTo(x0 + g.sEnd * sx, y0 + g.qEnd * sy); ctx.stroke();
                }
            } else if (step === 4 && sel) {
                const h = sel.hsp;
                if (h.subject === i) { ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(x0 + h.sStart * sx, y0 + h.qStart * sy); ctx.lineTo(x0 + (h.sEnd + 1) * sx, y0 + (h.qEnd + 1) * sy); ctx.stroke(); }
            }
        });
        ctx.fillStyle = '#718096'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText('subject →  (box height = query, top to bottom)', labelW, height - 1);
    }

    // ---- step 2: scan
    renderScan() {
        const r = this.result, s = r.stats;
        const per = r.scan.perSubject.map((ps, i) => `<tr><td>${r.db[i].name}</td><td>${this.truthTag(r.db[i].truth)}</td><td>${r.db[i].seq.length - r.wordTable.span + 1}</td><td><strong>${ps.hits.length}</strong></td><td>${ps.hits.filter(h => h.exact).length}</td></tr>`).join('');
        return `
            <h3>Step 2 – Scan the database</h3>
            <p>Every window of every database sequence is looked up in the query's word table: <strong>${s.lookups.toLocaleString()}</strong> lookups gave <strong>${s.hits}</strong> hits. A hit is a pair (query position, subject position); on the hit map it sits on a diagonal, because it says "these ${r.wordTable.span} letters line up here".</p>
            ${this.hitMapHtml()}
            <table class="bl-table"><thead><tr><th>subject</th><th>planted</th><th>windows looked up</th><th>hits</th><th>exact</th></tr></thead><tbody>${per}</tbody></table>
            <div class="bl-lesson"><strong>Reading the map.</strong> Related sequences show hits lined up on one diagonal; unrelated ones show scattered hits that happen by chance. With four bases a random ${r.wordTable.span}-mer matches a given query word with probability 4<sup>−${r.wordTable.span}</sup>${r.params.type === 'DNA' ? ` = 1 in ${Math.pow(4, r.wordTable.span).toLocaleString()}` : ''}${r.params.type === 'PROTEIN' ? ' – for proteins the neighbourhood raises that considerably' : ''}. Try w = 7 to see chance hits appear, w = 20 to see homologs vanish.</div>`;
    }

    // ---- step 3: seeds
    renderSeeds() {
        const r = this.result, P = r.params;
        const total = r.stats.seeds, hits = r.stats.hits;
        const rows = r.seeds.map(ss => `<tr><td>${r.db[ss.subject].name}</td><td>${r.scan.perSubject[ss.subject].hits.length}</td><td><strong>${ss.seeds.length}</strong></td><td>${ss.seeds.slice(0, 4).map(sd => `diag ${sd.diag >= 0 ? '+' : ''}${sd.diag}${sd.distance ? ` (hits ${sd.distance} apart)` : ''}`).join(', ')}${ss.seeds.length > 4 ? ' …' : ''}</td></tr>`).join('');
        return `
            <h3>Step 3 – Which hits are worth extending?</h3>
            <p>${P.twoHit
                ? `The <strong>two-hit rule</strong> is on: a diagonal is extended only if it carries two non-overlapping hits within A = ${P.A} positions of each other. Isolated hits – the great majority of chance hits – are ignored. ${hits} hits → <strong>${total}</strong> seeds.`
                : `Every hit is a seed (${hits} seeds). blastn works this way because exact ${r.wordTable.span}-mers are already rare by chance; switch the two-hit rule on to see how many extensions it would save.`}</p>
            ${this.hitMapHtml()}
            <table class="bl-table"><thead><tr><th>subject</th><th>hits</th><th>seeds</th><th>diagonals</th></tr></thead><tbody>${rows}</tbody></table>
            <div class="bl-lesson"><strong>Why it matters.</strong> Extension is the expensive part. The two-hit rule (BLAST 2, 1997) let blastp lower T – more neighbourhood words, more hits – while doing fewer extensions, because true alignments almost always contain several hits on one diagonal and chance hits almost never do.</div>`;
    }

    // ---- step 4: ungapped extension
    xdropSeries() {
        const h = this.result.results[this.selectedHsp] && this.result.results[this.selectedHsp].hsp;
        if (!h) return null;
        const span = this.result.wordTable.span;
        const seed = h.seed;
        let seedScore = 0;
        for (let k = 0; k < span; k++) seedScore += this.B.sub(this.result.params, this.result.query[seed.qpos + k].toUpperCase(), this.result.db[h.subject].seq[seed.spos + k].toUpperCase());
        const right = h.traceR.map(t => ({ q: t.q, score: t.score, best: t.best }));
        const left = h.traceL.map(t => ({ q: t.q, score: t.score, best: t.best }));
        return { h, seed, seedScore, right, left, span };
    }

    renderUngapped() {
        const r = this.result, P = r.params;
        if (!r.results.length) return `<h3>Step 4 – Ungapped extension</h3><p>No seeds to extend with these parameters – lower the word size${P.type === 'PROTEIN' ? ' or T' : ''}.</p>`;
        const list = r.results.map((x, k) => `<button class="bl-hspbtn ${k === this.selectedHsp ? 'sel' : ''}" data-hsp="${k}">${r.db[x.subject].name} · diag ${x.hsp.diag >= 0 ? '+' : ''}${x.hsp.diag} · ungapped score ${x.hsp.score}</button>`).join('');
        const s = this.xdropSeries();
        const q = r.query.toUpperCase(), sub = r.db[s.h.subject].seq.toUpperCase();
        const aQ = q.slice(s.h.qStart, s.h.qEnd + 1), aS = sub.slice(s.h.sStart, s.h.sEnd + 1);
        const mid = aQ.split('').map((c, i) => c === aS[i] ? '|' : (this.B.sub(P, c, aS[i]) > 0 ? '+' : ' ')).join('');
        return `
            <h3>Step 4 – Extend the seed without gaps (X-drop)</h3>
            <p>From the seed word the alignment grows along its diagonal in both directions, adding the score of each new pair. The extension stops when the running score has dropped <strong>X = ${P.xDrop}</strong> below the best score seen so far; the alignment is then trimmed back to that best point. The result is a <strong>high-scoring segment pair (HSP)</strong>.</p>
            <div class="bl-chips">${list}</div>
            ${this.hitMapHtml()}
            <div class="bl-xdrop"><svg id="xdrop-chart" width="760" height="220"></svg><div class="dp-buttons input-controls"><button id="xdrop-play">▶ Replay the extension</button></div></div>
            <pre class="bl-aln">Query ${String(s.h.qStart + 1).padStart(4)} ${aQ} ${s.h.qEnd + 1}\n           ${mid}\nSbjct ${String(s.h.sStart + 1).padStart(4)} ${aS} ${s.h.sEnd + 1}</pre>
            <p>HSP score <strong>${s.h.score}</strong> over ${s.h.length} positions (seed word scored ${s.seedScore}; extension explored ${s.right.length + s.left.length} further positions).</p>
            <div class="bl-lesson"><strong>Limitation.</strong> X-drop is greedy: a stretch of mismatches longer than X can afford is never crossed, even if a strong match lies beyond it. Lower X to see HSPs fragment; raise it and extensions run longer (more work) for little gain.</div>`;
    }

    // The chart follows the algorithm's order: seed, then steps to the right, then steps to the left
    // (the left extension continues from the best score reached on the right).
    drawXdrop(svg, reveal = { r: Infinity, l: Infinity }) {
        const s = this.xdropSeries();
        if (!s) return;
        const P = this.result.params;
        const pts = [{ i: 0, score: s.seedScore, best: s.seedScore, label: 'seed' }];
        s.right.forEach((t, k) => pts.push({ i: k + 1, score: t.score, best: Math.max(t.best, t.score), side: 'R', q: t.q }));
        const nR = s.right.length;
        s.left.forEach((t, k) => pts.push({ i: nR + k + 1, score: t.score, best: Math.max(t.best, t.score), side: 'L', q: t.q }));
        const shown = pts.filter(p => p.i === 0 || (p.side === 'R' && p.i <= reveal.r) || (p.side === 'L' && p.i - nR <= reveal.l));
        const W = 760, H = 220, ml = 44, mr = 14, mt = 18, mb = 34;
        const N = pts.length - 1 || 1;
        const minS = Math.min(0, ...pts.map(p => p.best - P.xDrop)), maxS = Math.max(...pts.map(p => p.best)) + 2;
        const x = i => ml + i / N * (W - ml - mr);
        const y = v => mt + (1 - (v - minS) / ((maxS - minS) || 1)) * (H - mt - mb);
        const line = (arr, color, key, dash) => arr.length > 1 ? `<polyline fill="none" stroke="${color}" stroke-width="2"${dash ? ' stroke-dasharray="4,3"' : ''} points="${arr.map(p => `${x(p.i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ')}"/>` : '';
        let h = `<rect x="0" y="0" width="${W}" height="${H}" fill="white"/>`;
        h += `<line x1="${ml}" y1="${y(0)}" x2="${W - mr}" y2="${y(0)}" stroke="#cbd5e0"/>`;
        // phase bands
        h += `<rect x="${x(0)}" y="${mt}" width="${x(nR) - x(0)}" height="${H - mt - mb}" fill="rgba(37,99,235,0.05)"/>`;
        h += `<text x="${x(0) + 4}" y="${H - mb + 12}" font-size="10" fill="#2563eb">→ extending right (${nR} steps)</text>`;
        if (s.left.length) h += `<text x="${x(nR) + 4}" y="${H - mb + 12}" font-size="10" fill="#7a3e1d">← extending left (${s.left.length} steps)</text>`;
        const R = shown.filter(p => p.side !== 'L'), L = shown.filter(p => p.i === nR || p.side === 'L');
        for (const arr of [R, L]) {
            h += line(arr.map(p => ({ i: p.i, v: p.best - P.xDrop })), '#dc2626', 'v', true);
            h += line(arr, '#16a34a', 'best');
            h += line(arr, '#d97706', 'score');
        }
        h += `<circle cx="${x(0)}" cy="${y(s.seedScore)}" r="4" fill="#2563eb"/><text x="${x(0) + 6}" y="${y(s.seedScore) - 6}" font-size="10" fill="#2563eb">seed word = ${s.seedScore}</text>`;
        const last = shown[shown.length - 1];
        if (last && last.i > 0) h += `<circle cx="${x(last.i)}" cy="${y(last.score)}" r="4" fill="#d97706"/>`;
        if (reveal.r === Infinity && reveal.l === Infinity) {
            const bestPt = pts.reduce((b, p) => p.score > b.score ? p : b, pts[0]);
            h += `<text x="${Math.min(x(bestPt.i), W - 120)}" y="${y(bestPt.score) - 6}" font-size="10" fill="#16a34a">HSP score ${s.h.score}</text>`;
        }
        h += `<text x="${W / 2}" y="${H - 4}" font-size="10" text-anchor="middle" fill="#4a5568">extension steps in the order the algorithm takes them; stops when the running score falls to the dashed line</text>`;
        h += `<text x="8" y="${y(maxS - 2) + 4}" font-size="10" fill="#4a5568">${maxS - 2}</text><text x="8" y="${y(0) + 4}" font-size="10" fill="#4a5568">0</text>`;
        h += `<g font-size="10"><rect x="${W - 190}" y="${mt}" width="180" height="46" fill="white" stroke="#e2e8f0"/><line x1="${W - 182}" y1="${mt + 12}" x2="${W - 160}" y2="${mt + 12}" stroke="#d97706" stroke-width="2"/><text x="${W - 154}" y="${mt + 15}">running score</text><line x1="${W - 182}" y1="${mt + 25}" x2="${W - 160}" y2="${mt + 25}" stroke="#16a34a" stroke-width="2"/><text x="${W - 154}" y="${mt + 28}">best so far</text><line x1="${W - 182}" y1="${mt + 38}" x2="${W - 160}" y2="${mt + 38}" stroke="#dc2626" stroke-width="2" stroke-dasharray="4,3"/><text x="${W - 154}" y="${mt + 41}">best − X (stop line)</text></g>`;
        svg.innerHTML = h;
    }

    animateXdrop() {
        const svg = this.$('step-content').querySelector('#xdrop-chart');
        const s = this.xdropSeries();
        if (!svg || !s) return;
        if (this.anim) clearInterval(this.anim);
        let r = 0, l = 0;
        this.drawXdrop(svg, { r: 0, l: 0 });
        this.anim = setInterval(() => {
            if (r < s.right.length) r++;
            else if (l < s.left.length) l++;
            else { clearInterval(this.anim); this.anim = null; this.drawXdrop(svg); return; }
            this.drawXdrop(svg, { r, l });
        }, 110);
    }

    // ---- step 5: gapped extension
    alignmentBlock(g, qName = 'Query', sName = 'Sbjct', P = this.result.params) {
        const width = 60;
        let out = '';
        let qpos = g.qStart, spos = g.sStart;
        for (let k = 0; k < g.aligned1.length; k += width) {
            const a = g.aligned1.slice(k, k + width), b = g.aligned2.slice(k, k + width);
            const mid = a.split('').map((c, i) => c === '-' || b[i] === '-' ? ' ' : c === b[i] ? '|' : (this.B.sub(P, c, b[i]) > 0 ? '+' : ' ')).join('');
            const qa = a.replace(/-/g, '').length, sa = b.replace(/-/g, '').length;
            out += `${qName} ${String(qpos).padStart(4)}  ${a}  ${qpos + qa - 1}\n           ${mid}\n${sName} ${String(spos).padStart(4)}  ${b}  ${spos + sa - 1}\n\n`;
            qpos += qa; spos += sa;
        }
        return out;
    }

    renderGapped() {
        const r = this.result;
        if (!r.results.length) return '<h3>Step 5 – Gapped extension</h3><p>No HSPs to extend.</p>';
        const g = r.results[this.selectedHsp];
        const list = r.results.map((x, k) => `<button class="bl-hspbtn ${k === this.selectedHsp ? 'sel' : ''}" data-hsp="${k}">${r.db[x.subject].name} · HSP ${x.hsp.score} → gapped ${x.score}</button>`).join('');
        return `
            <h3>Step 5 – Gapped extension</h3>
            <p>An HSP whose score is high enough is used as the centre of a proper local alignment: dynamic programming (Smith–Waterman with affine gaps, open ${r.params.gapOpen}, extend ${r.params.gapExtend}) is run only in a window of ±${r.opts.gappedWindow} around the HSP, not over the whole sequences. Gaps can now bridge indels that the ungapped extension had to stop at.</p>
            <div class="bl-chips">${list}</div>
            ${this.hitMapHtml()}
            <pre class="bl-aln">${this.alignmentBlock(g)}</pre>
            <table class="bl-table"><tbody>
                <tr><td>Ungapped HSP score</td><td>${g.hsp.score} over ${g.hsp.length} positions</td></tr>
                <tr><td>Gapped alignment score</td><td><strong>${g.score}</strong> over ${g.length} columns</td></tr>
                <tr><td>Identities / positives / gaps</td><td>${g.identities}/${g.length} (${Math.round(g.identities / g.length * 100)} %) · ${g.positives}/${g.length} · ${g.gaps}</td></tr>
                <tr><td>Matrix cells computed for this alignment</td><td>${g.cells.toLocaleString()} (a full Smith–Waterman of these two sequences: ${(r.query.length * r.db[g.subject].seq.length).toLocaleString()})</td></tr>
            </tbody></table>
            <div class="bl-lesson"><strong>Advantage and price.</strong> BLAST gets the alignment quality of dynamic programming where it matters, at a fraction of the cost – but only around seeds it found. An alignment that has no seed is never computed; that is the whole trade-off.</div>`;
    }

    // ---- step 6: statistics & report
    renderStats() {
        const r = this.result, s = r.stats, P = r.params;
        const ka = s.kaG, cut = this.ecut();
        const rows = r.results.filter(x => x.evalue <= cut).map((x, k) => `<tr class="${k === this.selectedHsp ? 'sel' : ''}" data-hsp="${k}"><td>${r.db[x.subject].name}</td><td>${this.truthTag(r.db[x.subject].truth)}</td><td>${x.score}</td><td>${x.bits.toFixed(1)}</td><td><strong>${this.fmtE(x.evalue)}</strong></td><td>${x.identities}/${x.length} (${Math.round(x.identities / x.length * 100)} %)</td><td>${x.gaps}</td><td>${x.qStart}–${x.qEnd}</td><td>${x.sStart}–${x.sEnd}</td></tr>`).join('');
        const best = r.results[this.selectedHsp];
        const missed = r.db.filter((d, i) => d.truth && (d.truth.kind === 'homolog' || d.truth.kind === 'synonymous') && !r.results.some(x => x.subject === i && x.evalue <= cut));
        const bitsFormula = best ? `S′ = (λ·S − ln K) / ln 2 = (${ka.lambda} × ${best.score} − ln ${ka.K}) / 0.693 = <strong>${best.bits.toFixed(1)} bits</strong>` : '';
        const eFormula = best ? `E = m′·n′·2<sup>−S′</sup> = ${Math.round(s.eff.m)} × ${Math.round(s.eff.n).toLocaleString()} × 2<sup>−${best.bits.toFixed(1)}</sup> = <strong>${this.fmtE(best.evalue)}</strong>` : '';
        return `
            <h3>Step 6 – How significant is a hit?</h3>
            <p>A raw score depends on the scoring system; to compare searches it is converted to a <strong>bit score</strong> with the Karlin–Altschul parameters λ and K (which depend only on the scoring scheme and the residue frequencies), and then to an <strong>E-value</strong>: the number of alignments with at least this score expected by chance in a database of this size.</p>
            <table class="bl-table"><tbody>
                <tr><td>λ (table, gapped scoring)</td><td>${ka.lambda}</td><td class="dp-hint">λ computed here for the ungapped scores by solving Σ p<sub>i</sub>p<sub>j</sub>e<sup>λs<sub>ij</sub></sup> = 1: ${s.lambdaComputed.toFixed(3)} (table: ${s.kaU.lambda})</td></tr>
                <tr><td>K</td><td>${ka.K}</td><td class="dp-hint">a scale factor for the search space; from tables</td></tr>
                <tr><td>Query length m / database length n</td><td>${r.query.length} / ${s.dbLength.toLocaleString()}</td><td class="dp-hint">${this.dbFactor() > 1 ? `database pretended ${this.dbFactorLabel(+this.$('dbsize').value)} larger` : `${r.db.length} sequences`}</td></tr>
                <tr><td>Effective lengths m′ / n′</td><td>${Math.round(s.eff.m)} / ${Math.round(s.eff.n).toLocaleString()}</td><td class="dp-hint">each shortened by ℓ = ${s.eff.l.toFixed(1)}: an alignment cannot start in the last ℓ positions</td></tr>
                ${best ? `<tr><td>Bit score of the selected hit</td><td colspan="2">${bitsFormula}</td></tr><tr><td>E-value</td><td colspan="2">${eFormula}</td></tr><tr><td>p-value</td><td colspan="2">1 − e<sup>−E</sup> = ${(1 - Math.exp(-best.evalue)).toExponential(2)}</td></tr>` : ''}
            </tbody></table>
            <h4>Hit table (E ≤ ${this.ecutLabel(+this.$('ecut').value)})</h4>
            ${rows ? `<table class="bl-table bl-hits"><thead><tr><th>subject</th><th>planted</th><th>score</th><th>bits</th><th>E</th><th>identities</th><th>gaps</th><th>query</th><th>subject</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="dp-hint">Nothing passes the E-value cutoff.</p>'}
            ${missed.length ? `<p class="reverse-color"><strong>Missed:</strong> ${missed.map(d => `${d.name} (${this.truthTag(d.truth)})`).join(', ')} – planted homologs that produced no reportable alignment with these parameters.</p>` : '<p class="forward-color"><strong>All planted homologs found.</strong></p>'}
            <div class="bl-lesson"><strong>Reading E-values.</strong> E ≈ 10<sup>−30</sup>: unmistakable. E ≈ 0.001: probably real. E ≈ 1: one such hit is expected by chance in this database – it means nothing on its own. E scales with the database: drag the "pretend the database is larger" slider and watch a decent hit become noise. Bit scores do not change with database size – that is why they are the better number to compare between searches.</div>`;
    }

    // ------------------------------------------------------------ experiments
    homologRow(scen, res, cut = 1e-3) {
        const found = new Set(res.results.filter(x => x.evalue <= cut).map(x => x.subject));
        return scen.db.map((d, i) => d.truth && d.truth.kind !== 'unrelated' && d.truth.kind !== 'lowcomplexity'
            ? `<span class="bl-found ${found.has(i) ? 'yes' : 'no'}">${d.truth.identity ? Math.round(d.truth.identity * 100) + ' %' : d.name}</span>` : '').join('');
    }

    renderWordSize() {
        const sc = this.scenario, box = this.$('wordsize-result');
        const variants = sc.type === 'PROTEIN'
            ? [15, 13, 11, 9].flatMap(T => [true, false].map(twoHit => ({ label: `blastp T = ${T}${twoHit ? ', two-hit' : ', every hit'}`, P: Object.assign({}, this.B.PROGRAMS.blastp, { T, twoHit }) })))
            : [{ label: 'megablast (w = 28)', P: Object.assign({}, this.B.PROGRAMS.megablast) },
               { label: 'megablast w = 16', P: Object.assign({}, this.B.PROGRAMS.megablast, { word: 16 }) },
               { label: 'discontiguous megablast (12 of 16)', P: Object.assign({}, this.B.PROGRAMS['dc-megablast']) },
               { label: 'blastn (w = 11)', P: Object.assign({}, this.B.PROGRAMS.blastn) },
               { label: 'blastn w = 9', P: Object.assign({}, this.B.PROGRAMS.blastn, { word: 9 }) },
               { label: 'blastn w = 7', P: Object.assign({}, this.B.PROGRAMS.blastn, { word: 7 }) }];
        const rows = variants.map(v => {
            const t0 = performance.now();
            const res = this.B.search(sc.query, sc.db, v.P, { mask: this.$('mask').checked });
            const ms = performance.now() - t0;
            const st = res.stats;
            return `<tr><td>${v.label}</td><td>${st.lookups.toLocaleString()}</td><td>${st.hits}</td><td>${st.seeds}</td><td>${st.hspCount}</td><td>${st.gappedCells.toLocaleString()}</td><td>${ms.toFixed(0)} ms</td><td>${this.homologRow(sc, res)}</td></tr>`;
        }).join('');
        box.innerHTML = `<table class="bl-table"><thead><tr><th>program</th><th>lookups</th><th>hits</th><th>seeds</th><th>HSPs</th><th>DP cells</th><th>time</th><th>planted homologs found (E ≤ 10⁻³)</th></tr></thead><tbody>${rows}</tbody></table>
            <div class="bl-lesson">${sc.type === 'PROTEIN'
                ? 'Lower T = bigger neighbourhood = more hits and more distant homologs found; the two-hit rule keeps the number of extensions in check. This is why blastp with T = 11 and the two-hit rule is both fast and sensitive.'
                : 'Sensitivity falls with word size: a 65 % identical homolog rarely contains 11 identical bases in a row, never 28. The discontiguous template recovers some sensitivity at megablast-like speed, which is why it is the recommended choice for cross-species nucleotide searches. The price of small words is work: compare the hits and DP cells columns.'}</div>`;
    }

    renderTranslated() {
        const box = this.$('translated-result');
        const cs = this.B.buildScenario('coding-synonymous', this.seed);
        const rn = this.B.search(cs.query, cs.db, this.B.PROGRAMS.blastn);
        const rdc = this.B.search(cs.query, cs.db, this.B.PROGRAMS['dc-megablast']);
        const rx = this.B.translatedSearch(cs.query, cs.db, 'tblastx');
        const frames = this.B.sixFrames(cs.query);
        const ortho = cs.db[0];
        const dnaId = (() => { const r = this.E.localAlign(cs.query, ortho.seq, this.B.scoringParams(this.B.PROGRAMS.blastn)); const sc = this.E.scoreAlignment(r.aligned1, r.aligned2, this.B.scoringParams(this.B.PROGRAMS.blastn)); return Math.round(sc.identity * 100); })();
        const line = (label, res, names) => `<tr><td>${label}</td><td>${res.length ? res.slice(0, 2).map(x => `${names(x)} · E = ${this.fmtE(x.evalue)} · ${x.identities}/${x.length} identical`).join('<br>') : '<span class="reverse-color">no hit</span>'}</td></tr>`;
        box.innerHTML = `
            <p>Query (coding, ${cs.query.length} bp): <code class="bl-mono">${cs.query}</code><br>Ortholog in the database: DNA identity of the best local alignment ≈ <strong>${dnaId} %</strong>; encoded protein identical.</p>
            <table class="bl-table"><thead><tr><th>search</th><th>best hits</th></tr></thead><tbody>
                ${line('blastn (w = 11)', rn.results, x => cs.db[x.subject].name)}
                ${line('discontiguous megablast', rdc.results, x => cs.db[x.subject].name)}
                ${line('tblastx (both translated in six frames, blastp scoring)', rx, x => `${x.subjectName}, query frame ${x.qFrame > 0 ? '+' : ''}${x.qFrame}`)}
            </tbody></table>
            <h4>Six-frame translation of the query</h4>
            <table class="bl-table"><tbody>${frames.map(f => `<tr><td>frame ${f.frame > 0 ? '+' : ''}${f.frame}</td><td><code class="bl-mono">${f.protein.replace(/\*/g, '<span class="reverse-color">*</span>')}</code></td></tr>`).join('')}</tbody></table>
            <div class="bl-lesson"><strong>Choosing the program.</strong> Nucleotide searches see synonymous changes as mismatches; the amino-acid sequence is what evolution conserves. For coding DNA against DNA use tblastx (or blastx against proteins, tblastn for a protein query against DNA). blastn / megablast are for the same gene in closely related genomes, primers, contamination checks – not for distant homology. The cost: six frames on both sides means 36 comparisons per pair.</div>`;
    }

    renderEvalue(withShuffle) {
        const box = this.$('evalue-result');
        const r = this.result;
        if (!r.results.length) { box.innerHTML = '<p class="dp-hint">The current search has no hit to re-evaluate – choose another scenario or smaller word size.</p>'; return; }
        const best = r.results[0];
        const kaG = r.stats.kaG;
        const rows = [1, 1e2, 1e4, 1e6, 1e9, 1e12].map(f => {
            const eff = this.B.effectiveLengths(r.query.length, r.stats.dbLength / this.dbFactor() * f, r.db.length * f, kaG);
            const e = this.B.evalue(best.bits, eff.m, eff.n);
            return `<tr><td>${f === 1 ? 'this database' : `10<sup>${Math.round(Math.log10(f))}</sup>× larger`} (${(r.stats.dbLength / this.dbFactor() * f).toExponential(1).replace('e+', ' × 10^')} letters)</td><td>${best.bits.toFixed(1)}</td><td><strong>${this.fmtE(e)}</strong></td><td>${e < 1e-6 ? 'certain' : e < 1e-3 ? 'convincing' : e < 0.1 ? 'suggestive' : 'chance-level'}</td></tr>`;
        }).join('');
        let shuffle = '';
        if (withShuffle) {
            const st = this.B.shuffleTest(r.query, r.db, r.params, new this.B.Rng(this.seed * 7 + 1), 100);
            const m = r.query.length, n = r.stats.dbLength / this.dbFactor();
            const kaU = r.stats.kaG;
            const lo = Math.min(...st.scores) - 2, hi = Math.max(st.real, ...st.scores) + 2;
            const bins = {};
            st.scores.forEach(v => { bins[v] = (bins[v] || 0) + 1; });
            const W = 720, H = 200, ml = 36, mb = 30, mt = 10;
            const x = v => ml + (v - lo) / (hi - lo) * (W - ml - 10);
            const maxCount = Math.max(...Object.values(bins));
            const pdfScale = 100;   // expected counts = n_shuffles × pdf
            const curve = [];
            for (let v = lo; v <= hi; v += 0.5) curve.push(`${x(v).toFixed(1)},${(H - mb - (this.B.gumbelPdf(v, kaU, m, n) * pdfScale) / maxCount * (H - mb - mt)).toFixed(1)}`);
            const bars = Object.entries(bins).map(([v, c]) => `<rect x="${x(+v) - 4}" y="${H - mb - c / maxCount * (H - mb - mt)}" width="8" height="${c / maxCount * (H - mb - mt)}" fill="#a0aec0"/>`).join('');
            const mode = Math.log(kaU.K * m * n) / kaU.lambda;
            shuffle = `<h4>Scores of 100 shuffled queries (full Smith–Waterman, same scoring)</h4>
                <svg width="${W}" height="${H}" class="bl-chart"><rect width="${W}" height="${H}" fill="white"/>${bars}<polyline fill="none" stroke="#2563eb" stroke-width="2" points="${curve.join(' ')}"/>
                <line x1="${x(st.real)}" y1="${mt}" x2="${x(st.real)}" y2="${H - mb}" stroke="#dc2626" stroke-width="2"/><text x="${Math.min(x(st.real) + 4, W - 120)}" y="${mt + 12}" font-size="11" fill="#dc2626">real query: ${st.real}</text>
                <text x="${W / 2}" y="${H - 8}" font-size="11" text-anchor="middle" fill="#4a5568">best local alignment score</text><text x="${x(lo)}" y="${H - mb + 12}" font-size="10" fill="#4a5568">${lo}</text><text x="${x(hi)}" y="${H - mb + 12}" font-size="10" text-anchor="end" fill="#4a5568">${hi}</text></svg>
                <p>Shuffled queries score <strong>${st.median}</strong> on average (max ${st.max}); the Karlin–Altschul extreme-value distribution (blue) with λ = ${kaU.lambda}, K = ${kaU.K} predicts a mode at ${mode.toFixed(1)}. The real query scores <strong>${st.real}</strong>${st.real > st.max ? ', far outside anything chance produced' : ', within the chance range'}.</p>`;
        }
        box.innerHTML = `<table class="bl-table"><thead><tr><th>database size</th><th>bit score</th><th>E-value of the best hit (${r.db[best.subject].name})</th><th></th></tr></thead><tbody>${rows}</tbody></table>${shuffle}
            <div class="bl-lesson"><strong>Two lessons.</strong> (1) The same alignment is significant in a small database and meaningless in a huge one – always ask "against what". (2) Chance scores follow an extreme-value distribution whose tail is exponential: that is why a few extra bits change E by orders of magnitude, and why E-values, not raw scores, are comparable.</div>`;
    }

    renderMasking() {
        const box = this.$('masking-result');
        const lc = this.B.buildScenario('low-complexity', this.seed);
        const P = this.B.PROGRAMS.blastn;
        const off = this.B.search(lc.query, lc.db, P, { mask: false });
        const on = this.B.search(lc.query, lc.db, P, { mask: true });
        const list = res => { const seen = new Set(); return res.results.filter(x => !seen.has(x.subject) && seen.add(x.subject)).map(x => `<tr><td>${lc.db[x.subject].name}</td><td>${this.truthTag(lc.db[x.subject].truth)}</td><td>${x.bits.toFixed(1)}</td><td>${this.fmtE(x.evalue)}</td><td>${x.qStart}–${x.qEnd}</td></tr>`).join('') || '<tr><td colspan="5" class="dp-hint">nothing</td></tr>'; };
        box.innerHTML = `
            <p>Query: ${this.seqHtml(on.query)} <span class="dp-hint">(lower-case = masked by the complexity filter)</span></p>
            <div class="bl-two">
                <div><h4>Without masking – ${off.stats.hits} hits</h4><table class="bl-table"><thead><tr><th>subject</th><th>planted</th><th>bits</th><th>E</th><th>query region</th></tr></thead><tbody>${list(off)}</tbody></table></div>
                <div><h4>With masking – ${on.stats.hits} hits</h4><table class="bl-table"><thead><tr><th>subject</th><th>planted</th><th>bits</th><th>E</th><th>query region</th></tr></thead><tbody>${list(on)}</tbody></table></div>
            </div>
            <div class="bl-lesson"><strong>Why BLAST masks by default.</strong> A CA-repeat matches every other CA-repeat in the database with an impressive E-value that says nothing about homology; such hits also cost time (every repeat word hits everywhere). The filter (DUST for DNA, SEG for proteins) hides low-complexity words from the lookup stage only – masked residues still take part in extension, so a real alignment running through the repeat is not cut short. The true homolog here survives masking unchanged.</div>`;
    }

    renderSw() {
        const box = this.$('sw-result'), r = this.result, sc = this.scenario;
        const sp = this.B.scoringParams(r.params);
        const rows = sc.db.map((d, i) => {
            const sw = this.E.localAlign(r.query.toUpperCase(), d.seq.toUpperCase(), sp);
            const bl = r.results.filter(x => x.subject === i).sort((a, b) => b.score - a.score)[0];
            const cells = r.query.length * d.seq.length;
            const bits = this.B.bitScore(sw.score, r.stats.kaG), e = this.B.evalue(bits, r.stats.eff.m, r.stats.eff.n);
            const missed = !bl && e < 1e-3;
            return `<tr class="${missed ? 'miss' : ''}"><td>${d.name}</td><td>${this.truthTag(d.truth)}</td><td>${sw.score} (E ${this.fmtE(e)})</td><td>${bl ? `${bl.score} (E ${this.fmtE(bl.evalue)})` : '<span class="reverse-color">no seed → nothing</span>'}</td><td>${cells.toLocaleString()}</td><td>${bl ? bl.cells.toLocaleString() : '0'}</td></tr>`;
        }).join('');
        const st = r.stats;
        box.innerHTML = `<table class="bl-table"><thead><tr><th>subject</th><th>planted</th><th>Smith–Waterman best score</th><th>BLAST best score</th><th>SW cells</th><th>BLAST DP cells</th></tr></thead><tbody>${rows}</tbody></table>
            <p>Whole search: Smith–Waterman would compute <strong>${st.swCells.toLocaleString()}</strong> cells; BLAST did ${st.lookups.toLocaleString()} table lookups, ${st.hspCount} ungapped extensions and <strong>${st.gappedCells.toLocaleString()}</strong> DP cells.</p>
            <div class="bl-lesson"><strong>The trade-off in one table.</strong> Where BLAST found a seed it reaches (almost) the same alignment as full dynamic programming at a fraction of the cost. Rows marked in red are alignments that exist and would be significant, but BLAST never saw them because no word of length ${r.wordTable.span} is shared – the heuristic's blind spot. Smaller words${r.params.type === 'PROTEIN' ? ' or lower T' : ', or a translated search for coding DNA,'} shrink it, at the price of more work.</div>`;
    }

    // ------------------------------------------------------------ quiz
    renderQuiz() {
        const box = this.$('quiz');
        const r = this.result, sc = this.scenario, P = r.params, s = r.stats;
        const found = new Set(r.results.filter(x => x.evalue <= 1e-3).map(x => x.subject));
        const homologs = sc.db.map((d, i) => ({ d, i })).filter(x => x.d.truth && x.d.truth.kind === 'homolog');
        const qs = [
            { q: `With w = ${P.word}${P.template ? ' (discontiguous template)' : ''}, how many words does the ${r.query.length}-residue query produce?`, type: 'number', answer: r.wordTable.words.length, tolerance: 0, explanation: `A query of length L has L − span + 1 windows (span ${r.wordTable.span}); masked positions produce none.` },
            { q: 'How many hits did the database scan produce?', type: 'number', answer: s.hits, tolerance: 0, explanation: 'Step 2 – the hit map.' },
            { q: 'How many of those became seeds that were extended?', type: 'number', answer: s.seeds, tolerance: 0, explanation: P.twoHit ? 'Only diagonals with two hits within A.' : 'Without the two-hit rule every hit is extended.' },
        ];
        if (homologs.length) {
            const lowest = homologs.filter(h => found.has(h.i)).sort((a, b) => a.d.truth.identity - b.d.truth.identity)[0];
            qs.push({ q: 'What is the identity (%) of the most divergent planted homolog still found with E ≤ 10⁻³?', type: 'number', answer: lowest ? Math.round(lowest.d.truth.identity * 100) : 0, tolerance: 0, explanation: lowest ? `${lowest.d.name} was found; anything more divergent shares no word of length ${r.wordTable.span}.` : 'None was found with these settings.' });
        }
        if (r.results.length) {
            const b = r.results[0];
            const eff10 = this.B.effectiveLengths(r.query.length, s.dbLength * 1000, s.nSeqs * 1000, s.kaG);
            qs.push({ q: `Bit score of the best hit (${r.db[b.subject].name})? (±0.5)`, type: 'number', answer: +b.bits.toFixed(1), tolerance: 0.5, explanation: `S′ = (λS − ln K)/ln 2 with λ = ${s.kaG.lambda}, K = ${s.kaG.K}, S = ${b.score}.` });
            qs.push({ q: 'If the database were 1000× larger, what would the E-value of that hit be? (within a factor of 2)', type: 'number', answer: this.B.evalue(b.bits, eff10.m, eff10.n), tolerance: this.B.evalue(b.bits, eff10.m, eff10.n), explanation: 'E is proportional to the database length: about 1000× the current value (slightly more because the effective length correction changes too).' });
        }
        qs.push({ q: 'Which quantity does NOT change when the same alignment is found in a 1000× larger database?', type: 'choice', options: ['the bit score', 'the E-value', 'the p-value'], answer: 0, explanation: 'Bit scores depend only on the alignment and the scoring system; E and p include the search space.' });
        qs.push({ q: 'A DNA query encodes a protein and you want its homologs in other species. Which program?', type: 'choice', options: ['tblastx or blastx (translated)', 'megablast', 'blastn with a very small word size'], answer: 0, explanation: 'Synonymous changes hide DNA similarity; the protein is what is conserved.' });
        box.innerHTML = '';
        qs.forEach((q, idx) => {
            const item = document.createElement('div'); item.className = 'dp-question';
            item.innerHTML = `<p><strong>${idx + 1}.</strong> ${q.q}</p>`;
            const fb = document.createElement('div'); fb.className = 'dp-feedback'; fb.hidden = true;
            let attempts = 0;
            const judge = ok => { attempts++; fb.hidden = false; fb.className = 'dp-feedback ' + (ok ? 'correct' : 'wrong');
                if (ok) { fb.innerHTML = `✔ Correct. ${q.explanation}`; item.querySelectorAll('input,button').forEach(el => el.disabled = true); }
                else if (attempts >= 2) fb.innerHTML = `✘ The answer is <strong>${q.type === 'choice' ? q.options[q.answer] : (Number.isInteger(q.answer) ? q.answer : this.fmtE(q.answer))}</strong>. ${q.explanation}`;
                else fb.textContent = '✘ Not quite – look at the pipeline steps and try once more.'; };
            if (q.type === 'choice') {
                const opts = document.createElement('div'); opts.className = 'dp-options';
                q.options.forEach((t, oi) => { const b = document.createElement('button'); b.textContent = t; b.addEventListener('click', () => judge(oi === q.answer)); opts.appendChild(b); });
                item.appendChild(opts);
            } else {
                const row = document.createElement('div'); row.className = 'dp-answer-row';
                const inp = document.createElement('input'); inp.type = 'number'; inp.step = 'any';
                const b = document.createElement('button'); b.textContent = 'Check';
                const chk = () => { if (inp.value !== '') judge(Math.abs(parseFloat(inp.value) - q.answer) <= (q.tolerance || 0)); };
                b.addEventListener('click', chk); inp.addEventListener('keydown', e => { if (e.key === 'Enter') chk(); });
                row.appendChild(inp); row.appendChild(b); item.appendChild(row);
            }
            item.appendChild(fb); box.appendChild(item);
        });
    }
}

(function () {
    const start = () => { window.blastLab = new BlastLab(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
