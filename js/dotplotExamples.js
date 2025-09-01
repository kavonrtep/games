/**
 * DNA DOTPLOT EXAMPLES CONFIGURATION
 * ===================================
 * 
 * This file contains all educational examples for the DNA dotplot demonstration.
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
 * - seq1, seq2: DNA sequences (A, T, G, C only, max 50 bases)
 * - expectedPattern: What users should see in the dotplot
 * - windowSizeRecommendation: Suggested window sizes to try
 * - educationalNotes: Deeper biological/computational explanation
 */

const DOTPLOT_EXAMPLES = {
    'self-comparison': {
        name: 'Self-Comparison (Identical Sequences)',
        description: 'Both sequences are identical - shows perfect diagonal',
        seq1: 'AGCTTAGCAGCTTGACGTAACGTAGC',
        seq2: 'AGCTTAGCAGCTTGACGTAACGTAGC',
        expectedPattern: 'Perfect diagonal line from corner to corner',
        windowSizeRecommendation: 'Try window sizes 1-3 to see how sensitivity changes',
        educationalNotes: 'Perfect identity creates a single diagonal line. This is the baseline for comparison with other patterns.'
    },
    
    'direct-repeat': {
        name: 'Direct Repeat',
        description: 'Sequence with internal direct repeats',
        seq1: 'GACTAGCTTGAAC',
        seq2: 'GACTAGCTTGAACGACTAGCTTGAAC',
        expectedPattern: 'Multiple parallel diagonal lines',
        windowSizeRecommendation: 'Use window size 3-5 to see clear repeat patterns',
        educationalNotes: 'Shows how tandem repeats appear as parallel diagonals. Common in genomics for gene duplications and repeat elements.'
    },
    
    'inverted-repeat': {
        name: 'Inverted Repeat (Palindrome)',
        description: 'Sequence compared to its reverse complement',
        seq1: 'AGCTTAGCAGCTTGAC',
        seq2: 'GTCAAGCTGCTAAGCT',
        expectedPattern: 'Anti-diagonal pattern (reverse complement matches)',
        windowSizeRecommendation: 'Window size 2-4 works well to see palindromic structure',
        educationalNotes: 'Red anti-diagonal shows reverse complement matches. Important for finding restriction sites and hairpin structures.'
    },
    
    'mutations': {
        name: 'Similar Sequences with Mutations',
        description: 'Similar sequences with mutations every 5-6 bases',
        seq1: 'AGCTTAGCAGCTTGACGTAACG',
        seq2: 'AGCTGAGCATCTTGCCGTAACG',
        expectedPattern: 'Broken diagonal with gaps at mutation sites',
        windowSizeRecommendation: 'Try window size 1 to see individual mutations, 3-4 to see conservation',
        educationalNotes: 'Demonstrates sequence evolution. Gaps in diagonal correspond to mutation sites. Higher window sizes filter out single mutations.'
    },
    
    'inversion-deletion': {
        name: 'Sequence with Inversion/Deletion',
        description: 'One sequence has inversion and deletion',
        seq1: 'AGCTTAGCAGCTTGACGTAACG',
        seq2: 'AGCTTAGCACGTGTTGACGTAACG',
        expectedPattern: 'Diagonal with shifted segments',
        windowSizeRecommendation: 'Window size 3-5 to see structural variations clearly',
        educationalNotes: 'Shows complex structural variations. Diagonal shifts indicate insertions/deletions. Useful for comparative genomics.'
    },
    
    'middle-inversion': {
        name: 'Middle Inversion',
        description: 'Sequence with inverted middle section',
        seq1: 'AGCTTAGCTTGACGTAACG',
        seq2: 'AGCTTGTCAAAGCGTAACG',
        expectedPattern: 'Diagonal with inverted middle section',
        windowSizeRecommendation: 'Window size 2-4 shows the inversion pattern best',
        educationalNotes: 'Middle section shows as red (reverse complement) while ends remain green (forward match). Models chromosomal inversions.'
    },
    
    'partial-overlap': {
        name: 'Partially Overlapping Sequences',
        description: 'Sequences that partially overlap',
        seq1: 'AGCTTAGCAGCTTGAC',
        seq2: 'GCAGCTTGACGTAACG',
        expectedPattern: 'Offset diagonal showing overlap region',
        windowSizeRecommendation: 'Window size 3-6 to identify overlap regions',
        educationalNotes: 'Shows sequence overlap patterns. Critical for genome assembly and identifying homologous regions in different sequences.'
    },
    
    'complex-repeats': {
        name: 'Complex Repeat Structure',
        description: 'Multiple types of repeats and similarities',
        seq1: 'AGCTTAGCACGTGTTGACGTAACG',
        seq2: 'GTTGACGTAACGAGCTTAGCACGT',
        expectedPattern: 'Multiple diagonal segments in different positions',
        windowSizeRecommendation: 'Try different window sizes (1-6) to see various repeat levels',
        educationalNotes: 'Complex pattern with multiple matching regions. Demonstrates real-world sequence relationships with various homology levels.'
    },

    // Easy to add new examples - just follow this template:
    /*
    'your-example-key': {
        name: 'Your Example Name',
        description: 'Brief description of what this example shows',
        seq1: 'AGCTTAGC',
        seq2: 'GCTTAAGC',
        expectedPattern: 'What pattern users should expect to see',
        windowSizeRecommendation: 'Suggested window size range',
        educationalNotes: 'Deeper explanation of the biological/computational significance'
    },
    */
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DOTPLOT_EXAMPLES;
}