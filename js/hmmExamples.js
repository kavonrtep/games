/**
 * HMM EXPLORER – EXAMPLES
 * =======================
 * Model presets for part 1, sequence pairs for the pair HMM (part 2) and
 * alignments for the profile HMM (part 3). Real sequences are fragments of
 * the UniProt entries used in msaExamples.js.
 */
const HMM_MODELS = {
    cpg: {
        name: 'CpG islands in a genome',
        story: 'Most of a vertebrate genome is AT-rich and poor in the dinucleotide CG. Near many promoters there are <em>CpG islands</em>: stretches of a few hundred bases rich in C and G. Reading the sequence, we cannot see where an island starts – the state (island or not) is <strong>hidden</strong>; only the bases are observed.',
        alphabet: 'ACGT',
        states: [
            { key: 'g', name: 'genome', color: '#64748b', emit: { A: 0.30, C: 0.20, G: 0.20, T: 0.30 } },
            { key: 'I', name: 'CpG island', color: '#d97706', emit: { A: 0.10, C: 0.40, G: 0.40, T: 0.10 } }
        ],
        start: [0.7, 0.3],
        trans: [[0.95, 0.05], [0.07, 0.93]],
        length: 60,
        note: 'Real CpG islands are hundreds of bases long and the real model (Durbin et al., ch. 3) uses dinucleotide statistics; the proportions here are shrunk so the whole sequence fits on screen.'
    },
    casino: {
        name: 'The dishonest casino',
        story: 'A casino mostly uses a fair die but now and then switches to a loaded one that shows a six half of the time. We only see the throws; which die was used for each throw is <strong>hidden</strong>. (The classic example of Durbin et al., 1998.)',
        alphabet: '123456',
        states: [
            { key: 'F', name: 'fair die', color: '#2563eb', emit: { 1: 1 / 6, 2: 1 / 6, 3: 1 / 6, 4: 1 / 6, 5: 1 / 6, 6: 1 / 6 } },
            { key: 'L', name: 'loaded die', color: '#dc2626', emit: { 1: 0.1, 2: 0.1, 3: 0.1, 4: 0.1, 5: 0.1, 6: 0.5 } }
        ],
        start: [0.67, 0.33],
        trans: [[0.95, 0.05], [0.10, 0.90]],
        length: 50,
        note: 'Durbin et al. use exactly these probabilities.'
    }
};

// Pair HMM examples: x = Sequence 1 (horizontal), y = Sequence 2 (vertical)
const HMM_PAIRS = {
    'dna-close': {
        name: 'DNA: similar pair with a small deletion',
        type: 'DNA', x: 'ACGTTGACCTGAAGTCCGATGCATTG', y: 'ACGTTGACGTGAAGCCGATGCATAG',
        params: { delta: 0.05, epsilon: 0.4, tau: 0.02, pid: 0.85 },
        note: 'Most of the alignment is certain; look at the posterior around the deletion.'
    },
    'dna-repeat': {
        name: 'DNA: deletion inside a CA repeat',
        type: 'DNA', x: 'GATTCACACACACAGGTC', y: 'GATTCACACACAGGTC',
        params: { delta: 0.05, epsilon: 0.5, tau: 0.02, pid: 0.9 },
        note: 'Two bases (one CA unit) are missing from Sequence 2, but which CA? Every placement gives the same score, so Viterbi picks one arbitrarily. The posterior shows the uncertainty.'
    },
    'dna-far': {
        name: 'DNA: divergent pair',
        type: 'DNA', x: 'TGCATGCTAGCTAGGCTAACGTTA', y: 'TGAATCCTTGCAAGCTATCGATA',
        params: { delta: 0.08, epsilon: 0.4, tau: 0.02, pid: 0.7 },
        note: 'Barely related sequences: many alignments are nearly as good as the best one, and the best one carries a tiny share of the total probability.'
    },
    'globin-ortholog': {
        name: 'Protein: Hb α human vs mouse (N-terminal 40 aa)',
        type: 'PROTEIN', x: 'MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTT', y: 'MVLSGEDKSNIKAAWGKIGGHGAEYGAEALERMFASFPTT',
        params: { delta: 0.02, epsilon: 0.4, tau: 0.02 },
        note: 'Orthologs (UniProt P69905, P01942): the alignment is unambiguous everywhere.'
    },
    'globin-paralog': {
        name: 'Protein: Hb α vs Hb β, human (N-terminal 40 aa)',
        type: 'PROTEIN', x: 'MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTT', y: 'MVHLTPEEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQ',
        params: { delta: 0.02, epsilon: 0.4, tau: 0.02 },
        note: 'Paralogs (P69905, P68871), ~43 % identical: the conserved WGKV block is certain, the region with the α/β indel is not.'
    },
    'globin-myoglobin': {
        name: 'Protein: Hb α vs myoglobin, human (N-terminal 40 aa)',
        type: 'PROTEIN', x: 'MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTT', y: 'MGLSDGEWQLVLNVWGKVEADIPGHGQEVLIRLFKGHPET',
        params: { delta: 0.02, epsilon: 0.4, tau: 0.02 },
        note: 'Distant homologs (P69905, P02144), ~25 % identical: large parts of the alignment are uncertain.'
    }
};

// Profile HMM examples. `rows` are aligned; `align` = unaligned sequences to align progressively at load time.
const HMM_PROFILES = {
    'toy-dna': {
        name: 'Toy DNA alignment (Krogh 1998)',
        type: 'DNA',
        names: ['seq1', 'seq2', 'seq3', 'seq4', 'seq5'],
        rows: ['ACA---ATG', 'TCAACTATC', 'ACAC--AGC', 'AGA---ATC', 'ACCG--ATC'],
        query: 'TCAACTATCACACAGC',
        queries: { member: 'ACACATC', insertion: 'ACAGGGCATC', deletion: 'ACATC' },
        note: 'The textbook example of A. Krogh (1998). Columns 5 and 6 are mostly gaps and become insert columns. Column 4 has residues in 3 of 5 sequences, so the 50 % rule makes it a match state; Krogh treats columns 4–6 as one insert region – raise the threshold to 70 % to get his six-node model. Small enough to check every number by hand.',
    },
    'peptides': {
        name: 'Protein: GxGxxG nucleotide-binding motif (synthetic)',
        type: 'PROTEIN',
        align: 'peptides',
        queries: { member: 'MKVAILGAGGVGKALAVQ', insertion: 'MKVAILGAGWSTGVGKALAVQ', deletion: 'MKVAILGAGKALAVQ' },
        note: 'The six peptides of the MSA Workbench example, aligned progressively. The glycines of the motif dominate the model.'
    },
    'family': {
        name: 'Protein: synthetic domain family (10 members, ~35 % identical)',
        type: 'PROTEIN',
        synthetic: true,
        emitPseudo: 2,
        note: 'A generated family: every position has its own residue preferences (invariant, conservative or variable) and three loops accept insertions. Members share the pattern but only about a third of their residues. New random family with ⟳. This is the family used for the database search.'
    },
    'globins': {
        name: 'Globins: Hb α, Hb β, myoglobin, neuroglobin, human and mouse',
        type: 'PROTEIN',
        align: 'globins',
        queries: { member: 'MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSHGSAQVKGHGKKVADALTNAVAHVDDMPNALSALSDLHAHKLRVDPVNFKLLSHCLLVTLAAHLPAEFTPAVHASLDKFLASVSTVLTSKYR' },
        note: 'Real sequences (exercise 3.5), aligned progressively. With only eight sequences, four of them close orthologs, the model is still very specific; real Pfam globin models are built from hundreds of sequences with sequence weighting.'
    }
};
