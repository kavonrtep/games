class ScoringSystem {
    constructor() {
        this.parameters = {
            match: 2,
            mismatch: -1,
            gap: -2
        };
    }

    updateParameters(newParams) {
        this.parameters = { ...this.parameters, ...newParams };
    }

    getParameters() {
        return { ...this.parameters };
    }

    calculateAlignmentScore(alignedSeq1, alignedSeq2) {
        if (!alignedSeq1 || !alignedSeq2 || alignedSeq1.length !== alignedSeq2.length) {
            return {
                totalScore: 0,
                matches: 0,
                mismatches: 0,
                gaps: 0,
                gapOpenings: 0,
                identity: 0,
                breakdown: []
            };
        }

        let totalScore = 0;
        let matches = 0;
        let mismatches = 0;
        let gaps = 0;
        let gapOpenings = 0;
        const breakdown = [];

        for (let i = 0; i < alignedSeq1.length; i++) {
            const char1 = alignedSeq1[i];
            const char2 = alignedSeq2[i];
            
            let scoreContribution = 0;
            let type = '';

            if (char1 === '-' || char2 === '-') {
                gaps++;
                
                scoreContribution = this.parameters.gap;
                type = 'gap';
            } else {
                
                if (char1 === char2) {
                    matches++;
                    scoreContribution = this.parameters.match;
                    type = 'match';
                } else {
                    mismatches++;
                    scoreContribution = this.parameters.mismatch;
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
        const identity = alignmentLength > 0 ? (matches / alignmentLength) * 100 : 0;

        return {
            totalScore: Math.round(totalScore * 10) / 10,
            matches,
            mismatches,
            gaps,
            gapOpenings,
            identity: Math.round(identity * 10) / 10,
            alignmentLength,
            breakdown
        };
    }

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
            } else if (char1 === char2) {
                matchLine += '|';
            } else {
                matchLine += ' ';
            }
        }
        return matchLine;
    }

    isConservativeSubstitution(char1, char2, sequenceType) {
        if (sequenceType === 'PROTEIN') {
            const conservativeGroups = [
                ['A', 'G', 'S', 'T'],
                ['D', 'E'],
                ['N', 'Q'],
                ['R', 'K', 'H'],
                ['I', 'L', 'V', 'M'],
                ['F', 'Y', 'W'],
                ['C']
            ];

            for (const group of conservativeGroups) {
                if (group.includes(char1) && group.includes(char2)) {
                    return true;
                }
            }
        }
        return false;
    }

    getOptimalScore(seq1, seq2) {
        const minLength = Math.min(seq1.length, seq2.length);
        const maxLength = Math.max(seq1.length, seq2.length);
        
        let matches = 0;
        for (let i = 0; i < minLength; i++) {
            if (seq1[i] === seq2[i]) {
                matches++;
            }
        }
        
        const mismatches = minLength - matches;
        const gaps = maxLength - minLength;
        
        const optimalScore = (matches * this.parameters.match) + 
                           (mismatches * this.parameters.mismatch) + 
                           (gaps * this.parameters.gap);
        
        return Math.round(optimalScore * 10) / 10;
    }

    compareWithOptimal(currentScore, seq1, seq2) {
        const optimalScore = this.getOptimalScore(seq1, seq2);
        const percentage = optimalScore !== 0 ? (currentScore / optimalScore) * 100 : 0;
        
        return {
            optimalScore,
            currentScore,
            percentage: Math.round(percentage * 10) / 10,
            difference: Math.round((optimalScore - currentScore) * 10) / 10
        };
    }
}