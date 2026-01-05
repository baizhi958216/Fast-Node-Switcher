const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vscode = require('vscode');
const BaseVersionManager = require('./base-manager');

const execPromise = util.promisify(exec);

/**
 * nvm-windows version manager implementation
 * https://github.com/coreybutler/nvm-windows
 */
class NvmWindowsManager extends BaseVersionManager {
    constructor() {
        super();
        this.name = 'nvm-windows';
    }

    /**
     * Get common nvm-windows installation paths
     */
    getNvmPaths() {
        const paths = [];

        // Common installation paths
        if (process.env.PROGRAMFILES) {
            paths.push(path.join(process.env.PROGRAMFILES, 'nvm', 'nvm.exe'));
        }
        if (process.env['PROGRAMFILES(X86)']) {
            paths.push(path.join(process.env['PROGRAMFILES(X86)'], 'nvm', 'nvm.exe'));
        }
        if (process.env.APPDATA) {
            paths.push(path.join(process.env.APPDATA, 'nvm', 'nvm.exe'));
        }

        // Additional paths
        paths.push(
            'C:\\Program Files\\nvm\\nvm.exe',
            'C:\\Program Files (x86)\\nvm\\nvm.exe',
            path.join(os.homedir(), 'AppData', 'Roaming', 'nvm', 'nvm.exe')
        );

        return paths;
    }

    /**
     * Detect if nvm-windows is installed
     */
    async detect() {
        // Only detect on Windows
        if (os.platform() !== 'win32') {
            this.isAvailable = false;
            return false;
        }

        // Check if user has configured a custom path
        const config = vscode.workspace.getConfiguration('nodeVersionSwitcher');
        const customPath = config.get('nvmPath');

        if (customPath && fs.existsSync(customPath)) {
            this.command = `"${customPath}"`;
            this.isAvailable = true;
            return true;
        }

        // Try common paths
        const paths = this.getNvmPaths();
        for (const nvmPath of paths) {
            if (fs.existsSync(nvmPath)) {
                this.command = `"${nvmPath}"`;
                this.isAvailable = true;
                return true;
            }
        }

        // Try to find in PATH
        try {
            const { stdout } = await execPromise('where nvm');
            const foundPath = stdout.trim().split('\n')[0];
            if (foundPath && foundPath.toLowerCase().includes('nvm.exe')) {
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
     * Get list of installed Node versions
     */
    async getInstalledVersions() {
        try {
            const { stdout } = await execPromise(`${this.command} list`);
            // Parse output format:
            //   * 20.10.0 (Currently using 64-bit executable)
            //     18.19.0
            const versions = stdout
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.match(/^\*?\s*\d+\.\d+\.\d+/))
                .map(line => {
                    const match = line.match(/(\d+\.\d+\.\d+)/);
                    return match ? match[1] : null;
                })
                .filter(v => v);
            return versions;
        } catch (error) {
            console.error('Failed to get nvm-windows versions:', error);
            return [];
        }
    }

    /**
     * Get the currently active Node version
     */
    async getCurrentVersion() {
        try {
            const { stdout } = await execPromise(`${this.command} current`);
            const match = stdout.match(/v?(\d+\.\d+\.\d+)/);
            return match ? match[1] : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Set/switch to a specific Node version
     * Note: nvm-windows only supports global switching
     */
    async setVersion(version, scope = 'global') {
        try {
            // nvm-windows doesn't support local scope, only global
            if (scope === 'local') {
                // Create .nvmrc file as a hint, but actual switch is global
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders && workspaceFolders.length > 0) {
                    const nvmrcPath = path.join(workspaceFolders[0].uri.fsPath, '.nvmrc');
                    fs.writeFileSync(nvmrcPath, version);
                }
            }

            // Remove 'v' prefix if present
            const cleanVersion = version.replace(/^v/, '');
            await execPromise(`${this.command} use ${cleanVersion}`);
            return true;
        } catch (error) {
            throw new Error(`Failed to set version: ${error.message}`);
        }
    }

    /**
     * Install a specific Node version
     */
    async installVersion(version) {
        try {
            // Remove 'v' prefix if present
            const cleanVersion = version.replace(/^v/, '');
            await execPromise(`${this.command} install ${cleanVersion}`);
            return true;
        } catch (error) {
            throw new Error(`Failed to install version: ${error.message}`);
        }
    }

    /**
     * Get list of available Node versions that can be installed
     */
    async getAvailableVersions() {
        try {
            const { stdout } = await execPromise(`${this.command} list available`);
            // Parse output and get latest versions
            const versions = stdout
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.match(/^\d+\.\d+\.\d+/))
                .map(line => {
                    const match = line.match(/(\d+\.\d+\.\d+)/);
                    return match ? match[1] : null;
                })
                .filter(v => v)
                .slice(0, 20);
            return versions;
        } catch (error) {
            console.error('Failed to get available versions:', error);
            return [];
        }
    }

    /**
     * Check if scope is supported
     * nvm-windows only supports global scope
     */
    supportsScope() {
        return false;
    }

    /**
     * Get configuration file name
     */
    getConfigFileName() {
        return '.nvmrc';
    }

    /**
     * Get display name
     */
    getDisplayName() {
        return 'nvm-windows';
    }
}

module.exports = NvmWindowsManager;
