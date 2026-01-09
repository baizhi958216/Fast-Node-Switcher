const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vscode = require('vscode');
const BaseVersionManager = require('./base-manager');

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
            // Windows paths
            const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
            const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
            paths.push(
                path.join(localAppData, 'pnpm', 'pnpm.exe'),
                path.join(appData, 'npm', 'pnpm.cmd'),
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
            this.command = `"${customPath}"`;
            this.isAvailable = true;
            return true;
        }

        // Try common paths
        const paths = this.getPnpmPaths();
        for (const pnpmPath of paths) {
            if (fs.existsSync(pnpmPath)) {
                this.command = `"${pnpmPath}"`;
                this.isAvailable = true;
                return true;
            }
        }

        // Try to find in PATH
        try {
            const platform = os.platform();
            const command = platform === 'win32' ? 'where pnpm' : 'which pnpm';
            const { stdout } = await execPromise(command);
            const foundPath = stdout.trim().split('\n')[0];
            if (foundPath) {
                this.command = `"${foundPath}"`;
                this.isAvailable = true;
                return true;
            }
        } catch (error) {
            // Not in PATH
        }

        this.isAvailable = false;
        return false;
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
            const { stdout } = await execPromise(`${this.command} env list`, options);

            // Parse output format - pnpm env list shows versions like:
            // v20.10.0
            // v18.19.0
            const versions = stdout
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .map(line => line.replace(/^v/, ''))
                .filter(v => v && /^\d+\.\d+\.\d+/.test(v));

            // Remove duplicates and return unique versions
            return [...new Set(versions)];
        } catch (error) {
            console.error('Failed to get installed versions:', error);
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
            if (version && /^\d+\.\d+\.\d+/.test(version)) {
                return version;
            }
            return null;
        } catch (error) {
            console.error('Failed to get current version:', error);
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

            // Use pnpm env use --global to switch version
            const options = this.getWorkspaceOptions();
            await execPromise(`${this.command} env use --global ${cleanVersion}`, options);

            return true;
        } catch (error) {
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
            await execPromise(`${this.command} env add --global ${cleanVersion}`, options);
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
            const { stdout } = await execPromise(`${this.command} env list --remote`, options);

            // Parse output format - pnpm env list --remote shows versions like:
            // v20.10.0
            // v18.19.0
            const versions = stdout
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .map(line => line.replace(/^v/, ''))
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
