/**
 * SMITH-WATERMAN EXAMPLES CONFIGURATION
 * ====================================
 * 
 * This file contains all educational examples for the Smith-Waterman local alignment demonstration.
 * To add or modify examples, simply edit this file - no other code changes needed!
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
 * - seq1, seq2: DNA/RNA/Protein sequences (max 25 chars for interactive editing)
 * - sequenceType: 'dna', 'rna', or 'protein'
 * - expectedPattern: What users should see in the local alignment(s)
 * - scoringRecommendation: Suggested scoring parameters to try
 * - educationalNotes: Deeper biological/computational explanation
 */

const SMITH_WATERMAN_EXAMPLES = {
    
    'core-motif': {
        name: 'Shared Core Motif',
        description: 'Two unrelated sequences share a short conserved motif',
        seq1: 'GAGCGTCTGTTGACATCGTACGATTGCAACGATT',
        seq2: 'CGTCTTGGCTAATCTTGACATCGTACGATGGTCGGTT',
        sequenceType: 'dna',
        expectedPattern: 'Local alignment around TTGACATCGTACGAT',
        scoringRecommendation: 'Match=2, Mismatch=-3, Gap=-2',
        educationalNotes: 'Shows how Smith-Waterman identifies a short conserved block within otherwise unrelated sequences.'
    },
    
    'sequence-overlap': {
        name: 'Overlaping sequences',
        description: 'DNA sequences with overlap',
        seq1: 'GAGCGTCTGGCGTCTTGGCTAATC',
        seq2: 'GCGTCTTGGCTAATCCCCCTACAT',
        sequenceType: 'dna',
        expectedPattern: 'Local alignment around AAGGCTAAC region',
        scoringRecommendation: 'Standard DNA scoring to highlight local similarity',
        educationalNotes: 'Models gene comparison where only specific exons are conserved between paralogs or orthologs.'
    },
    
    'te-insertion': {
        name: 'Sequence Insertion',
        description: 'Identical sequences with an insertion in one',
        seq1: 'GGCCAGTGGTCGGTTGCTACACCCCTGCCGCAACGTTGAAGGTCCCGG',
        seq2: 'GGCCAGTGGTCGGTTGAACGTTGAAGGTCCCGG',
        sequenceType: 'dna',
        expectedPattern: 'two alignments flanking the insertion',
        scoringRecommendation: 'Try Match=3, Mismatch=-2 to emphasize motif',
        educationalNotes: 'increase the gap penalty and mismatch penalty to see how it affects the alignment'
    },
    
    
    'repeat': {
        name: 'Repetitive motifs',
        description: 'Repeated sequence motifs with variations',
        seq1: 'GAGCGTCTGGCGTCTTGGCTAAT',
        seq2: 'GTGCGTCTGGCCTCTTGGCTAATGAGCGTCTGGCCTCTTGGCTAAT',
        sequenceType: 'dna',
        expectedPattern: 'Local alignment around TTGCCAA region',
        scoringRecommendation: 'Default parameters show clear local similarity',
        educationalNotes: 'Common in comparative genomics: genes may be similar only in coding regions while differing in regulatory sequences.'
    },

    'partialy-similar': {
        name: 'Sequence with Partial Similarity on 5\' End',
        description: 'Sequences sharing conserved exon regions but different introns',
        seq1: 'CAAGGGCGAGTATTGAACCAGGTGACACCCGTTATACTCCA',
        seq2: 'CAAGGGCGAGTATTGAACCAGGTTGTTATAAACAATCAGTG',
        sequenceType: 'dna',
        expectedPattern: 'Local alignment around conserved AAGGCTAAC exon',
        scoringRecommendation: 'Standard DNA scoring highlights conserved coding region',
        educationalNotes: 'Common in gene analysis: exons are conserved while introns diverge, perfect for local alignment detection.'
    },
    
    'unrelated-sequences': {
        name: 'Unrelated Sequences',
        description: 'Unrelated DNA sequences with low similarity',
        seq1: 'GAAGTTATGGAGCATAATAACATGTGGATGGCCAGTGGTCGGTTGCTACA',
        seq2: 'CCCTGCCGCGGTCCCGGATTAGACTGGCTGGATCTATGCCGTGACACCCG',
        sequenceType: 'dna',
        expectedPattern: 'Local alignment around CATGCATGCAT repeat',
        scoringRecommendation: 'Match=2, Gap=-1 to detect repeat elements clearly',
        educationalNotes: 'Transposable elements leave similar sequence signatures. Local alignment can identify these remnants in different genomic contexts.'
    }

    // Easy to add new examples - just follow this template:
    /*
    'your-example-key': {
        name: 'Your Example Name',
        description: 'Brief description of what this example demonstrates',
        seq1: 'SEQUENCE1',
        seq2: 'SEQUENCE2',
        sequenceType: 'dna', // or 'rna' or 'protein'
        expectedPattern: 'What pattern users should expect to see',
        scoringRecommendation: 'Suggested scoring parameters',
        educationalNotes: 'Deeper explanation of the biological/computational significance'
    },
    */
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SMITH_WATERMAN_EXAMPLES;
}