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
            group: 'basic',
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
            group: 'basic',
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
            group: 'basic',
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
            group: 'basic',
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
            group: 'basic',
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
            group: 'basic',
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
            group: 'parameters',
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
            group: 'parameters',
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
            group: 'parameters',
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
        'multi-indel-dna': {
            group: 'rich',
            name: 'Three indels and a SNP (40 bp)',
            description: 'Related DNA with a 3-bp deletion, a 3-bp insertion, a 1-bp deletion and one substitution.',
            seq1: 'GATTACAGGCTTACGATCCGATGGCAATTGCAGTACCGTAC',
            seq2: 'GATTACATTACGATCCTTAGATGGCAATCGCAGTACGTAC',
            expected: 'Three separate gap runs (3, 3 and 1 symbols) and one mismatch; 7 gap symbols to place in total.',
            notes: 'A realistic editing task: the diagonal breaks three times. Place the long gaps first (they rescue the most matches), then the single one. The matrix values tell you where each jump has to happen. This example is stable across parameters – the same alignment is optimal for gap −1, −2 and −3.',
            questions: [
                { q: 'How many gap symbols does the optimal alignment contain?', type: 'number', answer: c => c.E.scoreAlignment(c.opt.aligned1, c.opt.aligned2, c.params).gaps, explanation: c => `${c.opt.aligned1} / ${c.opt.aligned2}` },
                { q: 'How many separate gaps (gap openings)?', type: 'number', answer: c => c.E.scoreAlignment(c.opt.aligned1, c.opt.aligned2, c.params).gapOpenings, explanation: () => 'A 3-bp deletion, a 3-bp insertion and a 1-bp deletion.' },
                { q: 'What is the optimal score?', type: 'number', answer: c => c.opt.score, explanation: () => 'Read the bottom-right cell.' }
            ]
        },
        'protein-indels': {
            group: 'rich',
            name: 'Protein: Ras-like pair with two indels (48 aa)',
            description: 'A Ras G-domain fragment against an edited relative: conservative substitutions, a 2-residue deletion and a 2-residue insertion.',
            seq1: 'MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDG',
            seq2: 'MREYKIVVLGSGGVGKSALTVQFVQNHFVEDPTLQDGGSYRKEVEIDG',
            params: { gapModel: 'affine', gapOpen: -10, gapExtend: -1 },
            expected: 'Two gaps of two residues each; about a quarter of the columns are mismatches, most of them scoring positive.',
            notes: 'Protein editing with BLOSUM62: the score line shows that L/I, K/R, V/I and D/E cost little or even score positive, so gaps are worth opening only for real indels. Switch to linear gaps with −8: the algorithm now splits the deletion into two single gaps (V-E-) to grab one extra E/E match – something affine penalties (open −10) forbid. Which alignment looks more like a single evolutionary event?',
            questions: [
                { q: 'How many gap openings does the affine-gap optimum have?', type: 'number', answer: c => c.E.scoreAlignment(c.opt.aligned1, c.opt.aligned2, c.params).gapOpenings, explanation: c => `${c.opt.aligned1} / ${c.opt.aligned2}` },
                { q: 'How many gap openings with LINEAR gaps of −8 (all else equal)?', type: 'number', answer: c => { const p = Object.assign({}, c.params, { gapModel: 'linear', gap: -8 }); const r = c.E.globalAlign(c.s1, c.s2, p); return c.E.scoreAlignment(r.aligned1, r.aligned2, p).gapOpenings; }, explanation: () => 'Linear gaps have no opening cost, so splitting a gap is free whenever it buys a match.' },
                { q: 'What is the BLOSUM62 score of the K↔R column?', type: 'number', answer: c => c.E.subScore(c.params, 'K', 'R'), explanation: () => 'Lysine and arginine are both positively charged: +2, a conservative substitution.' }
            ]
        },
        'protein-divergent': {
            group: 'parameters',
            name: 'Protein: loop insertion – gap model decides (≈50 aa)',
            description: 'Two diverged G-domain fragments: one carries a 5-residue loop insertion and a 3-residue deletion.',
            seq1: 'GKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEY',
            seq2: 'SSSALNIQVLQSHFLDDYDVYAPLQTFEESYRVDSGETAFITLLDTDAQEEH',
            params: { gapModel: 'affine', gapOpen: -10, gapExtend: -1 },
            expected: 'With affine gaps: one 5-residue gap and one 3-residue gap, 55 % identity.',
            notes: 'The same pair gives three different answers. Affine (open −10, extend −1): two clean indels. Linear gap −8: the 5-residue insertion is cheaper to absorb as mismatches than to pay 5 × 8 for a gap, so only two single gaps remain and identity drops to 42 %. Linear gap −4: gaps become cheap and get scattered into five separate pieces (61 % identity). Identity is a property of the alignment, not of the sequences – it depends on the parameters.',
            questions: [
                { q: 'How many gap symbols with the affine parameters?', type: 'number', answer: c => c.E.scoreAlignment(c.opt.aligned1, c.opt.aligned2, c.params).gaps, explanation: c => `${c.opt.aligned1} / ${c.opt.aligned2}` },
                { q: 'How many gap symbols with linear gap −8?', type: 'number', answer: c => { const p = Object.assign({}, c.params, { gapModel: 'linear', gap: -8 }); const r = c.E.globalAlign(c.s1, c.s2, p); return c.E.scoreAlignment(r.aligned1, r.aligned2, p).gaps; }, explanation: () => 'A 5-residue gap would cost 40; the mismatches cost less, so the insertion is hidden.' },
                { q: 'How many gap openings with linear gap −4?', type: 'number', answer: c => { const p = Object.assign({}, c.params, { gapModel: 'linear', gap: -4 }); const r = c.E.globalAlign(c.s1, c.s2, p); return c.E.scoreAlignment(r.aligned1, r.aligned2, p).gapOpenings; }, explanation: () => 'Cheap linear gaps are scattered wherever they buy a positive column.' }
            ]
        },
        'gap-penalty-flip': {
            group: 'parameters',
            name: 'Gap penalty decides: gaps or mismatches?',
            description: 'A 3-bp insertion and a 3-bp deletion – or five substitutions? Depends on the gap penalty.',
            seq1: 'ATGGCCACCATAGC', seq2: 'ATGCAAGCCACCAT',
            params: { gap: -1 },
            expected: 'Gap −1: six gap symbols, no mismatches (score 16). Gap −3: two gaps and five mismatches (score 5).',
            notes: 'Move the gap slider from −1 to −3 and watch the target score and the matrix. At −1 the shared block GCCACCAT is aligned perfectly using 3 + 3 gaps; at −3 those six gaps would cost 18, more than the eight matches gain, so the algorithm prefers a shifted, mismatch-rich alignment. Neither is "right" – the parameters encode your belief about how likely indels are relative to substitutions.',
            questions: [
                { q: 'How many gap symbols with gap −1?', type: 'number', answer: c => c.E.scoreAlignment(c.opt.aligned1, c.opt.aligned2, c.params).gaps, explanation: c => `${c.opt.aligned1} / ${c.opt.aligned2}` },
                { q: 'How many gap symbols with gap −3?', type: 'number', answer: c => { const p = Object.assign({}, c.params, { gap: -3 }); const r = c.E.globalAlign(c.s1, c.s2, p); return c.E.scoreAlignment(r.aligned1, r.aligned2, p).gaps; }, explanation: c => { const p = Object.assign({}, c.params, { gap: -3 }); const r = c.E.globalAlign(c.s1, c.s2, p); return `${r.aligned1} / ${r.aligned2}`; } },
                { q: 'What is the optimal score with gap −3?', type: 'number', answer: c => c.E.globalAlign(c.s1, c.s2, Object.assign({}, c.params, { gap: -3 })).score, explanation: c => { const p = Object.assign({}, c.params, { gap: -3 }); const r = c.E.globalAlign(c.s1, c.s2, p); const sc = c.E.scoreAlignment(r.aligned1, r.aligned2, p); return `${sc.matches} matches (+${sc.matches * 2}), ${sc.mismatches} mismatches (−${sc.mismatches}), ${sc.gaps} gaps (−${sc.gaps * 3}) = ${r.score}.`; } }
            ]
        },
        'mismatch-penalty-flip': {
            group: 'parameters',
            name: 'Mismatch penalty decides',
            description: 'Same length, four differences: substitutions, or two gaps and two substitutions?',
            seq1: 'TCACCTTACCATCTGT', seq2: 'TCACCTAGCCATGTAT',
            params: { substitution: { kind: 'simple', match: 2, mismatch: -1 }, gap: -2 },
            expected: 'Mismatch −1: an ungapped alignment with four mismatches. Mismatch −3: two gaps replace two of the mismatches.',
            notes: 'With a mild mismatch penalty the ungapped alignment wins. Make mismatches expensive (−3) and it becomes worth paying two gaps (−4) to convert two mismatches (−6) into a match. Transition/transversion scoring is the biological version of this: it makes some mismatches cheaper than others.',
            questions: [
                { q: 'How many mismatches in the optimal alignment with mismatch −1?', type: 'number', answer: c => c.E.scoreAlignment(c.opt.aligned1, c.opt.aligned2, c.params).mismatches, explanation: c => `${c.opt.aligned1} / ${c.opt.aligned2}` },
                { q: 'How many gap symbols with mismatch −3?', type: 'number', answer: c => { const p = Object.assign({}, c.params, { substitution: { kind: 'simple', match: 2, mismatch: -3 } }); const r = c.E.globalAlign(c.s1, c.s2, p); return c.E.scoreAlignment(r.aligned1, r.aligned2, p).gaps; }, explanation: c => { const p = Object.assign({}, c.params, { substitution: { kind: 'simple', match: 2, mismatch: -3 } }); const r = c.E.globalAlign(c.s1, c.s2, p); return `${r.aligned1} / ${r.aligned2}`; } }
            ]
        },
        'affine-vs-linear': {
            group: 'parameters',
            name: 'Linear vs. affine: one gap or three?',
            description: 'A 3-bp deletion: linear gaps scatter it, affine gaps keep it together.',
            seq1: 'CGTCCTCAGCGCACATA', seq2: 'CGTCCTCACCGCTA',
            params: { gapModel: 'affine', gapOpen: -5, gapExtend: -1 },
            expected: 'Affine: one gap of three symbols (score 18). Linear gap −2: three single gaps (score 19).',
            notes: 'Linear penalties charge per symbol, so three gaps of 1 cost the same as one gap of 3 – and splitting them buys extra matches. Affine penalties charge −5 to open and only −1 to extend: one gap of 3 costs 7, three separate gaps cost 15. The single-gap alignment is what a single deletion event would produce. Switch the gap model and compare.',
            questions: [
                { q: 'How many gap openings with affine gaps?', type: 'number', answer: c => c.E.scoreAlignment(c.opt.aligned1, c.opt.aligned2, c.params).gapOpenings, explanation: c => `${c.opt.aligned1} / ${c.opt.aligned2}` },
                { q: 'How many gap openings with linear gap −2?', type: 'number', answer: c => { const p = Object.assign({}, c.params, { gapModel: 'linear', gap: -2 }); const r = c.E.globalAlign(c.s1, c.s2, p); return c.E.scoreAlignment(r.aligned1, r.aligned2, p).gapOpenings; }, explanation: c => { const p = Object.assign({}, c.params, { gapModel: 'linear', gap: -2 }); const r = c.E.globalAlign(c.s1, c.s2, p); return `${r.aligned1} / ${r.aligned2}`; } },
                { q: 'Cost of one gap of length 3 with open −5 / extend −1?', type: 'number', answer: c => c.E.gapCost(c.params, 3), explanation: () => '−5 + 2 × (−1) = −7.' }
            ]
        },
        'protein-durbin': {
            group: 'protein',
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
            group: 'protein',
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
