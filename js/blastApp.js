// BLAST Algorithm Demonstration App
// Initialize the application when DOM is loaded

document.addEventListener('DOMContentLoaded', function() {
    console.log('BLAST Demo: Initializing application...');
    
    try {
        // Check if all required elements exist
        const requiredElements = [
            'query-sequence',
            'database-sequence', 
            'kmer-length',
            'blast-canvas',
            'next-step',
            'prev-step'
        ];
        
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        
        if (missingElements.length > 0) {
            console.error('BLAST Demo: Missing required elements:', missingElements);
            showError('Application initialization failed: Missing required elements');
            return;
        }
        
        // Initialize the game controller
        const gameController = new BlastGameController();
        
        console.log('BLAST Demo: Application initialized successfully');
        
        // Make controller available globally for debugging
        window.blastGameController = gameController;
        
        // Add some helpful console commands for development
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('BLAST Demo: Development mode detected');
            console.log('Available debug commands:');
            console.log('  blastGameController.getState() - Get current state');
            console.log('  blastGameController.loadExample() - Load random example');
            console.log('  blastGameController.resetBlast() - Reset application');
        }
        
    } catch (error) {
        console.error('BLAST Demo: Initialization error:', error);
        showError('Application initialization failed. Please refresh the page.');
    }
});

// Error handling function
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'notification notification-error';
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #fee;
        color: #c53030;
        padding: 15px;
        border-radius: 5px;
        border: 1px solid #feb2b2;
        z-index: 1000;
        max-width: 400px;
    `;
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        if (document.body.contains(errorDiv)) {
            document.body.removeChild(errorDiv);
        }
    }, 5000);
}

// Handle any uncaught errors
window.addEventListener('error', function(event) {
    console.error('BLAST Demo: Uncaught error:', event.error);
    showError('An unexpected error occurred. Please refresh the page.');
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
    console.error('BLAST Demo: Unhandled promise rejection:', event.reason);
    showError('An unexpected error occurred. Please refresh the page.');
});