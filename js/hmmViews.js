/**
 * HMM EXPLORER – VIEWS
 * ====================
 * SVG diagrams (two-state HMM, pair HMM, Plan7 profile HMM), plots and
 * small HTML helpers shared by the three parts of hmm.html. Pure string
 * builders: no event handling here.
 */
const HmmViews = (() => {
    const LN10 = Math.log(10);
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const f2 = (x, d = 2) => (x === -Infinity ? '−∞' : x.toFixed(d).replace('-', '−'));
    const log10 = lnp => lnp / LN10;
    const fmtLog10 = (lnp, d = 2) => f2(log10(lnp), d);
    const fmtP = p => p >= 0.01 || p === 0 ? p.toFixed(p >= 0.1 || p === 0 ? 2 : 3) : p.toExponential(1);
    const lesson = html => `<div class="bl-lesson">${html}</div>`;
    const STATE_COLORS = { M: '#2563eb', I: '#d97706', D: '#64748b', N: '#a0aec0', C: '#a0aec0', B: '#1f1e1b', E: '#1f1e1b', X: '#d97706', Y: '#7c3aed' };

    const marker = (id, color) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>`;

    // ------------------------------------------------------------ part 1: two-state HMM
    function basicDiagram(model, opts = {}) {
        const o = Object.assign({ active: null, lastSymbol: null }, opts);
        const W = 470, H = 262, cy = 96, r = 38, xs = [140, 330];
        const A = model.alphabet.split('');
        let s = `<svg class="hm-diagram" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs>${marker('hm-arr', '#4d4a44')}</defs>`;
        const lbl = (x, y, t, anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="hm-dlabel">${t}</text>`;
        // transitions between the two states
        s += `<path d="M${xs[0] + r - 4},${cy - 16} Q${(xs[0] + xs[1]) / 2},${cy - 58} ${xs[1] - r + 4},${cy - 16}" class="hm-edge" marker-end="url(#hm-arr)" style="stroke-width:${0.8 + 5 * model.trans[0][1]}"/>`;
        s += lbl((xs[0] + xs[1]) / 2, cy - 44, model.trans[0][1].toFixed(2));
        s += `<path d="M${xs[1] - r + 4},${cy + 16} Q${(xs[0] + xs[1]) / 2},${cy + 58} ${xs[0] + r - 4},${cy + 16}" class="hm-edge" marker-end="url(#hm-arr)" style="stroke-width:${0.8 + 5 * model.trans[1][0]}"/>`;
        s += lbl((xs[0] + xs[1]) / 2, cy + 56, model.trans[1][0].toFixed(2));
        model.states.forEach((st, k) => {
            const x = xs[k];
            // self loop
            s += `<path d="M${x - 16},${cy - r + 4} C${x - 50},${cy - r - 52} ${x + 50},${cy - r - 52} ${x + 16},${cy - r + 4}" class="hm-edge" marker-end="url(#hm-arr)" style="stroke-width:${0.8 + 5 * model.trans[k][k]}"/>`;
            s += lbl(x, cy - r - 34, model.trans[k][k].toFixed(2));
            const act = o.active === k;
            s += `<circle cx="${x}" cy="${cy}" r="${r}" fill="${act ? st.color : '#fff'}" stroke="${st.color}" stroke-width="${act ? 4 : 2.5}"/>`;
            s += `<text x="${x}" y="${cy + 5}" text-anchor="middle" class="hm-dstate" fill="${act ? '#fff' : st.color}">${esc(st.name)}</text>`;
            s += lbl(x, cy + r + 16, `start ${model.start[k].toFixed(2)}`);
            // emission bars
            const bw = Math.min(22, 150 / A.length), x0 = x - (A.length * bw) / 2, base = H - 20, hmax = 52;
            A.forEach((a, j) => {
                const p = st.emit[a], h = p * hmax / Math.max(...A.map(b => Math.max(...model.states.map(q => q.emit[b])))) ;
                const hot = act && o.lastSymbol === a;
                s += `<rect x="${x0 + j * bw + 2}" y="${base - h}" width="${bw - 4}" height="${h}" fill="${st.color}" opacity="${hot ? 1 : 0.55}"${hot ? ' stroke="#1f1e1b" stroke-width="2"' : ''}/>`;
                s += `<text x="${x0 + j * bw + bw / 2}" y="${base + 13}" text-anchor="middle" class="hm-dsym">${a}</text>`;
                s += `<text x="${x0 + j * bw + bw / 2}" y="${base - h - 3}" text-anchor="middle" class="hm-dtiny">${p.toFixed(2).replace(/^0/, '')}</text>`;
            });
        });
        s += '</svg>';
        return s;
    }

    // letters coloured by a state path; path may be null (hidden)
    function seqStrip(seq, path, model, opts = {}) {
        const o = Object.assign({ label: '', cls: '', marks: null, clickable: false }, opts);
        let h = `<div class="hm-strip ${o.cls}">${o.label ? `<span class="hm-strip-label">${o.label}</span>` : ''}<span class="hm-strip-seq">`;
        for (let i = 0; i < seq.length; i++) {
            const st = path && path[i] !== undefined && path[i] !== null ? model.states[path[i]] : null;
            const style = st ? ` style="background:${st.color};color:#fff"` : '';
            const mark = o.marks && o.marks[i] ? ' hm-mark' : '';
            h += `<span class="hm-res${o.clickable ? ' hm-click' : ''}${mark}" data-i="${i}"${style} title="position ${i + 1}${st ? ': ' + st.name : ''}">${seq[i]}</span>`;
        }
        return h + '</span></div>';
    }

    function pathStrip(path, model, label) {
        let h = `<div class="hm-strip hm-pathrow"><span class="hm-strip-label">${label}</span><span class="hm-strip-seq">`;
        for (let i = 0; i < path.length; i++) { const st = model.states[path[i]]; h += `<span class="hm-res hm-bar" style="background:${st.color}" title="${i + 1}: ${st.name}"></span>`; }
        return h + '</span></div>';
    }

    // posterior probability of state `k` along the sequence, with state bands underneath
    function posteriorPlot(post, k, model, bands) {
        const L = post[k].length, cw = Math.max(6, Math.min(14, 760 / L)), W = 44 + L * cw + 10, H = 150;
        const y = p => 10 + (1 - p) * (H - 30);
        let s = `<svg class="hm-plot" viewBox="0 0 ${W} ${H + bands.length * 14 + 8}" width="${W}" height="${H + bands.length * 14 + 8}" xmlns="http://www.w3.org/2000/svg">`;
        for (const p of [0, 0.5, 1]) s += `<line x1="44" x2="${W - 10}" y1="${y(p)}" y2="${y(p)}" stroke="#e2e8f0"/><text x="38" y="${y(p) + 4}" text-anchor="end" class="hm-dtiny">${p}</text>`;
        let d = `M44,${y(0)}`;
        for (let i = 0; i < L; i++) d += ` L${44 + i * cw},${y(post[k][i]).toFixed(1)} L${44 + (i + 1) * cw},${y(post[k][i]).toFixed(1)}`;
        d += ` L${44 + L * cw},${y(0)} Z`;
        s += `<path d="${d}" fill="${model.states[k].color}" opacity="0.35" stroke="${model.states[k].color}" stroke-width="1.5"/>`;
        s += `<text x="4" y="${y(0.5) - 4}" class="hm-dtiny" transform="rotate(-90 12 ${y(0.5)})" text-anchor="middle">P(${esc(model.states[k].name)})</text>`;
        bands.forEach((b, r) => {
            const yy = H + r * 14;
            s += `<text x="40" y="${yy + 10}" text-anchor="end" class="hm-dtiny">${b.label}</text>`;
            b.path.forEach((st, i) => { s += `<rect x="${44 + i * cw}" y="${yy}" width="${cw}" height="11" fill="${model.states[st].color}"/>`; });
        });
        return s + '</svg>';
    }

    function linePlot(values, opts = {}) {
        const o = Object.assign({ width: 420, height: 150, xlabel: '', ylabel: '', color: '#7a3e1d', hline: null }, opts);
        const W = o.width, H = o.height, n = values.length;
        const lo = Math.min(...values, o.hline === null ? Infinity : o.hline), hi = Math.max(...values, o.hline === null ? -Infinity : o.hline);
        const X = i => 50 + (n > 1 ? i / (n - 1) : 0) * (W - 60), Y = v => 10 + (hi === lo ? 0.5 : (hi - v) / (hi - lo)) * (H - 40);
        let s = `<svg class="hm-plot" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
        s += `<line x1="50" x2="${W - 10}" y1="${H - 30}" y2="${H - 30}" stroke="#a0aec0"/><line x1="50" x2="50" y1="10" y2="${H - 30}" stroke="#a0aec0"/>`;
        s += `<text x="46" y="${Y(hi) + 4}" text-anchor="end" class="hm-dtiny">${hi.toFixed(1)}</text><text x="46" y="${Y(lo) + 4}" text-anchor="end" class="hm-dtiny">${lo.toFixed(1)}</text>`;
        if (o.hline !== null) s += `<line x1="50" x2="${W - 10}" y1="${Y(o.hline)}" y2="${Y(o.hline)}" stroke="#16a34a" stroke-dasharray="4 3"/><text x="${W - 12}" y="${Y(o.hline) - 4}" text-anchor="end" class="hm-dtiny" fill="#16a34a">${o.hlineLabel || ''}</text>`;
        s += `<polyline fill="none" stroke="${o.color}" stroke-width="2" points="${values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}"/>`;
        values.forEach((v, i) => { s += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.5" fill="${o.color}"/>`; });
        s += `<text x="${(W + 40) / 2}" y="${H - 8}" text-anchor="middle" class="hm-dtiny">${o.xlabel}</text>`;
        s += `<text x="12" y="${H / 2}" text-anchor="middle" class="hm-dtiny" transform="rotate(-90 12 ${H / 2})">${o.ylabel}</text>`;
        return s + '</svg>';
    }

    // histogram of scores with vertical marks and an optional exponential tail n·ln2·2^−(x−τ)·binwidth
    function histogram(scores, opts = {}) {
        const o = Object.assign({ width: 560, height: 190, marks: [], tau: null, xlabel: 'score (bits)', bins: 30 }, opts);
        const W = o.width, H = o.height;
        const all = scores.concat(o.marks.map(m => m.x));
        const lo = Math.floor(Math.min(...all) - 1), hi = Math.ceil(Math.max(...all) + 1);
        const bw = (hi - lo) / o.bins, counts = new Array(o.bins).fill(0);
        for (const x of scores) counts[Math.min(o.bins - 1, Math.max(0, Math.floor((x - lo) / bw)))]++;
        const cmax = Math.max(...counts, 1);
        const X = v => 40 + (v - lo) / (hi - lo) * (W - 50), Y = c => H - 30 - c / cmax * (H - 50);
        let s = `<svg class="hm-plot" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
        s += `<line x1="40" x2="${W - 10}" y1="${H - 30}" y2="${H - 30}" stroke="#a0aec0"/>`;
        counts.forEach((c, b) => { if (c) s += `<rect x="${X(lo + b * bw) + 0.5}" y="${Y(c)}" width="${Math.max(1, X(lo + (b + 1) * bw) - X(lo + b * bw) - 1)}" height="${H - 30 - Y(c)}" fill="#cbd5e0"/>`; });
        if (o.tau !== null) {
            let d = '';
            for (let v = o.tailFrom !== undefined ? o.tailFrom : o.tau + 1; v <= hi; v += (hi - lo) / 200) {
                const c = scores.length * bw * Math.LN2 * Math.pow(2, -(v - o.tau));
                if (c > cmax * 1.05) continue;
                d += `${d ? ' L' : 'M'}${X(v).toFixed(1)},${Y(c).toFixed(1)}`;
            }
            if (d) s += `<path d="${d}" fill="none" stroke="#7a3e1d" stroke-width="1.5" stroke-dasharray="5 3"/>`;
        }
        for (let t = Math.ceil(lo / 10) * 10; t <= hi; t += 10) s += `<line x1="${X(t)}" x2="${X(t)}" y1="${H - 30}" y2="${H - 26}" stroke="#a0aec0"/><text x="${X(t)}" y="${H - 15}" text-anchor="middle" class="hm-dtiny">${t}</text>`;
        o.marks.forEach((m, r) => {
            s += `<line x1="${X(m.x)}" x2="${X(m.x)}" y1="16" y2="${H - 30}" stroke="${m.color}" stroke-width="2"/>`;
            s += `<text x="${X(m.x) + (X(m.x) > W - 120 ? -4 : 4)}" y="${24 + r * 12}" text-anchor="${X(m.x) > W - 120 ? 'end' : 'start'}" class="hm-dtiny" fill="${m.color}">${esc(m.label)}</text>`;
        });
        s += `<text x="${(W + 30) / 2}" y="${H - 2}" text-anchor="middle" class="hm-dtiny">${o.xlabel}</text>`;
        return s + '</svg>';
    }

    // ------------------------------------------------------------ part 2: pair HMM
    function pairDiagram(M, opts = {}) {
        const o = Object.assign({ active: null }, opts);
        const W = 540, H = 250;
        const P = { B: [46, 125], M: [200, 125], X: [340, 48], Y: [340, 202], E: [490, 125] };
        let s = `<svg class="hm-diagram" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs>${marker('hm-parr', '#4d4a44')}</defs>`;
        const edge = (d, p, label, lx, ly) => `<path d="${d}" class="hm-edge" marker-end="url(#hm-parr)" style="stroke-width:${0.8 + 4 * p}"/><text x="${lx}" y="${ly}" text-anchor="middle" class="hm-dlabel">${label}</text>`;
        const t = M.t;
        s += edge(`M${P.B[0] + 20},125 L${P.M[0] - 32},125`, t.MM, '', 0, 0);
        s += edge(`M${P.M[0] - 14},${125 - 30} C${P.M[0] - 50},40 ${P.M[0] + 50},40 ${P.M[0] + 14},${125 - 30}`, t.MM, `1−2δ−τ = ${t.MM.toFixed(2)}`, P.M[0], 44);
        s += edge(`M${P.M[0] + 20},${125 - 32} L${P.X[0] - 30},${P.X[1] - 2}`, t.MX, `δ = ${M.delta.toFixed(2)}`, 246, 62);
        s += edge(`M${P.X[0] - 22},${P.X[1] + 22} L${P.M[0] + 34},${125 - 8}`, t.XM, `1−ε−τ = ${t.XM.toFixed(2)}`, 300, 112);
        s += edge(`M${P.M[0] + 20},${125 + 32} L${P.Y[0] - 30},${P.Y[1] + 2}`, t.MX, `δ`, 250, 196);
        s += edge(`M${P.Y[0] - 22},${P.Y[1] - 22} L${P.M[0] + 34},${125 + 8}`, t.XM, `1−ε−τ`, 296, 150);
        s += edge(`M${P.X[0] + 20},${P.X[1] - 20} C${P.X[0] + 60},${P.X[1] - 60} ${P.X[0] + 70},${P.X[1] + 10} ${P.X[0] + 28},${P.X[1] + 4}`, t.XX, `ε = ${M.epsilon.toFixed(2)}`, P.X[0] + 78, P.X[1] - 20);
        s += edge(`M${P.Y[0] + 20},${P.Y[1] + 20} C${P.Y[0] + 60},${P.Y[1] + 60} ${P.Y[0] + 70},${P.Y[1] - 10} ${P.Y[0] + 28},${P.Y[1] - 4}`, t.XX, `ε`, P.Y[0] + 76, P.Y[1] + 30);
        s += edge(`M${P.M[0] + 32},125 L${P.E[0] - 22},125`, M.tau, `τ = ${M.tau.toFixed(3)}`, 420, 118);
        s += edge(`M${P.X[0] + 30},${P.X[1] + 10} L${P.E[0] - 16},${125 - 14}`, M.tau, 'τ', 440, 80);
        s += edge(`M${P.Y[0] + 30},${P.Y[1] - 10} L${P.E[0] - 16},${125 + 14}`, M.tau, 'τ', 440, 180);
        const node = (k, shape, title, sub) => {
            const [x, y] = P[k], act = o.active === k, c = STATE_COLORS[k] || '#1f1e1b';
            let h = shape === 'rect' ? `<rect x="${x - 32}" y="${y - 30}" width="64" height="60" rx="6" fill="${act ? c : '#fff'}" stroke="${c}" stroke-width="${act ? 4 : 2.5}"/>`
                : `<circle cx="${x}" cy="${y}" r="${shape === 'small' ? 20 : 30}" fill="${act ? c : '#fff'}" stroke="${c}" stroke-width="${act ? 4 : 2.5}"/>`;
            h += `<text x="${x}" y="${y + (sub ? -2 : 5)}" text-anchor="middle" class="hm-dstate" fill="${act ? '#fff' : c}">${title}</text>`;
            if (sub) h += `<text x="${x}" y="${y + 14}" text-anchor="middle" class="hm-dtiny" fill="${act ? '#fff' : '#4d4a44'}">${sub}</text>`;
            return h;
        };
        s += node('B', 'small', 'Begin');
        s += node('M', 'rect', 'M', 'p(xᵢ, yⱼ)');
        s += node('X', 'circle', 'X', 'q(xᵢ)');
        s += node('Y', 'circle', 'Y', 'q(yⱼ)');
        s += node('E', 'small', 'End');
        s += `<text x="${P.X[0]}" y="${P.X[1] - 38}" text-anchor="middle" class="hm-dtiny">xᵢ against a gap</text>`;
        s += `<text x="${P.Y[0]}" y="${P.Y[1] + 46}" text-anchor="middle" class="hm-dtiny">yⱼ against a gap</text>`;
        s += `<text x="${P.M[0]}" y="${P.M[1] + 48}" text-anchor="middle" class="hm-dtiny">aligned pair</text>`;
        return s + '</svg>';
    }

    // ------------------------------------------------------------ part 3: Plan7 profile HMM
    function profileDiagram(P, opts = {}) {
        const o = Object.assign({ selected: null, trace: null, maxWidth: null }, opts);
        const m = P.m, compact = m > 24, NW = compact ? 36 : 64;
        const X = k => 70 + k * NW, yD = 42, yI = 102, yM = 162;
        const W = X(m + 1) + 70, H = 222;
        const used = new Set();
        if (o.trace) {
            const core = o.trace.filter(t => 'MID'.includes(t.s));
            let prev = 'B0';
            for (const t of core) { const id = t.s + t.k; used.add(prev + '>' + id); used.add(id); prev = id; }
            if (core.length) used.add(prev + '>E');
        }
        let s = `<svg class="hm-diagram hm-profile-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs>${marker('hm-qa', '#8a8378')}${marker('hm-qh', '#b6402c')}</defs>`;
        if (o.selected) s += `<rect x="${X(o.selected) - NW / 2}" y="14" width="${NW}" height="${H - 20}" fill="#fde68a" opacity="0.45" rx="4"/>`;
        const pos = { M: yM, I: yI, D: yD };
        const edge = (from, fk, to, tk, p, isLoop) => {
            const id = `${from}${fk}>${to === 'E' ? 'E' : to + tk}`;
            const on = used.has(id);
            const x1 = from === 'B' ? X(0) : X(fk) + (from === 'I' ? 0 : 0), y1 = from === 'B' ? yM : pos[from];
            const x2 = to === 'E' ? X(m + 1) : X(tk), y2 = to === 'E' ? yM : pos[to];
            const sw = (0.5 + 4 * p).toFixed(2), cls = on ? 'hm-edge hm-edge-on' : 'hm-edge hm-edge-q', mk = on ? 'hm-qh' : 'hm-qa';
            if (isLoop) return `<path d="M${x1 - 8},${y1 - 12} C${x1 - 26},${y1 - 44} ${x1 + 26},${y1 - 44} ${x1 + 8},${y1 - 12}" class="${cls}" style="stroke-width:${sw}" marker-end="url(#${mk})"><title>I${fk}→I${fk}: ${p.toFixed(3)}</title></path>`;
            // shorten the line so arrowheads stop at the shape border
            const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), r1 = 17, r2 = 19;
            const ax = x1 + dx / len * r1, ay = y1 + dy / len * r1, bx = x2 - dx / len * r2, by = y2 - dy / len * r2;
            return `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" class="${cls}" style="stroke-width:${sw}" marker-end="url(#${mk})"><title>${from === 'B' ? 'B' : from + fk}→${to === 'E' ? 'E' : to + tk}: ${p.toFixed(3)}</title></line>`;
        };
        // flanks
        s += `<circle cx="${X(0) - 44}" cy="${yM}" r="11" class="hm-flank"/><text x="${X(0) - 44}" y="${yM + 4}" text-anchor="middle" class="hm-dtiny">N</text>`;
        s += `<line x1="${X(0) - 33}" y1="${yM}" x2="${X(0) - 17}" y2="${yM}" class="hm-edge hm-edge-q" marker-end="url(#hm-qa)"/>`;
        s += `<circle cx="${X(m + 1) + 44}" cy="${yM}" r="11" class="hm-flank"/><text x="${X(m + 1) + 44}" y="${yM + 4}" text-anchor="middle" class="hm-dtiny">C</text>`;
        s += `<line x1="${X(m + 1) + 16}" y1="${yM}" x2="${X(m + 1) + 31}" y2="${yM}" class="hm-edge hm-edge-q" marker-end="url(#hm-qa)"/>`;
        // edges
        s += edge('B', 0, 'M', 1, P.t[0].MM);
        s += edge('B', 0, 'D', 1, P.t[0].MD);
        for (let k = 1; k < m; k++) {
            const t = P.t[k];
            s += edge('M', k, 'M', k + 1, t.MM) + edge('M', k, 'I', k, t.MI) + edge('M', k, 'D', k + 1, t.MD);
            s += edge('I', k, 'M', k + 1, t.IM) + edge('I', k, 'I', k, t.II, true);
            s += edge('D', k, 'D', k + 1, t.DD) + edge('D', k, 'M', k + 1, t.DM);
        }
        if (m >= 1) s += edge('M', m, 'E', 0, 1) + edge('D', m, 'E', 0, 1);
        // states
        const on = id => used.has(id) ? ' hm-on' : '';
        s += `<circle cx="${X(0)}" cy="${yM}" r="16" class="hm-special"/><text x="${X(0)}" y="${yM + 5}" text-anchor="middle" class="hm-dstate">B</text>`;
        s += `<circle cx="${X(m + 1)}" cy="${yM}" r="16" class="hm-special"/><text x="${X(m + 1)}" y="${yM + 5}" text-anchor="middle" class="hm-dstate">E</text>`;
        for (let k = 1; k <= m; k++) {
            const x = X(k), sz = compact ? 12 : 16;
            s += `<g class="hm-node" data-k="${k}">`;
            s += `<circle cx="${x}" cy="${yD}" r="${sz - 2}" class="hm-D${on('D' + k)}"><title>D${k}: delete (silent)</title></circle>`;
            if (k < m) s += `<path d="M${X(k) + NW / 2},${yI - sz} L${X(k) + NW / 2 + sz},${yI} L${X(k) + NW / 2},${yI + sz} L${X(k) + NW / 2 - sz},${yI} Z" class="hm-I${on('I' + k)}" transform="translate(${-NW / 2},0)"><title>I${k}: insert (background emissions)</title></path>`;
            s += `<rect x="${x - sz}" y="${yM - sz}" width="${2 * sz}" height="${2 * sz}" rx="3" class="hm-M${on('M' + k)}"><title>M${k}: consensus ${P.consensus[k]}, ${P.info[k].toFixed(2)} bits</title></rect>`;
            if (!compact) {
                s += `<text x="${x}" y="${yD + 4}" text-anchor="middle" class="hm-dtiny">D${k}</text>`;
                if (k < m) s += `<text x="${x}" y="${yI + 4}" text-anchor="middle" class="hm-dtiny">I${k}</text>`;
                s += `<text x="${x}" y="${yM + 5}" text-anchor="middle" class="hm-dstate">M${k}</text>`;
            }
            const cons = P.consensus[k];
            s += `<text x="${x}" y="${yM + (compact ? 30 : 36)}" text-anchor="middle" class="hm-dcons">${P.eM[k][cons] >= 0.5 ? cons : cons.toLowerCase()}</text>`;
            if (compact && (k % 10 === 0 || k === 1)) s += `<text x="${x}" y="${yM + 46}" text-anchor="middle" class="hm-dtiny">${k}</text>`;
            s += `<rect x="${x - NW / 2}" y="14" width="${NW}" height="${H - 20}" fill="transparent" class="hm-hit"/>`;
            s += '</g>';
        }
        return s + '</svg>';
    }

    // HMM logo: stack height = relative entropy of the match state
    function profileLogoStats(P) {
        const columns = [];
        let maxInfo = 0;
        for (let k = 1; k <= P.m; k++) {
            const info = P.info[k];
            maxInfo = Math.max(maxInfo, info);
            const letters = P.alphabet.split('').map(a => ({ a, h: P.eM[k][a] * info })).sort((x, y) => x.h - y.h);
            columns.push({ letters, info });
        }
        return { columns, maxBits: Math.max(2, Math.ceil(maxInfo)) };
    }

    // ------------------------------------------------------------ quiz
    function quiz(box, qs, fmt = x => x) {
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
                else if (attempts >= 2) fb.innerHTML = `✘ The answer is <strong>${q.type === 'choice' ? q.options[q.answer] : fmt(q.answer)}</strong>. ${q.explanation}`;
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

    return { esc, f2, log10, fmtLog10, fmtP, lesson, STATE_COLORS, basicDiagram, seqStrip, pathStrip, posteriorPlot, linePlot, histogram,
             pairDiagram, profileDiagram, profileLogoStats, quiz };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HmmViews;
}
