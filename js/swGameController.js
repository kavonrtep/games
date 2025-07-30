class SwGameController {
    constructor() {
        console.log('SwGameController constructor started');
        
        try {
            this.sequenceValidator = new SequenceValidator();
            console.log('SequenceValidator created');
            
            this.smithWaterman = new SmithWaterman();
            console.log('SmithWaterman created');
            
            this.dotplotVisualizer = new SwDotplotVisualizer('dotplot-canvas');
            console.log('SwDotplotVisualizer created');
            
            this.currentSequences = null;
            this.localAlignments = [];
            this.isActive = false;
            
            this.initializeElements();
            console.log('Elements initialized');
            
            this.setupEventListeners();
            console.log('Event listeners setup');
            
            this.setupCallbacks();
            console.log('Callbacks setup');
            
            console.log('SwGameController constructor completed successfully');
        } catch (error) {
            console.error('Error in SwGameController constructor:', error);
            throw error;
        }
    }

    initializeElements() {
        this.elements = {
            sequence1Input: document.getElementById('sequence1'),
            sequence2Input: document.getElementById('sequence2'),
            loadExampleBtn: document.getElementById('load-example'),
            startAlignmentBtn: document.getElementById('start-alignment'),
            smithWatermanBtn: document.getElementById('smith-waterman'),
            
            matchScore: document.getElementById('match-score'),
            mismatchPenalty: document.getElementById('mismatch-penalty'),
            gapPenalty: document.getElementById('gap-penalty'),
            scoreThreshold: document.getElementById('score-threshold'),
            
            matchValue: document.getElementById('match-value'),
            mismatchValue: document.getElementById('mismatch-value'),
            gapValue: document.getElementById('gap-value'),
            thresholdValue: document.getElementById('threshold-value'),
            
            showScores: document.getElementById('show-scores'),
            alignmentsContainer: document.getElementById('alignments-container')
        };
    }

    setupEventListeners() {
        this.elements.loadExampleBtn.addEventListener('click', () => this.loadExample());
        this.elements.startAlignmentBtn.addEventListener('click', () => this.startAlignment());
        this.elements.smithWatermanBtn.addEventListener('click', () => this.findLocalAlignments());
        
        this.elements.sequence1Input.addEventListener('input', () => this.validateInput());
        this.elements.sequence2Input.addEventListener('input', () => this.validateInput());
        
        this.setupScoringControls();
        this.setupScoreDisplayControl();
        
        // Initially disable algorithm button
        this.elements.smithWatermanBtn.disabled = true;
    }

    setupScoringControls() {
        this.elements.matchScore.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.elements.matchValue.textContent = `+${value}`;
            this.updateAlignmentsIfNeeded();
        });

        this.elements.mismatchPenalty.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.elements.mismatchValue.textContent = value;
            this.updateAlignmentsIfNeeded();
        });

        this.elements.gapPenalty.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.elements.gapValue.textContent = value;
            this.updateAlignmentsIfNeeded();
        });

        this.elements.scoreThreshold.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.elements.thresholdValue.textContent = value;
            this.updateAlignmentsIfNeeded();
        });
    }

    setupScoreDisplayControl() {
        this.elements.showScores.addEventListener('change', (e) => {
            this.updateScoreDisplay(e.target.checked);
        });
    }

    setupCallbacks() {
        console.log('Setting up callbacks...');
        
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
            
            this.elements.sequence1Input.value = example.seq1;
            this.elements.sequence2Input.value = example.seq2;
            
            this.validateInput();
            
            this.showNotification(`Loaded example: ${example.description}`, 'info');
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
        
        this.currentSequences = {
            sequence1: sequences.sequence1,
            sequence2: sequences.sequence2,
            type: sequences.type
        };
        
        // Initialize dotplot
        this.dotplotVisualizer.updateDotplot(
            sequences.sequence1, 
            sequences.sequence2, 
            sequences.type
        );
        
        this.isActive = true;
        
        // Enable algorithm button
        this.elements.smithWatermanBtn.disabled = false;
        
        // Clear previous alignments
        this.clearAlignments();
        
        // Update score display if it's currently enabled
        if (this.elements.showScores.checked) {
            this.updateScoreDisplay(true);
        }
        
        this.showNotification('Sequences loaded! Click "Find Local Alignments" to run Smith-Waterman algorithm.', 'success');
    }

    findLocalAlignments() {
        if (!this.isActive || !this.currentSequences) {
            this.showNotification('No sequences loaded', 'warning');
            return;
        }

        try {
            // Get current scoring parameters
            const scoringParams = {
                match: parseInt(this.elements.matchScore.value),
                mismatch: parseInt(this.elements.mismatchPenalty.value),
                gap: parseInt(this.elements.gapPenalty.value)
            };
            
            const threshold = parseInt(this.elements.scoreThreshold.value);
            
            // Run Smith-Waterman algorithm
            const result = this.smithWaterman.findLocalAlignments(
                this.currentSequences.sequence1,
                this.currentSequences.sequence2,
                scoringParams,
                threshold
            );

            this.localAlignments = result.alignments;
            
            // Update dotplot with alignments
            this.dotplotVisualizer.setLocalAlignments(this.localAlignments);
            
            // Update score display if enabled
            if (this.elements.showScores.checked) {
                this.dotplotVisualizer.setShowScores(true, result.matrix);
            }
            
            // Display alignments
            this.displayAlignments();
            
            const count = this.localAlignments.length;
            this.showNotification(
                `Found ${count} local alignment${count !== 1 ? 's' : ''} above threshold ${threshold}`,
                'success'
            );

        } catch (error) {
            console.error('Error finding local alignments:', error);
            this.showNotification('Error finding local alignments', 'error');
        }
    }

    displayAlignments() {
        const container = this.elements.alignmentsContainer;
        
        if (this.localAlignments.length === 0) {
            container.innerHTML = '<p class="no-alignments">No local alignments found above threshold</p>';
            return;
        }
        
        let html = '';
        this.localAlignments.forEach((alignment, index) => {
            const stats = this.smithWaterman.getAlignmentStatistics(alignment.alignedSeq1, alignment.alignedSeq2);
            
            // Create match line
            let matchLine = '';
            for (let i = 0; i < alignment.alignedSeq1.length; i++) {
                const char1 = alignment.alignedSeq1[i];
                const char2 = alignment.alignedSeq2[i];
                if (char1 === '-' || char2 === '-') {
                    matchLine += ' ';
                } else if (char1 === char2) {
                    matchLine += '|';
                } else {
                    matchLine += ' ';
                }
            }
            
            html += `
                <div class="alignment-item">
                    <div class="alignment-header">
                        <span>Local Alignment #${index + 1}</span>
                        <span class="alignment-score">Score: ${alignment.score}</span>
                    </div>
                    <div class="alignment-coords">
                        Seq1: ${alignment.startPos1 + 1}-${alignment.endPos1 + 1} | 
                        Seq2: ${alignment.startPos2 + 1}-${alignment.endPos2 + 1} | 
                        Length: ${alignment.alignedSeq1.length} | 
                        Identity: ${stats.identity}%
                    </div>
                    <div class="alignment-display">${alignment.alignedSeq1}
${matchLine}
${alignment.alignedSeq2}</div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    clearAlignments() {
        this.localAlignments = [];
        this.dotplotVisualizer.setLocalAlignments([]);
        this.elements.alignmentsContainer.innerHTML = '<p class="no-alignments">Run Smith-Waterman to find local alignments</p>';
    }

    updateAlignmentsIfNeeded() {
        if (this.isActive && this.localAlignments.length > 0) {
            // Re-run Smith-Waterman with new parameters
            this.findLocalAlignments();
        }
    }

    updateScoreDisplay(showScores) {
        if (showScores && this.isActive && this.currentSequences) {
            // Calculate the Smith-Waterman matrix for the current sequences
            const scoringParams = {
                match: parseInt(this.elements.matchScore.value),
                mismatch: parseInt(this.elements.mismatchPenalty.value),
                gap: parseInt(this.elements.gapPenalty.value)
            };
            
            const threshold = parseInt(this.elements.scoreThreshold.value);
            
            const result = this.smithWaterman.findLocalAlignments(
                this.currentSequences.sequence1,
                this.currentSequences.sequence2,
                scoringParams,
                threshold
            );
            
            this.dotplotVisualizer.setShowScores(true, result.matrix);
        } else {
            this.dotplotVisualizer.setShowScores(false);
        }
    }

    onDotplotClick(data) {
        this.showNotification(
            `Clicked: Seq1[${data.seq1Position + 1}]=${data.seq1Char}, Seq2[${data.seq2Position + 1}]=${data.seq2Char}`,
            'info'
        );
    }

    onDotplotMouseMove(data) {
        if (data.seq1Char && data.seq2Char) {
            const tooltip = `Seq1[${data.seq1Position + 1}]=${data.seq1Char}, Seq2[${data.seq2Position + 1}]=${data.seq2Char}`;
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
        
        this.dotplotVisualizer.clear();
        this.clearAlignments();
        
        this.currentSequences = null;
        this.isActive = false;
        
        // Disable algorithm button
        this.elements.smithWatermanBtn.disabled = true;
        
        this.clearInputErrors();
    }
}