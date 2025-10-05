/**
 * NEEDLEMAN-WUNSCH EXAMPLES CONFIGURATION
 * ======================================
 * 
 * This file contains all educational examples for the Needleman-Wunsch global alignment demonstration.
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
 * - seq1, seq2: DNA/RNA/Protein sequences (max 20 chars for interactive editing)
 * - sequenceType: 'dna', 'rna', or 'protein'
 * - expectedPattern: What users should see in the global alignment
 * - scoringRecommendation: Suggested scoring parameters to try
 * - educationalNotes: Deeper biological/computational explanation
 */

const NEEDLEMAN_WUNSCH_EXAMPLES = {
    'identical-dna': {
        name: 'Identical DNA Sequences',
        description: 'Perfect match between two identical DNA sequences',
        seq1: 'ATCGATGCT',
        seq2: 'ATCGATGCT',
        sequenceType: 'dna',
        expectedPattern: 'Perfect diagonal alignment with no gaps, maximum score',
        scoringRecommendation: 'Default parameters work well: Match=2, Mismatch=-1, Gap=-1',
        educationalNotes: 'Demonstrates optimal case where global alignment produces perfect match with no insertions, deletions, or substitutions.'
    },
    
    'similar-dna': {
        name: 'Similar DNA with SNPs',
        description: 'DNA sequences with single nucleotide polymorphisms',
        seq1: 'ATCGATCGAATCGT',
        seq2: 'ATGGATCGTATAGT',
        sequenceType: 'dna',
        expectedPattern: 'Mostly diagonal with some mismatches, no gaps needed',
        scoringRecommendation: 'Try Match=2, Mismatch=-1, Gap=-2 to discourage gaps',
        educationalNotes: 'Shows how global alignment handles point mutations. Mismatches are preferred over gaps when sequences are similar length.'
    },
    
    'indel-example': {
        name: 'Insertion/Deletion Example',
        description: 'One sequence has an insertion relative to the other',
        seq1: 'ATCGCGTATGCAACG',
        seq2: 'ATCGATGCAACG',
        sequenceType: 'dna',
        expectedPattern: 'Alignment with gap in shorter sequence',
        scoringRecommendation: 'Gap penalty -1 to see clear indel, try -2 to see effect',
        educationalNotes: 'Demonstrates how global alignment handles insertions/deletions. The algorithm chooses gaps over multiple mismatches.'
    },
    
    
    'length-difference': {
        name: 'Different Length Sequences',
        description: 'Sequences of significantly different lengths',
        seq1: 'ATCGATCGATCG',
        seq2: 'ATCGAA',
        sequenceType: 'dna',
        expectedPattern: 'Multiple gaps needed to align globally',
        scoringRecommendation: 'Try different gap penalties: -1, -2, -3 to see effect',
        educationalNotes: 'Global alignment forces end-to-end alignment even with large length differences, requiring many gaps.'
    },
    
    'rna-example': {
        name: 'Unrelated DNA Sequences',
        description: 'Two different DNA sequences with low similarity',
        seq1: 'GCTAGCTAGCTATGCG',
        seq2: 'ACATAAGGTACCTAGAG',
        sequenceType: 'DNA',
        expectedPattern: 'Alignment showing potential complementarity',
        scoringRecommendation: 'Standard scoring: Match=2, Mismatch=-1, Gap=-1',
        educationalNotes: 'Two unrelated sequences may still show some local similarity or complementarity, but overall low alignment score.'
    },


    'tandem-repeats': {
        name: 'Tandem Repeat Variations',
        description: 'Sequences with different numbers of tandem repeats',
        seq1: 'GCTAGCTGCTAGCTGCTAGCT',
        seq2: 'TAGCTGCTAGCTGCTAGCTGCTAG',
        sequenceType: 'dna',
        expectedPattern: 'Gaps align extra repeat units',
        scoringRecommendation: 'Gap penalty -1 shows repeat structure clearly',
        educationalNotes: 'Common in genomics: tandem repeats of different lengths require gaps to align globally. Shows microsatellite variation.'
    },
    
    'partialy-similar-sequences': {
        name: 'Partialy Similar Sequences',
        description: 'DNA sequences with palindromic (reverse complement) regions',
        seq1: 'TATTGAACCAGGTGACACCCGTTATA',
        seq2: 'TATTGAACCAGGTTGTTATAAACAAT',
        sequenceType: 'dna',
        expectedPattern: 'Some regions align well',
        scoringRecommendation: 'Standard scoring shows shared motifs clearly',
        educationalNotes: ''
    },
    
    'small-inversion': {
        name: 'Conserved region',
        description: 'Short conserved motif with flanking divergent sequences',
        seq1: 'GAGGTCGCCGTATGCAGACGCTCGGAT',
        seq2: 'TGAGCGCCGTATGCAGCGTTACCCCA',
        sequenceType: 'dna',
        expectedPattern: 'Mostly diagonal with mismatches in inverted region',
        scoringRecommendation: 'Match=2, Mismatch=-1, Gap=-1',
        educationalNotes: 'Shows how inversions are represented as mismatches since global alignment cannot flip orientation.'
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
    module.exports = NEEDLEMAN_WUNSCH_EXAMPLES;
}