const { exec } = require('child_process');
const util = require('util');
const os = require('os');
const vscode = require('vscode');

const execPromise = util.promisify(exec);

/**
 * Helper class for managing Node.js processes
 */
class ProcessHelper {
    /**
     * Check if there are running Node.js processes
     * @returns {Promise<Array>} Array of process info objects
     */
    static async getNodeProcesses() {
        const platform = os.platform();

        if (platform !== 'win32') {
            // On Unix-like systems, use ps
            try {
                const { stdout } = await execPromise('ps aux | grep node | grep -v grep');
                const lines = stdout.trim().split('\n').filter(line => line.length > 0);
                return lines.map(line => {
                    const parts = line.trim().split(/\s+/);
                    return {
                        pid: parts[1],
                        command: parts.slice(10).join(' ')
                    };
                });
            } catch (error) {
                // No processes found or error
                return [];
            }
        } else {
            // On Windows, use tasklist
            try {
                const { stdout } = await execPromise('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH');
                const lines = stdout.trim().split('\n').filter(line => line.includes('node.exe'));
                return lines.map(line => {
                    // Parse CSV format: "node.exe","PID","Session Name","Session#","Mem Usage"
                    const match = line.match(/"([^"]+)","(\d+)"/);
                    if (match) {
                        return {
                            pid: match[2],
                            command: match[1]
                        };
                    }
                    return null;
                }).filter(p => p !== null);
            } catch (error) {
                // No processes found or error
                return [];
            }
        }
    }

    /**
     * Kill all Node.js processes
     * @returns {Promise<boolean>} True if successful
     */
    static async killNodeProcesses() {
        const platform = os.platform();

        try {
            if (platform === 'win32') {
                // On Windows, use taskkill
                await execPromise('taskkill /F /IM node.exe /T');
            } else {
                // On Unix-like systems, use pkill
                await execPromise('pkill -9 node');
            }
            return true;
        } catch (error) {
            // If error is "not found", it means no processes were running
            if (error.message.includes('not found') || error.message.includes('No tasks')) {
                return true;
            }
            throw error;
        }
    }

    /**
     * Prompt user to handle Node.js processes before switching version
     * @returns {Promise<boolean>} True if user wants to continue, false otherwise
     */
    static async promptToHandleProcesses() {
        const processes = await this.getNodeProcesses();

        if (processes.length === 0) {
            return true; // No processes, safe to continue
        }

        const platform = os.platform();
        const message = platform === 'win32'
            ? `Found ${processes.length} running Node.js process(es). These must be terminated before switching versions.`
            : `Found ${processes.length} running Node.js process(es). Switching versions may fail if these are in use.`;

        const terminateOption = 'Terminate Processes';
        const cancelOption = 'Cancel';
        const continueOption = 'Continue Anyway';

        const options = platform === 'win32'
            ? [terminateOption, cancelOption]
            : [terminateOption, continueOption, cancelOption];

        const choice = await vscode.window.showWarningMessage(
            message,
            { modal: true },
            ...options
        );

        if (choice === terminateOption) {
            try {
                await this.killNodeProcesses();
                vscode.window.showInformationMessage('Node.js processes terminated successfully.');
                return true;
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to terminate processes: ${error.message}`);
                return false;
            }
        } else if (choice === continueOption) {
            return true;
        }

        return false; // User cancelled
    }

    /**
     * Prompt user to reload VS Code window after version switch
     */
    static async promptToReloadWindow() {
        const choice = await vscode.window.showInformationMessage(
            'Node version switched successfully. Reload VS Code to apply changes?',
            'Reload Now',
            'Later'
        );

        if (choice === 'Reload Now') {
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
    }
}

module.exports = ProcessHelper;
