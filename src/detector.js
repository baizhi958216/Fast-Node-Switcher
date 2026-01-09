const os = require('os');
const vscode = require('vscode');
const MiseManager = require('./managers/mise-manager');
const NvmManager = require('./managers/nvm-manager');
const NvmWindowsManager = require('./managers/nvm-windows-manager');

/**
 * Tool detector for finding and selecting version managers
 * Priority: nvm > mise (as per user requirement)
 */
class ToolDetector {
    constructor() {
        this.managers = [];
        this.activeManager = null;
    }

    /**
     * Detect all available version managers
     * Returns the first available manager based on priority
     */
    async detectAll() {
        const platform = os.platform();
        const config = vscode.workspace.getConfiguration('fastNodeSwitcher');
        const preferredTool = config.get('preferredTool', 'auto');

        // Initialize managers based on platform
        if (platform === 'win32') {
            this.managers = [
                new NvmWindowsManager(),
                new MiseManager()
            ];
        } else {
            this.managers = [
                new NvmManager(),
                new MiseManager()
            ];
        }

        // If user has a preferred tool, try that first
        if (preferredTool !== 'auto') {
            const preferredManager = this.managers.find(m => m.name === preferredTool || m.name.includes(preferredTool));
            if (preferredManager) {
                const detected = await preferredManager.detect();
                if (detected) {
                    this.activeManager = preferredManager;
                    console.log(`Using preferred tool: ${preferredManager.name}`);
                    return preferredManager;
                }
            }
        }

        // Auto-detect: try managers in priority order (nvm > mise)
        for (const manager of this.managers) {
            const detected = await manager.detect();
            if (detected) {
                this.activeManager = manager;
                console.log(`Detected and using: ${manager.name}`);
                return manager;
            }
        }

        console.log('No version manager detected');
        return null;
    }

    /**
     * Get the currently active manager
     */
    getActiveManager() {
        return this.activeManager;
    }

    /**
     * Get all detected managers
     */
    getAllManagers() {
        return this.managers.filter(m => m.isAvailable);
    }

    /**
     * Switch to a different manager
     */
    async switchManager(managerName) {
        const manager = this.managers.find(m => m.name === managerName);
        if (manager && await manager.detect()) {
            this.activeManager = manager;
            console.log(`Switched to: ${manager.name}`);
            return true;
        }
        return false;
    }

    /**
     * Show error message when no manager is found
     */
    async showNoManagerError() {
        const action = await vscode.window.showErrorMessage(
            'No version manager (nvm/mise) detected. Please install one.',
            'Install nvm',
            'Install mise',
            'Open Settings'
        );

        if (action === 'Install nvm') {
            const platform = os.platform();
            if (platform === 'win32') {
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/coreybutler/nvm-windows'));
            } else {
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/nvm-sh/nvm'));
            }
        } else if (action === 'Install mise') {
            vscode.env.openExternal(vscode.Uri.parse('https://mise.jdx.dev/getting-started.html'));
        } else if (action === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'fastNodeSwitcher');
        }
    }
}

module.exports = ToolDetector;
