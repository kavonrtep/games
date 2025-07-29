class GameController {
    constructor() {
        console.log('GameController constructor started');
        
        try {
            this.sequenceValidator = new SequenceValidator();
            console.log('SequenceValidator created');
            
            this.scoringSystem = new ScoringSystem();
            console.log('ScoringSystem created');
            
            this.needlemanWunsch = new NeedlemanWunsch();
            console.log('NeedlemanWunsch created');
            
            this.alignmentEditor = new AlignmentEditor('alignment-editor', this.scoringSystem);
            console.log('AlignmentEditor created');
            
            this.dotplotVisualizer = new DotplotVisualizer('dotplot-canvas');
            console.log('DotplotVisualizer created');
            
            this.statisticsCalculator = new StatisticsCalculator();
            console.log('StatisticsCalculator created');
            
            this.currentAlignment = null;
            this.isGameActive = false;
            
            this.initializeElements();
            console.log('Elements initialized');
            
            this.setupEventListeners();
            console.log('Event listeners setup');
            
            this.setupCallbacks();
            console.log('Callbacks setup');
            
            console.log('GameController constructor completed successfully');
        } catch (error) {
            console.error('Error in GameController constructor:', error);
            throw error;
        }
    }

    initializeElements() {
        this.elements = {
            sequence1Input: document.getElementById('sequence1'),
            sequence2Input: document.getElementById('sequence2'),
            loadExampleBtn: document.getElementById('load-example'),
            startAlignmentBtn: document.getElementById('start-alignment'),
            needlemanWunschBtn: document.getElementById('needleman-wunsch'),
            removeGapColumnsBtn: document.getElementById('remove-gap-columns'),
            resetAlignmentBtn: document.getElementById('reset-alignment'),
            
            matchScore: document.getElementById('match-score'),
            mismatchPenalty: document.getElementById('mismatch-penalty'),
            gapOpen: document.getElementById('gap-open'),
            gapExtend: document.getElementById('gap-extend'),
            
            matchValue: document.getElementById('match-value'),
            mismatchValue: document.getElementById('mismatch-value'),
            gapOpenValue: document.getElementById('gap-open-value'),
            gapExtendValue: document.getElementById('gap-extend-value'),
            
            windowSize: document.getElementById('window-size'),
            threshold: document.getElementById('threshold'),
            windowValue: document.getElementById('window-value'),
            thresholdValue: document.getElementById('threshold-value')
        };
    }

    setupEventListeners() {
        this.elements.loadExampleBtn.addEventListener('click', () => this.loadExample());
        this.elements.startAlignmentBtn.addEventListener('click', () => this.startAlignment());
        this.elements.needlemanWunschBtn.addEventListener('click', () => this.calculateOptimalAlignment());
        this.elements.removeGapColumnsBtn.addEventListener('click', () => this.removeGapOnlyColumns());
        this.elements.resetAlignmentBtn.addEventListener('click', () => this.resetAlignment());
        
        this.elements.sequence1Input.addEventListener('input', () => this.validateInput());
        this.elements.sequence2Input.addEventListener('input', () => this.validateInput());
        
        this.setupScoringControls();
        this.setupDotplotControls();
        
        // Initially disable editor buttons
        this.elements.needlemanWunschBtn.disabled = true;
        this.elements.removeGapColumnsBtn.disabled = true;
        this.elements.resetAlignmentBtn.disabled = true;
    }

    setupScoringControls() {
        this.elements.matchScore.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.elements.matchValue.textContent = `+${value}`;
            this.updateScoringParameters();
        });

        this.elements.mismatchPenalty.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.elements.mismatchValue.textContent = value;
            this.updateScoringParameters();
        });

        this.elements.gapOpen.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.elements.gapOpenValue.textContent = value;
            this.updateScoringParameters();
        });

        this.elements.gapExtend.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.elements.gapExtendValue.textContent = value;
            this.updateScoringParameters();
        });
    }

    setupDotplotControls() {
        this.elements.windowSize.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.elements.windowValue.textContent = value;
            this.updateDotplotParameters();
        });

        this.elements.threshold.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.elements.thresholdValue.textContent = value;
            this.updateDotplotParameters();
        });
    }

    setupCallbacks() {
        console.log('Setting up callbacks...');
        this.alignmentEditor.setOnChangeCallback((alignment) => {
            console.log('Alignment change callback triggered');
            this.onAlignmentChange(alignment);
        });

        this.alignmentEditor.setOnTerminalGapTrimCallback((trimData) => {
            this.onTerminalGapTrim(trimData);
        });

        this.dotplotVisualizer.setOnDotClickCallback((data) => {
            this.onDotplotClick(data);
        });

        this.dotplotVisualizer.setOnMouseMoveCallback((data) => {
            this.onDotplotMouseMove(data);
        });
        console.log('Callbacks setup complete');
    }

    loadExample() {
        console.log('loadExample called');
        try {
            const example = this.sequenceValidator.getRandomExample('beginner', 'DNA');
            console.log('Got example:', example);
            
            console.log('sequence1Input element:', this.elements.sequence1Input);
            console.log('sequence2Input element:', this.elements.sequence2Input);
            
            this.elements.sequence1Input.value = example.seq1;
            this.elements.sequence2Input.value = example.seq2;
            console.log('Values set in inputs');
            
            this.validateInput();
            console.log('Input validated');
            
            this.showNotification(`Loaded example: ${example.description}`, 'info');
            console.log('Notification shown');
        } catch (error) {
            console.error('Error in loadExample:', error);
        }
    }

    validateInput() {
        const seq1 = this.elements.sequence1Input.value;
        const seq2 = this.elements.sequence2Input.value;
        
        if (!seq1 || !seq2) {
            this.elements.startAlignmentBtn.disabled = true;
            this.clearInputErrors();
            return;
        }

        const validation = this.sequenceValidator.validateSequencePair(seq1, seq2);
        
        if (validation.isValid) {
            this.elements.startAlignmentBtn.disabled = false;
            this.clearInputErrors();
            this.showInputSuccess();
        } else {
            this.elements.startAlignmentBtn.disabled = true;
            this.showInputError(validation.error);
        }
    }

    startAlignment() {
        const seq1 = this.elements.sequence1Input.value;
        const seq2 = this.elements.sequence2Input.value;
        
        const validation = this.sequenceValidator.validateSequencePair(seq1, seq2);
        
        if (!validation.isValid) {
            this.showNotification(validation.error, 'error');
            return;
        }

        const sequences = validation.sequences;
        
        this.alignmentEditor.initialize(
            sequences.sequence1, 
            sequences.sequence2, 
            sequences.type
        );
        
        // Initialize dotplot with original sequences (no gaps initially)
        this.dotplotVisualizer.updateDotplot(
            sequences.sequence1, 
            sequences.sequence2, 
            sequences.type
        );
        
        this.currentAlignment = {
            originalSeq1: sequences.sequence1,
            originalSeq2: sequences.sequence2,
            alignedSeq1: sequences.sequence1,
            alignedSeq2: sequences.sequence2,
            sequenceType: sequences.type
        };
        
        this.isGameActive = true;
        
        // Enable editor buttons
        this.elements.needlemanWunschBtn.disabled = false;
        this.elements.removeGapColumnsBtn.disabled = false;
        this.elements.resetAlignmentBtn.disabled = false;
        
        this.showNotification('Alignment started! Use arrow keys to navigate and space/-/delete to edit gaps.', 'success');
    }

    onAlignmentChange(alignment) {
        this.currentAlignment = alignment;
        this.updateStatistics();
        this.updateDotplotFromAlignment();
    }

    updateStatistics() {
        if (!this.currentAlignment) {
            this.statisticsCalculator.clearStatistics();
            return;
        }

        const scoreData = this.scoringSystem.calculateAlignmentScore(
            this.currentAlignment.alignedSeq1,
            this.currentAlignment.alignedSeq2
        );
        
        this.statisticsCalculator.updateStatistics(scoreData);
    }

    updateDotplotFromAlignment() {
        if (!this.currentAlignment) return;
        
        // Pass the aligned sequences (with gaps) so the dotplot can show the alignment path
        this.dotplotVisualizer.updateDotplot(
            this.currentAlignment.alignedSeq1,
            this.currentAlignment.alignedSeq2,
            this.currentAlignment.sequenceType
        );
    }

    updateScoringParameters() {
        const newParams = {
            match: parseInt(this.elements.matchScore.value),
            mismatch: parseInt(this.elements.mismatchPenalty.value),
            gapOpen: parseInt(this.elements.gapOpen.value),
            gapExtend: parseFloat(this.elements.gapExtend.value)
        };
        
        this.scoringSystem.updateParameters(newParams);
        
        if (this.isGameActive) {
            this.updateStatistics();
        }
    }

    updateDotplotParameters() {
        const windowSize = parseInt(this.elements.windowSize.value);
        const threshold = parseFloat(this.elements.threshold.value);
        
        this.dotplotVisualizer.updateParameters(windowSize, threshold);
    }

    onDotplotClick(data) {
        this.showNotification(
            `Clicked: Seq1[${data.seq1Position}]=${data.seq1Char}, Seq2[${data.seq2Position}]=${data.seq2Char}`,
            'info'
        );
    }

    onDotplotMouseMove(data) {
        if (data.seq1Char && data.seq2Char) {
            const tooltip = `Seq1[${data.seq1Position}]=${data.seq1Char}, Seq2[${data.seq2Position}]=${data.seq2Char}`;
            this.updateTooltip(tooltip);
        }
    }

    showInputError(message) {
        this.elements.sequence1Input.classList.add('input-error');
        this.elements.sequence2Input.classList.add('input-error');
        this.showNotification(message, 'error');
    }

    clearInputErrors() {
        this.elements.sequence1Input.classList.remove('input-error');
        this.elements.sequence2Input.classList.remove('input-error');
    }

    showInputSuccess() {
        this.elements.sequence1Input.classList.add('input-success');
        this.elements.sequence2Input.classList.add('input-success');
        
        setTimeout(() => {
            this.elements.sequence1Input.classList.remove('input-success');
            this.elements.sequence2Input.classList.remove('input-success');
        }, 1000);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    updateTooltip(text) {
        let tooltip = document.getElementById('tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'tooltip';
            tooltip.className = 'tooltip';
            document.body.appendChild(tooltip);
        }
        
        tooltip.textContent = text;
    }

    reset() {
        this.elements.sequence1Input.value = '';
        this.elements.sequence2Input.value = '';
        this.elements.startAlignmentBtn.disabled = true;
        
        this.alignmentEditor.setActive(false);
        this.dotplotVisualizer.clear();
        this.statisticsCalculator.clearStatistics();
        
        this.currentAlignment = null;
        this.isGameActive = false;
        
        // Disable editor buttons
        this.elements.needlemanWunschBtn.disabled = true;
        this.elements.removeGapColumnsBtn.disabled = true;
        this.elements.resetAlignmentBtn.disabled = true;
        
        this.clearInputErrors();
    }

    exportResults() {
        if (!this.currentAlignment) {
            this.showNotification('No alignment to export', 'warning');
            return;
        }

        const scoreData = this.scoringSystem.calculateAlignmentScore(
            this.currentAlignment.alignedSeq1,
            this.currentAlignment.alignedSeq2
        );
        
        const exportData = this.statisticsCalculator.exportStatistics(scoreData, this.currentAlignment);
        
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alignment_results_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('Results exported successfully', 'success');
    }

    removeGapOnlyColumns() {
        if (!this.isGameActive || !this.alignmentEditor) {
            this.showNotification('No active alignment to process', 'warning');
            return;
        }

        const beforeLength = Math.max(
            this.currentAlignment.alignedSeq1.length,
            this.currentAlignment.alignedSeq2.length
        );

        this.alignmentEditor.removeGapOnlyColumns();

        const afterLength = Math.max(
            this.currentAlignment.alignedSeq1.length,
            this.currentAlignment.alignedSeq2.length
        );

        const removedColumns = beforeLength - afterLength;
        
        if (removedColumns > 0) {
            this.showNotification(`Removed ${removedColumns} gap-only column${removedColumns > 1 ? 's' : ''}`, 'success');
        } else {
            this.showNotification('No gap-only columns found', 'info');
        }
    }

    resetAlignment() {
        if (!this.isGameActive || !this.alignmentEditor) {
            this.showNotification('No active alignment to reset', 'warning');
            return;
        }

        this.alignmentEditor.reset();
        this.showNotification('Alignment reset to original sequences', 'info');
    }

    onTerminalGapTrim(trimData) {
        const { startTrimmed, endTrimmed, totalTrimmed } = trimData;
        let message = `Auto-trimmed ${totalTrimmed} terminal gap${totalTrimmed > 1 ? 's' : ''}`;
        
        if (startTrimmed > 0 && endTrimmed > 0) {
            message += ` (${startTrimmed} from 5' end, ${endTrimmed} from 3' end)`;
        } else if (startTrimmed > 0) {
            message += ` (from 5' end)`;
        } else if (endTrimmed > 0) {
            message += ` (from 3' end)`;
        }
        
        this.showNotification(message, 'info');
    }

    calculateOptimalAlignment() {
        if (!this.isGameActive || !this.currentAlignment) {
            this.showNotification('No active alignment to optimize', 'warning');
            return;
        }

        try {
            // Get current scoring parameters
            const scoringParams = this.scoringSystem.getParameters();
            
            // Calculate current score for comparison
            const currentScore = this.scoringSystem.calculateAlignmentScore(
                this.currentAlignment.alignedSeq1,
                this.currentAlignment.alignedSeq2
            ).totalScore;

            // Calculate optimal alignment using Needleman-Wunsch
            const result = this.needlemanWunsch.calculateOptimalAlignment(
                this.currentAlignment.originalSeq1,
                this.currentAlignment.originalSeq2,
                scoringParams
            );

            if (!result.alignedSeq1 || !result.alignedSeq2) {
                this.showNotification('Failed to calculate optimal alignment', 'error');
                return;
            }

            // Update the alignment editor with the optimal alignment
            this.alignmentEditor.setAlignment(result.alignedSeq1, result.alignedSeq2);

            // Show notification with score improvement
            const improvement = result.score - currentScore;
            const improvementText = improvement > 0 ? `+${improvement.toFixed(1)}` : improvement.toFixed(1);
            
            if (improvement > 0) {
                this.showNotification(`Optimal alignment found! Score improved by ${improvementText} (${result.score})`, 'success');
            } else if (improvement === 0) {
                this.showNotification(`Already optimal! Current score: ${result.score}`, 'info');
            } else {
                this.showNotification(`Optimal alignment applied. Score: ${result.score} (was ${currentScore.toFixed(1)})`, 'info');
            }

        } catch (error) {
            console.error('Error calculating optimal alignment:', error);
            this.showNotification('Error calculating optimal alignment', 'error');
        }
    }
}