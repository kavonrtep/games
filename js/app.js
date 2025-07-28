class App {
    constructor() {
        this.gameController = null;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            console.log('Starting application initialization...');
            await this.waitForDOMReady();
            console.log('DOM ready, creating GameController...');
            
            this.gameController = new GameController();
            console.log('GameController created successfully');
            
            this.setupGlobalEventListeners();
            this.addNotificationStyles();
            this.addTooltipStyles();
            this.addAnimationStyles();
            
            this.isInitialized = true;
            console.log('Interactive Sequence Alignment Trainer initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
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
                        this.gameController.exportResults();
                        break;
                    case 'h':
                        e.preventDefault();
                        this.showHelp();
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
            
            .score-positive {
                color: #48bb78 !important;
            }
            
            .score-negative {
                color: #f56565 !important;
            }
            
            .score-neutral {
                color: #4a5568 !important;
            }
            
            .sequence-char {
                padding: 2px;
                border-radius: 2px;
                transition: all 0.2s ease;
            }
            
            .cursor-position {
                background-color: rgba(49, 130, 206, 0.4) !important;
                border: 2px solid #3182ce !important;
                animation: cursorBlink 1s infinite;
                transform: scale(1.05);
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
            
            .active-sequence {
                background-color: rgba(49, 130, 206, 0.08) !important;
                border: 1px solid rgba(49, 130, 206, 0.2) !important;
            }
            
            .match-char {
                color: #38a169;
            }
        `;
        document.head.appendChild(style);
    }

    closeAllModals() {
        const tooltips = document.querySelectorAll('.tooltip');
        tooltips.forEach(tooltip => tooltip.remove());
    }

    resetApplication() {
        if (this.gameController) {
            this.gameController.reset();
            this.gameController.showNotification('Application reset successfully', 'info');
        }
    }

    showHelp() {
        const helpContent = `
            <div style="max-width: 600px; line-height: 1.6;">
                <h2>Interactive Sequence Alignment Trainer - Help</h2>
                <h3>Getting Started:</h3>
                <ul>
                    <li>Enter two sequences (DNA, RNA, or protein) in the input fields</li>
                    <li>Click "Load Example" for sample sequences</li>
                    <li>Click "Start Alignment" to begin editing</li>
                </ul>
                
                <h3>Alignment Editor Controls:</h3>
                <ul>
                    <li><strong>Arrow Keys:</strong> Navigate through the alignment</li>
                    <li><strong>Up/Down:</strong> Switch between sequences</li>
                    <li><strong>Space or -:</strong> Insert a gap</li>
                    <li><strong>Delete/Backspace:</strong> Remove a gap</li>
                    <li><strong>Tab:</strong> Switch active sequence</li>
                </ul>
                
                <h3>Scoring Parameters:</h3>
                <ul>
                    <li><strong>Match Score:</strong> Points for matching characters</li>
                    <li><strong>Mismatch Penalty:</strong> Points subtracted for mismatches</li>
                    <li><strong>Gap Opening:</strong> Penalty for starting a gap</li>
                    <li><strong>Gap Extension:</strong> Penalty for extending a gap</li>
                </ul>
                
                <h3>Keyboard Shortcuts:</h3>
                <ul>
                    <li><strong>Ctrl+R:</strong> Reset application</li>
                    <li><strong>Ctrl+E:</strong> Export results</li>
                    <li><strong>Ctrl+H:</strong> Show this help</li>
                    <li><strong>Escape:</strong> Close modals</li>
                </ul>
            </div>
        `;
        
        this.showModal('Help', helpContent);
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
            }
            
            .modal-content {
                background: white;
                border-radius: 10px;
                max-width: 90%;
                max-height: 90%;
                overflow-y: auto;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            }
            
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid #e2e8f0;
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
            }
            
            .modal-close:hover {
                color: #4a5568;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(modal);
        
        modal.querySelector('.modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
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
        if (this.gameController && this.gameController.dotplotVisualizer) {
            this.gameController.dotplotVisualizer.setupCanvas();
            if (this.gameController.currentAlignment) {
                this.gameController.updateDotplotFromAlignment();
            }
        }
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

const app = new App();
app.initialize();