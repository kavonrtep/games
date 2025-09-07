class AlignmentExtender {
    constructor() {
        this.extensions = [];
        this.querySequence = '';
        this.databaseSequence = '';
        this.scoringParams = {
            match: 2,
            mismatch: -1,
            gap: -2
        };
        this.extensionThreshold = 1; // Stop when score drops below this from maximum
        this.maxDropoff = 5; // Maximum score drop before stopping
    }

    // Extend alignments around seeds
    extendAlignments(seeds, querySequence, databaseSequence, scoringParams = null) {
        this.querySequence = querySequence.toUpperCase();
        this.databaseSequence = databaseSequence.toUpperCase();
        
        if (scoringParams) {
            this.scoringParams = { ...scoringParams };
        }
        
        this.extensions = [];

        seeds.forEach((seed, index) => {
            const extension = this.extendSeed(seed, index);
            if (extension) {
                this.extensions.push(extension);
            }
        });

        // Sort extensions by score (descending)
        this.extensions.sort((a, b) => b.totalScore - a.totalScore);

        // Assign final IDs
        this.extensions.forEach((ext, index) => {
            ext.finalId = index;
        });

        return this.extensions;
    }

    // Extend a single seed bidirectionally
    extendSeed(seed, seedId) {
        // Start with the seed region
        let alignmentStart = {
            query: seed.queryStart,
            db: seed.dbStart
        };
        
        let alignmentEnd = {
            query: seed.queryEnd,
            db: seed.dbEnd
        };

        // Extend left (toward sequence beginnings)
        const leftExtension = this.extendLeft(
            seed.queryStart - 1, 
            seed.dbStart - 1, 
            seed.score
        );

        // Extend right (toward sequence ends)
        const rightExtension = this.extendRight(
            seed.queryEnd + 1, 
            seed.dbEnd + 1, 
            seed.score
        );

        // Update alignment boundaries
        alignmentStart.query = leftExtension.finalQueryPos;
        alignmentStart.db = leftExtension.finalDbPos;
        alignmentEnd.query = rightExtension.finalQueryPos;
        alignmentEnd.db = rightExtension.finalDbPos;

        // Create the final alignment
        const queryAlignment = this.querySequence.substring(alignmentStart.query, alignmentEnd.query + 1);
        const dbAlignment = this.databaseSequence.substring(alignmentStart.db, alignmentEnd.db + 1);

        // Calculate final statistics
        const alignmentStats = this.calculateAlignmentStats(queryAlignment, dbAlignment);
        const totalScore = seed.score + leftExtension.scoreGain + rightExtension.scoreGain;

        return {
            seedId: seedId,
            originalSeed: seed,
            queryStart: alignmentStart.query,
            queryEnd: alignmentEnd.query,
            dbStart: alignmentStart.db,
            dbEnd: alignmentEnd.db,
            queryAlignment: queryAlignment,
            dbAlignment: dbAlignment,
            seedScore: seed.score,
            leftExtensionScore: leftExtension.scoreGain,
            rightExtensionScore: rightExtension.scoreGain,
            totalScore: totalScore,
            length: alignmentEnd.query - alignmentStart.query + 1,
            ...alignmentStats,
            leftExtension: leftExtension,
            rightExtension: rightExtension
        };
    }

    // Extend alignment to the left (toward sequence beginnings)
    extendLeft(startQueryPos, startDbPos, initialScore) {
        let queryPos = startQueryPos;
        let dbPos = startDbPos;
        let currentScore = 0;
        let maxScore = 0;
        let bestQueryPos = startQueryPos + 1; // +1 because we start one position before seed
        let bestDbPos = startDbPos + 1;
        
        const extensionPath = [];

        while (queryPos >= 0 && dbPos >= 0) {
            const queryChar = this.querySequence[queryPos];
            const dbChar = this.databaseSequence[dbPos];
            
            // Score this position
            let positionScore;
            if (queryChar === dbChar) {
                positionScore = this.scoringParams.match;
            } else {
                positionScore = this.scoringParams.mismatch;
            }

            currentScore += positionScore;
            
            extensionPath.push({
                queryPos: queryPos,
                dbPos: dbPos,
                queryChar: queryChar,
                dbChar: dbChar,
                score: positionScore,
                cumulativeScore: currentScore,
                isMatch: queryChar === dbChar
            });

            // Track the best position
            if (currentScore > maxScore) {
                maxScore = currentScore;
                bestQueryPos = queryPos;
                bestDbPos = dbPos;
            }

            // Stop if score drops too much below maximum
            if (currentScore < maxScore - this.maxDropoff || 
                currentScore < -this.extensionThreshold) {
                break;
            }

            queryPos--;
            dbPos--;
        }

        return {
            finalQueryPos: bestQueryPos,
            finalDbPos: bestDbPos,
            scoreGain: maxScore,
            extensionLength: startQueryPos - bestQueryPos + 1,
            extensionPath: extensionPath.reverse(), // Reverse to get 5' to 3' order
            stoppedAtBoundary: queryPos < 0 || dbPos < 0,
            stoppedAtDropoff: currentScore < maxScore - this.maxDropoff
        };
    }

    // Extend alignment to the right (toward sequence ends)
    extendRight(startQueryPos, startDbPos, initialScore) {
        let queryPos = startQueryPos;
        let dbPos = startDbPos;
        let currentScore = 0;
        let maxScore = 0;
        let bestQueryPos = startQueryPos - 1; // -1 because we start one position after seed
        let bestDbPos = startDbPos - 1;
        
        const extensionPath = [];

        while (queryPos < this.querySequence.length && dbPos < this.databaseSequence.length) {
            const queryChar = this.querySequence[queryPos];
            const dbChar = this.databaseSequence[dbPos];
            
            // Score this position
            let positionScore;
            if (queryChar === dbChar) {
                positionScore = this.scoringParams.match;
            } else {
                positionScore = this.scoringParams.mismatch;
            }

            currentScore += positionScore;
            
            extensionPath.push({
                queryPos: queryPos,
                dbPos: dbPos,
                queryChar: queryChar,
                dbChar: dbChar,
                score: positionScore,
                cumulativeScore: currentScore,
                isMatch: queryChar === dbChar
            });

            // Track the best position
            if (currentScore > maxScore) {
                maxScore = currentScore;
                bestQueryPos = queryPos;
                bestDbPos = dbPos;
            }

            // Stop if score drops too much below maximum
            if (currentScore < maxScore - this.maxDropoff || 
                currentScore < -this.extensionThreshold) {
                break;
            }

            queryPos++;
            dbPos++;
        }

        return {
            finalQueryPos: bestQueryPos,
            finalDbPos: bestDbPos,
            scoreGain: maxScore,
            extensionLength: bestQueryPos - startQueryPos + 1,
            extensionPath: extensionPath,
            stoppedAtBoundary: queryPos >= this.querySequence.length || dbPos >= this.databaseSequence.length,
            stoppedAtDropoff: currentScore < maxScore - this.maxDropoff
        };
    }

    // Calculate alignment statistics
    calculateAlignmentStats(queryAlignment, dbAlignment) {
        if (queryAlignment.length !== dbAlignment.length) {
            return {
                matches: 0,
                mismatches: 0,
                identity: 0,
                similarity: 0,
                gaps: 0
            };
        }

        let matches = 0;
        let mismatches = 0;
        let gaps = 0;

        for (let i = 0; i < queryAlignment.length; i++) {
            const q = queryAlignment[i];
            const d = dbAlignment[i];
            
            if (q === '-' || d === '-') {
                gaps++;
            } else if (q === d) {
                matches++;
            } else {
                mismatches++;
            }
        }

        const identity = queryAlignment.length > 0 ? (matches / queryAlignment.length) * 100 : 0;
        const similarity = identity; // Simplified - in practice, consider conservative substitutions

        return {
            matches: matches,
            mismatches: mismatches,
            gaps: gaps,
            identity: Math.round(identity * 10) / 10,
            similarity: Math.round(similarity * 10) / 10,
            alignmentLength: queryAlignment.length
        };
    }

    // Get extensions sorted by score
    getExtensionsSortedByScore() {
        return [...this.extensions].sort((a, b) => b.totalScore - a.totalScore);
    }

    // Get extensions sorted by length
    getExtensionsSortedByLength() {
        return [...this.extensions].sort((a, b) => b.length - a.length);
    }

    // Get extensions sorted by identity
    getExtensionsSortedByIdentity() {
        return [...this.extensions].sort((a, b) => b.identity - a.identity);
    }

    // Filter extensions by minimum score
    filterByScore(minScore) {
        return this.extensions.filter(ext => ext.totalScore >= minScore);
    }

    // Filter extensions by minimum length
    filterByLength(minLength) {
        return this.extensions.filter(ext => ext.length >= minLength);
    }

    // Filter extensions by minimum identity
    filterByIdentity(minIdentity) {
        return this.extensions.filter(ext => ext.identity >= minIdentity);
    }

    // Get extensions in a specific query region
    getExtensionsInQueryRegion(startPos, endPos) {
        return this.extensions.filter(ext => 
            ext.queryStart <= endPos && ext.queryEnd >= startPos
        );
    }

    // Get extensions in a specific database region
    getExtensionsInDatabaseRegion(startPos, endPos) {
        return this.extensions.filter(ext => 
            ext.dbStart <= endPos && ext.dbEnd >= startPos
        );
    }

    // Check for overlapping extensions
    getOverlappingExtensions() {
        const overlapping = [];
        
        for (let i = 0; i < this.extensions.length; i++) {
            for (let j = i + 1; j < this.extensions.length; j++) {
                const ext1 = this.extensions[i];
                const ext2 = this.extensions[j];
                
                const queryOverlap = !(ext1.queryEnd < ext2.queryStart || ext2.queryEnd < ext1.queryStart);
                const dbOverlap = !(ext1.dbEnd < ext2.dbStart || ext2.dbEnd < ext1.dbStart);
                
                if (queryOverlap && dbOverlap) {
                    overlapping.push({
                        extension1: ext1,
                        extension2: ext2,
                        queryOverlapLength: Math.min(ext1.queryEnd, ext2.queryEnd) - Math.max(ext1.queryStart, ext2.queryStart) + 1,
                        dbOverlapLength: Math.min(ext1.dbEnd, ext2.dbEnd) - Math.max(ext1.dbStart, ext2.dbStart) + 1
                    });
                }
            }
        }
        
        return overlapping;
    }

    // Get extension statistics
    getExtensionStatistics() {
        if (this.extensions.length === 0) {
            return {
                totalExtensions: 0,
                averageScore: 0,
                averageLength: 0,
                averageIdentity: 0,
                bestExtension: null,
                longestExtension: null
            };
        }

        const totalScore = this.extensions.reduce((sum, ext) => sum + ext.totalScore, 0);
        const totalLength = this.extensions.reduce((sum, ext) => sum + ext.length, 0);
        const totalIdentity = this.extensions.reduce((sum, ext) => sum + ext.identity, 0);
        
        const bestExtension = this.extensions.reduce((best, ext) => 
            ext.totalScore > best.totalScore ? ext : best
        );
        
        const longestExtension = this.extensions.reduce((longest, ext) => 
            ext.length > longest.length ? ext : longest
        );

        return {
            totalExtensions: this.extensions.length,
            averageScore: totalScore / this.extensions.length,
            averageLength: totalLength / this.extensions.length,
            averageIdentity: totalIdentity / this.extensions.length,
            bestExtension: bestExtension,
            longestExtension: longestExtension,
            scoreRange: {
                min: Math.min(...this.extensions.map(e => e.totalScore)),
                max: Math.max(...this.extensions.map(e => e.totalScore))
            },
            lengthRange: {
                min: Math.min(...this.extensions.map(e => e.length)),
                max: Math.max(...this.extensions.map(e => e.length))
            }
        };
    }

    // Get detailed information about a specific extension
    getExtensionDetails(extensionId) {
        const extension = this.extensions.find(e => e.finalId === extensionId || e.seedId === extensionId);
        if (!extension) return null;

        return {
            ...extension,
            formattedAlignment: this.formatAlignment(extension),
            extensionAnalysis: this.analyzeExtension(extension)
        };
    }

    // Format alignment for display
    formatAlignment(extension) {
        const querySeq = extension.queryAlignment;
        const dbSeq = extension.dbAlignment;
        
        // Create match line
        let matchLine = '';
        for (let i = 0; i < querySeq.length; i++) {
            if (querySeq[i] === dbSeq[i]) {
                matchLine += '|';
            } else {
                matchLine += ' ';
            }
        }

        return {
            query: `${extension.queryStart + 1} ${querySeq} ${extension.queryEnd + 1}`,
            match: `${' '.repeat((extension.queryStart + 1).toString().length)} ${matchLine}`,
            database: `${extension.dbStart + 1} ${dbSeq} ${extension.dbEnd + 1}`
        };
    }

    // Analyze extension quality and characteristics
    analyzeExtension(extension) {
        const seedContribution = (extension.seedScore / extension.totalScore) * 100;
        const leftContribution = (extension.leftExtensionScore / extension.totalScore) * 100;
        const rightContribution = (extension.rightExtensionScore / extension.totalScore) * 100;

        return {
            seedContribution: Math.round(seedContribution * 10) / 10,
            leftContribution: Math.round(leftContribution * 10) / 10,
            rightContribution: Math.round(rightContribution * 10) / 10,
            extensionEfficiency: ((extension.leftExtensionScore + extension.rightExtensionScore) / 
                                 (extension.leftExtension.extensionLength + extension.rightExtension.extensionLength)) || 0,
            balancedExtension: Math.abs(extension.leftExtensionScore - extension.rightExtensionScore) < extension.seedScore * 0.1,
            qualityScore: this.calculateQualityScore(extension)
        };
    }

    // Calculate a quality score for an extension
    calculateQualityScore(extension) {
        // Combine multiple factors: score, length, identity
        const scoreComponent = Math.min(extension.totalScore / 20, 1) * 40; // Max 40 points
        const lengthComponent = Math.min(extension.length / 50, 1) * 30;    // Max 30 points
        const identityComponent = extension.identity * 0.3;                 // Max 30 points (100% identity)
        
        return Math.round(scoreComponent + lengthComponent + identityComponent);
    }

    // Clear current data
    clear() {
        this.extensions = [];
        this.querySequence = '';
        this.databaseSequence = '';
    }
}