class DotplotExplorerAlgorithm {
    constructor() {
        this.windowSize = 8; // Default window size for explorer
    }

    setWindowSize(size) {
        this.windowSize = Math.max(1, Math.min(15, size));
    }

    // Get reverse complement of DNA sequence
    getReverseComplement(sequence) {
        const complement = {
            'A': 'T',
            'T': 'A',
            'G': 'C',
            'C': 'G'
        };
        
        return sequence.split('').reverse().map(base => complement[base] || base).join('');
    }

    // Generate all k-mers from a sequence
    generateKmers(sequence, windowSize) {
        const kmers = [];
        for (let i = 0; i <= sequence.length - windowSize; i++) {
            kmers.push({
                sequence: sequence.substring(i, i + windowSize),
                position: i,
                fullSeq: sequence  // Include full sequence for reference
            });
        }
        return kmers;
    }

    // Check if two k-mers match exactly
    kmersMatch(kmer1, kmer2) {
        return kmer1.toUpperCase() === kmer2.toUpperCase();
    }

    // Generate dotplot data for DNA sequences
    generateDotplot(seq1, seq2, windowSize = this.windowSize) {
        // Clean and validate sequences
        const cleanSeq1 = this.cleanDnaSequence(seq1);
        const cleanSeq2 = this.cleanDnaSequence(seq2);
        
        if (!cleanSeq1 || !cleanSeq2) {
            return {
                forwardMatches: [],
                reverseMatches: [],
                seq1: cleanSeq1,
                seq2: cleanSeq2,
                seq2Reverse: '',
                windowSize: windowSize,
                statistics: this.calculateStatistics([], [], cleanSeq1, cleanSeq2, windowSize)
            };
        }

        // Get reverse complement of sequence 2
        const seq2Reverse = this.getReverseComplement(cleanSeq2);

        // Generate k-mers for all sequences
        const seq1Kmers = this.generateKmers(cleanSeq1, windowSize);
        const seq2Kmers = this.generateKmers(cleanSeq2, windowSize);
        const seq2ReverseKmers = this.generateKmers(seq2Reverse, windowSize);

        // Find forward matches (seq1 vs seq2)
        const forwardMatches = this.findMatches(seq1Kmers, seq2Kmers, 'forward');
        
        // Find reverse matches (seq1 vs seq2 reverse complement)
        const reverseMatches = this.findMatches(seq1Kmers, seq2ReverseKmers, 'reverse');

        // Store matches for alignment block detection
        this.forwardMatches = forwardMatches;
        this.reverseMatches = reverseMatches;

        return {
            forwardMatches,
            reverseMatches,
            seq1: cleanSeq1,
            seq2: cleanSeq2,
            seq2Reverse: seq2Reverse,
            windowSize: windowSize,
            statistics: this.calculateStatistics(forwardMatches, reverseMatches, cleanSeq1, cleanSeq2, windowSize)
        };
    }

    // Find matches by comparing sequences base-by-base and forming diagonal lines
    findMatches(kmers1, kmers2, matchType) {
        const seq1 = kmers1[0].fullSeq;
        const seq2 = kmers2[0].fullSeq;
        
        // Find all individual base matches first
        const baseMatches = [];
        for (let i = 0; i < seq1.length; i++) {
            for (let j = 0; j < seq2.length; j++) {
                if (seq1[i].toUpperCase() === seq2[j].toUpperCase()) {
                    baseMatches.push({ seq1Pos: i, seq2Pos: j });
                }
            }
        }
        
        // Find diagonal lines of consecutive matches
        const diagonalLines = this.findDiagonalLines(baseMatches, this.windowSize);
        
        // Convert to match objects for visualization
        const matches = [];
        for (const line of diagonalLines) {
            for (let i = 0; i < line.length; i++) {
                matches.push({
                    seq1Position: line.startSeq1 + i,
                    seq2Position: line.startSeq2 + i,
                    seq1Kmer: this.getSubsequence(seq1, line.startSeq1, this.windowSize),
                    seq2Kmer: this.getSubsequence(seq2, line.startSeq2, this.windowSize),
                    matchType: matchType,
                    windowSize: this.windowSize,
                    lineLength: line.length,
                    lineStart: i === 0,
                    lineEnd: i === line.length - 1,
                    length: 1  // Each match represents one position
                });
            }
        }
        
        return matches;
    }

    // Get subsequence safely
    getSubsequence(sequence, start, length) {
        if (start < 0 || start >= sequence.length) return '';
        const end = Math.min(start + length, sequence.length);
        return sequence.substring(start, end);
    }

    // Find diagonal lines from base matches
    findDiagonalLines(baseMatches, minLength) {
        const lines = [];
        const processed = new Set();
        
        // Create a lookup set for fast checking
        const matchSet = new Set();
        for (const match of baseMatches) {
            matchSet.add(`${match.seq1Pos},${match.seq2Pos}`);
        }
        
        for (const match of baseMatches) {
            const key = `${match.seq1Pos},${match.seq2Pos}`;
            if (processed.has(key)) continue;
            
            // Trace the diagonal line starting from this match
            const line = this.traceDiagonalLine(match, matchSet);
            
            // Mark all positions in this line as processed
            for (let i = 0; i < line.length; i++) {
                const lineKey = `${line.startSeq1 + i},${line.startSeq2 + i}`;
                processed.add(lineKey);
            }
            
            // Only include lines that meet the minimum length requirement
            if (line.length >= minLength) {
                lines.push(line);
            }
        }
        
        return lines;
    }

    // Trace a diagonal line from a starting match position
    traceDiagonalLine(startMatch, matchSet) {
        const startSeq1 = startMatch.seq1Pos;
        const startSeq2 = startMatch.seq2Pos;
        
        // Find the leftmost position of the diagonal line
        let leftMostSeq1 = startSeq1;
        let leftMostSeq2 = startSeq2;
        
        // Extend backwards (up-left) while we have consecutive matches
        while (leftMostSeq1 > 0 && leftMostSeq2 > 0) {
            const prevKey = `${leftMostSeq1 - 1},${leftMostSeq2 - 1}`;
            if (matchSet.has(prevKey)) {
                leftMostSeq1--;
                leftMostSeq2--;
            } else {
                break;
            }
        }
        
        // Find the rightmost position of the diagonal line
        let rightMostSeq1 = startSeq1;
        let rightMostSeq2 = startSeq2;
        
        // Extend forwards (down-right) while we have consecutive matches
        while (true) {
            const nextKey = `${rightMostSeq1 + 1},${rightMostSeq2 + 1}`;
            if (matchSet.has(nextKey)) {
                rightMostSeq1++;
                rightMostSeq2++;
            } else {
                break;
            }
        }
        
        // Calculate the length of the diagonal line
        const lineLength = rightMostSeq1 - leftMostSeq1 + 1;
        
        return {
            startSeq1: leftMostSeq1,
            startSeq2: leftMostSeq2,
            length: lineLength
        };
    }

    // Clean DNA sequence - keep only valid DNA bases
    cleanDnaSequence(sequence) {
        if (!sequence) return '';
        
        // Remove all non-DNA characters and convert to uppercase
        const cleaned = sequence.toUpperCase().replace(/[^ATGC]/g, '');
        
        // Return empty string if sequence is too short for the window size
        if (cleaned.length < this.windowSize) return '';
        
        return cleaned;
    }

    // Calculate statistics about the dotplot
    calculateStatistics(forwardMatches, reverseMatches, seq1, seq2, windowSize) {
        const totalMatches = forwardMatches.length + reverseMatches.length;
        const maxPossibleMatches = this.calculateMaxPossibleMatches(seq1, seq2, windowSize);
        
        return {
            seq1Length: seq1.length,
            seq2Length: seq2.length,
            windowSize: windowSize,
            forwardMatches: forwardMatches.length,
            reverseMatches: reverseMatches.length,
            totalMatches: totalMatches,
            maxPossibleMatches: maxPossibleMatches,
            matchDensity: maxPossibleMatches > 0 ? (totalMatches / maxPossibleMatches * 100).toFixed(1) + '%' : '0%'
        };
    }

    // Calculate maximum possible matches given sequence lengths and window size
    calculateMaxPossibleMatches(seq1, seq2, windowSize) {
        if (seq1.length < windowSize || seq2.length < windowSize) return 0;
        
        const seq1Windows = seq1.length - windowSize + 1;
        const seq2Windows = seq2.length - windowSize + 1;
        
        // Maximum is if every window in seq1 matched every window in seq2 (both forward and reverse)
        return seq1Windows * seq2Windows * 2; // x2 for forward and reverse
    }

    // Simple alignment block detection for "Show Alignments" functionality
    // This should correspond to the diagonal lines in the dotplot
    findAlignmentBlocks() {
        if (!this.forwardMatches || !this.reverseMatches) return [];
        
        const blocks = [];
        
        // Convert diagonal lines to alignment blocks
        const forwardLines = this.groupMatchesIntoLines(this.forwardMatches);
        const reverseLines = this.groupMatchesIntoLines(this.reverseMatches);
        
        // Convert forward lines to blocks
        for (const line of forwardLines) {
            if (line.length === 0) continue;
            
            const startMatch = line[0];
            const endMatch = line[line.length - 1];
            const lineLength = endMatch.seq1Position - startMatch.seq1Position + 1;
            
            // Only include lines that are longer than single matches
            if (lineLength >= this.windowSize) {
                blocks.push({
                    startSeq1: startMatch.seq1Position,
                    endSeq1: endMatch.seq1Position,
                    startSeq2: startMatch.seq2Position,
                    endSeq2: endMatch.seq2Position,
                    matches: line,
                    isReverse: false,
                    score: lineLength,
                    identity: 1.0 // Perfect identity for diagonal lines
                });
            }
        }
        
        // Convert reverse lines to blocks
        for (const line of reverseLines) {
            if (line.length === 0) continue;
            
            const startMatch = line[0];
            const endMatch = line[line.length - 1];
            const lineLength = endMatch.seq1Position - startMatch.seq1Position + 1;
            
            // Only include lines that are longer than single matches
            if (lineLength >= this.windowSize) {
                blocks.push({
                    startSeq1: startMatch.seq1Position,
                    endSeq1: endMatch.seq1Position,
                    startSeq2: startMatch.seq2Position,
                    endSeq2: endMatch.seq2Position,
                    matches: line,
                    isReverse: true,
                    score: lineLength,
                    identity: 1.0 // Perfect identity for diagonal lines
                });
            }
        }
        
        return blocks;
    }

    // Group matches into diagonal lines (reuse the logic from visualizer)
    groupMatchesIntoLines(matches) {
        const lines = [];
        const processed = new Set();

        for (const match of matches) {
            const key = `${match.seq1Position},${match.seq2Position}`;
            if (processed.has(key)) continue;

            // Find all matches that belong to the same diagonal line
            const line = [];
            const lineLength = match.lineLength || 1;
            const startSeq1 = match.seq1Position - (match.lineStart ? 0 : this.findPositionInLine(match, matches));
            const startSeq2 = match.seq2Position - (match.lineStart ? 0 : this.findPositionInLine(match, matches));

            // Collect all matches in this line
            for (let i = 0; i < lineLength; i++) {
                const lineSeq1 = startSeq1 + i;
                const lineSeq2 = startSeq2 + i;
                
                const lineMatch = matches.find(m => 
                    m.seq1Position === lineSeq1 && m.seq2Position === lineSeq2
                );
                
                if (lineMatch) {
                    line.push(lineMatch);
                    processed.add(`${lineMatch.seq1Position},${lineMatch.seq2Position}`);
                }
            }

            if (line.length > 0) {
                // Sort line by position to ensure proper order
                line.sort((a, b) => a.seq1Position - b.seq1Position);
                lines.push(line);
            }
        }

        return lines;
    }

    findPositionInLine(match, allMatches) {
        // This is a helper method to find where a match sits within its line
        if (match.lineStart) return 0;
        
        // Count how many matches come before this one in the same line
        let position = 0;
        const lineSeq1Start = match.seq1Position - position;
        const lineSeq2Start = match.seq2Position - position;
        
        while (position < match.seq1Position) {
            const prevMatch = allMatches.find(m => 
                m.seq1Position === lineSeq1Start + position && 
                m.seq2Position === lineSeq2Start + position
            );
            if (!prevMatch) break;
            position++;
        }
        
        return position;
    }

    getExamplesList() {
        if (!window.DOTPLOT_EXPLORER_EXAMPLES) return [];
        
        return Object.entries(window.DOTPLOT_EXPLORER_EXAMPLES).map(([key, example]) => ({
            key: key,
            name: example.name,
            description: example.description
        }));
    }

    getExample(key) {
        if (!window.DOTPLOT_EXPLORER_EXAMPLES || !window.DOTPLOT_EXPLORER_EXAMPLES[key]) {
            return null;
        }
        return window.DOTPLOT_EXPLORER_EXAMPLES[key];
    }

    validateDnaSequence(sequence) {
        if (!sequence || typeof sequence !== 'string') {
            return { valid: false, message: 'Sequence cannot be empty', cleaned: '' };
        }
        
        if (sequence.length > 200) {
            return { valid: false, message: 'Sequence too long (max 200 bases)', cleaned: sequence.substring(0, 200) };
        }

        const cleaned = sequence.toUpperCase().replace(/[^ATGC]/g, '');
        
        if (cleaned.length < 3) {
            return { valid: false, message: 'Sequence too short (min 3 bases)', cleaned: cleaned };
        }

        if (cleaned.length !== sequence.replace(/[^A-Za-z]/g, '').length) {
            return { valid: false, message: 'Sequence contains invalid characters (use A, T, G, C only)', cleaned: cleaned };
        }

        return { valid: true, message: 'Valid DNA sequence', cleaned: cleaned };
    }
}