class NeedlemanWunsch {
    constructor() {
        // Direction constants for traceback
        this.DIAGONAL = 'diagonal';
        this.LEFT = 'left';
        this.UP = 'up';
    }

    calculateOptimalAlignment(seq1, seq2, scoringParams) {
        if (!seq1 || !seq2 || seq1.length === 0 || seq2.length === 0) {
            return {
                alignedSeq1: seq1 || '',
                alignedSeq2: seq2 || '',
                score: 0,
                matrix: null
            };
        }

        // Initialize the scoring matrix
        const matrix = this.initializeMatrix(seq1, seq2, scoringParams);
        
        // Fill the matrix using dynamic programming
        this.fillMatrix(matrix, seq1, seq2, scoringParams);
        
        // Perform traceback to get the optimal alignment
        const alignment = this.traceback(matrix, seq1, seq2, scoringParams);
        
        return {
            alignedSeq1: alignment.alignedSeq1,
            alignedSeq2: alignment.alignedSeq2,
            score: matrix.score[seq1.length][seq2.length],
            matrix: matrix
        };
    }

    initializeMatrix(seq1, seq2, scoringParams) {
        const rows = seq1.length + 1;
        const cols = seq2.length + 1;
        
        // Create scoring matrix and traceback matrix
        const score = Array(rows).fill().map(() => Array(cols).fill(0));
        const traceback = Array(rows).fill().map(() => Array(cols).fill(''));
        
        // Initialize first row (gaps in seq1)
        for (let j = 1; j < cols; j++) {
            score[0][j] = score[0][j-1] + scoringParams.gapOpen + (j > 1 ? scoringParams.gapExtend : 0);
            traceback[0][j] = this.LEFT;
        }
        
        // Initialize first column (gaps in seq2)
        for (let i = 1; i < rows; i++) {
            score[i][0] = score[i-1][0] + scoringParams.gapOpen + (i > 1 ? scoringParams.gapExtend : 0);
            traceback[i][0] = this.UP;
        }
        
        return { score, traceback, rows, cols };
    }

    fillMatrix(matrix, seq1, seq2, scoringParams) {
        const { score, traceback } = matrix;
        
        for (let i = 1; i <= seq1.length; i++) {
            for (let j = 1; j <= seq2.length; j++) {
                const char1 = seq1[i-1];
                const char2 = seq2[j-1];
                
                // Calculate scores for three possible moves
                const matchScore = char1 === char2 ? scoringParams.match : scoringParams.mismatch;
                const diagonal = score[i-1][j-1] + matchScore;
                
                // Gap penalties with affine gap model
                const gapInSeq1 = this.calculateGapScore(score, i-1, j, traceback[i-1][j], scoringParams, this.UP);
                const gapInSeq2 = this.calculateGapScore(score, i, j-1, traceback[i][j-1], scoringParams, this.LEFT);
                
                // Choose the best score
                if (diagonal >= gapInSeq1 && diagonal >= gapInSeq2) {
                    score[i][j] = diagonal;
                    traceback[i][j] = this.DIAGONAL;
                } else if (gapInSeq1 >= gapInSeq2) {
                    score[i][j] = gapInSeq1;
                    traceback[i][j] = this.UP;
                } else {
                    score[i][j] = gapInSeq2;
                    traceback[i][j] = this.LEFT;
                }
            }
        }
    }

    calculateGapScore(scoreMatrix, prevI, prevJ, prevDirection, scoringParams, currentDirection) {
        const baseScore = scoreMatrix[prevI][prevJ];
        
        // If continuing a gap, use gap extension penalty
        if (prevDirection === currentDirection) {
            return baseScore + scoringParams.gapExtend;
        } else {
            // Starting a new gap, use gap opening penalty
            return baseScore + scoringParams.gapOpen;
        }
    }

    traceback(matrix, seq1, seq2, scoringParams) {
        const { traceback } = matrix;
        let alignedSeq1 = '';
        let alignedSeq2 = '';
        
        let i = seq1.length;
        let j = seq2.length;
        
        // Follow the traceback path to reconstruct the alignment
        while (i > 0 || j > 0) {
            const direction = traceback[i][j];
            
            if (direction === this.DIAGONAL) {
                // Match or mismatch
                alignedSeq1 = seq1[i-1] + alignedSeq1;
                alignedSeq2 = seq2[j-1] + alignedSeq2;
                i--;
                j--;
            } else if (direction === this.UP) {
                // Gap in seq2 (deletion)
                alignedSeq1 = seq1[i-1] + alignedSeq1;
                alignedSeq2 = '-' + alignedSeq2;
                i--;
            } else if (direction === this.LEFT) {
                // Gap in seq1 (insertion)
                alignedSeq1 = '-' + alignedSeq1;
                alignedSeq2 = seq2[j-1] + alignedSeq2;
                j--;
            } else {
                // Handle edge case for initialization
                if (i > 0) {
                    alignedSeq1 = seq1[i-1] + alignedSeq1;
                    alignedSeq2 = '-' + alignedSeq2;
                    i--;
                } else if (j > 0) {
                    alignedSeq1 = '-' + alignedSeq1;
                    alignedSeq2 = seq2[j-1] + alignedSeq2;
                    j--;
                }
            }
        }
        
        return {
            alignedSeq1: alignedSeq1,
            alignedSeq2: alignedSeq2
        };
    }

    // Utility method to get alignment statistics
    getAlignmentStatistics(alignedSeq1, alignedSeq2) {
        if (!alignedSeq1 || !alignedSeq2 || alignedSeq1.length !== alignedSeq2.length) {
            return { matches: 0, mismatches: 0, gaps: 0, identity: 0 };
        }
        
        let matches = 0;
        let mismatches = 0;
        let gaps = 0;
        
        for (let i = 0; i < alignedSeq1.length; i++) {
            const char1 = alignedSeq1[i];
            const char2 = alignedSeq2[i];
            
            if (char1 === '-' || char2 === '-') {
                gaps++;
            } else if (char1 === char2) {
                matches++;
            } else {
                mismatches++;
            }
        }
        
        const identity = alignedSeq1.length > 0 ? (matches / alignedSeq1.length) * 100 : 0;
        
        return {
            matches,
            mismatches,
            gaps,
            identity: Math.round(identity * 10) / 10,
            length: alignedSeq1.length
        };
    }

    // Debug method to print the scoring matrix (useful for development)
    printMatrix(matrix, seq1, seq2) {
        if (!matrix || !matrix.score) return;
        
        console.log('Needleman-Wunsch Scoring Matrix:');
        console.log('Sequences:', seq1, 'vs', seq2);
        
        // Print header
        let header = '     ';
        for (let j = 0; j < seq2.length; j++) {
            header += seq2[j].padStart(4);
        }
        console.log(header);
        
        // Print matrix rows
        for (let i = 0; i <= seq1.length; i++) {
            let row = i === 0 ? '  ' : seq1[i-1] + ' ';
            for (let j = 0; j <= seq2.length; j++) {
                row += matrix.score[i][j].toString().padStart(4);
            }
            console.log(row);
        }
    }
}