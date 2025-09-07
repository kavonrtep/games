/**
 * DOTPLOT EXPLORER EXAMPLES CONFIGURATION
 * =======================================
 * 
 * This file contains all educational examples for the Dotplot Explorer genomic sequence analysis.
 * These examples are designed for longer sequences (up to 200 bases) to demonstrate genomic features.
 * 
 * HOW TO ADD A NEW EXAMPLE:
 * 1. Copy the template at the bottom of this file
 * 2. Give it a unique key (use lowercase with hyphens)  
 * 3. Fill in all the fields with your sequences and descriptions
 * 4. Save the file - changes will be immediately available
 * 
 * FIELD DESCRIPTIONS:
 * - name: Display name shown in the dropdown menu
 * - description: Brief explanation shown when example is selected  
 * - seq1, seq2: DNA sequences (50-200 chars for genomic analysis)
 * - expectedPattern: What users should see in the dotplot and alignment blocks
 * - windowSize: Recommended window size for optimal visualization (optional)
 * - educationalNotes: Deeper biological/computational explanation
 */

const DOTPLOT_EXPLORER_EXAMPLES = {
    'gene-duplications': {
        name: 'Self-Comparison (Duplication Event)',
        description: 'Two related genes showing internal duplications and rearrangements',
        seq1: 'ATGTACAACAATACTTATTAGTCATCTTTTAGACACAATCTCCCTGCTCAGTGGTATATGGTTTTAGACACAATCTCCCTGCTCAGTGGTATATGGTTTTTGCTATAATTAGCCACCCTCATAAGTTGCACTACTTCTGCGACCCAAATGCACCCTTACCACGAAGACAGGATTGTCCGATCCTA',
        seq2: 'ATGTACAACAATACTTATTAGTCATCTTTTAGACACAATCTCCCTGCTCAGTGGTATATGGTTTTAGACACAATCTCCCTGCTCAGTGGTATATGGTTTTTGCTATAATTAGCCACCCTCATAAGTTGCACTACTTCTGCGACCCAAATGCACCCTTACCACGAAGACAGGATTGTCCGATCCTA',
        expectedPattern: 'Perfect diagonal with potential internal repeat blocks',
        windowSize: 8,
        educationalNotes: 'Demonstrates how gene duplications appear as perfect diagonals. Internal repetitive elements create additional diagonal patterns within the main alignment block.'
    },

    'chromosomal-inversion': {
        name: 'Chromosomal Inversion',
        description: 'Genomic segments showing large-scale inversion between homologous regions',
        seq1: 'CTAGGACGGGCGCAAAGGATATATAATTCAATTAAGAATACCTTATATTATTGTACACCTACCGGTCACCAGCCAACAATGTGCGGATGGCGTTACGACTTACTGGGCCTGATCTCACCGCTTTAGATACCGCACACTGGGCAATACGAGGTAAAGCCAGTCACCCAGTGTCGATCAACAGCTAACGTAACGGTAAGAGG',
        seq2: 'CTAGGACGGGCGCAAAGGATATATAATTCAATTAAGAATACCTTATATTATTGTACACCTACCGGTCACCAGCCAACAATGTGCGGATGGCGTTACGACTTACTGGGCCTGATCTCACCGCTTTAGACCTCTTACCGTTACGTTAGCTGTTGATCGACACTGGGTGACTGGCTTTACCTCGTATTGCCCAGTGTGCGGTA',
        expectedPattern: 'Diagonal segments with anti-diagonal sections showing inversion',
        windowSize: 6,
        educationalNotes: 'Large inversions create anti-diagonal patterns in dotplots. Forward alignment blocks flanking a reverse alignment block indicate chromosomal inversion events.'
    },

    'tandem-repeat-expansion': {
        name: 'Tandem Repeat Expansion',
        description: 'Sequences with different numbers of tandem repeat units',
        seq1: 'ATCGATCGATCGAACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTAAGGCTTATGCGCAATCCGGATCGATCGATCGATCGATCGATCGATCGATCG',
        seq2: 'ATCGATCGATCGAACGTACGTACGTACGTACGTAAGGCTTATGCGCAATCCGGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG',
        expectedPattern: 'Multiple parallel diagonals from repeat units, different lengths',
        windowSize: 5,
        educationalNotes: 'Tandem repeats create multiple parallel diagonal lines. Expansion/contraction events show as alignment blocks of different lengths between homologous regions.'
    },

    'transposon-insertion': {
        name: 'Self-Comparison (LTR-RT insertion)',
        description: 'Genomic sequences where one contains a transposable element insertion',
        seq1: 'CTCACAAAATCGCACTGTCGGCGTCCCTTGGGTATTTTACGTTAGCATCAGGTGGACTAGCATGAATCTTTACTCCCAGGCGAAAACGGGTGCGTGGACAAGTTTACGTTAGCATCAGGTGCGAGCAGCAAACGAAAATTCTTGGCCTGCTTGGTGTCTCGTATTTCTC',
        seq2: 'CTCACAAAATCGCACTGTCGGCGTCCCTTGGGTATTTTACGTTAGCATCAGGTGGACTAGCATGAATCTTTACTCCCAGGCGAAAACGGGTGCGTGGACAAGTTTACGTTAGCATCAGGTGCGAGCAGCAAACGAAAATTCTTGGCCTGCTTGGTGTCTCGTATTTCTC',
        expectedPattern: 'Broken diagonal with insertion creating gap in alignment',
        windowSize: 7,
        educationalNotes: ''
    },

    'syntenic-regions': {
        name: 'Syntenic Genomic Regions',
        description: 'Orthologous genomic regions showing conserved gene order',
        seq1: 'GCGCTGATAGTCGTTGTGTCCCGACAGGCTAGGATATAAGATATCACCAGTACCCAAAACATACGTTCAGCGTGGGATCAGGCGGGCTCGCCACGTTGGCTAATCCTGGACATGTACGAGACCATGTTACATTTTGTAAATGTTCAGAAGAA',
        seq2: 'AATTTGTGTTAGAAGGTTGTGTCCCGACAGGCTAGGATATAACGAGTCACCACGTACCAATAGCAAATACGTTCAGCGTGGGATCAACGATCGGTCCTATTCATTGTGGTGGACATGTACGAGACCATGTTGACGCTCGGATTACACGGGAAAGGTGC',
        expectedPattern: 'Strong diagonal with conserved blocks representing syntenic genes',
        windowSize: 9,
        educationalNotes: 'Syntenic regions show as strong diagonal alignment blocks. Conserved gene order between species creates collinear dotplot patterns in comparative genomics.'
    },

    'segmental-duplication': {
        name: 'Segmental Duplication',
        description: 'Large DNA segments with high sequence identity at different genomic locations',
        seq1: 'ATAGATTTGCGTTACTGTCTGCATAAGGAGTCCGGTGTAGCGAAGGATGAAGGCGACCCTAGGTAGCAACCGCCGGCTTCGGCGGTAAGGTATCACTCAGGAAGCAGACACAGAAAGACACG',
        seq2: 'ATAGATTTGCGTTACTGTCTGCATAAGGAGTCCGGTGTAGCGAAGGATGAAGGCGACCCTAGGTAGCAGGTGTAGCGAAGGATGAAGGCGACCCTAGGTAGCAACCGCCGGCTTCGGCGGTAAGGTATCACTCAGGAAGCAGACACAGAAAGACACG',
        expectedPattern: 'Offset diagonal blocks showing duplicated segments',
        windowSize: 8,
        educationalNotes: 'Segmental duplications appear as diagonal blocks at different positions. These >90% identical regions >1kb long are hotspots for genomic instability.'
    },

    'similar-sequences': {
        name: 'Similar Genomic Sequences',
        description: 'not  completely identical sequences with high similarity',
        seq1: 'GTTAATTCTATAGCAATACGATCATATGCGGATGGGCAGTGGCCGGTAGTCACACGTCTACCGCGGTGCTCAATGACCGGGACTAAAGAGGCGAAGATTATGGTGTGTGACCCGTTATGCTCGAGTTCGGTCAGAGCGTCATTGCGAGTAGTCGATTGCTTTCTCAATCTCCGAGCGATTTAGCGTGACAGCCCCAGGGA',
        seq2: 'GTTAATAGGATAGCAATACGATAGTACGTGGATGGTCAGTGGCCGGTAGTCACACATGTTCCCCGGTGCTTAATGACCGGGACTAAAGAGGCGAAGATTATGGTGTGTAACCCGTTATGCTCGAGTTCGGTCAGAGCGTTATTGCGAGTAGCCGATTGCTTTCGCAATCTCCGGGCGATTTAGCGTGATTGCCCCAGGGA',
        expectedPattern: 'Offset diagonal blocks showing duplicated segments',
        windowSize: 8,
        educationalNotes: 'Mutation no indels but SNPs'
    },



    // Easy to add new examples - just follow this template:
    /*
    'your-example-key': {
        name: 'Your Example Name',
        description: 'Brief description of what genomic feature this demonstrates',
        seq1: 'LONGER_DNA_SEQUENCE_1_UP_TO_200_BASES',
        seq2: 'LONGER_DNA_SEQUENCE_2_UP_TO_200_BASES',
        expectedPattern: 'What pattern users should expect to see in dotplot and alignment blocks',
        windowSize: 8, // optional recommended window size
        educationalNotes: 'Deeper explanation of the genomic feature and its biological significance'
    },
    */
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DOTPLOT_EXPLORER_EXAMPLES;
}