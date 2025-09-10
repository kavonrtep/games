class GlobalAlignmentAlgorithm {
    constructor(scoringSystem) {
        this.scoringSystem = scoringSystem;
    }

    /**
     * Perform global alignment using Needleman-Wunsch with affine gap penalties
     * Uses three-matrix approach: M (match), Ix (gap in seq1), Iy (gap in seq2)
     */
    align(seq1, seq2) {
        if (!seq1 || !seq2) {
            throw new Error('Both sequences are required');
        }

        // Validate DNA sequences
        if (!this.scoringSystem.validateDNASequence(seq1) || !this.scoringSystem.validateDNASequence(seq2)) {
            throw new Error('Invalid DNA sequence. Only A, T, C, G characters allowed.');
        }

        // Convert to uppercase
        seq1 = seq1.toUpperCase();
        seq2 = seq2.toUpperCase();

        const m = seq1.length;
        const n = seq2.length;
        
        // Get scoring parameters
        const matrix = this.scoringSystem.getSubstitutionMatrix();
        const gap = this.scoringSystem.getGapParameters();
        
        // Initialize three scoring matrices
        const M = this.createMatrix(m + 1, n + 1, -Infinity);  // Match/mismatch
        const Ix = this.createMatrix(m + 1, n + 1, -Infinity); // Gap in seq1 (horizontal)
        const Iy = this.createMatrix(m + 1, n + 1, -Infinity); // Gap in seq2 (vertical)
        
        // Initialize traceback matrices
        const traceM = this.createMatrix(m + 1, n + 1, null);
        const traceIx = this.createMatrix(m + 1, n + 1, null);
        const traceIy = this.createMatrix(m + 1, n + 1, null);

        // Initialize first cell
        M[0][0] = 0;
        Ix[0][0] = -Infinity;
        Iy[0][0] = -Infinity;

        // Initialize first row (gaps in seq2, insertions in seq1)
        for (let j = 1; j <= n; j++) {
            M[0][j] = -Infinity;
            Ix[0][j] = -Infinity;
            
            // First gap opening, rest are extensions
            if (j === 1) {
                Iy[0][j] = gap.gapOpen + gap.endGap; // Terminal gap
            } else {
                Iy[0][j] = Iy[0][j-1] + gap.gapExtend + gap.endGap; // Terminal gap extension
            }
            traceIy[0][j] = 'Iy';
        }

        // Initialize first column (gaps in seq1, deletions from seq2)
        for (let i = 1; i <= m; i++) {
            M[i][0] = -Infinity;
            Iy[i][0] = -Infinity;
            
            // First gap opening, rest are extensions
            if (i === 1) {
                Ix[i][0] = gap.gapOpen + gap.endGap; // Terminal gap
            } else {
                Ix[i][0] = Ix[i-1][0] + gap.gapExtend + gap.endGap; // Terminal gap extension
            }
            traceIx[i][0] = 'Ix';
        }

        // Fill matrices using dynamic programming
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const char1 = seq1[i-1];
                const char2 = seq2[j-1];
                const substitutionScore = matrix[char1][char2];

                // Calculate M[i][j] - match/mismatch
                const matchFromM = M[i-1][j-1] + substitutionScore;
                const matchFromIx = Ix[i-1][j-1] + substitutionScore;
                const matchFromIy = Iy[i-1][j-1] + substitutionScore;
                
                const maxMatch = Math.max(matchFromM, matchFromIx, matchFromIy);
                M[i][j] = maxMatch;
                
                // Store traceback for M
                if (maxMatch === matchFromM) {
                    traceM[i][j] = 'M';
                } else if (maxMatch === matchFromIx) {
                    traceM[i][j] = 'Ix';
                } else {
                    traceM[i][j] = 'Iy';
                }

                // Calculate Ix[i][j] - gap in seq1 (deletion from seq2)
                const gapFromM = M[i-1][j] + gap.gapOpen;
                const gapFromIx = Ix[i-1][j] + gap.gapExtend;
                
                const maxGapX = Math.max(gapFromM, gapFromIx);
                Ix[i][j] = maxGapX;
                
                // Store traceback for Ix
                if (maxGapX === gapFromM) {
                    traceIx[i][j] = 'M';
                } else {
                    traceIx[i][j] = 'Ix';
                }

                // Calculate Iy[i][j] - gap in seq2 (insertion in seq1)
                const gapFromM_y = M[i][j-1] + gap.gapOpen;
                const gapFromIy = Iy[i][j-1] + gap.gapExtend;
                
                const maxGapY = Math.max(gapFromM_y, gapFromIy);
                Iy[i][j] = maxGapY;
                
                // Store traceback for Iy
                if (maxGapY === gapFromM_y) {
                    traceIy[i][j] = 'M';
                } else {
                    traceIy[i][j] = 'Iy';
                }
            }
        }

        // Handle terminal gaps for the final scores
        const finalM = M[m][n];
        const finalIx = Ix[m][n] + gap.endGap;
        const finalIy = Iy[m][n] + gap.endGap;
        
        // Find maximum score and starting matrix for traceback
        let maxScore = Math.max(finalM, finalIx, finalIy);
        let startMatrix = 'M';
        
        if (maxScore === finalIx) {
            startMatrix = 'Ix';
        } else if (maxScore === finalIy) {
            startMatrix = 'Iy';
        }

        // Traceback to reconstruct alignment
        const alignment = this.traceback(seq1, seq2, M, Ix, Iy, traceM, traceIx, traceIy, startMatrix);
        
        // Calculate final score using the scoring system
        const scoreData = this.scoringSystem.calculateAlignmentScore(alignment.alignedSeq1, alignment.alignedSeq2);
        
        return {
            alignedSeq1: alignment.alignedSeq1,
            alignedSeq2: alignment.alignedSeq2,
            score: scoreData.totalScore,
            scoreData: scoreData,
            matrices: {
                M: M,
                Ix: Ix,
                Iy: Iy
            },
            algorithm: 'Global Alignment (Needleman-Wunsch with Affine Gap Penalties)'
        };
    }

    /**
     * Traceback algorithm to reconstruct the optimal alignment
     */
    traceback(seq1, seq2, M, Ix, Iy, traceM, traceIx, traceIy, startMatrix) {
        let alignedSeq1 = '';
        let alignedSeq2 = '';
        let i = seq1.length;
        let j = seq2.length;
        let currentMatrix = startMatrix;

        // Main traceback loop
        while (i > 0 && j > 0) {
            if (currentMatrix === 'M') {
                // Match/mismatch - consume both sequences
                alignedSeq1 = seq1[i-1] + alignedSeq1;
                alignedSeq2 = seq2[j-1] + alignedSeq2;
                currentMatrix = traceM[i][j];
                i--;
                j--;
            } else if (currentMatrix === 'Ix') {
                // Ix: gap in seq1. We came from (i-1,j), so only decrement i
                alignedSeq1 = seq1[i-1] + alignedSeq1; // Use seq1 character
                alignedSeq2 = '-' + alignedSeq2;        // Add gap to seq2
                currentMatrix = traceIx[i][j];
                i--; // Only decrement i (moving to previous row)
            } else if (currentMatrix === 'Iy') {
                // Iy: gap in seq2. We came from (i,j-1), so only decrement j
                alignedSeq1 = '-' + alignedSeq1;        // Add gap to seq1
                alignedSeq2 = seq2[j-1] + alignedSeq2;  // Use seq2 character
                currentMatrix = traceIy[i][j];
                j--; // Only decrement j (moving to previous column)
            }
        }

        // Handle remaining characters in seq1 (if any)
        while (i > 0) {
            alignedSeq1 = seq1[i-1] + alignedSeq1;
            alignedSeq2 = '-' + alignedSeq2;
            i--;
        }

        // Handle remaining characters in seq2 (if any)
        while (j > 0) {
            alignedSeq1 = '-' + alignedSeq1;
            alignedSeq2 = seq2[j-1] + alignedSeq2;
            j--;
        }

        return {
            alignedSeq1: alignedSeq1,
            alignedSeq2: alignedSeq2
        };
    }

    /**
     * Create and initialize a 2D matrix
     */
    createMatrix(rows, cols, initialValue) {
        const matrix = [];
        for (let i = 0; i < rows; i++) {
            matrix[i] = [];
            for (let j = 0; j < cols; j++) {
                matrix[i][j] = initialValue;
            }
        }
        return matrix;
    }

    /**
     * Get alignment summary for debugging
     */
    getAlignmentSummary(result) {
        if (!result) return null;
        
        const summary = {
            sequences: {
                original1: result.alignedSeq1.replace(/-/g, ''),
                original2: result.alignedSeq2.replace(/-/g, ''),
                aligned1: result.alignedSeq1,
                aligned2: result.alignedSeq2
            },
            score: result.score,
            length: result.alignedSeq1.length,
            statistics: result.scoreData,
            algorithm: result.algorithm
        };
        
        return summary;
    }

    /**
     * Validate alignment result
     */
    validateAlignment(result, originalSeq1, originalSeq2) {
        if (!result || !result.alignedSeq1 || !result.alignedSeq2) {
            return { valid: false, error: 'Missing alignment result' };
        }

        // Check alignment length consistency
        if (result.alignedSeq1.length !== result.alignedSeq2.length) {
            return { valid: false, error: 'Aligned sequences have different lengths' };
        }

        // Check that original sequences are preserved (minus gaps)
        const reconstructed1 = result.alignedSeq1.replace(/-/g, '');
        const reconstructed2 = result.alignedSeq2.replace(/-/g, '');
        
        if (reconstructed1 !== originalSeq1.toUpperCase()) {
            return { valid: false, error: 'Sequence 1 not preserved in alignment' };
        }
        
        if (reconstructed2 !== originalSeq2.toUpperCase()) {
            return { valid: false, error: 'Sequence 2 not preserved in alignment' };
        }

        return { valid: true };
    }
}