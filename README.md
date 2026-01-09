# Fast Node Switcher

一个用于快速切换 Node.js 版本的 VSCode 扩展，支持 [nvm](https://github.com/nvm-sh/nvm)、[nvm-windows](https://github.com/coreybutler/nvm-windows) 和 [mise](https://mise.jdx.dev/) 工具。

## 功能特性

- **多工具支持**：自动检测并使用 nvm 或 mise（优先使用 nvm）
- **快速切换**：轻松在已安装的 Node.js 版本之间切换
- **状态栏显示**：在状态栏显示当前使用的 Node.js 版本和管理工具
- **安装新版本**：直接从 VSCode 安装新的 Node.js 版本
- **全局/本地切换**：支持全局或项目级别的版本切换
- **.nvmrc 支持**：自动检测并应用 .nvmrc 文件中指定的版本
- **自动检测**：自动检测 nvm 或 mise 是否已安装
- **跨平台**：支持 Windows、Linux 和 macOS

## 前置要求

在使用此扩展之前，你需要先安装 nvm 或 mise（至少安装其中一个）：

### nvm (推荐)

#### Windows (nvm-windows)

```powershell
# 从 GitHub 下载安装器
# https://github.com/coreybutler/nvm-windows/releases

# 或使用 Chocolatey
choco install nvm

# 或使用 Scoop
scoop install nvm
```

#### Linux/macOS (nvm)

```bash
# 使用官方安装脚本
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 或使用 Homebrew (macOS)
brew install nvm
```

更多安装方式请参考：
- [nvm-windows 官方文档](https://github.com/coreybutler/nvm-windows)
- [nvm 官方文档](https://github.com/nvm-sh/nvm)

### mise (可选)

#### Linux/macOS

```bash
curl https://mise.run | sh
```

#### Windows

```powershell
# 使用 winget
winget install jdx.mise

# 或使用 scoop
scoop install mise

# 或使用 chocolatey
choco install mise
```

更多安装方式请参考 [mise 官方文档](https://mise.jdx.dev/getting-started.html)。

## 配置

### 自定义工具路径

如果扩展无法自动找到 nvm 或 mise，你可以手动配置路径：

1. 打开 VSCode 设置（`Ctrl+,` / `Cmd+,`）
2. 搜索 "Node Version Switcher"
3. 配置相应的路径

**可用配置项：**

- **Nvm Path**: nvm 可执行文件路径
  - Windows: `C:\Program Files\nvm\nvm.exe`
  - Unix: `/home/你的用户名/.nvm/nvm.sh`

- **Mise Path**: mise 可执行文件路径
  - Windows: `C:\Users\你的用户名\AppData\Local\Microsoft\WinGet\Links\mise.exe`
  - Unix: `/home/你的用户名/.local/bin/mise`

- **Preferred Tool**: 首选工具（auto/nvm/mise）
  - `auto`: 自动选择（优先 nvm）
  - `nvm`: 强制使用 nvm
  - `mise`: 强制使用 mise

- **Auto Apply Nvmrc**: 是否自动应用 .nvmrc 文件（默认：true）

### 查找工具路径

你可以在终端运行以下命令找到工具的路径：
- Windows: `where nvm` 或 `where mise`
- Linux/macOS: `which nvm` 或 `which mise`

## 使用方法

### 切换 Node 版本

1. 点击状态栏右下角的 Node 版本指示器
2. 或者打开命令面板（`Ctrl+Shift+P` / `Cmd+Shift+P`）并输入 "Node: Switch Version"
3. 从列表中选择一个已安装的版本
4. 选择切换范围（全局或本地）

### 安装新版本

1. 打开命令面板并输入 "Node: Install Version"
2. 输入要安装的版本号（例如：24, 22.1.0, lts）
3. 等待安装完成
4. 选择是否将新安装的版本设为活动版本

### 使用 .nvmrc 文件

在项目根目录创建 `.nvmrc` 文件，指定 Node 版本：

```
20.10.0
```

或者只指定主版本号：

```
20
```

当你打开包含 .nvmrc 文件的项目时，扩展会自动询问是否切换到指定的版本。

### 查看当前版本

- 打开命令面板并输入 "Node: Show Current Version"
- 或者查看状态栏右下角的版本指示器

### 刷新版本列表

- 打开命令面板并输入 "Node: Refresh Versions"

## 命令列表

- `fast-node-switcher.switchVersion` - 切换 Node 版本
- `fast-node-switcher.showCurrentVersion` - 显示当前 Node 版本
- `fast-node-switcher.installVersion` - 安装新的 Node 版本
- `fast-node-switcher.refreshVersions` - 刷新版本列表

## 工作原理

此扩展通过调用版本管理工具的 CLI 命令来管理 Node.js 版本：

### nvm 命令

- `nvm list` - 列出已安装的版本
- `nvm current` - 获取当前版本
- `nvm use <version>` - 切换版本
- `nvm install <version>` - 安装版本
- `nvm alias default <version>` - 设置默认版本（Unix）

### mise 命令

- `mise ls node` - 列出已安装的版本
- `mise current node` - 获取当前版本
- `mise use node@<version>` - 切换版本
- `mise install node@<version>` - 安装版本

## 全局 vs 本地

### nvm

- **全局**：使用 `nvm use <version>` 并设置为默认版本
- **本地**：在项目目录创建 `.nvmrc` 文件

### mise

- **全局**：使用 `mise use --global node@<version>`，配置保存在 `~/.config/mise/config.toml`
- **本地**：使用 `mise use node@<version>`，配置保存在当前目录的 `mise.toml` 或 `.mise.toml` 文件中

## 工具优先级

当系统同时安装了多个版本管理工具时，扩展会按以下优先级选择：

1. **用户配置的首选工具**（如果设置了 `preferredTool`）
2. **nvm** (Windows 上为 nvm-windows)
3. **mise**

你可以在设置中修改 `preferredTool` 来改变这个行为。

## 安装扩展

### 从源码安装

1. 克隆或下载此仓库
2. 在 VSCode 中打开该文件夹
3. 按 `F5` 在新的扩展开发主机窗口中运行扩展

### 打包为 VSIX

```bash
npm install -g @vscode/vsce
cd fast-node-switcher
npm install
vsce package
```

然后在 VSCode 中安装生成的 `.vsix` 文件：
1. 打开 VSCode
2. 按 `Ctrl+Shift+P` / `Cmd+Shift+P` 打开命令面板
3. 输入 "Extensions: Install from VSIX..."
4. 选择生成的 `.vsix` 文件

## 系统要求

- 系统中必须安装 nvm 或 mise（至少一个）
- VSCode 版本 1.60.0 或更高

## 常见问题

### 工具未找到

确保 nvm 或 mise 已正确安装并添加到 PATH 中。你可以在终端运行以下命令来验证：
- `nvm --version` (Windows) 或 `nvm --version` (Unix)
- `mise --version`

### 切换版本后不生效

- 如果使用全局切换，可能需要重启终端或 VSCode
- 如果使用本地切换，确保在项目根目录下执行
- 对于 nvm，确保终端已正确配置（Unix 系统需要在 shell 配置文件中 source nvm.sh）

### .nvmrc 不自动应用

检查设置中的 "Auto Apply Nvmrc" 选项是否已启用。

### nvm-windows 不支持本地作用域

nvm-windows 只支持全局切换。当选择"本地"作用域时，扩展会创建 .nvmrc 文件作为提示，但实际切换仍然是全局的。

## 相关链接

- [nvm (Unix) GitHub 仓库](https://github.com/nvm-sh/nvm)
- [nvm-windows GitHub 仓库](https://github.com/coreybutler/nvm-windows)
- [mise 官方文档](https://mise.jdx.dev/)
- [mise GitHub 仓库](https://github.com/jdx/mise)

## 更新日志

### 1.0.1

- 添加 nvm 和 nvm-windows 支持
- 添加 .nvmrc 文件自动检测和应用
- 重构代码架构，采用策略模式
- 改进工具检测逻辑
- 更新命令标题（从 "Mise:" 改为 "Node:"）
- 添加新的配置选项

### 1.0.0

- 初始版本，支持 mise
