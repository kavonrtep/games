class BlastGameController {
    constructor() {
        this.blastAlgorithm = new BlastAlgorithm();
        this.visualizer = new BlastVisualizer('blast-canvas');
        this.sequenceValidator = new SequenceValidator();
        
        this.currentStep = 0;
        this.maxSteps = 5;
        this.isInitialized = false;
        
        this.stepTitles = [
            'Step 1: K-mer Generation',
            'Step 2: K-mer Matching', 
            'Step 3: Seed Identification',
            'Step 4: Alignment Extension',
            'Step 5: Final Results'
        ];
        
        this.stepInstructions = [
            'Generate overlapping k-mers from the query sequence. Adjust k-mer length to see how it affects the number of k-mers generated.',
            'Find all positions in the database sequence where query k-mers match exactly. Each match represents a potential alignment start point.',
            'Cluster nearby matches into seeds. Seeds represent regions with high similarity potential that warrant further investigation.',
            'Extend alignments bidirectionally around each seed using local alignment scoring. Extensions stop when the score drops significantly.',
            'View the final high-scoring local alignments found by the BLAST algorithm. These represent significant sequence similarities.'
        ];
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadDefaultExample();
    }

    initializeElements() {
        this.elements = {
            querySequence: document.getElementById('query-sequence'),
            databaseSequence: document.getElementById('database-sequence'),
            kmerLength: document.getElementById('kmer-length'),
            kmerValue: document.getElementById('kmer-value'),
            loadExample: document.getElementById('load-example'),
            resetBlast: document.getElementById('reset-blast'),
            prevStep: document.getElementById('prev-step'),
            nextStep: document.getElementById('next-step'),
            visualizationTitle: document.getElementById('visualization-title'),
            stepInstructionsContent: document.getElementById('step-instructions-content'),
            stepControlsContent: document.getElementById('step-controls-content'),
            
            // Summary elements
            kmersCount: document.getElementById('kmers-count'),
            matchesCount: document.getElementById('matches-count'),
            seedsCount: document.getElementById('seeds-count'),
            alignmentsCount: document.getElementById('alignments-count'),
            bestScore: document.getElementById('best-score')
        };
    }

    setupEventListeners() {
        // Input change listeners
        this.elements.querySequence.addEventListener('input', () => this.onSequenceChange());
        this.elements.databaseSequence.addEventListener('input', () => this.onSequenceChange());
        this.elements.kmerLength.addEventListener('input', (e) => this.onKmerLengthChange(e));
        
        // Button listeners
        this.elements.loadExample.addEventListener('click', () => this.loadExample());
        this.elements.resetBlast.addEventListener('click', () => this.resetBlast());
        this.elements.prevStep.addEventListener('click', () => this.previousStep());
        this.elements.nextStep.addEventListener('click', () => this.nextStep());
        
        // Step indicator listeners
        document.querySelectorAll('.step-item').forEach((item, index) => {
            item.addEventListener('click', () => this.goToStep(index));
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            setTimeout(() => this.visualizer.handleResize(), 100);
        });
    }

    onSequenceChange() {
        this.validateInput();
        if (this.isInitialized) {
            this.resetToStep(0);
        }
    }

    onKmerLengthChange(e) {
        const value = parseInt(e.target.value);
        this.elements.kmerValue.textContent = value;
        
        if (this.isInitialized) {
            this.resetToStep(0);
        }
    }

    validateInput() {
        const query = this.elements.querySequence.value.trim();
        const database = this.elements.databaseSequence.value.trim();
        const kmerLength = parseInt(this.elements.kmerLength.value);
        
        // Basic validation
        let isValid = true;
        let errorMessage = '';
        
        if (!query || !database) {
            isValid = false;
            errorMessage = 'Both sequences are required';
        } else if (query.length < kmerLength) {
            isValid = false;
            errorMessage = `Query sequence must be at least ${kmerLength} characters`;
        } else if (database.length < kmerLength) {
            isValid = false;
            errorMessage = `Database sequence must be at least ${kmerLength} characters`;
        } else {
            // Validate characters
            const validChars = /^[ATCGN]+$/i;
            if (!validChars.test(query) || !validChars.test(database)) {
                isValid = false;
                errorMessage = 'Sequences must contain only A, T, C, G, N characters';
            }
        }
        
        // Update UI based on validation
        if (isValid) {
            this.elements.querySequence.classList.remove('input-error');
            this.elements.databaseSequence.classList.remove('input-error');
            this.elements.nextStep.disabled = false;
        } else {
            this.elements.querySequence.classList.add('input-error');
            this.elements.databaseSequence.classList.add('input-error');
            this.elements.nextStep.disabled = true;
            this.showNotification(errorMessage, 'error');
        }
        
        return isValid;
    }

    loadExample() {
        // Load a beginner example
        const examples = [
            {
                query: 'ATCGATCGAA',
                database: 'GGATCGATCGAATCGTAGCCATCGATCGAATTGCCGATCG',
                description: 'High similarity example with multiple matches'
            },
            {
                query: 'GCTAGCTAG',
                database: 'AAGCTAGCTAGTTGCTAGCTAGAAACCGCTAGCTGAATTCGCTAGCTAGG',
                description: 'Repetitive sequence with clear seeds'
            },
            {
                query: 'TTAACCGGTT',
                database: 'CCTTAACCGGTTAACCGGAACCTTAACCGGTTATCGTTAACCGGTTGGCC',
                description: 'Multiple similar regions'
            }
        ];
        
        const example = examples[Math.floor(Math.random() * examples.length)];
        
        this.elements.querySequence.value = example.query;
        this.elements.databaseSequence.value = example.database;
        
        this.showNotification(`Loaded: ${example.description}`, 'info');
        this.onSequenceChange();
    }

    loadDefaultExample() {
        this.elements.querySequence.value = 'ATCGATCGAA';
        this.elements.databaseSequence.value = 'GGATCGATCGAATCGTAGCCATCGATCGAA';
        this.validateInput();
    }

    resetBlast() {
        this.blastAlgorithm = new BlastAlgorithm();
        this.isInitialized = false;
        this.currentStep = 0;
        this.updateStepDisplay();
        this.updateSummaryStats();
        this.visualizer.clear();
        this.elements.nextStep.textContent = 'Next Step →';
        this.showNotification('BLAST demo reset', 'info');
    }

    resetToStep(stepNumber) {
        if (stepNumber <= this.currentStep) {
            this.currentStep = stepNumber;
            this.isInitialized = false;
            this.updateStepDisplay();
            this.updateSummaryStats();
            this.visualizer.clear();
        }
    }

    nextStep() {
        if (!this.validateInput()) return;
        
        if (!this.isInitialized) {
            // Initialize BLAST algorithm
            const query = this.elements.querySequence.value.trim();
            const database = this.elements.databaseSequence.value.trim();
            const kmerLength = parseInt(this.elements.kmerLength.value);
            
            const initResult = this.blastAlgorithm.initialize(query, database, kmerLength);
            if (!initResult.valid) {
                this.showNotification(initResult.error, 'error');
                return;
            }
            
            this.isInitialized = true;
        }
        
        // Execute current step
        const result = this.blastAlgorithm.executeStep(this.currentStep);
        if (!result.success) {
            this.showNotification(result.error || 'Error executing step', 'error');
            return;
        }
        
        // Update visualization
        this.updateVisualization();
        
        // Move to next step
        if (this.currentStep < this.maxSteps - 1) {
            this.currentStep++;
        }
        
        this.updateStepDisplay();
        this.updateSummaryStats();
        
        // Show completion message for final step
        if (this.currentStep === this.maxSteps - 1) {
            const summary = this.blastAlgorithm.getSummary();
            this.showNotification(
                `BLAST complete! Found ${summary.resultsCount} significant alignment(s)`,
                'success'
            );
        }
    }

    previousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.updateStepDisplay();
            this.updateVisualization();
        }
    }

    goToStep(stepNumber) {
        if (!this.isInitialized && stepNumber > 0) {
            this.showNotification('Please run the analysis first', 'warning');
            return;
        }
        
        if (stepNumber <= this.blastAlgorithm.currentStep) {
            this.currentStep = stepNumber;
            this.updateStepDisplay();
            this.updateVisualization();
        } else {
            this.showNotification('Complete previous steps first', 'warning');
        }
    }

    updateStepDisplay() {
        // Update step indicator
        document.querySelectorAll('.step-item').forEach((item, index) => {
            item.classList.remove('active', 'completed');
            if (index === this.currentStep) {
                item.classList.add('active');
            } else if (this.isInitialized && index < this.currentStep) {
                item.classList.add('completed');
            }
        });
        
        // Update navigation buttons
        this.elements.prevStep.disabled = this.currentStep === 0;
        this.elements.nextStep.disabled = this.currentStep === this.maxSteps - 1 && this.isInitialized;
        
        if (this.currentStep === this.maxSteps - 1) {
            this.elements.nextStep.textContent = 'Completed';
        } else {
            this.elements.nextStep.textContent = 'Next Step →';
        }
        
        // Update title and instructions
        this.elements.visualizationTitle.textContent = this.stepTitles[this.currentStep];
        this.elements.stepInstructionsContent.textContent = this.stepInstructions[this.currentStep];
        
        // Update step-specific controls
        this.updateStepControls();
    }

    updateStepControls() {
        const controlsContent = this.elements.stepControlsContent;
        controlsContent.innerHTML = '';
        
        switch (this.currentStep) {
            case 0:
                controlsContent.innerHTML = `
                    <div class="control-group">
                        <label>K-mer Length: ${this.elements.kmerLength.value}</label>
                        <p>Shorter k-mers = more matches, lower specificity</p>
                        <p>Longer k-mers = fewer matches, higher specificity</p>
                    </div>
                `;
                break;
            case 1:
                if (this.isInitialized) {
                    const summary = this.blastAlgorithm.getSummary();
                    controlsContent.innerHTML = `
                        <div class="control-group">
                            <label>Matching Statistics:</label>
                            <p>Total matches found: ${summary.matchesCount}</p>
                            <p>Click on matches in visualization to see details</p>
                        </div>
                    `;
                }
                break;
            case 2:
                if (this.isInitialized) {
                    const summary = this.blastAlgorithm.getSummary();
                    controlsContent.innerHTML = `
                        <div class="control-group">
                            <label>Seed Clustering:</label>
                            <p>Seeds identified: ${summary.seedsCount}</p>
                            <p>Seeds are clusters of nearby matches</p>
                        </div>
                    `;
                }
                break;
            case 3:
                controlsContent.innerHTML = `
                    <div class="control-group">
                        <label>Extension Parameters:</label>
                        <p>Match score: +2, Mismatch: -1</p>
                        <p>Extension stops when score drops significantly</p>
                    </div>
                `;
                break;
            case 4:
                if (this.isInitialized) {
                    const summary = this.blastAlgorithm.getSummary();
                    controlsContent.innerHTML = `
                        <div class="control-group">
                            <label>Final Results:</label>
                            <p>Significant alignments: ${summary.resultsCount}</p>
                            <p>Best score: ${summary.bestScore}</p>
                        </div>
                    `;
                }
                break;
        }
    }

    updateVisualization() {
        if (!this.isInitialized) return;
        
        const query = this.elements.querySequence.value.trim();
        const database = this.elements.databaseSequence.value.trim();
        const kmerLength = parseInt(this.elements.kmerLength.value);
        
        let visualizationData = {
            querySequence: query,
            databaseSequence: database,
            kmerLength: kmerLength
        };
        
        // Add step-specific data
        const stepData = this.blastAlgorithm.getCurrentStepData();
        visualizationData = { ...visualizationData, ...stepData };
        
        this.visualizer.visualizeStep(this.currentStep, visualizationData);
    }

    updateSummaryStats() {
        const summary = this.blastAlgorithm.getSummary();
        
        this.elements.kmersCount.textContent = summary.kmersCount || '-';
        this.elements.matchesCount.textContent = summary.matchesCount || '-';
        this.elements.seedsCount.textContent = summary.seedsCount || '-';
        this.elements.alignmentsCount.textContent = summary.resultsCount || '-';
        this.elements.bestScore.textContent = summary.bestScore || '-';
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

    // Get current algorithm state for debugging
    getState() {
        return {
            currentStep: this.currentStep,
            isInitialized: this.isInitialized,
            blastData: this.blastAlgorithm.getCurrentStepData(),
            summary: this.blastAlgorithm.getSummary()
        };
    }
}