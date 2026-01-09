const vscode = require('vscode');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');

const execPromise = util.promisify(exec);

let statusBarItem;
let miseCommand = null;

function getMisePaths() {
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

async function findMiseCommand() {
    // Check if user has configured a custom path
    const config = vscode.workspace.getConfiguration('miseNodeSwitcher');
    const customPath = config.get('misePath');

    if (customPath && fs.existsSync(customPath)) {
        return `"${customPath}"`;
    }

    // Try common paths
    const paths = getMisePaths();
    for (const misePath of paths) {
        if (fs.existsSync(misePath)) {
            return `"${misePath}"`;
        }
    }

    // Try to find in PATH
    try {
        const platform = os.platform();
        const command = platform === 'win32' ? 'where mise' : 'which mise';
        const { stdout } = await execPromise(command);
        const foundPath = stdout.trim().split('\n')[0];
        if (foundPath) {
            return `"${foundPath}"`;
        }
    } catch (error) {
        // Not in PATH
    }

    return null;
}

async function checkMiseInstalled() {
    if (!miseCommand) {
        miseCommand = await findMiseCommand();
    }

    if (!miseCommand) {
        const action = await vscode.window.showErrorMessage(
            'mise is not found. Please install mise or configure the path in settings.',
            'Open Settings',
            'Install Guide'
        );

        if (action === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'miseNodeSwitcher.misePath');
        } else if (action === 'Install Guide') {
            vscode.env.openExternal(vscode.Uri.parse('https://mise.jdx.dev/getting-started.html'));
        }
        return false;
    }

    try {
        await execPromise(`${miseCommand} --version`);
        return true;
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to run mise: ${error.message}`);
        return false;
    }
}

async function getInstalledVersions() {
    try {
        const options = {};
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            options.cwd = workspaceFolders[0].uri.fsPath;
        }

        const { stdout } = await execPromise(`${miseCommand} ls node --json`, options);
        const versions = JSON.parse(stdout);
        return versions.map(v => v.version).filter(v => v);
    } catch (error) {
        console.error('Failed to get installed versions:', error);
        return [];
    }
}

async function getCurrentVersion() {
    try {
        const options = {};
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            options.cwd = workspaceFolders[0].uri.fsPath;
        }

        const { stdout } = await execPromise(`${miseCommand} current node`, options);
        return stdout.trim();
    } catch (error) {
        return null;
    }
}

async function setNodeVersion(version, scope = 'global') {
    try {
        const flag = scope === 'global' ? '--global' : '';
        const options = {};

        // For local scope, use workspace folder as cwd
        if (scope === 'local') {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('No workspace folder open. Please open a folder first.');
                return false;
            }
            options.cwd = workspaceFolders[0].uri.fsPath;
        }

        await execPromise(`${miseCommand} use ${flag} node@${version}`, options);
        vscode.window.showInformationMessage(`Node version switched to: ${version} (${scope})`);
        updateStatusBar();
        return true;
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to set node version: ${error.message}`);
        return false;
    }
}

async function installNodeVersion(version) {
    try {
        const options = {};
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            options.cwd = workspaceFolders[0].uri.fsPath;
        }

        vscode.window.showInformationMessage(`Installing Node ${version}...`);
        await execPromise(`${miseCommand} install node@${version}`, options);
        vscode.window.showInformationMessage(`Node ${version} installed successfully`);
        return true;
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to install node version: ${error.message}`);
        return false;
    }
}

async function getAvailableVersions() {
    try {
        const { stdout } = await execPromise(`${miseCommand} ls-remote node`);
        const versions = stdout.trim().split('\n').filter(v => v);
        // Return latest 20 versions
        return versions.slice(0, 20);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to get available versions: ${error.message}`);
        return [];
    }
}

async function updateStatusBar() {
    const currentVersion = await getCurrentVersion();
    if (currentVersion) {
        statusBarItem.text = `$(versions) Node ${currentVersion}`;
        statusBarItem.tooltip = `Current Node Version: ${currentVersion}\nClick to switch`;
        statusBarItem.show();
    } else {
        statusBarItem.text = `$(versions) Node (not set)`;
        statusBarItem.tooltip = 'No Node version set\nClick to select';
        statusBarItem.show();
    }
}

function activate(context) {
    console.log('Mise Node Switcher is now active');

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'mise-node-switcher.switchVersion';
    context.subscriptions.push(statusBarItem);

    checkMiseInstalled().then(installed => {
        if (installed) {
            updateStatusBar();
        }
    });

    const switchVersionCommand = vscode.commands.registerCommand(
        'mise-node-switcher.switchVersion',
        async () => {
            const installed = await checkMiseInstalled();
            if (!installed) return;

            const versions = await getInstalledVersions();

            if (versions.length === 0) {
                const install = await vscode.window.showInformationMessage(
                    'No Node versions installed. Would you like to install one?',
                    'Install',
                    'Cancel'
                );
                if (install === 'Install') {
                    vscode.commands.executeCommand('mise-node-switcher.installVersion');
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
                    vscode.commands.executeCommand('mise-node-switcher.installVersion');
                } else {
                    const scope = await vscode.window.showQuickPick(
                        [
                            { label: 'Global', value: 'global' },
                            { label: 'Local (Current Directory)', value: 'local' }
                        ],
                        { placeHolder: 'Select scope' }
                    );

                    if (scope) {
                        await setNodeVersion(selected.version, scope.value);
                    }
                }
            }
        }
    );

    const showCurrentVersionCommand = vscode.commands.registerCommand(
        'mise-node-switcher.showCurrentVersion',
        async () => {
            const installed = await checkMiseInstalled();
            if (!installed) return;

            const currentVersion = await getCurrentVersion();
            if (currentVersion) {
                vscode.window.showInformationMessage(`Current Node Version: ${currentVersion}`);
            } else {
                vscode.window.showInformationMessage('No Node version is currently set');
            }
        }
    );

    const installVersionCommand = vscode.commands.registerCommand(
        'mise-node-switcher.installVersion',
        async () => {
            const installed = await checkMiseInstalled();
            if (!installed) return;

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
                const success = await installNodeVersion(input);
                if (success) {
                    const use = await vscode.window.showInformationMessage(
                        `Node ${input} installed. Set as active version?`,
                        'Yes (Global)',
                        'Yes (Local)',
                        'No'
                    );

                    if (use === 'Yes (Global)') {
                        await setNodeVersion(input, 'global');
                    } else if (use === 'Yes (Local)') {
                        await setNodeVersion(input, 'local');
                    }
                }
            }
        }
    );

    const refreshVersionsCommand = vscode.commands.registerCommand(
        'mise-node-switcher.refreshVersions',
        async () => {
            const installed = await checkMiseInstalled();
            if (!installed) return;

            await updateStatusBar();
            vscode.window.showInformationMessage('Node versions refreshed');
        }
    );

    context.subscriptions.push(switchVersionCommand);
    context.subscriptions.push(showCurrentVersionCommand);
    context.subscriptions.push(installVersionCommand);
    context.subscriptions.push(refreshVersionsCommand);
}

function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}

module.exports = {
    activate,
    deactivate
};
