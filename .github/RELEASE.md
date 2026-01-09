## 工作流说明

本项目配置了 GitHub Actions 自动编译和发布工作流。

### 1. CI 工作流 (`.github/workflows/ci.yml`)

**触发条件：**
- 推送到 `main` 或 `develop` 分支
- 向 `main` 或 `develop` 分支提交 Pull Request

**功能：**
- 在多个操作系统（Ubuntu、Windows、macOS）上测试构建
- 使用多个 Node.js 版本（18、20）进行测试
- 自动打包扩展为 `.vsix` 文件
- 保存构建产物（artifact）7 天

### 2. Release 工作流 (`.github/workflows/release.yml`)

**触发条件：**
- 推送以 `v` 开头的 Git 标签（例如：`v1.0.4`）

**功能：**
- 自动打包扩展
- 创建 GitHub Release
- 上传 `.vsix` 文件到 Release
- 自动生成 Release Notes

## 如何发布新版本

### 步骤 1: 更新版本号

编辑 `package.json` 文件，更新版本号：

```json
{
  "version": "1.0.4"
}
```

### 步骤 2: 提交更改

```bash
git add package.json
git commit -m "chore: bump version to 1.0.4"
git push origin main
```

### 步骤 3: 创建并推送标签

```bash
# 创建标签（版本号要与 package.json 一致）
git tag v1.0.4

# 推送标签到 GitHub
git push origin v1.0.4
```

### 步骤 4: 等待自动发布

推送标签后，GitHub Actions 会自动：
1. 检出代码
2. 安装依赖
3. 打包扩展
4. 创建 GitHub Release
5. 上传 `.vsix` 文件
6. 生成 Release Notes

你可以在 GitHub 仓库的 "Actions" 标签页查看工作流执行状态。

## 版本号规范

建议遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范：

- **主版本号（Major）**：不兼容的 API 修改
- **次版本号（Minor）**：向下兼容的功能性新增
- **修订号（Patch）**：向下兼容的问题修正

例如：
- `v1.0.0` → `v1.0.1`：修复 bug
- `v1.0.1` → `v1.1.0`：添加新功能
- `v1.1.0` → `v2.0.0`：重大更新，可能不兼容旧版本
