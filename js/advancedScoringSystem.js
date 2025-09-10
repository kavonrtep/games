class AdvancedScoringSystem {
    constructor() {
        // Default DNA substitution matrix (match=2, mismatch=-1)
        this.substitutionMatrix = {
            'A': { 'A': 2, 'T': -1, 'C': -1, 'G': -1 },
            'T': { 'A': -1, 'T': 2, 'C': -1, 'G': -1 },
            'C': { 'A': -1, 'T': -1, 'C': 2, 'G': -1 },
            'G': { 'A': -1, 'T': -1, 'C': -1, 'G': 2 }
        };
        
        // Gap penalties
        this.gapParameters = {
            gapOpen: -3,      // Penalty for opening a gap
            gapExtend: -1,    // Penalty for extending a gap
            endGap: -1        // Penalty for gaps at sequence ends
        };
    }

    // Update substitution matrix
    updateSubstitutionMatrix(newMatrix) {
        this.substitutionMatrix = { ...newMatrix };
    }

    // Update gap parameters
    updateGapParameters(newParams) {
        this.gapParameters = { ...this.gapParameters, ...newParams };
    }

    // Get current substitution matrix
    getSubstitutionMatrix() {
        return JSON.parse(JSON.stringify(this.substitutionMatrix));
    }

    // Get current gap parameters
    getGapParameters() {
        return { ...this.gapParameters };
    }

    // Get all parameters
    getAllParameters() {
        return {
            substitutionMatrix: this.getSubstitutionMatrix(),
            gapParameters: this.getGapParameters()
        };
    }

    // Set substitution matrix from flat object (for UI)
    setMatrixFromFlat(flatMatrix) {
        const bases = ['A', 'T', 'C', 'G'];
        const newMatrix = {};
        
        bases.forEach(base1 => {
            newMatrix[base1] = {};
            bases.forEach(base2 => {
                const key = `${base1}${base2}`;
                newMatrix[base1][base2] = flatMatrix[key] || 0;
            });
        });
        
        this.substitutionMatrix = newMatrix;
    }

    // Get flat matrix for UI
    getFlatMatrix() {
        const flatMatrix = {};
        const bases = ['A', 'T', 'C', 'G'];
        
        bases.forEach(base1 => {
            bases.forEach(base2 => {
                const key = `${base1}${base2}`;
                flatMatrix[key] = this.substitutionMatrix[base1][base2];
            });
        });
        
        return flatMatrix;
    }

    // Preset: Match/Mismatch matrix
    setMatchMismatchMatrix(matchScore = 2, mismatchScore = -1) {
        const bases = ['A', 'T', 'C', 'G'];
        const newMatrix = {};
        
        bases.forEach(base1 => {
            newMatrix[base1] = {};
            bases.forEach(base2 => {
                newMatrix[base1][base2] = base1 === base2 ? matchScore : mismatchScore;
            });
        });
        
        this.substitutionMatrix = newMatrix;
    }

    // Preset: Transition/Transversion matrix
    setTransitionTransversionMatrix(matchScore = 2, transitionScore = 0, transversionScore = -2) {
        const transitions = [['A', 'G'], ['G', 'A'], ['C', 'T'], ['T', 'C']];
        const bases = ['A', 'T', 'C', 'G'];
        const newMatrix = {};
        
        bases.forEach(base1 => {
            newMatrix[base1] = {};
            bases.forEach(base2 => {
                if (base1 === base2) {
                    newMatrix[base1][base2] = matchScore;
                } else if (transitions.some(([t1, t2]) => t1 === base1 && t2 === base2)) {
                    newMatrix[base1][base2] = transitionScore;
                } else {
                    newMatrix[base1][base2] = transversionScore;
                }
            });
        });
        
        this.substitutionMatrix = newMatrix;
    }

    // Calculate score for two aligned bases
    getBaseScore(base1, base2) {
        if (base1 === '-' || base2 === '-') {
            return 0; // Gaps handled separately
        }
        
        base1 = base1.toUpperCase();
        base2 = base2.toUpperCase();
        
        return this.substitutionMatrix[base1]?.[base2] || 0;
    }

    // Calculate comprehensive alignment score
    calculateAlignmentScore(alignedSeq1, alignedSeq2) {
        if (!alignedSeq1 || !alignedSeq2 || alignedSeq1.length !== alignedSeq2.length) {
            return this.getEmptyScoreData();
        }

        let totalScore = 0;
        let matches = 0;
        let mismatches = 0;
        let gaps = 0;
        let gapOpenings = 0;
        let matchScore = 0;
        let mismatchScore = 0;
        let gapPenaltyScore = 0;
        let endGapPenaltyScore = 0;

        // Track gap states for both sequences
        let inGap1 = false;
        let inGap2 = false;
        const breakdown = [];

        // First pass: identify terminal gaps
        const terminalGaps = this.identifyTerminalGaps(alignedSeq1, alignedSeq2);

        for (let i = 0; i < alignedSeq1.length; i++) {
            const char1 = alignedSeq1[i];
            const char2 = alignedSeq2[i];
            
            let scoreContribution = 0;
            let type = '';

            if (char1 === '-' || char2 === '-') {
                gaps++;
                const isEndGap = this.isTerminalGap(i, terminalGaps);
                
                if (char1 === '-') {
                    if (!inGap1) {
                        gapOpenings++;
                        scoreContribution += this.gapParameters.gapOpen;
                        type = isEndGap ? 'end-gap-open' : 'gap-open';
                        inGap1 = true;
                    } else {
                        scoreContribution += this.gapParameters.gapExtend;
                        type = isEndGap ? 'end-gap-extend' : 'gap-extend';
                    }
                    inGap2 = false;
                    
                    // Apply end gap penalty if at terminal position
                    if (isEndGap) {
                        const endPenalty = this.gapParameters.endGap;
                        scoreContribution += endPenalty;
                        endGapPenaltyScore += endPenalty;
                    }
                    
                } else if (char2 === '-') {
                    if (!inGap2) {
                        gapOpenings++;
                        scoreContribution += this.gapParameters.gapOpen;
                        type = isEndGap ? 'end-gap-open' : 'gap-open';
                        inGap2 = true;
                    } else {
                        scoreContribution += this.gapParameters.gapExtend;
                        type = isEndGap ? 'end-gap-extend' : 'gap-extend';
                    }
                    inGap1 = false;
                    
                    // Apply end gap penalty if at terminal position
                    if (isEndGap) {
                        const endPenalty = this.gapParameters.endGap;
                        scoreContribution += endPenalty;
                        endGapPenaltyScore += endPenalty;
                    }
                }
                
                gapPenaltyScore += scoreContribution - (isEndGap ? this.gapParameters.endGap : 0);
                
            } else {
                inGap1 = false;
                inGap2 = false;
                
                scoreContribution = this.getBaseScore(char1, char2);
                
                if (char1.toUpperCase() === char2.toUpperCase()) {
                    matches++;
                    matchScore += scoreContribution;
                    type = 'match';
                } else {
                    mismatches++;
                    mismatchScore += scoreContribution;
                    type = 'mismatch';
                }
            }

            totalScore += scoreContribution;
            breakdown.push({
                position: i,
                char1,
                char2,
                score: scoreContribution,
                type
            });
        }

        const alignmentLength = alignedSeq1.length;
        const identity = alignmentLength > 0 ? (matches / (matches + mismatches)) * 100 : 0;

        return {
            totalScore: Math.round(totalScore * 10) / 10,
            matches,
            mismatches,
            gaps,
            gapOpenings,
            identity: Math.round(identity * 10) / 10,
            alignmentLength,
            matchScore: Math.round(matchScore * 10) / 10,
            mismatchScore: Math.round(mismatchScore * 10) / 10,
            gapPenaltyScore: Math.round(gapPenaltyScore * 10) / 10,
            endGapPenaltyScore: Math.round(endGapPenaltyScore * 10) / 10,
            breakdown
        };
    }

    // Identify terminal gaps in alignment
    identifyTerminalGaps(seq1, seq2) {
        const terminalPositions = new Set();
        
        // Find leading gaps
        let i = 0;
        while (i < seq1.length && (seq1[i] === '-' || seq2[i] === '-')) {
            terminalPositions.add(i);
            i++;
        }
        
        // Find trailing gaps
        i = seq1.length - 1;
        while (i >= 0 && (seq1[i] === '-' || seq2[i] === '-')) {
            terminalPositions.add(i);
            i--;
        }
        
        return terminalPositions;
    }

    // Check if position is a terminal gap
    isTerminalGap(position, terminalGaps) {
        return terminalGaps.has(position);
    }

    // Generate match line for alignment display
    generateMatchLine(alignedSeq1, alignedSeq2) {
        if (!alignedSeq1 || !alignedSeq2 || alignedSeq1.length !== alignedSeq2.length) {
            return '';
        }

        let matchLine = '';
        for (let i = 0; i < alignedSeq1.length; i++) {
            const char1 = alignedSeq1[i];
            const char2 = alignedSeq2[i];

            if (char1 === '-' || char2 === '-') {
                matchLine += ' ';
            } else if (char1.toUpperCase() === char2.toUpperCase()) {
                matchLine += '|';
            } else {
                const score = this.getBaseScore(char1, char2);
                if (score > 0) {
                    matchLine += ':';  // Similar bases (positive score but not identical)
                } else {
                    matchLine += ' ';  // Dissimilar bases
                }
            }
        }
        return matchLine;
    }

    // Get empty score data structure
    getEmptyScoreData() {
        return {
            totalScore: 0,
            matches: 0,
            mismatches: 0,
            gaps: 0,
            gapOpenings: 0,
            identity: 0,
            alignmentLength: 0,
            matchScore: 0,
            mismatchScore: 0,
            gapPenaltyScore: 0,
            endGapPenaltyScore: 0,
            breakdown: []
        };
    }

    // Validate DNA sequence
    validateDNASequence(sequence) {
        if (!sequence || typeof sequence !== 'string') {
            return false;
        }
        return /^[ATCGatcg]+$/.test(sequence);
    }

    // Get scoring summary for display
    getScoringSummary() {
        const matrix = this.getSubstitutionMatrix();
        const gaps = this.getGapParameters();
        
        return {
            matrixType: this.detectMatrixType(),
            matchScore: matrix.A.A,
            mismatchScore: matrix.A.T,
            gapOpen: gaps.gapOpen,
            gapExtend: gaps.gapExtend,
            endGap: gaps.endGap,
            isSymmetric: this.isMatrixSymmetric()
        };
    }

    // Detect matrix type for display
    detectMatrixType() {
        const matrix = this.getSubstitutionMatrix();
        const bases = ['A', 'T', 'C', 'G'];
        
        // Check if simple match/mismatch
        const matchScore = matrix.A.A;
        const mismatchScore = matrix.A.T;
        
        let isMatchMismatch = true;
        bases.forEach(b1 => {
            bases.forEach(b2 => {
                const expected = b1 === b2 ? matchScore : mismatchScore;
                if (matrix[b1][b2] !== expected) {
                    isMatchMismatch = false;
                }
            });
        });
        
        if (isMatchMismatch) return 'Match/Mismatch';
        
        // Check for transition/transversion pattern
        const transitions = [['A', 'G'], ['G', 'A'], ['C', 'T'], ['T', 'C']];
        const transitionScore = matrix.A.G;
        let isTransitionTransversion = true;
        
        transitions.forEach(([b1, b2]) => {
            if (matrix[b1][b2] !== transitionScore) {
                isTransitionTransversion = false;
            }
        });
        
        if (isTransitionTransversion) return 'Transition/Transversion';
        
        return 'Custom';
    }

    // Check if matrix is symmetric
    isMatrixSymmetric() {
        const matrix = this.getSubstitutionMatrix();
        const bases = ['A', 'T', 'C', 'G'];
        
        for (let i = 0; i < bases.length; i++) {
            for (let j = i + 1; j < bases.length; j++) {
                if (matrix[bases[i]][bases[j]] !== matrix[bases[j]][bases[i]]) {
                    return false;
                }
            }
        }
        return true;
    }
}