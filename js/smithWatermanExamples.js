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
    
    'splice-junction': {
        name: 'Splice Junction Conservation',
        description: 'RNA sequences with conserved splice site signals',
        seq1: 'AAGGUAAGUCC',
        seq2: 'GUCGGUAAGAC',
        sequenceType: 'rna',
        expectedPattern: 'Local alignment around GGUAAG consensus',
        scoringRecommendation: 'Match=2, Mismatch=-1, Gap=-1 shows conservation',
        educationalNotes: 'Splice sites have conserved sequences (GT-AG rule). Local alignment finds these conserved motifs even in different contexts.'
    },
    
    'exon-similarity': {
        name: 'Similar Exon Sequences',
        description: 'DNA sequences with one similar exon region',
        seq1: 'ATCGATCGAAGGCTAACG',
        seq2: 'GGGAAGGCTAACCCTTT',
        sequenceType: 'dna',
        expectedPattern: 'Local alignment around AAGGCTAAC region',
        scoringRecommendation: 'Standard DNA scoring to highlight local similarity',
        educationalNotes: 'Models gene comparison where only specific exons are conserved between paralogs or orthologs.'
    },
    
    'motif-detection': {
        name: 'Regulatory Motif Detection',
        description: 'DNA sequences sharing a transcription factor binding site',
        seq1: 'ATCGTCGATTATAAGCG',
        seq2: 'GGGCTATAAGCTTTCC',
        sequenceType: 'dna',
        expectedPattern: 'Local alignment around TATAAG motif (TATA box)',
        scoringRecommendation: 'Try Match=3, Mismatch=-2 to emphasize motif',
        educationalNotes: 'TATA box is a key regulatory element. Local alignment can identify conserved regulatory motifs in promoter regions.'
    },
    
    
    'partial-homology': {
        name: 'Partial Sequence Homology',
        description: 'Sequences homologous only in specific regions',
        seq1: 'ATCGATCGATTGCCAA',
        seq2: 'GGGTTGCCAACCCTT',
        sequenceType: 'dna',
        expectedPattern: 'Local alignment around TTGCCAA region',
        scoringRecommendation: 'Default parameters show clear local similarity',
        educationalNotes: 'Common in comparative genomics: genes may be similar only in coding regions while differing in regulatory sequences.'
    },
    
    
    'weak-similarity': {
        name: 'Weak Local Similarity',
        description: 'Sequences with subtle local conservation',
        seq1: 'ATCGAACCGTTGCAAG',
        seq2: 'GGGAACCCTTGCTTCC',
        sequenceType: 'dna',
        expectedPattern: 'Weak local alignment around AACCGTTGC region',
        scoringRecommendation: 'Lower gap penalty (-0.5) may reveal weak similarity',
        educationalNotes: 'Tests sensitivity: can the algorithm detect weak but biologically meaningful local similarities?'
    },
    
    'ancient-conserved': {
        name: 'Ancient Conserved Sequence',
        description: 'Highly conserved sequence in different contexts',
        seq1: 'GGCGCGATCGATCGC',
        seq2: 'ATGCGATCGATCGAA',
        sequenceType: 'dna',
        expectedPattern: 'Perfect local alignment around CGATCGATC',
        scoringRecommendation: 'High match score shows perfect conservation',
        educationalNotes: 'Models ancient conserved sequences like ribosomal RNA regions that are identical across very different organisms.'
    },
    
    'intron-exon-boundary': {
        name: 'Intron-Exon Boundary Similarity',
        description: 'Sequences sharing conserved exon regions but different introns',
        seq1: 'ATCGAAGGCTAACCGGT',
        seq2: 'GGGCAAGGCTAACTTTT',
        sequenceType: 'dna',
        expectedPattern: 'Local alignment around conserved AAGGCTAAC exon',
        scoringRecommendation: 'Standard DNA scoring highlights conserved coding region',
        educationalNotes: 'Common in gene analysis: exons are conserved while introns diverge, perfect for local alignment detection.'
    },
    
    'transposon-remnants': {
        name: 'Transposable Element Remnants',
        description: 'DNA sequences containing similar transposon fragments',
        seq1: 'GGCATGCATGCATGGC',
        seq2: 'TTCATGCATGCATCCC',
        sequenceType: 'dna',
        expectedPattern: 'Local alignment around CATGCATGCAT repeat',
        scoringRecommendation: 'Match=2, Gap=-1 to detect repeat elements clearly',
        educationalNotes: 'Transposable elements leave similar sequence signatures. Local alignment can identify these remnants in different genomic contexts.'
    },
    
    'cpg-island-similarity': {
        name: 'CpG Island Conservation',
        description: 'Sequences with conserved CpG-rich regulatory regions',
        seq1: 'ATGCCGCGCGCGTTAA',
        seq2: 'GGGCGCGCGCGCCAAT',
        sequenceType: 'dna',
        expectedPattern: 'Local alignment around CpG-rich CGCGCGCG region',
        scoringRecommendation: 'Higher match score emphasizes GC-rich conservation',
        educationalNotes: 'CpG islands are important regulatory elements often conserved between related genes or species.'
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