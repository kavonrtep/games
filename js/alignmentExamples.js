/**
 * ALIGNMENT EXAMPLES
 * ==================
 * Examples for the global (Needleman–Wunsch) and local (Smith–Waterman)
 * trainers. Quiz answers are computed from the sequences and the
 * recommended parameters when the example is loaded, so they are always
 * consistent with what the student sees.
 *
 *  params     recommended parameter overrides, e.g. { gapModel: 'affine', gapOpen: -4 }
 *  questions  [{ q, type: 'number'|'choice', answer: ctx => value, tolerance?, options?, explanation: ctx => html }]
 *             ctx = { opt: engine result for the optimal alignment, params, s1, s2, E: AlignEngine }
 */
const ALIGNMENT_EXAMPLES = {
    global: {
        'identical': {
            name: 'Identical DNA sequences',
            description: 'The trivial case: every position matches.',
            seq1: 'ATCGATGCT', seq2: 'ATCGATGCT',
            expected: 'One diagonal through the matrix, no gaps, score = length × match.',
            notes: 'Look at the matrix: the optimal path runs straight down the diagonal and every cell on it adds the match score. Lower the mismatch penalty or raise the gap penalty – nothing changes, because no alternative can beat all matches.',
            questions: [
                { q: 'What is the optimal score?', type: 'number', answer: c => c.opt.score, explanation: c => `${c.s1.length} matches × ${c.params.substitution.match} = ${c.opt.score}.` }
            ]
        },
        'snps': {
            name: 'Similar DNA with point mutations',
            description: 'Same length, a few substitutions – gaps do not help.',
            seq1: 'ATCGATCGAATCGT', seq2: 'ATGGATCGTATAGT',
            expected: 'A diagonal path with three mismatches; gaps would cost more than they save.',
            notes: 'With match +2 / mismatch −1 / gap −2, replacing a mismatch by two gaps costs 4 instead of 1. Try gap −1: now a pair of gaps costs only 2 and can pay off if it creates a match.',
            questions: [
                { q: 'How many mismatches does the optimal alignment contain with the recommended parameters?', type: 'number', answer: c => c.E.scoreAlignment(c.opt.aligned1, c.opt.aligned2, c.params).mismatches, explanation: c => `Optimal alignment: ${c.opt.aligned1} / ${c.opt.aligned2}.` },
                { q: 'What is the optimal score?', type: 'number', answer: c => c.opt.score, explanation: () => 'Read the bottom-right cell of the matrix.' }
            ]
        },
        'indel': {
            name: 'Insertion / deletion',
            description: 'Seq 1 carries three extra bases.',
            seq1: 'ATCGCGTATGCAACG', seq2: 'ATCGATGCAACG',
            expected: 'The path leaves the diagonal for three horizontal steps (gap in Seq 2).',
            notes: 'Three gaps cost 6 but rescue 9 matches. Notice that the gap can sit in more than one place with the same score – the matrix has several optimal paths (see "co-optimal alignments").',
            questions: [
                { q: 'What is the optimal score?', type: 'number', answer: c => c.opt.score, explanation: c => `${c.opt.aligned1} / ${c.opt.aligned2}` },
                { q: 'How many co-optimal alignments are there (linear gaps)?', type: 'number', answer: c => c.opt.optimalPaths, explanation: () => 'Count the cells with two or more arrows on the optimal path: each tie doubles the possibilities.' }
            ]
        },
        'length-difference': {
            name: 'Very different lengths',
            description: 'A 12-mer against a 6-mer: global alignment must pay for six gaps.',
            seq1: 'ATCGATCGATCG', seq2: 'ATCGAA',
            expected: 'A short diagonal and a long run of gaps.',
            notes: 'This is where end-gap handling matters. Switch "end gaps" to free: overhangs stop costing anything and the short sequence is placed where it fits best – the semi-global alignment used for read mapping and overlap detection.',
            questions: [
                { q: 'With penalised end gaps, what is the optimal score?', type: 'number', answer: c => c.opt.score, explanation: () => '6 gaps × −2 = −12 plus the aligned part.' },
                { q: 'With FREE end gaps (all else equal), what is the optimal score?', type: 'number', answer: c => c.E.globalAlign(c.s1, c.s2, Object.assign({}, c.params, { endGaps: 'free' })).score, explanation: () => 'The overhang is free, so only the aligned columns count.' }
            ]
        },
        'unrelated': {
            name: 'Unrelated DNA',
            description: 'Two random-like sequences.',
            seq1: 'GCTAGCTAGCTATGCG', seq2: 'ACATAAGGTACCTAGAG',
            expected: 'A wandering path with many mismatches and gaps; low score.',
            notes: 'Global alignment always produces an alignment, even for unrelated sequences. The score tells you it is poor; a shuffled sequence would score about the same.',
            questions: [
                { q: 'What is the optimal score?', type: 'number', answer: c => c.opt.score, explanation: () => 'Low or negative – no signal.' }
            ]
        },
        'tandem': {
            name: 'Tandem repeat, different copy number',
            description: 'Both sequences repeat GCTAG; one copy differs.',
            seq1: 'GCTAGCTGCTAGCTGCTAGCT', seq2: 'TAGCTGCTAGCTGCTAGCTGCTAG',
            expected: 'Several equally good paths – repeats create ties.',
            notes: 'Repeats are the classic source of alignment ambiguity: the extra unit can be aligned as a gap in many positions with identical scores.',
            questions: [
                { q: 'How many co-optimal alignments exist with the recommended parameters?', type: 'number', answer: c => c.opt.optimalPaths, explanation: () => 'Every placement of the surplus repeat unit gives the same score.' }
            ]
        },
        'gap-open-extend': {
            name: 'One long gap vs. several short ones (affine)',
            description: 'A 5-bp insertion: affine gaps prefer one long gap.',
            seq1: 'ATCGAAAAATCG', seq2: 'ATCGATCG',
            params: { gapModel: 'affine', gapOpen: -4, gapExtend: -1 },
            expected: 'A single horizontal run of four gaps.',
            notes: 'With linear gaps every gap symbol costs the same, so splitting a gap is free. With affine gaps opening costs −4 and each extension only −1: one gap of length 4 costs −7, two gaps of length 2 cost −10. Switch the gap model and compare the optimal alignments.',
            questions: [
                { q: 'What does a gap of length 4 cost with open −4 / extend −1?', type: 'number', answer: c => c.E.gapCost({ gapModel: 'affine', gapOpen: -4, gapExtend: -1 }, 4), explanation: () => 'open + 3 × extend = −4 − 3 = −7.' },
                { q: 'What is the optimal score?', type: 'number', answer: c => c.opt.score, explanation: c => `${c.opt.aligned1} / ${c.opt.aligned2}` }
            ]
        },
        'titv': {
            name: 'Transitions vs. transversions',
            description: 'Substitutions that are all transitions (A↔G, C↔T).',
            seq1: 'ATCGATCGAT', seq2: 'GTCAATCAGT',
            params: { substitution: { kind: 'titv', match: 2, transition: -1, transversion: -3 } },
            expected: 'Diagonal path; every mismatch is a transition and costs only −1.',
            notes: 'Transitions are about twice as frequent as transversions in real DNA, so a realistic matrix penalises them less. With a transversion penalty of −3 the algorithm would rather open gaps than accept a transversion.',
            questions: [
                { q: 'How many transitions separate the sequences?', type: 'number', answer: c => c.E.scoreAlignment(c.opt.aligned1, c.opt.aligned2, c.params).mismatches, explanation: () => 'Positions 1, 4, 8 and 9 – A↔G in every case (purine↔purine).' },
                { q: 'What is the optimal score?', type: 'number', answer: c => c.opt.score, explanation: c => `${c.opt.aligned1} / ${c.opt.aligned2}` }
            ]
        },
        'overhang': {
            name: 'Overlapping reads (free end gaps)',
            description: 'The end of Seq 1 overlaps the start of Seq 2.',
            seq1: 'GGATCCAGTTAGCTTACCTGAC', seq2: 'AGCTTACCTGACGTAACGATTG',
            params: { endGaps: 'free' },
            expected: 'A diagonal in the lower-left part of the matrix; the overhangs are free.',
            notes: 'With free end gaps the best path may start on the top row or left column and end on the bottom row or right column. This is exactly the overlap alignment assemblers use.',
            questions: [
                { q: 'How many bases do the reads overlap?', type: 'number', answer: c => c.E.scoreAlignment(c.opt.aligned1, c.opt.aligned2, c.params).matches, explanation: () => 'Count the aligned (non-terminal) columns.' },
                { q: 'What is the optimal score with penalised end gaps instead?', type: 'number', answer: c => c.E.globalAlign(c.s1, c.s2, Object.assign({}, c.params, { endGaps: 'penalized' })).score, explanation: () => 'Twenty terminal gaps now cost −40: global alignment is the wrong tool for overlaps.' }
            ]
        },
        'protein-durbin': {
            name: 'Protein: HEAGAWGHEE vs PAWHEAE (textbook example)',
            description: 'The classic example from Durbin et al. (they use BLOSUM50 and gap −8; here BLOSUM62).',
            seq1: 'HEAGAWGHEE', seq2: 'PAWHEAE',
            params: { gapModel: 'linear', gap: -8 },
            expected: 'HEAGAWGHEE / --P-AWHEAE: the AW…HE core aligns, the rest is paid for with gaps.',
            notes: 'Protein alignment uses a substitution matrix: a mismatch can score positive (e.g. E↔D) or strongly negative (W↔G). Hover the score line under the alignment to see each column\'s BLOSUM62 value. Change the gap penalty to −4 and see how the alignment fragments.',
            questions: [
                { q: 'What is the optimal score with BLOSUM62 and gap −8?', type: 'number', answer: c => c.opt.score, explanation: c => `${c.opt.aligned1} / ${c.opt.aligned2}` },
                { q: 'What does BLOSUM62 give for aligning W with W?', type: 'number', answer: c => c.E.subScore(c.params, 'W', 'W'), explanation: () => 'Tryptophan is rare, so a conserved W is strong evidence of homology: +11.' }
            ]
        },
        'protein-conservative': {
            name: 'Protein: conservative substitutions',
            description: 'Two peptides that differ by chemically similar residues.',
            seq1: 'MKVLIAGDRE', seq2: 'MRILVSGEKD',
            params: { gapModel: 'affine', gapOpen: -10, gapExtend: -1 },
            expected: 'No gaps; several mismatches score positive (K↔R, V↔I, L↔V, D↔E).',
            notes: 'Identity is only 40 %, but similarity is high: BLOSUM62 rewards substitutions that are common among related proteins. This is why protein alignments report both identity and similarity.',
            questions: [
                { q: 'How many mismatch columns have a POSITIVE score?', type: 'number', answer: c => c.E.scoreAlignment(c.opt.aligned1, c.opt.aligned2, c.params).columns.filter(x => x.type === 'mismatch' && x.score > 0).length, explanation: () => 'K/R +2, V/I +3, I/V +3, A/S +1, D/E +2, R/K +2, E/D +2 – all chemically similar pairs.' },
                { q: 'What is the optimal score?', type: 'number', answer: c => c.opt.score, explanation: c => `${c.opt.aligned1} / ${c.opt.aligned2}` }
            ]
        }
    },

    local: {
        'shared-motif': {
            name: 'Shared core motif',
            description: 'Two unrelated sequences share one conserved motif.',
            seq1: 'GAGCGTCTGTTGACATCGTACGATTGCAACGATT', seq2: 'CGTCTTGGCTAATCTTGACATCGTACGATGGTCGGTT',
            expected: 'One high-scoring island in the matrix; everything else is zero.',
            notes: 'Smith–Waterman resets negative scores to 0, so unrelated regions never drag the score down. The best local alignment starts where the matrix first becomes positive and ends at the maximum cell.',
            questions: [
                { q: 'What is the best local alignment score?', type: 'number', answer: c => c.loc.score, explanation: c => `${c.loc.aligned1} / ${c.loc.aligned2}` },
                { q: 'At which Seq 1 position does the best local alignment start?', type: 'number', answer: c => c.loc.s1Start, explanation: c => `Seq 1 ${c.loc.s1Start}–${c.loc.s1End}, Seq 2 ${c.loc.s2Start}–${c.loc.s2End}.` }
            ]
        },
        'overlap': {
            name: 'Overlapping sequences',
            description: 'The 3′ end of Seq 1 equals the 5′ end of Seq 2.',
            seq1: 'GAGCGTCTGGCGTCTTGGCTAATC', seq2: 'GCGTCTTGGCTAATCCCCCTACAT',
            expected: 'A diagonal ending at the right edge; a second, weaker alignment from the internal repeat.',
            notes: 'Compare with the global trainer: global alignment of these two would waste score on the overhangs. Lower the threshold to see weaker local alignments appear.',
            questions: [
                { q: 'How long is the best local alignment (columns)?', type: 'number', answer: c => c.loc.aligned1.length, explanation: c => `${c.loc.aligned1} / ${c.loc.aligned2}` },
                { q: 'What is its score?', type: 'number', answer: c => c.loc.score, explanation: () => 'Read the maximum cell of the matrix.' }
            ]
        },
        'insertion': {
            name: 'Insertion inside a conserved region',
            description: 'Identical sequences except for a 15-bp insertion in Seq 1.',
            seq1: 'GGCCAGTGGTCGGTTGCTACACCCCTGCCGCAACGTTGAAGGTCCCGG', seq2: 'GGCCAGTGGTCGGTTGAACGTTGAAGGTCCCGG',
            params: { gap: -3 },
            expected: 'Depending on the gap penalty: one alignment bridging the insertion, or two separate alignments.',
            notes: 'With gap −3 bridging the 15-bp insertion would cost 45, more than the second half is worth, so Smith–Waterman reports two separate alignments. With gap −1 (cost 15) joining them pays off. Try both and watch the list.',
            questions: [
                { q: 'With the recommended parameters, how many bases does the best local alignment cover in Seq 1?', type: 'number', answer: c => c.loc.s1End - c.loc.s1Start + 1, explanation: c => `Seq 1 ${c.loc.s1Start}–${c.loc.s1End}.` },
                { q: 'What is the best score if the gap penalty is −1 instead?', type: 'number', answer: c => c.E.localAlign(c.s1, c.s2, Object.assign({}, c.params, { gap: -1, gapModel: 'linear' })).score, explanation: () => 'Now the 15-bp gap costs only 15 and the two halves join.' }
            ]
        },
        'repeats': {
            name: 'Repeated motifs',
            description: 'Seq 2 contains two diverged copies of Seq 1.',
            seq1: 'GAGCGTCTGGCGTCTTGGCTAAT', seq2: 'GTGCGTCTGGCCTCTTGGCTAATGAGCGTCTGGCCTCTTGGCTAAT',
            expected: 'Two parallel diagonals of similar score.',
            notes: 'Local alignment can report several alignments; the list shows them best first. Each copy gives its own alignment because they do not share matrix cells.',
            questions: [
                { q: 'How many local alignments with score ≥ 30 are found?', type: 'number', answer: c => c.E.localAlignments(c.s1, c.s2, c.params, 30).alignments.length, explanation: () => 'One per copy: the two copies occupy different cells of the matrix.' }
            ]
        },
        'exon': {
            name: "Conserved 5' region",
            description: 'Sequences share their first half and diverge afterwards.',
            seq1: 'CAAGGGCGAGTATTGAACCAGGTGACACCCGTTATACTCCA', seq2: 'CAAGGGCGAGTATTGAACCAGGTTGTTATAAACAATCAGTG',
            expected: 'A diagonal from the top-left corner that stops where the sequences diverge.',
            notes: 'The alignment ends at the maximum cell: extending it into the divergent region would only lower the score.',
            questions: [
                { q: 'At which Seq 1 position does the best local alignment end?', type: 'number', answer: c => c.loc.s1End, explanation: c => `Seq 1 ${c.loc.s1Start}–${c.loc.s1End}.` }
            ]
        },
        'unrelated': {
            name: 'Unrelated sequences',
            description: 'Two random sequences of 50 bp.',
            seq1: 'GAAGTTATGGAGCATAATAACATGTGGATGGCCAGTGGTCGGTTGCTACA', seq2: 'CCCTGCCGCGGTCCCGGATTAGACTGGCTGGATCTATGCCGTGACACCCG',
            expected: 'Only short chance alignments; the best score is small.',
            notes: 'Every pair of sequences has some best local alignment. Whether it means anything depends on how likely such a score is by chance – the idea behind BLAST E-values.',
            questions: [
                { q: 'What is the best local alignment score?', type: 'number', answer: c => c.loc.score, explanation: () => 'A handful of chance matches.' }
            ]
        },
        'protein-domain': {
            name: 'Protein: shared domain',
            description: 'Two proteins sharing one domain (BLOSUM62, affine gaps).',
            seq1: 'MSTKQLVRAAGWLKEVPYCDGARFTKKLE', seq2: 'PPTDGSFWLRDVPYCEGSRYSKEAAAQ',
            params: { gapModel: 'affine', gapOpen: -10, gapExtend: -1 },
            expected: 'One local alignment over the WL…PYC…G…R region.',
            notes: 'The domain is recognisable through conservative substitutions: BLOSUM62 scores W/W +11, Y/Y +7 and the diverged positions mildly, so the local score stays high although identity is moderate.',
            questions: [
                { q: 'What is the best local alignment score?', type: 'number', answer: c => c.loc.score, explanation: c => `${c.loc.aligned1} / ${c.loc.aligned2}` }
            ]
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ALIGNMENT_EXAMPLES;
}
