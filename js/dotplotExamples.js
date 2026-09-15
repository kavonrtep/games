/**
 * DOTPLOT EXAMPLES
 * ================
 * Educational examples for the dotplot trainer. Edit this file to add or
 * change examples – no other code needs to change.
 *
 * FIELDS
 *  name            shown in the drop-down
 *  group           'basic' (short, letters visible) or 'genomic' (longer)
 *  description     one sentence shown when the example is loaded
 *  seq1, seq2      DNA (A, C, G, T). Use `self: true` to compare seq1 with itself.
 *  params          recommended settings, e.g. { mode: 'runlength', minRun: 3 }
 *                  or { mode: 'window', window: 11, threshold: 8 }
 *  expectedPattern what the student should see
 *  educationalNotes deeper explanation
 *  questions       optional quiz, each either
 *                    { q, type: 'number', answer, tolerance?, explanation }
 *                  or
 *                    { q, type: 'choice', options: [...], answer: <index>, explanation }
 *
 * All positions in questions are 1-based, as shown on the plot axes.
 */

const DOTPLOT_EXAMPLES = {

    /* ------------------------------------------------------------ basic */

    'identical': {
        name: 'Identical sequences',
        group: 'basic',
        description: 'Both sequences are the same – the simplest possible dotplot.',
        seq1: 'GAGCGTCTGGCGTCTTGGCTAATCCCCCTACATGTTGT',
        self: true,
        params: { mode: 'runlength', minRun: 3 },
        expectedPattern: 'One unbroken green diagonal from the top-left to the bottom-right corner.',
        educationalNotes: 'Every position matches itself, so the main diagonal is complete. Lower the minimum diagonal length to 1 to see the random background: every A matches every other A, and so on. Roughly one cell in four is a chance match, which is why short words are so noisy.',
        questions: [
            { q: 'What does a single green diagonal spanning the whole plot tell you?', type: 'choice',
              options: ['The two sequences are identical', 'Seq 2 is the reverse complement of Seq 1', 'Seq 1 contains a tandem repeat'],
              answer: 0, explanation: 'Every position i of Seq 1 matches position i of Seq 2, so all dots lie on the main diagonal.' },
            { q: 'Set the minimum diagonal length to 1. Roughly what fraction of all cells contain a dot?', type: 'choice',
              options: ['About 1/4', 'About 1/2', 'Almost all'],
              answer: 0, explanation: 'With four equally frequent bases, two random positions agree with probability 1/4. This is the noise floor every dotplot filter must beat.' }
        ]
    },

    'direct-repeat': {
        name: 'Direct repeat (self-comparison)',
        group: 'basic',
        description: 'A 12-bp segment occurs twice, one copy directly after the other.',
        seq1: 'GACTCGCTGTTTTCGAAATTTGCTTCGAAATTTGCGCTCAAGGGCGAGT',
        self: true,
        params: { mode: 'runlength', minRun: 4 },
        expectedPattern: 'The main diagonal plus two short green lines parallel to it, one above and one below.',
        educationalNotes: 'A repeated segment matches both itself (on the main diagonal) and its other copy (off the diagonal). Because a self-comparison is symmetric, every off-diagonal feature appears twice, mirrored across the main diagonal. The perpendicular distance of a parallel line from the diagonal equals the distance between the copies.',
        questions: [
            { q: 'How long is the repeated segment (bp)?', type: 'number', answer: 12, tolerance: 0,
              explanation: 'The off-diagonal green line spans 12 cells: TTCGAAATTTGC.' },
            { q: 'At which position of Seq 1 does the second copy start?', type: 'number', answer: 24, tolerance: 0,
              explanation: 'Copies are at 12–23 and 24–35 – directly adjacent, a tandem duplication.' },
            { q: 'Lines parallel to the main diagonal indicate…', type: 'choice',
              options: ['a direct repeat (same orientation)', 'an inverted repeat', 'a deletion'],
              answer: 0, explanation: 'Parallel = same orientation. Inverted repeats produce lines perpendicular to the diagonal (red).' }
        ]
    },

    'inverted-repeat': {
        name: 'Perfect palindrome (self-comparison)',
        group: 'basic',
        description: 'The sequence equals its own reverse complement.',
        seq1: 'TGCCATTCTCTCAGTGTATTACGCGTAATACACTGAGAGAATGGCA',
        self: true,
        params: { mode: 'runlength', minRun: 4 },
        expectedPattern: 'A green main diagonal AND a red anti-diagonal crossing it – an X shape.',
        educationalNotes: 'Red dots mark matches between Seq 1 and the reverse complement of Seq 2. A red anti-diagonal therefore means "this stretch, read backwards on the other strand, equals that stretch". Restriction sites (GAATTC) and hairpin stems are palindromes of this type. Read the red letters on the right axis from bottom to top to see the reverse complement.',
        questions: [
            { q: 'A red anti-diagonal runs through the whole plot. What does it mean?', type: 'choice',
              options: ['The sequence is its own reverse complement (a palindrome)', 'Seq 2 is a shuffled copy of Seq 1', 'Seq 2 carries a large deletion'],
              answer: 0, explanation: 'Every position matches the reverse-complement strand at the mirrored position – the definition of a DNA palindrome.' },
            { q: 'How long is each arm of the inverted repeat (bp)?', type: 'number', answer: 23, tolerance: 0,
              explanation: 'The 46-bp palindrome has no loop, so each arm is 46 / 2 = 23 bp.' }
        ]
    },

    'hairpin': {
        name: 'Inverted repeat with loop (hairpin)',
        group: 'basic',
        description: 'Two inverted arms separated by an unpaired loop – the stem of an RNA hairpin.',
        seq1: 'TGCCATTCTCTCAGTGTATTAACGTCGCGTAATACACTGAGAGAATGGCA',
        self: true,
        params: { mode: 'runlength', minRun: 4 },
        expectedPattern: 'A green main diagonal and a red anti-diagonal that is interrupted in the middle.',
        educationalNotes: 'Unlike the perfect palindrome, the red anti-diagonal has a gap in the centre: the loop bases do not pair with anything. The length of the gap equals the loop length; the length of each red arm equals the stem length.',
        questions: [
            { q: 'How long is each arm (stem) of the inverted repeat (bp)?', type: 'number', answer: 21, tolerance: 1,
              explanation: 'Positions 1–21 pair with positions 30–50 on the opposite strand.' },
            { q: 'How long is the unpaired loop between the arms (bp)?', type: 'number', answer: 8, tolerance: 1,
              explanation: 'Positions 22–29 (ACGTCGCG) have no red partner – 8 bp of loop.' }
        ]
    },

    'point-mutations': {
        name: 'Point mutations (SNPs)',
        group: 'basic',
        description: 'Two sequences of equal length that differ at a few positions.',
        seq1: 'AGCTTAGCAGCTTGACGTAACG',
        seq2: 'AGCTGAGCATCTTGCCGTAACG',
        params: { mode: 'runlength', minRun: 3 },
        expectedPattern: 'A main diagonal broken into pieces; each break is one mutation.',
        educationalNotes: 'A substitution does not shift the diagonal, it only interrupts it. Increasing the minimum diagonal length removes short pieces first – exactly the pieces between closely spaced mutations. The window/threshold mode tolerates mismatches inside a window and can bridge the gaps: try window 7, threshold 5.',
        questions: [
            { q: 'How many point mutations separate the two sequences?', type: 'number', answer: 3, tolerance: 0,
              explanation: 'The diagonal is interrupted at positions 5, 10 and 15.' },
            { q: 'What is the largest minimum diagonal length that still shows all four pieces of the diagonal?', type: 'number', answer: 4, tolerance: 0,
              explanation: 'The pieces are 4, 4, 4 and 7 bp long, so a minimum of 4 keeps them all; 5 removes three of them.' }
        ]
    },

    'indel': {
        name: 'Insertion / deletion',
        group: 'basic',
        description: 'Seq 2 carries a 6-bp insertion relative to Seq 1.',
        seq1: 'GACTCGCTGTTTTCGAAATTTGCGCTCAAGGGCG',
        seq2: 'GACTCGCTGTTTTCGAAATAAACAATTGCGCTCAAGGGCG',
        params: { mode: 'runlength', minRun: 3 },
        expectedPattern: 'A diagonal that jumps sideways: the second half is shifted down relative to the first.',
        educationalNotes: 'An insertion in Seq 2 (vertical axis) pushes everything after it further down, so the diagonal continues on a lower parallel. The vertical size of the jump equals the insertion length. Seen from Seq 2, the same event is a deletion in Seq 1 – a dotplot cannot tell the two apart without an outgroup.',
        questions: [
            { q: 'How many bases are inserted in Seq 2 (bp)?', type: 'number', answer: 6, tolerance: 0,
              explanation: 'Seq 2 is 40 bp, Seq 1 is 34 bp; the diagonal shifts by 6 rows.' },
            { q: 'At which Seq 2 position does the inserted segment begin?', type: 'number', answer: 20, tolerance: 1,
              explanation: 'The first diagonal piece ends at Seq 2 position 19; the second begins at 26. Positions 20–25 are the insertion.' },
            { q: 'An insertion in the sequence on the vertical axis shows up as…', type: 'choice',
              options: ['a vertical shift of the diagonal', 'a horizontal shift of the diagonal', 'a red anti-diagonal'],
              answer: 0, explanation: 'Extra bases on the vertical axis move all later rows down, hence a vertical offset.' }
        ]
    },

    'inversion': {
        name: 'Inversion of a middle segment',
        group: 'basic',
        description: 'The middle of Seq 2 has been replaced by its reverse complement.',
        seq1: 'TATAAACCTGTTAGCTTACCTGACTCTACTTGGAAAT',
        seq2: 'TATAAACCTGTGGTAAGCTATGACTCTACTTGGAAAT',
        params: { mode: 'runlength', minRun: 3 },
        expectedPattern: 'Green diagonal at both ends, a red anti-diagonal in the middle.',
        educationalNotes: 'An inversion flips a segment onto the other strand and reverses its order. In the plot the flanks stay on the green diagonal while the inverted segment forms a red line perpendicular to it. Chromosomal inversions look exactly like this in whole-genome dotplots, just millions of bases long.',
        questions: [
            { q: 'At which position of Seq 1 does the inverted segment start?', type: 'number', answer: 12, tolerance: 1,
              explanation: 'The green diagonal ends at 11; the red anti-diagonal covers 12–20.' },
            { q: 'How long is the inverted segment (bp)?', type: 'number', answer: 9, tolerance: 1,
              explanation: 'Positions 12–20 of Seq 1 match the reverse complement of Seq 2 positions 12–20.' }
        ]
    },

    'overlap': {
        name: 'Partially overlapping sequences',
        group: 'basic',
        description: 'The end of Seq 1 is the beginning of Seq 2 – like two sequencing reads.',
        seq1: 'AGCTTAGCAGCTTGAC',
        seq2: 'GCAGCTTGACGTAACG',
        params: { mode: 'runlength', minRun: 3 },
        expectedPattern: 'A single green diagonal that starts on the top edge and ends on the right edge.',
        educationalNotes: 'Overlapping reads produce a diagonal that touches two different edges of the plot. This is the signal genome assemblers look for when they join reads into contigs (see the Assembly game).',
        questions: [
            { q: 'How many bases do the two sequences share?', type: 'number', answer: 10, tolerance: 0,
              explanation: 'Seq 1 positions 7–16 equal Seq 2 positions 1–10.' },
            { q: 'Which ends overlap?', type: 'choice',
              options: ["the 3' end of Seq 1 with the 5' end of Seq 2", "the 5' end of Seq 1 with the 3' end of Seq 2"],
              answer: 0, explanation: 'The diagonal runs from the top edge (start of Seq 2) to the right edge (end of Seq 1).' }
        ]
    },

    'tandem-repeat': {
        name: 'Tandem repeat, 14-bp unit (self-comparison)',
        group: 'basic',
        description: 'The same 14-bp unit repeated head-to-tail.',
        seq1: 'GTGTTGACGTAACGGTGTTGACGTAACGGTGTTGACGTAACGGTGTTGA',
        self: true,
        params: { mode: 'runlength', minRun: 4 },
        expectedPattern: 'Several green diagonals, evenly spaced and parallel to the main diagonal.',
        educationalNotes: 'Each copy matches every other copy, giving a family of parallel diagonals. The spacing between neighbouring diagonals equals the repeat unit length, and the number of diagonals (on one side of the main diagonal) equals the number of copies minus one.',
        questions: [
            { q: 'How long is the repeat unit (bp)? Hint: spacing between neighbouring diagonals.', type: 'number', answer: 14, tolerance: 0,
              explanation: 'Neighbouring diagonals are offset by 14 cells: the unit is GTGTTGACGTAACG.' },
            { q: 'How many complete copies of the unit does the sequence contain?', type: 'number', answer: 3, tolerance: 0,
              explanation: '49 bp = 3 × 14 + 7: three full copies and a partial fourth.' }
        ]
    },

    'microsatellite': {
        name: 'Microsatellite, 5-bp unit (self-comparison)',
        group: 'basic',
        description: 'AGATC repeated nine times – a short tandem repeat (STR) as used in forensics.',
        seq1: 'AGATCAGATCAGATCAGATCAGATCAGATCAGATCAGATCAGATCAGAT',
        self: true,
        params: { mode: 'runlength', minRun: 4 },
        expectedPattern: 'Many closely spaced parallel diagonals filling the plot.',
        educationalNotes: 'A short unit gives many diagonals close together. STR loci differ between people in the number of copies, which changes the length of the PCR product – the basis of DNA fingerprinting.',
        questions: [
            { q: 'How long is the repeat unit (bp)?', type: 'number', answer: 5, tolerance: 0,
              explanation: 'Neighbouring diagonals are 5 cells apart.' },
            { q: 'How many complete copies of the unit are there?', type: 'number', answer: 9, tolerance: 0,
              explanation: '9 × AGATC = 45 bp, followed by a partial copy AGAT.' }
        ]
    },

    'low-complexity': {
        name: 'Low-complexity sequence',
        group: 'basic',
        description: 'Homopolymer runs and a dinucleotide repeat produce solid blocks instead of lines.',
        seq1: 'AAAAAAAAAATTTTTTTTTTCCCCCCCCCCCATATATATAT',
        self: true,
        params: { mode: 'runlength', minRun: 3 },
        expectedPattern: 'Filled squares along the diagonal, a red block over the AT region, and dense stripes in the ATATAT region.',
        educationalNotes: 'Inside a homopolymer every position matches every other position, so the plot fills a whole square. Low-complexity regions therefore swamp real signal; database search tools (BLAST) mask them before searching for exactly this reason. Note the red block: AAAAAAAAAATTTTTTTTTT is its own reverse complement.',
        questions: [
            { q: 'Why does the poly-A region produce a filled square rather than a line?', type: 'choice',
              options: ['Every A matches every other A, so all cells in the square are matches', 'The two sequences are identical', 'The minimum diagonal length is too large'],
              answer: 0, explanation: 'Within a homopolymer all pairwise comparisons succeed – the signal is real but uninformative.' },
            { q: 'A red block covers the first 20 bases. Why?', type: 'choice',
              options: ['AAAAAAAAAATTTTTTTTTT equals its own reverse complement', 'The plot is mirrored by mistake', 'T pairs with A on the same strand'],
              answer: 0, explanation: 'The reverse complement of A₁₀T₁₀ is A₁₀T₁₀ again, so it also matches the other strand.' }
        ]
    },

    'duplication': {
        name: 'Segment duplication',
        group: 'basic',
        description: 'Seq 2 contains an extra copy of an 11-bp segment.',
        seq1: 'TGGTCGGATCCATCGTTGGCGCCCGACCCCCCCATTCCA',
        seq2: 'TGGTCGGATCCATCGTTGGCCCATCGTTGGCGCCCGACCCCCCCATTCCA',
        params: { mode: 'runlength', minRun: 4 },
        expectedPattern: 'A diagonal that shifts down after position 20 plus a short extra segment where the copy matches the original.',
        educationalNotes: 'A duplication combines two signatures: the shift of an insertion (the diagonal jumps down by the copy length) and the extra parallel piece of a repeat (both copies in Seq 2 match the single copy in Seq 1).',
        questions: [
            { q: 'How long is the duplicated segment (bp)?', type: 'number', answer: 11, tolerance: 0,
              explanation: 'Seq 2 is 11 bp longer and the copies (CCATCGTTGGC) are at Seq 2 positions 10–20 and 21–31.' },
            { q: 'Which sequence carries the extra copy?', type: 'choice', options: ['Seq 2', 'Seq 1'],
              answer: 0, explanation: 'Seq 2 is longer, and two stretches of Seq 2 match one stretch of Seq 1.' }
        ]
    },

    /* ---------------------------------------------------------- genomic */

    'internal-duplication': {
        name: 'Gene with internal tandem duplication (self-comparison)',
        group: 'genomic',
        description: 'A 185-bp gene fragment in which a 35-bp segment has been duplicated in tandem.',
        seq1: 'ATGTACAACAATACTTATTAGTCATCTTTTAGACACAATCTCCCTGCTCAGTGGTATATGGTTTTAGACACAATCTCCCTGCTCAGTGGTATATGGTTTTTGCTATAATTAGCCACCCTCATAAGTTGCACTACTTCTGCGACCCAAATGCACCCTTACCACGAAGACAGGATTGTCCGATCCTA',
        self: true,
        params: { mode: 'runlength', minRun: 7 },
        expectedPattern: 'Main diagonal plus a pair of parallel lines around positions 30–100.',
        educationalNotes: 'Internal duplications are common in protein-coding genes (repeated domains). The parallel lines are as long as the duplicated segment; their distance from the diagonal is the spacing between copies. Raise the minimum diagonal length until only the duplication survives.',
        questions: [
            { q: 'How far apart are the two copies (distance of the parallel line from the main diagonal, bp)?', type: 'number', answer: 35, tolerance: 1,
              explanation: 'The second copy starts 35 bp after the first (positions 27 and 62).' },
            { q: 'Roughly how long is the duplicated segment (bp)?', type: 'number', answer: 37, tolerance: 3,
              explanation: 'The parallel line spans about 39 cells (the copies overlap by a few bases by chance).' }
        ]
    },

    'chromosomal-inversion': {
        name: 'Chromosomal inversion',
        group: 'genomic',
        description: 'Two homologous 200-bp regions; the second part of one is inverted.',
        seq1: 'CTAGGACGGGCGCAAAGGATATATAATTCAATTAAGAATACCTTATATTATTGTACACCTACCGGTCACCAGCCAACAATGTGCGGATGGCGTTACGACTTACTGGGCCTGATCTCACCGCTTTAGATACCGCACACTGGGCAATACGAGGTAAAGCCAGTCACCCAGTGTCGATCAACAGCTAACGTAACGGTAAGAGG',
        seq2: 'CTAGGACGGGCGCAAAGGATATATAATTCAATTAAGAATACCTTATATTATTGTACACCTACCGGTCACCAGCCAACAATGTGCGGATGGCGTTACGACTTACTGGGCCTGATCTCACCGCTTTAGACCTCTTACCGTTACGTTAGCTGTTGATCGACACTGGGTGACTGGCTTTACCTCGTATTGCCCAGTGTGCGGTA',
        params: { mode: 'runlength', minRun: 6 },
        expectedPattern: 'Green diagonal over the first ~127 bp, then a red anti-diagonal to the end.',
        educationalNotes: 'Switch on "alignment blocks": the ribbon view below the plot shows the inverted block as a crossed (bow-tie) connection, the way genome browsers draw inversions. Try "Shuffle Seq 2" to see what pure noise looks like with these settings.',
        questions: [
            { q: 'At which Seq 1 position does the inverted segment start?', type: 'number', answer: 128, tolerance: 1,
              explanation: 'The green block ends at 127 and the red block runs 128–200.' },
            { q: 'How long is the inverted segment (bp)?', type: 'number', answer: 73, tolerance: 1,
              explanation: '200 − 127 = 73 bp align to the reverse complement strand.' },
            { q: 'The inverted segment aligns to…', type: 'choice',
              options: ['the reverse-complement strand of Seq 2 (red)', 'the same strand of Seq 2 (green)'],
              answer: 0, explanation: 'An inversion moves the segment onto the other strand, so it only matches the reverse complement.' }
        ]
    },

    'repeat-expansion': {
        name: 'Tandem repeat expansion',
        group: 'genomic',
        description: 'Two alleles of a locus with different numbers of copies of a 4-bp repeat.',
        seq1: 'ATCGATCGATCGAACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTAAGGCTTATGCGCAATCCGGATCGATCGATCGATCGATCGATCGATCGATCG',
        seq2: 'ATCGATCGATCGAACGTACGTACGTACGTACGTAAGGCTTATGCGCAATCCGGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG',
        params: { mode: 'runlength', minRun: 6 },
        expectedPattern: 'Two repeat blocks (striped squares) joined by a normal diagonal; the blocks are rectangular because the copy numbers differ.',
        educationalNotes: 'In the repeat region every copy matches every copy, so the block is filled with parallel stripes. A rectangle (not a square) means the two alleles have different copy numbers – the mechanism behind repeat-expansion diseases such as Huntington disease (CAG repeats).',
        questions: [
            { q: 'How long is the unit of the expanded repeat in the middle of the sequences (bp)?', type: 'number', answer: 4, tolerance: 0,
              explanation: 'Neighbouring stripes are 4 cells apart: the unit is CGTA.' },
            { q: 'Which sequence has more copies of the CGTA repeat?', type: 'choice', options: ['Seq 1', 'Seq 2'],
              answer: 0, explanation: 'The striped block is wider (Seq 1, horizontal) than it is tall (Seq 2, vertical).' },
            { q: 'How many copies of CGTA does Seq 1 contain? (±1)', type: 'number', answer: 11, tolerance: 1,
              explanation: 'The block spans 44 bp of Seq 1 = 11 × 4 bp; Seq 2 has only 5 copies.' }
        ]
    },

    'ltr-retrotransposon': {
        name: 'LTR retrotransposon insertion (self-comparison)',
        group: 'genomic',
        description: 'A transposable element flanked by two identical long terminal repeats (LTRs).',
        seq1: 'CTCACAAAATCGCACTGTCGGCGTCCCTTGGGTATTTTACGTTAGCATCAGGTGGACTAGCATGAATCTTTACTCCCAGGCGAAAACGGGTGCGTGGACAAGTTTACGTTAGCATCAGGTGCGAGCAGCAAACGAAAATTCTTGGCCTGCTTGGTGTCTCGTATTTCTC',
        self: true,
        params: { mode: 'runlength', minRun: 7 },
        expectedPattern: 'Main diagonal and one pair of short parallel lines far from it.',
        educationalNotes: 'LTR retrotransposons carry the same sequence at both ends in the same orientation. In a self-dotplot the two LTRs give a parallel line whose distance from the diagonal equals the element length minus one LTR. Annotation tools such as LTRharvest find elements exactly this way.',
        questions: [
            { q: 'How long is each LTR (bp)?', type: 'number', answer: 19, tolerance: 0,
              explanation: 'The parallel line is 19 cells long (TTTACGTTAGCATCAGGTG).' },
            { q: 'What is the distance between the starts of the two LTR copies (bp)?', type: 'number', answer: 67, tolerance: 1,
              explanation: 'The copies start at 36 and 103 – 67 bp apart, so the element is 67 + 19 = 86 bp long.' },
            { q: 'Both LTRs point in the same direction. This makes them…', type: 'choice',
              options: ['a direct repeat', 'an inverted repeat'],
              answer: 0, explanation: 'Same orientation = direct repeat = green line parallel to the diagonal. Terminal inverted repeats (DNA transposons) would give a red perpendicular line.' }
        ]
    },

    'synteny': {
        name: 'Syntenic regions from two species',
        group: 'genomic',
        description: 'Orthologous regions that share several conserved blocks in the same order.',
        seq1: 'GCGCTGATAGTCGTTGTGTCCCGACAGGCTAGGATATAAGATATCACCAGTACCCAAAACATACGTTCAGCGTGGGATCAGGCGGGCTCGCCACGTTGGCTAATCCTGGACATGTACGAGACCATGTTACATTTTGTAAATGTTCAGAAGAA',
        seq2: 'AATTTGTGTTAGAAGGTTGTGTCCCGACAGGCTAGGATATAACGAGTCACCACGTACCAATAGCAAATACGTTCAGCGTGGGATCAACGATCGGTCCTATTCATTGTGGTGGACATGTACGAGACCATGTTGACGCTCGGATTACACGGGAAAGGTGC',
        params: { mode: 'runlength', minRun: 6 },
        expectedPattern: 'Three conserved blocks lying on (almost) the same diagonal, separated by unconserved stretches.',
        educationalNotes: 'Conserved blocks in the same order and orientation are called collinear or syntenic. Between them the sequences have diverged beyond recognition. Turn on "alignment blocks" with a minimum length of 15 to list only the conserved blocks.',
        questions: [
            { q: 'With minimum block length 15, how many conserved blocks are listed?', type: 'number', answer: 3, tolerance: 0,
              explanation: 'Blocks of 27, 22 and 20 bp; everything else is shorter than 15 bp.' },
            { q: 'Are the conserved blocks collinear (same order and orientation in both sequences)?', type: 'choice',
              options: ['Yes – all green and on nearly the same diagonal', 'No – one of them is inverted'],
              answer: 0, explanation: 'All blocks are green and follow each other along one diagonal, i.e. gene order is conserved.' }
        ]
    },

    'segmental-duplication': {
        name: 'Segmental duplication',
        group: 'genomic',
        description: 'Seq 2 carries an extra copy of a 35-bp segment.',
        seq1: 'ATAGATTTGCGTTACTGTCTGCATAAGGAGTCCGGTGTAGCGAAGGATGAAGGCGACCCTAGGTAGCAACCGCCGGCTTCGGCGGTAAGGTATCACTCAGGAAGCAGACACAGAAAGACACG',
        seq2: 'ATAGATTTGCGTTACTGTCTGCATAAGGAGTCCGGTGTAGCGAAGGATGAAGGCGACCCTAGGTAGCAGGTGTAGCGAAGGATGAAGGCGACCCTAGGTAGCAACCGCCGGCTTCGGCGGTAAGGTATCACTCAGGAAGCAGACACAGAAAGACACG',
        params: { mode: 'runlength', minRun: 7 },
        expectedPattern: 'A diagonal with a downward jump, plus a parallel piece where both copies in Seq 2 match the original.',
        educationalNotes: 'The same signature as the short duplication example, at genomic scale. Segmental duplications (>1 kb, >90 % identity in real genomes) are hotspots for further rearrangement because the copies can mis-pair during recombination.',
        questions: [
            { q: 'How long is the duplicated segment (bp)?', type: 'number', answer: 35, tolerance: 1,
              explanation: 'Seq 2 is 157 − 122 = 35 bp longer than Seq 1.' },
            { q: 'Which sequence contains the duplication?', type: 'choice', options: ['Seq 2', 'Seq 1'],
              answer: 0, explanation: 'Two stretches of Seq 2 (vertical) match one stretch of Seq 1.' }
        ]
    },

    'diverged-homologs': {
        name: 'Diverged homologous sequences',
        group: 'genomic',
        description: 'Two 200-bp homologs that differ by point mutations only (no indels).',
        seq1: 'GTTAATTCTATAGCAATACGATCATATGCGGATGGGCAGTGGCCGGTAGTCACACGTCTACCGCGGTGCTCAATGACCGGGACTAAAGAGGCGAAGATTATGGTGTGTGACCCGTTATGCTCGAGTTCGGTCAGAGCGTCATTGCGAGTAGTCGATTGCTTTCTCAATCTCCGAGCGATTTAGCGTGACAGCCCCAGGGA',
        seq2: 'GTTAATAGGATAGCAATACGATAGTACGTGGATGGTCAGTGGCCGGTAGTCACACATGTTCCCCGGTGCTTAATGACCGGGACTAAAGAGGCGAAGATTATGGTGTGTAACCCGTTATGCTCGAGTTCGGTCAGAGCGTTATTGCGAGTAGCCGATTGCTTTCGCAATCTCCGGGCGATTTAGCGTGATTGCCCCAGGGA',
        params: { mode: 'window', window: 15, threshold: 11 },
        expectedPattern: 'One continuous diagonal in window mode; a diagonal broken into many pieces in minimum-diagonal-length mode.',
        educationalNotes: 'This is why the classic window/threshold dotplot exists: with a window of 15 and threshold 11 up to four mismatches per window are tolerated, and the diverged homologs still form one line. Hollow dots mark the mismatched positions. Switch to minimum diagonal length 8 to see the same pair fall apart.',
        questions: [
            { q: 'Roughly how many point mutations separate the sequences? (±3)', type: 'number', answer: 20, tolerance: 3,
              explanation: 'There are 20 mismatches along the diagonal (count the hollow dots, or the breaks in minimum-diagonal-length mode).' },
            { q: 'Which setting joins the broken diagonal into one line?', type: 'choice',
              options: ['Window mode with a threshold below the window size', 'A larger minimum diagonal length', 'Shuffling Seq 2'],
              answer: 0, explanation: 'Tolerating a few mismatches per window bridges the SNPs; a longer minimum run length does the opposite.' }
        ]
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DOTPLOT_EXAMPLES;
}
