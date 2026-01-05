const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vscode = require('vscode');
const BaseVersionManager = require('./base-manager');

const execPromise = util.promisify(exec);

/**
 * Mise version manager implementation
 */
class MiseManager extends BaseVersionManager {
    constructor() {
        super();
        this.name = 'mise';
    }

    /**
     * Get common mise installation paths based on platform
     */
    getMisePaths() {
        const platform = os.platform();
        const homeDir = os.homedir();
        const paths = [];

        if (platform === 'win32') {
            // Windows paths
            paths.push(
                path.join(homeDir, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links', 'mise.exe'),
                path.join(homeDir, 'AppData', 'Local', 'mise', 'mise.exe'),
                path.join(homeDir, '.local', 'bin', 'mise.exe'),
                'C:\\Program Files\\mise\\mise.exe',
                'C:\\ProgramData\\chocolatey\\bin\\mise.exe'
            );
        } else {
            // Linux/macOS paths
            paths.push(
                path.join(homeDir, '.local', 'bin', 'mise'),
                '/usr/local/bin/mise',
                '/usr/bin/mise',
                '/opt/homebrew/bin/mise',
                '/home/linuxbrew/.linuxbrew/bin/mise'
            );
        }

        return paths;
    }

    /**
     * Detect if mise is installed
     */
    async detect() {
        // Check if user has configured a custom path
        const config = vscode.workspace.getConfiguration('nodeVersionSwitcher');
        const customPath = config.get('misePath');

        if (customPath && fs.existsSync(customPath)) {
            this.command = `"${customPath}"`;
            this.isAvailable = true;
            return true;
        }

        // Try common paths
        const paths = this.getMisePaths();
        for (const misePath of paths) {
            if (fs.existsSync(misePath)) {
                this.command = `"${misePath}"`;
                this.isAvailable = true;
                return true;
            }
        }

        // Try to find in PATH
        try {
            const platform = os.platform();
            const command = platform === 'win32' ? 'where mise' : 'which mise';
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
            const { stdout } = await execPromise(`${this.command} ls node --json`, options);
            const versions = JSON.parse(stdout);
            return versions.map(v => v.version).filter(v => v);
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
            const options = this.getWorkspaceOptions();
            const { stdout } = await execPromise(`${this.command} current node`, options);
            return stdout.trim();
        } catch (error) {
            return null;
        }
    }

    /**
     * Set/switch to a specific Node version
     */
    async setVersion(version, scope = 'global') {
        try {
            const flag = scope === 'global' ? '--global' : '';
            const options = {};

            // For local scope, use workspace folder as cwd
            if (scope === 'local') {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders || workspaceFolders.length === 0) {
                    throw new Error('No workspace folder open. Please open a folder first.');
                }
                options.cwd = workspaceFolders[0].uri.fsPath;
            }

            await execPromise(`${this.command} use ${flag} node@${version}`, options);
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
            const options = this.getWorkspaceOptions();
            await execPromise(`${this.command} install node@${version}`, options);
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
            const { stdout } = await execPromise(`${this.command} ls-remote node`);
            const versions = stdout.trim().split('\n').filter(v => v);
            // Return latest 20 versions
            return versions.slice(0, 20);
        } catch (error) {
            console.error('Failed to get available versions:', error);
            return [];
        }
    }

    /**
     * Check if scope is supported
     */
    supportsScope() {
        return true;
    }

    /**
     * Get configuration file name
     */
    getConfigFileName() {
        return '.mise.toml';
    }

    /**
     * Get display name
     */
    getDisplayName() {
        return 'mise';
    }
}

module.exports = MiseManager;
