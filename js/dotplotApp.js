// Dotplot Trainer – bootstrap
(function () {
    function start() {
        try {
            window.dotplotController = new DotplotController();
        } catch (error) {
            console.error('Failed to initialise Dotplot Trainer:', error);
            const container = document.querySelector('.game-container');
            if (container) {
                container.innerHTML = `
                    <div class="error-container">
                        <h2>Initialization Error</h2>
                        <p>${error.message}</p>
                        <button onclick="window.location.reload()">Reload Page</button>
                    </div>`;
            }
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
