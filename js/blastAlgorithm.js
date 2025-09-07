class BlastAlgorithm {
    constructor() {
        this.querySequence = '';
        this.databaseSequence = '';
        this.kmerLength = 3;
        this.currentStep = 0;
        this.stepData = {
            kmers: [],
            matches: [],
            seeds: [],
            extensions: [],
            results: []
        };
        
        // Scoring parameters for extension
        this.scoringParams = {
            match: 2,
            mismatch: -1,
            gap: -2
        };
        
        // Extension parameters
        this.extensionThreshold = 1; // Stop extension when score drops below this
        this.seedMinLength = 2; // Minimum number of k-mers to form a seed
        this.seedMaxGap = 1; // Maximum gap between k-mers in a seed
    }

    // Initialize with sequences
    initialize(querySeq, databaseSeq, kmerLength = 3) {
        this.querySequence = querySeq.toUpperCase();
        this.databaseSequence = databaseSeq.toUpperCase();
        this.kmerLength = kmerLength;
        this.currentStep = 0;
        
        // Clear previous results
        this.stepData = {
            kmers: [],
            matches: [],
            seeds: [],
            extensions: [],
            results: []
        };
        
        return this.isValidInput();
    }

    // Validate input sequences
    isValidInput() {
        if (!this.querySequence || !this.databaseSequence) {
            return { valid: false, error: 'Both sequences are required' };
        }
        
        if (this.querySequence.length < this.kmerLength) {
            return { valid: false, error: `Query sequence must be at least ${this.kmerLength} characters` };
        }
        
        if (this.databaseSequence.length < this.kmerLength) {
            return { valid: false, error: `Database sequence must be at least ${this.kmerLength} characters` };
        }
        
        // Check for valid DNA characters
        const validChars = /^[ATCGN]+$/;
        if (!validChars.test(this.querySequence) || !validChars.test(this.databaseSequence)) {
            return { valid: false, error: 'Sequences must contain only valid DNA characters (A, T, C, G, N)' };
        }
        
        return { valid: true };
    }

    // Execute specific step
    executeStep(stepNumber) {
        switch (stepNumber) {
            case 0:
                return this.generateKmers();
            case 1:
                return this.findMatches();
            case 2:
                return this.identifySeeds();
            case 3:
                return this.extendAlignments();
            case 4:
                return this.finalizeResults();
            default:
                return { success: false, error: 'Invalid step number' };
        }
    }

    // Step 1: Generate k-mers from query sequence
    generateKmers() {
        this.stepData.kmers = [];
        
        for (let i = 0; i <= this.querySequence.length - this.kmerLength; i++) {
            const kmer = this.querySequence.substring(i, i + this.kmerLength);
            this.stepData.kmers.push({
                sequence: kmer,
                position: i,
                id: i
            });
        }
        
        this.currentStep = 0;
        return {
            success: true,
            kmers: this.stepData.kmers,
            count: this.stepData.kmers.length
        };
    }

    // Step 2: Find matches for each k-mer in database sequence
    findMatches() {
        this.stepData.matches = [];
        
        this.stepData.kmers.forEach(kmer => {
            const matches = [];
            
            // Find all positions where this k-mer occurs in database
            for (let i = 0; i <= this.databaseSequence.length - this.kmerLength; i++) {
                const dbKmer = this.databaseSequence.substring(i, i + this.kmerLength);
                if (dbKmer === kmer.sequence) {
                    matches.push({
                        queryPos: kmer.position,
                        dbPos: i,
                        kmer: kmer.sequence,
                        kmerId: kmer.id
                    });
                }
            }
            
            this.stepData.matches.push(...matches);
        });
        
        this.currentStep = 1;
        return {
            success: true,
            matches: this.stepData.matches,
            count: this.stepData.matches.length,
            uniqueKmers: this.getUniqueMatchingKmers().length
        };
    }

    // Step 3: Identify seeds by clustering nearby matches
    identifySeeds() {
        this.stepData.seeds = [];
        
        if (this.stepData.matches.length === 0) {
            this.currentStep = 2;
            return {
                success: true,
                seeds: [],
                count: 0
            };
        }
        
        // Sort matches by database position
        const sortedMatches = [...this.stepData.matches].sort((a, b) => a.dbPos - b.dbPos);
        
        // Cluster matches into seeds
        let currentSeed = null;
        
        for (const match of sortedMatches) {
            if (!currentSeed) {
                // Start new seed
                currentSeed = {
                    matches: [match],
                    startQuery: match.queryPos,
                    endQuery: match.queryPos + this.kmerLength - 1,
                    startDb: match.dbPos,
                    endDb: match.dbPos + this.kmerLength - 1,
                    score: this.kmerLength * this.scoringParams.match
                };
            } else {
                // Check if this match can be added to current seed
                const queryGap = match.queryPos - (currentSeed.endQuery + 1);
                const dbGap = match.dbPos - (currentSeed.endDb + 1);
                
                // Allow some flexibility in gap sizes
                if (Math.abs(queryGap - dbGap) <= this.seedMaxGap && 
                    queryGap <= this.seedMaxGap && dbGap <= this.seedMaxGap) {
                    
                    // Add to current seed
                    currentSeed.matches.push(match);
                    currentSeed.endQuery = match.queryPos + this.kmerLength - 1;
                    currentSeed.endDb = match.dbPos + this.kmerLength - 1;
                    currentSeed.score += this.kmerLength * this.scoringParams.match;
                } else {
                    // Finish current seed if it meets minimum requirements
                    if (currentSeed.matches.length >= this.seedMinLength) {
                        this.stepData.seeds.push({
                            ...currentSeed,
                            id: this.stepData.seeds.length,
                            length: currentSeed.endQuery - currentSeed.startQuery + 1
                        });
                    }
                    
                    // Start new seed
                    currentSeed = {
                        matches: [match],
                        startQuery: match.queryPos,
                        endQuery: match.queryPos + this.kmerLength - 1,
                        startDb: match.dbPos,
                        endDb: match.dbPos + this.kmerLength - 1,
                        score: this.kmerLength * this.scoringParams.match
                    };
                }
            }
        }
        
        // Don't forget the last seed
        if (currentSeed && currentSeed.matches.length >= this.seedMinLength) {
            this.stepData.seeds.push({
                ...currentSeed,
                id: this.stepData.seeds.length,
                length: currentSeed.endQuery - currentSeed.startQuery + 1
            });
        }
        
        // Sort seeds by score (highest first)
        this.stepData.seeds.sort((a, b) => b.score - a.score);
        
        this.currentStep = 2;
        return {
            success: true,
            seeds: this.stepData.seeds,
            count: this.stepData.seeds.length
        };
    }

    // Step 4: Extend alignments around seeds
    extendAlignments() {
        this.stepData.extensions = [];
        
        for (const seed of this.stepData.seeds) {
            const extension = this.extendSeed(seed);
            if (extension) {
                this.stepData.extensions.push(extension);
            }
        }
        
        // Sort extensions by score
        this.stepData.extensions.sort((a, b) => b.score - a.score);
        
        this.currentStep = 3;
        return {
            success: true,
            extensions: this.stepData.extensions,
            count: this.stepData.extensions.length
        };
    }

    // Step 5: Finalize results
    finalizeResults() {
        this.stepData.results = this.stepData.extensions.filter(ext => ext.score > 0);
        
        this.currentStep = 4;
        return {
            success: true,
            results: this.stepData.results,
            count: this.stepData.results.length,
            bestScore: this.stepData.results.length > 0 ? this.stepData.results[0].score : 0
        };
    }

    // Helper method to extend a seed bidirectionally
    extendSeed(seed) {
        const startQuery = seed.startQuery;
        const startDb = seed.startDb;
        const endQuery = seed.endQuery;
        const endDb = seed.endDb;
        
        // Extend left (towards beginning of sequences)
        let leftExtQuery = startQuery - 1;
        let leftExtDb = startDb - 1;
        let leftScore = 0;
        let maxLeftScore = 0;
        let bestLeftQuery = startQuery;
        let bestLeftDb = startDb;
        
        while (leftExtQuery >= 0 && leftExtDb >= 0) {
            const queryChar = this.querySequence[leftExtQuery];
            const dbChar = this.databaseSequence[leftExtDb];
            
            if (queryChar === dbChar) {
                leftScore += this.scoringParams.match;
            } else {
                leftScore += this.scoringParams.mismatch;
            }
            
            if (leftScore > maxLeftScore) {
                maxLeftScore = leftScore;
                bestLeftQuery = leftExtQuery;
                bestLeftDb = leftExtDb;
            }
            
            // Stop if score drops too much below maximum
            if (leftScore < maxLeftScore - Math.abs(this.extensionThreshold)) {
                break;
            }
            
            leftExtQuery--;
            leftExtDb--;
        }
        
        // Extend right (towards end of sequences)
        let rightExtQuery = endQuery + 1;
        let rightExtDb = endDb + 1;
        let rightScore = 0;
        let maxRightScore = 0;
        let bestRightQuery = endQuery;
        let bestRightDb = endDb;
        
        while (rightExtQuery < this.querySequence.length && rightExtDb < this.databaseSequence.length) {
            const queryChar = this.querySequence[rightExtQuery];
            const dbChar = this.databaseSequence[rightExtDb];
            
            if (queryChar === dbChar) {
                rightScore += this.scoringParams.match;
            } else {
                rightScore += this.scoringParams.mismatch;
            }
            
            if (rightScore > maxRightScore) {
                maxRightScore = rightScore;
                bestRightQuery = rightExtQuery;
                bestRightDb = rightExtDb;
            }
            
            // Stop if score drops too much below maximum
            if (rightScore < maxRightScore - Math.abs(this.extensionThreshold)) {
                break;
            }
            
            rightExtQuery++;
            rightExtDb++;
        }
        
        // Calculate final alignment
        const finalStartQuery = bestLeftQuery;
        const finalEndQuery = bestRightQuery;
        const finalStartDb = bestLeftDb;
        const finalEndDb = bestRightDb;
        
        const queryAlignment = this.querySequence.substring(finalStartQuery, finalEndQuery + 1);
        const dbAlignment = this.databaseSequence.substring(finalStartDb, finalEndDb + 1);
        
        // Calculate final score
        let finalScore = seed.score + maxLeftScore + maxRightScore;
        
        return {
            seedId: seed.id,
            queryStart: finalStartQuery,
            queryEnd: finalEndQuery,
            dbStart: finalStartDb,
            dbEnd: finalEndDb,
            queryAlignment: queryAlignment,
            dbAlignment: dbAlignment,
            score: finalScore,
            length: finalEndQuery - finalStartQuery + 1,
            identity: this.calculateIdentity(queryAlignment, dbAlignment)
        };
    }

    // Helper method to calculate identity percentage
    calculateIdentity(seq1, seq2) {
        if (seq1.length !== seq2.length) return 0;
        
        let matches = 0;
        for (let i = 0; i < seq1.length; i++) {
            if (seq1[i] === seq2[i]) matches++;
        }
        
        return Math.round((matches / seq1.length) * 100);
    }

    // Helper method to get unique matching k-mers
    getUniqueMatchingKmers() {
        const uniqueKmers = new Set();
        this.stepData.matches.forEach(match => {
            uniqueKmers.add(match.kmer);
        });
        return Array.from(uniqueKmers);
    }

    // Get current step data
    getCurrentStepData() {
        switch (this.currentStep) {
            case 0:
                return { kmers: this.stepData.kmers };
            case 1:
                return { matches: this.stepData.matches };
            case 2:
                return { seeds: this.stepData.seeds };
            case 3:
                return { extensions: this.stepData.extensions };
            case 4:
                return { results: this.stepData.results };
            default:
                return {};
        }
    }

    // Get summary statistics
    getSummary() {
        return {
            kmersCount: this.stepData.kmers.length,
            matchesCount: this.stepData.matches.length,
            seedsCount: this.stepData.seeds.length,
            extensionsCount: this.stepData.extensions.length,
            resultsCount: this.stepData.results.length,
            bestScore: this.stepData.results.length > 0 ? this.stepData.results[0].score : 0
        };
    }
}