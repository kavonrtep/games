class KmerGenerator {
    constructor() {
        this.kmers = [];
        this.sequence = '';
        this.kmerLength = 3;
    }

    // Generate k-mers from a sequence
    generateKmers(sequence, kmerLength) {
        this.sequence = sequence.toUpperCase();
        this.kmerLength = kmerLength;
        this.kmers = [];

        if (sequence.length < kmerLength) {
            return [];
        }

        for (let i = 0; i <= sequence.length - kmerLength; i++) {
            const kmer = sequence.substring(i, i + kmerLength);
            this.kmers.push({
                sequence: kmer,
                position: i,
                id: i,
                endPosition: i + kmerLength - 1
            });
        }

        return this.kmers;
    }

    // Get k-mers with additional metadata
    getKmersWithMetadata() {
        const kmerFrequency = {};
        
        // Count frequency of each k-mer
        this.kmers.forEach(kmer => {
            kmerFrequency[kmer.sequence] = (kmerFrequency[kmer.sequence] || 0) + 1;
        });

        // Add frequency information to k-mers
        return this.kmers.map(kmer => ({
            ...kmer,
            frequency: kmerFrequency[kmer.sequence],
            isUnique: kmerFrequency[kmer.sequence] === 1
        }));
    }

    // Get unique k-mers only
    getUniqueKmers() {
        const seen = new Set();
        const uniqueKmers = [];

        this.kmers.forEach(kmer => {
            if (!seen.has(kmer.sequence)) {
                seen.add(kmer.sequence);
                uniqueKmers.push(kmer);
            }
        });

        return uniqueKmers;
    }

    // Get k-mer frequencies
    getKmerFrequencies() {
        const frequencies = {};
        
        this.kmers.forEach(kmer => {
            frequencies[kmer.sequence] = (frequencies[kmer.sequence] || 0) + 1;
        });

        return frequencies;
    }

    // Get k-mers sorted by position
    getKmersByPosition() {
        return [...this.kmers].sort((a, b) => a.position - b.position);
    }

    // Get k-mers sorted by sequence (alphabetically)
    getKmersBySequence() {
        return [...this.kmers].sort((a, b) => a.sequence.localeCompare(b.sequence));
    }

    // Find k-mers that contain a specific character
    getKmersContaining(character) {
        return this.kmers.filter(kmer => kmer.sequence.includes(character.toUpperCase()));
    }

    // Get k-mer at specific position
    getKmerAtPosition(position) {
        return this.kmers.find(kmer => kmer.position === position);
    }

    // Get overlapping k-mers for a position
    getOverlappingKmers(position) {
        return this.kmers.filter(kmer => 
            position >= kmer.position && position <= kmer.endPosition
        );
    }

    // Validate k-mer parameters
    static validateParameters(sequence, kmerLength) {
        const errors = [];

        if (!sequence || sequence.length === 0) {
            errors.push('Sequence cannot be empty');
        }

        if (kmerLength < 1) {
            errors.push('K-mer length must be at least 1');
        }

        if (sequence && sequence.length < kmerLength) {
            errors.push(`Sequence length (${sequence.length}) must be at least k-mer length (${kmerLength})`);
        }

        // Check for valid DNA characters
        if (sequence && !/^[ATCGN]+$/i.test(sequence)) {
            errors.push('Sequence contains invalid characters. Only A, T, C, G, N are allowed');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // Get statistics about the k-mers
    getStatistics() {
        const uniqueKmers = this.getUniqueKmers();
        const frequencies = this.getKmerFrequencies();
        const maxFreq = Math.max(...Object.values(frequencies));
        const mostCommon = Object.entries(frequencies).filter(([_, freq]) => freq === maxFreq);

        return {
            totalKmers: this.kmers.length,
            uniqueKmers: uniqueKmers.length,
            duplicateKmers: this.kmers.length - uniqueKmers.length,
            maxFrequency: maxFreq,
            mostCommonKmers: mostCommon.map(([seq, _]) => seq),
            averageFrequency: this.kmers.length / uniqueKmers.length,
            complexityRatio: uniqueKmers.length / this.kmers.length // Lower ratio = more repetitive
        };
    }

    // Clear current data
    clear() {
        this.kmers = [];
        this.sequence = '';
        this.kmerLength = 3;
    }
}