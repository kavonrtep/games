class KmerMatcher {
    constructor() {
        this.matches = [];
        this.queryKmers = [];
        this.databaseSequence = '';
        this.kmerLength = 3;
    }

    // Find all matches between query k-mers and database sequence
    findMatches(queryKmers, databaseSequence, kmerLength) {
        this.queryKmers = queryKmers;
        this.databaseSequence = databaseSequence.toUpperCase();
        this.kmerLength = kmerLength;
        this.matches = [];

        // For each query k-mer, find all matching positions in database
        queryKmers.forEach(queryKmer => {
            const matchPositions = this.findKmerInDatabase(queryKmer.sequence);
            
            matchPositions.forEach(dbPosition => {
                this.matches.push({
                    queryKmer: queryKmer.sequence,
                    queryPosition: queryKmer.position,
                    dbPosition: dbPosition,
                    kmerId: queryKmer.id,
                    matchId: this.matches.length
                });
            });
        });

        return this.matches;
    }

    // Find all positions where a k-mer occurs in the database sequence
    findKmerInDatabase(kmerSequence) {
        const positions = [];
        const sequence = kmerSequence.toUpperCase();
        
        for (let i = 0; i <= this.databaseSequence.length - this.kmerLength; i++) {
            const dbKmer = this.databaseSequence.substring(i, i + this.kmerLength);
            if (dbKmer === sequence) {
                positions.push(i);
            }
        }

        return positions;
    }

    // Get matches grouped by k-mer sequence
    getMatchesByKmer() {
        const grouped = {};
        
        this.matches.forEach(match => {
            if (!grouped[match.queryKmer]) {
                grouped[match.queryKmer] = [];
            }
            grouped[match.queryKmer].push(match);
        });

        return grouped;
    }

    // Get matches grouped by query position
    getMatchesByQueryPosition() {
        const grouped = {};
        
        this.matches.forEach(match => {
            if (!grouped[match.queryPosition]) {
                grouped[match.queryPosition] = [];
            }
            grouped[match.queryPosition].push(match);
        });

        return grouped;
    }

    // Get matches grouped by database position
    getMatchesByDatabasePosition() {
        const grouped = {};
        
        this.matches.forEach(match => {
            if (!grouped[match.dbPosition]) {
                grouped[match.dbPosition] = [];
            }
            grouped[match.dbPosition].push(match);
        });

        return grouped;
    }

    // Get matches sorted by database position
    getMatchesSortedByDbPosition() {
        return [...this.matches].sort((a, b) => a.dbPosition - b.dbPosition);
    }

    // Get matches sorted by query position
    getMatchesSortedByQueryPosition() {
        return [...this.matches].sort((a, b) => a.queryPosition - b.queryPosition);
    }

    // Get matches for a specific k-mer
    getMatchesForKmer(kmerSequence) {
        return this.matches.filter(match => match.queryKmer === kmerSequence.toUpperCase());
    }

    // Get matches in a specific database region
    getMatchesInDatabaseRegion(startPos, endPos) {
        return this.matches.filter(match => 
            match.dbPosition >= startPos && 
            match.dbPosition + this.kmerLength - 1 <= endPos
        );
    }

    // Get matches in a specific query region
    getMatchesInQueryRegion(startPos, endPos) {
        return this.matches.filter(match => 
            match.queryPosition >= startPos && 
            match.queryPosition + this.kmerLength - 1 <= endPos
        );
    }

    // Find overlapping matches (same database position, different query positions)
    getOverlappingMatches() {
        const dbPositions = {};
        const overlapping = [];

        this.matches.forEach(match => {
            if (!dbPositions[match.dbPosition]) {
                dbPositions[match.dbPosition] = [];
            }
            dbPositions[match.dbPosition].push(match);
        });

        Object.values(dbPositions).forEach(matches => {
            if (matches.length > 1) {
                overlapping.push({
                    dbPosition: matches[0].dbPosition,
                    matches: matches,
                    count: matches.length
                });
            }
        });

        return overlapping;
    }

    // Calculate match density in database regions
    getMatchDensity(windowSize = 10) {
        const densities = [];
        
        for (let i = 0; i <= this.databaseSequence.length - windowSize; i++) {
            const matchesInWindow = this.getMatchesInDatabaseRegion(i, i + windowSize - 1);
            densities.push({
                position: i,
                endPosition: i + windowSize - 1,
                matchCount: matchesInWindow.length,
                density: matchesInWindow.length / windowSize
            });
        }

        return densities;
    }

    // Find regions with high match density (potential alignment regions)
    getHighDensityRegions(windowSize = 10, minDensity = 0.3) {
        const densities = this.getMatchDensity(windowSize);
        return densities.filter(region => region.density >= minDensity);
    }

    // Get diagonal matches (where query and database positions have same offset)
    getDiagonalMatches() {
        const diagonals = {};
        
        this.matches.forEach(match => {
            const diagonal = match.dbPosition - match.queryPosition;
            if (!diagonals[diagonal]) {
                diagonals[diagonal] = [];
            }
            diagonals[diagonal].push(match);
        });

        // Convert to array format with diagonal information
        return Object.entries(diagonals).map(([diagonal, matches]) => ({
            diagonal: parseInt(diagonal),
            matches: matches,
            count: matches.length,
            startQuery: Math.min(...matches.map(m => m.queryPosition)),
            endQuery: Math.max(...matches.map(m => m.queryPosition)),
            startDb: Math.min(...matches.map(m => m.dbPosition)),
            endDb: Math.max(...matches.map(m => m.dbPosition))
        })).sort((a, b) => b.count - a.count); // Sort by match count
    }

    // Get statistics about the matches
    getMatchStatistics() {
        const uniqueKmers = new Set(this.matches.map(m => m.queryKmer));
        const dbPositions = new Set(this.matches.map(m => m.dbPosition));
        const queryPositions = new Set(this.matches.map(m => m.queryPosition));
        
        const kmerCounts = {};
        this.matches.forEach(match => {
            kmerCounts[match.queryKmer] = (kmerCounts[match.queryKmer] || 0) + 1;
        });

        const mostFrequentKmer = Object.entries(kmerCounts).reduce((a, b) => 
            kmerCounts[a[0]] > kmerCounts[b[0]] ? a : b, ['', 0]
        );

        return {
            totalMatches: this.matches.length,
            uniqueMatchingKmers: uniqueKmers.size,
            uniqueDatabasePositions: dbPositions.size,
            uniqueQueryPositions: queryPositions.size,
            averageMatchesPerKmer: this.matches.length / uniqueKmers.size,
            mostFrequentKmer: mostFrequentKmer[0],
            mostFrequentKmerCount: mostFrequentKmer[1],
            databaseCoverage: (dbPositions.size * this.kmerLength) / this.databaseSequence.length,
            diagonalCount: this.getDiagonalMatches().length
        };
    }

    // Filter matches by minimum frequency
    filterByFrequency(minFrequency) {
        const kmerCounts = {};
        this.matches.forEach(match => {
            kmerCounts[match.queryKmer] = (kmerCounts[match.queryKmer] || 0) + 1;
        });

        return this.matches.filter(match => kmerCounts[match.queryKmer] >= minFrequency);
    }

    // Filter matches to remove redundant ones
    filterRedundantMatches(maxGap = 1) {
        const sorted = this.getMatchesSortedByDbPosition();
        const filtered = [];
        
        sorted.forEach(match => {
            // Check if this match is too close to an already selected match
            const isRedundant = filtered.some(existing => 
                Math.abs(match.dbPosition - existing.dbPosition) <= maxGap &&
                Math.abs(match.queryPosition - existing.queryPosition) <= maxGap
            );
            
            if (!isRedundant) {
                filtered.push(match);
            }
        });

        return filtered;
    }

    // Clear current data
    clear() {
        this.matches = [];
        this.queryKmers = [];
        this.databaseSequence = '';
        this.kmerLength = 3;
    }
}