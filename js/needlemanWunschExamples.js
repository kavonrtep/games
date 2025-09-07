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
        seq1: 'ATCGATCG',
        seq2: 'ATCGATCG', 
        sequenceType: 'dna',
        expectedPattern: 'Perfect diagonal alignment with no gaps, maximum score',
        scoringRecommendation: 'Default parameters work well: Match=2, Mismatch=-1, Gap=-1',
        educationalNotes: 'Demonstrates optimal case where global alignment produces perfect match with no insertions, deletions, or substitutions.'
    },
    
    'similar-dna': {
        name: 'Similar DNA with SNPs',
        description: 'DNA sequences with single nucleotide polymorphisms',
        seq1: 'ATCGATCGAA',
        seq2: 'ATGGATCGTA',
        sequenceType: 'dna',
        expectedPattern: 'Mostly diagonal with some mismatches, no gaps needed',
        scoringRecommendation: 'Try Match=2, Mismatch=-1, Gap=-2 to discourage gaps',
        educationalNotes: 'Shows how global alignment handles point mutations. Mismatches are preferred over gaps when sequences are similar length.'
    },
    
    'indel-example': {
        name: 'Insertion/Deletion Example',
        description: 'One sequence has an insertion relative to the other',
        seq1: 'ATCGCGATCG',
        seq2: 'ATCGATCG',
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
        name: 'RNA Secondary Structure',
        description: 'RNA sequences that might form base pairs',
        seq1: 'AUCGAUCG',
        seq2: 'CGAUCGAU',
        sequenceType: 'rna',
        expectedPattern: 'Alignment showing potential complementarity',
        scoringRecommendation: 'Standard RNA scoring: Match=2, Mismatch=-1, Gap=-1',
        educationalNotes: 'While this is global alignment, notice how these sequences have complementary regions that could form RNA secondary structures.'
    },
    
    
    'tandem-repeats': {
        name: 'Tandem Repeat Variations',
        description: 'Sequences with different numbers of tandem repeats',
        seq1: 'ATGATGATG',
        seq2: 'ATGATG',
        sequenceType: 'dna',
        expectedPattern: 'Gaps align extra repeat units',
        scoringRecommendation: 'Gap penalty -1 shows repeat structure clearly',
        educationalNotes: 'Common in genomics: tandem repeats of different lengths require gaps to align globally. Shows microsatellite variation.'
    },
    
    'palindromic-sequences': {
        name: 'Palindromic DNA Sequences',
        description: 'DNA sequences with palindromic (reverse complement) regions',
        seq1: 'ATCGGAATTCCGAT',
        seq2: 'GAATTCCGATCGGA',
        sequenceType: 'dna',
        expectedPattern: 'Some regions align well due to shared palindromes',
        scoringRecommendation: 'Standard scoring shows shared motifs clearly',
        educationalNotes: 'Palindromic sequences are important for restriction enzyme recognition sites and can form hairpin structures.'
    },
    
    'codon-variations': {
        name: 'Coding Sequence Variations',
        description: 'DNA sequences representing similar genes with codon usage differences',
        seq1: 'ATGAAATTTGCA',
        seq2: 'ATGAAGTTTGCT',
        sequenceType: 'dna',
        expectedPattern: 'High similarity with few silent substitutions',
        scoringRecommendation: 'Match=2, Mismatch=-1 shows conservation pattern',
        educationalNotes: 'Demonstrates synonymous codon usage differences that do not change amino acid sequence but affect DNA alignment.'
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