class AlignmentEditor {
    constructor(containerId, scoringSystem) {
        this.container = document.getElementById(containerId);
        this.scoringSystem = scoringSystem;
        this.originalSeq1 = '';
        this.originalSeq2 = '';
        this.alignedSeq1 = '';
        this.alignedSeq2 = '';
        this.sequenceType = '';
        this.currentPosition = 0;
        this.activeSequence = 1;
        this.isActive = false;
        
        this.seq1Display = document.getElementById('sequence1-display');
        this.matchLineDisplay = document.getElementById('match-line');
        this.seq2Display = document.getElementById('sequence2-display');
        
        this.setupEventListeners();
    }

    initialize(seq1, seq2, sequenceType) {
        this.originalSeq1 = seq1;
        this.originalSeq2 = seq2;
        this.alignedSeq1 = seq1;
        this.alignedSeq2 = seq2;
        this.sequenceType = sequenceType;
        this.currentPosition = 0;
        this.activeSequence = 1;
        this.isActive = true;
        
        this.updateDisplay();
        this.container.focus();
        
        // Trigger initial statistics update
        this.onAlignmentChange();
    }

    setupEventListeners() {
        this.container.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.container.addEventListener('click', () => this.container.focus());
        this.container.setAttribute('tabindex', '0');
    }

    handleKeyDown(event) {
        if (!this.isActive) return;

        event.preventDefault();
        
        switch (event.key) {
            case 'ArrowLeft':
                this.moveCursor(-1);
                break;
            case 'ArrowRight':
                this.moveCursor(1);
                break;
            case 'ArrowUp':
                this.switchActiveSequence(1);
                break;
            case 'ArrowDown':
                this.switchActiveSequence(2);
                break;
            case ' ':
            case '-':
                this.insertGap();
                break;
            case 'Delete':
            case 'Backspace':
                this.removeGap(event.key);
                break;
            case 'Tab':
                this.switchActiveSequence(this.activeSequence === 1 ? 2 : 1);
                break;
        }
    }

    moveCursor(direction) {
        const maxLength = Math.max(this.alignedSeq1.length, this.alignedSeq2.length);
        this.currentPosition = Math.max(0, Math.min(maxLength, this.currentPosition + direction));
        this.updateDisplay();
    }

    switchActiveSequence(sequenceNumber) {
        this.activeSequence = sequenceNumber;
        this.updateDisplay();
    }

    insertGap() {
        const targetSeq = this.activeSequence === 1 ? 'alignedSeq1' : 'alignedSeq2';
        const currentSeq = this[targetSeq];
        
        if (this.currentPosition <= currentSeq.length) {
            this[targetSeq] = currentSeq.slice(0, this.currentPosition) + '-' + 
                            currentSeq.slice(this.currentPosition);
            this.currentPosition++;
            this.updateDisplay();
            this.onAlignmentChange();
        }
    }

    removeGap(keyPressed) {
        const targetSeq = this.activeSequence === 1 ? 'alignedSeq1' : 'alignedSeq2';
        const currentSeq = this[targetSeq];
        
        let removalPosition = this.currentPosition;
        if (keyPressed === 'Backspace' && this.currentPosition > 0) {
            removalPosition = this.currentPosition - 1;
        }

        if (removalPosition >= 0 && removalPosition < currentSeq.length && 
            currentSeq[removalPosition] === '-') {
            
            this[targetSeq] = currentSeq.slice(0, removalPosition) + 
                            currentSeq.slice(removalPosition + 1);
            
            if (keyPressed === 'Backspace') {
                this.currentPosition = Math.max(0, this.currentPosition - 1);
            }
            
            this.updateDisplay();
            this.onAlignmentChange();
        }
    }

    normalizeSequenceLengths() {
        const maxLength = Math.max(this.alignedSeq1.length, this.alignedSeq2.length);
        
        while (this.alignedSeq1.length < maxLength) {
            this.alignedSeq1 += '-';
        }
        
        while (this.alignedSeq2.length < maxLength) {
            this.alignedSeq2 += '-';
        }
        
        // Automatically trim terminal gaps
        this.trimTerminalGaps();
    }

    trimTerminalGaps() {
        if (!this.alignedSeq1 || !this.alignedSeq2) return;
        
        let seq1 = this.alignedSeq1;
        let seq2 = this.alignedSeq2;
        let startTrim = 0;
        let endTrim = 0;
        
        // Trim from the beginning (5' end)
        while (startTrim < Math.min(seq1.length, seq2.length) && 
               seq1[startTrim] === '-' && seq2[startTrim] === '-') {
            startTrim++;
        }
        
        // Trim from the end (3' end)
        let endPos = Math.min(seq1.length, seq2.length) - 1;
        while (endPos >= startTrim && 
               seq1[endPos] === '-' && seq2[endPos] === '-') {
            endTrim++;
            endPos--;
        }
        
        // Apply trimming if any terminal gaps were found
        if (startTrim > 0 || endTrim > 0) {
            const newLength = Math.min(seq1.length, seq2.length) - startTrim - endTrim;
            
            if (newLength > 0) {
                this.alignedSeq1 = seq1.substring(startTrim, seq1.length - endTrim);
                this.alignedSeq2 = seq2.substring(startTrim, seq2.length - endTrim);
                
                // Adjust cursor position to stay within bounds
                this.currentPosition = Math.max(0, Math.min(
                    this.currentPosition - startTrim,
                    Math.max(this.alignedSeq1.length, this.alignedSeq2.length)
                ));
                
                // Call callback to notify about terminal gap removal
                if (this.onTerminalGapTrimCallback) {
                    this.onTerminalGapTrimCallback({
                        startTrimmed: startTrim,
                        endTrimmed: endTrim,
                        totalTrimmed: startTrim + endTrim
                    });
                }
            }
        }
    }

    updateDisplay() {
        this.normalizeSequenceLengths();
        
        this.seq1Display.innerHTML = this.formatSequenceDisplay(this.alignedSeq1, 1);
        this.seq2Display.innerHTML = this.formatSequenceDisplay(this.alignedSeq2, 2);
        
        const matchLine = this.scoringSystem.generateMatchLine(this.alignedSeq1, this.alignedSeq2);
        this.matchLineDisplay.innerHTML = this.formatMatchLine(matchLine);
    }

    formatSequenceDisplay(sequence, sequenceNumber) {
        let html = '';
        for (let i = 0; i < sequence.length; i++) {
            const char = sequence[i];
            const isCurrentPosition = (i === this.currentPosition && this.activeSequence === sequenceNumber);
            const isActive = this.activeSequence === sequenceNumber;
            
            let classes = ['sequence-char'];
            
            if (char === '-') {
                classes.push('nucleotide-gap');
            } else {
                classes.push(this.getCharacterClass(char));
            }
            
            if (isCurrentPosition) {
                classes.push('cursor-position');
            }
            
            if (isActive) {
                classes.push('active-sequence');
            }
            
            html += `<span class="${classes.join(' ')}" data-position="${i}">${char}</span>`;
        }
        return html;
    }

    formatMatchLine(matchLine) {
        let html = '';
        for (let i = 0; i < matchLine.length; i++) {
            const char = matchLine[i];
            html += `<span class="match-char" data-position="${i}">${char}</span>`;
        }
        return html;
    }

    getCharacterClass(char) {
        if (this.sequenceType === 'DNA' || this.sequenceType === 'RNA') {
            switch (char.toUpperCase()) {
                case 'A': return 'nucleotide-A';
                case 'T':
                case 'U': return 'nucleotide-T';
                case 'C': return 'nucleotide-C';
                case 'G': return 'nucleotide-G';
                default: return 'nucleotide-gap';
            }
        } else if (this.sequenceType === 'PROTEIN') {
            const hydrophobic = 'AILMFPWV';
            const positive = 'RK';
            const negative = 'DE';
            const polar = 'NQSTYH';
            const aromatic = 'FWY';
            
            const upperChar = char.toUpperCase();
            
            if (upperChar === 'C') return 'aa-cysteine';
            if (upperChar === 'G') return 'aa-glycine';
            if (upperChar === 'P') return 'aa-proline';
            if (aromatic.includes(upperChar)) return 'aa-aromatic';
            if (positive.includes(upperChar)) return 'aa-positive';
            if (negative.includes(upperChar)) return 'aa-negative';
            if (polar.includes(upperChar)) return 'aa-polar';
            if (hydrophobic.includes(upperChar)) return 'aa-hydrophobic';
            
            return 'aa-hydrophobic';
        }
        
        return '';
    }

    onAlignmentChange() {
        if (this.onChangeCallback) {
            const alignmentData = {
                alignedSeq1: this.alignedSeq1,
                alignedSeq2: this.alignedSeq2,
                originalSeq1: this.originalSeq1,
                originalSeq2: this.originalSeq2,
                sequenceType: this.sequenceType
            };
            this.onChangeCallback(alignmentData);
        }
    }

    setOnChangeCallback(callback) {
        this.onChangeCallback = callback;
    }

    setOnTerminalGapTrimCallback(callback) {
        this.onTerminalGapTrimCallback = callback;
    }

    getAlignment() {
        return {
            alignedSeq1: this.alignedSeq1,
            alignedSeq2: this.alignedSeq2,
            originalSeq1: this.originalSeq1,
            originalSeq2: this.originalSeq2,
            sequenceType: this.sequenceType
        };
    }

    reset() {
        this.alignedSeq1 = this.originalSeq1;
        this.alignedSeq2 = this.originalSeq2;
        this.currentPosition = 0;
        this.activeSequence = 1;
        this.updateDisplay();
        this.onAlignmentChange();
    }

    removeGapOnlyColumns() {
        if (!this.alignedSeq1 || !this.alignedSeq2) return;
        
        this.normalizeSequenceLengths();
        
        let newSeq1 = '';
        let newSeq2 = '';
        
        for (let i = 0; i < this.alignedSeq1.length; i++) {
            const char1 = this.alignedSeq1[i];
            const char2 = this.alignedSeq2[i];
            
            // Keep the column if at least one sequence has a non-gap character
            if (char1 !== '-' || char2 !== '-') {
                newSeq1 += char1;
                newSeq2 += char2;
            }
        }
        
        this.alignedSeq1 = newSeq1;
        this.alignedSeq2 = newSeq2;
        
        // Adjust cursor position to stay within bounds
        this.currentPosition = Math.min(this.currentPosition, Math.max(newSeq1.length, newSeq2.length));
        
        // The updateDisplay() call will automatically trim terminal gaps via normalizeSequenceLengths()
        this.updateDisplay();
        this.onAlignmentChange();
    }

    setActive(active) {
        this.isActive = active;
        if (active) {
            this.container.focus();
        }
    }
}