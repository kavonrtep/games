// Initialize the Smith-Waterman Game when the page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded - Initializing Smith-Waterman Game');
    
    try {
        // Create the game controller
        const gameController = new SwGameController();
        console.log('Smith-Waterman Game initialized successfully');
        
        // Make it globally accessible for debugging
        window.swGameController = gameController;
        
    } catch (error) {
        console.error('Failed to initialize Smith-Waterman Game:', error);
        
        // Show error message to user
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f56565;
            color: white;
            padding: 15px;
            border-radius: 6px;
            z-index: 1000;
            max-width: 300px;
        `;
        errorDiv.textContent = 'Failed to initialize the application. Please refresh the page.';
        document.body.appendChild(errorDiv);
        
        // Auto-remove error after 5 seconds
        setTimeout(() => {
            if (document.body.contains(errorDiv)) {
                document.body.removeChild(errorDiv);
            }
        }, 5000);
    }
});

// Ensure proper cleanup on page unload
window.addEventListener('beforeunload', function() {
    console.log('Page unloading - cleaning up Smith-Waterman Game');
});