/**
 * OLC ASSEMBLY LAB – controller
 * =============================
 * Tab 1: drag-and-flip puzzle (student layout, live consensus, check against
 * the truth). Tab 2: the algorithm in five steps on the puzzle's reads.
 * Tab 3: repeats, greedy misassembly, mate pairs and scaffolding. Tab 4:
 * Lander–Waterman and N50/L50. Deep links: #puzzle, #algorithm-3, …
 */
const OLC_LEVELS = [
    { name: 'Level 1 – forward reads, no errors', note: 'All reads come from the same strand and are error-free: find the overlaps.', p: { G: 100, n: 10, L: 22, bothStrands: false, errorRate: 0, minOverlap: 8 }, a: { minOverlap: 8, maxErrorRate: 0 } },
    { name: 'Level 2 – reads from both strands', note: 'Some reads come from the other DNA strand. Read as they are, they fit nowhere – flip them (⇄) to their reverse complement.', p: { G: 100, n: 10, L: 22, bothStrands: true, errorRate: 0, minOverlap: 8 }, a: { minOverlap: 8, maxErrorRate: 0 } },
    { name: 'Level 3 – sequencing errors', note: 'Reads contain about 2 % wrong bases, so overlaps are no longer perfect. The majority (consensus) outvotes a single wrong base where at least three reads cover a position.', p: { G: 100, n: 12, L: 26, bothStrands: true, errorRate: 0.02, minOverlap: 11 }, a: { minOverlap: 9, maxErrorRate: 0.2 } },
    { name: 'Level 4 – a repeat', note: 'The genome contains the same 18 bp twice, and the reads are only 20 bp long. Some reads fit perfectly in more than one place – can you tell which arrangement is the real genome?', p: { G: 100, n: 12, L: 20, bothStrands: false, errorRate: 0, minOverlap: 8, repeatLength: 18, repeatCopies: 2 }, a: { minOverlap: 8, maxErrorRate: 0 } }
];
const CW = 15;   // px per base on the puzzle board

class OlcApp {
    constructor() {
        this.E = OlcEngine; this.V = OlcViews;
        this.$ = id => document.getElementById(id);
        this.level = 0; this.seed = 1;
        this.step = 1; this.pair = null; this.showTransitive = true;
        this.rp = { R: 30, L: 26, cov: 6, ins: 80, seed: 1 };
        this.lw = { G: 1e6, L: 1000, T: 100, c: 5 };
        this.n50 = { seed: 1, reveal: false };
        this.quiz = new OlcQuiz(this);

        document.querySelectorAll('.bl-tab').forEach(b => b.addEventListener('click', () => this.showTab(b.dataset.tab)));
        const sel = this.$('pz-level');
        OLC_LEVELS.forEach((l, i) => sel.add(new Option(l.name, i)));
        sel.addEventListener('change', () => { this.level = +sel.value; this.seed++; this.newPuzzle(); });
        this.$('pz-new').addEventListener('click', () => { this.seed++; this.newPuzzle(); });
        this.$('pz-hint').addEventListener('click', () => this.hint());
        this.$('pz-check').addEventListener('click', () => this.check());
        this.$('pz-answer').addEventListener('click', () => this.answer());
        document.querySelectorAll('#olc-steps .bl-step').forEach(b => b.addEventListener('click', () => this.showStep(+b.dataset.step)));
        this.$('algo-prev').addEventListener('click', () => this.showStep(this.step - 1));
        this.$('algo-next').addEventListener('click', () => this.showStep(this.step + 1));
        this.$('algo-content').addEventListener('click', e => this.onAlgoClick(e));
        for (const [id, key, fmt] of [['al-minol', 'minOverlap', v => v + ' bp'], ['al-mis', 'maxErrorRate', v => v + ' %']]) {
            this.$(id).addEventListener('input', () => { const v = +this.$(id).value; this.aopts[key] = key === 'maxErrorRate' ? v / 100 : v; this.$(id + '-value').textContent = fmt(v); this.assembly = null; this.showStep(this.step); });
        }
        for (const [id, key, fmt] of [['rp-R', 'R', v => v + ' bp'], ['rp-L', 'L', v => v + ' bp'], ['rp-cov', 'cov', v => v + '×'], ['rp-ins', 'ins', v => v + ' bp']]) {
            this.$(id).value = this.rp[key]; this.$(id + '-value').textContent = fmt(this.rp[key]);
            this.$(id).addEventListener('input', () => { this.rp[key] = +this.$(id).value; this.$(id + '-value').textContent = fmt(this.rp[key]); clearTimeout(this.rpT); this.rpT = setTimeout(() => this.renderRepeats(key !== 'ins'), 150); });
        }
        this.$('rp-new').addEventListener('click', () => { this.rp.seed++; this.renderRepeats(true); });
        this.$('stats-content').addEventListener('input', e => this.onStatsInput(e));
        this.$('stats-content').addEventListener('change', e => this.onStatsInput(e));
        this.$('stats-content').addEventListener('click', e => this.onStatsClick(e));
        this.$('rep-content').addEventListener('click', e => { if (e.target.id === 'rp-transitive') { this.rpTrans = e.target.checked; this.renderRepeats(false); } });
        document.addEventListener('keydown', e => this.onKey(e));

        this.newPuzzle();
        const m = /^#(puzzle|algorithm|repeats|stats|quiz)(?:-(\d))?$/.exec(location.hash);
        if (m && m[2]) this.step = +m[2];
        this.showTab(m ? m[1] : 'puzzle');
    }

    showTab(tab) {
        this.tab = tab;
        document.querySelectorAll('.bl-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        for (const t of ['puzzle', 'algorithm', 'repeats', 'stats', 'quiz']) this.$('tab-' + t).hidden = t !== tab;
        document.querySelectorAll('.side-panel [data-for]').forEach(s => { s.hidden = !s.dataset.for.split(' ').includes(tab); });
        if (tab === 'algorithm') this.showStep(this.step);
        else if (tab === 'repeats') { this.renderRepeats(!this.rep); history.replaceState(null, '', '#repeats'); }
        else if (tab === 'stats') { this.renderStats(); history.replaceState(null, '', '#stats'); }
        else if (tab === 'quiz') { this.quiz.ensure(); history.replaceState(null, '', '#quiz'); }
        else history.replaceState(null, '', '#puzzle');
    }
    toast(msg) { const el = document.createElement('div'); el.className = 'notification notification-info show'; el.textContent = msg; this.$('toast-stack').appendChild(el); setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3500); }

    // =====================================================================
    // TAB 1 – the puzzle
    // =====================================================================
    newPuzzle() {
        const lv = OLC_LEVELS[this.level];
        this.$('pz-level').value = this.level;
        this.$('pz-level-note').textContent = lv.note;
        // validated puzzles: levels 1–3 must assemble into one correct contig; level 4 must be ambiguous (the graph branches)
        let pz = null;
        for (let t = 0; t < 60; t++) {
            const seed = this.seed * 97 + t;
            const genome = this.E.buildGenome({ G: lv.p.G, repeatLength: lv.p.repeatLength || 0, repeatCopies: lv.p.repeatCopies || 0, seed });
            const reads = this.E.sampleReads(genome, Object.assign({}, lv.p, { seed, tile: true }));
            const A = this.E.assemble(reads, genome, Object.assign({ bothStrands: lv.p.bothStrands }, lv.a));
            const ok = this.level === 3 ? A.unitigs.length > 1 && A.unitigs.every(c => c.correct) : A.unitigs.length === 1 && A.unitigs[0].correct;
            pz = { genome, reads, A };
            if (ok) break;
        }
        this.pz = pz;
        this.aopts = Object.assign({ bothStrands: lv.p.bothStrands }, lv.a);
        this.assembly = pz.A;
        this.$('al-minol').value = this.aopts.minOverlap; this.$('al-minol-value').textContent = this.aopts.minOverlap + ' bp';
        this.$('al-mis').value = Math.round(this.aopts.maxErrorRate * 100); this.$('al-mis-value').textContent = Math.round(this.aopts.maxErrorRate * 100) + ' %';
        // start positions: scattered at the left, reads as sequenced (not flipped)
        const rng = new this.E.Rng('start-' + this.seed + '-' + this.level);
        this.x = pz.reads.map(() => rng.int(0, 30));
        this.flip = pz.reads.map(() => false);
        this.sel = 0;
        this.$('pz-result').innerHTML = '';
        this.buildPairs();
        this.buildBoard();
        this.pair = null;
        if (this.tab === 'algorithm') this.showStep(this.step);
    }

    // one overlap per pair of reads (the longest), from the overlaps between the reads as sequenced; plus a graph layout
    buildPairs() {
        const best = new Map();
        for (const o of this.pz.A.raw.overlaps) {
            const key = Math.min(o.a, o.b) + '-' + Math.max(o.a, o.b);
            if (!best.has(key) || best.get(key).len < o.len) best.set(key, o);
        }
        this.pairs = [...best.values()];
        this.gpos = this.V.forceLayout(this.pz.reads.length, this.pairs.map(o => ({ a: o.a, b: o.b, w: o.len / 20 })), this.seed * 7 + this.level, 700, 280);
        const g = this.$('pz-graph');
        if (!g.dataset.bound) {
            g.dataset.bound = 1;
            g.addEventListener('click', e => {
                const ed = e.target.closest('[data-edge]'), nd = e.target.closest('[data-node]');
                if (nd) { this.sel = +nd.dataset.node; this.updateBoard(); }
                else if (ed) this.applyPair(this.pairs[+ed.dataset.edge]);
            });
        }
    }

    // geometry of an overlap record: first sequence F, second S starting `shift` after F
    pairGeometry(o) {
        const r = this.pz.reads;
        const firstRc = !!o.aFlipped, secondRc = o.flip && !o.aFlipped;
        return { firstRc, secondRc, lenF: r[o.a].len, lenS: r[o.b].len, shift: o.shift };
    }

    // where read `m` must go (and whether flipped) so that it overlaps the fixed read `f` as this overlap says
    placeBy(o, f) {
        const g = this.pairGeometry(o);
        if (f === o.a) {
            const asF = this.flip[o.a] === g.firstRc;           // fixed read shown as F → partner shown as S after it
            return asF ? { m: o.b, x: this.x[o.a] + g.shift, flip: g.secondRc } : { m: o.b, x: this.x[o.a] + g.lenF - g.shift - g.lenS, flip: !g.secondRc };
        }
        const asS = this.flip[o.b] === g.secondRc;
        return asS ? { m: o.a, x: this.x[o.b] - g.shift, flip: g.firstRc } : { m: o.a, x: this.x[o.b] + g.shift + g.lenS - g.lenF, flip: !g.firstRc };
    }
    pairUsed(o) { const p = this.placeBy(o, o.a); return this.x[p.m] === p.x && this.flip[p.m] === p.flip; }

    applyPair(o) {
        // keep the selected read (or the one with more satisfied overlaps) in place and move its partner
        const score = i => this.pairs.filter(q => (q.a === i || q.b === i) && this.pairUsed(q)).length;
        const fixed = this.sel === o.a || this.sel === o.b ? this.sel : score(o.a) >= score(o.b) ? o.a : o.b;
        const p = this.placeBy(o, fixed);
        const shiftAll = p.x < 0 ? -p.x : p.x + this.pz.reads[p.m].len > this.span ? this.span - p.x - this.pz.reads[p.m].len : 0;
        const flipChanged = this.flip[p.m] !== p.flip;
        this.flip[p.m] = p.flip; this.x[p.m] = p.x;
        if (shiftAll) this.x = this.x.map(v => Math.max(0, Math.min(this.span - 1, v + shiftAll)));
        if (flipChanged) { const strip = this.$('board').querySelector(`.olc-strip[data-read="${p.m}"]`); strip.innerHTML = [...this.shown(p.m)].map(c => `<span class="olc-c">${c}</span>`).join(''); }
        this.sel = p.m;
        this.updateBoard();
        this.toast(`${this.pz.reads[p.m].name} ${flipChanged ? 'flipped and ' : ''}placed to overlap ${this.pz.reads[fixed].name} by ${o.len} bp.`);
    }

    shown(i) { const r = this.pz.reads[i]; return this.flip[i] ? this.E.revcomp(r.seq) : r.seq; }

    buildBoard() {
        const reads = this.pz.reads, G = this.pz.genome.seq.length, L = Math.max(...reads.map(r => r.len));
        this.span = G + L + 12;
        const W = this.span * CW;
        let h = `<div class="olc-bscroll"><div class="olc-bgrid" style="width:${W + 110}px">`;
        h += `<div class="olc-prow olc-pcons"><span class="olc-plab">consensus</span><span class="olc-ptrack" id="pz-cons" style="width:${W}px"></span></div>`;
        h += `<div class="olc-prow olc-pdepth"><span class="olc-plab">depth</span><span class="olc-ptrack" id="pz-depth" style="width:${W}px"></span></div>`;
        reads.forEach((r, i) => {
            h += `<div class="olc-prow" data-row="${i}"><span class="olc-plab"><button class="olc-flip" data-flip="${i}" title="reverse complement (F)">⇄</button> ${r.name}</span><span class="olc-ptrack" style="width:${W}px"><span class="olc-strip" data-read="${i}">${[...this.shown(i)].map(c => `<span class="olc-c">${c}</span>`).join('')}</span></span></div>`;
        });
        h += '</div></div>';
        const board = this.$('board');
        board.innerHTML = h;
        board.querySelectorAll('.olc-strip').forEach(el => this.bindDrag(el));
        board.querySelectorAll('[data-flip]').forEach(b => b.addEventListener('click', () => this.doFlip(+b.dataset.flip)));
        this.updateBoard();
    }

    bindDrag(el) {
        const i = +el.dataset.read;
        el.addEventListener('pointerdown', e => {
            e.preventDefault();
            this.sel = i; el.setPointerCapture(e.pointerId);
            const x0 = this.x[i], px0 = e.clientX;
            const move = ev => { const nx = Math.max(0, Math.min(this.span - this.pz.reads[i].len, x0 + Math.round((ev.clientX - px0) / CW))); if (nx !== this.x[i]) { this.x[i] = nx; this.updateBoard(); } };
            const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); this.updateBoard(); };
            el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
            this.updateBoard();
        });
    }

    doFlip(i) {
        // flip in place: keep the read where it is
        this.flip[i] = !this.flip[i]; this.sel = i;
        const strip = this.$('board').querySelector(`.olc-strip[data-read="${i}"]`);
        strip.innerHTML = [...this.shown(i)].map(c => `<span class="olc-c">${c}</span>`).join('');
        this.updateBoard();
    }

    onKey(e) {
        if (this.tab !== 'puzzle' || this.sel === null || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); this.x[this.sel] = Math.max(0, Math.min(this.span - this.pz.reads[this.sel].len, this.x[this.sel] + (e.key === 'ArrowLeft' ? -1 : 1))); this.updateBoard(); }
        else if (e.key === 'f' || e.key === 'F') this.doFlip(this.sel);
        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); this.sel = (this.sel + (e.key === 'ArrowUp' ? -1 : 1) + this.pz.reads.length) % this.pz.reads.length; this.updateBoard(); }
    }

    // column-wise majority of the student's layout
    boardConsensus() {
        const cols = Array.from({ length: this.span }, () => ({}));
        this.pz.reads.forEach((r, i) => { const s = this.shown(i); for (let k = 0; k < s.length; k++) { const c = cols[this.x[i] + k]; c[s[k]] = (c[s[k]] || 0) + 1; } });
        return cols.map(c => {
            const d = Object.values(c).reduce((a, b) => a + b, 0);
            if (!d) return { d: 0, base: '', agree: true };
            const best = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
            const tie = Object.values(c).filter(v => v === c[best]).length > 1;
            return { d, base: tie ? '?' : best, agree: c[best] === d, counts: c, tie };
        });
    }

    updateBoard() {
        const cons = this.boardConsensus();
        this.cons = cons;
        this.$('pz-cons').innerHTML = cons.map((c, i) => `<span class="olc-c ${c.d ? (c.agree ? 'olc-cok' : 'olc-cbad') : ''}" style="left:${i * CW}px">${c.base}</span>`).join('');
        this.$('pz-depth').innerHTML = cons.map((c, i) => c.d ? `<span class="olc-c d${Math.min(4, c.d)}" style="left:${i * CW}px">${c.d}</span>` : '').join('');
        this.pz.reads.forEach((r, i) => {
            const strip = this.$('board').querySelector(`.olc-strip[data-read="${i}"]`);
            strip.style.left = this.x[i] * CW + 'px';
            strip.classList.toggle('sel', i === this.sel);
            const s = this.shown(i);
            [...strip.children].forEach((sp, k) => { const c = cons[this.x[i] + k]; sp.className = 'olc-c ' + (c.d < 2 ? '' : s[k] === c.base ? 'olc-ok' : 'olc-err'); });
            this.$('board').querySelector(`[data-flip="${i}"]`).classList.toggle('on', this.flip[i]);
        });
        const covered = cons.filter(c => c.d).length, conflicts = cons.filter(c => c.d && !c.agree).length;
        let first = cons.findIndex(c => c.d), last = cons.length - 1 - [...cons].reverse().findIndex(c => c.d), gaps = 0;
        for (let i = first; i <= last; i++) if (!cons[i].d) gaps++;
        this.$('pz-status').innerHTML = `consensus length ${last - first + 1} bp · <span class="${conflicts ? 'dp-red' : 'dp-green'}">${conflicts} column${conflicts === 1 ? '' : 's'} with disagreement</span> · <span class="${gaps ? 'dp-red' : ''}">${gaps} uncovered position${gaps === 1 ? '' : 's'} inside</span>`;
        this.pairs.forEach(o => { o.used = this.pairUsed(o); });
        this.$('pz-graph').innerHTML = this.V.puzzleGraph(this.pz.reads.map(r => r.name), this.gpos, this.pairs, { selected: this.sel });
        const groups = this.groups();
        this.$('pz-summary').innerHTML = `<p>${this.pz.reads.length} reads, genome ${this.pz.genome.seq.length} bp.</p><p>Columns covered: ${covered}; disagreements: ${conflicts}.</p><p class="dp-hint">Largest group of reads placed correctly relative to each other: <strong>${groups.best.length}</strong> of ${this.pz.reads.length}.</p>`;
    }

    // reads grouped by their true relative placement (same genome orientation and same offset to the truth)
    groups() {
        const map = new Map();
        this.pz.reads.forEach((r, i) => {
            const g = r.strand * (this.flip[i] ? -1 : 1);
            const key = g > 0 ? `+${this.x[i] - r.start}` : `-${this.x[i] + r.start + r.len}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(i);
        });
        const all = [...map.entries()].sort((a, b) => b[1].length - a[1].length);
        return { all, best: all[0][1], key: all[0][0] };
    }

    hint() {
        const gr = this.groups();
        const i = this.pz.reads.findIndex((_, j) => !gr.best.includes(j) || gr.best.length === 1 && j !== gr.best[0]);
        if (i < 0) { this.toast('All reads are already placed consistently – press "Check my assembly".'); return; }
        const anchor = gr.best[0], ra = this.pz.reads[anchor], g = ra.strand * (this.flip[anchor] ? -1 : 1);
        const r = this.pz.reads[i];
        this.flip[i] = r.strand * g < 0;                 // same genome orientation as the anchor
        const cst = g > 0 ? this.x[anchor] - ra.start : this.x[anchor] + ra.start + ra.len;
        this.x[i] = g > 0 ? cst + r.start : cst - r.start - r.len;
        // off the board? shift the whole placed group together with the new read
        const moved = gr.best.concat(i);
        const lo = Math.min(...moved.map(j => this.x[j])), hi = Math.max(...moved.map(j => this.x[j] + this.pz.reads[j].len));
        const d = lo < 0 ? -lo : hi > this.span ? this.span - hi : 0;
        if (d) moved.forEach(j => { this.x[j] += d; });
        this.sel = i;
        const strip = this.$('board').querySelector(`.olc-strip[data-read="${i}"]`);
        strip.innerHTML = [...this.shown(i)].map(c => `<span class="olc-c">${c}</span>`).join('');
        this.updateBoard();
        this.toast(`${r.name} was moved${this.flip[i] ? ' and flipped' : ''} to fit next to ${ra.name}.`);
    }

    answer() {
        const off = 4;
        this.pz.reads.forEach((r, i) => { this.flip[i] = r.strand < 0; this.x[i] = r.start + off; });
        this.buildBoard();
        this.check(true);
    }

    check(fromAnswer) {
        const cons = this.cons, first = cons.findIndex(c => c.d), last = cons.length - 1 - [...cons].reverse().findIndex(c => c.d);
        const seq = cons.slice(first, last + 1).map(c => c.base || '-').join('');
        const gaps = cons.slice(first, last + 1).filter(c => !c.d).length, conflicts = cons.filter(c => c.d && !c.agree).length;
        const gr = this.groups(), n = this.pz.reads.length, G = this.pz.genome.seq;
        const place = this.E.bestPlacement(seq.replace(/[-?]/g, 'N'), G);
        const equal = seq === G || seq === this.E.revcomp(G);
        let msg, cls;
        if (gr.best.length === n) {
            cls = 'as-clean';
            msg = `<strong>${fromAnswer ? 'This is the true layout.' : 'Solved!'}</strong> Every read is in its true place. ${equal ? 'The consensus is exactly the genome' + (seq === G ? '' : ' (read from the other strand – the reverse complement, which is just as correct)') + '.' : `The consensus differs from the genome in ${place ? place.mis : '?'} position${place && place.mis === 1 ? '' : 's'}: where only one or two reads cover a position, a sequencing error cannot be outvoted.`}`;
        } else if (!gaps && !conflicts && this.level === 3) {
            cls = 'as-gap';
            msg = `<strong>Consistent – but not the genome.</strong> Every column agrees and nothing is missing, yet ${n - gr.best.length} read${n - gr.best.length > 1 ? 's are' : ' is'} not where it came from: the reads inside the repeat fit equally well in either copy, and the parts between the copies can be swapped. Overlaps alone cannot tell the two arrangements apart – look at the graph: around the repeat some reads have two possible successors, and both choices are real overlaps. This is what repeats do to assemblies (tab 3).`;
        } else {
            cls = 'as-tangle';
            msg = `<strong>Not yet.</strong> ${gr.best.length} of ${n} reads are placed correctly relative to each other. ${gaps ? `There ${gaps === 1 ? 'is a hole' : `are ${gaps} holes`} in the layout. ` : ''}${conflicts ? `${conflicts} column${conflicts > 1 ? 's' : ''} disagree${conflicts > 1 ? '' : 's'}${this.level === 2 ? ' – errors are expected, but many red letters in one read mean it is misplaced.' : ' – a read that disagrees with its neighbours is misplaced or needs flipping.'}` : ''}`;
        }
        const truth = `<div class="olc-truth"><div><span class="olc-blab">genome</span><span class="bl-mono">${G}</span></div><div><span class="olc-blab">yours</span><span class="bl-mono">${seq}</span></div></div>`;
        this.$('pz-result').innerHTML = `<div class="as-diag ${cls}">${msg}</div>${truth}`;
    }

    // =====================================================================
    // TAB 2 – the algorithm
    // =====================================================================
    getAssembly() {
        if (!this.assembly) this.assembly = this.E.assemble(this.pz.reads, this.pz.genome, this.aopts);
        return this.assembly;
    }
    names() { return this.pz.reads.map(r => r.name); }

    showStep(n) {
        this.step = Math.max(1, Math.min(5, n));
        document.querySelectorAll('#olc-steps .bl-step').forEach(b => b.classList.toggle('active', +b.dataset.step === this.step));
        this.$('algo-prev').disabled = this.step === 1; this.$('algo-next').disabled = this.step === 5;
        if (this.tab === 'algorithm') history.replaceState(null, '', '#algorithm-' + this.step);
        this.$('algo-content').innerHTML = this['algo' + this.step]();
    }

    // x positions (bp) of graph nodes from the unitig layout, contigs placed one after another
    layoutX(A) {
        const x = new Map(), contigOf = new Map();
        let base = 0;
        A.unitigs.forEach((c, ci) => { c.reads.forEach((id, k) => { if (!x.has(id)) { x.set(id, base + c.offsets[k]); contigOf.set(id, ci); } }); base += c.length + 8; });
        return { x, contigOf };
    }

    algo1() {
        const A = this.getAssembly(), reads = this.pz.reads, nm = this.names(), n = reads.length;
        const best = new Map();
        for (const o of A.raw.overlaps) { const k = o.a + ',' + o.b; if (!best.has(k) || best.get(k).len < o.len) best.set(k, o); }
        const cont = new Map(A.raw.containments.map(c => [c.outer + ',' + c.inner, c]));
        let t = `<table class="olc-matrix"><tr><th>first ↓ / second →</th>${nm.map(x => `<th>${x}</th>`).join('')}</tr>`;
        for (let i = 0; i < n; i++) {
            t += `<tr><th>${nm[i]}</th>`;
            for (let j = 0; j < n; j++) {
                if (i === j) { t += '<td class="olc-diag"></td>'; continue; }
                const o = best.get(i + ',' + j), c = cont.get(i + ',' + j);
                const sel = this.pair && this.pair.a === i && this.pair.b === j;
                t += o ? `<td class="olc-ov ${sel ? 'sel' : ''}" data-pa="${i}" data-pb="${j}" title="${nm[i]} then ${nm[j]}${o.flip ? ' – one of them reverse-complemented' : ''}: overlap ${o.len} bp, ${o.mis} mismatch(es)">${o.len}${o.flip ? '<sup>rc</sup>' : ''}</td>`
                    : c ? `<td class="olc-ct" title="${nm[j]} lies inside ${nm[i]}">⊃</td>` : '<td></td>';
            }
            t += '</tr>';
        }
        t += '</table>';
        const pairs = n * (n - 1);
        let detail = '';
        if (this.pair) {
            const o = best.get(this.pair.a + ',' + this.pair.b);
            if (o) {
                const a = o.aFlipped ? this.E.revcomp(reads[o.a].seq) : reads[o.a].seq, b = o.flip && !o.aFlipped ? this.E.revcomp(reads[o.b].seq) : reads[o.b].seq;
                const cell = (ch, cls) => `<span class="olc-c ${cls}">${ch}</span>`;
                const rowA = [...a].map((ch, k) => cell(ch, k >= o.shift ? (ch === b[k - o.shift] ? 'olc-ok' : 'olc-err') : '')).join('');
                const rowB = cell('', '').repeat(0) + Array.from({ length: o.shift }, () => cell('', '')).join('') + [...b].map((ch, k) => cell(ch, k < o.len ? (ch === a[o.shift + k] ? 'olc-ok' : 'olc-err') : '')).join('');
                detail = `<h4>${nm[o.a]}${o.aFlipped ? ' (reverse complement)' : ''} followed by ${nm[o.b]}${o.flip && !o.aFlipped ? ' (reverse complement)' : ''}</h4>
                    <div class="olc-block"><div class="olc-brow"><span class="olc-blab">${nm[o.a]}${o.aFlipped ? ' rc' : ''}</span>${rowA}</div><div class="olc-brow"><span class="olc-blab">${nm[o.b]}${o.flip && !o.aFlipped ? ' rc' : ''}</span>${rowB}</div></div>
                    <p>The last ${o.len} bases of the first read match the first ${o.len} bases of the second${o.mis ? ` with ${o.mis} mismatch${o.mis > 1 ? 'es' : ''} (red)` : ' exactly'}: a <strong>dovetail overlap</strong>. The second read extends ${b.length - o.len} bp beyond the end of the first.</p>`;
            }
        }
        return `<h3>Step 1 – Overlaps: compare every read with every other read</h3>
            <p>For each ordered pair of reads the assembler asks: does the <em>end</em> of the first read match the <em>beginning</em> of the second? It tries every overlap length from the longest down to the minimum (side panel: ${this.aopts.minOverlap} bp) and accepts the longest one with at most ${Math.round(this.aopts.maxErrorRate * 100)} % mismatches. Because reads come from both strands, each pair is also tried with one read reverse-complemented (<sup>rc</sup>).</p>
            <p><strong>Click a number</strong> to see the overlap. Row = first read, column = second read; ⊃ = the column read lies completely inside the row read (a <em>contained</em> read, dropped from the graph).</p>
            <div class="olc-matrix-wrap">${t}</div>
            ${detail}
            <p>${n} reads → ${pairs} ordered pairs × 2 orientations = <strong>${2 * pairs}</strong> comparisons; ${A.raw.overlaps.length} overlaps found. The work grows with the square of the number of reads: 1 million reads would need 10<sup>12</sup> comparisons.</p>
            <div class="bl-lesson"><strong>In real assemblers</strong> nobody compares all pairs. Candidate pairs are found first through shared k-mers or <em>minimizers</em> (a sample of k-mers that overlapping reads are likely to share – minimap2, MHAP), and only those are aligned. Long reads also contain insertion and deletion errors, so their overlaps need alignment with gaps; here errors are substitutions only, so an overlap is a letter-by-letter comparison.</div>`;
    }

    algo2() {
        const A = this.getAssembly(), nm = this.names(), reads = this.pz.reads;
        const flipped = reads.map((r, i) => A.orientation[i] < 0);
        return `<h3>Step 2 – Orientation: which strand is each read from?</h3>
            <p>An overlap between reads from opposite strands shows up only after reverse-complementing one of them (the <sup>rc</sup> overlaps of step 1). So before the reads can be laid out, each needs an orientation. The assembler fixes the first read as it is and follows the longest overlaps outwards: an ordinary overlap means "same orientation as my neighbour", an <sup>rc</sup> overlap means "the opposite one".</p>
            <table class="bl-table hm-narrow"><tr><th>read</th><th>used as</th><th>truth</th></tr>
            ${reads.map((r, i) => `<tr><td>${nm[i]}</td><td>${flipped[i] ? '⇄ reverse complement' : 'as sequenced'}</td><td class="dp-hint">${r.strand > 0 ? '+' : '−'} strand</td></tr>`).join('')}</table>
            <p>${A.components === 1 ? 'All reads are connected by overlaps, so one consistent orientation exists.' : `The reads fall into ${A.components} groups without overlaps between them – their orientations relative to each other cannot be known.`} Compare with the truth: either all reads used "as sequenced" are + strand and all flipped ones − strand, or exactly the opposite – the assembly may come out as the reverse complement of the genome, which is equally correct: DNA has two strands.</p>
            <div class="bl-lesson"><strong>In real assemblers</strong> each read is a node with two ends, and overlaps connect ends ("bidirected" or string graphs); the orientation is decided while walking the graph. The idea is the same: an overlap between opposite strands flips the orientation.</div>`;
    }

    algo3() {
        const A = this.getAssembly(), g = A.graph, nm = this.names();
        const { x, contigOf } = this.layoutX(A);
        const flipped = new Set(this.pz.reads.map((r, i) => A.orientation[i] < 0 ? i : -1).filter(i => i >= 0));
        const trans = g.edges.filter(e => e.transitive), kept = g.edges.filter(e => !e.transitive);
        const ex = trans[0];
        return `<h3>Step 3 – The overlap graph and transitive reduction</h3>
            <p>Every read (in its orientation from step 2) is a <strong>node</strong>; every overlap "A's end matches B's beginning" is an <strong>arrow</strong> A → B, labelled with the overlap length. Reads are drawn in the order of the final layout; colours mark the contigs of step 4.</p>
            <label class="ms-check"><input type="checkbox" data-act="trans" ${this.showTransitive ? 'checked' : ''}> show transitive edges (dashed)</label>
            <div class="olc-graph-wrap">${this.V.graph(g, x, { showTransitive: this.showTransitive, contigOf, names: nm, flipped })}</div>
            <p>With deep coverage a read overlaps not only its immediate successor but also the one after that: A → B, B → C and also A → C. The long arrow A → C adds no information – it is implied by going through B. <strong>Transitive reduction</strong> removes such arrows: ${g.edges.length} overlaps → <strong>${kept.length}</strong> after removing ${trans.length} transitive ones.${ex ? ` For example ${nm[ex.from]} → ${nm[ex.to]} (overlap ${ex.len}) is explained by ${nm[ex.from]} → ${nm[ex.via]} → ${nm[ex.to]}.` : ''} ${g.containments.length ? `Contained reads (${g.containments.map(c => nm[c.inner]).join(', ')}) are set aside – they add nothing to the layout but are used again for the consensus.` : ''}</p>
            <div class="bl-lesson"><strong>Why it matters:</strong> after the reduction an unrepetitive genome becomes a simple chain of arrows – the layout can be read off directly. This reduced graph is the <em>string graph</em> (Myers, 2005) used by Hifiasm and others. Wherever a node still has two arrows going in or out, the genome is ambiguous at that point – usually a repeat (tab 3).</div>`;
    }

    algo4() {
        const A = this.getAssembly(), nm = this.names();
        const blocks = A.unitigs.map((c, ci) => `<h4><span class="olc-dot-c" style="background:${this.V.CONTIG_COLORS[ci % 8]}"></span>Contig ${ci + 1}: ${c.reads.map(i => nm[i]).join(' → ')} (${c.length} bp)</h4>${this.V.layoutBlock(c, nm, { showDepth: false })}`).join('');
        return `<h3>Step 4 – Layout: follow the chain</h3>
            <p>Starting from a read with no arrow coming in, the assembler follows the arrows as long as there is exactly one way to go. Each step places the next read at its offset (read length minus overlap). Such an unambiguous stretch is a <strong>contig</strong> (unitig). Here: <strong>${A.unitigs.length}</strong> contig${A.unitigs.length > 1 ? 's' : ''}.</p>
            ${blocks}
            <p>${A.unitigs.length === 1 ? 'One chain through all reads: the whole genome in one piece.' : 'The layout stops where the graph branches or breaks – each piece becomes its own contig.'} This is the same layout you built by hand in tab 1 – the consensus is still missing.</p>
            <div class="bl-lesson"><strong>Why not simply "the path through all reads"?</strong> Finding a path that visits every node exactly once (a Hamiltonian path) is computationally hard in general, and with repeats there are many such paths – most of them wrong. Assemblers therefore output only the unambiguous parts and stop at branches: fragmented, but correct. The alternative – greedily joining the longest overlaps – is compared in tab 3.</div>`;
    }

    algo5() {
        const A = this.getAssembly(), nm = this.names(), G = this.pz.genome.seq;
        const blocks = A.unitigs.map((c, ci) => {
            const cols = c.consensus.columns, fixed = cols.filter(x => !x.agree && !x.tie).length, ties = cols.filter(x => x.tie).length;
            const pl = c.place;
            return `<h4>Contig ${ci + 1}</h4>${this.V.layoutBlock(c, nm)}
                <p>${fixed ? `<strong>${fixed}</strong> column${fixed > 1 ? 's' : ''} where a read disagrees with the majority – a sequencing error, outvoted (yellow). ` : 'Every read agrees in every column. '}${ties ? `<strong>${ties}</strong> column${ties > 1 ? 's' : ''} with a tie (N, grey): only two reads, one of them wrong – no majority. ` : ''}${pl ? `Compared with the true genome: <strong>${pl.mis}</strong> difference${pl.mis === 1 ? '' : 's'} over ${c.length} bp${pl.strand < 0 ? ' (the contig is the reverse complement of the genome)' : ''}.` : ''}</p>`;
        }).join('');
        return `<h3>Step 5 – Consensus: let the reads vote</h3>
            <p>With the reads stacked in their layout, the assembler goes column by column and takes the <strong>majority base</strong>. A sequencing error in one read is outvoted as long as more reads cover that position correctly – the deeper the coverage, the more reliable the consensus. Hover a consensus letter for the votes.</p>
            ${blocks}
            <p class="dp-hint">Genome: <span class="bl-mono">${G}</span></p>
            <div class="bl-lesson"><strong>Consensus quality depends on depth.</strong> One read: every error stays. Two reads: an error becomes a tie. Three or more: errors are outvoted. Real long reads have indel errors, so the reads are first aligned to each other (a multiple alignment, or a partial-order graph – Racon, Medaka) and the consensus is polished in several rounds. Try level 3 in tab 1 for errors, and the "allowed mismatches" slider: with 0 % the overlaps between reads with errors are missed.</div>`;
    }

    onAlgoClick(e) {
        const c = e.target.closest('[data-pa]');
        if (c) { this.pair = { a: +c.dataset.pa, b: +c.dataset.pb }; this.showStep(1); return; }
        const t = e.target.closest('[data-act="trans"]');
        if (t) { this.showTransitive = t.checked; this.showStep(3); }
    }

    // =====================================================================
    // TAB 3 – repeats, greedy, mate pairs
    // =====================================================================
    repeatData(resample) {
        if (this.rep && !resample) return this.rep;
        const p = this.rp;
        let best = null;
        for (let t = 0; t < 25; t++) {                              // prefer a genome where greedy misassembles (the lesson), unitigs are correct
            const seed = p.seed * 131 + t;
            const genome = this.E.buildGenome({ G: 170, repeatLength: p.R, repeatCopies: 2, seed });
            const reads = this.E.sampleReads(genome, { coverage: p.cov, L: p.L, bothStrands: true, errorRate: 0, minOverlap: 8, seed, tile: true });
            const A = this.E.assemble(reads, genome, { minOverlap: 8, maxErrorRate: 0, bothStrands: true });
            const d = { genome, reads, A, seed };
            if (!best) best = d;
            if (A.unitigs.every(c => c.correct) && A.greedy.some(c => !c.correct)) { best = d; break; }
        }
        this.rep = best;
        return best;
    }

    renderRepeats(resample) {
        const D = this.repeatData(resample), A = D.A, G = D.genome, p = this.rp;
        const nm = D.reads.map(r => r.name);
        const { x, contigOf } = this.layoutX(A);
        const genomeBar = (() => {
            const W = 640, sx = W / G.seq.length;
            let s = `<svg class="olc-gbar" viewBox="0 0 ${W} 34" width="${W}" height="34"><rect x="0" y="8" width="${W}" height="14" fill="#cbd5e0"/>`;
            G.repeats.forEach((r, k) => { s += `<rect x="${r.start * sx}" y="4" width="${(r.end - r.start) * sx}" height="22" fill="#d97706"/><text x="${(r.start + r.end) / 2 * sx}" y="19" font-size="10" text-anchor="middle" fill="#fff">repeat copy ${k + 1}</text>`; });
            ['A', 'B', 'C'].forEach((lab, k) => { const st = k === 0 ? 0 : G.repeats[k - 1].end, en = k < G.repeats.length ? G.repeats[k].start : G.seq.length; s += `<text x="${(st + en) / 2 * sx}" y="19" font-size="11" text-anchor="middle" fill="#1f1e1b">unique ${lab}</text>`; });
            return s + `<text x="0" y="33" font-size="9" fill="#718096">0</text><text x="${W}" y="33" font-size="9" text-anchor="end" fill="#718096">${G.seq.length} bp</text></svg>`;
        })();
        const tigRow = (c, i, kind) => `<tr class="${c.correct ? '' : 'miss'}"><td>${i + 1}</td><td>${c.reads.length}</td><td>${c.length} bp</td><td>${!c.correct ? '<span class="dp-red">misassembled – joins sequence that is not adjacent in the genome</span>' : c.repeat ? '<span class="olc-rep">the repeat (both copies collapsed into one)</span>' : `genome ${c.place.pos + 1}–${c.place.pos + c.length}`}</td></tr>`;
        const canSpan = p.L > p.R + 8;
        // mate pairs
        const pairs = this.E.matePairs(G, { n: 50, insert: p.ins, sd: 4, L: Math.min(p.L, 20), seed: D.seed });
        const sc = this.E.scaffold(A.unitigs.map(c => c.consensus.seq), pairs, p.ins);
        const scaffoldSvg = (() => {
            if (!sc.layout.length) return '<p class="dp-hint">No contig pair is linked by at least two mate pairs – try a larger insert size.</p>';
            const lo = Math.min(...sc.layout.map(l => l.pos)), hi = Math.max(...sc.layout.map(l => l.pos + l.len));
            const W = 640, sx = (W - 20) / (hi - lo);
            let s = `<svg class="olc-gbar" viewBox="0 0 ${W} ${24 + sc.layout.length * 22}" width="${W}" height="${24 + sc.layout.length * 22}">`;
            sc.layout.forEach((l, k) => {
                const c = A.unitigs[l.contig], col = c.repeat ? '#d97706' : this.V.CONTIG_COLORS[l.contig % 8];
                s += `<rect x="${10 + (l.pos - lo) * sx}" y="${8 + k * 22}" width="${l.len * sx}" height="14" rx="3" fill="${col}"/><text x="${14 + (l.pos - lo) * sx}" y="${19 + k * 22}" font-size="10" fill="#fff">contig ${l.contig + 1}${c.repeat ? ' (repeat)' : ''}</text>`;
            });
            return s + '</svg>';
        })();
        const links = sc.summary.map(s => `<tr><td>contig ${s.a + 1} – contig ${s.b + 1}</td><td>${s.n}</td><td>${s.offset} bp</td></tr>`).join('');
        const spanning = pairs.filter(pr => G.repeats.some(r => pr.start < r.start - 2 && pr.start + pr.insert > r.end + 2)).length;
        this.$('rep-content').innerHTML = `<h3 class="as-h">A repeat longer than the reads</h3>
            <p>The genome has two identical copies of a ${p.R} bp repeat; reads are ${p.L} bp long. ${canSpan ? 'A read can reach across a whole repeat copy into unique sequence on both sides – the copies can be told apart.' : '<strong>No read is long enough to reach across a repeat copy</strong>: a read that ends inside the repeat could continue into either copy.'}</p>
            ${genomeBar}
            <h4>The overlap graph</h4>
            <label class="ms-check"><input type="checkbox" id="rp-transitive" ${this.rpTrans ? 'checked' : ''}> show transitive edges</label>
            <div class="olc-graph-wrap">${this.V.graph(A.graph, x, { showTransitive: !!this.rpTrans, contigOf, names: nm, flipped: new Set(D.reads.map((r, i) => A.orientation[i] < 0 ? i : -1).filter(i => i >= 0)) })}</div>
            <p>Reads that end inside the repeat have arrows into the reads of <em>both</em> copies, and the repeat has arrows out into both following unique segments: the graph branches. Following only unambiguous paths (step 4 of tab 2) gives <strong>${A.unitigs.length} contigs</strong>, all correct – but the genome is in pieces.</p>
            <div class="bl-two"><div><h4>Unitigs (stop at every branch)</h4><table class="bl-table"><tr><th>#</th><th>reads</th><th>length</th><th>where</th></tr>${A.unitigs.map((c, i) => tigRow(c, i)).join('')}</table>${this.V.dotplot(G.seq, A.unitigs, { size: 240, title: 'unitigs vs genome' })}</div>
            <div><h4>Greedy (join the longest overlaps first)</h4><table class="bl-table"><tr><th>#</th><th>reads</th><th>length</th><th>where</th></tr>${A.greedy.map((c, i) => tigRow(c, i)).join('')}</table>${this.V.dotplot(G.seq, A.greedy, { size: 240, title: 'greedy vs genome' })}</div></div>
            <p>${A.greedy.some(c => !c.correct) ? '<strong>Greedy produced a misassembly</strong> (red): at the repeat it took whichever overlap was longest and jumped to the wrong copy, gluing together segments that are not neighbours in the genome – longer contigs, but wrong. In the dotplot the contig line breaks and jumps.' : 'This time greedy happened to choose correctly at the repeat – press ⟳ New genome a few times: it often does not.'} Unitigs are shorter but never wrong: it is safer to stop at a branch than to guess.</p>
            <h4>Mate pairs: reads with a known distance</h4>
            <p>A <strong>mate pair</strong> (or read pair) is two reads from the two ends of one DNA fragment of known length – here ${p.ins} ± 4 bp. If one read lands in unique sequence before a repeat and its mate in unique sequence after it, the pair tells which segments belong together and how far apart they are, even though no read crosses the repeat. ${spanning} of ${pairs.length} pairs span a repeat copy${p.ins < p.R + 2 * Math.min(p.L, 20) + 4 ? ' – <strong>too few: the insert is barely longer than the repeat plus two reads; increase it</strong>' : ''}.</p>
            <table class="bl-table hm-narrow"><tr><th>linked contigs</th><th>pairs</th><th>estimated offset</th></tr>${links || '<tr><td colspan="3" class="dp-hint">no links</td></tr>'}</table>
            <h4>The scaffold</h4>${scaffoldSvg}
            <p class="dp-hint">Contigs placed by their mate-pair links (reads that fit on several contigs – inside the repeat – are ignored). Each unique contig reaches a little into the neighbouring repeat copies, so neighbours in the scaffold overlap there, or leave a gap if the repeat is longer than what the reads reached; the repeat contig's sequence fills that place in each copy. This ordered, oriented set of contigs with known distances is a <strong>scaffold</strong>. Compare the order with the genome bar above.</p>
            <div class="bl-lesson"><strong>The two solutions to repeats:</strong> reads long enough to cross them (set the read length above ${p.R + 8} bp and the graph stops branching – the reason long-read sequencing transformed genome assembly), or links that jump over them (mate pairs, Hi-C, optical maps) to order and orient the contigs into scaffolds.</div>`;
    }

    // =====================================================================
    // TAB 4 – coverage and N50
    // =====================================================================
    renderStats() {
        const s = this.lw, lw = this.E.landerWaterman(s.G, s.L, s.c, s.T);
        const curve = [], sim = [], cmax = 20, rng = new this.E.Rng('lw-' + s.L + '-' + s.T);
        for (let c = 0.25; c <= cmax; c += 0.25) { const r = this.E.landerWaterman(s.G, s.L, c, s.T); curve.push({ c, contigs: r.contigs, uncovered: r.uncovered }); }
        for (const c of [1, 2, 3, 4, 6, 8, 10, 12]) sim.push(Object.assign({ c }, this.E.simulateIslands(s.G, s.L, c, s.T, rng, 12)));
        const N = Math.round(lw.N);
        const ex = this.n50Lengths();
        const st = this.E.n50(ex);
        this.$('stats-content').innerHTML = `<h3 class="as-h">How much sequencing is enough? Lander–Waterman</h3>
            <p>Reads land at random. With N reads of length L on a genome of length G, coverage is c = N·L/G. Lander and Waterman (1988) worked out what to expect if reads are placed at random and two reads are joined when they overlap by at least T bases (θ = T/L):</p>
            <p class="hm-formula">bases never sequenced: e<sup>−c</sup> &nbsp;&nbsp;&nbsp; expected number of contigs: N · e<sup>−c(1 − θ)</sup></p>
            <div class="olc-lw-controls">
                <label>genome G: <select data-lw="G">${[[1e5, '100 kb'], [1e6, '1 Mb'], [5e6, '5 Mb (a bacterium)']].map(([v, t]) => `<option value="${v}" ${v === s.G ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
                <label>read length L: <select data-lw="L">${[[150, '150 bp (Illumina)'], [1000, '1 kb'], [15000, '15 kb (HiFi)']].map(([v, t]) => `<option value="${v}" ${v === s.L ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
                <label>minimum overlap T: <select data-lw="T">${[0, 10, 20, 40].map(v => `<option value="${v}" ${Math.round(100 * s.T / s.L) === v ? 'selected' : ''}>${v} % of L</option>`).join('')}</select></label>
                <label>coverage c: <input type="range" min="1" max="20" step="0.5" value="${s.c}" data-lw="c"> <strong>${s.c}×</strong></label>
            </div>
            ${this.V.lwChart(curve, sim, s.c)}
            <p class="dp-hint">Line: the formula; circles: simulated random reads (${this.fmtG(s.G)}); dashed: fraction of the genome not covered by any read.</p>
            <table class="bl-table hm-narrow">
                <tr><td>number of reads N = c·G/L</td><td>${N.toLocaleString()}</td></tr>
                <tr><td>genome never sequenced e<sup>−c</sup></td><td>${(100 * lw.uncovered).toPrecision(2)} % = ${Math.round(lw.uncovered * s.G).toLocaleString()} bp</td></tr>
                <tr><td>expected contigs N·e<sup>−c(1−θ)</sup></td><td><strong>${lw.contigs < 1 ? lw.contigs.toFixed(2) + ' (≈ 1: the whole genome)' : Math.round(lw.contigs).toLocaleString()}</strong></td></tr>
            </table>
            <div class="bl-lesson"><strong>Reading the curve:</strong> at low coverage there are few reads and few contigs; more reads first create <em>more</em> contigs (more islands), and only beyond c ≈ 1/(1−θ) do the islands merge. At 8–10× almost nothing is left uncovered – in theory. Real projects sequence 30–60× because coverage is not uniform (GC bias, hard-to-sequence regions), errors must be outvoted, and above all because repeats – which this model ignores – break contigs regardless of coverage.</div>

            <h3 class="as-h">N50 and L50: describing an assembly in two numbers</h3>
            <p>An assembly of ${st.total.toLocaleString()} bp came out in these contigs (bp): <strong>${ex.join(', ')}</strong>.</p>
            <p><strong>N50</strong>: sort the contigs from longest to shortest and add their lengths until you reach half of the total; the length of the contig where you cross the half is the N50. <strong>L50</strong>: how many contigs that took. Half of the assembly lies in contigs at least N50 long.</p>
            <div class="dp-answer-row"><label>N50 = <input type="number" id="n50-in" style="width:90px"></label><label>L50 = <input type="number" id="l50-in" style="width:70px"></label><button id="n50-check">Check</button><button id="n50-new">New contigs</button></div>
            <div id="n50-fb"></div>
            <div>${this.V.n50Chart(ex, this.n50.reveal)}</div>
            <div class="bl-lesson"><strong>Careful with N50:</strong> it rewards long contigs, not correct ones – the greedy assembly of tab 3 has a higher N50 than the unitigs, yet it is wrong. Assemblies are therefore also judged by completeness (BUSCO: are the expected conserved genes there?) and by agreement with independent data (genetic maps, Hi-C).</div>`;
    }
    fmtG(G) { return G >= 1e6 ? G / 1e6 + ' Mb' : G / 1e3 + ' kb'; }
    n50Lengths() { const rng = new this.E.Rng('n50-' + this.n50.seed); const n = rng.int(6, 9); return Array.from({ length: n }, () => rng.int(3, 60) * 100); }
    onStatsInput(e) {
        const k = e.target.dataset.lw;
        if (!k) return;
        if (k === 'c' ? e.type !== 'input' : e.type !== 'change') return;
        if (k === 'L') { const pct = this.lw.T / this.lw.L; this.lw.L = +e.target.value; this.lw.T = pct * this.lw.L; }
        else this.lw[k] = k === 'T' ? +e.target.value * this.lw.L / 100 : +e.target.value;
        clearTimeout(this.lwT); this.lwT = setTimeout(() => this.renderStats(), k === 'c' ? 60 : 0);
    }
    onStatsClick(e) {
        if (e.target.id === 'n50-new') { this.n50.seed++; this.n50.reveal = false; this.renderStats(); }
        if (e.target.id === 'n50-check') {
            const st = this.E.n50(this.n50Lengths()), a = +this.$('n50-in').value, b = +this.$('l50-in').value;
            const ok = a === st.n50 && b === st.l50;
            this.n50.reveal = true;
            const keepA = this.$('n50-in').value, keepB = this.$('l50-in').value;
            this.renderStats();
            this.$('n50-in').value = keepA; this.$('l50-in').value = keepB;
            let acc = 0; const steps = st.sorted.map(l => { acc += l; return `${l} (Σ ${acc})`; });
            this.$('n50-fb').innerHTML = `<div class="dp-feedback ${ok ? 'correct' : 'wrong'}">${ok ? '✔ Correct.' : `✘ N50 = <strong>${st.n50}</strong>, L50 = <strong>${st.l50}</strong>.`} Sorted: ${steps.join(' → ')}; half of ${st.total} is ${st.total / 2}, first crossed by the contig of ${st.n50} bp, the ${st.l50}. contig.</div>`;
        }
    }
}

(function () {
    const start = () => { window.olcApp = new OlcApp(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
