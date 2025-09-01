class DotplotGameController {
    constructor() {
        this.algorithm = new DotplotAlgorithm();
        this.visualizer = new DotplotDnaVisualizer('dotplot-canvas');
        this.currentDotplotData = null;
        
        this.setupEventListeners();
        this.updateDisplayValues();
        this.populateExampleMenu();
    }

    setupEventListeners() {
        // Sequence input events
        const seq1Input = document.getElementById('sequence1');
        const seq2Input = document.getElementById('sequence2');
        
        seq1Input.addEventListener('input', () => this.validateSequenceInput(seq1Input));
        seq2Input.addEventListener('input', () => this.validateSequenceInput(seq2Input));

        // Parameter controls
        const windowSizeSlider = document.getElementById('window-size');
        windowSizeSlider.addEventListener('input', () => {
            const size = parseInt(windowSizeSlider.value);
            this.algorithm.setWindowSize(size);
            document.getElementById('window-value').textContent = size;
            
            // Regenerate dotplot if sequences are present
            if (seq1Input.value && seq2Input.value) {
                this.generateDotplot();
            }
        });

        // Example selection
        const exampleSelector = document.getElementById('example-selector');
        exampleSelector.addEventListener('change', () => this.handleExampleSelection());
        
        // Control buttons
        document.getElementById('load-selected-example').addEventListener('click', () => this.loadSelectedExample());
        document.getElementById('generate-dotplot').addEventListener('click', () => this.generateDotplot());
        document.getElementById('clear-sequences').addEventListener('click', () => this.clearSequences());

        // Canvas interaction callback
        this.visualizer.setOnMatchClickCallback((data) => this.handleMatchClick(data));
    }

    validateSequenceInput(input) {
        const sequence = input.value.trim();
        const validation = this.algorithm.validateDnaSequence(sequence);
        
        // Remove any existing error styling
        input.classList.remove('error');
        
        // Show error if invalid
        if (sequence && !validation.valid) {
            input.classList.add('error');
            input.title = validation.message;
        } else {
            input.title = '';
        }

        // Auto-clean sequence to only DNA bases
        if (sequence && validation.valid) {
            if (input.value !== validation.cleaned) {
                input.value = validation.cleaned;
            }
        }
    }

    updateDisplayValues() {
        // Update slider display values
        const windowSize = document.getElementById('window-size').value;
        document.getElementById('window-value').textContent = windowSize;
    }

    populateExampleMenu() {
        const examplesList = this.algorithm.getExamplesList();
        const selector = document.getElementById('example-selector');
        
        // Clear existing options (except the first placeholder)
        while (selector.children.length > 1) {
            selector.removeChild(selector.lastChild);
        }
        
        // Add each example as an option
        for (const example of examplesList) {
            const option = document.createElement('option');
            option.value = example.key;
            option.textContent = example.name;
            selector.appendChild(option);
        }
    }

    handleExampleSelection() {
        const selector = document.getElementById('example-selector');
        const selectedKey = selector.value;
        
        if (selectedKey) {
            const example = this.algorithm.getExample(selectedKey);
            this.showExampleInfo(example);
        } else {
            this.hideExampleInfo();
        }
    }

    showExampleInfo(example) {
        const section = document.getElementById('example-info-section');
        const nameElement = document.getElementById('example-name');
        const descriptionElement = document.getElementById('example-description');
        const patternElement = document.getElementById('example-pattern');
        
        nameElement.textContent = example.name;
        descriptionElement.textContent = example.description;
        
        // Build comprehensive pattern information
        let patternInfo = example.expectedPattern;
        if (example.windowSizeRecommendation) {
            patternInfo += '. ' + example.windowSizeRecommendation;
        }
        patternElement.textContent = patternInfo;
        
        // Add educational notes if available
        if (example.educationalNotes) {
            let notesElement = document.getElementById('example-notes');
            if (!notesElement) {
                notesElement = document.createElement('p');
                notesElement.id = 'example-notes';
                notesElement.innerHTML = '<strong>Educational Notes:</strong> <span id="example-notes-text"></span>';
                document.getElementById('example-info-content').appendChild(notesElement);
            }
            document.getElementById('example-notes-text').textContent = example.educationalNotes;
            notesElement.style.display = 'block';
        } else {
            const notesElement = document.getElementById('example-notes');
            if (notesElement) {
                notesElement.style.display = 'none';
            }
        }
        
        section.style.display = 'block';
    }

    hideExampleInfo() {
        const section = document.getElementById('example-info-section');
        section.style.display = 'none';
    }

    loadSelectedExample() {
        const selector = document.getElementById('example-selector');
        const selectedKey = selector.value;
        
        if (!selectedKey) {
            this.showError('Please select an example first');
            return;
        }
        
        const example = this.algorithm.getExample(selectedKey);
        document.getElementById('sequence1').value = example.seq1;
        document.getElementById('sequence2').value = example.seq2;
        
        // Validate the example sequences
        this.validateSequenceInput(document.getElementById('sequence1'));
        this.validateSequenceInput(document.getElementById('sequence2'));
        
        // Generate dotplot automatically
        this.generateDotplot();
    }

    generateDotplot() {
        const seq1 = document.getElementById('sequence1').value.trim();
        const seq2 = document.getElementById('sequence2').value.trim();
        const windowSize = parseInt(document.getElementById('window-size').value);

        // Validate sequences
        const seq1Validation = this.algorithm.validateDnaSequence(seq1);
        const seq2Validation = this.algorithm.validateDnaSequence(seq2);

        if (!seq1Validation.valid) {
            this.showError('Sequence 1: ' + seq1Validation.message);
            return;
        }

        if (!seq2Validation.valid) {
            this.showError('Sequence 2: ' + seq2Validation.message);
            return;
        }

        // Generate dotplot
        try {
            this.currentDotplotData = this.algorithm.generateDotplot(seq1, seq2, windowSize);
            this.visualizer.updateDotplot(this.currentDotplotData);
            this.updateStatistics(this.currentDotplotData.statistics);
            this.clearError();
        } catch (error) {
            this.showError('Error generating dotplot: ' + error.message);
            console.error('Dotplot generation error:', error);
        }
    }

    updateStatistics(stats) {
        const container = document.getElementById('statistics-content');
        
        if (!stats || (stats.forwardMatches === 0 && stats.reverseMatches === 0)) {
            container.innerHTML = '<p class="no-stats">No matches found with current parameters</p>';
            return;
        }

        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">Sequence Lengths:</span>
                    <span class="stat-value">${stats.seq1Length} × ${stats.seq2Length}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Window Size:</span>
                    <span class="stat-value">${stats.windowSize}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Forward Matches:</span>
                    <span class="stat-value forward-color">${stats.forwardMatches}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Reverse Matches:</span>
                    <span class="stat-value reverse-color">${stats.reverseMatches}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Total Matches:</span>
                    <span class="stat-value">${stats.totalMatches}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Match Density:</span>
                    <span class="stat-value">${stats.matchDensity}</span>
                </div>
            </div>
        `;
    }

    handleMatchClick(data) {
        // Display the sequence alignment at clicked position
        this.displaySequenceAlignment(data);
    }

    displaySequenceAlignment(data) {
        if (!data.alignmentData || !data.reverseAlignmentData) return;
        
        // Display forward alignment
        const section = document.getElementById('alignment-section');
        const positionInfo = document.getElementById('alignment-position-info');
        const seq1Display = document.getElementById('seq1-alignment');
        const matchDisplay = document.getElementById('match-alignment');
        const seq2Display = document.getElementById('seq2-alignment');
        
        // Update position information
        positionInfo.textContent = `Forward: Seq1[${data.seq1Position + 1}] vs Seq2[${data.seq2Position + 1}]`;
        
        // Generate highlighted sequence displays for forward alignment
        seq1Display.innerHTML = this.createHighlightedSequence(
            data.alignmentData.seq1Segment, 
            data.alignmentData.seq1Center,
            'seq1'
        );
        
        matchDisplay.innerHTML = this.createHighlightedSequence(
            data.alignmentData.matchString, 
            data.alignmentData.seq1Center,
            'match'
        );
        
        seq2Display.innerHTML = this.createHighlightedSequence(
            data.alignmentData.seq2Segment, 
            data.alignmentData.seq2Center,
            'seq2'
        );
        
        // Display reverse complement alignment
        const reverseSection = document.getElementById('reverse-alignment-section');
        const reversePositionInfo = document.getElementById('reverse-alignment-position-info');
        const seq1ReverseDisplay = document.getElementById('seq1-reverse-alignment');
        const matchReverseDisplay = document.getElementById('match-reverse-alignment');
        const seq2ReverseDisplay = document.getElementById('seq2-reverse-alignment');
        
        // Update reverse position information - show original seq2 position for clarity
        reversePositionInfo.textContent = `Reverse: Seq1[${data.seq1Position + 1}] vs Rev2[${data.seq2Position + 1}]`;
        
        // Generate highlighted sequence displays for reverse complement alignment
        seq1ReverseDisplay.innerHTML = this.createHighlightedSequence(
            data.reverseAlignmentData.seq1Segment, 
            data.reverseAlignmentData.seq1Center,
            'seq1'
        );
        
        matchReverseDisplay.innerHTML = this.createHighlightedSequence(
            data.reverseAlignmentData.reverseMatchString, 
            data.reverseAlignmentData.seq1Center,
            'match'
        );
        
        seq2ReverseDisplay.innerHTML = this.createHighlightedSequence(
            data.reverseAlignmentData.reverseSeq2Segment, 
            data.reverseAlignmentData.reverseSeq2Center,
            'rev2'
        );
        
        // Show both alignment sections
        section.style.display = 'block';
        reverseSection.style.display = 'block';
    }

    createHighlightedSequence(sequence, centerPos, sequenceType) {
        let html = '';
        
        for (let i = 0; i < sequence.length; i++) {
            const char = sequence[i];
            let cssClass = 'base';
            
            if (sequenceType !== 'match') {
                // Add nucleotide-specific styling
                if (char === ' ') {
                    cssClass += ' nucleotide-space';
                } else {
                    cssClass += ` nucleotide-${char}`;
                }
            }
            
            // Highlight center position with frame
            if (i === centerPos) {
                cssClass += ' center-base';
            }
            
            // Highlight matches
            if (sequenceType === 'match' && char === '|') {
                cssClass += ' match-base';
            }
            
            // Use non-breaking space for display to maintain alignment
            const displayChar = char === ' ' ? '&nbsp;' : char;
            html += `<span class="${cssClass}">${displayChar}</span>`;
        }
        
        return html;
    }

    showError(message) {
        const container = document.getElementById('statistics-content');
        container.innerHTML = `<p class="error-message">${message}</p>`;
    }

    clearError() {
        // Error clearing is handled by updateStatistics
    }

    clearSequences() {
        // Clear inputs
        document.getElementById('sequence1').value = '';
        document.getElementById('sequence2').value = '';
        
        // Reset example selector
        document.getElementById('example-selector').value = '';
        this.hideExampleInfo();
        
        // Hide both alignment sections
        const alignmentSection = document.getElementById('alignment-section');
        if (alignmentSection) {
            alignmentSection.style.display = 'none';
        }
        
        const reverseAlignmentSection = document.getElementById('reverse-alignment-section');
        if (reverseAlignmentSection) {
            reverseAlignmentSection.style.display = 'none';
        }
        
        // Clear visualizations
        this.visualizer.clear();
        
        // Clear statistics
        document.getElementById('statistics-content').innerHTML = 
            '<p class="no-stats">Generate dotplot to see statistics</p>';
        
        this.currentDotplotData = null;
    }

    reset() {
        this.clearSequences();
        
        // Reset parameters to default
        document.getElementById('window-size').value = '3';
        this.algorithm.setWindowSize(3);
        this.updateDisplayValues();
    }
}