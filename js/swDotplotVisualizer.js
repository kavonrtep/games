class SwDotplotVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.seq1 = '';
        this.seq2 = '';
        this.sequenceType = '';
        this.showScores = false;
        this.scoreMatrix = null;
        this.localAlignments = [];
        
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

    setShowScores(showScores, scoreMatrix = null) {
        this.showScores = showScores;
        this.scoreMatrix = scoreMatrix;
        
        if (this.seq1 && this.seq2) {
            this.updateDotplot(this.seq1, this.seq2, this.sequenceType);
        }
    }

    setLocalAlignments(alignments) {
        this.localAlignments = alignments || [];
        
        if (this.seq1 && this.seq2) {
            this.updateDotplot(this.seq1, this.seq2, this.sequenceType);
        }
    }

    updateDotplot(seq1, seq2, sequenceType) {
        this.seq1 = seq1;
        this.seq2 = seq2;
        this.sequenceType = sequenceType;
        
        this.drawDotplot();
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
        
        // Highlight local alignments
        if (this.localAlignments.length > 0) {
            this.drawLocalAlignments(margin, plotWidth, plotHeight, seq1Clean, seq2Clean);
        }
        
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
                    // Exact match - pale if alignments shown
                    fillColor = this.localAlignments.length > 0 ? '#2d374840' : '#2d3748';
                } else if (this.sequenceType === 'PROTEIN' && 
                          this.isConservativeSubstitution(char1, char2)) {
                    // Conservative substitution - pale if alignments shown
                    fillColor = this.localAlignments.length > 0 ? '#4a556840' : '#4a5568';
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

    drawLocalAlignments(margin, plotWidth, plotHeight, seq1Clean, seq2Clean) {
        const cellWidth = plotWidth / seq1Clean.length;
        const cellHeight = plotHeight / seq2Clean.length;
        
        // Use different colors for different alignments
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'];
        
        this.localAlignments.forEach((alignment, index) => {
            const color = colors[index % colors.length];
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 3;
            
            // Draw rectangle highlighting the alignment region
            const startX = margin + alignment.startPos1 * cellWidth;
            const startY = margin + alignment.startPos2 * cellHeight;
            const width = (alignment.endPos1 - alignment.startPos1 + 1) * cellWidth;
            const height = (alignment.endPos2 - alignment.startPos2 + 1) * cellHeight;
            
            this.ctx.strokeRect(startX, startY, width, height);
            
            // Remove diagonal line - just show rectangular highlighting
        });
    }

    drawScores(margin, plotWidth, plotHeight, seq1Clean, seq2Clean) {
        if (!this.scoreMatrix || !this.scoreMatrix.score) return;
        
        const cellWidth = plotWidth / seq1Clean.length;
        const cellHeight = plotHeight / seq2Clean.length;
        
        // Set up text rendering for scores
        this.ctx.fillStyle = '#1e3a8a'; // Very dark blue color for scores
        this.ctx.font = `bold ${Math.min(cellWidth, cellHeight) * 0.3}px monospace`;
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
                
                // Show all scores including zeros
                const scoreText = score.toString();
                if (scoreText.length <= 3) { // Limit text length for readability
                    this.ctx.fillText(scoreText, x, y);
                }
            }
        }
        
        // Reset text alignment
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'alphabetic';
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
        this.localAlignments = [];
        this.drawEmptyState();
    }
}