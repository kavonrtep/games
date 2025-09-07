// Main application initialization for Dotplot Explorer
class DotplotExplorerApp {
    constructor() {
        this.controller = null;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeApp());
        } else {
            this.initializeApp();
        }
    }

    initializeApp() {
        try {
            console.log('Dotplot Explorer App initializing...');
            
            // Check if all required elements exist
            this.validateRequiredElements();
            
            // Initialize the main controller
            this.controller = new DotplotExplorerController();
            
            console.log('Dotplot Explorer App initialized successfully');
            
            // Show welcome message
            this.showWelcomeMessage();
            
        } catch (error) {
            console.error('Failed to initialize Dotplot Explorer App:', error);
            this.showInitializationError(error);
        }
    }

    validateRequiredElements() {
        const requiredElements = [
            'sequence1',
            'sequence2', 
            'example-selector',
            'load-selected-example',
            'generate-dotplot',
            'clear-sequences',
            'window-size',
            'show-alignments',
            'hide-alignments',
            'dotplot-canvas',
            'position-display',
            'alignment-details'
        ];

        const missingElements = [];
        
        for (const elementId of requiredElements) {
            const element = document.getElementById(elementId);
            if (!element) {
                missingElements.push(elementId);
            }
        }

        if (missingElements.length > 0) {
            throw new Error(`Missing required DOM elements: ${missingElements.join(', ')}`);
        }
    }

    showWelcomeMessage() {
        // Show a subtle welcome message
        const notification = document.createElement('div');
        notification.className = 'notification notification-info show';
        notification.innerHTML = `
            <strong>Welcome to Dotplot Explorer!</strong><br>
            Load an example or enter sequences to explore genomic similarities.
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    showInitializationError(error) {
        const container = document.querySelector('.app-container');
        if (!container) {
            console.error('Cannot show initialization error: app container not found');
            return;
        }

        const errorHTML = `
            <div class="error-container">
                <h2>Initialization Error</h2>
                <p>Sorry, the Dotplot Explorer failed to initialize properly.</p>
                <p><strong>Error:</strong> ${error.message}</p>
                <p>Please refresh the page to try again. If the problem persists, check the browser console for more details.</p>
                <button onclick="window.location.reload()">Refresh Page</button>
            </div>
        `;

        container.innerHTML = errorHTML;
    }
}

// Global error handling
window.addEventListener('error', (event) => {
    console.error('Global error in Dotplot Explorer:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection in Dotplot Explorer:', event.reason);
});

// Initialize the application
const dotplotExplorerApp = new DotplotExplorerApp();