class AdvancedApp {
    constructor() {
        this.gameController = null;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            console.log('Starting Advanced Global Alignment application initialization...');
            await this.waitForDOMReady();
            console.log('DOM ready, creating AdvancedGameController...');
            
            this.gameController = new AdvancedGameController();
            console.log('AdvancedGameController created successfully');
            
            this.setupGlobalEventListeners();
            this.addNotificationStyles();
            this.addTooltipStyles();
            this.addAnimationStyles();
            this.addAdvancedStyles();
            
            this.isInitialized = true;
            console.log('Advanced Global Alignment Trainer initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Advanced Global Alignment application:', error);
            console.error('Error stack:', error.stack);
            this.showErrorMessage('Failed to initialize the application. Please refresh the page.');
        }
    }

    waitForDOMReady() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }

    setupGlobalEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
            
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'r':
                        e.preventDefault();
                        this.resetApplication();
                        break;
                    case 'e':
                        e.preventDefault();
                        if (this.gameController) {
                            this.gameController.exportResults();
                        }
                        break;
                    case 'h':
                        e.preventDefault();
                        this.showHelp();
                        break;
                    case 's':
                        e.preventDefault();
                        this.showScoringInfo();
                        break;
                }
            }
        });

        window.addEventListener('beforeunload', (e) => {
            if (this.gameController && this.gameController.isGameActive) {
                e.preventDefault();
                e.returnValue = 'You have an active alignment. Are you sure you want to leave?';
                return e.returnValue;
            }
        });

        window.addEventListener('resize', () => {
            this.handleResize();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseGame();
            } else {
                this.resumeGame();
            }
        });
    }

    addNotificationStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 6px;
                color: white;
                font-weight: 500;
                z-index: 1000;
                transform: translateX(100%);
                transition: transform 0.3s ease;
                max-width: 400px;
                word-wrap: break-word;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .notification.show {
                transform: translateX(0);
            }
            
            .notification-success {
                background-color: #48bb78;
            }
            
            .notification-error {
                background-color: #f56565;
            }
            
            .notification-warning {
                background-color: #ed8936;
            }
            
            .notification-info {
                background-color: #4299e1;
            }
            
            .input-error {
                border-color: #f56565 !important;
                box-shadow: 0 0 0 3px rgba(245, 101, 101, 0.1) !important;
            }
            
            .input-success {
                border-color: #48bb78 !important;
                box-shadow: 0 0 0 3px rgba(72, 187, 120, 0.1) !important;
            }
        `;
        document.head.appendChild(style);
    }

    addTooltipStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .tooltip {
                position: fixed;
                background-color: #2d3748;
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-family: 'Courier New', monospace;
                pointer-events: none;
                z-index: 1001;
                opacity: 0.9;
                white-space: nowrap;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
        `;
        document.head.appendChild(style);
    }

    addAnimationStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .stat-updated {
                animation: statPulse 0.3s ease;
            }
            
            @keyframes statPulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            
            .stats-updated {
                animation: panelGlow 0.5s ease;
            }
            
            @keyframes panelGlow {
                0% { box-shadow: none; }
                50% { box-shadow: 0 0 10px rgba(66, 153, 225, 0.3); }
                100% { box-shadow: none; }
            }
            
            .score-positive {
                color: #48bb78 !important;
                font-weight: bold;
            }
            
            .score-negative {
                color: #f56565 !important;
                font-weight: bold;
            }
            
            .score-neutral {
                color: #4a5568 !important;
            }
            
            .sequence-char {
                padding: 2px 4px;
                margin: 0 1px;
                border-radius: 3px;
                transition: all 0.2s ease;
                font-family: 'Courier New', monospace;
                font-weight: bold;
                box-sizing: border-box;
                display: inline-block;
                text-align: center;
                width: 20px;
                min-width: 20px;
            }
            
            .match-char {
                padding: 2px 4px;
                margin: 0 1px;
                font-family: 'Courier New', monospace;
                font-weight: bold;
                display: inline-block;
                text-align: center;
                box-sizing: border-box;
                width: 20px;
                min-width: 20px;
            }
            
            .score-char {
                padding: 2px 4px;
                margin: 0 1px;
                font-family: 'Courier New', monospace;
                font-size: 8px;
                font-weight: bold;
                display: inline-block;
                text-align: center;
                box-sizing: border-box;
                color: #666;
                border-radius: 2px;
                line-height: 1;
                overflow: hidden;
                width: 20px;
                min-width: 20px;
                max-width: 20px;
            }
            
            .score-positive {
                background-color: #c6f6d5;
                color: #22543d;
            }
            
            .score-negative {
                background-color: #fed7d7;
                color: #742a2a;
            }
            
            .score-zero {
                background-color: #f7fafc;
                color: #4a5568;
            }
            
            .cursor-position {
                background-color: rgba(49, 130, 206, 0.4) !important;
                border: 2px solid #3182ce !important;
                animation: cursorBlink 1s infinite;
                margin: 0 1px !important;
                padding: 2px 4px !important;
                box-sizing: border-box;
            }
            
            @keyframes cursorBlink {
                0%, 50% { 
                    background-color: rgba(49, 130, 206, 0.4) !important;
                    box-shadow: 0 0 0 2px rgba(49, 130, 206, 0.2);
                }
                51%, 100% { 
                    background-color: rgba(49, 130, 206, 0.7) !important;
                    box-shadow: 0 0 0 2px rgba(49, 130, 206, 0.4);
                }
            }
            
            .active-sequence-char {
                background-color: rgba(49, 130, 206, 0.08) !important;
            }
            
            .base-a { color: #e53e3e; }
            .base-t { color: #3182ce; }
            .base-c { color: #38a169; }
            .base-g { color: #d69e2e; }
            
            /* Matrix Legend Styles - Compact Layout */
            .matrix-legend {
                margin-top: 8px;
                border: 1px solid #e2e8f0;
                border-radius: 4px;
                padding: 6px;
                background-color: #f8f9fa;
            }
            
            .legend-title {
                font-weight: bold;
                font-size: 12px;
                margin-bottom: 4px;
                color: #4a5568;
            }
            
            .legend-items {
                display: flex;
                flex-wrap: wrap;
                gap: 4px 8px;
            }
            
            .legend-item {
                display: flex;
                align-items: center;
                margin: 0;
                font-size: 10px;
                white-space: nowrap;
            }
            
            .legend-color {
                width: 12px;
                height: 12px;
                border-radius: 2px;
                margin-right: 4px;
                border: 1px solid #ddd;
                flex-shrink: 0;
            }
            
            /* Prominent Total Score */
            #total-score {
                font-size: 1.8em !important;
                font-weight: bold !important;
                color: #2d3748 !important;
                text-shadow: 0 1px 2px rgba(0,0,0,0.1);
            }
            .gap { color: #a0aec0; }
            
            .match-char.match { color: #38a169; font-weight: bold; }
            .match-char.similar { color: #d69e2e; }
            .match-char.gap-or-mismatch { color: #a0aec0; }
        `;
        document.head.appendChild(style);
    }

    addAdvancedStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .matrix-grid {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 5px;
                margin: 10px 0;
                font-family: 'Courier New', monospace;
            }
            
            .matrix-header, .matrix-row {
                display: contents;
            }
            
            .matrix-header > div, .row-header {
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                background-color: #edf2f7;
                padding: 5px;
                border-radius: 3px;
            }
            
            .matrix-grid input {
                width: 100%;
                padding: 5px;
                text-align: center;
                border: 1px solid #cbd5e0;
                border-radius: 3px;
                font-family: 'Courier New', monospace;
                font-weight: bold;
                transition: all 0.2s ease;
            }
            
            .matrix-grid input:focus {
                outline: none;
                border-color: #4299e1;
                box-shadow: 0 0 0 2px rgba(66, 153, 225, 0.2);
            }
            
            /* Color scale for matrix values */
            .matrix-grid input.score-positive-high {
                background-color: #22c55e;
                color: white;
            }
            
            .matrix-grid input.score-positive-medium {
                background-color: #65a30d;
                color: white;
            }
            
            .matrix-grid input.score-positive-low {
                background-color: #84cc16;
                color: white;
            }
            
            .matrix-grid input.score-zero {
                background-color: #ffffff;
                color: #374151;
            }
            
            .matrix-grid input.score-negative-low {
                background-color: #fb7185;
                color: white;
            }
            
            .matrix-grid input.score-negative-medium {
                background-color: #f87171;
                color: white;
            }
            
            .matrix-grid input.score-negative-high {
                background-color: #dc2626;
                color: white;
            }
            
            .matrix-presets {
                display: flex;
                gap: 10px;
                margin-top: 10px;
            }
            
            .preset-btn {
                flex: 1;
                padding: 8px 12px;
                background-color: #4299e1;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: background-color 0.2s ease;
            }
            
            .preset-btn:hover {
                background-color: #3182ce;
            }
            
            .matrix-legend {
                margin-top: 15px;
                padding: 10px;
                background-color: #f9fafb;
                border-radius: 6px;
                border: 1px solid #e5e7eb;
            }
            
            .legend-title {
                font-size: 12px;
                font-weight: bold;
                color: #374151;
                margin-bottom: 8px;
            }
            
            .legend-items {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 4px;
            }
            
            .legend-item {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 10px;
                color: #4b5563;
            }
            
            .legend-color {
                width: 16px;
                height: 16px;
                border-radius: 2px;
                border: 1px solid #d1d5db;
                flex-shrink: 0;
            }
            
            .legend-color.score-positive-high {
                background-color: #22c55e;
            }
            
            .legend-color.score-positive-medium {
                background-color: #65a30d;
            }
            
            .legend-color.score-positive-low {
                background-color: #84cc16;
            }
            
            .legend-color.score-zero {
                background-color: #ffffff;
            }
            
            .legend-color.score-negative-low {
                background-color: #fb7185;
            }
            
            .legend-color.score-negative-medium {
                background-color: #f87171;
            }
            
            .legend-color.score-negative-high {
                background-color: #dc2626;
            }
            
            .gap-controls {
                display: flex;
                flex-direction: column;
                gap: 15px;
            }
            
            .control-group {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            
            .control-group label {
                font-size: 14px;
                font-weight: 500;
                color: #2d3748;
            }
            
            .control-group input[type="range"] {
                width: 100%;
                height: 6px;
                border-radius: 3px;
                background: #edf2f7;
                outline: none;
            }
            
            .stats-grid {
                display: grid;
                grid-template-columns: 1fr;
                gap: 8px;
            }
            
            .stat-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 8px;
                background-color: #f7fafc;
                border-radius: 4px;
                font-size: 13px;
            }
            
            .stat-label {
                font-weight: 500;
                color: #4a5568;
            }
            
            .stat-value {
                font-weight: bold;
                color: #2d3748;
                font-family: 'Courier New', monospace;
            }
            
            .empty-state {
                color: #a0aec0;
                font-style: italic;
                text-align: center;
                padding: 20px;
            }
            
            .alignment-editor.focused {
                border: 2px solid #4299e1;
                border-radius: 4px;
            }
            
            .alignment-editor.active {
                background-color: rgba(66, 153, 225, 0.02);
            }
        `;
        document.head.appendChild(style);
    }

    closeAllModals() {
        const tooltips = document.querySelectorAll('.tooltip');
        tooltips.forEach(tooltip => tooltip.remove());
        
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(modal => modal.remove());
    }

    resetApplication() {
        if (this.gameController) {
            this.gameController.reset();
            this.gameController.showNotification('Application reset successfully', 'info');
        }
    }

    showHelp() {
        const helpContent = `
            <div style="max-width: 700px; line-height: 1.6;">
                <h2>Advanced Global Alignment Trainer - Help</h2>
                
                <h3>Getting Started:</h3>
                <ul>
                    <li>Enter two DNA sequences (A, T, C, G only) in the input fields</li>
                    <li>Choose from educational examples using the dropdown</li>
                    <li>Click "Start Alignment" to begin manual editing</li>
                </ul>
                
                <h3>Alignment Editor Controls:</h3>
                <ul>
                    <li><strong>Arrow Keys:</strong> Navigate through the alignment</li>
                    <li><strong>Up/Down or Tab:</strong> Switch between sequences</li>
                    <li><strong>Space or -:</strong> Insert a gap at current position</li>
                    <li><strong>Delete:</strong> Remove gap at current position</li>
                    <li><strong>Backspace:</strong> Remove gap before current position</li>
                    <li><strong>Home/End:</strong> Jump to start/end of alignment</li>
                </ul>
                
                <h3>Scoring Parameters:</h3>
                <ul>
                    <li><strong>Substitution Matrix:</strong> Customize scores for base pairs</li>
                    <li><strong>Gap Opening:</strong> Penalty for starting a new gap</li>
                    <li><strong>Gap Extension:</strong> Penalty for extending an existing gap</li>
                    <li><strong>End Gap Penalty:</strong> Additional penalty for terminal gaps</li>
                </ul>
                
                <h3>Matrix Presets:</h3>
                <ul>
                    <li><strong>Match/Mismatch:</strong> Simple +2/-1 scoring</li>
                    <li><strong>Transition/Transversion:</strong> Differentiates mutation types</li>
                </ul>
                
                <h3>Statistics Panel:</h3>
                <p>Real-time display of alignment quality metrics including total score, 
                identity percentage, gap statistics, and score breakdowns.</p>
                
                <h3>Keyboard Shortcuts:</h3>
                <ul>
                    <li><strong>Ctrl+R:</strong> Reset application</li>
                    <li><strong>Ctrl+E:</strong> Export results</li>
                    <li><strong>Ctrl+H:</strong> Show this help</li>
                    <li><strong>Ctrl+S:</strong> Show scoring information</li>
                    <li><strong>Escape:</strong> Close modals</li>
                </ul>
            </div>
        `;
        
        this.showModal('Help', helpContent);
    }

    showScoringInfo() {
        if (!this.gameController || !this.gameController.scoringSystem) {
            this.showNotification('Scoring system not available', 'error');
            return;
        }

        const scoringSummary = this.gameController.scoringSystem.getScoringSummary();
        const gapParams = this.gameController.scoringSystem.getGapParameters();
        
        const scoringContent = `
            <div style="max-width: 600px; line-height: 1.6;">
                <h2>Current Scoring Parameters</h2>
                
                <h3>Substitution Matrix (${scoringSummary.matrixType}):</h3>
                <div style="font-family: monospace; background: #f5f5f5; padding: 10px; margin: 10px 0;">
                    <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; text-align: center;">
                        <div style="font-weight: bold;"></div>
                        <div style="font-weight: bold;">A</div>
                        <div style="font-weight: bold;">T</div>
                        <div style="font-weight: bold;">C</div>
                        <div style="font-weight: bold;">G</div>
                        ${this.generateMatrixDisplay()}
                    </div>
                </div>
                
                <h3>Gap Parameters:</h3>
                <ul>
                    <li><strong>Gap Opening:</strong> ${gapParams.gapOpen}</li>
                    <li><strong>Gap Extension:</strong> ${gapParams.gapExtend}</li>
                    <li><strong>End Gap Penalty:</strong> ${gapParams.endGap}</li>
                </ul>
                
                <h3>Matrix Properties:</h3>
                <ul>
                    <li><strong>Type:</strong> ${scoringSummary.matrixType}</li>
                    <li><strong>Symmetric:</strong> ${scoringSummary.isSymmetric ? 'Yes' : 'No'}</li>
                </ul>
                
                <p><small>Use Ctrl+S to view this information anytime.</small></p>
            </div>
        `;
        
        this.showModal('Scoring Information', scoringContent);
    }

    generateMatrixDisplay() {
        if (!this.gameController) return '';
        
        const matrix = this.gameController.scoringSystem.getSubstitutionMatrix();
        const bases = ['A', 'T', 'C', 'G'];
        let html = '';
        
        bases.forEach(base1 => {
            html += `<div style="font-weight: bold;">${base1}</div>`;
            bases.forEach(base2 => {
                const value = matrix[base1][base2];
                const color = value > 0 ? '#48bb78' : value < 0 ? '#f56565' : '#4a5568';
                html += `<div style="color: ${color}; font-weight: bold;">${value}</div>`;
            });
        });
        
        return html;
    }

    showModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 2000;
                animation: fadeIn 0.3s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .modal-content {
                background: white;
                border-radius: 10px;
                max-width: 90%;
                max-height: 90%;
                overflow-y: auto;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                animation: slideIn 0.3s ease;
            }
            
            @keyframes slideIn {
                from { transform: translateY(-50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid #e2e8f0;
                background-color: #f7fafc;
                border-radius: 10px 10px 0 0;
            }
            
            .modal-body {
                padding: 20px;
            }
            
            .modal-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #a0aec0;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s ease;
            }
            
            .modal-close:hover {
                color: #4a5568;
                background-color: #edf2f7;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(modal);
        
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => {
                if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                }
            }, 300);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => {
                    if (document.body.contains(modal)) {
                        document.body.removeChild(modal);
                    }
                }, 300);
            }
        });
        
        // Add fadeOut animation
        const fadeOutStyle = document.createElement('style');
        fadeOutStyle.textContent = `
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(fadeOutStyle);
    }

    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: #f56565;
            color: white;
            padding: 20px;
            border-radius: 10px;
            z-index: 9999;
            text-align: center;
            font-weight: 500;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            max-width: 90%;
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (document.body.contains(errorDiv)) {
                document.body.removeChild(errorDiv);
            }
        }, 5000);
    }

    handleResize() {
        // Handle any resize-specific logic for advanced features
        // Currently no special resize handling needed
    }

    pauseGame() {
        if (this.gameController && this.gameController.alignmentEditor) {
            this.gameController.alignmentEditor.setActive(false);
        }
    }

    resumeGame() {
        if (this.gameController && this.gameController.alignmentEditor && this.gameController.isGameActive) {
            this.gameController.alignmentEditor.setActive(true);
        }
    }
}

// Initialize the application
const advancedApp = new AdvancedApp();
advancedApp.initialize();