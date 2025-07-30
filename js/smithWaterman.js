class SmithWaterman {
    constructor() {
        // Direction constants for traceback
        this.DIAGONAL = 'diagonal';
        this.LEFT = 'left';
        this.UP = 'up';
        this.STOP = 'stop';
    }

    findLocalAlignments(seq1, seq2, scoringParams, threshold = 5) {
        if (!seq1 || !seq2 || seq1.length === 0 || seq2.length === 0) {
            return {
                alignments: [],
                matrix: null,
                maxScore: 0
            };
        }

        // Initialize the scoring matrix
        const matrix = this.initializeMatrix(seq1, seq2);
        
        // Fill the matrix using dynamic programming
        const maxScore = this.fillMatrix(matrix, seq1, seq2, scoringParams);
        
        // Find all local alignments above threshold
        const alignments = this.findAllAlignments(matrix, seq1, seq2, scoringParams, threshold);
        
        return {
            alignments: alignments,
            matrix: matrix,
            maxScore: maxScore
        };
    }

    initializeMatrix(seq1, seq2) {
        const rows = seq1.length + 1;
        const cols = seq2.length + 1;
        
        // Create scoring matrix and traceback matrix
        const score = Array(rows).fill().map(() => Array(cols).fill(0));
        const traceback = Array(rows).fill().map(() => Array(cols).fill(this.STOP));
        
        // Smith-Waterman: first row and column remain 0 (no initialization needed)
        
        return { score, traceback, rows, cols };
    }

    fillMatrix(matrix, seq1, seq2, scoringParams) {
        const { score, traceback } = matrix;
        let maxScore = 0;
        
        for (let i = 1; i <= seq1.length; i++) {
            for (let j = 1; j <= seq2.length; j++) {
                const char1 = seq1[i-1];
                const char2 = seq2[j-1];
                
                // Calculate scores for three possible moves
                const matchScore = char1 === char2 ? scoringParams.match : scoringParams.mismatch;
                const diagonal = score[i-1][j-1] + matchScore;
                const gapInSeq1 = score[i-1][j] + scoringParams.gap;
                const gapInSeq2 = score[i][j-1] + scoringParams.gap;
                
                // Smith-Waterman: choose max including 0
                const maxVal = Math.max(0, diagonal, gapInSeq1, gapInSeq2);
                score[i][j] = maxVal;
                
                // Set traceback direction
                if (maxVal === 0) {
                    traceback[i][j] = this.STOP;
                } else if (maxVal === diagonal) {
                    traceback[i][j] = this.DIAGONAL;
                } else if (maxVal === gapInSeq1) {
                    traceback[i][j] = this.UP;
                } else {
                    traceback[i][j] = this.LEFT;
                }
                
                // Track maximum score
                maxScore = Math.max(maxScore, maxVal);
            }
        }
        
        return maxScore;
    }

    findAllAlignments(matrix, seq1, seq2, scoringParams, threshold) {
        const { score, traceback } = matrix;
        const alignments = [];
        const used = Array(matrix.rows).fill().map(() => Array(matrix.cols).fill(false));
        
        // Find all positions with scores above threshold
        const highScorePositions = [];
        for (let i = 1; i <= seq1.length; i++) {
            for (let j = 1; j <= seq2.length; j++) {
                if (score[i][j] >= threshold && !used[i][j]) {
                    highScorePositions.push({ i, j, score: score[i][j] });
                }
            }
        }
        
        // Sort by score (highest first)
        highScorePositions.sort((a, b) => b.score - a.score);
        
        // Perform traceback from each high-scoring position
        for (const pos of highScorePositions) {
            if (!used[pos.i][pos.j]) {
                const alignment = this.traceback(matrix, seq1, seq2, pos.i, pos.j, used);
                if (alignment && alignment.alignedSeq1.length > 0) {
                    alignments.push({
                        ...alignment,
                        score: pos.score
                    });
                }
            }
        }
        
        // Filter out alignments that are completely contained within higher-scoring alignments
        const filteredAlignments = this.filterOverlappingAlignments(alignments);
        
        return filteredAlignments;
    }

    filterOverlappingAlignments(alignments) {
        // Sort alignments by score (highest first)
        alignments.sort((a, b) => b.score - a.score);
        
        const filtered = [];
        
        for (const alignment of alignments) {
            let isContained = false;
            
            // Check if this alignment is completely contained within any higher-scoring alignment
            for (const existing of filtered) {
                if (this.isAlignmentContained(alignment, existing)) {
                    isContained = true;
                    break;
                }
            }
            
            // Only add if not contained within a higher-scoring alignment
            if (!isContained) {
                filtered.push(alignment);
            }
        }
        
        return filtered;
    }

    isAlignmentContained(innerAlignment, outerAlignment) {
        // Check if innerAlignment is completely contained within outerAlignment
        // An alignment is contained if both its start and end positions in both sequences
        // are within the bounds of the outer alignment
        
        const inner1Start = innerAlignment.startPos1;
        const inner1End = innerAlignment.endPos1;
        const inner2Start = innerAlignment.startPos2;
        const inner2End = innerAlignment.endPos2;
        
        const outer1Start = outerAlignment.startPos1;
        const outer1End = outerAlignment.endPos1;
        const outer2Start = outerAlignment.startPos2;
        const outer2End = outerAlignment.endPos2;
        
        // Inner alignment is contained if it's completely within outer alignment bounds
        return (inner1Start >= outer1Start && inner1End <= outer1End &&
                inner2Start >= outer2Start && inner2End <= outer2End);
    }

    traceback(matrix, seq1, seq2, startI, startJ, used) {
        const { score, traceback } = matrix;
        let alignedSeq1 = '';
        let alignedSeq2 = '';
        let i = startI;
        let j = startJ;
        
        const startScore = score[i][j];
        const endI = i;
        const endJ = j;
        
        // Follow the traceback path until we hit a 0 or STOP
        while (i > 0 && j > 0 && score[i][j] > 0 && traceback[i][j] !== this.STOP) {
            used[i][j] = true; // Mark as used
            
            const direction = traceback[i][j];
            
            if (direction === this.DIAGONAL) {
                // Match or mismatch
                alignedSeq1 = seq1[i-1] + alignedSeq1;
                alignedSeq2 = seq2[j-1] + alignedSeq2;
                i--;
                j--;
            } else if (direction === this.UP) {
                // Gap in seq2
                alignedSeq1 = seq1[i-1] + alignedSeq1;
                alignedSeq2 = '-' + alignedSeq2;
                i--;
            } else if (direction === this.LEFT) {
                // Gap in seq1
                alignedSeq1 = '-' + alignedSeq1;
                alignedSeq2 = seq2[j-1] + alignedSeq2;
                j--;
            }
        }
        
        if (alignedSeq1.length === 0) {
            return null;
        }
        
        return {
            alignedSeq1: alignedSeq1,
            alignedSeq2: alignedSeq2,
            startPos1: i, // 0-based position in seq1 where alignment starts
            endPos1: endI - 1, // 0-based position in seq1 where alignment ends
            startPos2: j, // 0-based position in seq2 where alignment starts
            endPos2: endJ - 1, // 0-based position in seq2 where alignment ends
            score: startScore
        };
    }

    // Utility method to get alignment statistics
    getAlignmentStatistics(alignedSeq1, alignedSeq2) {
        if (!alignedSeq1 || !alignedSeq2 || alignedSeq1.length !== alignedSeq2.length) {
            return { matches: 0, mismatches: 0, gaps: 0, identity: 0, length: 0 };
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

    // Debug method to print the scoring matrix
    printMatrix(matrix, seq1, seq2) {
        if (!matrix || !matrix.score) return;
        
        console.log('Smith-Waterman Scoring Matrix:');
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