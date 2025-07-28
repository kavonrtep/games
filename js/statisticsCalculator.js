class StatisticsCalculator {
    constructor() {
        this.elements = {
            currentScore: document.getElementById('current-score'),
            alignmentLength: document.getElementById('alignment-length'),
            identityPercent: document.getElementById('identity-percent'),
            gapsCount: document.getElementById('gaps-count'),
            matchesCount: document.getElementById('matches-count'),
            mismatchesCount: document.getElementById('mismatches-count')
        };
    }

    updateStatistics(scoreData) {
        console.log('StatisticsCalculator.updateStatistics called with:', scoreData);
        
        if (!scoreData) {
            console.log('No score data, clearing statistics');
            this.clearStatistics();
            return;
        }

        console.log('Updating statistics elements...');
        this.updateElement('currentScore', scoreData.totalScore);
        this.updateElement('alignmentLength', scoreData.alignmentLength);
        this.updateElement('identityPercent', `${scoreData.identity}%`);
        this.updateElement('gapsCount', scoreData.gaps);
        this.updateElement('matchesCount', scoreData.matches);
        this.updateElement('mismatchesCount', scoreData.mismatches);
        
        this.updateScoreColor(scoreData.totalScore);
        console.log('Statistics elements updated');
    }

    updateElement(elementName, value) {
        const element = this.elements[elementName];
        console.log(`Updating ${elementName} to ${value}, element found:`, !!element);
        if (element) {
            element.textContent = value;
            this.animateUpdate(element);
        } else {
            console.error(`Element not found for ${elementName}`);
        }
    }

    animateUpdate(element) {
        element.classList.remove('stat-updated');
        element.offsetHeight;
        element.classList.add('stat-updated');
        
        setTimeout(() => {
            element.classList.remove('stat-updated');
        }, 300);
    }

    updateScoreColor(score) {
        const scoreElement = this.elements.currentScore;
        if (!scoreElement) return;

        scoreElement.classList.remove('score-positive', 'score-negative', 'score-neutral');
        
        if (score > 0) {
            scoreElement.classList.add('score-positive');
        } else if (score < 0) {
            scoreElement.classList.add('score-negative');
        } else {
            scoreElement.classList.add('score-neutral');
        }
    }

    clearStatistics() {
        Object.values(this.elements).forEach(element => {
            if (element) {
                element.textContent = '0';
            }
        });
        
        if (this.elements.identityPercent) {
            this.elements.identityPercent.textContent = '0%';
        }
    }

    generateDetailedReport(scoreData, alignment) {
        if (!scoreData || !alignment) return null;

        const report = {
            summary: {
                totalScore: scoreData.totalScore,
                alignmentLength: scoreData.alignmentLength,
                identity: scoreData.identity,
                gaps: scoreData.gaps,
                matches: scoreData.matches,
                mismatches: scoreData.mismatches,
                gapOpenings: scoreData.gapOpenings
            },
            breakdown: this.generateScoreBreakdown(scoreData),
            recommendations: this.generateRecommendations(scoreData, alignment),
            comparison: this.generateComparisonData(scoreData, alignment)
        };

        return report;
    }

    generateScoreBreakdown(scoreData) {
        const breakdown = {
            matchScore: scoreData.matches * (scoreData.breakdown.find(b => b.type === 'match')?.score || 0),
            mismatchPenalty: scoreData.mismatches * (scoreData.breakdown.find(b => b.type === 'mismatch')?.score || 0),
            gapPenalty: 0
        };

        scoreData.breakdown.forEach(item => {
            if (item.type === 'gap-open' || item.type === 'gap-extend') {
                breakdown.gapPenalty += item.score;
            }
        });

        return breakdown;
    }

    generateRecommendations(scoreData, alignment) {
        const recommendations = [];

        if (scoreData.identity < 30) {
            recommendations.push({
                type: 'warning',
                message: 'Low sequence identity. Consider if these sequences are truly homologous.',
                action: 'Review sequence input or alignment parameters'
            });
        }

        if (scoreData.gaps > scoreData.alignmentLength * 0.5) {
            recommendations.push({
                type: 'info',
                message: 'High gap content detected.',
                action: 'Consider adjusting gap penalties or reviewing alignment'
            });
        }

        if (scoreData.totalScore < 0 && scoreData.matches > 0) {
            recommendations.push({
                type: 'tip',
                message: 'Negative score despite matches.',
                action: 'Try reducing gap penalties or increasing match rewards'
            });
        }

        const gapRatio = scoreData.gapOpenings > 0 ? scoreData.gaps / scoreData.gapOpenings : 0;
        if (gapRatio > 5) {
            recommendations.push({
                type: 'info',
                message: 'Long gaps detected.',
                action: 'Consider biological significance of large insertions/deletions'
            });
        }

        return recommendations;
    }

    generateComparisonData(scoreData, alignment) {
        const totalPositions = scoreData.alignmentLength;
        
        return {
            matchRatio: totalPositions > 0 ? (scoreData.matches / totalPositions) : 0,
            mismatchRatio: totalPositions > 0 ? (scoreData.mismatches / totalPositions) : 0,
            gapRatio: totalPositions > 0 ? (scoreData.gaps / totalPositions) : 0,
            scorePerPosition: totalPositions > 0 ? (scoreData.totalScore / totalPositions) : 0,
            efficiency: this.calculateAlignmentEfficiency(scoreData, alignment)
        };
    }

    calculateAlignmentEfficiency(scoreData, alignment) {
        const maxPossibleMatches = Math.min(
            alignment.originalSeq1.length, 
            alignment.originalSeq2.length
        );
        
        if (maxPossibleMatches === 0) return 0;
        
        const efficiency = (scoreData.matches / maxPossibleMatches) * 100;
        return Math.round(efficiency * 10) / 10;
    }

    exportStatistics(scoreData, alignment) {
        const report = this.generateDetailedReport(scoreData, alignment);
        
        const exportData = {
            timestamp: new Date().toISOString(),
            sequences: {
                original1: alignment.originalSeq1,
                original2: alignment.originalSeq2,
                aligned1: alignment.alignedSeq1,
                aligned2: alignment.alignedSeq2,
                type: alignment.sequenceType
            },
            statistics: report.summary,
            breakdown: report.breakdown,
            recommendations: report.recommendations,
            comparison: report.comparison
        };

        return JSON.stringify(exportData, null, 2);
    }

    createVisualBreakdown(scoreData) {
        if (!scoreData.breakdown) return null;

        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');

        const barWidth = canvas.width / scoreData.breakdown.length;
        
        scoreData.breakdown.forEach((item, index) => {
            const x = index * barWidth;
            const height = Math.abs(item.score) * 10;
            const y = item.score >= 0 ? canvas.height / 2 - height : canvas.height / 2;

            ctx.fillStyle = this.getScoreColor(item.type);
            ctx.fillRect(x, y, barWidth - 1, height);
        });

        return canvas;
    }

    getScoreColor(scoreType) {
        const colors = {
            'match': '#48bb78',
            'mismatch': '#f56565',
            'gap-open': '#ed8936',
            'gap-extend': '#fbb040'
        };
        
        return colors[scoreType] || '#a0aec0';
    }
}