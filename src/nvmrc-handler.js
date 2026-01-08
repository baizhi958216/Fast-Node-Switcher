const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

/**
 * Handler for .nvmrc file detection and automatic version switching
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
     * Automatically apply .nvmrc when opening workspace
     */
    async autoApplyNvmrc(workspaceFolder) {
        const config = vscode.workspace.getConfiguration('fastNodeSwitcher');
        const autoApply = config.get('autoApplyNvmrc', true);

        if (!autoApply) {
            console.log('.nvmrc auto-apply is disabled');
            return;
        }

        const nvmrcPath = this.findNvmrc(workspaceFolder);
        if (!nvmrcPath) {
            console.log('No .nvmrc file found');
            return;
        }

        const version = this.readNvmrc(nvmrcPath);
        if (!version) {
            console.log('Failed to read .nvmrc version');
            return;
        }

        // Check if current version already matches
        const isMatching = await this.isVersionMatching(version);
        if (isMatching) {
            console.log(`.nvmrc version ${version} already active`);
            return;
        }

        // Ask user if they want to switch
        const action = await vscode.window.showInformationMessage(
            `Found .nvmrc specifying Node ${version}. Switch to this version?`,
            'Yes',
            'No',
            'Always'
        );

        if (action === 'Yes' || action === 'Always') {
            try {
                await this.versionManager.setVersion(version, 'local');
                vscode.window.showInformationMessage(`Switched to Node ${version} from .nvmrc`);

                if (action === 'Always') {
                    // Update config to always auto-apply
                    await config.update('autoApplyNvmrc', true, vscode.ConfigurationTarget.Global);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to apply .nvmrc: ${error.message}`);
            }
        } else if (action === 'No') {
            // User declined, don't ask again for this session
            console.log('User declined .nvmrc auto-apply');
        }
    }

    /**
     * Watch .nvmrc file for changes
     */
    watchNvmrc(workspaceFolder) {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }

        const pattern = new vscode.RelativePattern(workspaceFolder, '**/.nvmrc');
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        this.fileWatcher.onDidCreate(async (uri) => {
            console.log('.nvmrc file created:', uri.fsPath);
            await this.autoApplyNvmrc(workspaceFolder);
        });

        this.fileWatcher.onDidChange(async (uri) => {
            console.log('.nvmrc file changed:', uri.fsPath);
            await this.autoApplyNvmrc(workspaceFolder);
        });

        this.fileWatcher.onDidDelete((uri) => {
            console.log('.nvmrc file deleted:', uri.fsPath);
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
