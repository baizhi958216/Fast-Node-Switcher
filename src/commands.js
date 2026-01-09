const vscode = require('vscode');

/**
 * Command handlers for the extension
 */
class Commands {
    constructor(detector, statusBarManager, nvmrcHandler) {
        this.detector = detector;
        this.statusBarManager = statusBarManager;
        this.nvmrcHandler = nvmrcHandler;
    }

    /**
     * Register all commands
     */
    register(context) {
        context.subscriptions.push(
            vscode.commands.registerCommand('fast-node-switcher.switchVersion', () => this.switchVersion())
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('fast-node-switcher.showCurrentVersion', () => this.showCurrentVersion())
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('fast-node-switcher.installVersion', () => this.installVersion())
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('fast-node-switcher.refreshVersions', () => this.refreshVersions())
        );
    }

    /**
     * Switch Node version command
     */
    async switchVersion() {
        // Check if official Node.js is installed first (priority check)
        const officialNodePath = await this.detector.detectOfficialNodejs();
        if (officialNodePath) {
            await this.detector.showOfficialNodejsWarning(officialNodePath);
            return;
        }

        const manager = this.detector.getActiveManager();
        if (!manager) {
            await this.detector.showNoManagerError();
            return;
        }

        try {
            const versions = await manager.getInstalledVersions();

            if (versions.length === 0) {
                const install = await vscode.window.showInformationMessage(
                    'No Node versions installed. Would you like to install one?',
                    'Install',
                    'Cancel'
                );
                if (install === 'Install') {
                    await this.installVersion();
                }
                return;
            }

            const items = versions.map(version => ({
                label: version,
                description: 'Installed',
                version: version
            }));

            items.push({
                label: '$(add) Install New Version',
                description: 'Install a new Node version',
                version: 'install'
            });

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a Node version'
            });

            if (selected) {
                if (selected.version === 'install') {
                    await this.installVersion();
                } else {
                    await this.selectScope(selected.version);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to switch version: ${error.message}`);
        }
    }

    /**
     * Select scope (global/local) and set version
     */
    async selectScope(version) {
        const manager = this.detector.getActiveManager();
        if (!manager) return;

        // If manager doesn't support scope, just set globally
        if (!manager.supportsScope()) {
            try {
                await manager.setVersion(version, 'global');

                // Special message for fnm
                if (manager.name === 'fnm') {
                    vscode.window.showInformationMessage(
                        `Created .node-version file with Node ${version}. Open a new terminal to use this version.`,
                        'Open Terminal'
                    ).then(action => {
                        if (action === 'Open Terminal') {
                            vscode.commands.executeCommand('workbench.action.terminal.new');
                        }
                    });
                } else {
                    vscode.window.showInformationMessage(`Node version switched to: ${version}`);
                }

                await this.statusBarManager.update();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to set version: ${error.message}`);
            }
            return;
        }

        const scope = await vscode.window.showQuickPick(
            [
                { label: 'Global', value: 'global' },
                { label: 'Local (Current Directory)', value: 'local' }
            ],
            { placeHolder: 'Select scope' }
        );

        if (scope) {
            try {
                await manager.setVersion(version, scope.value);
                vscode.window.showInformationMessage(`Node version switched to: ${version} (${scope.value})`);
                await this.statusBarManager.update();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to set version: ${error.message}`);
            }
        }
    }

    /**
     * Show current Node version command
     */
    async showCurrentVersion() {
        // Check if official Node.js is installed first (priority check)
        const officialNodePath = await this.detector.detectOfficialNodejs();
        if (officialNodePath) {
            await this.detector.showOfficialNodejsWarning(officialNodePath);
            return;
        }

        const manager = this.detector.getActiveManager();
        if (!manager) {
            await this.detector.showNoManagerError();
            return;
        }

        try {
            const currentVersion = await manager.getCurrentVersion();
            const toolName = manager.getDisplayName();

            if (currentVersion) {
                vscode.window.showInformationMessage(
                    `Current Node Version: ${currentVersion} (managed by ${toolName})`
                );
            } else {
                vscode.window.showInformationMessage(
                    `No Node version is currently set (managed by ${toolName})`
                );
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to get current version: ${error.message}`);
        }
    }

    /**
     * Install Node version command
     */
    async installVersion() {
        // Check if official Node.js is installed first (priority check)
        const officialNodePath = await this.detector.detectOfficialNodejs();
        if (officialNodePath) {
            await this.detector.showOfficialNodejsWarning(officialNodePath);
            return;
        }

        const manager = this.detector.getActiveManager();
        if (!manager) {
            await this.detector.showNoManagerError();
            return;
        }

        const input = await vscode.window.showInputBox({
            prompt: 'Enter Node version to install (e.g., 24, 22.1.0, lts)',
            placeHolder: '24',
            validateInput: (value) => {
                if (!value) {
                    return 'Version cannot be empty';
                }
                return null;
            }
        });

        if (input) {
            try {
                vscode.window.showInformationMessage(`Installing Node ${input}...`);
                await manager.installVersion(input);
                vscode.window.showInformationMessage(`Node ${input} installed successfully`);

                const buttons = ['Yes (Global)'];
                if (manager.supportsScope()) {
                    buttons.push('Yes (Local)');
                }
                buttons.push('No');

                const use = await vscode.window.showInformationMessage(
                    `Node ${input} installed. Set as active version?`,
                    ...buttons
                );

                if (use === 'Yes (Global)') {
                    await manager.setVersion(input, 'global');
                    vscode.window.showInformationMessage(`Node ${input} set as global version`);
                    await this.statusBarManager.update();
                } else if (use === 'Yes (Local)') {
                    await manager.setVersion(input, 'local');
                    vscode.window.showInformationMessage(`Node ${input} set as local version`);
                    await this.statusBarManager.update();
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to install version: ${error.message}`);
            }
        }
    }

    /**
     * Refresh versions command
     */
    async refreshVersions() {
        // Check if official Node.js is installed first (priority check)
        const officialNodePath = await this.detector.detectOfficialNodejs();
        if (officialNodePath) {
            await this.detector.showOfficialNodejsWarning(officialNodePath);
            return;
        }

        const manager = this.detector.getActiveManager();
        if (!manager) {
            await this.detector.showNoManagerError();
            return;
        }

        try {
            await this.statusBarManager.update();
            vscode.window.showInformationMessage('Node versions refreshed');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to refresh versions: ${error.message}`);
        }
    }
}

module.exports = Commands;
