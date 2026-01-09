const os = require('os');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const vscode = require('vscode');
const MiseManager = require('./managers/mise-manager');
const NvmManager = require('./managers/nvm-manager');
const NvmWindowsManager = require('./managers/nvm-windows-manager');
const VoltaManager = require('./managers/volta-manager');
const FnmManager = require('./managers/fnm-manager');
const PnpmManager = require('./managers/pnpm-manager');

const execPromise = promisify(exec);

/**
 * Tool detector for finding and selecting version managers
 * Priority: nvm > fnm > volta > mise > pnpm
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
                new FnmManager(),
                new VoltaManager(),
                new MiseManager(),
                new PnpmManager()
            ];
        } else {
            this.managers = [
                new NvmManager(),
                new FnmManager(),
                new VoltaManager(),
                new MiseManager(),
                new PnpmManager()
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

        // Auto-detect: try managers in priority order (nvm > fnm > volta > mise > pnpm)
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
     * Detect if official Node.js is installed (not managed by a version manager)
     */
    async detectOfficialNodejs() {
        try {
            const platform = os.platform();

            // Check common official Node.js installation paths
            const officialPaths = [];

            if (platform === 'win32') {
                officialPaths.push(
                    'C:\\Program Files\\nodejs\\node.exe',
                    'C:\\Program Files (x86)\\nodejs\\node.exe'
                );
            } else if (platform === 'darwin') {
                officialPaths.push(
                    '/usr/local/bin/node',
                    '/opt/homebrew/bin/node'
                );
            } else {
                officialPaths.push(
                    '/usr/bin/node',
                    '/usr/local/bin/node'
                );
            }

            // Check if any of these paths exist
            for (const nodePath of officialPaths) {
                if (fs.existsSync(nodePath)) {
                    return nodePath;
                }
            }

            // Also check if node is in PATH and get its location
            try {
                const { stdout } = await execPromise(platform === 'win32' ? 'where node' : 'which node');
                const nodePath = stdout.trim().split('\n')[0];

                // Check if it's an official installation (not in version manager directories)
                const isVersionManager =
                    nodePath.toLowerCase().includes('nvm') ||
                    nodePath.toLowerCase().includes('fnm') ||
                    nodePath.toLowerCase().includes('volta') ||
                    nodePath.toLowerCase().includes('mise') ||
                    nodePath.toLowerCase().includes('pnpm') ||
                    nodePath.toLowerCase().includes('.nvm') ||
                    nodePath.toLowerCase().includes('.fnm') ||
                    nodePath.toLowerCase().includes('.volta') ||
                    nodePath.toLowerCase().includes('.mise') ||
                    nodePath.toLowerCase().includes('\\pnpm\\') ||
                    nodePath.toLowerCase().includes('/pnpm/') ||
                    nodePath.toLowerCase().includes('appdata\\local\\pnpm') ||
                    nodePath.toLowerCase().includes('appdata/local/pnpm');

                if (!isVersionManager && nodePath) {
                    return nodePath;
                }
            } catch (error) {
                // Node not found in PATH
            }

            return null;
        } catch (error) {
            console.error('Error detecting official Node.js:', error);
            return null;
        }
    }

    /**
     * Show warning message when official Node.js is detected
     */
    async showOfficialNodejsWarning(nodePath) {
        const action = await vscode.window.showWarningMessage(
            `Official Node.js detected at ${nodePath}. It's recommended to uninstall it and use a version manager (nvm/fnm/pnpm/volta/mise) for better Node.js version management.`,
            'Install nvm',
            'Install fnm',
            'Install pnpm',
            'Install Volta',
            'Install mise',
            'Dismiss'
        );

        if (action === 'Install nvm') {
            const platform = os.platform();
            if (platform === 'win32') {
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/coreybutler/nvm-windows'));
            } else {
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/nvm-sh/nvm'));
            }
        } else if (action === 'Install fnm') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/Schniz/fnm'));
        } else if (action === 'Install pnpm') {
            vscode.env.openExternal(vscode.Uri.parse('https://pnpm.io/installation'));
        } else if (action === 'Install Volta') {
            vscode.env.openExternal(vscode.Uri.parse('https://volta.sh/'));
        } else if (action === 'Install mise') {
            vscode.env.openExternal(vscode.Uri.parse('https://mise.jdx.dev/getting-started.html'));
        }
    }

    /**
     * Show error message when no manager is found
     */
    async showNoManagerError() {
        const action = await vscode.window.showErrorMessage(
            'No version manager (nvm/fnm/pnpm/volta/mise) detected. Please install one.',
            'Install nvm',
            'Install fnm',
            'Install pnpm',
            'Install Volta',
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
        } else if (action === 'Install fnm') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/Schniz/fnm'));
        } else if (action === 'Install pnpm') {
            vscode.env.openExternal(vscode.Uri.parse('https://pnpm.io/installation'));
        } else if (action === 'Install Volta') {
            vscode.env.openExternal(vscode.Uri.parse('https://volta.sh/'));
        } else if (action === 'Install mise') {
            vscode.env.openExternal(vscode.Uri.parse('https://mise.jdx.dev/getting-started.html'));
        } else if (action === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'fastNodeSwitcher');
        }
    }
}

module.exports = ToolDetector;
