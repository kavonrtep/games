// Advanced Global Alignment Examples
// DNA sequences for educational purposes with various alignment challenges

const ADVANCED_GLOBAL_ALIGNMENT_EXAMPLES = {
    // Basic examples
    'simple_match': {
        name: 'Simple Match',
        description: 'Nearly identical sequences with a few differences',
        level: 'beginner',
        seq1: 'ATCGATCG',
        seq2: 'ATCAATCG',
        expectedChallenges: ['Single mismatch', 'Simple alignment']
    },
    
    'simple_insertion': {
        name: 'Simple Insertion',
        description: 'One sequence has an insertion',
        level: 'beginner',
        seq1: 'ATCGATCG',
        seq2: 'ATCGAATCG',
        expectedChallenges: ['Single insertion', 'Gap penalty calculation']
    },
    
    'simple_deletion': {
        name: 'Simple Deletion',
        description: 'One sequence has a deletion',
        level: 'beginner',
        seq1: 'ATCGATCG',
        seq2: 'ATCGTCG',
        expectedChallenges: ['Single deletion', 'Gap penalty']
    },

    // Intermediate examples
    'multiple_gaps': {
        name: 'Multiple Gaps',
        description: 'Both sequences require multiple gaps',
        level: 'intermediate',
        seq1: 'ATCGATAACG',
        seq2: 'ATCGATCG',
        expectedChallenges: ['Multiple gaps', 'Gap opening vs extension']
    },
    
    'transition_mutations': {
        name: 'Transition Mutations',
        description: 'Sequences with A↔G and C↔T transitions',
        level: 'intermediate',
        seq1: 'ATCGATCGAT',
        seq2: 'GTCAATCAGT',
        expectedChallenges: ['Transitions', 'Substitution matrix effects']
    },
    
    'transversion_mutations': {
        name: 'Transversion Mutations',
        description: 'Sequences with A/G↔C/T transversions',
        level: 'intermediate',
        seq1: 'AAAAGGGG',
        seq2: 'CCCCTTTT',
        expectedChallenges: ['Transversions', 'Severe mismatches']
    },

    'mixed_mutations': {
        name: 'Mixed Mutations',
        description: 'Combination of insertions, deletions, and substitutions',
        level: 'intermediate',
        seq1: 'ATCGATCGATCG',
        seq2: 'ATCGAACGATG',
        expectedChallenges: ['Mixed mutations', 'Complex alignment choices']
    },

    // Advanced examples
    'repetitive_sequences': {
        name: 'Repetitive Sequences',
        description: 'Sequences with repetitive elements',
        level: 'advanced',
        seq1: 'ATATATCGATCGATAT',
        seq2: 'ATATCGATCGATAT',
        expectedChallenges: ['Repetitive elements', 'Multiple optimal alignments']
    },
    
    'gc_rich': {
        name: 'GC-Rich Sequences',
        description: 'High GC content sequences',
        level: 'advanced',
        seq1: 'GCGCGCGCATGCGC',
        seq2: 'GCGCGCATGCGCGC',
        expectedChallenges: ['GC bias', 'Structural constraints']
    },
    
    'at_rich': {
        name: 'AT-Rich Sequences',
        description: 'High AT content sequences',
        level: 'advanced',
        seq1: 'ATATATATCGATAT',
        seq2: 'ATATATCGATATATAG',
        expectedChallenges: ['AT bias', 'Weak base pairing']
    },

    'long_gap': {
        name: 'Long Gap',
        description: 'Alignment requiring a long gap',
        level: 'advanced',
        seq1: 'ATCGATCG',
        seq2: 'ATCGAAAAAAAATCG',
        expectedChallenges: ['Long gap', 'Gap extension penalties']
    },

    'terminal_gaps': {
        name: 'Terminal Gaps',
        description: 'Sequences with different lengths requiring terminal gaps',
        level: 'advanced',
        seq1: 'AAATCGATCGCCC',
        seq2: 'TCGATCG',
        expectedChallenges: ['Terminal gaps', 'End gap penalties']
    },

    'highly_divergent': {
        name: 'Highly Divergent',
        description: 'Very different sequences with few matches',
        level: 'advanced',
        seq1: 'AAAATTTTCCCCGGGG',
        seq2: 'GGGCCCCTTTTAAAA',
        expectedChallenges: ['High divergence', 'Poor alignment quality']
    },

    // Educational examples for specific concepts
    'gap_opening_demo': {
        name: 'Gap Opening Penalty Demo',
        description: 'Demonstrates impact of gap opening penalty',
        level: 'educational',
        seq1: 'ATCGAAAATCG',
        seq2: 'ATCGATCG',
        expectedChallenges: ['Gap opening penalty', 'One vs multiple gaps']
    },

    'gap_extension_demo': {
        name: 'Gap Extension Penalty Demo',
        description: 'Shows difference between gap opening and extension',
        level: 'educational',
        seq1: 'ATCGAAAAATCG',
        seq2: 'ATCGATCG',
        expectedChallenges: ['Gap extension', 'Long vs short gaps']
    },

    'substitution_matrix_demo': {
        name: 'Substitution Matrix Demo',
        description: 'Highlights importance of substitution matrix values',
        level: 'educational',
        seq1: 'AAAGGGCCCTTTT',
        seq2: 'GGGTTTAAACCC',
        expectedChallenges: ['Substitution effects', 'Matrix sensitivity']
    },

    'end_gap_demo': {
        name: 'End Gap Penalty Demo',
        description: 'Shows effect of end gap penalties',
        level: 'educational',
        seq1: 'ATCGATCGATCG',
        seq2: 'GATCGATCG',
        expectedChallenges: ['End gaps', 'Terminal penalty effects']
    }
};

// Helper functions for example management
const AdvancedGlobalAlignmentExampleManager = {
    getExamplesByLevel: function(level) {
        return Object.entries(ADVANCED_GLOBAL_ALIGNMENT_EXAMPLES)
            .filter(([key, example]) => example.level === level)
            .reduce((acc, [key, example]) => {
                acc[key] = example;
                return acc;
            }, {});
    },

    getRandomExample: function(level = null) {
        let availableExamples = ADVANCED_GLOBAL_ALIGNMENT_EXAMPLES;
        
        if (level) {
            availableExamples = this.getExamplesByLevel(level);
        }
        
        const keys = Object.keys(availableExamples);
        if (keys.length === 0) return null;
        
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        return {
            key: randomKey,
            ...availableExamples[randomKey]
        };
    },

    validateExample: function(example) {
        return example.seq1 && 
               example.seq2 && 
               /^[ATCG]+$/i.test(example.seq1) && 
               /^[ATCG]+$/i.test(example.seq2) &&
               example.seq1.length >= 5 && 
               example.seq2.length >= 5 &&
               example.seq1.length <= 50 && 
               example.seq2.length <= 50;
    },

    getAllLevels: function() {
        const levels = new Set();
        Object.values(ADVANCED_GLOBAL_ALIGNMENT_EXAMPLES).forEach(example => {
            levels.add(example.level);
        });
        return Array.from(levels);
    }
};