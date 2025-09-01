class DotplotDnaVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.seq1 = '';
        this.seq2 = '';
        this.seq2Reverse = '';
        this.forwardMatches = [];
        this.reverseMatches = [];
        this.windowSize = 3;
        this.clickedPosition = null; // Store clicked position for cross highlighting
        
        this.setupCanvas();
        this.setupEventListeners();
    }

    setupCanvas() {
        this.updateCanvasDimensions();
    }

    updateCanvasDimensions() {
        const container = this.canvas.parentElement;
        const containerRect = container.getBoundingClientRect();
        const maxWidth = containerRect.width;
        const maxHeight = Math.min(containerRect.height, 600); // Maximum height
        
        // Calculate required dimensions based on sequence lengths
        const { canvasWidth, canvasHeight } = this.calculateCanvasDimensions(maxWidth, maxHeight);
        
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = canvasWidth * dpr;
        this.canvas.height = canvasHeight * dpr;
        
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = canvasWidth + 'px';
        this.canvas.style.height = canvasHeight + 'px';
        
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
    }

    calculateCanvasDimensions(maxWidth, maxHeight) {
        if (!this.seq1 || !this.seq2) {
            // Default square canvas when no sequences
            const size = Math.min(maxWidth, maxHeight);
            return { canvasWidth: size, canvasHeight: size };
        }
        
        const margin = 100; // Space for axes and labels (50 on each side)
        const seq1Length = this.seq1.length;
        const seq2Length = this.seq2.length;
        
        // Calculate the aspect ratio needed
        const aspectRatio = seq1Length / seq2Length;
        
        // Calculate dimensions that maintain square cells
        let plotWidth, plotHeight;
        
        if (aspectRatio >= 1) {
            // Sequence 1 is longer or equal
            plotWidth = maxWidth - margin;
            plotHeight = plotWidth / aspectRatio;
            
            // Check if height exceeds maximum
            if (plotHeight + margin > maxHeight) {
                plotHeight = maxHeight - margin;
                plotWidth = plotHeight * aspectRatio;
            }
        } else {
            // Sequence 2 is longer
            plotHeight = maxHeight - margin;
            plotWidth = plotHeight * aspectRatio;
            
            // Check if width exceeds maximum
            if (plotWidth + margin > maxWidth) {
                plotWidth = maxWidth - margin;
                plotHeight = plotWidth / aspectRatio;
            }
        }
        
        return {
            canvasWidth: plotWidth + margin,
            canvasHeight: plotHeight + margin
        };
    }

    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        
        // Add keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeyNavigation(e));
        
        // Make canvas focusable for keyboard events
        this.canvas.tabIndex = 0;
        
        window.addEventListener('resize', () => {
            setTimeout(() => {
                this.updateCanvasDimensions();
                if (this.seq1 && this.seq2) {
                    this.drawDotplot();
                }
            }, 100);
        });
    }

    updateDotplot(dotplotData) {
        this.seq1 = dotplotData.seq1;
        this.seq2 = dotplotData.seq2;
        this.seq2Reverse = dotplotData.seq2Reverse;
        this.forwardMatches = dotplotData.forwardMatches;
        this.reverseMatches = dotplotData.reverseMatches;
        this.windowSize = dotplotData.windowSize;
        
        // Recalculate canvas dimensions based on new sequence lengths
        this.updateCanvasDimensions();
        
        this.drawDotplot();
    }

    drawDotplot() {
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        if (!this.seq1 || !this.seq2) {
            this.drawEmptyState();
            return;
        }

        const margin = 50;
        const plotWidth = this.canvasWidth - 2 * margin;
        const plotHeight = this.canvasHeight - 2 * margin;
        
        this.drawAxes(margin, plotWidth, plotHeight);
        this.drawGrid(margin, plotWidth, plotHeight);
        this.drawCrossHighlight(margin, plotWidth, plotHeight);
        this.drawMatches(margin, plotWidth, plotHeight);
    }

    drawAxes(margin, plotWidth, plotHeight) {
        this.ctx.strokeStyle = '#4a5568';
        this.ctx.lineWidth = 2;
        this.ctx.font = '12px monospace';
        this.ctx.fillStyle = '#2d3748';

        // Draw main axes
        this.ctx.beginPath();
        this.ctx.moveTo(margin, margin);
        this.ctx.lineTo(margin, margin + plotHeight);
        this.ctx.lineTo(margin + plotWidth, margin + plotHeight);
        this.ctx.stroke();

        // Draw sequence 1 (horizontal axis - top)
        this.ctx.fillStyle = '#2d3748';
        for (let i = 0; i < this.seq1.length; i++) {
            const x = margin + (i + 0.5) / this.seq1.length * plotWidth;
            this.ctx.fillText(this.seq1[i], x - 4, margin - 5);
        }

        // Draw sequence 2 (vertical axis - left)
        for (let j = 0; j < this.seq2.length; j++) {
            const y = margin + (j + 0.5) / this.seq2.length * plotHeight;
            this.ctx.fillText(this.seq2[j], margin - 20, y + 4);
        }

        // Draw sequence 2 complement (vertical axis - right)
        // For dotplot visualization, show complement bases in same order as forward sequence
        this.ctx.fillStyle = '#dc2626'; // Red color to indicate complement
        const seq2Complement = this.getComplement(this.seq2);
        for (let j = 0; j < seq2Complement.length; j++) {
            const y = margin + (j + 0.5) / seq2Complement.length * plotHeight;
            this.ctx.fillText(seq2Complement[j], margin + plotWidth + 10, y + 4);
        }

        // Draw axis labels
        this.ctx.fillStyle = '#2d3748';
        this.ctx.font = '14px sans-serif';
        
        // Horizontal axis label
        this.ctx.fillText('Sequence 1', margin + plotWidth / 2 - 40, margin - 25);
        
        // Left vertical axis label
        this.ctx.save();
        this.ctx.translate(15, margin + plotHeight / 2);
        this.ctx.rotate(-Math.PI / 2);
        this.ctx.fillText('Seq 2', -15, 0);
        this.ctx.restore();

        // Right vertical axis label
        this.ctx.save();
        this.ctx.translate(margin + plotWidth + 35, margin + plotHeight / 2);
        this.ctx.rotate(-Math.PI / 2);
        this.ctx.fillStyle = '#dc2626';
        this.ctx.fillText('Seq 2 Comp', -30, 0);
        this.ctx.restore();

        // Window size indicator
        this.ctx.fillStyle = '#4a5568';
        this.ctx.font = '12px sans-serif';
        this.ctx.fillText(`Window Size: ${this.windowSize}`, margin, this.canvasHeight - 5);
    }

    drawGrid(margin, plotWidth, plotHeight) {
        const cellWidth = plotWidth / this.seq1.length;
        const cellHeight = plotHeight / this.seq2.length;

        // Draw light grid lines
        this.ctx.strokeStyle = '#e2e8f0';
        this.ctx.lineWidth = 0.5;

        // Vertical lines
        for (let i = 0; i <= this.seq1.length; i++) {
            const x = margin + i * cellWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(x, margin);
            this.ctx.lineTo(x, margin + plotHeight);
            this.ctx.stroke();
        }

        // Horizontal lines
        for (let j = 0; j <= this.seq2.length; j++) {
            const y = margin + j * cellHeight;
            this.ctx.beginPath();
            this.ctx.moveTo(margin, y);
            this.ctx.lineTo(margin + plotWidth, y);
            this.ctx.stroke();
        }
    }

    drawCrossHighlight(margin, plotWidth, plotHeight) {
        if (!this.clickedPosition) return;
        
        const cellWidth = plotWidth / this.seq1.length;
        const cellHeight = plotHeight / this.seq2.length;
        const { seq1Pos, seq2Pos } = this.clickedPosition;
        
        // Draw grey cross to highlight clicked position
        this.ctx.fillStyle = '#a0a0a0'; // Grey color
        this.ctx.globalAlpha = 0.4; // Semi-transparent
        
        // Draw horizontal line (across entire row)
        const rowY = margin + seq2Pos * cellHeight;
        this.ctx.fillRect(margin, rowY, plotWidth, cellHeight);
        
        // Draw vertical line (across entire column)  
        const colX = margin + seq1Pos * cellWidth;
        this.ctx.fillRect(colX, margin, cellWidth, plotHeight);
        
        this.ctx.globalAlpha = 1.0; // Reset transparency
    }

    drawMatches(margin, plotWidth, plotHeight) {
        const cellWidth = plotWidth / this.seq1.length;
        const cellHeight = plotHeight / this.seq2.length;

        // Draw forward matches (green) as diagonal lines
        this.drawMatchLines(this.forwardMatches, margin, cellWidth, cellHeight, '#22c55e', false);
        
        // Draw reverse matches (red) as diagonal lines
        this.drawMatchLines(this.reverseMatches, margin, cellWidth, cellHeight, '#dc2626', true);
    }

    drawMatchLines(matches, margin, cellWidth, cellHeight, color, isReverse) {
        if (matches.length === 0) return;

        // Group matches into lines based on their lineLength and starting position
        const lines = this.groupMatchesIntoLines(matches);
        
        // First draw the diagonal lines
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';

        for (const line of lines) {
            const startMatch = line[0];
            const endMatch = line[line.length - 1];
            
            let startX, startY, endX, endY;
            
            if (isReverse) {
                // For reverse matches, map seq2 position back to original coordinates
                const startReverseSeq2Pos = this.seq2.length - startMatch.seq2Position - 1;
                const endReverseSeq2Pos = this.seq2.length - endMatch.seq2Position - 1;
                
                startX = margin + (startMatch.seq1Position + 0.5) * cellWidth;
                startY = margin + (startReverseSeq2Pos + 0.5) * cellHeight;
                endX = margin + (endMatch.seq1Position + 0.5) * cellWidth;
                endY = margin + (endReverseSeq2Pos + 0.5) * cellHeight;
            } else {
                // Forward matches use direct coordinates
                startX = margin + (startMatch.seq1Position + 0.5) * cellWidth;
                startY = margin + (startMatch.seq2Position + 0.5) * cellHeight;
                endX = margin + (endMatch.seq1Position + 0.5) * cellWidth;
                endY = margin + (endMatch.seq2Position + 0.5) * cellHeight;
            }

            // Draw the diagonal line
            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(endX, endY);
            this.ctx.stroke();
        }
        
        // Then draw individual dots for each match position
        this.drawMatchDots(matches, margin, cellWidth, cellHeight, color, isReverse);
    }

    drawMatchDots(matches, margin, cellWidth, cellHeight, color, isReverse) {
        const dotRadius = Math.min(cellWidth, cellHeight) * 0.15;
        
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = this.darkenColor(color);
        this.ctx.lineWidth = 1;

        for (const match of matches) {
            let dotX, dotY;
            
            if (isReverse) {
                // For reverse matches, map seq2 position back to original coordinates
                const reverseSeq2Pos = this.seq2.length - match.seq2Position - 1;
                dotX = margin + (match.seq1Position + 0.5) * cellWidth;
                dotY = margin + (reverseSeq2Pos + 0.5) * cellHeight;
            } else {
                // Forward matches use direct coordinates
                dotX = margin + (match.seq1Position + 0.5) * cellWidth;
                dotY = margin + (match.seq2Position + 0.5) * cellHeight;
            }

            // Draw filled circle for each match
            this.ctx.beginPath();
            this.ctx.arc(dotX, dotY, dotRadius, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.stroke();
        }
    }

    // Helper method to darken a color for dot borders
    darkenColor(color) {
        // Simple darkening by converting hex-like colors to darker versions
        if (color === '#22c55e') return '#16a34a'; // darker green
        if (color === '#dc2626') return '#b91c1c'; // darker red
        return color;
    }

    // Get complement of DNA sequence (not reversed - just complemented)
    getComplement(sequence) {
        const complement = {
            'A': 'T',
            'T': 'A',
            'G': 'C',
            'C': 'G'
        };
        
        return sequence.split('').map(base => complement[base] || base).join('');
    }

    drawEndpointCircles(startX, startY, endX, endY, color) {
        const circleRadius = 2;
        this.ctx.fillStyle = color;
        
        // Start point circle
        this.ctx.beginPath();
        this.ctx.arc(startX, startY, circleRadius, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // End point circle
        this.ctx.beginPath();
        this.ctx.arc(endX, endY, circleRadius, 0, 2 * Math.PI);
        this.ctx.fill();
    }

    groupMatchesIntoLines(matches) {
        const lines = [];
        const processed = new Set();

        for (const match of matches) {
            const key = `${match.seq1Position},${match.seq2Position}`;
            if (processed.has(key)) continue;

            // Find all matches that belong to the same diagonal line
            const line = [];
            const lineLength = match.lineLength || 1;
            const startSeq1 = match.seq1Position - (match.lineStart ? 0 : this.findPositionInLine(match, matches));
            const startSeq2 = match.seq2Position - (match.lineStart ? 0 : this.findPositionInLine(match, matches));

            // Collect all matches in this line
            for (let i = 0; i < lineLength; i++) {
                const lineSeq1 = startSeq1 + i;
                const lineSeq2 = startSeq2 + i;
                
                const lineMatch = matches.find(m => 
                    m.seq1Position === lineSeq1 && m.seq2Position === lineSeq2
                );
                
                if (lineMatch) {
                    line.push(lineMatch);
                    processed.add(`${lineMatch.seq1Position},${lineMatch.seq2Position}`);
                }
            }

            if (line.length > 0) {
                // Sort line by position to ensure proper order
                line.sort((a, b) => a.seq1Position - b.seq1Position);
                lines.push(line);
            }
        }

        return lines;
    }

    findPositionInLine(match, allMatches) {
        // This is a helper method to find where a match sits within its line
        // For now, we'll use a simple approach based on the lineStart/lineEnd flags
        if (match.lineStart) return 0;
        
        // Count how many matches come before this one in the same line
        let position = 0;
        const lineSeq1Start = match.seq1Position - position;
        const lineSeq2Start = match.seq2Position - position;
        
        while (position < match.seq1Position) {
            const prevMatch = allMatches.find(m => 
                m.seq1Position === lineSeq1Start + position && 
                m.seq2Position === lineSeq2Start + position
            );
            if (!prevMatch) break;
            position++;
        }
        
        return position;
    }

    drawWindowOutline(margin, seq1Pos, seq2Pos, cellWidth, cellHeight, windowSize, color) {
        this.ctx.strokeStyle = color + '40'; // Semi-transparent
        this.ctx.lineWidth = 2;
        
        const x = margin + seq1Pos * cellWidth;
        const y = margin + seq2Pos * cellHeight;
        const width = windowSize * cellWidth;
        const height = windowSize * cellHeight;
        
        this.ctx.strokeRect(x, y, width, height);
    }

    drawEmptyState() {
        this.ctx.fillStyle = '#a0aec0';
        this.ctx.font = '18px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Enter DNA sequences to generate dotplot', 
                         this.canvasWidth / 2, this.canvasHeight / 2 - 10);
        this.ctx.font = '14px sans-serif';
        this.ctx.fillText('Green dots: Forward matches | Red dots: Reverse complement matches', 
                         this.canvasWidth / 2, this.canvasHeight / 2 + 15);
        this.ctx.textAlign = 'left';
    }

    handleCanvasClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const margin = 50;
        const plotWidth = this.canvasWidth - 2 * margin;
        const plotHeight = this.canvasHeight - 2 * margin;
        
        if (x >= margin && x <= margin + plotWidth && 
            y >= margin && y <= margin + plotHeight && 
            this.seq1 && this.seq2) {
            
            const cellWidth = plotWidth / this.seq1.length;
            const cellHeight = plotHeight / this.seq2.length;
            
            const seq1Pos = Math.floor((x - margin) / cellWidth);
            const seq2Pos = Math.floor((y - margin) / cellHeight);
            
            if (seq1Pos >= 0 && seq1Pos < this.seq1.length && 
                seq2Pos >= 0 && seq2Pos < this.seq2.length) {
                
                this.showMatchInfo(seq1Pos, seq2Pos, x, y);
            }
        }
    }

    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const margin = 50;
        const plotWidth = this.canvasWidth - 2 * margin;
        const plotHeight = this.canvasHeight - 2 * margin;
        
        if (x >= margin && x <= margin + plotWidth && 
            y >= margin && y <= margin + plotHeight) {
            this.canvas.style.cursor = 'crosshair';
        } else {
            this.canvas.style.cursor = 'default';
        }
    }

    handleKeyNavigation(event) {
        // Only handle keyboard navigation if we have sequences and a selected position
        if (!this.seq1 || !this.seq2 || !this.clickedPosition) {
            return;
        }

        const { seq1Pos, seq2Pos } = this.clickedPosition;
        let newSeq1Pos = seq1Pos;
        let newSeq2Pos = seq2Pos;

        switch (event.key) {
            case 'ArrowLeft':
                newSeq1Pos = Math.max(0, seq1Pos - 1);
                event.preventDefault();
                break;
            case 'ArrowRight':
                newSeq1Pos = Math.min(this.seq1.length - 1, seq1Pos + 1);
                event.preventDefault();
                break;
            case 'ArrowUp':
                newSeq2Pos = Math.max(0, seq2Pos - 1);
                event.preventDefault();
                break;
            case 'ArrowDown':
                newSeq2Pos = Math.min(this.seq2.length - 1, seq2Pos + 1);
                event.preventDefault();
                break;
            case '<':
            case ',': // Handle both < and , (same key without shift)
                // Diagonal up-left: decrease both seq1 and seq2 positions
                newSeq1Pos = Math.max(0, seq1Pos - 1);
                newSeq2Pos = Math.max(0, seq2Pos - 1);
                event.preventDefault();
                break;
            case '>':
            case '.': // Handle both > and . (same key without shift)
                // Diagonal down-right: increase both seq1 and seq2 positions
                newSeq1Pos = Math.min(this.seq1.length - 1, seq1Pos + 1);
                newSeq2Pos = Math.min(this.seq2.length - 1, seq2Pos + 1);
                event.preventDefault();
                break;
            case '[':
                // Anti-diagonal up-right: increase seq1, decrease seq2
                newSeq1Pos = Math.min(this.seq1.length - 1, seq1Pos + 1);
                newSeq2Pos = Math.max(0, seq2Pos - 1);
                event.preventDefault();
                break;
            case ']':
                // Anti-diagonal down-left: decrease seq1, increase seq2
                newSeq1Pos = Math.max(0, seq1Pos - 1);
                newSeq2Pos = Math.min(this.seq2.length - 1, seq2Pos + 1);
                event.preventDefault();
                break;
            default:
                return; // Don't handle other keys
        }

        // Update position if it changed
        if (newSeq1Pos !== seq1Pos || newSeq2Pos !== seq2Pos) {
            this.moveToPosition(newSeq1Pos, newSeq2Pos);
        }
    }

    moveToPosition(seq1Pos, seq2Pos) {
        // Update the clicked position and trigger the same logic as a click
        this.showMatchInfo(seq1Pos, seq2Pos, 0, 0);
    }

    showMatchInfo(seq1Pos, seq2Pos, clickX, clickY) {
        // Store clicked position for cross highlighting
        this.clickedPosition = { seq1Pos, seq2Pos };
        
        // Redraw to show cross highlight
        this.drawDotplot();
        
        // Find matches at this position
        const forwardMatch = this.forwardMatches.find(m => 
            seq1Pos >= m.seq1Position && seq1Pos < m.seq1Position + this.windowSize &&
            seq2Pos >= m.seq2Position && seq2Pos < m.seq2Position + this.windowSize);
            
        const reverseMatch = this.reverseMatches.find(m => {
            const reverseSeq2Pos = this.seq2.length - m.seq2Position - this.windowSize;
            return seq1Pos >= m.seq1Position && seq1Pos < m.seq1Position + this.windowSize &&
                   seq2Pos >= reverseSeq2Pos && seq2Pos < reverseSeq2Pos + this.windowSize;
        });

        if (this.onMatchClickCallback) {
            this.onMatchClickCallback({
                seq1Position: seq1Pos,
                seq2Position: seq2Pos,
                seq1Char: this.seq1[seq1Pos],
                seq2Char: this.seq2[seq2Pos],
                seq2ReverseChar: this.seq2Reverse[this.seq2Reverse.length - 1 - seq2Pos],
                forwardMatch: forwardMatch,
                reverseMatch: reverseMatch,
                // Add sequence alignment data
                alignmentData: this.generateAlignmentView(seq1Pos, seq2Pos),
                reverseAlignmentData: this.generateReverseAlignmentView(seq1Pos, seq2Pos)
            });
        }
    }

    generateAlignmentView(centerSeq1Pos, centerSeq2Pos, contextLength = 10) {
        // Generate alignment view with fixed window size, always centering the clicked position
        const totalLength = (contextLength * 2) + 1; // Total window: context + center + context
        const centerPosition = contextLength; // Center is always at this position in the display
        
        // Calculate start and end positions for both sequences
        const seq1Start = centerSeq1Pos - contextLength;
        const seq1End = centerSeq1Pos + contextLength + 1;
        const seq2Start = centerSeq2Pos - contextLength;
        const seq2End = centerSeq2Pos + contextLength + 1;
        
        // Build sequence 1 segment with padding
        let seq1Segment = '';
        for (let i = seq1Start; i < seq1End; i++) {
            if (i < 0 || i >= this.seq1.length) {
                seq1Segment += ' '; // Add space for positions outside sequence
            } else {
                seq1Segment += this.seq1[i];
            }
        }
        
        // Build sequence 2 segment with padding
        let seq2Segment = '';
        for (let i = seq2Start; i < seq2End; i++) {
            if (i < 0 || i >= this.seq2.length) {
                seq2Segment += ' '; // Add space for positions outside sequence
            } else {
                seq2Segment += this.seq2[i];
            }
        }
        
        // Generate match/mismatch string
        let matchString = '';
        for (let i = 0; i < totalLength; i++) {
            const char1 = seq1Segment[i];
            const char2 = seq2Segment[i];
            
            // Only show match if both characters are actual bases (not spaces)
            if (char1 !== ' ' && char2 !== ' ' && char1 === char2) {
                matchString += '|';
            } else {
                matchString += ' ';
            }
        }
        
        return {
            seq1Segment: seq1Segment,
            seq2Segment: seq2Segment,
            matchString: matchString,
            seq1Center: centerPosition, // Always in the center of the display
            seq2Center: centerPosition, // Always in the center of the display
            centerSeq1Pos: centerSeq1Pos,
            centerSeq2Pos: centerSeq2Pos,
            startSeq1: seq1Start,
            startSeq2: seq2Start,
            totalLength: totalLength
        };
    }

    generateReverseAlignmentView(centerSeq1Pos, centerSeq2Pos, contextLength = 10) {
        // Generate alignment view with seq1 forward vs seq2 reverse complement
        const totalLength = (contextLength * 2) + 1;
        const centerPosition = contextLength;
        
        // For reverse complement alignment, we need to map seq2 position to reverse complement position
        // The clicked seq2 position corresponds to a position in the reverse complement
        const reverseSeq2Pos = this.seq2.length - 1 - centerSeq2Pos;
        
        // Calculate start and end positions
        const seq1Start = centerSeq1Pos - contextLength;
        const seq1End = centerSeq1Pos + contextLength + 1;
        const reverseSeq2Start = reverseSeq2Pos - contextLength;
        const reverseSeq2End = reverseSeq2Pos + contextLength + 1;
        
        // Build sequence 1 segment (same as forward)
        let seq1Segment = '';
        for (let i = seq1Start; i < seq1End; i++) {
            if (i < 0 || i >= this.seq1.length) {
                seq1Segment += ' ';
            } else {
                seq1Segment += this.seq1[i];
            }
        }
        
        // Build reverse complement sequence 2 segment
        let reverseSeq2Segment = '';
        for (let i = reverseSeq2Start; i < reverseSeq2End; i++) {
            if (i < 0 || i >= this.seq2Reverse.length) {
                reverseSeq2Segment += ' ';
            } else {
                reverseSeq2Segment += this.seq2Reverse[i];
            }
        }
        
        // Generate match/mismatch string for reverse complement comparison
        let reverseMatchString = '';
        for (let i = 0; i < totalLength; i++) {
            const char1 = seq1Segment[i];
            const char2 = reverseSeq2Segment[i];
            
            if (char1 !== ' ' && char2 !== ' ' && char1 === char2) {
                reverseMatchString += '|';
            } else {
                reverseMatchString += ' ';
            }
        }
        
        return {
            seq1Segment: seq1Segment,
            reverseSeq2Segment: reverseSeq2Segment,
            reverseMatchString: reverseMatchString,
            seq1Center: centerPosition,
            reverseSeq2Center: centerPosition,
            centerSeq1Pos: centerSeq1Pos,
            centerReverseSeq2Pos: reverseSeq2Pos,
            startSeq1: seq1Start,
            startReverseSeq2: reverseSeq2Start,
            totalLength: totalLength
        };
    }

    setOnMatchClickCallback(callback) {
        this.onMatchClickCallback = callback;
    }

    clear() {
        this.seq1 = '';
        this.seq2 = '';
        this.seq2Reverse = '';
        this.forwardMatches = [];
        this.reverseMatches = [];
        this.clickedPosition = null;
        this.drawEmptyState();
    }
}