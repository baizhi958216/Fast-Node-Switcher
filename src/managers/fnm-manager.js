const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vscode = require('vscode');
const BaseVersionManager = require('./base-manager');

const execPromise = util.promisify(exec);

/**
 * fnm (Fast Node Manager) version manager implementation
 * https://github.com/Schniz/fnm
 */
class FnmManager extends BaseVersionManager {
    constructor() {
        super();
        this.name = 'fnm';
    }

    /**
     * Get common fnm installation paths based on platform
     */
    getFnmPaths() {
        const platform = os.platform();
        const homeDir = os.homedir();
        const paths = [];

        if (platform === 'win32') {
            // Windows paths
            const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
            paths.push(
                path.join(localAppData, 'fnm', 'fnm.exe'),
                path.join(homeDir, '.fnm', 'bin', 'fnm.exe'),
                path.join(homeDir, '.local', 'share', 'fnm', 'fnm.exe')
            );
        } else {
            // Linux/macOS paths
            const xdgDataHome = process.env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share');
            paths.push(
                path.join(xdgDataHome, 'fnm', 'fnm'),
                path.join(homeDir, '.fnm', 'bin', 'fnm'),
                path.join(homeDir, '.local', 'share', 'fnm', 'fnm'),
                path.join(homeDir, 'Library', 'Application Support', 'fnm', 'fnm'),
                '/usr/local/bin/fnm',
                '/usr/bin/fnm'
            );
        }

        return paths;
    }

    /**
     * Detect if fnm is installed
     */
    async detect() {
        // Check if user has configured a custom path
        const config = vscode.workspace.getConfiguration('fastNodeSwitcher');
        const customPath = config.get('fnmPath');

        if (customPath && fs.existsSync(customPath)) {
            this.command = `"${customPath}"`;
            this.isAvailable = true;
            return true;
        }

        // Try common paths
        const paths = this.getFnmPaths();
        for (const fnmPath of paths) {
            if (fs.existsSync(fnmPath)) {
                this.command = `"${fnmPath}"`;
                this.isAvailable = true;
                return true;
            }
        }

        // Try to find in PATH
        try {
            const platform = os.platform();
            const command = platform === 'win32' ? 'where fnm' : 'which fnm';
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
     * Get fnm directory path
     */
    getFnmDir() {
        const platform = os.platform();
        const homeDir = os.homedir();

        if (platform === 'win32') {
            // On Windows, fnm stores data in %LOCALAPPDATA%\fnm_multishells
            const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
            const fnmMultishells = path.join(localAppData, 'fnm_multishells');

            // Check if fnm_multishells exists, otherwise try fnm
            if (fs.existsSync(fnmMultishells)) {
                return fnmMultishells;
            }

            // Fallback to XDG_DATA_HOME style path
            return path.join(homeDir, '.local', 'share', 'fnm');
        } else {
            // On Unix, fnm uses XDG_DATA_HOME or ~/.local/share/fnm
            const xdgDataHome = process.env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share');
            return path.join(xdgDataHome, 'fnm');
        }
    }

    /**
     * Get list of installed Node versions
     */
    async getInstalledVersions() {
        try {
            const options = this.getWorkspaceOptions();
            const { stdout } = await execPromise(`${this.command} list`, options);

            // Parse output format:
            // * v20.10.0
            // * v18.19.0 default
            // or
            // * 20.10.0
            // * 18.19.0 default
            const versions = stdout
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .map(line => {
                    // Remove leading * and whitespace
                    line = line.replace(/^\*\s*/, '');
                    // Remove 'default' or other tags
                    line = line.split(/\s+/)[0];
                    // Remove 'v' prefix if present
                    line = line.replace(/^v/, '');
                    return line;
                })
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
            // First, try to get version from fnm current command
            const options = this.getWorkspaceOptions();
            try {
                const { stdout } = await execPromise(`${this.command} current`, options);
                const version = stdout.trim().replace(/^v/, '');
                if (version && /^\d+\.\d+\.\d+/.test(version)) {
                    return version;
                }
            } catch (error) {
                // fnm current failed, try alternative methods
            }

            // Try to read from .node-version file in workspace
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const nodeVersionPath = path.join(workspaceFolders[0].uri.fsPath, '.node-version');
                if (fs.existsSync(nodeVersionPath)) {
                    const version = fs.readFileSync(nodeVersionPath, 'utf8').trim().replace(/^v/, '');
                    if (version && /^\d+\.\d+\.\d+/.test(version)) {
                        return version;
                    }
                }
            }

            // Try to read from default alias
            const fnmDir = this.getFnmDir();
            const defaultAliasPath = path.join(fnmDir, 'aliases', 'default');
            if (fs.existsSync(defaultAliasPath)) {
                const version = fs.readFileSync(defaultAliasPath, 'utf8').trim().replace(/^v/, '');
                if (version && /^\d+\.\d+\.\d+/.test(version)) {
                    return version;
                }
            }

            return null;
        } catch (error) {
            console.error('Failed to get current version:', error);
            return null;
        }
    }

    /**
     * Set/switch to a specific Node version
     * fnm only supports local scope - creates .node-version file
     */
    async setVersion(version, scope = 'local') {
        try {
            // Remove 'v' prefix if present
            const cleanVersion = version.replace(/^v/, '');

            // First, ensure the version is installed
            const installedVersions = await this.getInstalledVersions();
            if (!installedVersions.includes(cleanVersion)) {
                // Install the version if not already installed
                await this.installVersion(cleanVersion);
            }

            // Always use local scope for fnm - create .node-version file
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder open. fnm requires a workspace folder to create .node-version file.');
            }

            // Create .node-version file in workspace root
            const nodeVersionPath = path.join(workspaceFolders[0].uri.fsPath, '.node-version');
            fs.writeFileSync(nodeVersionPath, cleanVersion);

            // Don't show the default message, let commands.js handle it
            // But provide a custom message through the promise
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
            await execPromise(`${this.command} install ${cleanVersion}`, options);
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
            const { stdout } = await execPromise(`${this.command} list-remote --latest`, options);

            // Parse output format:
            // v20.10.0
            // v18.19.0
            // or
            // 20.10.0
            // 18.19.0
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
     * fnm only supports local scope in this extension
     */
    supportsScope() {
        return false;
    }

    /**
     * Get configuration file name
     */
    getConfigFileName() {
        return '.node-version';
    }

    /**
     * Get display name
     */
    getDisplayName() {
        return 'fnm';
    }
}

module.exports = FnmManager;
