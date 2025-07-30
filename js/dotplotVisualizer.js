class DotplotVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.seq1 = '';
        this.seq2 = '';
        this.threshold = 0.5;
        this.sequenceType = '';
        this.dotData = [];
        this.showScores = false;
        this.scoreMatrix = null;
        
        this.setupCanvas();
        this.setupEventListeners();
    }

    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        this.canvasWidth = rect.width;
        this.canvasHeight = rect.height;
    }

    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        
        window.addEventListener('resize', () => {
            setTimeout(() => this.setupCanvas(), 100);
            if (this.seq1 && this.seq2) {
                this.updateDotplot(this.seq1, this.seq2, this.sequenceType);
            }
        });
    }

    updateParameters(threshold) {
        this.threshold = threshold;
        
        if (this.seq1 && this.seq2) {
            this.updateDotplot(this.seq1, this.seq2, this.sequenceType);
        }
    }

    setShowScores(showScores, scoreMatrix = null) {
        this.showScores = showScores;
        this.scoreMatrix = scoreMatrix;
        
        if (this.seq1 && this.seq2) {
            this.updateDotplot(this.seq1, this.seq2, this.sequenceType);
        }
    }

    updateDotplot(seq1, seq2, sequenceType) {
        this.seq1 = seq1;
        this.seq2 = seq2;
        this.sequenceType = sequenceType;
        
        this.calculateDotData();
        this.drawDotplot();
    }

    calculateDotData() {
        this.dotData = [];
        
        const seq1Clean = this.seq1.replace(/-/g, '');
        const seq2Clean = this.seq2.replace(/-/g, '');
        
        if (!seq1Clean || !seq2Clean) return;

        for (let i = 0; i < seq1Clean.length; i++) {
            for (let j = 0; j < seq2Clean.length; j++) {
                const char1 = seq1Clean[i];
                const char2 = seq2Clean[j];
                
                const similarity = this.calculateSimilarity(char1, char2);
                
                if (similarity >= this.threshold) {
                    this.dotData.push({
                        x: i,
                        y: j,
                        similarity: similarity,
                        char1: char1,
                        char2: char2
                    });
                }
            }
        }
    }

    calculateSimilarity(char1, char2) {
        if (char1 === char2) {
            return 1.0; // Exact match
        } else if (this.sequenceType === 'PROTEIN' && 
                  this.isConservativeSubstitution(char1, char2)) {
            return 0.5; // Conservative substitution
        }
        return 0.0; // No match
    }

    isConservativeSubstitution(char1, char2) {
        const conservativeGroups = [
            ['A', 'G', 'S', 'T'],
            ['D', 'E'],
            ['N', 'Q'],
            ['R', 'K', 'H'],
            ['I', 'L', 'V', 'M'],
            ['F', 'Y', 'W']
        ];

        for (const group of conservativeGroups) {
            if (group.includes(char1) && group.includes(char2)) {
                return true;
            }
        }
        return false;
    }

    drawDotplot() {
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        const seq1Clean = this.seq1.replace(/-/g, '');
        const seq2Clean = this.seq2.replace(/-/g, '');
        
        if (!seq1Clean || !seq2Clean) {
            this.drawEmptyState();
            return;
        }

        const margin = 30;
        const plotWidth = this.canvasWidth - 2 * margin;
        const plotHeight = this.canvasHeight - 2 * margin;
        
        this.drawAxes(margin, plotWidth, plotHeight, seq1Clean, seq2Clean);
        this.drawCheckersGrid(margin, plotWidth, plotHeight, seq1Clean.length, seq2Clean.length);
        this.drawMatches(margin, plotWidth, plotHeight, seq1Clean, seq2Clean);
        this.drawAlignmentDots(margin, plotWidth, plotHeight, seq1Clean, seq2Clean);
        
        // Draw scores if enabled
        if (this.showScores && this.scoreMatrix) {
            this.drawScores(margin, plotWidth, plotHeight, seq1Clean, seq2Clean);
        }
    }

    drawAxes(margin, plotWidth, plotHeight, seq1, seq2) {
        this.ctx.strokeStyle = '#4a5568';
        this.ctx.lineWidth = 1;
        this.ctx.font = '11px monospace';
        this.ctx.fillStyle = '#2d3748';

        // Draw main axes
        this.ctx.beginPath();
        this.ctx.moveTo(margin, margin);
        this.ctx.lineTo(margin, margin + plotHeight);
        this.ctx.lineTo(margin + plotWidth, margin + plotHeight);
        this.ctx.stroke();

        // Draw sequence 1 letters (horizontal axis - top)
        for (let i = 0; i < seq1.length; i++) {
            const x = margin + (i + 0.5) / seq1.length * plotWidth;
            this.ctx.fillText(seq1[i], x - 4, margin - 5);
        }

        // Draw sequence 2 letters (vertical axis - left, top to bottom)
        for (let j = 0; j < seq2.length; j++) {
            const y = margin + (j + 0.5) / seq2.length * plotHeight;
            this.ctx.fillText(seq2[j], margin - 15, y + 4);
        }

        // Draw axis labels
        this.ctx.save();
        this.ctx.translate(10, margin + plotHeight / 2);
        this.ctx.rotate(-Math.PI / 2);
        this.ctx.fillText('Seq 2', -15, 0);
        this.ctx.restore();

        this.ctx.fillText('Seq 1', margin + plotWidth / 2 - 15, margin - 20);
    }

    drawCheckersGrid(margin, plotWidth, plotHeight, seq1Length, seq2Length) {
        const cellWidth = plotWidth / seq1Length;
        const cellHeight = plotHeight / seq2Length;

        // Draw checkerboard background
        for (let i = 0; i < seq1Length; i++) {
            for (let j = 0; j < seq2Length; j++) {
                const x = margin + i * cellWidth;
                const y = margin + j * cellHeight;
                
                // Alternate colors for checkerboard pattern
                if ((i + j) % 2 === 0) {
                    this.ctx.fillStyle = '#f7fafc';
                } else {
                    this.ctx.fillStyle = '#edf2f7';
                }
                
                this.ctx.fillRect(x, y, cellWidth, cellHeight);
            }
        }

        // Draw grid lines
        this.ctx.strokeStyle = '#cbd5e0';
        this.ctx.lineWidth = 0.5;

        // Vertical lines
        for (let i = 0; i <= seq1Length; i++) {
            const x = margin + i * cellWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(x, margin);
            this.ctx.lineTo(x, margin + plotHeight);
            this.ctx.stroke();
        }

        // Horizontal lines
        for (let j = 0; j <= seq2Length; j++) {
            const y = margin + j * cellHeight;
            this.ctx.beginPath();
            this.ctx.moveTo(margin, y);
            this.ctx.lineTo(margin + plotWidth, y);
            this.ctx.stroke();
        }
    }

    drawMatches(margin, plotWidth, plotHeight, seq1, seq2) {
        const cellWidth = plotWidth / seq1.length;
        const cellHeight = plotHeight / seq2.length;

        // Draw matches as filled cells
        for (let i = 0; i < seq1.length; i++) {
            for (let j = 0; j < seq2.length; j++) {
                const char1 = seq1[i];
                const char2 = seq2[j];
                
                // Check if characters match
                let fillColor = null;
                if (char1 === char2) {
                    // Exact match - dark blue, pale if scores shown
                    fillColor = this.showScores ? '#2d374860' : '#2d3748';
                } else if (this.sequenceType === 'PROTEIN' && 
                          this.isConservativeSubstitution(char1, char2)) {
                    // Conservative substitution - lighter blue, pale if scores shown
                    fillColor = this.showScores ? '#4a556860' : '#4a5568';
                }
                
                if (fillColor) {
                    const x = margin + i * cellWidth;
                    const y = margin + j * cellHeight;
                    
                    this.ctx.fillStyle = fillColor;
                    this.ctx.fillRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);
                    
                    // Add a subtle border for better visibility
                    this.ctx.strokeStyle = '#1a202c';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);
                }
            }
        }
    }

    drawAlignmentDots(margin, plotWidth, plotHeight, seq1Clean, seq2Clean) {
        // Only draw if we have the aligned sequences with gaps
        if (!this.seq1 || !this.seq2) return;
        
        const alignedSeq1 = this.seq1; // This includes gaps
        const alignedSeq2 = this.seq2; // This includes gaps
        
        // Get the alignment pairs and gaps
        const alignmentData = this.getAlignmentData(alignedSeq1, alignedSeq2, seq1Clean, seq2Clean);
        
        // Debug logging
        if (alignmentData.gaps.length > 0) {
            console.log('Alignment:', alignedSeq1, 'vs', alignedSeq2);
            console.log('Clean seqs:', seq1Clean, 'vs', seq2Clean);
            console.log('Gaps found:', alignmentData.gaps);
        }
        
        const cellWidth = plotWidth / seq1Clean.length;
        const cellHeight = plotHeight / seq2Clean.length;
        
        // Draw red diagonal lines for each aligned pair
        this.ctx.strokeStyle = this.showScores ? '#dc262660' : '#dc2626'; // Red color, pale if scores shown
        this.ctx.lineWidth = 4;
        
        for (const pair of alignmentData.pairs) {
            const centerX = margin + (pair.seq1Pos + 0.5) * cellWidth;
            const centerY = margin + (pair.seq2Pos + 0.5) * cellHeight;
            
            // Draw diagonal line from top-left to bottom-right of cell
            this.ctx.beginPath();
            this.ctx.moveTo(centerX - cellWidth * 0.3, centerY - cellHeight * 0.3);
            this.ctx.lineTo(centerX + cellWidth * 0.3, centerY + cellHeight * 0.3);
            this.ctx.stroke();
        }
        
        // Draw gap lines in green
        this.ctx.strokeStyle = this.showScores ? '#22c55e60' : '#22c55e'; // Green color for gaps, pale if scores shown
        this.ctx.lineWidth = 4;
        
        // Draw gaps as lines
        for (const gap of alignmentData.gaps) {
            if (gap.axis === 'seq1') {
                // Gap in seq1 - draw vertical line
                // Only draw if within bounds
                if (gap.seq1CleanPos < seq1Clean.length && gap.seq2CleanPos < seq2Clean.length) {
                    const centerX = margin + (gap.seq1CleanPos + 0.5) * cellWidth;
                    const centerY = margin + (gap.seq2CleanPos + 0.5) * cellHeight;
                    
                    // Draw vertical line
                    this.ctx.beginPath();
                    this.ctx.moveTo(centerX, centerY - cellHeight * 0.3);
                    this.ctx.lineTo(centerX, centerY + cellHeight * 0.3);
                    this.ctx.stroke();
                }
            } else {
                // Gap in seq2 - draw horizontal line
                // Only draw if within bounds
                if (gap.seq1CleanPos < seq1Clean.length && gap.seq2CleanPos < seq2Clean.length) {
                    const centerX = margin + (gap.seq1CleanPos + 0.5) * cellWidth;
                    const centerY = margin + (gap.seq2CleanPos + 0.5) * cellHeight;
                    
                    // Draw horizontal line
                    this.ctx.beginPath();
                    this.ctx.moveTo(centerX - cellWidth * 0.3, centerY);
                    this.ctx.lineTo(centerX + cellWidth * 0.3, centerY);
                    this.ctx.stroke();
                }
            }
        }
    }

    drawScores(margin, plotWidth, plotHeight, seq1Clean, seq2Clean) {
        if (!this.scoreMatrix || !this.scoreMatrix.score) return;
        
        const cellWidth = plotWidth / seq1Clean.length;
        const cellHeight = plotHeight / seq2Clean.length;
        
        // Set up text rendering for scores
        this.ctx.fillStyle = '#1e3a8a'; // Very dark blue color for scores
        this.ctx.font = `bold ${Math.min(cellWidth, cellHeight) * 0.35}px monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Draw scores in each cell - ensure we don't exceed matrix bounds
        const maxI = Math.min(seq1Clean.length, this.scoreMatrix.score.length - 1);
        const maxJ = Math.min(seq2Clean.length, this.scoreMatrix.score[0].length - 1);
        
        for (let i = 1; i <= maxI; i++) {
            for (let j = 1; j <= maxJ; j++) {
                const score = this.scoreMatrix.score[i][j];
                const x = margin + (i - 0.5) * cellWidth;
                const y = margin + (j - 0.5) * cellHeight;
                
                // Only draw scores that fit well in the cell
                const scoreText = score.toString();
                if (scoreText.length <= 4) { // Limit text length for readability
                    this.ctx.fillText(scoreText, x, y);
                }
            }
        }
        
        // Reset text alignment
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'alphabetic';
    }

    getAlignmentData(alignedSeq1, alignedSeq2, seq1Clean, seq2Clean) {
        const pairs = [];
        const gaps = [];
        let seq1CleanPos = 0;
        let seq2CleanPos = 0;
        
        // Go through each position in the aligned sequences
        for (let i = 0; i < Math.max(alignedSeq1.length, alignedSeq2.length); i++) {
            const char1 = i < alignedSeq1.length ? alignedSeq1[i] : '';
            const char2 = i < alignedSeq2.length ? alignedSeq2[i] : '';
            
            // Skip positions where both sequences have gaps
            if (char1 === '-' && char2 === '-') {
                continue;
            }
            
            // Only add pairs where both sequences have actual characters (aligned against each other)
            if (char1 !== '-' && char2 !== '-' && char1 !== '' && char2 !== '') {
                if (seq1CleanPos < seq1Clean.length && seq2CleanPos < seq2Clean.length) {
                    pairs.push({
                        seq1Pos: seq1CleanPos,
                        seq2Pos: seq2CleanPos,
                        char1: char1,
                        char2: char2,
                        isMatch: char1 === char2
                    });
                }
                seq1CleanPos++;
                seq2CleanPos++;
            } 
            // Gap in sequence 1 (insertion in sequence 2) - advance seq2 position only
            else if (char1 === '-' && char2 !== '-' && char2 !== '') {
                gaps.push({
                    axis: 'seq1', // Gap is in seq1
                    seq1CleanPos: Math.max(0, seq1CleanPos - 1), // Position of base BEFORE the gap
                    seq2CleanPos: seq2CleanPos, // Position in seq2 that aligns with this gap
                    gapChar: char1,
                    realChar: char2
                });
                seq2CleanPos++;
            }
            // Gap in sequence 2 (insertion in sequence 1) - advance seq1 position only
            else if (char1 !== '-' && char1 !== '' && char2 === '-') {
                gaps.push({
                    axis: 'seq2', // Gap is in seq2
                    seq1CleanPos: seq1CleanPos, // Position in seq1 that aligns with this gap
                    seq2CleanPos: Math.max(0, seq2CleanPos - 1), // Position of base BEFORE the gap
                    gapChar: char2,
                    realChar: char1
                });
                seq1CleanPos++;
            }
        }
        
        return { pairs, gaps };
    }

    getAlignmentPairs(alignedSeq1, alignedSeq2, seq1Clean, seq2Clean) {
        return this.getAlignmentData(alignedSeq1, alignedSeq2, seq1Clean, seq2Clean).pairs;
    }

    drawEmptyState() {
        this.ctx.fillStyle = '#a0aec0';
        this.ctx.font = '16px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Enter sequences to see dotplot', 
                         this.canvasWidth / 2, this.canvasHeight / 2);
        this.ctx.textAlign = 'left';
    }

    handleCanvasClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const margin = 30;
        const plotWidth = this.canvasWidth - 2 * margin;
        const plotHeight = this.canvasHeight - 2 * margin;
        
        if (x >= margin && x <= margin + plotWidth && 
            y >= margin && y <= margin + plotHeight) {
            
            const seq1Clean = this.seq1.replace(/-/g, '');
            const seq2Clean = this.seq2.replace(/-/g, '');
            
            const cellWidth = plotWidth / seq1Clean.length;
            const cellHeight = plotHeight / seq2Clean.length;
            
            const seq1Pos = Math.floor((x - margin) / cellWidth);
            const seq2Pos = Math.floor((y - margin) / cellHeight);
            
            if (seq1Pos >= 0 && seq1Pos < seq1Clean.length && 
                seq2Pos >= 0 && seq2Pos < seq2Clean.length) {
                
                if (this.onDotClickCallback) {
                    this.onDotClickCallback({
                        seq1Position: seq1Pos,
                        seq2Position: seq2Pos,
                        seq1Char: seq1Clean[seq1Pos],
                        seq2Char: seq2Clean[seq2Pos]
                    });
                }
            }
        }
    }

    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const margin = 30;
        const plotWidth = this.canvasWidth - 2 * margin;
        const plotHeight = this.canvasHeight - 2 * margin;
        
        if (x >= margin && x <= margin + plotWidth && 
            y >= margin && y <= margin + plotHeight) {
            
            this.canvas.style.cursor = 'crosshair';
            
            if (this.onMouseMoveCallback) {
                const seq1Clean = this.seq1.replace(/-/g, '');
                const seq2Clean = this.seq2.replace(/-/g, '');
                
                const cellWidth = plotWidth / seq1Clean.length;
                const cellHeight = plotHeight / seq2Clean.length;
                
                const seq1Pos = Math.floor((x - margin) / cellWidth);
                const seq2Pos = Math.floor((y - margin) / cellHeight);
                
                if (seq1Pos >= 0 && seq1Pos < seq1Clean.length && 
                    seq2Pos >= 0 && seq2Pos < seq2Clean.length) {
                    
                    this.onMouseMoveCallback({
                        seq1Position: seq1Pos,
                        seq2Position: seq2Pos,
                        seq1Char: seq1Clean[seq1Pos],
                        seq2Char: seq2Clean[seq2Pos]
                    });
                }
            }
        } else {
            this.canvas.style.cursor = 'default';
        }
    }

    setOnDotClickCallback(callback) {
        this.onDotClickCallback = callback;
    }

    setOnMouseMoveCallback(callback) {
        this.onMouseMoveCallback = callback;
    }

    clear() {
        this.seq1 = '';
        this.seq2 = '';
        this.dotData = [];
        this.drawEmptyState();
    }
}