class DotplotExplorerVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.seq1 = '';
        this.seq2 = '';
        this.seq2Reverse = '';
        this.forwardMatches = [];
        this.reverseMatches = [];
        this.windowSize = 8;
        this.clickedPosition = null; // Store clicked position for cross highlighting
        this.alignmentBlocks = [];
        this.showAlignmentBlocks = false;
        
        this.setupCanvas();
        this.setupEventListeners();
    }

    setupCanvas() {
        this.updateCanvasDimensions();
    }

    updateCanvasDimensions() {
        const container = this.canvas.parentElement;
        const containerRect = container.getBoundingClientRect();
        const maxWidth = Math.min(containerRect.width * 0.95, 900); // Bigger max width
        const maxHeight = Math.min(containerRect.height * 0.9, 800); // Bigger max height
        
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
            // Default larger canvas when no sequences - always reserve space for synteny
            const syntenyHeight = 150;
            const availableHeight = maxHeight - syntenyHeight;
            const size = Math.min(maxWidth, availableHeight, 650); // Bigger default size
            return { canvasWidth: size, canvasHeight: size + syntenyHeight };
        }
        
        const marginPerSide = 50; // Margin on each side
        const totalMargin = 2 * marginPerSide; // Total margin (100)
        const syntenyHeight = 150; // Always reserve space for synteny plot
        const seq1Length = this.seq1.length;
        const seq2Length = this.seq2.length;
        
        // Calculate the aspect ratio needed for the dotplot (width/height)
        const aspectRatio = seq1Length / seq2Length;
        
        // Calculate dimensions that maintain square cells for the DOTPLOT ONLY
        // The dotplot area excludes the synteny space
        const availableWidth = maxWidth - totalMargin;
        const availableHeightForDotplot = maxHeight - totalMargin - syntenyHeight;
        
        // For square cells: dotplotWidth/seq1Length = dotplotHeight/seq2Length
        // So: dotplotWidth/dotplotHeight = seq1Length/seq2Length = aspectRatio
        
        let dotplotWidth, dotplotHeight;
        
        // Try both constraints and pick the smaller result (limiting factor)
        // We want: dotplotWidth / dotplotHeight = aspectRatio
        // So: dotplotHeight = dotplotWidth / aspectRatio
        // And: dotplotWidth = dotplotHeight * aspectRatio
        
        const widthConstrainedHeight = availableWidth / aspectRatio;
        const heightConstrainedWidth = availableHeightForDotplot * aspectRatio;
        
        if (widthConstrainedHeight <= availableHeightForDotplot) {
            // Width is the limiting factor
            dotplotWidth = availableWidth;
            dotplotHeight = widthConstrainedHeight;
        } else {
            // Height is the limiting factor  
            dotplotWidth = heightConstrainedWidth;
            dotplotHeight = availableHeightForDotplot;
        }
        
        // Ensure minimum reasonable size for dotplot
        const minSize = 200;
        if (dotplotWidth < minSize || dotplotHeight < minSize) {
            const scale = Math.max(minSize / dotplotWidth, minSize / dotplotHeight);
            dotplotWidth *= scale;
            dotplotHeight *= scale;
        }
        
        console.log('Debug dimensions:', {
            seq1Length, seq2Length, aspectRatio,
            maxWidth, maxHeight,
            availableWidth, availableHeightForDotplot,
            dotplotWidth, dotplotHeight,
            canvasWidth: dotplotWidth + totalMargin,
            canvasHeight: dotplotHeight + totalMargin + syntenyHeight,
            actualRatio: dotplotWidth / dotplotHeight,
            shouldBe: seq1Length / seq2Length,
            cellWidth: dotplotWidth / seq1Length,
            cellHeight: dotplotHeight / seq2Length,
            cellRatio: (dotplotWidth / seq1Length) / (dotplotHeight / seq2Length),
            dotplotAreaAspectRatio: dotplotWidth / dotplotHeight,
            containerAspectRatio: maxWidth / maxHeight
        });
        
        return {
            canvasWidth: dotplotWidth + totalMargin,
            canvasHeight: dotplotHeight + totalMargin + syntenyHeight
        };
    }

    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        
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
        
        // Hide alignment panel when new sequences are loaded
        this.showAlignmentBlocks = false;
        this.alignmentBlocks = [];
        
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

        const margin = 50; // Half of calculateCanvasDimensions margin (100)
        const plotWidth = this.canvasWidth - 2 * margin;
        
        // Always reserve space for synteny plot to keep dotplot size constant
        const syntenyHeight = 150;
        const plotHeight = this.canvasHeight - 2 * margin - syntenyHeight;
        
        this.drawAxes(margin, plotWidth, plotHeight);
        this.drawGrid(margin, plotWidth, plotHeight);
        this.drawCrossHighlight(margin, plotWidth, plotHeight);
        this.drawMatches(margin, plotWidth, plotHeight);
        
        // Draw synteny plot if enabled (but space is always reserved)
        if (this.showAlignmentBlocks && this.forwardMatches && this.reverseMatches && 
            (this.forwardMatches.length > 0 || this.reverseMatches.length > 0)) {
            this.drawSyntenyPlot(margin, plotWidth, plotHeight, syntenyHeight);
        }
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

        // Only draw sequence characters if sequences are short enough
        if (this.seq1.length <= 50 && this.seq2.length <= 50) {
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
            this.ctx.fillStyle = '#dc2626'; // Red color to indicate complement
            const seq2Complement = this.getComplement(this.seq2);
            for (let j = 0; j < seq2Complement.length; j++) {
                const y = margin + (j + 0.5) / seq2Complement.length * plotHeight;
                this.ctx.fillText(seq2Complement[j], margin + plotWidth + 10, y + 4);
            }
        }

        // Draw axis labels
        this.ctx.fillStyle = '#2d3748';
        this.ctx.font = '14px sans-serif';
        
        // Horizontal axis label
        this.ctx.fillText(`Sequence 1 (${this.seq1.length} bp)`, margin + plotWidth / 2 - 60, margin - 25);
        
        // Left vertical axis label
        this.ctx.save();
        this.ctx.translate(15, margin + plotHeight / 2);
        this.ctx.rotate(-Math.PI / 2);
        this.ctx.fillText(`Seq 2 (${this.seq2.length} bp)`, -40, 0);
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
        // Only draw grid for shorter sequences to avoid clutter
        if (this.seq1.length > 50 || this.seq2.length > 50) return;
        
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

    drawSyntenyPlot(margin, plotWidth, dotplotHeight, syntenyHeight) {
        if (!this.forwardMatches && !this.reverseMatches) return;
        if (this.forwardMatches.length === 0 && this.reverseMatches.length === 0) return;
        
        const syntenyY = margin + dotplotHeight + 30; // Start position for synteny plot
        const seq1LineY = syntenyY + 30; // Y position for sequence 1 line
        const seq2LineY = syntenyY + syntenyHeight - 30; // Y position for sequence 2 line
        const lineThickness = 8;
        
        // Draw sequence lines
        this.drawSequenceLines(margin, plotWidth, seq1LineY, seq2LineY, lineThickness);
        
        // Draw alignment polygons connecting the sequences
        this.drawAlignmentPolygons(margin, plotWidth, seq1LineY, seq2LineY, lineThickness);
        
        // Draw sequence labels
        this.drawSyntenyLabels(margin, plotWidth, seq1LineY, seq2LineY);
    }

    drawSequenceLines(margin, plotWidth, seq1LineY, seq2LineY, lineThickness) {
        // Draw sequence 1 line (top)
        this.ctx.strokeStyle = '#2d3748';
        this.ctx.lineWidth = lineThickness;
        this.ctx.lineCap = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(margin, seq1LineY);
        this.ctx.lineTo(margin + plotWidth, seq1LineY);
        this.ctx.stroke();
        
        // Draw sequence 2 line (bottom)
        this.ctx.beginPath();
        this.ctx.moveTo(margin, seq2LineY);
        this.ctx.lineTo(margin + plotWidth, seq2LineY);
        this.ctx.stroke();
    }

    drawAlignmentPolygons(margin, plotWidth, seq1LineY, seq2LineY, lineThickness) {
        const seq1Scale = plotWidth / this.seq1.length;
        const seq2Scale = plotWidth / this.seq2.length;
        const halfLineThickness = lineThickness / 2;
        
        // Group matches by diagonal lines to create one polygon per line
        const forwardLines = this.groupMatchesIntoLines(this.forwardMatches);
        const reverseLines = this.groupMatchesIntoLines(this.reverseMatches);
        
        // Draw forward match polygons (parallel - rectangle shape)
        for (const line of forwardLines) {
            if (line.length === 0) continue;
            
            const startMatch = line[0];
            const endMatch = line[line.length - 1];
            const color = '#22c55e'; // Green for forward
            
            const seq1Start = margin + startMatch.seq1Position * seq1Scale;
            const seq1End = margin + (endMatch.seq1Position + 1) * seq1Scale;
            const seq2Start = margin + startMatch.seq2Position * seq2Scale;
            const seq2End = margin + (endMatch.seq2Position + 1) * seq2Scale;
            
            this.drawForwardPolygon(seq1Start, seq1End, seq1LineY, seq2Start, seq2End, seq2LineY, halfLineThickness, color);
        }
        
        // Draw reverse match polygons (crossing - X shape)
        for (const line of reverseLines) {
            if (line.length === 0) continue;
            
            const startMatch = line[0];
            const endMatch = line[line.length - 1];
            const color = '#dc2626'; // Red for reverse
            
            const seq1Start = margin + startMatch.seq1Position * seq1Scale;
            const seq1End = margin + (endMatch.seq1Position + 1) * seq1Scale;
            
            // For reverse matches, map back to original seq2 coordinates (flip)
            const seq2Start = margin + (this.seq2.length - startMatch.seq2Position - 1) * seq2Scale;
            const seq2End = margin + (this.seq2.length - endMatch.seq2Position - 1) * seq2Scale;
            
            this.drawReversePolygon(seq1Start, seq1End, seq1LineY, seq2Start, seq2End, seq2LineY, halfLineThickness, color);
        }
    }

    drawForwardPolygon(seq1Start, seq1End, seq1LineY, seq2Start, seq2End, seq2LineY, halfLineThickness, color) {
        this.ctx.fillStyle = color + '40'; // Semi-transparent
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1;
        
        this.ctx.beginPath();
        // Top edge of sequence 1 (left to right)
        this.ctx.moveTo(seq1Start, seq1LineY - halfLineThickness);
        this.ctx.lineTo(seq1End, seq1LineY - halfLineThickness);
        // Connect to sequence 2 (parallel)
        this.ctx.lineTo(seq2End, seq2LineY + halfLineThickness);
        // Bottom edge of sequence 2 (right to left)
        this.ctx.lineTo(seq2Start, seq2LineY + halfLineThickness);
        // Connect back to sequence 1
        this.ctx.lineTo(seq1Start, seq1LineY - halfLineThickness);
        this.ctx.closePath();
        
        this.ctx.fill();
        this.ctx.stroke();
    }

    drawReversePolygon(seq1Start, seq1End, seq1LineY, seq2Start, seq2End, seq2LineY, halfLineThickness, color) {
        this.ctx.fillStyle = color + '40'; // Semi-transparent
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1;
        
        this.ctx.beginPath();
        // Create X-shape: seq1Start connects to seq2Start, seq1End connects to seq2End
        // This creates the crossing pattern showing the inversion
        
        // Start from seq1Start, go to seq2Start (this creates the first diagonal of the X)
        this.ctx.moveTo(seq1Start, seq1LineY - halfLineThickness);
        this.ctx.lineTo(seq2Start, seq2LineY + halfLineThickness);
        // Go along seq2 line from start to end
        this.ctx.lineTo(seq2End, seq2LineY + halfLineThickness);
        // Go back to seq1End (this creates the second diagonal of the X)
        this.ctx.lineTo(seq1End, seq1LineY - halfLineThickness);
        // Complete the polygon by going back along seq1 line
        this.ctx.lineTo(seq1Start, seq1LineY - halfLineThickness);
        this.ctx.closePath();
        
        this.ctx.fill();
        this.ctx.stroke();
    }


    drawSyntenyLabels(margin, plotWidth, seq1LineY, seq2LineY) {
        this.ctx.fillStyle = '#2d3748';
        this.ctx.font = '12px sans-serif';
        this.ctx.textAlign = 'left';
        
        // Sequence 1 label
        this.ctx.fillText(`Sequence 1 (${this.seq1.length} bp)`, margin - 10, seq1LineY - 15);
        
        // Sequence 2 label
        this.ctx.fillText(`Sequence 2 (${this.seq2.length} bp)`, margin - 10, seq2LineY + 20);
        
        // Position markers (optional - only for shorter sequences)
        if (this.seq1.length <= 100 && this.seq2.length <= 100) {
            this.drawPositionMarkers(margin, plotWidth, seq1LineY, seq2LineY);
        }
    }

    drawPositionMarkers(margin, plotWidth, seq1LineY, seq2LineY) {
        this.ctx.fillStyle = '#718096';
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'center';
        
        // Add position markers every 10 or 20 bases depending on sequence length
        const seq1Interval = this.seq1.length > 50 ? 20 : 10;
        const seq2Interval = this.seq2.length > 50 ? 20 : 10;
        
        // Sequence 1 markers
        const seq1Scale = plotWidth / this.seq1.length;
        for (let i = 0; i <= this.seq1.length; i += seq1Interval) {
            const x = margin + i * seq1Scale;
            this.ctx.fillText(i.toString(), x, seq1LineY - 25);
            
            // Small tick mark
            this.ctx.strokeStyle = '#718096';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(x, seq1LineY - 8);
            this.ctx.lineTo(x, seq1LineY - 2);
            this.ctx.stroke();
        }
        
        // Sequence 2 markers
        const seq2Scale = plotWidth / this.seq2.length;
        for (let i = 0; i <= this.seq2.length; i += seq2Interval) {
            const x = margin + i * seq2Scale;
            this.ctx.fillText(i.toString(), x, seq2LineY + 35);
            
            // Small tick mark
            this.ctx.beginPath();
            this.ctx.moveTo(x, seq2LineY + 2);
            this.ctx.lineTo(x, seq2LineY + 8);
            this.ctx.stroke();
        }
    }

    // Methods for alignment block functionality
    setAlignmentBlocks(blocks) {
        this.alignmentBlocks = blocks;
    }

    showAlignments(show) {
        this.showAlignmentBlocks = show;
        // No need to recalculate dimensions - space is always reserved
        this.drawDotplot();
    }

    drawEmptyState() {
        this.ctx.fillStyle = '#a0aec0';
        this.ctx.font = '18px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Enter DNA sequences to generate dotplot', 
                         this.canvasWidth / 2, this.canvasHeight / 2 - 20);
        this.ctx.font = '14px sans-serif';
        this.ctx.fillText('Green: Forward matches | Red: Reverse matches', 
                         this.canvasWidth / 2, this.canvasHeight / 2 + 5);
        this.ctx.fillText('Use "Show Alignments" to see synteny view below dotplot', 
                         this.canvasWidth / 2, this.canvasHeight / 2 + 25);
        this.ctx.textAlign = 'left';
    }

    handleCanvasClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        // Account for device pixel ratio and canvas scaling
        const x = (event.clientX - rect.left) * scaleX / (window.devicePixelRatio || 1);
        const y = (event.clientY - rect.top) * scaleY / (window.devicePixelRatio || 1);
        
        const margin = 50; // Must match drawDotplot margin
        const plotWidth = this.canvasWidth - 2 * margin;
        
        // Always reserve space for synteny plot to get correct dotplot area
        const syntenyHeight = 150;
        const plotHeight = this.canvasHeight - 2 * margin - syntenyHeight;
        
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
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const x = (event.clientX - rect.left) * scaleX / (window.devicePixelRatio || 1);
        const y = (event.clientY - rect.top) * scaleY / (window.devicePixelRatio || 1);
        
        const margin = 50; // Must match drawDotplot margin
        const plotWidth = this.canvasWidth - 2 * margin;
        const syntenyHeight = 150;
        const plotHeight = this.canvasHeight - 2 * margin - syntenyHeight;
        
        if (x >= margin && x <= margin + plotWidth && 
            y >= margin && y <= margin + plotHeight) {
            this.canvas.style.cursor = 'crosshair';
        } else {
            this.canvas.style.cursor = 'default';
        }
    }

    showMatchInfo(seq1Pos, seq2Pos, clickX, clickY) {
        // Store clicked position for cross highlighting
        this.clickedPosition = { seq1Pos, seq2Pos };
        
        // Redraw to show cross highlight
        this.drawDotplot();
        
        if (this.onPositionClickCallback) {
            // Calculate reverse complement position
            const reverseSeq2Pos = this.seq2.length - seq2Pos - 1;
            
            this.onPositionClickCallback({
                seq1Position: seq1Pos,
                seq2Position: seq2Pos,
                seq1Context: this.generateSequenceContext(this.seq1, seq1Pos),
                seq2Context: this.generateSequenceContext(this.seq2, seq2Pos),
                // Add reverse complement contexts
                reverseSeq2Position: reverseSeq2Pos,
                seq1ContextForReverse: this.generateSequenceContext(this.seq1, seq1Pos),
                seq2ReverseContext: this.generateSequenceContext(this.seq2Reverse, reverseSeq2Pos)
            });
        }
    }

    generateSequenceContext(sequence, centerPos, contextLength = 10) {
        const totalLength = (contextLength * 2) + 1;
        const startPos = centerPos - contextLength;
        const endPos = centerPos + contextLength + 1;
        
        let segment = '';
        for (let i = startPos; i < endPos; i++) {
            if (i < 0 || i >= sequence.length) {
                segment += ' ';
            } else {
                segment += sequence[i];
            }
        }
        
        return {
            segment: segment,
            centerPosition: contextLength,
            startPos: startPos
        };
    }

    setOnPositionClickCallback(callback) {
        this.onPositionClickCallback = callback;
    }

    clear() {
        this.seq1 = '';
        this.seq2 = '';
        this.seq2Reverse = '';
        this.forwardMatches = [];
        this.reverseMatches = [];
        this.clickedPosition = null;
        this.alignmentBlocks = [];
        this.showAlignmentBlocks = false;
        this.drawEmptyState();
    }
}