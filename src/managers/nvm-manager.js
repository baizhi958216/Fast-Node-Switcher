const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vscode = require('vscode');
const BaseVersionManager = require('./base-manager');

const execPromise = util.promisify(exec);

/**
 * nvm (Unix) version manager implementation
 * https://github.com/nvm-sh/nvm
 */
class NvmManager extends BaseVersionManager {
    constructor() {
        super();
        this.name = 'nvm';
        this.nvmDir = process.env.NVM_DIR || path.join(os.homedir(), '.nvm');
    }

    /**
     * Get common nvm installation paths
     */
    getNvmPaths() {
        const paths = [];

        // Primary location
        paths.push(path.join(this.nvmDir, 'nvm.sh'));

        // Alternative locations
        paths.push(
            path.join(os.homedir(), '.nvm', 'nvm.sh'),
            '/usr/local/opt/nvm/nvm.sh',
            path.join(os.homedir(), '.config', 'nvm', 'nvm.sh')
        );

        return paths;
    }

    /**
     * Detect if nvm is installed
     */
    async detect() {
        // Only detect on Unix-like systems
        if (os.platform() === 'win32') {
            this.isAvailable = false;
            return false;
        }

        // Check if user has configured a custom path
        const config = vscode.workspace.getConfiguration('fastNodeSwitcher');
        const customPath = config.get('nvmPath');

        if (customPath && fs.existsSync(customPath)) {
            this.command = customPath;
            this.nvmDir = path.dirname(customPath);
            this.isAvailable = true;
            return true;
        }

        // Try common paths
        const paths = this.getNvmPaths();
        for (const nvmPath of paths) {
            if (fs.existsSync(nvmPath)) {
                this.command = nvmPath;
                this.nvmDir = path.dirname(nvmPath);
                this.isAvailable = true;
                return true;
            }
        }

        this.isAvailable = false;
        return false;
    }

    /**
     * Execute nvm command
     * nvm is a bash function, so we need to source it first
     */
    async execNvm(command, options = {}) {
        const fullCommand = `bash -c "source ${this.command} && nvm ${command}"`;
        return await execPromise(fullCommand, {
            ...options,
            env: { ...process.env, NVM_DIR: this.nvmDir }
        });
    }

    /**
     * Get list of installed Node versions
     */
    async getInstalledVersions() {
        try {
            const { stdout } = await this.execNvm('list');
            // Parse output format:
            //   ->     v20.10.0
            //          v18.19.0
            //          system
            const versions = stdout
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.match(/v?\d+\.\d+\.\d+/))
                .map(line => {
                    const match = line.match(/v?(\d+\.\d+\.\d+)/);
                    return match ? match[1] : null;
                })
                .filter(v => v);
            return versions;
        } catch (error) {
            console.error('Failed to get nvm versions:', error);
            return [];
        }
    }

    /**
     * Get the currently active Node version
     */
    async getCurrentVersion() {
        try {
            const { stdout } = await this.execNvm('current');
            const version = stdout.trim().replace(/^v/, '');
            return version === 'none' || version === 'system' ? null : version;
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

            if (scope === 'local') {
                // nvm's local scope is implemented via .nvmrc file
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders || workspaceFolders.length === 0) {
                    throw new Error('No workspace folder open. Please open a folder first.');
                }
                const nvmrcPath = path.join(workspaceFolders[0].uri.fsPath, '.nvmrc');
                fs.writeFileSync(nvmrcPath, cleanVersion);

                // Use the version from .nvmrc
                await this.execNvm('use', { cwd: workspaceFolders[0].uri.fsPath });
            } else {
                // Global: use and set as default
                await this.execNvm(`use ${cleanVersion}`);
                await this.execNvm(`alias default ${cleanVersion}`);
            }

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
            await this.execNvm(`install ${cleanVersion}`);
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
            const { stdout } = await this.execNvm('ls-remote --lts');
            // Parse output and get latest LTS versions
            const versions = stdout
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.match(/v?\d+\.\d+\.\d+/))
                .map(line => {
                    const match = line.match(/v?(\d+\.\d+\.\d+)/);
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
     */
    supportsScope() {
        return true;
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
        return 'nvm';
    }
}

module.exports = NvmManager;
