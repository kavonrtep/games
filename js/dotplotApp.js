// DNA Dotplot Demonstration App
class DotplotApp {
    constructor() {
        this.gameController = null;
        this.init();
    }

    init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeApp());
        } else {
            this.initializeApp();
        }
    }

    initializeApp() {
        try {
            // Initialize the game controller
            this.gameController = new DotplotGameController();
            
            console.log('DNA Dotplot Demo initialized successfully');
        } catch (error) {
            console.error('Failed to initialize DNA Dotplot Demo:', error);
            this.showInitializationError(error);
        }
    }

    showInitializationError(error) {
        const container = document.querySelector('.game-container');
        if (container) {
            container.innerHTML = `
                <div class="error-container">
                    <h2>Initialization Error</h2>
                    <p>Failed to load the DNA Dotplot Demo application.</p>
                    <p>Error: ${error.message}</p>
                    <button onclick="window.location.reload()">Reload Page</button>
                </div>
            `;
        }
    }
}

// Initialize the application
new DotplotApp();