class SeedIdentifier {
    constructor() {
        this.seeds = [];
        this.matches = [];
        this.minSeedLength = 2; // Minimum number of k-mers to form a seed
        this.maxGap = 1; // Maximum gap between k-mers in a seed
        this.kmerLength = 3;
    }

    // Identify seeds from k-mer matches
    identifySeeds(matches, kmerLength, minSeedLength = 2, maxGap = 1) {
        this.matches = matches;
        this.kmerLength = kmerLength;
        this.minSeedLength = minSeedLength;
        this.maxGap = maxGap;
        this.seeds = [];

        if (matches.length === 0) {
            return this.seeds;
        }

        // Group matches by diagonal (where dbPos - queryPos is constant)
        const diagonalGroups = this.groupMatchesByDiagonal();
        
        // Process each diagonal to find seeds
        diagonalGroups.forEach(diagonal => {
            const diagonalSeeds = this.findSeedsInDiagonal(diagonal);
            this.seeds.push(...diagonalSeeds);
        });

        // Sort seeds by score (descending)
        this.seeds.sort((a, b) => b.score - a.score);

        // Assign unique IDs
        this.seeds.forEach((seed, index) => {
            seed.id = index;
        });

        return this.seeds;
    }

    // Group matches by diagonal line
    groupMatchesByDiagonal() {
        const diagonals = {};
        
        this.matches.forEach(match => {
            const diagonal = match.dbPosition - match.queryPosition;
            if (!diagonals[diagonal]) {
                diagonals[diagonal] = {
                    diagonal: diagonal,
                    matches: []
                };
            }
            diagonals[diagonal].matches.push(match);
        });

        // Sort matches within each diagonal by position
        Object.values(diagonals).forEach(diagonal => {
            diagonal.matches.sort((a, b) => a.queryPosition - b.queryPosition);
        });

        return Object.values(diagonals);
    }

    // Find seeds within a single diagonal
    findSeedsInDiagonal(diagonalGroup) {
        const matches = diagonalGroup.matches;
        const seeds = [];
        
        if (matches.length < this.minSeedLength) {
            return seeds;
        }

        let currentSeed = null;

        matches.forEach(match => {
            if (!currentSeed) {
                // Start new seed
                currentSeed = this.createNewSeed(match, diagonalGroup.diagonal);
            } else {
                // Check if this match can be added to current seed
                const queryGap = match.queryPosition - currentSeed.queryEnd - 1;
                const dbGap = match.dbPosition - currentSeed.dbEnd - 1;
                
                if (this.canAddToSeed(currentSeed, match, queryGap, dbGap)) {
                    // Add match to current seed
                    this.addMatchToSeed(currentSeed, match);
                } else {
                    // Finish current seed if it meets requirements
                    if (this.isValidSeed(currentSeed)) {
                        seeds.push(this.finalizeSeed(currentSeed));
                    }
                    
                    // Start new seed with current match
                    currentSeed = this.createNewSeed(match, diagonalGroup.diagonal);
                }
            }
        });

        // Don't forget the last seed
        if (currentSeed && this.isValidSeed(currentSeed)) {
            seeds.push(this.finalizeSeed(currentSeed));
        }

        return seeds;
    }

    // Create a new seed with the first match
    createNewSeed(match, diagonal) {
        return {
            diagonal: diagonal,
            matches: [match],
            queryStart: match.queryPosition,
            queryEnd: match.queryPosition + this.kmerLength - 1,
            dbStart: match.dbPosition,
            dbEnd: match.dbPosition + this.kmerLength - 1,
            score: this.kmerLength * 2, // Assuming match score of +2
            kmers: [match.queryKmer]
        };
    }

    // Check if a match can be added to an existing seed
    canAddToSeed(seed, match, queryGap, dbGap) {
        // Allow some flexibility in gap sizes
        return queryGap <= this.maxGap && 
               dbGap <= this.maxGap && 
               Math.abs(queryGap - dbGap) <= this.maxGap;
    }

    // Add a match to an existing seed
    addMatchToSeed(seed, match) {
        seed.matches.push(match);
        seed.queryEnd = match.queryPosition + this.kmerLength - 1;
        seed.dbEnd = match.dbPosition + this.kmerLength - 1;
        seed.score += this.kmerLength * 2; // Add match score
        seed.kmers.push(match.queryKmer);
    }

    // Check if a seed meets minimum requirements
    isValidSeed(seed) {
        return seed.matches.length >= this.minSeedLength;
    }

    // Finalize a seed by calculating additional properties
    finalizeSeed(seed) {
        return {
            ...seed,
            length: seed.queryEnd - seed.queryStart + 1,
            dbLength: seed.dbEnd - seed.dbStart + 1,
            matchCount: seed.matches.length,
            density: seed.matches.length / (seed.queryEnd - seed.queryStart + 1),
            coverage: (seed.matches.length * this.kmerLength) / (seed.queryEnd - seed.queryStart + 1)
        };
    }

    // Get seeds sorted by different criteria
    getSeedsSortedByScore() {
        return [...this.seeds].sort((a, b) => b.score - a.score);
    }

    getSeedsSortedByLength() {
        return [...this.seeds].sort((a, b) => b.length - a.length);
    }

    getSeedsSortedByPosition() {
        return [...this.seeds].sort((a, b) => a.queryStart - b.queryStart);
    }

    getSeedsSortedByDensity() {
        return [...this.seeds].sort((a, b) => b.density - a.density);
    }

    // Filter seeds by various criteria
    filterByMinScore(minScore) {
        return this.seeds.filter(seed => seed.score >= minScore);
    }

    filterByMinLength(minLength) {
        return this.seeds.filter(seed => seed.length >= minLength);
    }

    filterByMinDensity(minDensity) {
        return this.seeds.filter(seed => seed.density >= minDensity);
    }

    // Get seeds in a specific query region
    getSeedsInQueryRegion(startPos, endPos) {
        return this.seeds.filter(seed => 
            seed.queryStart <= endPos && seed.queryEnd >= startPos
        );
    }

    // Get seeds in a specific database region
    getSeedsInDatabaseRegion(startPos, endPos) {
        return this.seeds.filter(seed => 
            seed.dbStart <= endPos && seed.dbEnd >= startPos
        );
    }

    // Check for overlapping seeds
    getOverlappingSeeds() {
        const overlapping = [];
        
        for (let i = 0; i < this.seeds.length; i++) {
            for (let j = i + 1; j < this.seeds.length; j++) {
                const seed1 = this.seeds[i];
                const seed2 = this.seeds[j];
                
                // Check for overlap in query coordinates
                const queryOverlap = !(seed1.queryEnd < seed2.queryStart || seed2.queryEnd < seed1.queryStart);
                // Check for overlap in database coordinates
                const dbOverlap = !(seed1.dbEnd < seed2.dbStart || seed2.dbEnd < seed1.dbStart);
                
                if (queryOverlap && dbOverlap) {
                    overlapping.push({
                        seed1: seed1,
                        seed2: seed2,
                        queryOverlapLength: Math.min(seed1.queryEnd, seed2.queryEnd) - Math.max(seed1.queryStart, seed2.queryStart) + 1,
                        dbOverlapLength: Math.min(seed1.dbEnd, seed2.dbEnd) - Math.max(seed1.dbStart, seed2.dbStart) + 1
                    });
                }
            }
        }
        
        return overlapping;
    }

    // Remove redundant/overlapping seeds
    removeRedundantSeeds(overlapThreshold = 0.5) {
        const filtered = [];
        const used = new Set();

        // Sort by score (highest first)
        const sortedSeeds = this.getSeedsSortedByScore();

        sortedSeeds.forEach(seed => {
            if (used.has(seed.id)) return;

            let isRedundant = false;
            
            for (const existingSeed of filtered) {
                const queryOverlap = Math.max(0, Math.min(seed.queryEnd, existingSeed.queryEnd) - Math.max(seed.queryStart, existingSeed.queryStart) + 1);
                const dbOverlap = Math.max(0, Math.min(seed.dbEnd, existingSeed.dbEnd) - Math.max(seed.dbStart, existingSeed.dbStart) + 1);
                
                const queryOverlapRatio = queryOverlap / seed.length;
                const dbOverlapRatio = dbOverlap / seed.dbLength;
                
                if (queryOverlapRatio > overlapThreshold && dbOverlapRatio > overlapThreshold) {
                    isRedundant = true;
                    used.add(seed.id);
                    break;
                }
            }

            if (!isRedundant) {
                filtered.push(seed);
            }
        });

        return filtered;
    }

    // Get seed statistics
    getSeedStatistics() {
        if (this.seeds.length === 0) {
            return {
                totalSeeds: 0,
                averageLength: 0,
                averageScore: 0,
                averageDensity: 0,
                longestSeed: null,
                highestScoredSeed: null,
                totalMatches: 0
            };
        }

        const totalLength = this.seeds.reduce((sum, seed) => sum + seed.length, 0);
        const totalScore = this.seeds.reduce((sum, seed) => sum + seed.score, 0);
        const totalDensity = this.seeds.reduce((sum, seed) => sum + seed.density, 0);
        const totalMatches = this.seeds.reduce((sum, seed) => sum + seed.matchCount, 0);
        
        const longestSeed = this.seeds.reduce((longest, seed) => 
            seed.length > longest.length ? seed : longest
        );
        
        const highestScoredSeed = this.seeds.reduce((highest, seed) => 
            seed.score > highest.score ? seed : highest
        );

        return {
            totalSeeds: this.seeds.length,
            averageLength: totalLength / this.seeds.length,
            averageScore: totalScore / this.seeds.length,
            averageDensity: totalDensity / this.seeds.length,
            longestSeed: longestSeed,
            highestScoredSeed: highestScoredSeed,
            totalMatches: totalMatches,
            uniqueDiagonals: new Set(this.seeds.map(s => s.diagonal)).size
        };
    }

    // Get detailed information about a specific seed
    getSeedDetails(seedId) {
        const seed = this.seeds.find(s => s.id === seedId);
        if (!seed) return null;

        return {
            ...seed,
            matchDetails: seed.matches.map(match => ({
                queryPos: match.queryPosition,
                dbPos: match.dbPosition,
                kmer: match.queryKmer,
                offset: match.dbPosition - match.queryPosition
            })),
            gapAnalysis: this.analyzeSeedGaps(seed),
            extensionPotential: this.assessExtensionPotential(seed)
        };
    }

    // Analyze gaps within a seed
    analyzeSeedGaps(seed) {
        if (seed.matches.length < 2) return { hasGaps: false, gaps: [] };
        
        const gaps = [];
        const sortedMatches = seed.matches.sort((a, b) => a.queryPosition - b.queryPosition);
        
        for (let i = 1; i < sortedMatches.length; i++) {
            const prev = sortedMatches[i - 1];
            const curr = sortedMatches[i];
            
            const queryGap = curr.queryPosition - (prev.queryPosition + this.kmerLength);
            const dbGap = curr.dbPosition - (prev.dbPosition + this.kmerLength);
            
            if (queryGap > 0 || dbGap > 0) {
                gaps.push({
                    position: i,
                    queryGap: queryGap,
                    dbGap: dbGap,
                    gapDifference: Math.abs(queryGap - dbGap)
                });
            }
        }
        
        return {
            hasGaps: gaps.length > 0,
            gaps: gaps,
            totalGaps: gaps.length,
            averageGapSize: gaps.length > 0 ? gaps.reduce((sum, gap) => sum + Math.max(gap.queryGap, gap.dbGap), 0) / gaps.length : 0
        };
    }

    // Assess potential for extending a seed
    assessExtensionPotential(seed) {
        // This is a simplified assessment - in practice, you'd want to look at
        // the actual sequences around the seed
        return {
            leftExtensionPotential: seed.queryStart > 0 && seed.dbStart > 0,
            rightExtensionPotential: true, // Would need sequence lengths to assess properly
            estimatedExtensionScore: seed.score * 0.3, // Rough estimate
            confidenceLevel: seed.density > 0.7 ? 'high' : seed.density > 0.4 ? 'medium' : 'low'
        };
    }

    // Clear current data
    clear() {
        this.seeds = [];
        this.matches = [];
    }
}