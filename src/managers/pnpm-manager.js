const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vscode = require('vscode');
const BaseVersionManager = require('./base-manager');
const ProcessHelper = require('../utils/process-helper');

const execPromise = util.promisify(exec);

/**
 * pnpm version manager implementation
 * https://pnpm.io/cli/env
 */
class PnpmManager extends BaseVersionManager {
    constructor() {
        super();
        this.name = 'pnpm';
    }

    /**
     * Get common pnpm installation paths based on platform
     */
    getPnpmPaths() {
        const platform = os.platform();
        const homeDir = os.homedir();
        const paths = [];

        if (platform === 'win32') {
            // Windows paths - prioritize .CMD files
            const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
            const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
            paths.push(
                path.join(localAppData, 'pnpm', 'pnpm.CMD'),
                path.join(appData, 'npm', 'pnpm.cmd'),
                path.join(localAppData, 'pnpm', 'pnpm.exe'),
                path.join(homeDir, '.local', 'share', 'pnpm', 'pnpm.exe')
            );
        } else {
            // Linux/macOS paths
            paths.push(
                path.join(homeDir, '.local', 'share', 'pnpm', 'pnpm'),
                '/usr/local/bin/pnpm',
                '/usr/bin/pnpm',
                '/opt/homebrew/bin/pnpm'
            );
        }

        return paths;
    }

    /**
     * Detect if pnpm is installed
     */
    async detect() {
        // Check if user has configured a custom path
        const config = vscode.workspace.getConfiguration('fastNodeSwitcher');
        const customPath = config.get('pnpmPath');

        if (customPath && fs.existsSync(customPath)) {
            this.pnpmPath = customPath;
            this.isAvailable = true;
            return true;
        }

        // Try common paths
        const paths = this.getPnpmPaths();
        for (const pnpmPath of paths) {
            if (fs.existsSync(pnpmPath)) {
                this.pnpmPath = pnpmPath;
                this.isAvailable = true;
                return true;
            }
        }

        // Try to find in PATH
        try {
            const platform = os.platform();
            const command = platform === 'win32' ? 'where pnpm' : 'which pnpm';
            const { stdout } = await execPromise(command);
            const lines = stdout.trim().split('\n').map(line => line.trim()).filter(line => line);

            // On Windows, prefer .CMD files over .exe or no extension
            if (platform === 'win32') {
                const cmdFile = lines.find(line => line.toLowerCase().endsWith('.cmd'));
                if (cmdFile) {
                    this.pnpmPath = cmdFile;
                    this.isAvailable = true;
                    return true;
                }
            }

            // Use the first found path
            if (lines.length > 0) {
                this.pnpmPath = lines[0];
                this.isAvailable = true;
                return true;
            }
        } catch (error) {
            // Not in PATH
        }

        // If not found in specific paths, try just 'pnpm' command
        try {
            await execPromise('pnpm --version');
            this.pnpmPath = 'pnpm';
            this.isAvailable = true;
            return true;
        } catch (error) {
            // Not available
        }

        this.isAvailable = false;
        return false;
    }

    /**
     * Build command string for execution
     * On Windows, handle quoted paths properly for PowerShell/cmd
     */
    buildCommand(args) {
        const platform = os.platform();

        // If pnpmPath is just 'pnpm', use it directly
        if (this.pnpmPath === 'pnpm') {
            return `pnpm ${args}`;
        }

        // On Windows, use cmd /c to handle quoted paths properly
        if (platform === 'win32') {
            return `cmd /c ""${this.pnpmPath}" ${args}"`;
        }

        // On Unix-like systems, quote the path
        return `"${this.pnpmPath}" ${args}`;
    }

    /**
     * Get workspace options for command execution
     */
    getWorkspaceOptions() {
        const options = {};
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            options.cwd = workspaceFolders[0].uri.fsPath;
        }
        return options;
    }

    /**
     * Get list of installed Node versions
     */
    async getInstalledVersions() {
        try {
            const options = this.getWorkspaceOptions();
            const { stdout } = await execPromise(this.buildCommand('env list'), options);

            console.log('[pnpm-manager] Raw output from pnpm env list:', JSON.stringify(stdout));

            // Parse output format - pnpm env list shows versions like:
            // * 24.12.0
            // 22.11.0
            // Note: pnpm doesn't use 'v' prefix, and current version has a '*' marker
            const versions = stdout
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .map(line => {
                    // Remove leading * marker and any extra whitespace
                    return line.replace(/^\*\s*/, '').trim();
                })
                .filter(v => v && /^\d+\.\d+\.\d+/.test(v));

            console.log('[pnpm-manager] Parsed versions:', versions);

            // Remove duplicates and return unique versions
            return [...new Set(versions)];
        } catch (error) {
            console.error('[pnpm-manager] Failed to get installed versions:', error);
            console.error('[pnpm-manager] Error details:', error.message);
            return [];
        }
    }

    /**
     * Get the currently active Node version
     */
    async getCurrentVersion() {
        try {
            // Get current Node version from node --version
            const options = this.getWorkspaceOptions();
            const { stdout } = await execPromise('node --version', options);
            const version = stdout.trim().replace(/^v/, '');
            console.log('[pnpm-manager] Current version from node --version:', version);
            if (version && /^\d+\.\d+\.\d+/.test(version)) {
                return version;
            }
            return null;
        } catch (error) {
            console.error('[pnpm-manager] Failed to get current version:', error);
            return null;
        }
    }

    /**
     * Set/switch to a specific Node version
     * pnpm only supports global scope
     */
    async setVersion(version, scope = 'global') {
        try {
            // Show warning if user selected local scope
            if (scope === 'local') {
                vscode.window.showWarningMessage(
                    'pnpm env only supports global scope. The version will be set globally.'
                );
            }

            // Remove 'v' prefix if present
            const cleanVersion = version.replace(/^v/, '');

            // First, ensure the version is installed
            const installedVersions = await this.getInstalledVersions();
            if (!installedVersions.includes(cleanVersion)) {
                // Install the version if not already installed
                await this.installVersion(cleanVersion);
            }

            // On Windows, check for running Node processes before switching
            if (os.platform() === 'win32') {
                const shouldContinue = await ProcessHelper.promptToHandleProcesses();
                if (!shouldContinue) {
                    throw new Error('Version switch cancelled by user.');
                }
            }

            // Use pnpm env use --global to switch version
            const options = this.getWorkspaceOptions();
            await execPromise(this.buildCommand(`env use --global ${cleanVersion}`), options);

            // Prompt to reload VS Code window
            await ProcessHelper.promptToReloadWindow();

            return true;
        } catch (error) {
            // Check for permission errors
            if (error.message.includes('EPERM') || error.message.includes('operation not permitted')) {
                throw new Error(
                    'Permission denied. Node.js files are still in use. Please close all terminals and try again. ' +
                    'If the issue persists, you may need to restart VS Code.'
                );
            }
            throw new Error(`Failed to set node version: ${error.message}`);
        }
    }

    /**
     * Install a specific Node version
     */
    async installVersion(version) {
        try {
            // Remove 'v' prefix if present
            const cleanVersion = version.replace(/^v/, '');
            const options = this.getWorkspaceOptions();

            // Use pnpm env add --global to install version
            await execPromise(this.buildCommand(`env add --global ${cleanVersion}`), options);
            return true;
        } catch (error) {
            throw new Error(`Failed to install node version: ${error.message}`);
        }
    }

    /**
     * Get list of available Node versions that can be installed
     */
    async getAvailableVersions() {
        try {
            const options = this.getWorkspaceOptions();
            const { stdout } = await execPromise(this.buildCommand('env list --remote'), options);

            // Parse output format - pnpm env list --remote shows versions like:
            // 24.12.0
            // 22.11.0
            // Note: pnpm doesn't use 'v' prefix
            const versions = stdout
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .filter(v => v && /^\d+\.\d+\.\d+/.test(v))
                .slice(0, 20); // Limit to 20 versions

            return versions;
        } catch (error) {
            console.error('Failed to get available versions:', error);
            return [];
        }
    }

    /**
     * Check if scope is supported
     * pnpm only supports global scope
     */
    supportsScope() {
        return false;
    }

    /**
     * Get configuration file name
     * pnpm doesn't use a specific config file
     */
    getConfigFileName() {
        return null;
    }

    /**
     * Get display name
     */
    getDisplayName() {
        return 'pnpm';
    }
}

module.exports = PnpmManager;
