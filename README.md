# Mise Node Version Switcher

一个用于快速切换 Node.js 版本的 VSCode 扩展，基于 [mise](https://mise.jdx.dev/) 工具。

## 功能特性

- **快速切换**：轻松在已安装的 Node.js 版本之间切换
- **状态栏显示**：在状态栏显示当前使用的 Node.js 版本
- **安装新版本**：直接从 VSCode 安装新的 Node.js 版本
- **全局/本地切换**：支持全局或项目级别的版本切换
- **自动检测**：自动检测 mise 是否已安装

## 前置要求

在使用此扩展之前,你需要先安装 mise：

### Linux/macOS

```bash
curl https://mise.run | sh
```

### Windows

```powershell
# 使用 winget
winget install jdx.mise

# 或使用 scoop
scoop install mise

# 或使用 chocolatey
choco install mise
```

更多安装方式请参考 [mise 官方文档](https://mise.jdx.dev/getting-started.html)。

### 配置 mise 路径（如果自动检测失败）

如果扩展无法自动找到 mise，你可以手动配置路径：

1. 打开 VSCode 设置（`Ctrl+,` / `Cmd+,`）
2. 搜索 "mise"
3. 找到 "Mise Node Switcher: Mise Path"
4. 输入 mise 可执行文件的完整路径

**Windows 示例路径：**
- `C:\Users\你的用户名\AppData\Local\Microsoft\WinGet\Links\mise.exe`
- `C:\Users\你的用户名\AppData\Local\mise\mise.exe`
- `C:\ProgramData\chocolatey\bin\mise.exe`

**Linux/macOS 示例路径：**
- `/home/你的用户名/.local/bin/mise`
- `/usr/local/bin/mise`
- `/opt/homebrew/bin/mise`

你可以在终端运行以下命令找到 mise 的路径：
- Windows: `where mise`
- Linux/macOS: `which mise`

## 使用方法

### 切换 Node 版本

1. 点击状态栏右下角的 Node 版本指示器
2. 或者打开命令面板（`Ctrl+Shift+P` / `Cmd+Shift+P`）并输入 "Mise: Switch Node Version"
3. 从列表中选择一个已安装的版本
4. 选择切换范围（全局或本地）

### 安装新版本

1. 打开命令面板并输入 "Mise: Install Node Version"
2. 输入要安装的版本号（例如：24, 22.1.0, lts）
3. 等待安装完成
4. 选择是否将新安装的版本设为活动版本

### 查看当前版本

- 打开命令面板并输入 "Mise: Show Current Node Version"
- 或者查看状态栏右下角的版本指示器

### 刷新版本列表

- 打开命令面板并输入 "Mise: Refresh Node Versions"

## 命令列表

- `mise-node-switcher.switchVersion` - 切换 Node 版本
- `mise-node-switcher.showCurrentVersion` - 显示当前 Node 版本
- `mise-node-switcher.installVersion` - 安装新的 Node 版本
- `mise-node-switcher.refreshVersions` - 刷新版本列表

## 工作原理

此扩展通过调用 mise CLI 命令来管理 Node.js 版本：

- `mise ls node` - 列出已安装的版本
- `mise current node` - 获取当前版本
- `mise use node@<version>` - 切换版本
- `mise install node@<version>` - 安装版本

## 全局 vs 本地

- **全局**：使用 `mise use --global node@<version>`，版本配置保存在 `~/.config/mise/config.toml`
- **本地**：使用 `mise use node@<version>`，版本配置保存在当前目录的 `mise.toml` 或 `.mise.toml` 文件中

## 安装扩展

### 从源码安装

1. 克隆或下载此仓库
2. 在 VSCode 中打开该文件夹
3. 按 `F5` 在新的扩展开发主机窗口中运行扩展

### 打包为 VSIX

```bash
npm install -g @vscode/vsce
cd mise-node-switcher
npm install
vsce package
```

然后在 VSCode 中安装生成的 `.vsix` 文件：
1. 打开 VSCode
2. 按 `Ctrl+Shift+P` / `Cmd+Shift+P` 打开命令面板
3. 输入 "Extensions: Install from VSIX..."
4. 选择生成的 `.vsix` 文件

## 系统要求

- 系统中必须安装 mise
- VSCode 版本 1.60.0 或更高

## 常见问题

### mise 命令未找到

确保 mise 已正确安装并添加到 PATH 中。你可以在终端运行 `mise --version` 来验证。

### 切换版本后不生效

- 如果使用全局切换，可能需要重启终端或 VSCode
- 如果使用本地切换，确保在项目根目录下执行

## 相关链接

- [mise 官方文档](https://mise.jdx.dev/)
- [mise GitHub 仓库](https://github.com/jdx/mise)
