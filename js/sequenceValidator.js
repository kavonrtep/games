class SequenceValidator {
    constructor() {
        this.dnaPattern = /^[ATCG]+$/i;
        this.rnaPattern = /^[AUCG]+$/i;
        this.proteinPattern = /^[ACDEFGHIKLMNPQRSTVWY]+$/i;
        this.minLength = 5;
        this.maxLength = 50;
    }

    validateSequence(sequence) {
        const cleanSeq = sequence.trim().toUpperCase();
        
        if (cleanSeq.length === 0) {
            return {
                isValid: false,
                error: 'Sequence cannot be empty',
                type: null,
                cleanSequence: null
            };
        }

        if (cleanSeq.length < this.minLength) {
            return {
                isValid: false,
                error: `Sequence must be at least ${this.minLength} characters long`,
                type: null,
                cleanSequence: null
            };
        }

        if (cleanSeq.length > this.maxLength) {
            return {
                isValid: false,
                error: `Sequence must be at most ${this.maxLength} characters long`,
                type: null,
                cleanSequence: null
            };
        }

        const sequenceType = this.determineSequenceType(cleanSeq);
        
        if (!sequenceType) {
            return {
                isValid: false,
                error: 'Invalid sequence. Use only valid DNA (ATCG), RNA (AUCG), or protein amino acid characters',
                type: null,
                cleanSequence: null
            };
        }

        return {
            isValid: true,
            error: null,
            type: sequenceType,
            cleanSequence: cleanSeq
        };
    }

    determineSequenceType(sequence) {
        if (this.dnaPattern.test(sequence)) {
            return 'DNA';
        }
        
        if (this.rnaPattern.test(sequence)) {
            return 'RNA';
        }
        
        if (this.proteinPattern.test(sequence)) {
            return 'PROTEIN';
        }
        
        return null;
    }

    validateSequencePair(seq1, seq2) {
        const result1 = this.validateSequence(seq1);
        const result2 = this.validateSequence(seq2);

        if (!result1.isValid) {
            return {
                isValid: false,
                error: `Sequence 1: ${result1.error}`,
                sequences: null
            };
        }

        if (!result2.isValid) {
            return {
                isValid: false,
                error: `Sequence 2: ${result2.error}`,
                sequences: null
            };
        }

        if (result1.type !== result2.type) {
            return {
                isValid: false,
                error: `Sequence types must match. Sequence 1 is ${result1.type}, Sequence 2 is ${result2.type}`,
                sequences: null
            };
        }

        return {
            isValid: true,
            error: null,
            sequences: {
                sequence1: result1.cleanSequence,
                sequence2: result2.cleanSequence,
                type: result1.type
            }
        };
    }

    getExampleSimilarSequences(difficulty = 'beginner') {
        const examples = {
            beginner: {
                DNA: [
                    { seq1: 'ATCGATCG', seq2: 'ATCGATCG', description: 'Identical sequences' },
                    { seq1: 'ATCGATCG', seq2: 'ATCGATCC', description: 'Single mismatch' },
                    { seq1: 'ATCGATCG', seq2: 'ATCGAATCG', description: 'Single insertion' }
                ],
                PROTEIN: [
                    { seq1: 'ACDEFGH', seq2: 'ACDEFGH', description: 'Identical sequences' },
                    { seq1: 'ACDEFGH', seq2: 'ACDEAGH', description: 'Single substitution' },
                    { seq1: 'ACDEFGH', seq2: 'ACDEAFGH', description: 'Single insertion' }
                ]
            },
            intermediate: {
                DNA: [
                    { seq1: 'ATCGATCGAAT', seq2: 'ATCGAATCGAT', description: 'Multiple mismatches' },
                    { seq1: 'ATCGATCGAAT', seq2: 'ATCGATAAT', description: 'Deletion' },
                    { seq1: 'ATCGATCG', seq2: 'GGATCGATCC', description: 'Indels and mismatches' }
                ],
                PROTEIN: [
                    { seq1: 'ACDEFGHIKL', seq2: 'ACDEAGHIKM', description: 'Multiple substitutions' },
                    { seq1: 'ACDEFGHIKL', seq2: 'ACDEFGIKL', description: 'Deletion' },
                    { seq1: 'ACDEFGH', seq2: 'ACDEAFGHIK', description: 'Insertion and extension' }
                ]
            },
            advanced: {
                DNA: [
                    { seq1: 'ATCGATCGAATGCC', seq2: 'AACGATCGGTGCT', description: 'Complex alignment' },
                    { seq1: 'ATCGATCGAAT', seq2: 'GGGATCGCCAAT', description: 'Multiple indels' },
                    { seq1: 'ATCGATCG', seq2: 'CGATCGATAA', description: 'Shifted similarity' }
                ],
                PROTEIN: [
                    { seq1: 'ACDEFGHIKLMNP', seq2: 'ACDAGGHIKLMQP', description: 'Conservative substitutions' },
                    { seq1: 'ACDEFGHIKL', seq2: 'ACEGHIKLNP', description: 'Multiple gaps' },
                    { seq1: 'ACDEFGH', seq2: 'DEFGHACL', description: 'Rearranged similarity' }
                ]
            }
        };

        return examples[difficulty] || examples.beginner;
    }

    getRandomExample(difficulty = 'beginner', type = 'DNA') {
        const examples = this.getExampleSimilarSequences(difficulty);
        const typeExamples = examples[type] || examples.DNA;
        const randomIndex = Math.floor(Math.random() * typeExamples.length);
        return typeExamples[randomIndex];
    }
}