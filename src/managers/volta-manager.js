const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vscode = require('vscode');
const BaseVersionManager = require('./base-manager');

const execPromise = util.promisify(exec);

/**
 * Volta version manager implementation
 * https://volta.sh/
 */
class VoltaManager extends BaseVersionManager {
    constructor() {
        super();
        this.name = 'volta';
        this.voltaHome = process.env.VOLTA_HOME || path.join(os.homedir(), '.volta');
    }

    /**
     * Get common Volta installation paths based on platform
     */
    getVoltaPaths() {
        const platform = os.platform();
        const homeDir = os.homedir();
        const paths = [];

        if (platform === 'win32') {
            // Windows paths
            paths.push(
                path.join(this.voltaHome, 'bin', 'volta.exe'),
                path.join(homeDir, '.volta', 'bin', 'volta.exe'),
                path.join(homeDir, 'AppData', 'Local', 'Volta', 'bin', 'volta.exe')
            );
        } else {
            // Linux/macOS paths
            paths.push(
                path.join(this.voltaHome, 'bin', 'volta'),
                path.join(homeDir, '.volta', 'bin', 'volta'),
                '/usr/local/bin/volta',
                '/usr/bin/volta'
            );
        }

        return paths;
    }

    /**
     * Detect if Volta is installed
     */
    async detect() {
        // Check if user has configured a custom path
        const config = vscode.workspace.getConfiguration('fastNodeSwitcher');
        const customPath = config.get('voltaPath');

        if (customPath && fs.existsSync(customPath)) {
            this.command = `"${customPath}"`;
            this.isAvailable = true;
            return true;
        }

        // Try common paths
        const paths = this.getVoltaPaths();
        for (const voltaPath of paths) {
            if (fs.existsSync(voltaPath)) {
                this.command = `"${voltaPath}"`;
                this.isAvailable = true;
                return true;
            }
        }

        // Try to find in PATH
        try {
            const platform = os.platform();
            const command = platform === 'win32' ? 'where volta' : 'which volta';
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
            const { stdout } = await execPromise(`${this.command} list --format plain`, options);

            // Parse output format:
            // runtime node@24.12.0 (current @ ...)
            // or
            // node@20.10.0 (default)
            const versions = stdout
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.includes('node@'))
                .map(line => {
                    const match = line.match(/node@(\d+\.\d+\.\d+)/);
                    return match ? match[1] : null;
                })
                .filter(v => v);

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
            const options = this.getWorkspaceOptions();
            const { stdout } = await execPromise(`${this.command} list --current --format plain`, options);

            // Parse output to find Node version
            const lines = stdout.split('\n');
            for (const line of lines) {
                if (line.includes('node@')) {
                    const match = line.match(/node@(\d+\.\d+\.\d+)/);
                    if (match) {
                        return match[1];
                    }
                }
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Set/switch to a specific Node version
     */
    async setVersion(version, scope = 'global') {
        try {
            // Remove 'v' prefix if present
            const cleanVersion = version.replace(/^v/, '');
            const options = {};

            if (scope === 'local') {
                // For local scope, use 'volta pin' which writes to package.json
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders || workspaceFolders.length === 0) {
                    throw new Error('No workspace folder open. Please open a folder first.');
                }
                options.cwd = workspaceFolders[0].uri.fsPath;
                await execPromise(`${this.command} pin node@${cleanVersion}`, options);
            } else {
                // For global scope, use 'volta install' which sets as default
                await execPromise(`${this.command} install node@${cleanVersion}`, options);
            }

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
            await execPromise(`${this.command} install node@${cleanVersion}`, options);
            return true;
        } catch (error) {
            throw new Error(`Failed to install node version: ${error.message}`);
        }
    }

    /**
     * Get list of available Node versions that can be installed
     * Volta doesn't provide a list command, so we fetch from Node.js API
     */
    async getAvailableVersions() {
        try {
            const https = require('https');

            return new Promise((resolve, reject) => {
                https.get('https://nodejs.org/dist/index.json', (res) => {
                    let data = '';

                    res.on('data', (chunk) => {
                        data += chunk;
                    });

                    res.on('end', () => {
                        try {
                            const releases = JSON.parse(data);
                            // Filter for LTS versions and get latest 20
                            const versions = releases
                                .filter(release => release.lts)
                                .map(release => release.version.replace(/^v/, ''))
                                .slice(0, 20);
                            resolve(versions);
                        } catch (error) {
                            console.error('Failed to parse Node.js releases:', error);
                            resolve([]);
                        }
                    });
                }).on('error', (error) => {
                    console.error('Failed to fetch available versions:', error);
                    resolve([]);
                });
            });
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
        return 'package.json';
    }

    /**
     * Get display name
     */
    getDisplayName() {
        return 'volta';
    }
}

module.exports = VoltaManager;
