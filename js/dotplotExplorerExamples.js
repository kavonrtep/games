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
        name: 'Gene Duplication Event',
        description: 'Two related genes showing internal duplications and rearrangements',
        seq1: 'ATGAAATTTGCATCCGGATCGATCGAAGCTTATGCGCAATCCGGATTACCGAACGTAGCTGATCGATCGATCGAAGGCTTATGCGCAATCCGGATCACGTACGTACGTAA',
        seq2: 'ATGAAATTTGCATCCGGATCGATCGAAGCTTATGCGCAATCCGGATTACCGAACGTAGCTGATCGATCGATCGAAGGCTTATGCGCAATCCGGATCACGTACGTACGTAA',
        expectedPattern: 'Perfect diagonal with potential internal repeat blocks',
        windowSize: 8,
        educationalNotes: 'Demonstrates how gene duplications appear as perfect diagonals. Internal repetitive elements create additional diagonal patterns within the main alignment block.'
    },

    'chromosomal-inversion': {
        name: 'Chromosomal Inversion',
        description: 'Genomic segments showing large-scale inversion between homologous regions',
        seq1: 'ATCGATCGATCGAAGGCTTATGCGCAATCCGGATCACGTACGTACGTAATTCGAGCTAGCTACGATCGATCGAACCTTAGGCCATGCATGCATGCAAATCGATCGATCG',
        seq2: 'ATCGATCGATCGAAGGCTTATGCGCAATCCGGACGATCGATCGATCGTAGCTAGCTCGAATTACGTACGTACGTGATCCGGATTGCGCATAAGCCTTCGATCGATCGAT',
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
        name: 'Transposable Element Insertion',
        description: 'Genomic sequences where one contains a transposable element insertion',
        seq1: 'ATCGATCGATCGAAGGCTTATGCGCAATCCGGATGCTAGCTACGATCGATCGAACCTTAAATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG',
        seq2: 'ATCGATCGATCGAAGGCTTATGCGCAATCCGGATCACGTACGTACGTACGTACGTACGTACGTGCTAGCTACGATCGATCGAACCTTAAATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG',
        expectedPattern: 'Broken diagonal with insertion creating gap in alignment',
        windowSize: 7,
        educationalNotes: 'Transposon insertions break collinearity, creating gaps in alignment blocks. The inserted element may show similarity to other genomic locations.'
    },

    'gene-conversion': {
        name: 'Gene Conversion Event',
        description: 'Paralogous genes showing evidence of gene conversion',
        seq1: 'ATGAAATTTGCATCCGGATCGATCGAAGCTTATGCGCAATCCGGATGCTAGCTACGATCGATCGAACCTTACGTACGTACGTACGTACGTACGTAAATCGATCGATCG',
        seq2: 'ATGAAATTTGCATCCGGATCGATCGAAGCTTATGCGCAATCCGGATACGTACGTACGTACGTACGTACGTGCTAGCTACGATCGATCGAACCTTAAATCGATCGATCG',
        expectedPattern: 'High similarity blocks with localized regions of perfect identity',
        windowSize: 8,
        educationalNotes: 'Gene conversion creates patches of perfect identity between otherwise divergent paralogs. Shows as perfect diagonal segments within larger alignment blocks.'
    },

    'syntenic-regions': {
        name: 'Syntenic Genomic Regions',
        description: 'Orthologous genomic regions showing conserved gene order',
        seq1: 'ATGAAATTTGCATCCGGATCGATCGAAGCTTATGCGCAATCCGGATCACGTACGTACGTAAGGCTTATGCGCAATCCGGAGCTAGCTACGATCGATCGAACCTTAAAT',
        seq2: 'ATGAAATTTGCATCCGGATCGATCGAAGCTTATGCGCAATCCGGATCACGTACGTACGTAAGGCTTATGCGCAATCCGGAGCTAGCTACGATCGATCGAACCTTAAAT',
        expectedPattern: 'Strong diagonal with conserved blocks representing syntenic genes',
        windowSize: 9,
        educationalNotes: 'Syntenic regions show as strong diagonal alignment blocks. Conserved gene order between species creates collinear dotplot patterns in comparative genomics.'
    },

    'segmental-duplication': {
        name: 'Segmental Duplication',
        description: 'Large DNA segments with high sequence identity at different genomic locations',
        seq1: 'ATCGATCGATCGAAGGCTTATGCGCAATCCGGATCACGTACGTACGTACGTACGTACGTAAGGCTTATGCGCAATCCGGATCGATCGATCGATCGATCGATCGATCG',
        seq2: 'GCTAGCTACGATCGATCGAACCTTAAATCGATCGATCGATCGAAGGCTTATGCGCAATCCGGATCACGTACGTACGTACGTACGTACGTAAGGCTTATGCGCAATCCG',
        expectedPattern: 'Offset diagonal blocks showing duplicated segments',
        windowSize: 8,
        educationalNotes: 'Segmental duplications appear as diagonal blocks at different positions. These >90% identical regions >1kb long are hotspots for genomic instability.'
    },

    'evolutionary-divergence': {
        name: 'Evolutionary Divergence',
        description: 'Homologous sequences showing accumulated mutations over evolutionary time',
        seq1: 'ATGAAATTTGCATCCGGATCGATCGAAGCTTATGCGCAATCCGGATCACGTACGTACGTAAGGCTTATGCGCAATCCGGAGCTAGCTACGATCGATCGAACCTTAAAT',
        seq2: 'ATGAAATTTGCATCCGGATCGAGCGAAACTTATGCGCAATCCGGATCACATACATACGTAAGGCTTATACGCAATCCGGAGCTAGCTACGATCAATCAAACCTTAAAT',
        expectedPattern: 'Fragmented diagonal showing conserved blocks separated by divergent regions',
        windowSize: 6,
        educationalNotes: 'Evolutionary divergence creates fragmented alignment patterns. Highly conserved functional elements maintain strong diagonal blocks despite overall divergence.'
    },

    'recombination-breakpoint': {
        name: 'Recombination Breakpoint',
        description: 'Sequences showing evidence of historical recombination events',
        seq1: 'ATCGATCGATCGAAGGCTTATGCGCAATCCGGATCACGTACGTACGTAAGGCTTATGCGCAATCCGGAGCTAGCTACGATCGATCGAACCTTAAAT',
        seq2: 'ATCGATCGATCGAAGGCTTATGCGCAATCCGGAGCTAGCTACGATCGATCGAACCTTAAATCACGTACGTACGTAAGGCTTATGCGCAATCCGGA',
        expectedPattern: 'Diagonal blocks that switch positions, indicating recombination breakpoint',
        windowSize: 7,
        educationalNotes: 'Recombination breakpoints create crossing diagonal patterns. The switch from one diagonal track to another indicates historical crossing over events.'
    }

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