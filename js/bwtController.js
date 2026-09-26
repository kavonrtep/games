/**
 * GENOME INDEX LAB – controller
 * =============================
 * Tab 1 k-mer index · tab 2 suffix trie / tree / array · tab 3 BWT and its
 * inversion · tab 4 FM-index backward search · tab 5 mapping reads with
 * mismatches · quiz. Deep links: #kmer, #suffix, #bwt, #fm, #map, #quiz.
 */
class BwtApp {
    constructor() {
        this.E = BwtEngine; this.V = BwtViews;
        this.$ = id => document.getElementById(id);
        this.km = { k: 6, read: null, preset: 'unique', seed: 1 };
        this.text = 'ACGACGTACG$'; this.pat = 'ACG';
        this.inv = 0; this.fmStep = 0;
        this.mp = { rep: 30, err: 2, mm: 1, seed: 1, sel: null };
        this.quiz = new BwtQuiz(this);

        document.querySelectorAll('.bl-tab').forEach(b => b.addEventListener('click', () => this.showTab(b.dataset.tab)));
        document.querySelectorAll('input[name="txt"]').forEach(r => r.addEventListener('change', () => { if (r.value !== 'custom') this.setText(r.value); else this.$('txt-own').focus(); }));
        this.$('txt-use').addEventListener('click', () => this.useOwn());
        this.$('txt-own').addEventListener('keydown', e => { if (e.key === 'Enter') this.useOwn(); });
        this.$('pat-use').addEventListener('click', () => this.setPattern(this.$('pat').value));
        this.$('pat').addEventListener('keydown', e => { if (e.key === 'Enter') this.setPattern(this.$('pat').value); });
        for (const [id, key, fmt] of [['mp-rep', 'rep', v => v ? v + ' bp' : 'none'], ['mp-err', 'err', v => v + ' %'], ['mp-mm', 'mm', v => v]]) {
            this.$(id).value = this.mp[key]; this.$(id + '-value').textContent = fmt(this.mp[key]);
            this.$(id).addEventListener('input', () => { this.mp[key] = +this.$(id).value; this.$(id + '-value').textContent = fmt(this.mp[key]); this.mp.sel = null; if (key !== 'mm') this.mapData = null; this.renderMap(); });
        }
        this.$('mp-new').addEventListener('click', () => { this.mp.seed++; this.mapData = null; this.mp.sel = null; this.renderMap(); });
        for (const id of ['kmer', 'suffix', 'bwt', 'fm', 'map']) this.$(id + '-content').addEventListener('click', e => this.onClick(e, id));
        this.$('kmer-content').addEventListener('input', e => { if (e.target.id === 'km-k') { this.km.k = +e.target.value; this.renderKmer(); } });
        this.$('kmer-content').addEventListener('keydown', e => { if (e.target.id === 'km-own' && e.key === 'Enter') this.useOwnRead(); });

        this.$('pat').value = this.pat;
        const m = /^#(kmer|suffix|bwt|fm|map|quiz)$/.exec(location.hash);
        this.showTab(m ? m[1] : 'kmer');
    }

    showTab(tab) {
        this.tab = tab;
        document.querySelectorAll('.bl-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        for (const t of ['kmer', 'suffix', 'bwt', 'fm', 'map', 'quiz']) this.$('tab-' + t).hidden = t !== tab;
        document.querySelectorAll('.side-panel [data-for]').forEach(s => { s.hidden = !s.dataset.for.split(' ').includes(tab); });
        history.replaceState(null, '', '#' + tab);
        ({ kmer: () => this.renderKmer(), suffix: () => this.renderSuffix(), bwt: () => this.renderBwt(), fm: () => this.renderFm(), map: () => this.renderMap(), quiz: () => this.quiz.ensure() })[tab]();
    }
    toast(msg) { const el = document.createElement('div'); el.className = 'notification notification-info show'; el.textContent = msg; this.$('toast-stack').appendChild(el); setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3500); }
    lesson(h) { return `<div class="bl-lesson">${h}</div>`; }

    // ------------------------------------------------------------ text for tabs 2–4
    setText(t) {
        this.text = t; this.inv = 0; this.fmStep = 0;
        this.pat = t === 'BANANA$' ? 'ANA' : t === 'ACGACGTACG$' ? 'ACG' : t.slice(1, 3);
        this.$('pat').value = this.pat;
        this.showTab(this.tab);
    }
    useOwn() {
        const raw = this.$('txt-own').value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 14);
        if (raw.length < 2) { this.toast('Type at least two letters.'); return; }
        document.querySelector('input[name="txt"][value="custom"]').checked = true;
        this.setText(raw + '$');
    }
    setPattern(p) {
        const q = p.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8);
        if (!q) { this.toast('Type a pattern.'); return; }
        this.pat = q; this.fmStep = 0; this.$('pat').value = q;
        this.showTab(this.tab);
    }
    ds() {
        if (!this._ds || this._ds.text !== this.text) {
            const sa = this.E.suffixArray(this.text), L = this.E.bwt(this.text, sa);
            this._ds = { text: this.text, sa, L, fm: this.E.fmIndex(L), rots: this.E.rotations(this.text), tree: this.E.suffixTree(this.text) };
        }
        return this._ds;
    }
    textLine(highlight = []) {
        return `<div class="bw-text">${this.text.split('').map((c, i) => `<span class="bw-tc ${highlight.includes(i) ? 'bw-hl' : ''}"><small>${i}</small>${c}</span>`).join('')}</div>`;
    }

    // =====================================================================
    // TAB 1 – k-mer index
    // =====================================================================
    kmerGenome() {
        if (!this._kg || this._kg.seed !== this.km.seed) this._kg = Object.assign(this.E.buildGenome({ G: 90, repeatLength: 12, repeatCopies: 2, seed: 'km' + this.km.seed }), { seed: this.km.seed });
        return this._kg;
    }
    presetRead(kind) {
        const g = this.kmerGenome().seq, rng = new this.E.Rng('kmread-' + kind + this.km.seed);
        const uniqueStart = () => { for (let t = 0; t < 200; t++) { const s = rng.int(0, g.length - 18); if (!this._kg.repeats.some(r => s < r.end && s + 18 > r.start)) return s; } return 0; };
        if (kind === 'unique') return g.substr(uniqueStart(), 18);
        if (kind === 'mismatch') { const s = g.substr(uniqueStart(), 18).split(''); const p = rng.int(6, 11); s[p] = 'ACGT'.replace(s[p], '')[rng.int(0, 2)]; return s.join(''); }
        if (kind === 'repeat') { const r = this._kg.repeats[0]; return g.substr(r.start, 12); }
        return rng.seq(18);
    }
    useOwnRead() { const v = this.$('km-own').value.toUpperCase().replace(/[^ACGT]/g, ''); if (v.length < this.km.k) { this.toast(`The read must be at least k = ${this.km.k} long.`); return; } this.km.read = v; this.km.preset = 'own'; this.renderKmer(); }

    renderKmer() {
        const G = this.kmerGenome(), g = G.seq, k = this.km.k;
        if (!this.km.read || this.km.preset !== 'own') this.km.read = this.presetRead(this.km.preset);
        const read = this.km.read, idx = this.E.kmerIndex(g, k), res = this.E.kmerMap(g, idx, k, read, 2);
        const readKmers = new Set(res.seeds.map(s => s.kmer));
        const keys = [...idx.keys()].sort();
        const table = keys.map(w => `<span class="bl-chip ${readKmers.has(w) ? 'sel' : ''} ${idx.get(w).length > 1 ? 'bw-multi' : ''}" title="${w} at ${idx.get(w).map(p => p + 1).join(', ')}">${w}<small>${idx.get(w).map(p => p + 1).join(',')}</small></span>`).join('');
        const best = res.hits[0];
        const hitSet = new Set(); if (best) for (let i = 0; i < read.length; i++) hitSet.add(best.pos + i);
        const genomeLine = `<div class="bw-genome">${g.split('').map((c, i) => `<span class="${G.repeats.some(r => i >= r.start && i < r.end) ? 'bw-rep' : ''} ${hitSet.has(i) ? 'bw-hl' : ''}" title="${i + 1}">${c}</span>`).join('')}</div>`;
        const seeds = res.seeds.map(s => `<tr><td>${s.offset + 1}</td><td class="bl-mono">${s.kmer}</td><td>${s.hits.length ? s.hits.map(h => h + 1).join(', ') : '<span class="dp-red">none</span>'}</td><td>${s.hits.map(h => h - s.offset + 1).join(', ')}</td></tr>`).join('');
        const cands = res.candidates.slice(0, 6).map(c => `<tr class="${c.mismatches !== null && c.mismatches <= 2 ? 'sel' : ''}"><td>${c.pos + 1}</td><td>${c.votes}</td><td>${c.mismatches === null ? 'off the genome' : c.mismatches}</td></tr>`).join('');
        let aln = '';
        if (best) { const ref = g.substr(best.pos, read.length); aln = `<pre class="bl-aln">genome ${String(best.pos + 1).padStart(3)} ${ref}\n           ${ref.split('').map((c, i) => c === read[i] ? '|' : ' ').join('')}\nread     1 ${read}</pre>`; }
        const presets = [['unique', 'a read from unique sequence'], ['mismatch', 'the same with one error'], ['repeat', 'a read from the repeat'], ['random', 'a random read (not in the genome)']];
        this.$('kmer-content').innerHTML = `<h3 class="as-h">The simplest index: a table of k-mers</h3>
            <p>Go through the genome once and note, for every k-mer (word of length k), all positions where it occurs – a hash table from k-mer to positions. To find a read, look up its k-mers. Each hit is a <strong>seed</strong>: it says "the read may start at hit − offset". Positions supported by several seeds are then checked letter by letter (<strong>seed and extend</strong>, as in BLAST).</p>
            <p>Genome (${g.length} bp; the repeat is shaded):</p>${genomeLine}
            <div class="dp-answer-row"><label for="km-k">k =</label><input type="range" id="km-k" min="3" max="12" value="${k}" style="flex:1"><strong>${k}</strong></div>
            <h4>The index: ${keys.length} different ${k}-mers, ${g.length - k + 1} positions</h4>
            <div class="bl-chips small bw-chips">${table}</div>
            <p class="dp-hint">Small numbers = positions (1-based). Bold outline: k-mers occurring more than once. Highlighted: k-mers of the read.</p>
            <h4>Look up a read</h4>
            <div class="dp-options">${presets.map(([v, t]) => `<button data-kpreset="${v}" class="${this.km.preset === v ? 'correct' : ''}">${t}</button>`).join('')}</div>
            <div class="dp-answer-row" style="margin-top:6px"><input type="text" id="km-own" class="hm-textin" placeholder="or type a read" spellcheck="false" value="${this.km.preset === 'own' ? read : ''}"><button data-kown="1">Use</button></div>
            <p>Read: <code class="bw-code">${read}</code> (${read.length} bp, ${res.lookups} k-mers to look up)</p>
            <div class="bl-two"><div><table class="bl-table"><tr><th>offset</th><th>k-mer</th><th>found at</th><th>→ read starts at</th></tr>${seeds}</table></div>
            <div><table class="bl-table"><tr><th>candidate start</th><th>seeds</th><th>mismatches</th></tr>${cands || '<tr><td colspan="3">no seed hit anywhere</td></tr>'}</table>${aln}
            <p>${!res.candidates.length ? '<strong>Not found</strong> – no k-mer of the read occurs in the genome.' : res.hits.length > 1 ? `<strong>${res.hits.length} places fit</strong> – the read comes from a repeat and cannot be placed uniquely.` : res.hits.length ? `Placed at position ${best.pos + 1} with ${best.mismatches} mismatch${best.mismatches === 1 ? '' : 'es'}.` : 'Seeds were found, but no candidate fits with at most 2 mismatches.'}</p></div></div>
            ${this.lesson(`<strong>What to try.</strong> The read with one error: the k-mers covering the error find nothing, the others still vote for the right place. That is the <em>pigeonhole principle</em>: a read of length L with m errors contains at least one error-free piece of length ⌊L/(m+1)⌋ – so k must be at most that. Small k: many chance hits (try k = 3). Large k: an error destroys most seeds (try k = 12). <strong>The cost:</strong> the table stores every position of the genome – for the human genome 3 × 10<sup>9</sup> positions plus the k-mers themselves, tens of gigabytes. The following tabs build an index that answers "where does this string occur?" in a few gigabytes, for any length.`)}`;
    }

    // =====================================================================
    // TAB 2 – suffix trie, suffix tree, suffix array
    // =====================================================================
    renderSuffix() {
        const D = this.ds(), t = this.text, p = this.pat, n = t.length;
        const trie = D.tree.trie, ts = this.E.trieSearch(trie, p);
        const on = new Set(ts.path.slice(1));
        const ss = this.E.saSearch(t, D.sa, p);
        const suffixes = Array.from({ length: n }, (_, i) => `<tr class="${ts.leaves.includes(i) ? 'sel' : ''}"><td>${i}</td><td class="bl-mono">${t.slice(i)}</td></tr>`).join('');
        const saRows = D.sa.map((s, r) => `<tr class="${r >= ss.first && r < ss.end ? 'sel' : ''}"><td>${r}</td><td>${s}</td><td class="bl-mono">${t.slice(s)}</td></tr>`).join('');
        const trace = ss.trace.map(x => `<tr><td>${x.phase === 'first' ? 'first match' : 'end of matches'}</td><td>[${x.lo}, ${x.hi})</td><td>${x.mid}</td><td class="bl-mono">${x.prefix}</td><td>${x.cmp < 0 ? 'smaller → go right' : x.cmp > 0 ? 'larger → go left' : x.phase === 'first' ? 'equal → go left' : 'equal → go right'}</td></tr>`).join('');
        // tree leaves under the matched node
        const treeOn = new Set();
        const markTree = (node, rest) => { for (const c of node.children) { const l = c.label; const k = Math.min(l.length, rest.length); if (l.slice(0, k) === rest.slice(0, k)) { treeOn.add(c); if (rest.length > l.length) markTree(c, rest.slice(l.length)); return; } } };
        if (ts.found) markTree(D.tree.root, p);
        this.$('suffix-content').innerHTML = `<h3 class="as-h">Every occurrence of a pattern is the beginning of a suffix</h3>
            <p>Text <strong>${t}</strong>, pattern <strong>${p}</strong> (change both in the side panel). A <strong>suffix</strong> is the text from some position to the end. The pattern occurs at position i exactly when the suffix starting at i begins with the pattern – so an index of all suffixes answers every query.</p>
            ${this.textLine(ts.leaves)}
            <div class="bl-two"><div><h4>The ${n} suffixes</h4><table class="bl-table bw-small"><tr><th>start</th><th>suffix</th></tr>${suffixes}</table></div>
            <div><h4>Suffix trie</h4><p class="dp-hint">All suffixes in one tree of letters: each path from the root spells the beginning of suffixes; boxes = where a suffix ends (its start position). ${trie.nodes} nodes.</p></div></div>
            <div class="bw-tree-wrap">${this.V.tree(trie.root, { on, hitLeaves: new Set(ts.leaves) })}</div>
            <p>${ts.found ? `Searching <strong>${p}</strong> = walking ${p.length} steps down from the root (red). Every box below the end point is an occurrence: <strong>${ts.leaves.join(', ')}</strong> (green). The time depends on the length of the pattern, not of the genome.` : `After ${ts.matched} letter${ts.matched === 1 ? '' : 's'} the trie has no way on: <strong>${p}</strong> does not occur.`}</p>
            <h4>Suffix tree: the trie with its single-child chains collapsed</h4>
            <div class="bw-tree-wrap">${this.V.tree(D.tree.root, { on: treeOn, hitLeaves: new Set(ts.leaves), leafW: 64, levelH: 60 })}</div>
            <p>The trie of a text of length n can have about n²/2 nodes; the suffix tree has at most 2n (here ${D.tree.nodes} instead of ${trie.nodes}), because every chain without branches becomes one edge labelled with a substring (stored as two numbers: start and end in the text). It can be built in linear time (Ukkonen, 1995) and was the first index of this kind in bioinformatics (MUMmer).</p>
            <h4>Suffix array: just the order of the leaves</h4>
            <div class="bl-two"><div><table class="bl-table bw-small"><tr><th>row</th><th>SA</th><th>suffix (sorted)</th></tr>${saRows}</table></div>
            <div><p>Sort the suffixes alphabetically ($ first) and keep only their start positions: <strong>SA = [${D.sa.join(', ')}]</strong>. Suffixes beginning with the same pattern are now <em>next to each other</em>, so the occurrences form one block of rows, found by binary search:</p>
            <table class="bl-table bw-small"><tr><th>looking for</th><th>range</th><th>row</th><th>suffix begins</th><th></th></tr>${trace}</table>
            <p>Rows ${ss.first}–${ss.end - 1}: <strong>${ss.count}</strong> occurrence${ss.count === 1 ? '' : 's'} at ${ss.positions.join(', ') || '–'} after ${ss.trace.length} comparisons – about 2·log<sub>2</sub>(n) for any text length.</p></div></div>
            ${this.lesson(`<strong>Memory decides.</strong> For the human genome (n = 3 × 10<sup>9</sup>) a suffix tree needs roughly 20 bytes per base – 60 GB; a suffix array 4 bytes per base (one number per suffix) – 12 GB, plus the genome. Still too much for the computers of 2008, when short-read mappers appeared. The BWT (tab 3) stores the same information in about the size of the genome itself.`)}`;
    }

    // =====================================================================
    // TAB 3 – BWT
    // =====================================================================
    renderBwt() {
        const D = this.ds(), t = this.text, n = t.length, fm = D.fm;
        const inv = this.E.inverse(fm), shown = Math.min(this.inv, inv.steps.length);
        const recon = inv.text.slice(n - 1 - shown);
        const cur = shown < inv.steps.length ? inv.steps[shown] : null;
        const visited = new Set([0, ...inv.steps.slice(0, shown).map(s => s.next)]);
        const runs = D.L.replace(/(.)\1+/g, m => `<span class="bw-run">${m}</span>`);
        const stepsTable = inv.steps.slice(0, shown).map((s, k) => `<tr><td>${k + 1}</td><td>${s.row}</td><td>${s.c}</td><td>C[${s.c}] + Occ(${s.c}, ${s.row}) = ${fm.C[s.c]} + ${s.rankBefore} = <strong>${s.next}</strong></td></tr>`).join('');
        this.$('bwt-content').innerHTML = `<h3 class="as-h">The Burrows–Wheeler transform</h3>
            <p>Write the text ${t} in all ${n} rotations (move the first letter to the end, again and again), sort them alphabetically, and read the <strong>last column L</strong>. The first column F is simply all letters in sorted order.</p>
            <div class="bl-two"><div>${this.V.matrix(D.rots, { mark: visited, row: cur ? cur.row : null })}</div>
            <div><p><strong>BWT(${t}) = ${D.L}</strong></p>
            <p><strong>Why it is the same as the suffix array:</strong> sorting rotations of a text ending with a unique $ sorts its suffixes (everything after the $ does not matter). Row r starts with suffix SA[r], and its last letter L[r] is the letter just <em>before</em> that suffix in the text: L[r] = text[SA[r] − 1].</p>
            <p><strong>Why it compresses:</strong> rows that begin alike are often preceded by the same letter (in a genome: all copies of a repeat), so L contains runs of equal letters: ${runs}. Run-length and other compressors store such a string in a fraction of its size – the original purpose of the BWT (bzip2).</p></div></div>
            <h4>…and it can be undone: LF-mapping</h4>
            <p>Is information lost? No. The <strong>i-th occurrence of a letter in L and the i-th occurrence of the same letter in F are the same character of the text</strong> (the rows are sorted by what follows it in both cases). So from row r we can jump to the row that starts with L[r] – one position back in the text:</p>
            <p class="hm-formula">LF(r) = C[c] + Occ(c, r), &nbsp; c = L[r] &nbsp;&nbsp; (C[c]: letters smaller than c; Occ(c, r): c's in L above row r)</p>
            <p>Start at row 0 (the rotation beginning with $): its L is the last letter of the text. Step with LF and read the text backwards:</p>
            <div class="dp-buttons input-controls"><button data-inv="1" class="primary">Next step</button><button data-inv="all">All steps</button><button data-inv="0">Reset</button></div>
            <p>Reconstructed so far: <strong class="bw-code">${recon}</strong>${shown === inv.steps.length ? ' ✔ the whole text' : ''}${cur ? ` – next: row ${cur.row}, L = ${cur.c}` : ''}</p>
            ${shown ? `<table class="bl-table hm-narrow"><tr><th>step</th><th>row</th><th>letter L[row]</th><th>next row</th></tr>${stepsTable}</table>` : ''}
            ${this.lesson(`<strong>What the BWT gives a read mapper:</strong> a string of the same length as the genome (2 bits per base) from which the genome can be restored, and – with two small tables C and Occ – the rows of the sorted-rotation matrix that begin with any pattern. That is the suffix-array search of tab 2 without storing the suffix array. Tab 4.`)}`;
    }

    // =====================================================================
    // TAB 4 – FM-index backward search
    // =====================================================================
    renderFm() {
        const D = this.ds(), fm = D.fm, p = this.pat;
        const bs = this.E.backwardSearch(fm, p), shown = Math.min(this.fmStep, bs.steps.length);
        const done = bs.steps.slice(0, shown);
        const last = done[done.length - 1];
        const interval = shown === 0 ? [0, fm.n] : [last.nsp, last.nep];
        const suffixLen = shown;
        const Ctable = `<table class="bl-table bw-small"><tr><th>c</th>${fm.alphabet.map(c => `<th>${c}</th>`).join('')}</tr><tr><td>C[c]</td>${fm.alphabet.map(c => `<td>${fm.C[c]}</td>`).join('')}</tr></table>`;
        const stepRows = done.map((s, k) => s.missing ? `<tr><td>${k + 1}</td><td>${s.c}</td><td colspan="3">${s.c} does not occur in the text – no match</td></tr>`
            : `<tr><td>${k + 1}</td><td><strong>${s.c}</strong> → <span class="bl-mono">${p.slice(s.k)}</span></td><td>[${s.sp}, ${s.ep})</td><td>top = C[${s.c}] + Occ(${s.c}, ${s.sp}) = ${s.C} + ${s.rsp} = <strong>${s.nsp}</strong><br>bottom = C[${s.c}] + Occ(${s.c}, ${s.ep}) = ${s.C} + ${s.rep} = <strong>${s.nep}</strong></td><td>${s.nep - s.nsp}</td></tr>`).join('');
        const finished = shown === bs.steps.length;
        const occHl = done.length ? [done[done.length - 1].sp, done[done.length - 1].ep] : [];
        this.$('fm-content').innerHTML = `<h3 class="as-h">Backward search: counting occurrences without the text</h3>
            <p>Find <strong>${p}</strong> in ${this.text} using only L = <strong>${fm.L}</strong>, the table C and the rank function Occ. The search runs <strong>from the last letter of the pattern to the first</strong>. It keeps the block of rows [top, bottom) whose rotations begin with the part of the pattern matched so far; each new letter c in front narrows the block with the LF rule of tab 3:</p>
            <p class="hm-formula">top ← C[c] + Occ(c, top) &nbsp;&nbsp;&nbsp; bottom ← C[c] + Occ(c, bottom)</p>
            <div class="dp-buttons input-controls"><button data-fm="1" class="primary">Next letter</button><button data-fm="all">Whole pattern</button><button data-fm="0">Reset</button></div>
            <div class="bl-two"><div>${this.V.matrix(D.rots, { interval, prefixLen: suffixLen })}<p class="dp-hint">Highlighted: rows in [top, bottom); coloured letters: the matched part of the pattern. The algorithm never looks at the middle of the matrix – only L (and C, Occ).</p></div>
            <div><h4>Step by step</h4>
            ${shown ? `<table class="bl-table bw-small"><tr><th>#</th><th>letter → matched</th><th>before</th><th>new interval</th><th>rows</th></tr>${stepRows}</table>` : `<p>Start: the whole matrix, rows [0, ${fm.n}) – the empty string matches everywhere.</p>`}
            ${finished ? `<p><strong>${bs.count ? `${bs.count} occurrence${bs.count > 1 ? 's' : ''}` : 'No occurrence'}</strong>${bs.count ? ` – rows ${bs.sp}…${bs.ep - 1}. Their SA values give the positions: <strong>${D.sa.slice(bs.sp, bs.ep).sort((a, b) => a - b).join(', ')}</strong>.` : '.'} The number of steps equals the length of the pattern, whatever the length of the genome.</p>` : ''}
            <h4>C table</h4>${Ctable}
            <details class="hm-details"><summary>Occ table (rank of every letter at every row)</summary>${this.V.occTable(fm, occHl)}</details></div></div>
            ${this.lesson(`<strong>Why the index is small.</strong> A real FM-index does not store the full Occ table or suffix array: it stores L packed in 2 bits per base, Occ only at every 64th or 128th row (checkpoints – the rest is counted from L on the fly), and SA only for every 32nd row (the others are reached by a few LF steps until a sampled row). For the human genome this is about 3–4 GB – which is why BWA and Bowtie, built on this index (2009), could map short reads on an ordinary computer. <strong>Try:</strong> a pattern that is not in the text – the interval becomes empty and the search stops early.`)}`;
    }

    // =====================================================================
    // TAB 5 – mapping reads
    // =====================================================================
    mapping() {
        if (!this.mapData) {
            const genome = this.E.buildGenome({ G: 300, repeatLength: this.mp.rep, repeatCopies: this.mp.rep ? 2 : 0, seed: 'map' + this.mp.seed });
            const text = genome.seq + '$', sa = this.E.suffixArray(text), fm = this.E.fmIndex(this.E.bwt(text, sa));
            const reads = this.E.simulateReads(genome, { n: 40, L: 20, errorRate: this.mp.err / 100, seed: 'map' + this.mp.seed + '-' + this.mp.err });
            this.mapData = { genome, sa, fm, reads, cache: {} };
        }
        const D = this.mapData;
        if (!D.cache[this.mp.mm]) D.cache[this.mp.mm] = D.reads.map(r => this.E.mapRead(D.fm, D.sa, r, this.mp.mm));
        return D;
    }

    renderMap() {
        const D = this.mapping(), res = D.cache[this.mp.mm], g = D.genome.seq;
        const cnt = k => res.filter(k).length;
        const stats = { unique: cnt(r => r.status === 'unique' && r.correct), wrong: cnt(r => r.status === 'unique' && !r.correct), multi: cnt(r => r.status === 'multi'), un: cnt(r => r.status === 'unmapped') };
        const cost = [0, 1, 2, 3].map(z => { if (!D.cache[z]) D.cache[z] = D.reads.map(r => this.E.mapRead(D.fm, D.sa, r, z)); return D.cache[z].reduce((a, r) => a + r.steps, 0); });
        const statusLabel = r => r.status === 'unmapped' ? '<span class="dp-red">unmapped</span>' : r.status === 'multi' ? `<span class="olc-rep">${r.top.length} equally good places</span>` : r.correct ? '<span class="dp-green">unique, correct</span>' : '<span class="dp-red">unique, WRONG place</span>';
        const rows = D.reads.map((r, i) => {
            const m = res[i];
            return `<tr class="${this.mp.sel === i ? 'sel' : ''} bw-click" data-read="${i}"><td>${r.name}</td><td class="bl-mono">${r.seq}</td><td>${r.errors.length}</td><td>${r.start + 1} (${r.strand > 0 ? '+' : '−'})</td><td>${statusLabel(m)}</td><td>${m.top.map(h => `${h.pos + 1}${h.strand > 0 ? '+' : '−'} (${h.mismatches} mm)`).join(', ')}</td><td>${m.steps}</td></tr>`;
        }).join('');
        let detail = '';
        if (this.mp.sel !== null) {
            const r = D.reads[this.mp.sel], m = res[this.mp.sel];
            detail = m.top.map(h => { const q = h.strand > 0 ? r.seq : this.E.revcomp(r.seq), ref = g.substr(h.pos, q.length); return `<pre class="bl-aln">genome ${String(h.pos + 1).padStart(3)} ${ref}\n           ${ref.split('').map((c, k) => c === q[k] ? '|' : ' ').join('')}\n${(r.name + (h.strand > 0 ? '' : ' (rc)')).padEnd(10)} ${q}</pre>`; }).join('') || '<p class="dp-hint">No hit within the allowed mismatches.</p>';
        }
        const genomeLine = `<div class="bw-genome">${g.split('').map((c, i) => `<span class="${D.genome.repeats.some(rp => i >= rp.start && i < rp.end) ? 'bw-rep' : ''}">${c}</span>`).join('')}</div>`;
        this.$('map-content').innerHTML = `<h3 class="as-h">Mapping reads with the FM-index</h3>
            <p>A ${g.length} bp genome${D.genome.repeats.length ? ` with two copies of a ${this.mp.rep} bp repeat (shaded)` : ''} is indexed (tabs 3–4). Each of 40 reads (20 bp, both strands, ${this.mp.err} % errors) is searched by backward search – together with its reverse complement, because we do not know which strand it came from.</p>
            ${genomeLine}
            <p><strong>Mismatches:</strong> backward search as in tab 4 finds only exact matches. To allow up to z mismatches, the search <em>backtracks</em>: at every step it also tries the three other letters, spending one mismatch each, as long as the interval stays non-empty (the approach of the first BWA and Bowtie). Allowed now: <strong>${this.mp.mm}</strong> (side panel).</p>
            <div class="as-tiles"><div class="as-tile good"><div class="as-num">${stats.unique}</div><div class="as-cap">unique, correct</div></div><div class="as-tile"><div class="as-num">${stats.multi}</div><div class="as-cap">several equally good places</div></div><div class="as-tile ${stats.un ? 'bad' : ''}"><div class="as-num">${stats.un}</div><div class="as-cap">unmapped</div></div><div class="as-tile ${stats.wrong ? 'bad' : ''}"><div class="as-num">${stats.wrong}</div><div class="as-cap">unique but wrong</div></div></div>
            <table class="bl-table hm-narrow"><tr><th>mismatches allowed</th>${[0, 1, 2, 3].map(z => `<th>${z}</th>`).join('')}</tr><tr><td>search steps for all reads</td>${cost.map((c, z) => `<td class="${z === this.mp.mm ? 'dp-green' : ''}">${c.toLocaleString()}</td>`).join('')}</tr></table>
            <p class="dp-hint">Each allowed mismatch multiplies the work – three alternative letters at every position. That is why exhaustive backtracking is limited to 1–3 mismatches and why modern mappers find short exact seeds first (next app).</p>
            <table class="bl-table bw-small"><tr><th>read</th><th>sequence</th><th>errors</th><th>true origin</th><th>result</th><th>best hit(s)</th><th>steps</th></tr>${rows}</table>
            ${detail ? `<h4>${D.reads[this.mp.sel].name}</h4>${detail}` : '<p class="dp-hint">Click a read for its alignment.</p>'}
            ${this.lesson(`<strong>Three lessons.</strong> (1) With 0 mismatches allowed every read with a sequencing error is lost – real reads need tolerance. (2) Reads from inside a repeat match several places equally well: the mapper can only report one at random (or all), and must say that the placement is uncertain – the <em>mapping quality</em> (MAPQ 0). (3) More allowed mismatches find more reads but cost much more time. The next app continues here: minimizers, seed chaining and MAPQ.`)}`;
    }

    // ------------------------------------------------------------ events
    onClick(e, tab) {
        const t = e.target;
        if (tab === 'kmer') {
            const p = t.closest('[data-kpreset]'); if (p) { this.km.preset = p.dataset.kpreset; this.km.read = null; this.renderKmer(); return; }
            if (t.closest('[data-kown]')) this.useOwnRead();
        } else if (tab === 'bwt') {
            const b = t.closest('[data-inv]'); if (!b) return;
            const n = this.ds().text.length - 1;
            this.inv = b.dataset.inv === 'all' ? n : b.dataset.inv === '0' ? 0 : Math.min(n, this.inv + 1);
            this.renderBwt();
        } else if (tab === 'fm') {
            const b = t.closest('[data-fm]'); if (!b) return;
            this.fmStep = b.dataset.fm === 'all' ? this.pat.length : b.dataset.fm === '0' ? 0 : Math.min(this.pat.length, this.fmStep + 1);
            this.renderFm();
        } else if (tab === 'map') {
            const r = t.closest('[data-read]'); if (r) { this.mp.sel = +r.dataset.read; this.renderMap(); }
        }
    }
}

(function () {
    const start = () => { window.bwtApp = new BwtApp(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
