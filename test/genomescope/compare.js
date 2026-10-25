/**
 * Compare js/genomeScopeEngine.js with the R tool (genomescope2 2.1.0).
 * Every <name>[.m<max_kmercov>].summary.txt here is the R output for <name>.histo (p, k and max_kmercov are
 * read from it). The usa300_exercise histogram is the one of the assembly practical; the others were simulated
 * with js/kmerEngine.js (hap_* haploid, dip_* diploid; 1 Mbp genomes).
 *
 *   node test/genomescope/compare.js          (from the repository root)
 *
 * Expected: usa300_exercise identical; the rest within ~0.5 % for the lengths. Larger relative differences
 * appear only for values near zero (repeat length of a repeat-free genome, heterozygosity of a homozygous one),
 * where the optimum lies on a parameter bound and the last floating-point digits decide where R stops.
 */
const fs = require('fs'), path = require('path');
const GS = require('../../js/genomeScopeEngine.js');
const dir = __dirname;
const num = s => parseFloat(s.replace(/[,%bp ]/g, ''));
const KEYS = ['Heterozygous (ab)', 'Genome Haploid Length', 'Genome Repeat Length', 'Genome Unique Length', 'Model Fit', 'Read Error Rate'];
let worstLen = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.summary.txt')).sort()) {
    const sum = fs.readFileSync(path.join(dir, f), 'utf8');
    const name = f.replace(/(\.m\d+)?\.summary\.txt$/, '');
    const head = key => { const m = new RegExp('^' + key + ' = (\\d+)', 'm').exec(sum); return m ? +m[1] : -1; };
    const p = head('p'), k = head('k'), m = head('max_kmercov');
    const rows = GS.parseHisto(fs.readFileSync(path.join(dir, name + '.histo'), 'utf8'));
    const t0 = Date.now();
    const R = GS.run(rows, k, p, { maxKmercov: m });
    const ms = Date.now() - t0;
    const js = {
        'Heterozygous (ab)': R.het.map(v => 100 * v), 'Genome Haploid Length': R.haploidLength, 'Genome Repeat Length': R.repeatLength,
        'Genome Unique Length': R.uniqueLength, 'Model Fit': R.modelFit.map(v => 100 * v), 'Read Error Rate': [100 * R.errorRate, 100 * R.errorRate],
    };
    console.log(`== ${f}  (p ${p}, k ${k}${m > 0 ? ', max_kmercov ' + m : ''}; ${ms} ms)`);
    for (const key of KEYS) {
        const line = sum.split('\n').find(l => l.startsWith(key));
        if (!line) continue;
        const r = line.slice(30).trim().split(/\s{2,}/).map(num);
        const rel = Math.max(...r.map((v, i) => Math.abs(v - js[key][i]) / Math.max(Math.abs(v), 1e-9)));
        if (key === 'Genome Haploid Length') worstLen = Math.max(worstLen, rel);
        const show = a => a.map(v => +v.toPrecision(7)).join(' – ');
        console.log(`  ${key.padEnd(22)} R ${show(r).padEnd(24)} JS ${show(js[key]).padEnd(24)} ${rel < 1e-6 ? 'identical' : (100 * rel).toFixed(2) + ' %'}`);
    }
}
console.log(`\nlargest difference in the haploid genome length: ${(100 * worstLen).toFixed(2)} %`);
