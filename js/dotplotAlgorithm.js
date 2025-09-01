class DotplotAlgorithm {
    constructor() {
        this.windowSize = 3;
    }

    setWindowSize(size) {
        this.windowSize = Math.max(1, Math.min(10, size));
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
                    lineEnd: i === line.length - 1
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

    // Get educational example sequences from external config file
    getExampleSequences() {
        // Access the global DOTPLOT_EXAMPLES defined in dotplotExamples.js
        return window.DOTPLOT_EXAMPLES || {};
    }
    
    // Get a specific example by key
    getExample(key) {
        const examples = this.getExampleSequences();
        return examples[key] || examples['self-comparison'];
    }
    
    // Get list of example keys and names for menu
    getExamplesList() {
        const examples = this.getExampleSequences();
        return Object.keys(examples).map(key => ({
            key: key,
            name: examples[key].name,
            description: examples[key].description
        }));
    }

    // Validate DNA sequence
    validateDnaSequence(sequence) {
        if (!sequence || typeof sequence !== 'string') {
            return { valid: false, message: 'Sequence cannot be empty' };
        }
        
        const cleaned = sequence.toUpperCase().replace(/[^ATGC]/g, '');
        
        if (cleaned.length === 0) {
            return { valid: false, message: 'Sequence must contain valid DNA bases (A, T, G, C)' };
        }
        
        if (cleaned.length < this.windowSize) {
            return { valid: false, message: `Sequence must be at least ${this.windowSize} bases long for current window size` };
        }
        
        if (cleaned.length > 50) {
            return { valid: false, message: 'Sequence must be 50 bases or shorter' };
        }
        
        return { valid: true, cleaned: cleaned };
    }
}