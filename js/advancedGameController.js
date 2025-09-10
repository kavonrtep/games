class AdvancedGameController {
    constructor() {
        console.log('AdvancedGameController constructor started');
        
        try {
            // Initialize core components
            this.scoringSystem = new AdvancedScoringSystem();
            console.log('AdvancedScoringSystem created');
            
            this.globalAlignment = new GlobalAlignmentAlgorithm(this.scoringSystem);
            console.log('GlobalAlignmentAlgorithm created');
            
            this.alignmentEditor = new AdvancedAlignmentEditor('alignment-editor', this.scoringSystem);
            console.log('AdvancedAlignmentEditor created');
            
            this.statisticsCalculator = new AdvancedStatisticsCalculator();
            console.log('AdvancedStatisticsCalculator created');
            
            // Current state
            this.currentAlignment = null;
            this.isGameActive = false;
            
            // Initialize DOM elements and setup
            this.initializeElements();
            console.log('Elements initialized');
            
            this.setupEventListeners();
            console.log('Event listeners setup');
            
            this.setupCallbacks();
            console.log('Callbacks setup');
            
            this.populateExampleMenu();
            console.log('Example menu populated');
            
            console.log('AdvancedGameController constructor completed successfully');
        } catch (error) {
            console.error('Error in AdvancedGameController constructor:', error);
            throw error;
        }
    }

    initializeElements() {
        this.elements = {
            // Sequence inputs
            sequence1Input: document.getElementById('sequence1'),
            sequence2Input: document.getElementById('sequence2'),
            exampleSelector: document.getElementById('example-selector'),
            loadSelectedExampleBtn: document.getElementById('load-selected-example'),
            loadExampleBtn: document.getElementById('load-example'),
            startAlignmentBtn: document.getElementById('start-alignment'),
            
            // Editor controls
            globalAlignmentBtn: document.getElementById('global-alignment'),
            removeGapColumnsBtn: document.getElementById('remove-gap-columns'),
            resetAlignmentBtn: document.getElementById('reset-alignment'),
            
            // Substitution matrix inputs
            matrixInputs: this.getMatrixInputElements(),
            
            // Gap parameter controls
            gapOpen: document.getElementById('gap-open'),
            gapExtend: document.getElementById('gap-extend'),
            endGapPenalty: document.getElementById('end-gap-penalty'),
            gapOpenValue: document.getElementById('gap-open-value'),
            gapExtendValue: document.getElementById('gap-extend-value'),
            endGapValue: document.getElementById('end-gap-value'),
            
            // Matrix preset buttons
            presetMatchMismatch: document.getElementById('preset-match-mismatch'),
            presetTransitionTransversion: document.getElementById('preset-transition-transversion')
        };
        
        // Validate essential elements
        this.validateElements();
        
        // Initialize matrix display
        this.updateMatrixDisplay();
        this.updateGapParameterDisplay();
    }

    getMatrixInputElements() {
        const bases = ['A', 'T', 'C', 'G'];
        const matrixInputs = {};
        
        bases.forEach(base1 => {
            bases.forEach(base2 => {
                const id = `matrix-${base1}${base2}`;
                const element = document.getElementById(id);
                if (element) {
                    matrixInputs[`${base1}${base2}`] = element;
                }
            });
        });
        
        return matrixInputs;
    }

    validateElements() {
        const requiredElements = [
            'sequence1Input', 'sequence2Input', 'startAlignmentBtn',
            'gapOpen', 'gapExtend', 'endGapPenalty'
        ];
        
        requiredElements.forEach(elementKey => {
            if (!this.elements[elementKey]) {
                console.error(`Required element missing: ${elementKey}`);
            }
        });
    }

    setupEventListeners() {
        // Sequence input events
        if (this.elements.exampleSelector) {
            this.elements.exampleSelector.addEventListener('change', () => this.handleExampleSelection());
        }
        if (this.elements.loadSelectedExampleBtn) {
            this.elements.loadSelectedExampleBtn.addEventListener('click', () => this.loadSelectedExample());
        }
        if (this.elements.loadExampleBtn) {
            this.elements.loadExampleBtn.addEventListener('click', () => this.loadRandomExample());
        }
        if (this.elements.startAlignmentBtn) {
            this.elements.startAlignmentBtn.addEventListener('click', () => this.startAlignment());
        }
        
        // Editor control events
        if (this.elements.globalAlignmentBtn) {
            this.elements.globalAlignmentBtn.addEventListener('click', () => this.calculateGlobalAlignment());
        }
        if (this.elements.removeGapColumnsBtn) {
            this.elements.removeGapColumnsBtn.addEventListener('click', () => this.removeGapOnlyColumns());
        }
        if (this.elements.resetAlignmentBtn) {
            this.elements.resetAlignmentBtn.addEventListener('click', () => this.resetAlignment());
        }
        
        // Sequence validation
        if (this.elements.sequence1Input) {
            this.elements.sequence1Input.addEventListener('input', () => this.validateInput());
        }
        if (this.elements.sequence2Input) {
            this.elements.sequence2Input.addEventListener('input', () => this.validateInput());
        }
        
        // Scoring parameter events
        this.setupScoringControls();
        this.setupMatrixControls();
        this.setupPresetButtons();
        
        // Initially disable editor buttons
        this.setEditorButtonsEnabled(false);
    }

    setupScoringControls() {
        // Gap parameter controls
        if (this.elements.gapOpen) {
            this.elements.gapOpen.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (this.elements.gapOpenValue) {
                    this.elements.gapOpenValue.textContent = value;
                }
                this.updateGapParameters();
            });
        }

        if (this.elements.gapExtend) {
            this.elements.gapExtend.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (this.elements.gapExtendValue) {
                    this.elements.gapExtendValue.textContent = value;
                }
                this.updateGapParameters();
            });
        }

        if (this.elements.endGapPenalty) {
            this.elements.endGapPenalty.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (this.elements.endGapValue) {
                    this.elements.endGapValue.textContent = value;
                }
                this.updateGapParameters();
            });
        }
    }

    setupMatrixControls() {
        // Add event listeners to all matrix input elements
        Object.entries(this.elements.matrixInputs).forEach(([key, element]) => {
            if (element) {
                element.addEventListener('input', (e) => {
                    // Apply color immediately on input
                    this.applyMatrixCellColor(e.target, e.target.value);
                    // Update the scoring system
                    this.updateSubstitutionMatrix();
                });
            }
        });
    }

    setupPresetButtons() {
        if (this.elements.presetMatchMismatch) {
            this.elements.presetMatchMismatch.addEventListener('click', () => {
                this.scoringSystem.setMatchMismatchMatrix(2, -1);
                this.updateMatrixDisplay();
                this.updateStatistics();
            });
        }

        if (this.elements.presetTransitionTransversion) {
            this.elements.presetTransitionTransversion.addEventListener('click', () => {
                this.scoringSystem.setTransitionTransversionMatrix(2, 0, -2);
                this.updateMatrixDisplay();
                this.updateStatistics();
            });
        }
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
        
        console.log('Callbacks setup complete');
    }

    populateExampleMenu() {
        if (!window.ADVANCED_GLOBAL_ALIGNMENT_EXAMPLES || !this.elements.exampleSelector) return;
        
        const selector = this.elements.exampleSelector;
        
        // Clear existing options (except the first placeholder)
        while (selector.children.length > 1) {
            selector.removeChild(selector.lastChild);
        }
        
        // Group examples by level
        const levels = ['beginner', 'intermediate', 'advanced', 'educational'];
        
        levels.forEach(level => {
            const examples = Object.entries(window.ADVANCED_GLOBAL_ALIGNMENT_EXAMPLES)
                .filter(([key, example]) => example.level === level);
            
            if (examples.length > 0) {
                // Create optgroup for this level
                const optgroup = document.createElement('optgroup');
                optgroup.label = level.charAt(0).toUpperCase() + level.slice(1);
                
                examples.forEach(([key, example]) => {
                    const option = document.createElement('option');
                    option.value = key;
                    option.textContent = example.name;
                    optgroup.appendChild(option);
                });
                
                selector.appendChild(optgroup);
            }
        });
    }

    handleExampleSelection() {
        const selectedKey = this.elements.exampleSelector?.value;
        if (this.elements.loadSelectedExampleBtn) {
            this.elements.loadSelectedExampleBtn.disabled = !selectedKey;
        }
    }

    loadSelectedExample() {
        const selectedKey = this.elements.exampleSelector?.value;
        if (!selectedKey || !window.ADVANCED_GLOBAL_ALIGNMENT_EXAMPLES) return;
        
        const example = window.ADVANCED_GLOBAL_ALIGNMENT_EXAMPLES[selectedKey];
        if (this.elements.sequence1Input) {
            this.elements.sequence1Input.value = example.seq1;
        }
        if (this.elements.sequence2Input) {
            this.elements.sequence2Input.value = example.seq2;
        }
        
        this.validateInput();
        this.showNotification(`Loaded example: ${example.name}`, 'info');
        
        // Automatically start alignment
        this.startAlignment();
    }

    loadRandomExample() {
        try {
            const example = AdvancedGlobalAlignmentExampleManager.getRandomExample();
            if (!example) {
                this.showNotification('No examples available', 'error');
                return;
            }
            
            if (this.elements.sequence1Input) {
                this.elements.sequence1Input.value = example.seq1;
            }
            if (this.elements.sequence2Input) {
                this.elements.sequence2Input.value = example.seq2;
            }
            
            this.validateInput();
            this.showNotification(`Loaded random example: ${example.name}`, 'info');
        } catch (error) {
            console.error('Error loading random example:', error);
            this.showNotification('Error loading example', 'error');
        }
    }

    validateInput() {
        const seq1 = this.elements.sequence1Input?.value || '';
        const seq2 = this.elements.sequence2Input?.value || '';
        
        if (!seq1 || !seq2) {
            this.setStartButtonEnabled(false);
            this.clearInputErrors();
            return;
        }

        const isValid = this.validateDNASequences(seq1, seq2);
        
        if (isValid) {
            this.setStartButtonEnabled(true);
            this.clearInputErrors();
            this.showInputSuccess();
        } else {
            this.setStartButtonEnabled(false);
            this.showInputError('Invalid DNA sequences. Use only A, T, C, G characters (5-50 chars each).');
        }
    }

    validateDNASequences(seq1, seq2) {
        const dnaPattern = /^[ATCGatcg]+$/;
        return dnaPattern.test(seq1) && dnaPattern.test(seq2) &&
               seq1.length >= 5 && seq1.length <= 50 &&
               seq2.length >= 5 && seq2.length <= 50;
    }

    startAlignment() {
        const seq1 = this.elements.sequence1Input?.value?.toUpperCase() || '';
        const seq2 = this.elements.sequence2Input?.value?.toUpperCase() || '';
        
        if (!this.validateDNASequences(seq1, seq2)) {
            this.showNotification('Invalid DNA sequences', 'error');
            return;
        }

        // Initialize alignment editor
        this.alignmentEditor.initialize(seq1, seq2, 'DNA');
        
        // Set current alignment
        this.currentAlignment = {
            originalSeq1: seq1,
            originalSeq2: seq2,
            alignedSeq1: seq1,
            alignedSeq2: seq2,
            sequenceType: 'DNA'
        };
        
        this.isGameActive = true;
        
        // Enable editor buttons
        this.setEditorButtonsEnabled(true);
        
        // Update statistics
        this.updateStatistics();
        
        this.showNotification('Alignment started! Use arrow keys to navigate and space/-/delete to edit gaps.', 'success');
    }

    onAlignmentChange(alignment) {
        this.currentAlignment = alignment;
        this.updateStatistics();
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

    updateSubstitutionMatrix() {
        const flatMatrix = {};
        
        Object.entries(this.elements.matrixInputs).forEach(([key, element]) => {
            if (element) {
                flatMatrix[key] = parseFloat(element.value) || 0;
            }
        });
        
        this.scoringSystem.setMatrixFromFlat(flatMatrix);
        
        if (this.isGameActive) {
            this.updateStatistics();
        }
    }

    updateMatrixDisplay() {
        const flatMatrix = this.scoringSystem.getFlatMatrix();
        
        Object.entries(this.elements.matrixInputs).forEach(([key, element]) => {
            if (element && flatMatrix[key] !== undefined) {
                element.value = flatMatrix[key];
                this.applyMatrixCellColor(element, flatMatrix[key]);
            }
        });
    }

    applyMatrixCellColor(element, value) {
        // Remove all existing score classes
        const scoreClasses = [
            'score-positive-high', 'score-positive-medium', 'score-positive-low',
            'score-zero',
            'score-negative-low', 'score-negative-medium', 'score-negative-high'
        ];
        
        scoreClasses.forEach(className => {
            element.classList.remove(className);
        });
        
        // Apply color based on value
        const numValue = parseFloat(value);
        
        if (numValue === 0) {
            element.classList.add('score-zero');
        } else if (numValue > 0) {
            // Positive values - three shades of green
            if (numValue >= 3) {
                element.classList.add('score-positive-high');
            } else if (numValue >= 1.5) {
                element.classList.add('score-positive-medium');
            } else {
                element.classList.add('score-positive-low');
            }
        } else {
            // Negative values - three shades of red
            if (numValue <= -3) {
                element.classList.add('score-negative-high');
            } else if (numValue <= -1.5) {
                element.classList.add('score-negative-medium');
            } else {
                element.classList.add('score-negative-low');
            }
        }
    }

    updateGapParameters() {
        const newParams = {
            gapOpen: parseFloat(this.elements.gapOpen?.value || -3),
            gapExtend: parseFloat(this.elements.gapExtend?.value || -1),
            endGap: parseFloat(this.elements.endGapPenalty?.value || -0.5)
        };
        
        this.scoringSystem.updateGapParameters(newParams);
        
        if (this.isGameActive) {
            this.updateStatistics();
        }
    }

    updateGapParameterDisplay() {
        const params = this.scoringSystem.getGapParameters();
        
        if (this.elements.gapOpen) this.elements.gapOpen.value = params.gapOpen;
        if (this.elements.gapExtend) this.elements.gapExtend.value = params.gapExtend;
        if (this.elements.endGapPenalty) this.elements.endGapPenalty.value = params.endGap;
        
        if (this.elements.gapOpenValue) this.elements.gapOpenValue.textContent = params.gapOpen;
        if (this.elements.gapExtendValue) this.elements.gapExtendValue.textContent = params.gapExtend;
        if (this.elements.endGapValue) this.elements.endGapValue.textContent = params.endGap;
    }

    calculateGlobalAlignment() {
        try {
            // Check if sequences are loaded
            const seq1 = this.elements.sequence1Input?.value?.trim();
            const seq2 = this.elements.sequence2Input?.value?.trim();
            
            if (!seq1 || !seq2) {
                this.showNotification('Please enter both sequences before running global alignment', 'warning');
                return;
            }
            
            // Validate sequences
            if (!this.scoringSystem.validateDNASequence(seq1) || !this.scoringSystem.validateDNASequence(seq2)) {
                this.showNotification('Invalid DNA sequences. Only A, T, C, G characters allowed.', 'error');
                return;
            }
            
            // Check sequence length limits
            if (seq1.length < 3 || seq2.length < 3) {
                this.showNotification('Sequences must be at least 3 characters long', 'warning');
                return;
            }
            
            if (seq1.length > 50 || seq2.length > 50) {
                this.showNotification('Sequences must be 50 characters or less', 'warning');
                return;
            }
            
            this.showNotification('Running global alignment algorithm...', 'info');
            
            // Perform global alignment
            const result = this.globalAlignment.align(seq1, seq2);
            
            // Validate the result
            const validation = this.globalAlignment.validateAlignment(result, seq1, seq2);
            if (!validation.valid) {
                throw new Error(`Alignment validation failed: ${validation.error}`);
            }
            
            // Store the alignment and load it into the editor
            this.currentAlignment = {
                sequence1: result.alignedSeq1,
                sequence2: result.alignedSeq2,
                originalSeq1: seq1,
                originalSeq2: seq2,
                algorithm: result.algorithm,
                scoreData: result.scoreData
            };
            
            // Load alignment into the editor
            this.alignmentEditor.initialize(
                result.alignedSeq1, 
                result.alignedSeq2,
                'DNA'
            );
            
            // Make sure game is active
            if (!this.isGameActive) {
                this.isGameActive = true;
                this.setEditorButtonsEnabled(true);
            }
            
            // Update statistics
            this.updateStatistics();
            
            // Show success message with details
            const summary = `Global alignment completed!
Score: ${result.score}
Length: ${result.alignedSeq1.length}
Identity: ${result.scoreData.identity}%
Matches: ${result.scoreData.matches}
Gaps: ${result.scoreData.gaps}`;
            
            this.showNotification(summary, 'success');
            
            console.log('Global alignment result:', this.globalAlignment.getAlignmentSummary(result));
            
        } catch (error) {
            console.error('Error in calculateGlobalAlignment:', error);
            this.showNotification(`Global alignment failed: ${error.message}`, 'error');
        }
    }

    removeGapOnlyColumns() {
        if (!this.isGameActive || !this.alignmentEditor) {
            this.showNotification('No active alignment to process', 'warning');
            return;
        }

        const removedColumns = this.alignmentEditor.removeGapOnlyColumns();
        
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

    // UI Helper Methods
    setStartButtonEnabled(enabled) {
        if (this.elements.startAlignmentBtn) {
            this.elements.startAlignmentBtn.disabled = !enabled;
        }
    }

    setEditorButtonsEnabled(enabled) {
        const editorButtons = [
            'globalAlignmentBtn',
            'removeGapColumnsBtn', 
            'resetAlignmentBtn'
        ];
        
        editorButtons.forEach(buttonKey => {
            if (this.elements[buttonKey]) {
                this.elements[buttonKey].disabled = !enabled;
            }
        });
    }

    showInputError(message) {
        if (this.elements.sequence1Input) {
            this.elements.sequence1Input.classList.add('input-error');
        }
        if (this.elements.sequence2Input) {
            this.elements.sequence2Input.classList.add('input-error');
        }
        this.showNotification(message, 'error');
    }

    clearInputErrors() {
        if (this.elements.sequence1Input) {
            this.elements.sequence1Input.classList.remove('input-error');
        }
        if (this.elements.sequence2Input) {
            this.elements.sequence2Input.classList.remove('input-error');
        }
    }

    showInputSuccess() {
        if (this.elements.sequence1Input) {
            this.elements.sequence1Input.classList.add('input-success');
        }
        if (this.elements.sequence2Input) {
            this.elements.sequence2Input.classList.add('input-success');
        }
        
        setTimeout(() => {
            if (this.elements.sequence1Input) {
                this.elements.sequence1Input.classList.remove('input-success');
            }
            if (this.elements.sequence2Input) {
                this.elements.sequence2Input.classList.remove('input-success');
            }
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
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    reset() {
        // Reset input fields
        if (this.elements.sequence1Input) this.elements.sequence1Input.value = '';
        if (this.elements.sequence2Input) this.elements.sequence2Input.value = '';
        if (this.elements.exampleSelector) this.elements.exampleSelector.value = '';
        
        // Reset editor
        this.alignmentEditor.setActive(false);
        
        // Reset statistics
        this.statisticsCalculator.clearStatistics();
        
        // Reset state
        this.currentAlignment = null;
        this.isGameActive = false;
        
        // Reset UI
        this.setStartButtonEnabled(false);
        this.setEditorButtonsEnabled(false);
        this.clearInputErrors();
        
        // Reset scoring system to defaults
        this.scoringSystem = new AdvancedScoringSystem();
        this.updateMatrixDisplay();
        this.updateGapParameterDisplay();
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
        
        const exportData = this.statisticsCalculator.exportStatistics(
            this.currentAlignment, 
            scoreData, 
            'json'
        );
        
        if (!exportData) {
            this.showNotification('Error preparing export data', 'error');
            return;
        }
        
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `advanced_alignment_results_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('Results exported successfully', 'success');
    }
}