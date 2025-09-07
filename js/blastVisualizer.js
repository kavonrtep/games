class BlastVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.currentStep = 0;
        this.data = null;
        
        this.setupCanvas();
        this.colors = {
            query: '#3182ce',
            database: '#38a169',
            kmer: '#d69e2e',
            match: '#e53e3e',
            seed: '#805ad5',
            extension: '#dd6b20',
            background: '#f7fafc',
            grid: '#e2e8f0',
            text: '#2d3748',
            highlight: '#fed7d7'
        };
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

    // Visualize current step
    visualizeStep(stepNumber, data) {
        this.currentStep = stepNumber;
        this.data = data;
        
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        switch (stepNumber) {
            case 0:
                this.visualizeKmerGeneration(data);
                break;
            case 1:
                this.visualizeKmerMatching(data);
                break;
            case 2:
                this.visualizeSeedIdentification(data);
                break;
            case 3:
                this.visualizeAlignmentExtension(data);
                break;
            case 4:
                this.visualizeFinalResults(data);
                break;
            default:
                this.drawEmptyState();
        }
    }

    // Step 1: Visualize k-mer generation
    visualizeKmerGeneration(data) {
        const { querySequence, kmers, kmerLength } = data;
        
        if (!querySequence || !kmers) {
            this.drawEmptyState();
            return;
        }

        const margin = 40;
        const sequenceY = 80;
        const kmerListY = 150;
        
        // Draw title
        this.drawTitle('Step 1: K-mer Generation');
        
        // Draw query sequence
        this.drawSequence(querySequence, margin, sequenceY, 'Query Sequence:', this.colors.query);
        
        // Draw k-mer extraction visualization
        if (kmers.length > 0) {
            this.drawKmerExtraction(querySequence, kmers, margin, sequenceY + 40, kmerLength);
            
            // Draw k-mer list
            this.drawKmerList(kmers, margin, kmerListY);
        }
        
        // Draw statistics
        this.drawKmerStats(kmers, kmerLength);
    }

    // Step 2: Visualize k-mer matching
    visualizeKmerMatching(data) {
        const { querySequence, databaseSequence, matches, kmers } = data;
        
        if (!matches) {
            this.drawEmptyState();
            return;
        }

        const margin = 40;
        const queryY = 60;
        const dbY = 120;
        const matchVisualizationY = 180;
        
        // Draw title
        this.drawTitle('Step 2: K-mer Matching');
        
        // Draw sequences
        this.drawSequence(querySequence, margin, queryY, 'Query:', this.colors.query);
        this.drawSequence(databaseSequence, margin, dbY, 'Database:', this.colors.database);
        
        // Draw matches
        this.drawMatchConnections(matches, querySequence, databaseSequence, margin, queryY, dbY);
        
        // Draw match statistics
        this.drawMatchStats(matches, matchVisualizationY);
    }

    // Step 3: Visualize seed identification
    visualizeSeedIdentification(data) {
        const { querySequence, databaseSequence, seeds, matches } = data;
        
        if (!seeds) {
            this.drawEmptyState();
            return;
        }

        const margin = 40;
        const queryY = 60;
        const dbY = 120;
        const seedVisualizationY = 180;
        
        // Draw title
        this.drawTitle('Step 3: Seed Identification');
        
        // Draw sequences
        this.drawSequence(querySequence, margin, queryY, 'Query:', this.colors.query);
        this.drawSequence(databaseSequence, margin, dbY, 'Database:', this.colors.database);
        
        // Draw seeds
        this.drawSeeds(seeds, querySequence, databaseSequence, margin, queryY, dbY);
        
        // Draw seed list
        this.drawSeedList(seeds, seedVisualizationY);
    }

    // Step 4: Visualize alignment extension
    visualizeAlignmentExtension(data) {
        const { querySequence, databaseSequence, extensions } = data;
        
        if (!extensions) {
            this.drawEmptyState();
            return;
        }

        const margin = 40;
        const queryY = 60;
        const dbY = 120;
        const extensionY = 180;
        
        // Draw title
        this.drawTitle('Step 4: Alignment Extension');
        
        // Draw sequences
        this.drawSequence(querySequence, margin, queryY, 'Query:', this.colors.query);
        this.drawSequence(databaseSequence, margin, dbY, 'Database:', this.colors.database);
        
        // Draw extensions
        this.drawExtensions(extensions, querySequence, databaseSequence, margin, queryY, dbY);
        
        // Draw extension details
        this.drawExtensionDetails(extensions, extensionY);
    }

    // Step 5: Visualize final results
    visualizeFinalResults(data) {
        const { results } = data;
        
        if (!results || results.length === 0) {
            this.drawEmptyState('No significant alignments found');
            return;
        }

        // Draw title
        this.drawTitle('Step 5: BLAST Results');
        
        // Draw alignment results
        this.drawAlignmentResults(results);
    }

    // Helper methods for drawing

    drawTitle(title) {
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = 'bold 18px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(title, this.canvasWidth / 2, 30);
        this.ctx.textAlign = 'left';
    }

    drawSequence(sequence, x, y, label, color, maxLength = 50) {
        // Draw label
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = '12px sans-serif';
        this.ctx.fillText(label, x, y - 5);
        
        // Draw sequence
        this.ctx.fillStyle = color;
        this.ctx.font = '14px monospace';
        
        const displaySeq = sequence.length > maxLength ? 
            sequence.substring(0, maxLength) + '...' : sequence;
        
        // Draw each character with background
        for (let i = 0; i < displaySeq.length && i < maxLength; i++) {
            const charX = x + i * 12;
            
            // Draw character background
            this.ctx.fillStyle = `${color}20`;
            this.ctx.fillRect(charX - 1, y + 2, 11, 16);
            
            // Draw character
            this.ctx.fillStyle = color;
            this.ctx.fillText(displaySeq[i], charX, y + 15);
        }
        
        // Show length if truncated
        if (sequence.length > maxLength) {
            this.ctx.fillStyle = this.colors.text;
            this.ctx.font = '10px sans-serif';
            this.ctx.fillText(`(${sequence.length} total)`, x + maxLength * 12 + 10, y + 15);
        }
    }

    drawKmerExtraction(sequence, kmers, x, y, kmerLength) {
        const charWidth = 12;
        
        // Draw sliding window visualization
        if (kmers.length > 0) {
            for (let i = 0; i < Math.min(kmers.length, 10); i++) {
                const kmer = kmers[i];
                const startX = x + kmer.position * charWidth;
                
                // Draw k-mer highlight
                this.ctx.fillStyle = this.colors.kmer + '40';
                this.ctx.fillRect(startX - 1, y + 2, kmerLength * charWidth, 16);
                
                // Draw k-mer border
                this.ctx.strokeStyle = this.colors.kmer;
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(startX - 1, y + 2, kmerLength * charWidth, 16);
            }
        }
    }

    drawKmerList(kmers, x, y) {
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = '11px monospace';
        
        const cols = 8;
        const itemWidth = 60;
        const itemHeight = 20;
        
        for (let i = 0; i < Math.min(kmers.length, 24); i++) {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const itemX = x + col * itemWidth;
            const itemY = y + row * itemHeight;
            
            // Draw k-mer box
            this.ctx.fillStyle = this.colors.kmer + '20';
            this.ctx.fillRect(itemX, itemY, itemWidth - 2, itemHeight - 2);
            
            // Draw k-mer text
            this.ctx.fillStyle = this.colors.text;
            this.ctx.fillText(`${kmers[i].sequence}`, itemX + 2, itemY + 12);
            this.ctx.fillText(`@${kmers[i].position}`, itemX + 25, itemY + 12);
        }
        
        if (kmers.length > 24) {
            this.ctx.fillText(`... and ${kmers.length - 24} more`, x, y + 4 * itemHeight);
        }
    }

    drawMatchConnections(matches, querySeq, dbSeq, x, queryY, dbY) {
        const charWidth = 12;
        const maxMatches = 20; // Limit for visualization clarity
        
        // Group matches by color
        const colors = ['#e53e3e', '#38a169', '#3182ce', '#805ad5', '#d69e2e'];
        const matchGroups = {};
        
        matches.slice(0, maxMatches).forEach((match, index) => {
            const color = colors[index % colors.length];
            if (!matchGroups[match.queryKmer]) {
                matchGroups[match.queryKmer] = { matches: [], color: color };
            }
            matchGroups[match.queryKmer].matches.push(match);
        });
        
        // Draw connections
        Object.values(matchGroups).forEach(group => {
            this.ctx.strokeStyle = group.color;
            this.ctx.lineWidth = 2;
            
            group.matches.forEach(match => {
                const queryX = x + match.queryPosition * charWidth + 6;
                const dbX = x + match.dbPosition * charWidth + 6;
                
                // Draw connection line
                this.ctx.beginPath();
                this.ctx.moveTo(queryX, queryY + 18);
                this.ctx.lineTo(dbX, dbY - 2);
                this.ctx.stroke();
                
                // Draw match points
                this.ctx.fillStyle = group.color;
                this.ctx.beginPath();
                this.ctx.arc(queryX, queryY + 18, 3, 0, 2 * Math.PI);
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.arc(dbX, dbY - 2, 3, 0, 2 * Math.PI);
                this.ctx.fill();
            });
        });
    }

    drawSeeds(seeds, querySeq, dbSeq, x, queryY, dbY) {
        const charWidth = 12;
        
        seeds.slice(0, 5).forEach((seed, index) => {
            const color = this.colors.seed;
            const alpha = 0.6 - index * 0.1;
            
            // Draw seed regions
            const queryStartX = x + seed.queryStart * charWidth;
            const queryWidth = (seed.queryEnd - seed.queryStart + 1) * charWidth;
            const dbStartX = x + seed.dbStart * charWidth;
            const dbWidth = (seed.dbEnd - seed.dbStart + 1) * charWidth;
            
            // Query seed region
            this.ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            this.ctx.fillRect(queryStartX - 1, queryY + 2, queryWidth, 16);
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(queryStartX - 1, queryY + 2, queryWidth, 16);
            
            // Database seed region
            this.ctx.fillRect(dbStartX - 1, dbY + 2, dbWidth, 16);
            this.ctx.strokeRect(dbStartX - 1, dbY + 2, dbWidth, 16);
            
            // Draw seed connection
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([3, 3]);
            this.ctx.beginPath();
            this.ctx.moveTo(queryStartX + queryWidth/2, queryY + 18);
            this.ctx.lineTo(dbStartX + dbWidth/2, dbY - 2);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        });
    }

    drawExtensions(extensions, querySeq, dbSeq, x, queryY, dbY) {
        const charWidth = 12;
        
        extensions.slice(0, 3).forEach((ext, index) => {
            const color = this.colors.extension;
            const alpha = 0.7 - index * 0.15;
            
            // Draw extension regions
            const queryStartX = x + ext.queryStart * charWidth;
            const queryWidth = (ext.queryEnd - ext.queryStart + 1) * charWidth;
            const dbStartX = x + ext.dbStart * charWidth;
            const dbWidth = (ext.dbEnd - ext.dbStart + 1) * charWidth;
            
            // Draw extensions
            this.ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            this.ctx.fillRect(queryStartX - 1, queryY + 2, queryWidth, 16);
            this.ctx.fillRect(dbStartX - 1, dbY + 2, dbWidth, 16);
            
            // Draw extension borders
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(queryStartX - 1, queryY + 2, queryWidth, 16);
            this.ctx.strokeRect(dbStartX - 1, dbY + 2, dbWidth, 16);
        });
    }

    drawKmerStats(kmers, kmerLength) {
        const statsY = this.canvasHeight - 60;
        
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = '12px sans-serif';
        this.ctx.fillText(`K-mer length: ${kmerLength}`, 40, statsY);
        this.ctx.fillText(`Total k-mers: ${kmers.length}`, 160, statsY);
        
        if (kmers.length > 0) {
            const uniqueKmers = new Set(kmers.map(k => k.sequence)).size;
            this.ctx.fillText(`Unique k-mers: ${uniqueKmers}`, 280, statsY);
        }
    }

    drawMatchStats(matches, y) {
        const uniqueKmers = new Set(matches.map(m => m.queryKmer)).size;
        const uniquePositions = new Set(matches.map(m => m.dbPosition)).size;
        
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = '12px sans-serif';
        this.ctx.fillText(`Total matches: ${matches.length}`, 40, y);
        this.ctx.fillText(`Matching k-mers: ${uniqueKmers}`, 180, y);
        this.ctx.fillText(`Database positions: ${uniquePositions}`, 320, y);
    }

    drawSeedList(seeds, y) {
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = '11px sans-serif';
        
        seeds.slice(0, 3).forEach((seed, index) => {
            const seedY = y + index * 20;
            this.ctx.fillText(
                `Seed ${index + 1}: Query ${seed.queryStart}-${seed.queryEnd}, DB ${seed.dbStart}-${seed.dbEnd}, Score: ${seed.score}`,
                40, seedY
            );
        });
        
        if (seeds.length > 3) {
            this.ctx.fillText(`... and ${seeds.length - 3} more seeds`, 40, y + 3 * 20);
        }
    }

    drawExtensionDetails(extensions, y) {
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = '11px sans-serif';
        
        extensions.slice(0, 3).forEach((ext, index) => {
            const extY = y + index * 20;
            this.ctx.fillText(
                `Extension ${index + 1}: Length ${ext.length}, Score: ${ext.totalScore}, Identity: ${ext.identity}%`,
                40, extY
            );
        });
    }

    drawAlignmentResults(results) {
        const margin = 40;
        let y = 60;
        
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = '12px monospace';
        
        results.slice(0, 3).forEach((result, index) => {
            // Draw alignment header
            this.ctx.font = 'bold 12px sans-serif';
            this.ctx.fillText(
                `Alignment ${index + 1}: Score ${result.totalScore}, Length ${result.length}, Identity ${result.identity}%`,
                margin, y
            );
            y += 25;
            
            // Draw alignment
            this.ctx.font = '11px monospace';
            const queryText = `Query: ${result.queryStart + 1}-${result.queryEnd + 1} ${result.queryAlignment}`;
            const dbText = `DB:    ${result.dbStart + 1}-${result.dbEnd + 1} ${result.dbAlignment}`;
            
            this.ctx.fillText(queryText, margin, y);
            y += 15;
            this.ctx.fillText(dbText, margin, y);
            y += 30;
        });
        
        if (results.length > 3) {
            this.ctx.fillText(`... and ${results.length - 3} more alignments`, margin, y);
        }
    }

    drawEmptyState(message = 'No data to display') {
        this.ctx.fillStyle = '#a0aec0';
        this.ctx.font = '16px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(message, this.canvasWidth / 2, this.canvasHeight / 2);
        this.ctx.textAlign = 'left';
    }

    // Clear the canvas
    clear() {
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        this.currentStep = 0;
        this.data = null;
    }

    // Handle canvas resize
    handleResize() {
        this.setupCanvas();
        if (this.data) {
            this.visualizeStep(this.currentStep, this.data);
        }
    }
}