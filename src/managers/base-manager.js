/**
 * Base class for Node version managers
 * All version managers (mise, nvm, nvm-windows) must implement this interface
 */
class BaseVersionManager {
    constructor() {
        this.name = 'base';           // Tool name (e.g., 'mise', 'nvm', 'nvm-windows')
        this.command = null;          // Command path
        this.isAvailable = false;     // Whether the tool is available
    }

    /**
     * Detect if the version manager is installed
     * @returns {Promise<boolean>} True if detected and available
     */
    async detect() {
        throw new Error('detect() must be implemented by subclass');
    }

    /**
     * Get list of installed Node versions
     * @returns {Promise<string[]>} Array of version strings (e.g., ['20.10.0', '18.19.0'])
     */
    async getInstalledVersions() {
        throw new Error('getInstalledVersions() must be implemented by subclass');
    }

    /**
     * Get the currently active Node version
     * @returns {Promise<string|null>} Current version string or null if none set
     */
    async getCurrentVersion() {
        throw new Error('getCurrentVersion() must be implemented by subclass');
    }

    /**
     * Set/switch to a specific Node version
     * @param {string} version - Version to switch to (e.g., '20.10.0')
     * @param {string} scope - 'global' or 'local'
     * @returns {Promise<boolean>} True if successful
     */
    async setVersion(version, scope = 'global') {
        throw new Error('setVersion() must be implemented by subclass');
    }

    /**
     * Install a specific Node version
     * @param {string} version - Version to install (e.g., '20.10.0')
     * @returns {Promise<boolean>} True if successful
     */
    async installVersion(version) {
        throw new Error('installVersion() must be implemented by subclass');
    }

    /**
     * Get list of available Node versions that can be installed
     * @returns {Promise<string[]>} Array of version strings
     */
    async getAvailableVersions() {
        throw new Error('getAvailableVersions() must be implemented by subclass');
    }

    /**
     * Check if this manager supports local/global scope
     * @returns {boolean} True if scope is supported
     */
    supportsScope() {
        return true; // Most managers support scope
    }

    /**
     * Get the configuration file name for this manager
     * @returns {string|null} Config file name (e.g., '.nvmrc', '.mise.toml') or null
     */
    getConfigFileName() {
        return null;
    }

    /**
     * Get the display name for this manager
     * @returns {string} Display name
     */
    getDisplayName() {
        return this.name;
    }
}

module.exports = BaseVersionManager;
