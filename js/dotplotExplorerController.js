class DotplotExplorerController {
    constructor() {
        this.algorithm = new DotplotExplorerAlgorithm();
        this.visualizer = new DotplotExplorerVisualizer('dotplot-canvas');
        this.currentDotplotData = null;
        this.currentAlignmentBlocks = [];
        
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

        const allowMismatchesCheckbox = document.getElementById('allow-mismatches');
        allowMismatchesCheckbox.addEventListener('change', () => {
            this.algorithm.setMismatchTolerance(allowMismatchesCheckbox.checked);
            
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
        document.getElementById('show-alignments').addEventListener('click', () => this.showAlignments());
        document.getElementById('hide-alignments').addEventListener('click', () => this.hideAlignments());

        // Canvas interaction callback
        this.visualizer.setOnPositionClickCallback((data) => this.handlePositionClick(data));
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
        // Could show example info in a dedicated section if desired
        // For now, just enable the load button
        document.getElementById('load-selected-example').disabled = false;
    }

    hideExampleInfo() {
        document.getElementById('load-selected-example').disabled = true;
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
        
        // Set recommended parameters if available
        if (example.windowSize) {
            document.getElementById('window-size').value = example.windowSize;
            this.algorithm.setWindowSize(example.windowSize);
            document.getElementById('window-value').textContent = example.windowSize;
        }
        
        // Validate the example sequences
        this.validateSequenceInput(document.getElementById('sequence1'));
        this.validateSequenceInput(document.getElementById('sequence2'));
        
        // Generate dotplot automatically
        this.generateDotplot();
        
        this.showNotification(`Loaded example: ${example.name}`, 'info');
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
            this.clearError();
            
            // Reset alignment buttons - show alignments should be enabled, hide should be disabled
            document.getElementById('show-alignments').disabled = false;
            document.getElementById('hide-alignments').disabled = true;
            
            // Hide alignment details
            document.getElementById('alignment-details').style.display = 'none';
            this.currentAlignmentBlocks = [];
            
            // Ensure alignment visualization is hidden for new sequences
            this.visualizer.showAlignments(false);
            
        } catch (error) {
            this.showError('Error generating dotplot: ' + error.message);
            console.error('Dotplot generation error:', error);
        }
    }

    showAlignments() {
        if (!this.currentDotplotData) {
            this.showError('Generate a dotplot first');
            return;
        }

        try {
            // Find alignment blocks
            this.currentAlignmentBlocks = this.algorithm.findAlignmentBlocks();
            
            // Update visualizer
            this.visualizer.setAlignmentBlocks(this.currentAlignmentBlocks);
            this.visualizer.showAlignments(true);
            
            // Update button states
            document.getElementById('show-alignments').disabled = true;
            document.getElementById('hide-alignments').disabled = false;
            
            // Show alignment details
            this.displayAlignmentBlocks();
            
            this.showNotification(`Found ${this.currentAlignmentBlocks.length} alignment blocks`, 'success');
            
        } catch (error) {
            this.showError('Error finding alignments: ' + error.message);
            console.error('Alignment detection error:', error);
        }
    }

    hideAlignments() {
        this.visualizer.showAlignments(false);
        
        // Update button states
        document.getElementById('show-alignments').disabled = false;
        document.getElementById('hide-alignments').disabled = true;
        
        // Hide alignment details
        document.getElementById('alignment-details').style.display = 'none';
    }

    displayAlignmentBlocks() {
        const container = document.getElementById('alignment-blocks-list');
        const detailsSection = document.getElementById('alignment-details');
        
        if (!this.currentAlignmentBlocks || this.currentAlignmentBlocks.length === 0) {
            container.innerHTML = '<p class="no-alignments">No alignment blocks found with current parameters</p>';
            detailsSection.style.display = 'block';
            return;
        }

        let html = '';
        this.currentAlignmentBlocks.forEach((block, index) => {
            const type = block.isReverse ? 'Reverse' : 'Forward';
            const typeClass = block.isReverse ? 'reverse' : 'forward';
            
            html += `
                <div class="alignment-block-item ${typeClass}">
                    <div class="block-header">
                        <span class="block-type">${type} Block #${index + 1}</span>
                        <span class="block-score">Score: ${block.score}</span>
                    </div>
                    <div class="block-details">
                        <div class="block-coords">
                            <span>Seq1: ${block.startSeq1 + 1}-${block.endSeq1 + 1} (${block.endSeq1 - block.startSeq1 + 1} bp)</span>
                            <span>Seq2: ${block.startSeq2 + 1}-${block.endSeq2 + 1} (${Math.abs(block.endSeq2 - block.startSeq2) + 1} bp)</span>
                        </div>
                        <div class="block-stats">
                            <span>Matches: ${block.matches.length}</span>
                            <span>Identity: ${block.identity ? (block.identity * 100).toFixed(1) + '%' : '100.0%'}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        detailsSection.style.display = 'block';
    }


    handlePositionClick(data) {
        // Display sequence context at clicked position
        this.displayPositionContext(data);
    }

    displayPositionContext(data) {
        // Forward alignment display
        const positionDisplay = document.getElementById('position-display');
        const coordinates = document.getElementById('position-coordinates');
        const seq1Context = document.getElementById('seq1-context');
        const seq2Context = document.getElementById('seq2-context');
        const matchContext = document.getElementById('match-context');
        
        coordinates.textContent = `Position: Seq1[${data.seq1Position + 1}], Seq2[${data.seq2Position + 1}]`;
        
        // Create highlighted sequence context
        seq1Context.innerHTML = this.createHighlightedContext(data.seq1Context);
        seq2Context.innerHTML = this.createHighlightedContext(data.seq2Context);
        matchContext.innerHTML = this.createMatchContext(data.seq1Context, data.seq2Context);
        
        positionDisplay.style.display = 'block';
        
        // Reverse complement alignment display
        const reversePositionDisplay = document.getElementById('reverse-position-display');
        const reverseCoordinates = document.getElementById('reverse-position-coordinates');
        const reverseSeq1Context = document.getElementById('reverse-seq1-context');
        const reverseSeq2Context = document.getElementById('reverse-seq2-context');
        const reverseMatchContext = document.getElementById('reverse-match-context');
        
        reverseCoordinates.textContent = `Reverse: Seq1[${data.seq1Position + 1}], RevC2[${data.reverseSeq2Position + 1}]`;
        
        // Create highlighted reverse complement context
        reverseSeq1Context.innerHTML = this.createHighlightedContext(data.seq1ContextForReverse);
        reverseSeq2Context.innerHTML = this.createHighlightedContext(data.seq2ReverseContext);
        reverseMatchContext.innerHTML = this.createMatchContext(data.seq1ContextForReverse, data.seq2ReverseContext);
        
        reversePositionDisplay.style.display = 'block';
    }

    createHighlightedContext(context) {
        let html = '';
        for (let i = 0; i < context.segment.length; i++) {
            const char = context.segment[i];
            const cssClass = i === context.centerPosition ? 'center-base' : 'base';
            html += `<span class="${cssClass}">${char}</span>`;
        }
        return html;
    }

    createMatchContext(seq1Context, seq2Context) {
        let matchString = '';
        const minLength = Math.min(seq1Context.segment.length, seq2Context.segment.length);
        
        // First, build the raw match string without HTML
        for (let i = 0; i < minLength; i++) {
            const char1 = seq1Context.segment[i];
            const char2 = seq2Context.segment[i];
            
            // Skip spaces (positions outside sequence boundaries)
            if (char1 === ' ' || char2 === ' ') {
                matchString += ' ';
            } else if (char1.toUpperCase() === char2.toUpperCase()) {
                // Match - use | symbol
                matchString += '|';
            } else {
                // Mismatch - use space
                matchString += ' ';
            }
        }
        
        // Now wrap with highlighting, treating it as a single string
        let html = '';
        for (let i = 0; i < matchString.length; i++) {
            const char = matchString[i];
            const cssClass = i === seq1Context.centerPosition ? 'center-base' : 'base';
            html += `<span class="${cssClass}">${char}</span>`;
        }
        
        return html;
    }

    showNotification(message, type = 'info') {
        // Simple notification system
        const notification = document.createElement('div');
        notification.className = `notification notification-${type} show`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }

    showError(message) {
        console.error('Dotplot Explorer Error:', message);
        this.showNotification(message, 'error');
    }

    clearError() {
        // Error clearing is handled by removing error notifications
    }

    clearSequences() {
        // Clear inputs
        document.getElementById('sequence1').value = '';
        document.getElementById('sequence2').value = '';
        
        // Reset example selector
        document.getElementById('example-selector').value = '';
        this.hideExampleInfo();
        
        // Reset mismatch tolerance
        document.getElementById('allow-mismatches').checked = false;
        this.algorithm.setMismatchTolerance(false);
        
        // Hide displays
        document.getElementById('position-display').style.display = 'none';
        document.getElementById('reverse-position-display').style.display = 'none';
        document.getElementById('alignment-details').style.display = 'none';
        
        // Disable alignment buttons
        document.getElementById('show-alignments').disabled = true;
        document.getElementById('hide-alignments').disabled = true;
        
        // Clear visualizations
        this.visualizer.clear();
        
        // Statistics panel has been removed - no action needed
        
        this.currentDotplotData = null;
        this.currentAlignmentBlocks = [];
    }

    reset() {
        this.clearSequences();
        
        // Reset parameters to default
        document.getElementById('window-size').value = '8';
        this.algorithm.setWindowSize(8);
        document.getElementById('allow-mismatches').checked = false;
        this.algorithm.setMismatchTolerance(false);
        this.updateDisplayValues();
    }
}