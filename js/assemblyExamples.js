/**
 * ASSEMBLY EXAMPLES
 * =================
 * Parameter presets for assembly.html, one list per tab. Each preset is a
 * full parameter set plus a short teaching note. The rule used in the notes
 * (verified with the engine): two copies of an R bp repeat are resolved only
 * when k − 1 > R, i.e. k ≥ R + 2 – a (k−1)-mer must reach past the repeat
 * into the unique sequence on at least one side.
 */
const ASSEMBLY_EXAMPLES = {
    basics: [
        { name: 'Small genome, no repeat ★', params: { uniqueLen: 14, repeatLength: 0, repeatCopies: 1, readLength: 12, coverage: 4, k: 6, errorRate: 0, pruneThreshold: 1 },
          blurb: 'A 28 bp genome read as overlapping 12 bp reads. Small enough to follow every k-mer into the graph and back out as a contig.' },
        { name: 'Small genome with a repeat', params: { uniqueLen: 8, repeatLength: 5, repeatCopies: 2, readLength: 12, coverage: 4, k: 5, errorRate: 0, pruneThreshold: 1 },
          blurb: 'The same idea with a 5 bp repeat. With k = 5 the (k−1)-mers inside the repeat occur twice and the graph branches; from k = 7 the genome comes back in one piece.' }
    ],
    repeats: [
        { name: 'Interspersed repeat ★', params: { uniqueLen: 12, repeatLength: 8, repeatCopies: 2, readLength: 16, coverage: 8, k: 6, errorRate: 0, pruneThreshold: 1 },
          blurb: 'One 8 bp repeat at two places. With k = 6 its copies collapse into shared (red) nodes and the assembly falls apart. Drag k up: from k = 10 (k − 1 = 9 > 8) the copies stay separate and one contig remains.' },
        { name: 'Longer repeat', params: { uniqueLen: 12, repeatLength: 12, repeatCopies: 2, readLength: 20, coverage: 9, k: 7, errorRate: 0, pruneThreshold: 1 },
          blurb: 'A 12 bp repeat needs k ≥ 14 – possible only because the reads are 20 bp long. Shorten the reads to 14 bp and no k works any more.' },
        { name: 'Three copies', params: { uniqueLen: 10, repeatLength: 8, repeatCopies: 3, readLength: 16, coverage: 8, k: 6, errorRate: 0, pruneThreshold: 1 },
          blurb: 'Three copies of the repeat: the shared nodes now have three ways in and three ways out, and the genome breaks into even more pieces until k spans the repeat.' },
        { name: 'Repeat longer than the reads', params: { uniqueLen: 10, repeatLength: 16, repeatCopies: 2, readLength: 14, coverage: 8, k: 8, errorRate: 0, pruneThreshold: 1 },
          blurb: 'The repeat (16 bp) is longer than any read (14 bp). No k can resolve it: this is why real genomes need long reads or paired-end reads that jump over repeats.' },
        { name: 'Thin coverage', params: { uniqueLen: 14, repeatLength: 6, repeatCopies: 2, readLength: 16, coverage: 2, k: 11, errorRate: 0, pruneThreshold: 1 },
          blurb: 'Only 2× coverage: reads start every 8 bp. The 6 bp repeat needs k ≥ 8, but a 16 bp read holds only 16 − k + 1 k-mers, so from k = 10 some k-mers of the genome are in no read and the path breaks. Only k = 8–9 works – the other side of the trade-off: large k needs deep coverage.' }
    ],
    errors: [
        { name: 'Errors → tips and bubbles ★', params: { uniqueLen: 20, repeatLength: 0, repeatCopies: 1, readLength: 16, coverage: 14, k: 9, errorRate: 3, pruneThreshold: 1 },
          blurb: 'No repeat, but 3 % of the read bases are wrong. Every error creates up to k wrong k-mers, seen once: thin detours below the thick true path. Raise the coverage threshold to 2× and they disappear.' },
        { name: 'Heavy errors', params: { uniqueLen: 26, repeatLength: 0, repeatCopies: 1, readLength: 20, coverage: 15, k: 9, errorRate: 6, pruneThreshold: 1 },
          blurb: '6 % errors: some wrong k-mers are now seen twice, and some true k-mers lose coverage. Look at the k-mer count histogram to choose a threshold – too high and the true path breaks.' },
        { name: 'Errors and low coverage', params: { uniqueLen: 20, repeatLength: 0, repeatCopies: 1, readLength: 16, coverage: 4, k: 9, errorRate: 3, pruneThreshold: 1 },
          blurb: 'At 4× coverage true k-mers are seen only a few times, so the two peaks of the histogram overlap: no threshold removes all errors without cutting the genome. Sequencing deeper is the cure.' },
        { name: 'Clean reads', params: { uniqueLen: 22, repeatLength: 0, repeatCopies: 1, readLength: 16, coverage: 12, k: 8, errorRate: 0, pruneThreshold: 1 },
          blurb: 'Error rate 0 – the baseline: one thick path. Raise the error rate step by step and watch the first tips appear.' }
    ]
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ASSEMBLY_EXAMPLES };
}
