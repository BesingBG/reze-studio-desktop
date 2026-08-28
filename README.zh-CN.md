# Reze Studio Desktop

[English](README.md)

基于 [reze-studio](https://github.com/AmyangXYZ/reze-studio) 封装的跨平台桌面应用，用于手 K 和编辑 MMD（MikuMikuDance）`.vmd` 动画片段——时间轴、dopesheet（关键帧表）与逐通道 Bézier 曲线编辑器。通过 WebGPU 实时本地渲染，内嵌 Next.js 服务器，无需外部服务。支持 Windows 与 macOS。

![Reze Studio Desktop](screenshot.webp)

## 功能

- **离线本地运行**：Electron 内嵌 `next start`，无需外部服务
- PMX 模型与 VMD 动画加载渲染（IK 与物理）
- 时间轴 + dopesheet + 逐通道 Bézier 曲线编辑器
- 关键帧插入/删除，旋转/位移滑块，骨骼/变形列表
- VMD 导入/导出
- WebGPU 自动检测与说明指引（双显卡/驱动问题排查）
- 发行剥离：内置版权模型/动画不出现在发行包内，打开为空编辑器，自行从文件菜单导入 PMX/VMD
- 在线访问作者站点、检查更新入口（配置于 `config.json`）
- Windows NSIS 向导式安装 / macOS 未签名 dmg（随附放行说明）

## 利用 GitHub Actions 云打包

不想在本地折腾打包环境？可直接用 GitHub Actions 在云端一键打包 Windows 与 macOS 两个平台的安装包：

- **直接下载**：进入仓库 **Actions** 页，选择 `Build Installer (Windows & macOS)` 工作流，Run 一次会同时产出两个平台 → 打开最近一次成功的运行 → 在页面底部 **Artifacts** 下载 `installer-windows-<版本>-<SHA>` / `installer-macos-<版本>-<SHA>`，解压即得 `Reze-Studio-Desktop-<版本>-windows-<SHA>-Setup.exe` / `Reze-Studio-Desktop-<版本>-macos-<SHA>.dmg`。
  > **注意**：GitHub Actions 产物（Artifacts）**需要登录 GitHub 账号才能下载**。
- **自行打包（Fork）**：Fork 本仓库（保持 public 即可使用 GitHub 公共仓库的免费构建额度）→ 在自己的 Fork 仓库打开 **Actions** → 选择 `Build Installer (Windows & macOS)` 工作流 → **Run workflow**：
  - `upstream_ref` 留空：按仓库**已适配的上游版本**（当前为上游 v0.1.6，对应提交 e72bd45）打包；
  - 也可填 `latest-commit`（上游默认分支最新提交）/ `latest`（最新 tag）/ 具体 tag 或 commit SHA；
  - `version_override` 可强制指定产物版本号，留空则自动读取上游 `package.json` 的 version；
  - 勾选 `upload_release`（默认不勾）时，构建成功后会把 win/mac 两个安装包上传到该仓库同一个 tag 的 **Pre-release**（可随时删除/编辑/转正式）；
  - 构建完成后，同样到自己 Fork 的运行记录底部 **Artifacts** 下载安装包。
- **触发方式**：该工作流为**手动触发**（`workflow_dispatch`），当前**未开启定时自动打包**；在仓库主页 Actions 页手动运行。

## 环境要求

- Node.js 22（`.nvmrc` 已锁定）
- 显卡支持 WebGPU（Windows: D3D12; macOS: Metal），详见 `resources/WebGPU-guide.md`

## 开发

```bash
git clone --recurse-submodules <repo-url>
cd reze-studio-desktop

npm install
npm run dev        # 启动 Electron + reze-studio 开发服务器
```

## 打包

```bash
npm run dist                # 完整构建（空场景版：构建期置 NEXT_PUBLIC_USE_DEFAULT_ASSETS=false）
npm run dist -- --skip-build   # 复用已有 .next（空场景不生效，不建议用于发行）
```

- Windows 产物：`dist/RezeStudio-<version>-Setup.exe`（NSIS 向导式）
- macOS 产物：`dist/RezeStudio-<version>.dmg`（未签名，安装见 `resources/MAC-install.md`）

### macOS 未签名放行（一次即可）

应用未购买 Apple 签名，首次打开可能被 Gatekeeper 拦截；在终端执行一次即可：

```bash
xattr -dr com.apple.quarantine "/Applications/Reze Studio.app"
```

> 也可用 `xattr -cr "/Applications/Reze Studio.app"` 全清扩展属性；若报"应用已损坏"说明隔离标记在包内，务必用上面这条递归版。
> 右键"打开"、系统设置允许等其它方式见 `resources/MAC-install.md`。

图标由 `build/icon-source.jpg` 生成：

```bash
npm run make-icon   # 产出 build/icon.ico、icon.png、icon.icns
```

## 目录结构

```
electron/            Electron 主进程与 preload
scripts/             dev / dist / make-icon / after-pack
resources/           说明文档
config.json          在线地址、更新地址、端口
reze-studio/         子模块（上游 reze-studio）
```

## License

[GPL-3.0](LICENSE)

## 致谢

感谢 [AmyangXYZ](https://github.com/AmyangXYZ/) 创建并维护了优秀的 reze-engine MMD WebGPU 引擎，以及其他相关项目。
