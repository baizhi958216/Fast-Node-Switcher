const vscode = require('vscode');
const ToolDetector = require('./src/detector');
const StatusBarManager = require('./src/status-bar');
const NvmrcHandler = require('./src/nvmrc-handler');
const Commands = require('./src/commands');

let detector;
let statusBarManager;
let nvmrcHandler;
let commands;

/**
 * Activate the extension
 */
async function activate(context) {
    console.log('Fast Node Switcher is now active');

    // Initialize tool detector
    detector = new ToolDetector();
    const manager = await detector.detectAll();

    if (!manager) {
        // No version manager found, show error
        await detector.showNoManagerError();
    }

    // Initialize status bar
    statusBarManager = new StatusBarManager(detector);
    context.subscriptions.push(statusBarManager);
    await statusBarManager.update();

    // Initialize .nvmrc handler if a manager is available
    if (manager) {
        nvmrcHandler = new NvmrcHandler(manager);

        // Auto-apply .nvmrc if workspace is open
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceFolder = workspaceFolders[0].uri.fsPath;

            // Apply .nvmrc on activation
            await nvmrcHandler.autoApplyNvmrc(workspaceFolder);

            // Watch for .nvmrc changes
            const watcher = nvmrcHandler.watchNvmrc(workspaceFolder);
            context.subscriptions.push(watcher);
        }

        context.subscriptions.push(nvmrcHandler);
    }

    // Register commands
    commands = new Commands(detector, statusBarManager, nvmrcHandler);
    commands.register(context);

    // Listen for workspace folder changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
            if (event.added.length > 0 && manager && nvmrcHandler) {
                const workspaceFolder = event.added[0].uri.fsPath;
                await nvmrcHandler.autoApplyNvmrc(workspaceFolder);
                nvmrcHandler.watchNvmrc(workspaceFolder);
            }
        })
    );

    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration('fastNodeSwitcher')) {
                // Re-detect tools if configuration changed
                const newManager = await detector.detectAll();
                if (newManager) {
                    await statusBarManager.update();
                }
            }
        })
    );
}

/**
 * Deactivate the extension
 */
function deactivate() {
    if (statusBarManager) {
        statusBarManager.dispose();
    }
    if (nvmrcHandler) {
        nvmrcHandler.dispose();
    }
}

module.exports = {
    activate,
    deactivate
};
