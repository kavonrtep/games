class AdvancedStatisticsCalculator {
    constructor() {
        this.currentStats = null;
        this.elements = {};
        this.initializeElements();
    }

    initializeElements() {
        // Get all statistics display elements
        this.elements = {
            totalScore: document.getElementById('total-score'),
            alignmentLength: document.getElementById('alignment-length'),
            identityPercent: document.getElementById('identity-percent'),
            matchesCount: document.getElementById('matches-count'),
            mismatchesCount: document.getElementById('mismatches-count'),
            gapsCount: document.getElementById('gaps-count'),
            gapOpeningsCount: document.getElementById('gap-openings-count'),
            matchScoreTotal: document.getElementById('match-score-total'),
            gapPenaltyTotal: document.getElementById('gap-penalty-total'),
            endGapPenaltyTotal: document.getElementById('end-gap-penalty-total')
        };

        // Check if all elements exist
        Object.keys(this.elements).forEach(key => {
            if (!this.elements[key]) {
                console.warn(`Statistics element not found: ${key}`);
            }
        });
    }

    updateStatistics(scoreData) {
        if (!scoreData) {
            this.clearStatistics();
            return;
        }

        this.currentStats = scoreData;
        this.displayStatistics(scoreData);
        this.animateChanges();
    }

    displayStatistics(scoreData) {
        // Update each statistic with proper formatting and validation
        this.updateElement('totalScore', this.formatScore(scoreData.totalScore));
        this.updateElement('alignmentLength', scoreData.alignmentLength || 0);
        this.updateElement('identityPercent', this.formatPercentage(scoreData.identity));
        this.updateElement('matchesCount', scoreData.matches || 0);
        this.updateElement('mismatchesCount', scoreData.mismatches || 0);
        this.updateElement('gapsCount', scoreData.gaps || 0);
        this.updateElement('gapOpeningsCount', scoreData.gapOpenings || 0);
        
        // Score breakdowns
        this.updateElement('matchScoreTotal', this.formatScore(scoreData.matchScore + (scoreData.mismatchScore || 0)));
        this.updateElement('gapPenaltyTotal', this.formatScore(scoreData.gapPenaltyScore));
        this.updateElement('endGapPenaltyTotal', this.formatScore(scoreData.endGapPenaltyScore));
    }

    updateElement(elementKey, value, className = null) {
        const element = this.elements[elementKey];
        if (!element) return;

        const formattedValue = this.formatValue(value);
        
        if (element.textContent !== formattedValue) {
            element.textContent = formattedValue;
            
            // Add update animation
            element.classList.add('stat-updated');
            setTimeout(() => element.classList.remove('stat-updated'), 300);
            
            // Apply color coding for scores
            if (className) {
                element.className = `stat-value ${className}`;
            } else {
                element.className = 'stat-value';
                this.applyScoreColoring(element, value);
            }
        }
    }

    formatValue(value) {
        if (value === null || value === undefined) return '0';
        if (typeof value === 'number') {
            return Math.round(value * 10) / 10;
        }
        return String(value);
    }

    formatScore(score) {
        if (score === null || score === undefined || isNaN(score)) return '0';
        return Math.round(score * 10) / 10;
    }

    formatPercentage(percent) {
        if (percent === null || percent === undefined || isNaN(percent)) return '0%';
        return `${Math.round(percent * 10) / 10}%`;
    }

    applyScoreColoring(element, value) {
        if (typeof value !== 'number') return;
        
        element.classList.remove('score-positive', 'score-negative', 'score-neutral');
        
        if (value > 0) {
            element.classList.add('score-positive');
        } else if (value < 0) {
            element.classList.add('score-negative');
        } else {
            element.classList.add('score-neutral');
        }
    }

    animateChanges() {
        // Animate the entire statistics panel when updated
        const statsPanel = document.querySelector('.statistics-panel');
        if (statsPanel) {
            statsPanel.classList.add('stats-updated');
            setTimeout(() => statsPanel.classList.remove('stats-updated'), 500);
        }
    }

    clearStatistics() {
        Object.keys(this.elements).forEach(key => {
            if (this.elements[key]) {
                if (key === 'identityPercent') {
                    this.elements[key].textContent = '0%';
                } else {
                    this.elements[key].textContent = '0';
                }
                this.elements[key].className = 'stat-value';
            }
        });
        
        this.currentStats = null;
    }

    getCurrentStatistics() {
        return this.currentStats;
    }

    // Generate detailed statistics report
    generateDetailedReport(alignment, scoreData) {
        if (!scoreData || !alignment) {
            return null;
        }

        const report = {
            // Basic alignment info
            alignmentInfo: {
                originalSeq1: alignment.originalSeq1,
                originalSeq2: alignment.originalSeq2,
                alignedSeq1: alignment.alignedSeq1,
                alignedSeq2: alignment.alignedSeq2,
                sequenceType: alignment.sequenceType || 'DNA',
                alignmentLength: scoreData.alignmentLength
            },

            // Scoring details
            scoring: {
                totalScore: scoreData.totalScore,
                matchScore: scoreData.matchScore || 0,
                mismatchScore: scoreData.mismatchScore || 0,
                gapPenaltyScore: scoreData.gapPenaltyScore || 0,
                endGapPenaltyScore: scoreData.endGapPenaltyScore || 0
            },

            // Alignment composition
            composition: {
                matches: scoreData.matches || 0,
                mismatches: scoreData.mismatches || 0,
                gaps: scoreData.gaps || 0,
                gapOpenings: scoreData.gapOpenings || 0,
                identity: scoreData.identity || 0
            },

            // Quality metrics
            quality: {
                identityPercentage: scoreData.identity || 0,
                gapPercentage: scoreData.alignmentLength > 0 ? 
                    ((scoreData.gaps || 0) / scoreData.alignmentLength) * 100 : 0,
                averageGapLength: (scoreData.gapOpenings || 0) > 0 ? 
                    (scoreData.gaps || 0) / (scoreData.gapOpenings || 1) : 0,
                scorePerPosition: scoreData.alignmentLength > 0 ? 
                    scoreData.totalScore / scoreData.alignmentLength : 0
            },

            // Timestamp
            timestamp: new Date().toISOString(),
            
            // Breakdown by position (if available)
            breakdown: scoreData.breakdown || []
        };

        return report;
    }

    // Export statistics in various formats
    exportStatistics(alignment, scoreData, format = 'json') {
        const report = this.generateDetailedReport(alignment, scoreData);
        if (!report) return null;

        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(report, null, 2);

            case 'csv':
                return this.generateCSV(report);

            case 'text':
                return this.generateTextReport(report);

            case 'html':
                return this.generateHTMLReport(report);

            default:
                return JSON.stringify(report, null, 2);
        }
    }

    generateCSV(report) {
        const lines = [];
        
        // Header
        lines.push('Metric,Value');
        
        // Basic metrics
        lines.push(`Total Score,${report.scoring.totalScore}`);
        lines.push(`Alignment Length,${report.alignmentInfo.alignmentLength}`);
        lines.push(`Identity,${report.composition.matches}`);
        lines.push(`Mismatches,${report.composition.mismatches}`);
        lines.push(`Gaps,${report.composition.gaps}`);
        lines.push(`Gap Openings,${report.composition.gapOpenings}`);
        lines.push(`Identity Percentage,${report.quality.identityPercentage}`);
        lines.push(`Gap Percentage,${report.quality.gapPercentage}`);
        
        return lines.join('\n');
    }

    generateTextReport(report) {
        const lines = [];
        
        lines.push('ADVANCED GLOBAL ALIGNMENT STATISTICS');
        lines.push('====================================');
        lines.push('');
        
        lines.push('ALIGNMENT INFORMATION:');
        lines.push(`  Original Sequence 1: ${report.alignmentInfo.originalSeq1}`);
        lines.push(`  Original Sequence 2: ${report.alignmentInfo.originalSeq2}`);
        lines.push(`  Aligned Sequence 1:  ${report.alignmentInfo.alignedSeq1}`);
        lines.push(`  Aligned Sequence 2:  ${report.alignmentInfo.alignedSeq2}`);
        lines.push(`  Alignment Length:    ${report.alignmentInfo.alignmentLength}`);
        lines.push('');
        
        lines.push('SCORING SUMMARY:');
        lines.push(`  Total Score:         ${report.scoring.totalScore}`);
        lines.push(`  Match/Mismatch Score: ${report.scoring.matchScore + report.scoring.mismatchScore}`);
        lines.push(`  Gap Penalty Score:   ${report.scoring.gapPenaltyScore}`);
        lines.push(`  End Gap Penalty:     ${report.scoring.endGapPenaltyScore}`);
        lines.push('');
        
        lines.push('ALIGNMENT COMPOSITION:');
        lines.push(`  Matches:             ${report.composition.matches}`);
        lines.push(`  Mismatches:          ${report.composition.mismatches}`);
        lines.push(`  Gaps:                ${report.composition.gaps}`);
        lines.push(`  Gap Openings:        ${report.composition.gapOpenings}`);
        lines.push('');
        
        lines.push('QUALITY METRICS:');
        lines.push(`  Identity:            ${report.quality.identityPercentage.toFixed(1)}%`);
        lines.push(`  Gap Coverage:        ${report.quality.gapPercentage.toFixed(1)}%`);
        lines.push(`  Average Gap Length:  ${report.quality.averageGapLength.toFixed(1)}`);
        lines.push(`  Score/Position:      ${report.quality.scorePerPosition.toFixed(2)}`);
        lines.push('');
        
        lines.push(`Generated: ${new Date(report.timestamp).toLocaleString()}`);
        
        return lines.join('\n');
    }

    generateHTMLReport(report) {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Alignment Statistics Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .alignment { font-family: monospace; background: #f5f5f5; padding: 10px; margin: 10px 0; }
        .stats-table { border-collapse: collapse; width: 100%; }
        .stats-table th, .stats-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .stats-table th { background-color: #f2f2f2; }
        .positive { color: green; }
        .negative { color: red; }
    </style>
</head>
<body>
    <h1>Advanced Global Alignment Statistics</h1>
    
    <h2>Alignment</h2>
    <div class="alignment">
        <div>Seq1: ${report.alignmentInfo.alignedSeq1}</div>
        <div>Seq2: ${report.alignmentInfo.alignedSeq2}</div>
    </div>
    
    <h2>Statistics</h2>
    <table class="stats-table">
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Total Score</td><td class="${report.scoring.totalScore >= 0 ? 'positive' : 'negative'}">${report.scoring.totalScore}</td></tr>
        <tr><td>Alignment Length</td><td>${report.alignmentInfo.alignmentLength}</td></tr>
        <tr><td>Identity</td><td>${report.quality.identityPercentage.toFixed(1)}%</td></tr>
        <tr><td>Matches</td><td>${report.composition.matches}</td></tr>
        <tr><td>Mismatches</td><td>${report.composition.mismatches}</td></tr>
        <tr><td>Gaps</td><td>${report.composition.gaps}</td></tr>
        <tr><td>Gap Openings</td><td>${report.composition.gapOpenings}</td></tr>
    </table>
    
    <p><small>Generated: ${new Date(report.timestamp).toLocaleString()}</small></p>
</body>
</html>`;
    }

    // Helper method to get quick stats summary
    getQuickSummary() {
        if (!this.currentStats) {
            return 'No alignment loaded';
        }

        const stats = this.currentStats;
        return `Score: ${stats.totalScore}, Identity: ${stats.identity.toFixed(1)}%, Length: ${stats.alignmentLength}, Gaps: ${stats.gaps}`;
    }

    // Method to compare two alignments
    compareAlignments(stats1, stats2) {
        if (!stats1 || !stats2) return null;

        return {
            scoreDifference: stats2.totalScore - stats1.totalScore,
            identityDifference: stats2.identity - stats1.identity,
            lengthDifference: stats2.alignmentLength - stats1.alignmentLength,
            gapDifference: stats2.gaps - stats1.gaps,
            betterScore: stats2.totalScore > stats1.totalScore,
            betterIdentity: stats2.identity > stats1.identity
        };
    }
}