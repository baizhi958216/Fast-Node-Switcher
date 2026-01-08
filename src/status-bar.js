const vscode = require('vscode');

/**
 * Status bar manager for displaying current Node version
 */
class StatusBarManager {
    constructor(detector) {
        this.detector = detector;
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'fast-node-switcher.switchVersion';
    }

    /**
     * Update status bar with current version and tool info
     */
    async update() {
        const manager = this.detector.getActiveManager();

        if (!manager || !manager.isAvailable) {
            this.statusBarItem.text = `$(versions) Node (no manager)`;
            this.statusBarItem.tooltip = 'No version manager detected\nClick to configure';
            this.statusBarItem.show();
            return;
        }

        try {
            const currentVersion = await manager.getCurrentVersion();
            const toolName = manager.getDisplayName();

            if (currentVersion) {
                this.statusBarItem.text = `$(versions) Node ${currentVersion}`;
                this.statusBarItem.tooltip = `Current Node Version: ${currentVersion}\nManaged by: ${toolName}\nClick to switch`;
            } else {
                this.statusBarItem.text = `$(versions) Node (not set)`;
                this.statusBarItem.tooltip = `No Node version set\nManaged by: ${toolName}\nClick to select`;
            }

            this.statusBarItem.show();
        } catch (error) {
            console.error('Failed to update status bar:', error);
            this.statusBarItem.text = `$(versions) Node (error)`;
            this.statusBarItem.tooltip = `Error: ${error.message}`;
            this.statusBarItem.show();
        }
    }

    /**
     * Show the status bar item
     */
    show() {
        this.statusBarItem.show();
    }

    /**
     * Hide the status bar item
     */
    hide() {
        this.statusBarItem.hide();
    }

    /**
     * Dispose the status bar item
     */
    dispose() {
        this.statusBarItem.dispose();
    }
}

module.exports = StatusBarManager;
