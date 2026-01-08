const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

/**
 * Handler for .nvmrc file and Volta package.json detection and automatic version switching
 */
class NvmrcHandler {
    constructor(versionManager) {
        this.versionManager = versionManager;
        this.fileWatcher = null;
    }

    /**
     * Find .nvmrc file by traversing up the directory tree
     */
    findNvmrc(startDir) {
        let currentDir = startDir;
        const root = path.parse(currentDir).root;

        while (currentDir !== root) {
            const nvmrcPath = path.join(currentDir, '.nvmrc');
            if (fs.existsSync(nvmrcPath)) {
                return nvmrcPath;
            }
            currentDir = path.dirname(currentDir);
        }

        return null;
    }

    /**
     * Read .nvmrc file content
     * Supports formats: 20, v20, 20.10.0, lts/iron
     */
    readNvmrc(nvmrcPath) {
        try {
            const content = fs.readFileSync(nvmrcPath, 'utf8').trim();
            // Remove 'v' prefix if present
            return content.replace(/^v/, '');
        } catch (error) {
            console.error('Failed to read .nvmrc:', error);
            return null;
        }
    }

    /**
     * Find package.json with Volta configuration by traversing up the directory tree
     */
    findVoltaConfig(startDir) {
        let currentDir = startDir;
        const root = path.parse(currentDir).root;

        while (currentDir !== root) {
            const packageJsonPath = path.join(currentDir, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                try {
                    const content = fs.readFileSync(packageJsonPath, 'utf8');
                    const packageJson = JSON.parse(content);
                    // Check if it has volta configuration
                    if (packageJson.volta && packageJson.volta.node) {
                        return packageJsonPath;
                    }
                } catch (error) {
                    // Invalid JSON or read error, continue searching
                }
            }
            currentDir = path.dirname(currentDir);
        }

        return null;
    }

    /**
     * Read Volta configuration from package.json
     */
    readVoltaConfig(packageJsonPath) {
        try {
            const content = fs.readFileSync(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(content);

            if (packageJson.volta && packageJson.volta.node) {
                // Remove 'v' prefix if present
                return packageJson.volta.node.replace(/^v/, '');
            }

            return null;
        } catch (error) {
            console.error('Failed to read Volta config from package.json:', error);
            return null;
        }
    }

    /**
     * Check if current version matches the .nvmrc version
     */
    async isVersionMatching(nvmrcVersion) {
        const currentVersion = await this.versionManager.getCurrentVersion();
        if (!currentVersion) {
            return false;
        }

        // Check if current version starts with the nvmrc version
        // This handles cases like .nvmrc has "20" and current is "20.10.0"
        return currentVersion.startsWith(nvmrcVersion);
    }

    /**
     * Automatically apply .nvmrc or Volta package.json when opening workspace
     */
    async autoApplyNvmrc(workspaceFolder) {
        const config = vscode.workspace.getConfiguration('fastNodeSwitcher');
        const autoApply = config.get('autoApplyNvmrc', true);

        if (!autoApply) {
            console.log('Auto-apply is disabled');
            return;
        }

        let version = null;
        let configSource = null;
        let configPath = null;

        // Check if using Volta
        const isVolta = this.versionManager.name === 'volta';

        if (isVolta) {
            // For Volta, check package.json first
            configPath = this.findVoltaConfig(workspaceFolder);
            if (configPath) {
                version = this.readVoltaConfig(configPath);
                configSource = 'package.json (Volta)';
            }
        } else {
            // For nvm/mise, check .nvmrc
            configPath = this.findNvmrc(workspaceFolder);
            if (configPath) {
                version = this.readNvmrc(configPath);
                configSource = '.nvmrc';
            }
        }

        if (!configPath) {
            console.log('No version configuration file found');
            return;
        }

        if (!version) {
            console.log('Failed to read version from configuration');
            return;
        }

        // Check if current version already matches
        const isMatching = await this.isVersionMatching(version);
        if (isMatching) {
            console.log(`${configSource} version ${version} already active`);
            return;
        }

        // Ask user if they want to switch
        const action = await vscode.window.showInformationMessage(
            `Found ${configSource} specifying Node ${version}. Switch to this version?`,
            'Yes',
            'No',
            'Always'
        );

        if (action === 'Yes' || action === 'Always') {
            try {
                await this.versionManager.setVersion(version, 'local');
                vscode.window.showInformationMessage(`Switched to Node ${version} from ${configSource}`);

                if (action === 'Always') {
                    // Update config to always auto-apply
                    await config.update('autoApplyNvmrc', true, vscode.ConfigurationTarget.Global);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to apply version: ${error.message}`);
            }
        } else if (action === 'No') {
            // User declined, don't ask again for this session
            console.log('User declined auto-apply');
        }
    }

    /**
     * Watch .nvmrc or package.json file for changes
     */
    watchNvmrc(workspaceFolder) {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }

        // Check if using Volta
        const isVolta = this.versionManager.name === 'volta';

        // Watch appropriate file based on version manager
        const pattern = isVolta
            ? new vscode.RelativePattern(workspaceFolder, '**/package.json')
            : new vscode.RelativePattern(workspaceFolder, '**/.nvmrc');

        this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        this.fileWatcher.onDidCreate(async (uri) => {
            console.log('Config file created:', uri.fsPath);
            await this.autoApplyNvmrc(workspaceFolder);
        });

        this.fileWatcher.onDidChange(async (uri) => {
            console.log('Config file changed:', uri.fsPath);
            // For package.json, only react if it has Volta config
            if (isVolta) {
                const hasVoltaConfig = this.readVoltaConfig(uri.fsPath);
                if (hasVoltaConfig) {
                    await this.autoApplyNvmrc(workspaceFolder);
                }
            } else {
                await this.autoApplyNvmrc(workspaceFolder);
            }
        });

        this.fileWatcher.onDidDelete((uri) => {
            console.log('Config file deleted:', uri.fsPath);
        });

        return this.fileWatcher;
    }

    /**
     * Dispose resources
     */
    dispose() {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = null;
        }
    }
}

module.exports = NvmrcHandler;
